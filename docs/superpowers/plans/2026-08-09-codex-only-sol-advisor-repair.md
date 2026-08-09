# Codex-Only Sol Advisor Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one Windows-verifiable, locally installable Codex plugin whose MCP setup tools and configured `routine` / `high` / `advisor` roles work in a fresh task after restart.

**Architecture:** Remove portable and cross-client package paths, retain only the Codex manifest plus `.mcp.json`, and reduce adapter rendering to Codex TOML files. Replace mandatory shell verification with Bun/TypeScript, make configured roles the only native lane, keep Luna app tasks explicit-only, and separate the release base version from the local Codex cachebuster.

**Tech Stack:** Bun 1.3.x, TypeScript, Bun test, Codex plugin manifests, JSON-RPC MCP over stdio, PowerShell only for Windows ACL operations, Git.

---

## Baseline and execution rules

- Approved design: `docs/superpowers/specs/2026-08-09-codex-only-sol-advisor-repair-design.md`.
- Starting design commit: `d9e39cd`.
- Work in an isolated worktree when execution begins; do not modify the user's main checkout concurrently.
- Preserve the existing secure `PLUGIN_DATA` implementation and transactional adapter installation unless a failing test in this plan requires a targeted change.
- Do not delete user-owned files under `C:\Users\SYX001\.codex\agents`. Source compatibility templates are removed, but installed legacy files are only detected and reported.
- Do not hand-edit `C:\Users\SYX001\.codex\plugins\cache` or marketplace configuration.
- Do not claim completion before Task 8 succeeds in a new Codex task after a full restart.

## File responsibility map

- `plugins/sol-advisor/.codex-plugin/plugin.json`: sole plugin manifest and local Codex cache identity.
- `plugins/sol-advisor/.mcp.json`: sole MCP discovery companion.
- `plugins/sol-advisor/mcp/server.ts`: configuration storage, exact three-role rendering, transactional installation, configuration validation, and MCP protocol.
- `plugins/sol-advisor/scripts/inspect-agent-runtime.ts`: read-only allowlisted child-rollout metadata inspector.
- `plugins/sol-advisor/skills/setup/SKILL.md`: Codex-only setup interview.
- `plugins/sol-advisor/skills/orchestration/SKILL.md`: configured native lane plus explicit Luna lane.
- `plugins/sol-advisor/skills/orchestration/references/role-contracts.md`: model-agnostic configured worker and advisor packets.
- `plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md`: explicit app-task contract, retained.
- `tools/validate.ts`: Codex package, skills, links, release artifact, and extracted MCP-flow validation.
- `tools/version.ts`: base-version and Codex-cachebuster parsing shared by validation and tests.
- `tools/plugin-discovery.test.ts`: Codex manifest/MCP discovery and Bun runtime-inspector tests.
- `tools/orchestration-contract.test.ts`: Codex-only routing and contract characterization tests.
- `plugins/sol-advisor/mcp/server.test.ts`: MCP configuration, rendering, adapter-state, and transaction tests.
- `README.md`: Codex-only installation and acceptance instructions.

### Task 1: Lock the Codex-only package boundary

**Files:**
- Modify: `tools/plugin-discovery.test.ts`
- Modify: `tools/validate.ts`
- Modify: `package.json`
- Delete: `plugins/sol-advisor/plugin.json`
- Delete: `tools/cursor-local.ts`
- Delete: `tools/cursor-local.test.ts`
- Delete: `tools/schema/agent-plugin-v1.schema.json`
- Delete: `tools/schema/agent-plugin-v1.schema.sha256`
- Delete: `tools/schema/agent-plugin-v1-mcp.schema.json`
- Delete: `tools/schema/agent-plugin-v1-mcp.schema.sha256`
- Delete: `tools/fixtures/positive-manifest.json`
- Delete: `tools/fixtures/positive-dotted-name.json`
- Delete: `tools/fixtures/negative-unknown-field.json`
- Delete: `tools/fixtures/negative-author-field.json`
- Delete: `tools/fixtures/negative-double-hyphen-name.json`
- Delete: `tools/fixtures/negative-double-period-name.json`
- Delete: `tools/fixtures/negative-long-name.json`

- [ ] **Step 1: Add failing Codex-only discovery assertions**

Replace the package-discovery block in `tools/plugin-discovery.test.ts` with assertions that make the removal contract explicit:

```ts
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
```

- [ ] **Step 2: Run the focused test and observe the boundary failure**

Run:

```powershell
bun test tools/plugin-discovery.test.ts
```

Expected: FAIL because `plugins/sol-advisor/plugin.json` still exists and runtime-inspector tests still call the shell implementation.

- [ ] **Step 3: Replace portable manifest validation with Codex manifest validation**

In `tools/validate.ts`, remove vendored Agent Plugins schema constants, `validateManifest`, and portable manifest fixtures. Add a closed Codex manifest validator:

