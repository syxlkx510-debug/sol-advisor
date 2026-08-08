# Codex MCP Discovery Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Codex discover and start Sol Advisor's packaged MCP server so the setup tools become available after reinstall and restart.

**Architecture:** Keep MCP ownership inside the existing local plugin. The Codex manifest points to the conventional `.mcp.json` companion, repository tests enforce that relationship, and the existing MCP runtime remains unchanged.

**Tech Stack:** Bun tests, TypeScript repository validation, Codex plugin manifests, Python plugin validation/cachebuster helpers, Codex CLI local marketplace installation.

---

### Task 1: Add a failing Codex discovery regression

**Files:**
- Create: `tools/plugin-discovery.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the focused regression test**

```ts
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const pluginRoot = resolve(import.meta.dir, "..", "plugins", "sol-advisor");
const manifest = JSON.parse(
  readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);

describe("Codex MCP discovery", () => {
  test("declares the conventional companion file", () => {
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(existsSync(join(pluginRoot, ".mcp.json"))).toBe(true);
  });

  test("does not ship an undiscoverable legacy filename", () => {
    expect(existsSync(join(pluginRoot, "mcp.json"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
bun test tools/plugin-discovery.test.ts
```

Expected: FAIL because `mcpServers` is absent, `.mcp.json` is absent, and `mcp.json` still exists.

- [ ] **Step 3: Register the test in the existing test script without removing the private-directory test**

Set `scripts.test` in `package.json` to:

```json
"test": "bun test plugins/sol-advisor/mcp/server.test.ts plugins/sol-advisor/mcp/private-directory.test.ts tools/plugin-discovery.test.ts tools/cursor-local.test.ts"
```

Do not commit this task separately because `package.json` already contains an unrelated, uncommitted private-directory test registration that must remain attributable to its existing work.

### Task 2: Make the plugin discoverable and align repository validation

**Files:**
- Rename: `plugins/sol-advisor/mcp.json` to `plugins/sol-advisor/.mcp.json`
- Modify: `plugins/sol-advisor/.codex-plugin/plugin.json`
- Modify: `tools/validate.ts`

- [ ] **Step 1: Rename the companion file with `apply_patch`**

Preserve the JSON content exactly while moving it to `plugins/sol-advisor/.mcp.json`; delete the legacy `plugins/sol-advisor/mcp.json` path.

- [ ] **Step 2: Declare the companion in the Codex manifest**

Add the following top-level field next to `skills`:

```json
"mcpServers": "./.mcp.json"
```

- [ ] **Step 3: Update the repository package validator minimally**

Replace the legacy MCP check inside `validatePackage` with:

```ts
if (codex.mcpServers !== "./.mcp.json") fail("Codex manifest mcpServers must be ./.mcp.json");
const mcpPath = join(packageRoot, ".mcp.json");
if (!existsSync(mcpPath)) fail(".mcp.json is required"); else validateMcp(mcpPath);
if (existsSync(join(packageRoot, "mcp.json"))) fail("legacy mcp.json must not be shipped");
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
bun test tools/plugin-discovery.test.ts
```

Expected: 2 pass, 0 fail.

- [ ] **Step 5: Run repository and plugin validation**

Run:

```powershell
bun run validate
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: `PASS: validate` and `Plugin validation passed`.

### Task 3: Verify the complete local package

**Files:**
- Verification only; do not change runtime code.

- [ ] **Step 1: Run the full test suite**

Run:

```powershell
bun test
```

Expected: all MCP, private-directory, discovery, and Cursor tests pass with 0 failures.

- [ ] **Step 2: Run extracted-package verification**

Run:

```powershell
bun run release:check
```

Expected: `PASS: release-check`; the temporary release artifact is removed by the check.

- [ ] **Step 3: Inspect the final diff**

Confirm the new changes are limited to the companion rename, Codex manifest pointer, discovery regression, test registration, and validator path update. Preserve all pre-existing ACL and Cursor changes.

### Task 4: Refresh and reinstall the local plugin

**Files:**
- Modify through the official helper: `plugins/sol-advisor/.codex-plugin/plugin.json`
- Synchronize the helper-produced version: `plugins/sol-advisor/plugin.json`, `package.json`
- External managed state: `C:\Users\SYX001\.codex\plugins\cache\sol-advisor`

- [ ] **Step 1: Apply the default UTC cachebuster**

Run:

```powershell
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\update_plugin_cachebuster.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: output reports a version beginning with `0.5.0+codex.` followed by the helper's 14-digit UTC cachebuster.

- [ ] **Step 2: Synchronize the exact emitted version**

Read the resulting `version` from `.codex-plugin/plugin.json`, then use `apply_patch` to place that exact string in `plugins/sol-advisor/plugin.json` and `package.json`. Do not alter any other fields.

- [ ] **Step 3: Re-run all local verification after version synchronization**

Run:

```powershell
bun test
bun run validate
bun run release:check
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: every command exits 0.

- [ ] **Step 4: Reinstall from the configured local marketplace**

Run the versioned Codex CLI with `CODEX_HOME=C:\Users\SYX001\.codex` and:

```text
plugin add sol-advisor@sol-advisor
```

Expected: the installed cache directory uses the new cachebuster version and contains `.mcp.json` plus a Codex manifest whose `mcpServers` value is `./.mcp.json`.

- [ ] **Step 5: Stop at the restart boundary**

Ask the user to restart Codex and return in a new task. Do not claim MCP discovery is fixed until that restarted task exposes `get_setup_status`.

### Task 5: Verify the restarted app and resume A-scheme setup

**Files:**
- No repository edits unless new evidence identifies another root cause.

- [ ] **Step 1: Verify tool registration before configuration**

In the restarted task, confirm the Sol Advisor MCP tools include `get_setup_status`, `save_preferences`, `render_client_adapter`, and `install_client_adapter`.

- [ ] **Step 2: Call setup status first**

Call `get_setup_status` with an empty object. Route `missing`, `schema-old`, or `corrupt` through the setup interview; if `ready`, read and validate the saved preferences before adapter preview.

- [ ] **Step 3: Continue the explicit setup workflow**

Preserve the user's primary-session model choice, require exact native role IDs, keep advisor read-only and fallbacks fail-closed, preview every adapter destination/content, and install only after the exact confirmation token is repeated.
