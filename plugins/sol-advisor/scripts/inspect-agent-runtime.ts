import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  statSync,
  type Dirent,
  type Stats,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type RuntimeEvidence = {
  thread_id: string;
  parent_thread_id: string | null;
  agent_role: string;
  agent_path: string | null;
  model_provider: string | null;
  model: string;
  effort: string;
  sandbox_policy_type: string;
  permission_profile_type: string;
  cwd: string;
};

export const DEFAULT_RUNTIME_INSPECTION_LIMITS = {
  maxDirectories: 4_096,
  maxEntries: 100_000,
  maxMatchedRolloutBytes: 8 * 1024 * 1024,
  maxLineBytes: 1024 * 1024,
  maxRecords: 10_000,
} as const;

export type RuntimeInspectionLimits = {
  [Key in keyof typeof DEFAULT_RUNTIME_INSPECTION_LIMITS]: number;
};

export type RuntimeInspectionOptions = {
  limits?: Partial<RuntimeInspectionLimits>;
  /** Test-only hook. It is never reachable from the CLI. */
  testHooks?: {
    beforeOpen?: (candidatePath: string) => void;
  };
};

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID_ROLLOUT =
  "rollout is missing, ambiguous, invalid, or inconsistent required routing metadata.";
const DIRECTORY_LIMIT_EXCEEDED =
  "session directory traversal exceeded the directory limit.";
const ENTRY_LIMIT_EXCEEDED =
  "session directory traversal exceeded the entry limit.";
const ROLLOUT_TOO_LARGE = "matched rollout exceeds the maximum size.";
const LINE_TOO_LARGE = "rollout contains a line exceeding the maximum size.";
const RECORD_LIMIT_EXCEEDED = "rollout exceeds the record limit.";
const CANDIDATE_CHANGED = "matched rollout changed during inspection.";

class RuntimeInspectionError extends Error {}

type FileIdentity = Pick<Stats, "dev" | "ino" | "size">;

type ParsedRollout = {
  sessions: Record<string, unknown>[];
  turns: Record<string, unknown>[];
};

function fail(message: string): never {
  throw new RuntimeInspectionError(message);
}

function invalidRollout(): never {
  return fail(INVALID_ROLLOUT);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalidRollout();
  return value;
}

function optionalStringOrNull(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalidRollout();
  return value;
}

function requiredNestedType(payload: Record<string, unknown>, key: string): string {
  const nested = payload[key];
  if (!isRecord(nested)) invalidRollout();
  return requiredString(nested.type);
}

function effortFromTurn(payload: Record<string, unknown>): string {
  const legacyPresent = hasOwn(payload, "effort");
  const legacy = legacyPresent ? requiredString(payload.effort) : null;

  let nestedPresent = false;
  let nested: string | null = null;
  const collaborationMode = payload.collaboration_mode;
  if (isRecord(collaborationMode) && isRecord(collaborationMode.settings)) {
    const settings = collaborationMode.settings;
    nestedPresent = hasOwn(settings, "reasoning_effort");
    if (nestedPresent) nested = requiredString(settings.reasoning_effort);
  }

  if (legacyPresent && nestedPresent && legacy !== nested) invalidRollout();
  if (legacy === null && nested === null) invalidRollout();
  return legacy ?? nested!;
}

function requireOneValue(values: string[]): string {
  if (values.length === 0 || new Set(values).size !== 1) invalidRollout();
  return values[0]!;
}

function resolveLimits(
  overrides: Partial<RuntimeInspectionLimits> | undefined,
): RuntimeInspectionLimits {
  const limits: RuntimeInspectionLimits = {
    ...DEFAULT_RUNTIME_INSPECTION_LIMITS,
    ...overrides,
  };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      fail("runtime inspection limits are invalid.");
    }
  }
  return limits;
}