```ts
const codexManifestAllowed = new Set([
  "name", "version", "description", "author", "homepage", "repository",
  "license", "keywords", "skills", "mcpServers", "interface",
]);

function validateCodexManifest(value: any, label: string): boolean {
  const before = errors.length;
  if (!value || Array.isArray(value) || typeof value !== "object") {
    fail(`${label}: manifest must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!codexManifestAllowed.has(key)) fail(`${label}: unknown top-level field ${key}`);
  }
  if (value.name !== "sol-advisor") fail(`${label}: name must be sol-advisor`);
  if (value.skills !== "./skills/") fail(`${label}: skills must be ./skills/`);
  if (value.mcpServers !== "./.mcp.json") fail(`${label}: mcpServers must be ./.mcp.json`);
  if (!value.interface || typeof value.interface !== "object" || Array.isArray(value.interface)) {
    fail(`${label}: interface must be an object`);
  }
  return errors.length === before;
}
```

Change `validatePackage` to read only `.codex-plugin/plugin.json`, require `.mcp.json`, and fail if either root `plugin.json` or root `mcp.json` exists:

```ts
function validatePackage(packageRoot: string, readme?: string) {
  const files = walk(packageRoot);
  const manifestPath = join(packageRoot, ".codex-plugin", "plugin.json");
  if (!existsSync(manifestPath)) fail(".codex-plugin/plugin.json is required");
  else validateCodexManifest(json(manifestPath), `${relative(root, packageRoot)}/.codex-plugin/plugin.json`);
  validateSkills(join(packageRoot, "skills"));
  validateLinks([...(readme ? [readme] : []), ...files.filter((file) => file.endsWith(".md"))], packageRoot);
  if (existsSync(join(packageRoot, "plugin.json"))) fail("portable root plugin.json must not be shipped");
  if (existsSync(join(packageRoot, "mcp.json"))) fail("portable root mcp.json must not be shipped");
  const mcpPath = join(packageRoot, ".mcp.json");
  if (!existsSync(mcpPath)) fail(".mcp.json is required");
  else validateMcp(mcpPath);
  if (!existsSync(join(packageRoot, "mcp", "server.ts"))) fail("MCP runtime server is required");
}
```

Retain link and skill fixtures in `tools/fixtures/cases.json`, but remove the `positive` and `negative` manifest arrays and their validation loops.

- [ ] **Step 4: Remove cross-client source and package-script entries**

Delete the files listed above. In `package.json`, remove `cursor:local` and remove `tools/cursor-local.test.ts` from `test`. Temporarily keep the remaining scripts unchanged until Tasks 3 and 5 replace the shell CI and version rules.

- [ ] **Step 5: Run focused package validation**

Run:

```powershell
bun test tools/plugin-discovery.test.ts
bun run validate
```

Expected: package discovery passes; validation may still fail only on the version/release assumptions explicitly scheduled for Task 5, not on a missing portable manifest or schema.

- [ ] **Step 6: Commit the Codex-only package boundary**

```powershell
git add package.json plugins/sol-advisor tools
git commit -m "refactor: make plugin package Codex-only"
```

### Task 2: Reduce MCP preferences and rendering to Codex

**Files:**
- Modify: `plugins/sol-advisor/mcp/server.ts`
- Modify: `plugins/sol-advisor/mcp/server.test.ts`

- [ ] **Step 1: Write failing single-client tests**

Replace the polymorphic `base` helper and cross-client tests with:

```ts
const base = (scope: "project" | "user" = "project") => ({
  client: "codex",
  scope,
  workspace,
  orchestrator: { model: "inherit", recommendation: { model: "gpt-5.6-sol", effort: "high" } },
  roles: {
    routine: { model: "gpt-5.6-luna", effort: "max" },
    high: { model: "gpt-5.6-terra", effort: "xhigh" },
    advisor: { model: "gpt-5.6-sol", effort: "xhigh", readonly: true },
  },
});

test("rejects every non-Codex client", async () => {
  for (const client of ["cursor", "vscode", "github-copilot", "kiro"]) {
    await expect(callTool("save_preferences", { ...base(), client })).rejects.toThrow(
      "client must be codex",
    );
  }
});

