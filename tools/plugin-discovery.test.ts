import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "bun:test";
import { inspectRuntime } from "../plugins/sol-advisor/scripts/inspect-agent-runtime.ts";

const pluginRoot = resolve(import.meta.dir, "..", "plugins", "sol-advisor");
const manifest = JSON.parse(
  readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);
const companion = JSON.parse(
  readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
);
const runtimeInspector = join(pluginRoot, "scripts", "inspect-agent-runtime.ts");

function runInspector(args: string[], env?: Record<string, string | undefined>) {
  return Bun.spawnSync([process.execPath, runtimeInspector, ...args],
    env ? { env } : undefined,
  );
}

function sessionMeta(threadId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "session_meta",
    payload: {
      id: threadId,
      parent_thread_id: "00000000-0000-7000-8000-000000000000",
      agent_role: "sol_advisor_sol_reviewer",
      agent_path: "/root/fixture",
      model_provider: "openai",
      ...overrides,
    },
  };
}

function turnContext(overrides: Record<string, unknown> = {}) {
  return {
    type: "turn_context",
    payload: {
      model: "gpt-5.6-sol",
      effort: "high",
      sandbox_policy: { type: "workspace-write" },
      permission_profile: { type: "managed" },
      cwd: "/fixture",
      ...overrides,
    },
  };
}

function writeRollout(
  day: string,
  filename: string,
  records: unknown[],
) {
  writeFileSync(
    join(day, filename),
    records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    "utf8",
  );
}

function withFixture<T>(callback: (root: string, day: string) => T): T {
  const container = mkdtempSync(join(tmpdir(), "sol-advisor-runtime-test-"));
  const root = join(container, "sessions");
  try {
    const day = join(root, "2026", "08", "09");
    mkdirSync(day, { recursive: true });
    return callback(root, day);
  } finally {
    rmSync(container, { recursive: true, force: true });
  }
}

function inspectFixture(threadId: string, setup: (day: string) => void) {
  return withFixture((root, day) => {
    setup(day);
    return runInspector(["--sessions-dir", root, threadId]);
  });
}

function inspectRuntimeFixture(
  threadId: string,
  setup: (root: string, day: string) => void,
  options?: Parameters<typeof inspectRuntime>[2],
) {
  return withFixture((root, day) => {
    setup(root, day);
    return inspectRuntime(root, threadId, options);
  });
}

function completeRollout(threadId: string, turns = [turnContext()]) {
  return [sessionMeta(threadId), ...turns];
}

function expectRuntimeFailure(result: ReturnType<typeof Bun.spawnSync>) {
  expect(result.exitCode).toBe(1);
  expect(result.stdout.toString()).toBe("");
  expect(result.stderr.toString()).toMatch(/^ERROR: .+\n$/);
}

function createDirectoryLink(target: string, link: string): void {
  symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
}

