#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, type BigIntStats } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

export type AdapterSnapshot = {
  fingerprint: string;
  file_count: number;
};

const ROLE_FILES = [
  "sol-advisor-advisor.toml",
  "sol-advisor-high.toml",
  "sol-advisor-routine.toml",
] as const;
const SHA256 = /^[a-f0-9]{64}$/;

class AdapterSnapshotError extends Error {}

type FileIdentity = Pick<
  BigIntStats,
  "dev" | "ino" | "size" | "mtimeNs" | "ctimeNs"
>;

function fail(message: string): never {
  throw new AdapterSnapshotError(message);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameFileIdentity(first: FileIdentity, second: FileIdentity): boolean {
  return (
    first.dev === second.dev &&
    first.ino === second.ino &&
    first.size === second.size &&
    first.mtimeNs === second.mtimeNs &&
    first.ctimeNs === second.ctimeNs
  );
}

function inspectFile(input: string): { name: string; sha256: string } {
  if (!isAbsolute(input)) fail("adapter snapshot paths must be absolute.");
  const path = resolve(input);

  let before: BigIntStats;
  let contents: Buffer;
  let after: BigIntStats;
  try {
    before = lstatSync(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) {
      fail("adapter snapshot requires regular non-symlink files.");
    }
    contents = readFileSync(path);
    after = lstatSync(path, { bigint: true });
  } catch (error) {
    if (error instanceof AdapterSnapshotError) throw error;
    fail("adapter snapshot file is unavailable.");
  }

  if (!sameFileIdentity(before, after)) {
    fail("adapter snapshot file changed during inspection.");
  }

  return { name: basename(path), sha256: sha256(contents) };
}

export function inspectAdapterSnapshot(paths: string[]): AdapterSnapshot {
  if (paths.length !== ROLE_FILES.length) {
    fail("adapter snapshot requires exactly the three managed role files.");
  }

  const files = paths.map(inspectFile).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const names = files.map((file) => file.name);
  if (
    new Set(names).size !== ROLE_FILES.length ||
    names.some((name, index) => name !== ROLE_FILES[index])
  ) {
    fail("adapter snapshot role-file set is invalid.");
  }

  return {
    fingerprint: sha256(JSON.stringify({ schemaVersion: 1, files })),
    file_count: files.length,
  };
}

function usage(): string {
  return [
    "Usage: inspect-adapter-snapshot.ts [--expect SHA256] ROUTINE HIGH ADVISOR",
    "",
    "Hash the exact three managed role files and emit a compact snapshot fingerprint.",
  ].join("\n");
}

function parseCliArgs(args: string[]): { expected: string | null; paths: string[] } {
  if (args.length === ROLE_FILES.length) {
    return { expected: null, paths: args };
  }
  if (args.length === ROLE_FILES.length + 2 && args[0] === "--expect") {
    if (!SHA256.test(args[1]!)) fail("--expect must be a lowercase SHA-256 digest.");
    return { expected: args[1]!, paths: args.slice(2) };
  }
  throw new AdapterSnapshotError(usage());
}

function oneLineError(error: unknown): string {
  if (error instanceof AdapterSnapshotError) return error.message;
  return "adapter snapshot inspection failed.";
}

function runCli(): void {
  let args: { expected: string | null; paths: string[] };
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${oneLineError(error)}\n`);
    process.exitCode = 2;
    return;
  }

  try {
    const snapshot = inspectAdapterSnapshot(args.paths);
    if (args.expected !== null && snapshot.fingerprint !== args.expected) {
      fail("adapter snapshot fingerprint mismatch.");
    }
    process.stdout.write(`${JSON.stringify({
      ...snapshot,
      ...(args.expected === null ? {} : { matches_expected: true }),
    })}\n`);
  } catch (error) {
    process.stderr.write(`ERROR: ${oneLineError(error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.main) runCli();