test("renders only the exact three Codex TOML roles", async () => {
  const saved: any = await callTool("save_preferences", base());
  const preview: any = await callTool("render_client_adapter", { workspace });
  expect(saved.preferences.profileKey).toBe(`codex:project:${realpathSync(workspace)}`);
  expect(preview.files.map((file: any) => file.role)).toEqual(["routine", "high", "advisor"]);
  expect(preview.files.map((file: any) => file.path)).toEqual([
    join(realpathSync(workspace), ".codex", "agents", "sol-advisor-routine.toml"),
    join(realpathSync(workspace), ".codex", "agents", "sol-advisor-high.toml"),
    join(realpathSync(workspace), ".codex", "agents", "sol-advisor-advisor.toml"),
  ]);
  expect(preview.files[2].content).toContain('sandbox_mode = "read-only"');
});
```

Add an installed-state test:

```ts
test("validate_configuration reports missing, current, stale, and conflict", async () => {
  await callTool("save_preferences", base());
  expect((await callTool("validate_configuration", { workspace }) as any).adapterStatus).toBe("missing");
  let preview: any = await callTool("render_client_adapter", { workspace });
  mkdirSync(dirname(preview.files[0].path), { recursive: true });
  writeFileSync(preview.files[0].path, "USER OWNED");
  expect((await callTool("validate_configuration", { workspace }) as any).adapterStatus).toBe("conflict");
  rmSync(preview.files[0].path);
  preview = await callTool("render_client_adapter", { workspace });
  await callTool("install_client_adapter", { workspace, confirmationToken: preview.confirmationToken });
  expect((await callTool("validate_configuration", { workspace }) as any).adapterStatus).toBe("current");
  writeFileSync(preview.files[0].path, `${preview.files[0].content}changed`);
  expect((await callTool("validate_configuration", { workspace }) as any).adapterStatus).toBe("stale");
});
```

- [ ] **Step 2: Run the MCP tests and confirm cross-client assumptions fail**

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts
```

Expected: FAIL because the server still accepts other clients, renders non-Codex formats, and does not return `adapterStatus`.

- [ ] **Step 3: Implement the closed Codex preference type and renderer**

Replace client polymorphism with:

```ts
export const CLIENT = "codex" as const;
export type Client = typeof CLIENT;
export type Scope = "project" | "user";

function destinationBase(scope: Scope, workspace: string): string {
  return scope === "project"
    ? join(workspace, ".codex", "agents")
    : join(realpathSync(homedir()), ".codex", "agents");
}

const roleFiles: Record<RoleName, string> = {
  routine: "sol-advisor-routine.toml",
  high: "sol-advisor-high.toml",
  advisor: "sol-advisor-advisor.toml",
};

function renderOne(role: RoleName, pref: RolePreference): string {
  const body = instructions(role);
  return `# ${MANAGED_MARKER}\nname = "sol_advisor_${role}"\ndescription = "Sol Advisor ${role} role"\nmodel = ${JSON.stringify(pref.model)}\n${pref.effort ? `model_reasoning_effort = ${JSON.stringify(pref.effort)}\n` : ""}${role === "advisor" ? 'sandbox_mode = "read-only"\n' : ""}developer_instructions = ${JSON.stringify(body)}\n`;
}
```

Change validation to require `value.client === "codex"`, schema `client: { const: "codex" }`, and `profileKey` beginning with `codex:`. Remove all warnings and branches for other clients.

- [ ] **Step 4: Add read-only adapter-state inspection to `validate_configuration`**

Add:

```ts
type AdapterStatus = "missing" | "current" | "stale" | "conflict";

function inspectAdapter(preferences: Preferences, workspace: string) {
  const preview = renderAdapter(preferences, workspace);
  const owned = loadManifest().files.filter((file) => file.profileKey === preferences.profileKey);
  const ownedByPath = new Map(owned.map((file) => [file.path, file]));
  let status: AdapterStatus = "current";
  const files = preview.files.map((expected) => {
    const owner = ownedByPath.get(expected.path);
    const actual = currentHash(expected.path);
    const state = !owner
      ? actual === undefined ? "missing" : "conflict"
      : actual === expected.hash && owner.hash === expected.hash ? "current" : "stale";
    if (state === "conflict") status = "conflict";
    else if (state === "stale" && status !== "conflict") status = "stale";
    else if (state === "missing" && status === "current") status = "missing";
    return { role: expected.role, path: expected.path, state };
  });
  if (owned.some((file) => !preview.files.some((expected) => expected.path === file.path))) {
    status = "conflict";
  }
  return { adapterStatus: status, files };
}
```

Extend `validate_configuration` so ready configuration with a workspace returns the preview plus `inspectAdapter` output. Do not add a ninth MCP tool.

- [ ] **Step 5: Remove obsolete cross-client tests and rerun MCP coverage**

Delete tests for multi-client profile persistence, Cursor warnings, capability differences, and VS Code/GitHub shared destinations. Preserve transaction, symlink, ACL, secret rejection, explicit Luna, project/user scope, and exact-confirmation tests.

Run:

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts plugins/sol-advisor/mcp/private-directory.test.ts
```

Expected: all retained tests pass, and `tools/list` still exposes exactly eight tools.

- [ ] **Step 6: Commit the single-client MCP implementation**

```powershell
git add plugins/sol-advisor/mcp/server.ts plugins/sol-advisor/mcp/server.test.ts
git commit -m "refactor: render only configured Codex roles"
```

### Task 3: Replace the shell runtime inspector with Bun

**Files:**
- Create: `plugins/sol-advisor/scripts/inspect-agent-runtime.ts`
- Modify: `tools/plugin-discovery.test.ts`
- Delete: `plugins/sol-advisor/scripts/inspect-agent-runtime.sh`

