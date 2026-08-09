import { lstatSync, readFileSync, readdirSync, type Dirent } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID_ROLLOUT =
  "rollout is missing, ambiguous, invalid, or inconsistent required routing metadata.";

class RuntimeInspectionError extends Error {}

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

function parseJsonl(rolloutFile: string): unknown[] {
  let contents: string;
  try {
    contents = readFileSync(rolloutFile, "utf8");
  } catch {
    fail("matched rollout is unavailable.");
  }

  const records: unknown[] = [];
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      invalidRollout();
    }
  }
  return records;
}

function eventPayload(record: unknown): Record<string, unknown> {
  if (!isRecord(record) || !isRecord(record.payload)) invalidRollout();
  return record.payload;
}

function findRolloutFiles(sessionsDir: string, threadId: string): string[] {
  const suffix = `-${threadId}.jsonl`;
  const stack = [sessionsDir];
  const matches: string[] = [];

  while (stack.length > 0) {
    const directory = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      fail("could not enumerate rollout filenames under the sessions directory.");
    }

    for (const entry of entries) {
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

function resolveSessionsDir(sessionsDir: string): string {
  const resolved = resolve(sessionsDir);
  try {
    if (!lstatSync(resolved).isDirectory()) {
      fail("sessions directory is unavailable.");
    }
  } catch (error) {
    if (error instanceof RuntimeInspectionError) throw error;
    fail("sessions directory is unavailable.");
  }
  return resolved;
}

function validateThreadId(threadId: string): void {
  if (!LOWERCASE_UUID.test(threadId)) {
    fail("THREAD_ID must be a lowercase UUID.");
  }
}

export function inspectRuntime(
  sessionsDir: string,
  threadId: string,
): RuntimeEvidence {
  validateThreadId(threadId);
  const resolvedSessionsDir = resolveSessionsDir(sessionsDir);
  const matches = findRolloutFiles(resolvedSessionsDir, threadId);
  if (matches.length === 0) {
    fail("no rollout filename matched the requested thread id.");
  }
  if (matches.length !== 1) {
    fail("multiple rollout filenames matched the requested thread id.");
  }

  const records = parseJsonl(matches[0]!);
  const sessions = records.filter(
    (record) => isRecord(record) && record.type === "session_meta",
  );
  const turns = records.filter(
    (record) => isRecord(record) && record.type === "turn_context",
  );
  if (sessions.length !== 1 || turns.length === 0) invalidRollout();

  const session = eventPayload(sessions[0]);
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
  for (const turn of turns) {
    const payload = eventPayload(turn);
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