function isWithinRoot(canonicalRoot: string, canonicalPath: string): boolean {
  const pathFromRoot = relative(canonicalRoot, canonicalPath);
  return (
    pathFromRoot === "" ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

function resolveSessionsRoot(sessionsDir: string): string {
  try {
    const canonicalRoot = realpathSync(resolve(sessionsDir));
    if (!statSync(canonicalRoot).isDirectory()) {
      fail("sessions directory is unavailable.");
    }
    return canonicalRoot;
  } catch (error) {
    if (error instanceof RuntimeInspectionError) throw error;
    fail("sessions directory is unavailable.");
  }
}

function canonicalDirectory(
  directory: string,
  canonicalRoot: string,
): string | null {
  try {
    const directoryLstat = lstatSync(directory);
    if (directoryLstat.isSymbolicLink()) return null;
    if (!directoryLstat.isDirectory()) {
      fail("could not enumerate rollout filenames under the sessions directory.");
    }
    const canonical = realpathSync(directory);
    if (!isWithinRoot(canonicalRoot, canonical) || !statSync(canonical).isDirectory()) {
      fail("could not enumerate rollout filenames under the sessions directory.");
    }
    return canonical;
  } catch (error) {
    if (error instanceof RuntimeInspectionError) throw error;
    fail("could not enumerate rollout filenames under the sessions directory.");
  }
}

function findRolloutFiles(
  canonicalRoot: string,
  threadId: string,
  limits: RuntimeInspectionLimits,
): string[] {
  const suffix = `-${threadId}.jsonl`;
  const stack = [canonicalRoot];
  const matches: string[] = [];
  let directoriesVisited = 0;
  let entriesVisited = 0;

  /*
   * Node has no cross-platform directory-handle API that can pin a tree against
   * hostile same-user replacement while it is being enumerated. Each directory is
   * therefore re-canonicalized and containment-checked before reading; observable
   * changes fail closed, and the final rollout is read through a verified handle.
   */
  while (stack.length > 0) {
    const requestedDirectory = stack.pop()!;
    const directory = canonicalDirectory(requestedDirectory, canonicalRoot);
    if (directory === null) continue;
    if (++directoriesVisited > limits.maxDirectories) fail(DIRECTORY_LIMIT_EXCEEDED);

    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      fail("could not enumerate rollout filenames under the sessions directory.");
    }

    for (const entry of entries) {
      if (++entriesVisited > limits.maxEntries) fail(ENTRY_LIMIT_EXCEEDED);
      if (entry.isSymbolicLink()) continue;

      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (
        entry.isFile() &&
        entry.name.startsWith("rollout-") &&
        entry.name.endsWith(suffix)
      ) {
        matches.push(path);
        if (matches.length > 1) return matches;
      }
    }
  }

  return matches;
}

function sameFileIdentity(first: FileIdentity, second: FileIdentity): boolean {
  return (
    first.dev === second.dev &&
    first.ino === second.ino &&
    first.size === second.size
  );
}

function verifiedCandidateBuffer(
  candidate: string,
  canonicalRoot: string,
  limits: RuntimeInspectionLimits,
  testHooks: RuntimeInspectionOptions["testHooks"],
): Buffer {
  let before: Stats;
  let canonicalBefore: string;
  try {
    before = lstatSync(candidate);
    if (!before.isFile() || before.isSymbolicLink()) fail(CANDIDATE_CHANGED);
    canonicalBefore = realpathSync(candidate);
    if (!isWithinRoot(canonicalRoot, canonicalBefore)) fail(CANDIDATE_CHANGED);
  } catch (error) {
    if (error instanceof RuntimeInspectionError) throw error;
    fail(CANDIDATE_CHANGED);
  }

  if (!Number.isSafeInteger(before.size) || before.size > limits.maxMatchedRolloutBytes) {
    fail(ROLLOUT_TOO_LARGE);
  }

  testHooks?.beforeOpen?.(candidate);

  let descriptor: number | undefined;
  try {
    descriptor = openSync(candidate, "r");
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(before, opened)) fail(CANDIDATE_CHANGED);

    const afterPath = lstatSync(candidate);
    if (!afterPath.isFile() || afterPath.isSymbolicLink() || !sameFileIdentity(before, afterPath)) {
      fail(CANDIDATE_CHANGED);
    }
    const canonicalAfter = realpathSync(candidate);
    if (
      canonicalAfter !== canonicalBefore ||
      !isWithinRoot(canonicalRoot, canonicalAfter)
    ) {
      fail(CANDIDATE_CHANGED);
    }

    const contents = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < contents.length) {
      const read = readSync(descriptor, contents, offset, contents.length - offset, offset);
      if (read === 0) fail(CANDIDATE_CHANGED);
      offset += read;
    }
    return contents;
  } catch (error) {
    if (error instanceof RuntimeInspectionError) throw error;
    fail(CANDIDATE_CHANGED);
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The read result is never used after a close failure.
      }
    }
  }
}

function eventPayload(record: unknown): Record<string, unknown> {
  if (!isRecord(record) || !isRecord(record.payload)) invalidRollout();
  return record.payload;
}