- [ ] **Step 1: Change runtime-inspector tests to call Bun directly**

Replace `runtimeInspector`, `shellQuote`, `gitBashPath`, and `inspectRuntime` with:

```ts
const runtimeInspector = join(pluginRoot, "scripts", "inspect-agent-runtime.ts");

function inspectRuntime(sessionsDir: string, threadId: string) {
  return Bun.spawnSync([
    process.execPath,
    runtimeInspector,
    "--sessions-dir",
    sessionsDir,
    threadId,
  ]);
}
```

Add tests for zero matches, duplicate matches, missing model, missing effort, conflicting turn values, missing sandbox type, and path traversal in the thread ID.

- [ ] **Step 2: Run the focused test and observe the missing TypeScript CLI**

```powershell
bun test tools/plugin-discovery.test.ts
```

Expected: FAIL because `inspect-agent-runtime.ts` does not exist.

- [ ] **Step 3: Implement the TypeScript inspector**

Create `inspect-agent-runtime.ts` with this public contract:

```ts
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

export function inspectRuntime(sessionsDir: string, threadId: string): RuntimeEvidence;
```

The CLI accepts exactly `THREAD_ID` or `--sessions-dir DIR THREAD_ID`. With one
argument it resolves sessions from `CODEX_HOME\sessions` when `CODEX_HOME` is set,
otherwise from the current user's `.codex\sessions`. Any other argument count exits
2 after printing usage. The exported function never reads outside the supplied
sessions directory.

Use an explicit, symlink-skipping directory walk so behavior does not depend on a
shell, `find`, or a new package:

```ts
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (!uuid.test(threadId)) throw new Error("THREAD_ID must be a lowercase UUID");

function findRollouts(root: string, id: string): string[] {
  const matches: string[] = [];
  const stack = [realpathSync(root)];
  const suffix = `-${id}.jsonl`;
  while (stack.length) {
    const directory = stack.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(suffix)) {
        matches.push(path);
      }
    }
  }
  return matches;
}

const matches = findRollouts(sessionsDir, threadId);
if (matches.length !== 1) throw new Error("expected exactly one rollout filename");
```

Read only the matched JSONL. Require exactly one `session_meta`; require at least one `turn_context`; accept either legacy `effort` or nested `collaboration_mode.settings.reasoning_effort`; reject conflicting or non-string values. Require one unique model, effort, sandbox type, permission type, and cwd across turns. Print only `JSON.stringify(evidence)` to stdout. Print one `ERROR:` line and exit 1 on failure.

- [ ] **Step 4: Run runtime-inspector tests on Windows**

```powershell
bun test tools/plugin-discovery.test.ts
```

Expected: all discovery and runtime-inspector cases pass without Git Bash, `sh`, `jq`, temporary match files, or shell path conversion.

- [ ] **Step 5: Delete the shell inspector and commit**

```powershell
git add plugins/sol-advisor/scripts/inspect-agent-runtime.ts tools/plugin-discovery.test.ts
git rm plugins/sol-advisor/scripts/inspect-agent-runtime.sh
git commit -m "feat: inspect Codex runtime metadata with Bun"
```

### Task 4: Make configured roles the only orchestration contract

**Files:**
- Create: `tools/orchestration-contract.test.ts`
- Modify: `tools/luna-explicit-contract.test.ts`
- Modify: `plugins/sol-advisor/skills/setup/SKILL.md`
- Modify: `plugins/sol-advisor/skills/orchestration/SKILL.md`
- Modify: `plugins/sol-advisor/skills/orchestration/references/role-contracts.md`
- Modify: `plugins/sol-advisor/skills/orchestration/agents/openai.yaml`
- Modify: `package.json`
- Delete: `plugins/sol-advisor/skills/orchestration/references/portable-entry.md`
- Delete: `plugins/sol-advisor/agents/sol-advisor-terra-implementer.toml`
- Delete: `plugins/sol-advisor/agents/sol-advisor-sol-reviewer.toml`
- Delete: `plugins/sol-advisor/scripts/install-agents.sh`
- Delete: `plugins/sol-advisor/scripts/verify.sh`

- [ ] **Step 1: Add failing contract characterization tests**

