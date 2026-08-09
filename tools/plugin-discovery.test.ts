import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const pluginRoot = resolve(import.meta.dir, "..", "plugins", "sol-advisor");
const manifest = JSON.parse(
  readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);
const companion = JSON.parse(
  readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
);
const runtimeInspector = join(pluginRoot, "scripts", "inspect-agent-runtime.sh");

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function gitBashPath(value: string): string {
  const normalized = resolve(value).replaceAll("\\", "/");
  const drivePath = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  return drivePath
    ? `/${drivePath[1]!.toLowerCase()}/${drivePath[2]}`
    : normalized;
}

function inspectRuntime(sessionsDir: string, threadId: string) {
  if (process.platform !== "win32") {
    return Bun.spawnSync([
      "sh",
      runtimeInspector,
      "--sessions-dir",
      sessionsDir,
      threadId,
    ]);
  }

  const git = Bun.which("git");
  if (!git) throw new Error("Git for Windows is required for the shell test");
  const bash = resolve(dirname(git), "..", "bin", "bash.exe");
  if (!existsSync(bash)) throw new Error(`Git Bash is unavailable at ${bash}`);
  const command = [
    "sh",
    shellQuote(gitBashPath(runtimeInspector)),
    "--sessions-dir",
    shellQuote(gitBashPath(sessionsDir)),
    threadId,
  ].join(" ");
  return Bun.spawnSync([bash, "-lc", command]);
}

function inspectFixture(
  threadId: string,
  encodings: {
    includeLegacy?: boolean;
    legacy?: unknown;
    includeNested?: boolean;
    nested?: unknown;
  },
) {
  const root = mkdtempSync(join(tmpdir(), "sol-advisor-runtime-test-"));
  try {
    const day = join(root, "2026", "08", "09");
    mkdirSync(day, { recursive: true });
    const turnPayload: Record<string, unknown> = {
      model: "gpt-5.6-sol",
      sandbox_policy: { type: "workspace-write" },
      permission_profile: { type: "managed" },
      cwd: "/fixture",
    };
    if (encodings.includeLegacy) turnPayload.effort = encodings.legacy;
    if (encodings.includeNested) {
      turnPayload.collaboration_mode = {
        mode: "default",
        settings: {
          model: "gpt-5.6-sol",
          reasoning_effort: encodings.nested,
          developer_instructions: null,
        },
      };
    }
    writeFileSync(
      join(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`),
      [
        JSON.stringify({
          type: "session_meta",
          payload: {
            id: threadId,
            parent_thread_id: "00000000-0000-7000-8000-000000000000",
            agent_role: "sol_advisor_sol_reviewer",
            agent_path: "/root/fixture",
            model_provider: "openai",
          },
        }),
        JSON.stringify({ type: "turn_context", payload: turnPayload }),
      ].join("\n") + "\n",
      "utf8",
    );
    return inspectRuntime(root, threadId);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Codex-only plugin discovery", () => {
  test("ships one Codex manifest and one MCP companion", () => {
    expect(manifest.name).toBe("sol-advisor");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(existsSync(join(pluginRoot, ".mcp.json"))).toBe(true);
    expect(existsSync(join(pluginRoot, "plugin.json"))).toBe(false);
    expect(existsSync(join(pluginRoot, "mcp.json"))).toBe(false);
  });

  test("uses the closed Codex MCP companion shape", () => {
    expect(Object.keys(companion)).toEqual(["mcpServers"]);
    expect(companion.mcpServers["sol-advisor"]).toEqual({
      type: "stdio",
      command: "bun",
      args: ["${PLUGIN_ROOT}/mcp/server.ts"],
      cwd: "${PLUGIN_ROOT}",
    });
  });
});

describe("native runtime inspector", () => {
  test("accepts current Codex nested reasoning-effort metadata", () => {
    const threadId = "33333333-3333-7333-8333-333333333333";
    const result = inspectFixture(threadId, {
      includeNested: true,
      nested: "high",
    });
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      thread_id: threadId,
      agent_role: "sol_advisor_sol_reviewer",
      model: "gpt-5.6-sol",
      effort: "high",
      sandbox_policy_type: "workspace-write",
      permission_profile_type: "managed",
    });
  }, 15_000);

  test("rejects conflicting legacy and nested reasoning-effort metadata", () => {
    const result = inspectFixture(
      "44444444-4444-7444-8444-444444444444",
      {
        includeLegacy: true,
        legacy: "max",
        includeNested: true,
        nested: "high",
      },
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain(
      "rollout is missing, ambiguous, invalid, or inconsistent required routing metadata",
    );
  }, 15_000);

  test("rejects a present non-string reasoning-effort encoding", () => {
    const result = inspectFixture(
      "55555555-5555-7555-8555-555555555555",
      {
        includeLegacy: true,
        legacy: "max",
        includeNested: true,
        nested: 1,
      },
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain(
      "rollout is missing, ambiguous, invalid, or inconsistent required routing metadata",
    );
  }, 15_000);
});