function runStableReadMutation(
  root: string,
  threadId: string,
  mutation: "append" | "overwrite",
) {
  const mutationSource = mutation === "append"
    ? 'appendFileSync(candidate, "DO_NOT_LEAK_APPEND_CONTENT", "utf8");'
    : [
      'const descriptor = openSync(candidate, "r+");',
      "try {",
      '  const replacement = Buffer.from("DO_NOT_LEAK_SAME_SIZE");',
      "  writeSync(descriptor, replacement, 0, replacement.length, 0);",
      "} finally {",
      "  closeSync(descriptor);",
      "}",
    ].join("\n");
  const source = [
    'import { appendFileSync, closeSync, openSync, writeSync } from "node:fs";',
    `import { inspectRuntime } from ${JSON.stringify(pathToFileURL(runtimeInspector).href)};`,
    "try {",
    `  inspectRuntime(${JSON.stringify(root)}, ${JSON.stringify(threadId)}, {`,
    "    testHooks: {",
    "      afterFirstRead(candidate) {",
    mutationSource,
    "      },",
    "    },",
    "  });",
    "} catch (error) {",
    '  process.stderr.write("ERROR: " + (error instanceof Error ? error.message : "runtime inspection failed.") + "\\n");',
    "  process.exitCode = 1;",
    "}",
  ].join("\n");
  return Bun.spawnSync([process.execPath, "-e", source]);
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
    const result = inspectFixture(threadId, (day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, [
        sessionMeta(threadId),
        turnContext({
          effort: undefined,
          collaboration_mode: {
            mode: "default",
            settings: { reasoning_effort: "high" },
          },
        }),
      ]);
    });
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(`${JSON.stringify({
      thread_id: threadId,
      parent_thread_id: "00000000-0000-7000-8000-000000000000",
      agent_role: "sol_advisor_sol_reviewer",
      agent_path: "/root/fixture",
      model_provider: "openai",
      model: "gpt-5.6-sol",
      effort: "high",
      sandbox_policy_type: "workspace-write",
      permission_profile_type: "managed",
      cwd: "/fixture",
    })}\n`);
  }, 15_000);

  test("rejects conflicting legacy and nested reasoning-effort metadata", () => {
    const threadId = "44444444-4444-7444-8444-444444444444";
    const result = inspectFixture(threadId, (day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, [
        ...completeRollout(threadId, [
          turnContext({
            effort: "max",
            collaboration_mode: { settings: { reasoning_effort: "high" } },
          }),
        ]),
      ]);
    });
    expectRuntimeFailure(result);
  }, 15_000);

  test("rejects a present non-string reasoning-effort encoding", () => {
    const threadId = "55555555-5555-7555-855555555555";
    const result = inspectFixture(threadId, (day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, [
        ...completeRollout(threadId, [
          turnContext({
            collaboration_mode: { settings: { reasoning_effort: 1 } },
          }),
        ]),
      ]);
    });
    expectRuntimeFailure(result);
  }, 15_000);

  test("rejects zero matching rollout filenames before parsing", () => {
    const threadId = "66666666-6666-7666-8666-666666666666";
    const result = inspectFixture(threadId, () => {});
    expectRuntimeFailure(result);
    expect(result.stderr.toString()).toContain("no rollout filename matched");
  });

  test("rejects multiple matching rollout filenames before parsing", () => {
    const threadId = "77777777-7777-7777-8777-777777777777";
    const result = inspectFixture(threadId, (day) => {
      writeFileSync(
        join(day, `rollout-first-${threadId}.jsonl`),
        "DO_NOT_LEAK_DUPLICATE_CONTENT\n",
        "utf8",
      );
      writeRollout(day, `rollout-second-${threadId}.jsonl`, completeRollout(threadId));
    });
    expectRuntimeFailure(result);
    expect(result.stderr.toString()).toContain("multiple rollout filenames matched");
    expect(result.stderr.toString()).not.toContain("DO_NOT_LEAK_DUPLICATE_CONTENT");
  });

  for (const invalidThreadId of [
    "AAAAAAAA-AAAA-7AAA-8AAA-AAAAAAAAAAAA",
    "../77777777-7777-7777-8777-777777777777",
  ]) {
    test(`rejects invalid lowercase UUID input: ${invalidThreadId}`, () => {
      const result = runInspector(["--sessions-dir", tmpdir(), invalidThreadId]);
      expectRuntimeFailure(result);
      expect(result.stderr.toString()).toContain("THREAD_ID must be a lowercase UUID");
    });
  }

  for (const [description, records] of [
    ["missing session metadata", [turnContext()]],
    [
      "multiple session metadata records",
      [
        sessionMeta("88888888-8888-7888-8888-888888888888"),
        sessionMeta("88888888-8888-7888-8888-888888888888"),
        turnContext(),
      ],
    ],
    ["no turn context records", [sessionMeta("88888888-8888-7888-8888-888888888888")]],
  ] as const) {
    test(`rejects ${description}`, () => {
      const threadId = "88888888-8888-7888-8888-888888888888";
      const result = inspectFixture(threadId, (day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, records);
      });
      expectRuntimeFailure(result);
    });
  }

  for (const [description, turn] of [
    ["missing model", turnContext({ model: undefined })],
    ["missing effort", turnContext({ effort: undefined })],
    ["missing sandbox policy type", turnContext({ sandbox_policy: {} })],
    ["missing permission profile type", turnContext({ permission_profile: {} })],
    ["missing working directory", turnContext({ cwd: undefined })],
  ] as const) {
    test(`rejects ${description}`, () => {
      const threadId = "99999999-9999-7999-8999-999999999999";
      const result = inspectFixture(threadId, (day) => {
        writeRollout(
          day,
          `rollout-2026-08-09T00-00-00-${threadId}.jsonl`,
          completeRollout(threadId, [turn]),
        );
      });
      expectRuntimeFailure(result);
    });
  }

  for (const [description, changedTurn] of [
    ["models", turnContext({ model: "gpt-5.6-terra" })],
    ["efforts", turnContext({ effort: "max" })],
    ["sandbox policy types", turnContext({ sandbox_policy: { type: "read-only" } })],
    ["permission profile types", turnContext({ permission_profile: { type: "elevated" } })],
    ["working directories", turnContext({ cwd: "/other-fixture" })],
  ] as const) {
    test(`rejects conflicting ${description} across turn contexts`, () => {
      const threadId = "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa";
      const result = inspectFixture(threadId, (day) => {
        writeRollout(
          day,
          `rollout-2026-08-09T00-00-00-${threadId}.jsonl`,
          completeRollout(threadId, [turnContext(), changedTurn]),
        );
      });
      expectRuntimeFailure(result);
    });
  }

  test("rejects session metadata for a different thread", () => {
    const threadId = "bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb";
    const result = inspectFixture(threadId, (day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, [
        sessionMeta("cccccccc-cccc-7ccc-8ccc-cccccccccccc"),
        turnContext(),
      ]);
    });
    expectRuntimeFailure(result);
  });

  test("rejects malformed nonempty JSONL lines", () => {
    const threadId = "dddddddd-dddd-7ddd-8ddd-dddddddddddd";
    const result = inspectFixture(threadId, (day) => {
      writeFileSync(
        join(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`),
        `${JSON.stringify(sessionMeta(threadId))}\nDO_NOT_LEAK_MALFORMED_CONTENT\n${JSON.stringify(turnContext())}\n`,
        "utf8",
      );
    });
    expectRuntimeFailure(result);
    expect(result.stderr.toString()).not.toContain("DO_NOT_LEAK_MALFORMED_CONTENT");
  });

  test("accepts a linked sessions root with the same result as its target", () => {
    const threadId = "12121212-1212-7121-8121-121212121212";
    withFixture((root, day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      const linkedRoot = join(root, "linked-sessions-root");
      createDirectoryLink(root, linkedRoot);

      const direct = runInspector(["--sessions-dir", root, threadId]);
      const linked = runInspector(["--sessions-dir", linkedRoot, threadId]);
      expect(direct.exitCode).toBe(0);
      expect(linked.exitCode).toBe(0);
      expect(linked.stderr.toString()).toBe("");
      expect(linked.stdout.toString()).toBe(direct.stdout.toString());
    });
  });

  test("does not traverse an outside subtree linked from sessions", () => {
    const threadId = "13131313-1313-7131-8131-131313131313";
    withFixture((root, day) => {
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      const outside = join(dirname(root), "outside");
      mkdirSync(outside, { recursive: true });
      writeFileSync(
        join(outside, `rollout-outside-${threadId}.jsonl`),
        "DO_NOT_LEAK_OUTSIDE_CONTENT\n",
        "utf8",
      );
      createDirectoryLink(outside, join(root, "outside-link"));

      const result = runInspector(["--sessions-dir", root, threadId]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString()).toBe("");
      expect(result.stdout.toString()).not.toContain("DO_NOT_LEAK_OUTSIDE_CONTENT");
    });
  });

  test("fails closed when the candidate path is replaced before it opens", () => {
    const threadId = "14141414-1414-7141-8141-141414141414";
    expect(() => inspectRuntimeFixture(
      threadId,
      (_root, day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      },
      {
        testHooks: {
          beforeOpen(candidate) {
            const originalSize = lstatSync(candidate).size;
            renameSync(candidate, `${candidate}.original`);
            writeFileSync(
              candidate,
              "DO_NOT_LEAK_REPLACED_CONTENT".padEnd(originalSize, "x").slice(0, originalSize),
              "utf8",
            );
          },
        },
      },
    )).toThrow("rollout changed during inspection.");
  });

  for (const mutation of ["append", "overwrite"] as const) {
    test(`rejects a rollout ${mutation}ed after its first bounded read without leaking content`, () => {
      const threadId = "19191919-1919-7191-8191-191919191919";
      withFixture((root, day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
        const result = runStableReadMutation(root, threadId, mutation);
        expect(result.exitCode).toBe(1);
        expect(result.stdout.toString()).toBe("");
        expect(result.stderr.toString()).toBe("ERROR: rollout changed during inspection.\n");
        expect(result.stderr.toString()).not.toContain("DO_NOT_LEAK");
      });
    });
  }

  test("fails closed when the verified rollout cannot be closed", () => {
    const threadId = "20202020-2020-7202-8202-202020202020";
    expect(() => inspectRuntimeFixture(
      threadId,
      (_root, day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      },
      {
        testHooks: {
          close() {
            throw new Error("DO_NOT_LEAK_CLOSE_FAILURE");
          },
        },
      },
    )).toThrow("could not close verified rollout.");
  });

  for (const kind of ["sparse", "filled"] as const) {
    test(`rejects an oversized ${kind} rollout before parsing`, () => {
      const threadId = "15151515-1515-7151-8151-151515151515";
      expect(() => inspectRuntimeFixture(
        threadId,
        (_root, day) => {
          const rollout = join(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`);
          if (kind === "sparse") {
            writeFileSync(rollout, "{}", "utf8");
            truncateSync(rollout, 65);
          } else {
            writeFileSync(rollout, "x".repeat(65), "utf8");
          }
        },
        { limits: { maxMatchedRolloutBytes: 64 } },
      )).toThrow("matched rollout exceeds the maximum size.");
    });
  }

  test("rejects an overlong rollout line before parsing", () => {
    const threadId = "16161616-1616-7161-8161-161616161616";
    expect(() => inspectRuntimeFixture(
      threadId,
      (_root, day) => {
        writeFileSync(
          join(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`),
          "x".repeat(65),
          "utf8",
        );
      },
      { limits: { maxLineBytes: 64 } },
    )).toThrow("rollout contains a line exceeding the maximum size.");
  });

  test("rejects rollout record-count overflow", () => {
    const threadId = "17171717-1717-7171-8171-171717171717";
    expect(() => inspectRuntimeFixture(
      threadId,
      (_root, day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, [
          sessionMeta(threadId),
          turnContext(),
          turnContext(),
        ]);
      },
      { limits: { maxRecords: 2 } },
    )).toThrow("rollout exceeds the record limit.");
  });

  test("rejects session traversal that exceeds the directory limit", () => {
    const threadId = "18181818-1818-7181-8181-181818181818";
    expect(() => inspectRuntimeFixture(
      threadId,
      (_root, day) => {
        writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      },
      { limits: { maxDirectories: 1 } },
    )).toThrow("session directory traversal exceeded the directory limit.");
  });

  test("importing the runtime inspector does not execute its CLI", () => {
    const result = Bun.spawnSync([
      process.execPath,
      "-e",
      `import ${JSON.stringify(pathToFileURL(runtimeInspector).href)};`,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toBe("");
  });

  test("accepts exactly THREAD_ID using the CODEX_HOME sessions default", () => {
    const threadId = "eeeeeeee-eeee-7eee-8eee-eeeeeeeeeeee";
    const root = mkdtempSync(join(tmpdir(), "sol-advisor-runtime-test-"));
    try {
      const day = join(root, "sessions", "2026", "08", "09");
      mkdirSync(day, { recursive: true });
      writeRollout(day, `rollout-2026-08-09T00-00-00-${threadId}.jsonl`, completeRollout(threadId));
      const result = runInspector([threadId], { ...process.env, CODEX_HOME: root });
      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString()).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  for (const args of [
    [],
    ["--sessions-dir"],
    ["--sessions-dir", tmpdir()],
    ["--sessions-dir", tmpdir(), "eeeeeeee-eeee-7eee-8eee-eeeeeeeeeeee", "extra"],
    ["--unknown", "eeeeeeee-eeee-7eee-8eee-eeeeeeeeeeee"],
  ]) {
    test(`prints usage and exits 2 for invalid arguments: ${args.join(" ") || "none"}`, () => {
      const result = runInspector(args);
      expect(result.exitCode).toBe(2);
      expect(result.stdout.toString()).toBe("");
      expect(result.stderr.toString()).toContain("Usage: inspect-agent-runtime.ts");
    });
  }
});