Create `tools/orchestration-contract.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const plugin = join(import.meta.dir, "..", "plugins", "sol-advisor");
const read = (...parts: string[]) => readFileSync(join(plugin, ...parts), "utf8");

describe("Codex-only configured orchestration", () => {
  test("contains only configured native role names", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    const contracts = read("skills", "orchestration", "references", "role-contracts.md");
    const setup = read("skills", "setup", "SKILL.md");
    const active = `${skill}\n${contracts}\n${setup}`;
    for (const role of ["sol_advisor_routine", "sol_advisor_high", "sol_advisor_advisor"]) {
      expect(active).toContain(role);
    }
    for (const removed of [
      "sol_advisor_terra_implementer", "sol_advisor_sol_reviewer",
      "cursor", "vscode", "github-copilot", "kiro", "portable entry",
    ]) expect(active.toLowerCase()).not.toContain(removed.toLowerCase());
  });

  test("does not ship compatibility templates or shell preflight", () => {
    expect(existsSync(join(plugin, "agents"))).toBe(false);
    expect(existsSync(join(plugin, "scripts", "install-agents.sh"))).toBe(false);
    expect(existsSync(join(plugin, "scripts", "verify.sh"))).toBe(false);
    expect(existsSync(join(plugin, "skills", "orchestration", "references", "portable-entry.md"))).toBe(false);
  });

  test("uses configuration validation and Bun runtime evidence", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    expect(skill).toContain("validate_configuration");
    expect(skill).toContain("adapterStatus");
    expect(skill).toContain("inspect-agent-runtime.ts");
    expect(skill).toContain("workspace-write");
    expect(skill).toContain("behaviorally read-only");
  });
});
```

Update `tools/luna-explicit-contract.test.ts` to inspect only the Codex manifest, remove standard-manifest and `verify.sh` assertions, and keep checks that native Luna routine selection does not authorize the app-task lane.

- [ ] **Step 2: Run contract tests and confirm legacy language fails**

```powershell
bun test tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts
```

Expected: FAIL on compatibility role names, client names, compatibility templates, shell scripts, and the portable reference.

- [ ] **Step 3: Rewrite setup as a Codex-only interview**

The setup sequence must be exactly:

1. scope: project or user;
2. explicit existing workspace;
3. exact model and effort for routine, high, and advisor copied from Codex;
4. optional explicit Luna / Max app-task availability;
5. complete preference preview with `client: "codex"`;
6. `save_preferences`;
7. `render_client_adapter` full file preview;
8. exact installation token;
9. `install_client_adapter`;
10. `validate_configuration` requiring `adapterStatus: "current"`;
11. full restart and new-task notice.

Keep project scope recommended and user-scope confirmation separate. Remove all client-selection, cross-client effort capability, portable surface, and compatibility companion instructions.

- [ ] **Step 4: Rewrite orchestration around configured roles**

The skill must define this routing table:

```text
bounded/mechanical -> sol_advisor_routine
complex/security/broad -> sol_advisor_high
architecture/final review -> sol_advisor_advisor
explicit current-request Luna authorization -> Codex app task lane
```

Before every configured native spawn:

1. call `get_setup_status` and `get_preferences`;
2. call `validate_configuration` for the saved workspace;
3. require `adapterStatus=current`;
4. confirm the exact configured role name is exposed by the collaboration tool;
5. spawn that role without model or effort overrides;
6. inspect public runtime details first, then run:

On Windows, resolve the inspector from the directory containing `SKILL.md` and use
the UUID returned for the native child:

```powershell
$runtimeInspector = [IO.Path]::GetFullPath((Join-Path $skillDir '..\..\scripts\inspect-agent-runtime.ts'))
bun $runtimeInspector $nativeSubagentThreadId
```

7. compare observed role/model/effort with saved preferences;
8. capture reviewer sandbox and permission profile;
9. fail closed on missing or inconsistent evidence.

Correction uses the same configured routine/high role selected from work complexity. Final native review always uses a fresh `sol_advisor_advisor`. Keep the Luna task lane separate and unchanged except for links to the configured-role contract.

- [ ] **Step 5: Rewrite `role-contracts.md` without model-family pins**

Retain a complete worker packet with `OBJECTIVE`, `FILES AND OWNERSHIP`, `INTERFACES`, `CONSTRAINTS`, `VERIFICATION`, and `RETURN`. Define two worker selections (`sol_advisor_routine` and `sol_advisor_high`) and one final reviewer (`sol_advisor_advisor`). Require the reviewer to return `ship`, `fix-first`, or `rethink` and never implement fixes.

Do not mention Terra, Sol reviewer compatibility, companion templates, or `sh`. Runtime acceptance compares against saved preferences, not hard-coded model families.

- [ ] **Step 6: Remove compatibility assets and update package tests**

Delete the listed compatibility files and `portable-entry.md`. Change `openai.yaml` to:

```yaml
interface:
  display_name: "Sol Advisor Orchestration"
  short_description: "Use configured Codex roles or explicitly authorize a Luna task"
  default_prompt: "Use $orchestration with the saved routine, high, and advisor roles; use the Luna app-task lane only when I explicitly authorize it."
```

Change `package.json` test and CI scripts to:

```json
"ci": "bun run test && bun run validate && bun run release:check",
"test": "bun test plugins/sol-advisor/mcp/server.test.ts plugins/sol-advisor/mcp/private-directory.test.ts tools/plugin-discovery.test.ts tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts tools/version.test.ts"
```

`tools/version.test.ts` is added in Task 5; until then run the explicit existing test files instead of `bun run test`.

