import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { inspectAdapterSnapshot } from "../plugins/sol-advisor/scripts/inspect-adapter-snapshot";
import { baseVersion, parseCodexVersion } from "./version";

const repositoryRoot = resolve(import.meta.dir, "..");
const snapshotScript = join(
  repositoryRoot,
  "plugins",
  "sol-advisor",
  "scripts",
  "inspect-adapter-snapshot.ts",
);

function withSnapshotFixture<T>(callback: (paths: string[]) => T): T {
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

function runSnapshot(args: string[]) {
  return Bun.spawnSync([process.execPath, snapshotScript, ...args]);
}

describe("Codex plugin version identity", () => {
  test("accepts a release base with an optional single Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0")).toEqual({ base: "0.6.0", cachebuster: null });
    expect(parseCodexVersion("0.6.0+codex.20260809135432")).toEqual({
      base: "0.6.0",
      cachebuster: "20260809135432",
    });
    expect(parseCodexVersion("0.6.0+codex.local-1")).toEqual({
      base: "0.6.0",
      cachebuster: "local-1",
    });
  });

  test("uses the plugin-owned parser as the single implementation", async () => {
    const packaged = await import("../plugins/sol-advisor/mcp/version");
    expect(parseCodexVersion).toBe(packaged.parseCodexVersion);
    expect(baseVersion).toBe(packaged.baseVersion);
  });

  test("preserves a SemVer pre-release while separating its Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0-rc.1+codex.cache-2")).toEqual({
      base: "0.6.0-rc.1",
      cachebuster: "cache-2",
    });
    expect(baseVersion("0.6.0-rc.1+codex.cache-2")).toBe("0.6.0-rc.1");
  });

  test("accepts strict SemVer pre-release identifiers", () => {
    for (const value of ["0.6.0-0", "0.6.0-rc.1", "0.6.0-alpha-9.Z1"]) {
      expect(parseCodexVersion(value)).toEqual({ base: value, cachebuster: null });
    }
  });

  test("rejects non-canonical core and pre-release versions", () => {
    for (const value of [
      "01.6.0",
      "0.06.0",
      "0.6.00",
      "0.6.0-rc..1",
      "0.6.0-.rc",
      "0.6.0-rc.",
      "0.6.0-01",
    ]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects malformed bases, non-Codex metadata, and repeated suffixes", () => {
    for (const value of ["0.6", "0.6.0+other.x", "0.6.0+codex.a+codex.b", "v0.6.0"]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects empty and invalid Codex cachebusters", () => {
    for (const value of [
      "0.6.0+",
      "0.6.0+codex.",
      "0.6.0+codex.-local",
      "0.6.0+codex.local-",
      "0.6.0+codex.LOCAL",
      "0.6.0+codex.local_1",
    ]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects an overlong base version before parsing it", () => {
    const overlongBase = `1${"0".repeat(256)}.0.0`;
    expect(() => parseCodexVersion(overlongBase)).toThrow("invalid version");
  });

  test("rejects an overlong Codex cachebuster before parsing it", () => {
    const overlongCachebuster = `0.6.0+codex.${"a".repeat(257)}`;
    expect(() => parseCodexVersion(overlongCachebuster)).toThrow("invalid version");
  });
});

describe("adaptive orchestration hardening", () => {
  test("produces and checks a compact fingerprint for the exact role-file set", () => {
    withSnapshotFixture((paths) => {
      const first = inspectAdapterSnapshot(paths);
      expect(inspectAdapterSnapshot([...paths].reverse())).toEqual(first);
      expect(first.file_count).toBe(3);
      expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);

      const matched = runSnapshot(["--expect", first.fingerprint, ...paths]);
      expect(matched.exitCode).toBe(0);
      expect(JSON.parse(matched.stdout.toString())).toEqual({
        fingerprint: first.fingerprint,
        file_count: 3,
        matches_expected: true,
      });

      writeFileSync(paths[1]!, "changed\n", "utf8");
      const mismatched = runSnapshot(["--expect", first.fingerprint, ...paths]);
      expect(mismatched.exitCode).toBe(1);
      expect(mismatched.stdout.toString()).toBe("");
      expect(mismatched.stderr.toString()).toContain("fingerprint mismatch");
    });
  });

  test("fails closed for an invalid role-file set or digest", () => {
    withSnapshotFixture((paths) => {
      expect(() => inspectAdapterSnapshot(paths.slice(0, 2))).toThrow("exactly");
      const wrong = join(dirname(paths[0]!), "wrong.toml");
      writeFileSync(wrong, "wrong\n", "utf8");
      expect(() => inspectAdapterSnapshot([paths[0]!, paths[1]!, wrong])).toThrow(
        "role-file set",
      );

      const invalidDigest = runSnapshot(["--expect", "NOT-A-DIGEST", ...paths]);
      expect(invalidDigest.exitCode).toBe(2);
      expect(invalidDigest.stderr.toString()).toContain("lowercase SHA-256");
    });
  });

  test("requires fingerprint rechecks and a final orchestration summary", () => {
    const skill = readFileSync(
      join(repositoryRoot, "plugins", "sol-advisor", "skills", "orchestration", "SKILL.md"),
      "utf8",
    );
    const contracts = readFileSync(
      join(
        repositoryRoot,
        "plugins",
        "sol-advisor",
        "skills",
        "orchestration",
        "references",
        "role-contracts.md",
      ),
      "utf8",
    );
    for (const required of [
      "inspect-adapter-snapshot.ts",
      "--expect $adapterFingerprint",
      "matches_expected: true",
      "ORCHESTRATION SUMMARY",
      "Configuration checks: full=<n>, lightweight=<n>, snapshot_reuses=<n>",
    ]) expect(skill).toContain(required);
    expect(contracts).toContain("A successful reuse therefore has concrete current evidence");
    expect(contracts).toContain("Do not estimate missing counts");
  });

  test("runs core checks on both Ubuntu and Windows", () => {
    const workflow = readFileSync(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("bun run test");
    expect(workflow).toContain("bun run validate");
    expect(workflow).toContain("matrix.os == 'ubuntu-latest'");
    expect(workflow).toContain("bun run release:check");
  });
});