function parseJsonl(
  contents: Buffer,
  limits: RuntimeInspectionLimits,
): ParsedRollout {
  const sessions: Record<string, unknown>[] = [];
  const turns: Record<string, unknown>[] = [];
  let records = 0;
  let lineStart = 0;

  for (let index = 0; index <= contents.length; index += 1) {
    if (index !== contents.length && contents[index] !== 0x0a) continue;

    const lineLength = index - lineStart;
    if (lineLength > limits.maxLineBytes) fail(LINE_TOO_LARGE);
    const line = contents.subarray(lineStart, index).toString("utf8");
    lineStart = index + 1;
    if (line.trim() === "") continue;

    if (++records > limits.maxRecords) fail(RECORD_LIMIT_EXCEEDED);
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      invalidRollout();
    }

    if (!isRecord(record)) continue;
    if (record.type === "session_meta") {
      sessions.push(eventPayload(record));
    } else if (record.type === "turn_context") {
      turns.push(eventPayload(record));
    }
  }

  return { sessions, turns };
}

function validateThreadId(threadId: string): void {
  if (!LOWERCASE_UUID.test(threadId)) {
    fail("THREAD_ID must be a lowercase UUID.");
  }
}

export function inspectRuntime(
  sessionsDir: string,
  threadId: string,
  options: RuntimeInspectionOptions = {},
): RuntimeEvidence {
  validateThreadId(threadId);
  const limits = resolveLimits(options.limits);
  const canonicalRoot = resolveSessionsRoot(sessionsDir);
  const matches = findRolloutFiles(canonicalRoot, threadId, limits);
  if (matches.length === 0) {
    fail("no rollout filename matched the requested thread id.");
  }
  if (matches.length !== 1) {
    fail("multiple rollout filenames matched the requested thread id.");
  }

  const { sessions, turns } = parseJsonl(
    verifiedCandidateBuffer(matches[0]!, canonicalRoot, limits, options.testHooks),
    limits,
  );
  if (sessions.length !== 1 || turns.length === 0) invalidRollout();

  const session = sessions[0]!;
  const sessionThreadId = requiredString(session.id);
  if (sessionThreadId !== threadId) invalidRollout();

  const agentRole = requiredString(session.agent_role);
  const parentThreadId = optionalStringOrNull(session, "parent_thread_id");
  const agentPath = optionalStringOrNull(session, "agent_path");
  const modelProvider = optionalStringOrNull(session, "model_provider");

  const models: string[] = [];
  const efforts: string[] = [];
  const sandboxPolicyTypes: string[] = [];
  const permissionProfileTypes: string[] = [];
  const cwds: string[] = [];
  for (const payload of turns) {
    models.push(requiredString(payload.model));
    efforts.push(effortFromTurn(payload));
    sandboxPolicyTypes.push(requiredNestedType(payload, "sandbox_policy"));
    permissionProfileTypes.push(requiredNestedType(payload, "permission_profile"));
    cwds.push(requiredString(payload.cwd));
  }

  return {
    thread_id: sessionThreadId,
    parent_thread_id: parentThreadId,
    agent_role: agentRole,
    agent_path: agentPath,
    model_provider: modelProvider,
    model: requireOneValue(models),
    effort: requireOneValue(efforts),
    sandbox_policy_type: requireOneValue(sandboxPolicyTypes),
    permission_profile_type: requireOneValue(permissionProfileTypes),
    cwd: requireOneValue(cwds),
  };
}

function usage(): string {
  return [
    "Usage: inspect-agent-runtime.ts [--sessions-dir DIR] THREAD_ID",
    "",
    "Read the one rollout file whose filename ends with THREAD_ID and emit a compact JSON",
    "object containing only safe routing metadata.",
  ].join("\n");
}

function defaultSessionsDir(): string {
  const codexHome = process.env.CODEX_HOME;
  return codexHome ? join(codexHome, "sessions") : join(homedir(), ".codex", "sessions");
}

function parseCliArgs(args: string[]): { sessionsDir: string; threadId: string } {
  if (args.length === 1 && !args[0]!.startsWith("--")) {
    return { sessionsDir: defaultSessionsDir(), threadId: args[0]! };
  }
  if (args.length === 3 && args[0] === "--sessions-dir") {
    if (args[1] === "") fail("--sessions-dir requires a non-empty directory.");
    return { sessionsDir: args[1]!, threadId: args[2]! };
  }
  throw new RuntimeInspectionError(usage());
}

function oneLineError(error: unknown): string {
  if (error instanceof RuntimeInspectionError) return error.message;
  return "runtime inspection failed.";
}

function runCli(): void {
  let args: { sessionsDir: string; threadId: string };
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${oneLineError(error)}\n`);
    process.exitCode = 2;
    return;
  }

  try {
    process.stdout.write(`${JSON.stringify(inspectRuntime(args.sessionsDir, args.threadId))}\n`);
  } catch (error) {
    process.stderr.write(`ERROR: ${oneLineError(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) runCli();