- [ ] **Step 7: Run orchestration contract tests**

```powershell
bun test tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts
```

Expected: all tests pass; active contracts contain only configured Codex roles and explicit Luna authorization.

- [ ] **Step 8: Commit the configured-role contract**

```powershell
git add package.json plugins/sol-advisor/skills tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts
git rm -r plugins/sol-advisor/agents plugins/sol-advisor/scripts/install-agents.sh plugins/sol-advisor/scripts/verify.sh plugins/sol-advisor/skills/orchestration/references/portable-entry.md
git commit -m "refactor: use configured Codex roles exclusively"
```

### Task 5: Unify base version, cachebuster, and release identity

**Files:**
- Create: `tools/version.ts`
- Create: `tools/version.test.ts`
- Modify: `tools/validate.ts`
- Modify: `plugins/sol-advisor/mcp/server.ts`
- Modify: `plugins/sol-advisor/mcp/server.test.ts`
- Modify: `package.json`
- Modify: `plugins/sol-advisor/.codex-plugin/plugin.json`

- [ ] **Step 1: Write failing version tests**

Create `tools/version.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { baseVersion, parseCodexVersion } from "./version";

describe("Codex plugin version identity", () => {
  test("accepts a release base with an optional single Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0")).toEqual({ base: "0.6.0", cachebuster: null });
    expect(parseCodexVersion("0.6.0+codex.20260809135432")).toEqual({
      base: "0.6.0",
      cachebuster: "20260809135432",
    });
  });

  test("rejects non-Codex metadata and repeated suffixes", () => {
    for (const value of ["0.6", "0.6.0+other.x", "0.6.0+codex.a+codex.b", "v0.6.0"]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("compares release tags to base versions", () => {
    expect(baseVersion("0.6.0+codex.local-1")).toBe("0.6.0");
  });
});
```

Add an MCP test that expects `initialize.result.serverInfo.version` and saved `pluginVersion` to equal the Codex manifest base version.

- [ ] **Step 2: Run version and MCP tests to confirm hard-coded `0.5.0` fails**

```powershell
bun test tools/version.test.ts plugins/sol-advisor/mcp/server.test.ts
```

Expected: FAIL because `tools/version.ts` does not exist and `server.ts` still hard-codes `0.5.0`.

- [ ] **Step 3: Implement version parsing**

Create `tools/version.ts`:

```ts
const basePattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const cachePattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;

export function parseCodexVersion(value: string) {
  const parts = value.split("+");
  if (parts.length > 2 || !basePattern.test(parts[0]!)) throw new Error("invalid base version");
  if (parts.length === 1) return { base: parts[0]!, cachebuster: null };
  const match = /^codex\.(.+)$/.exec(parts[1]!);
  if (!match || !cachePattern.test(match[1]!)) throw new Error("invalid Codex cachebuster");
  return { base: parts[0]!, cachebuster: match[1]! };
}

export const baseVersion = (value: string) => parseCodexVersion(value).base;
```

- [ ] **Step 4: Set the breaking Codex-only base version to `0.6.0`**

Set `package.json` and `.codex-plugin/plugin.json` to `0.6.0` before the final reinstall cachebuster. Update the manifest description and interface text to remove retained compatibility language.

In `server.ts`, read the packaged manifest once:

```ts
const codexManifest = JSON.parse(
  readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);
export const PRODUCT_VERSION = String(codexManifest.version).split("+", 1)[0]!;
```

Use `PRODUCT_VERSION` for saved `pluginVersion` and MCP `serverInfo.version`.

- [ ] **Step 5: Update tag and release validation**

Import `baseVersion` and `parseCodexVersion` in `tools/validate.ts`. Require `package.json.version === baseVersion(codexManifest.version)`. Tag validation compares `v0.6.0` to `0.6.0`; it does not accept a tag containing the Codex cachebuster.

Release artifact changes:

- name it `sol-advisor-0.6.0.tar.gz`;
- require `.codex-plugin/plugin.json` in the archive rather than root `plugin.json`;
- run `validatePackage` on the extracted Codex plugin;
- keep the extracted MCP core-flow test;
- assert extracted `initialize.serverInfo.version === "0.6.0"`.

- [ ] **Step 6: Run version, tag, and release checks**

```powershell
bun test tools/version.test.ts plugins/sol-advisor/mcp/server.test.ts
bun run tag:check -- v0.6.0
bun run release:check
```

Expected: all commands exit 0; release check cleans its temporary artifact.

- [ ] **Step 7: Commit consistent product identity**

```powershell
git add package.json plugins/sol-advisor/.codex-plugin/plugin.json plugins/sol-advisor/mcp/server.ts plugins/sol-advisor/mcp/server.test.ts tools/version.ts tools/version.test.ts tools/validate.ts
git commit -m "fix: separate release version from Codex cache identity"
```

