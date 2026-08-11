import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inspectAdapterSnapshot } from "../plugins/sol-advisor/scripts/inspect-adapter-snapshot";

const script = resolve(
  import.meta.dir,
  "..",
  "plugins",
  "sol-advisor",
  "scripts",
  "inspect-adapter-snapshot.ts",
);

function withFixture<T>(callback: (paths: string[]) => T): T {
  const root = mkdtempSync(join(tmpdir(), "sol-advisor-adapter-snapshot-"));
  try {
    const agents = join(root, ".codex", "agents");
    mkdirSync(agents, { recursive: true });
    const paths = [
      join(agents, "sol-advisor-routine.toml"),
      join(agents, "sol-advisor-high.toml"),
      join(agents, "sol-advisor-advisor.toml"),
    ];
    for (const [index, path] of paths.entries()) {
      writeFileSync(path, `role-${index}\n`, "utf8");
    }
    return callback(paths);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function run(args: string[]) {
  return Bun.spawnSync([process.execPath, script, ...args]);
}

describe("adapter snapshot inspector", () => {
  test("produces a stable fingerprint for the exact managed role files", () => {
    withFixture((paths) => {
      const first = inspectAdapterSnapshot(paths);
      const reordered = inspectAdapterSnapshot([...paths].reverse());
      expect(first).toEqual(reordered);
      expect(first.file_count).toBe(3);
      expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);

      writeFileSync(paths[0]!, "changed\n", "utf8");
      expect(inspectAdapterSnapshot(paths).fingerprint).not.toBe(first.fingerprint);
    });
  });

  test("supports a compact expected-fingerprint check", () => {
    withFixture((paths) => {
      const initial = run(paths);
      expect(initial.exitCode).toBe(0);
      expect(initial.stderr.toString()).toBe("");
      const snapshot = JSON.parse(initial.stdout.toString());

      const matched = run(["--expect", snapshot.fingerprint, ...paths]);
      expect(matched.exitCode).toBe(0);
      expect(JSON.parse(matched.stdout.toString())).toEqual({
        fingerprint: snapshot.fingerprint,
        file_count: 3,
        matches_expected: true,
      });

      writeFileSync(paths[1]!, "changed\n", "utf8");
      const mismatched = run(["--expect", snapshot.fingerprint, ...paths]);
      expect(mismatched.exitCode).toBe(1);
      expect(mismatched.stdout.toString()).toBe("");
      expect(mismatched.stderr.toString()).toContain("fingerprint mismatch");
    });
  });

  test("fails closed for an invalid role-file set or invalid digest", () => {
    withFixture((paths) => {
      expect(() => inspectAdapterSnapshot(paths.slice(0, 2))).toThrow("exactly");
      const wrong = join(join(paths[0]!, ".."), "wrong.toml");
      writeFileSync(wrong, "wrong\n", "utf8");
      expect(() => inspectAdapterSnapshot([paths[0]!, paths[1]!, wrong])).toThrow(
        "role-file set",
      );

      const invalidDigest = run(["--expect", "NOT-A-DIGEST", ...paths]);
      expect(invalidDigest.exitCode).toBe(2);
      expect(invalidDigest.stderr.toString()).toContain("lowercase SHA-256");
    });
  });
});