### Task 6: Remove obsolete guidance and document the one install path

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-08-codex-mcp-discovery-fix-design.md`
- Modify: `docs/superpowers/specs/2026-08-08-standalone-workspace-mcp-design.md`
- Modify: `docs/superpowers/specs/2026-08-08-visual-multimodal-luna-activation-design.md`
- Modify: `docs/superpowers/specs/2026-08-09-native-luna-routine-role-design.md`
- Modify: `docs/superpowers/plans/2026-08-08-codex-mcp-discovery-fix.md`
- Modify: `docs/superpowers/plans/2026-08-08-standalone-workspace-mcp.md`
- Modify: `docs/superpowers/plans/2026-08-08-visual-multimodal-luna-activation.md`
- Modify: `docs/superpowers/plans/2026-08-09-native-luna-routine-role.md`
- Modify: `tools/orchestration-contract.test.ts`

- [ ] **Step 1: Extend contract tests to reject obsolete public guidance**

Add:

```ts
test("README exposes only the Codex install and configured-role path", () => {
  const readme = readFileSync(join(import.meta.dir, "..", "README.md"), "utf8");
  expect(readme).toContain("codex plugin add sol-advisor@sol-advisor");
  expect(readme).toContain("sol_advisor_routine");
  expect(readme).toContain("sol_advisor_high");
  expect(readme).toContain("sol_advisor_advisor");
  for (const removed of [
    "Cursor", "VS Code", "GitHub Copilot", "Kiro",
    "sol_advisor_terra_implementer", "sol_advisor_sol_reviewer",
  ]) expect(readme).not.toContain(removed);
});
```

- [ ] **Step 2: Run the contract test and observe obsolete README claims**

```powershell
bun test tools/orchestration-contract.test.ts
```

Expected: FAIL because README still documents cross-client and compatibility paths.

- [ ] **Step 3: Rewrite README around the actual Codex user path**

Keep only:

1. what Sol Advisor does;
2. prerequisites: Codex, Bun, local repo marketplace;
3. marketplace source `.agents/plugins/marketplace.json`;
4. install command `codex plugin add sol-advisor@sol-advisor`;
5. restart and new-task requirement;
6. lazy setup and exact-token adapter installation;
7. configured routine/high/advisor routing;
8. explicit-only Luna app-task lane;
9. Windows-native verification commands;
10. behavioral versus enforced read-only reporting;
11. development cachebuster procedure;
12. uninstall and troubleshooting without cache deletion.

Do not describe removed clients, portable Agent Plugins support, companion installation, compatibility profiles, or automatic visual Luna routing.

- [ ] **Step 4: Mark historical documents superseded**

Add this immediately below each title, adjusting `Partially` only for the native-Luna documents whose explicit routine/app-task separation remains useful:

```markdown
> **Superseded:** The active Codex-only design is
> [Codex-Only Sol Advisor Repair Design](2026-08-09-codex-only-sol-advisor-repair-design.md).
> Cross-client, compatibility-role, and automatic visual Luna decisions in this
> document must not be implemented.
```

Plan documents use the relative link to `../specs/2026-08-09-codex-only-sol-advisor-repair-design.md`.

- [ ] **Step 5: Run contract and link validation**

```powershell
bun test tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts
bun run validate
```

Expected: no active guidance contains removed clients or roles; all relative supersession links resolve.

- [ ] **Step 6: Commit documentation cleanup**

```powershell
git add README.md docs/superpowers tools/orchestration-contract.test.ts
git commit -m "docs: document Codex-only installation and routing"
```

### Task 7: Run complete source verification and fresh configured review

**Files:**
- Modify only if verification or review exposes a concrete defect.

- [ ] **Step 1: Run the complete automated suite**

```powershell
bun run test
bun run validate
bun run release:check
bun run tag:check -- v0.6.0
git diff --check
```

Expected: every command exits 0. Record exact test counts and any platform-specific skips; do not reduce the suite to make a failure disappear.

- [ ] **Step 2: Inspect removals and package contents**

```powershell
git status --short
git diff --stat d9e39cd...HEAD
git ls-files plugins/sol-advisor tools
```

Expected:

- no root `plugins/sol-advisor/plugin.json` or `mcp.json`;
- no Cursor tool/test, portable schemas, compatibility templates, or mandatory shell scripts;
- one `.codex-plugin/plugin.json`, one `.mcp.json`, one MCP server, two skills, configured-role contracts, and Bun tests;
- no unrelated files changed.

- [ ] **Step 3: Validate the plugin with the bundled plugin-creator validator**

```powershell
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py G:\Codex_Projects\sol-advisor\plugins\sol-advisor
```

Expected: validator exits 0 with no unsupported manifest fields or missing companion files.

- [ ] **Step 4: Obtain a fresh configured advisor verdict**

Capture the pre-review Git baseline. Invoke `sol_advisor_advisor` without model or effort overrides. Give it the approved design, `d9e39cd...HEAD` diff, and the exact outputs from Steps 1-3. Require `ship`, `fix-first`, or `rethink` plus file/line findings.

Assign the spawned review's exact rollout UUID to `$reviewThreadId`, then inspect it:

```powershell
bun plugins/sol-advisor/scripts/inspect-agent-runtime.ts $reviewThreadId
```

Accept the review only when observed role/model/effort match saved advisor preferences. Report the actual sandbox and permission profile. If the host reports `workspace-write`, compare Git and artifact state before and after and call the review behaviorally read-only only.

- [ ] **Step 5: Resolve review findings through the configured high role**

For `fix-first`, give `sol_advisor_high` one corrected, file-owned specification. Rerun all Step 1 commands and obtain a new fresh advisor verdict. Do not let the reviewer implement its own fixes.

- [ ] **Step 6: Commit any review-required correction**

Use a narrowly scoped message that describes the actual correction. If the verdict is `ship` with no changes, create no empty commit.

### Task 8: Refresh, reinstall, restart, and prove the user path

**Files:**
- Modify: `plugins/sol-advisor/.codex-plugin/plugin.json` through the plugin-creator helper only.

- [ ] **Step 1: Record the clean pre-install source state**

```powershell
git status --short --branch
git rev-parse HEAD
```

Expected: clean implementation branch with all source verification committed.

- [ ] **Step 2: Apply one Codex cachebuster through the supported helper**

```powershell
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\update_plugin_cachebuster.py G:\Codex_Projects\sol-advisor\plugins\sol-advisor
```

Expected: `.codex-plugin/plugin.json` changes from `0.6.0` or a prior cached value to
one version matching `^0\.6\.0\+codex\.[a-z0-9-]+$`.

Rerun:

```powershell
bun test tools/version.test.ts tools/plugin-discovery.test.ts
bun run validate
```

Expected: both commands pass with the cachebuster present.

- [ ] **Step 3: Commit the cache identity**

```powershell
git add plugins/sol-advisor/.codex-plugin/plugin.json
git commit -m "chore: refresh Codex-only plugin cachebuster"
```

- [ ] **Step 4: Confirm the repository marketplace and reinstall**

Run `codex plugin list`. If the `sol-advisor` marketplace is not registered from `G:\Codex_Projects\sol-advisor`, add the non-default repository marketplace once:

```powershell
codex plugin marketplace add G:\Codex_Projects\sol-advisor
```

Then reinstall from its declared name:

```powershell
codex plugin add sol-advisor@sol-advisor
```

Expected: Codex accepts the new cachebuster and installs from this repository. If the CLI is denied by the active desktop sandbox, stop and run this step from an authorized terminal; do not edit the cache or marketplace JSON by hand.

- [ ] **Step 5: Stop at the restart boundary**

Fully exit Codex so the active MCP process releases the old cache. Do not force-delete the cache or kill unrelated processes. Reopen the existing project `G:\Codex_Projects\sol-advisor` and create a new task; a new Codex project is not required.

- [ ] **Step 6: Run the fresh-task acceptance packet**

In the new task, request:

```text
Use $sol-advisor:orchestration for Codex-only installation acceptance.
Remain read-only in the project. Confirm cwd, call get_setup_status,
get_preferences, and validate_configuration for G:\Codex_Projects\sol-advisor.
Require adapterStatus=current. Invoke sol_advisor_routine,
sol_advisor_high, and sol_advisor_advisor separately with no model or effort
overrides. Inspect each child rollout and report agent role, model, effort,
sandbox policy, and permission profile. Compare Git state before and after.
Do not claim completion from manifest files or unit tests alone.
```

Expected:

- MCP tools are present and registered from the new cache;
- setup is `ready`;
- `validate_configuration` is valid and `adapterStatus=current`;
- routine routes to the saved routine model/effort;
- high routes to the saved high model/effort;
- advisor routes to the saved advisor model/effort;
- advisor makes no project changes;
- actual sandbox and permission types are reported without upgrading `workspace-write` to enforced read-only.

- [ ] **Step 7: Report installed legacy companion files without deleting them**

Read-only check:

```powershell
Get-ChildItem C:\Users\SYX001\.codex\agents\sol-advisor-*-implementer.toml,
  C:\Users\SYX001\.codex\agents\sol-advisor-*-reviewer.toml -ErrorAction SilentlyContinue |
  Select-Object FullName
```

If legacy compatibility files remain, report them as ignored user-owned files. Ask for a separate explicit removal confirmation only if the user wants cleanup.

- [ ] **Step 8: Declare completion only after live acceptance**

The final report must separate:

- source implementation and automated verification;
- installed plugin cache identity;
- fresh-task MCP discovery;
- actual three-role runtime routing;
- behavioral versus host-enforced read-only;
- any skipped legacy-file cleanup or remaining limitation.

If any fresh-task item fails, report the repair as incomplete and continue diagnosis from the observed installation/runtime evidence.
