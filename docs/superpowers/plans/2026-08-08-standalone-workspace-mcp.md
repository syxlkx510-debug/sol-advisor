# Standalone Workspace MCP Implementation Plan

> **Superseded:** The active Codex-only design is
> [Codex-Only Sol Advisor Repair Design](../specs/2026-08-09-codex-only-sol-advisor-repair-design.md).
> Cross-client, compatibility-role, and automatic visual Luna decisions in this
> document must not be implemented.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register a reliable `sol-advisor-local` stdio MCP that runs Sol Advisor's server from the current workspace instead of the read-only plugin cache.

**Architecture:** Keep the installed plugin as the skill package. Add one reversible Codex MCP entry pointing to the workspace TypeScript server and reuse the existing Codex-managed private plugin data directory.

**Tech Stack:** Codex CLI MCP configuration, Bun 1.3.14, newline-delimited JSON-RPC MCP server, Windows private plugin data directory.

---

### Task 1: Confirm the pre-change boundary

**Files:**
- Read only: `C:\Users\SYX001\.codex\config.toml`
- Read only: `G:\Codex_Projects\sol-advisor\plugins\sol-advisor\mcp\server.ts`

- [ ] **Step 1: Confirm the MCP name is absent**

Run with `CODEX_HOME=C:\Users\SYX001\.codex`:

```powershell
& 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin\cfac6bda2d141e07\codex.exe' mcp get sol-advisor-local
```

Expected: exit 1 with `No MCP server named 'sol-advisor-local' found`.

- [ ] **Step 2: Confirm the workspace server still initializes**

Run the server from `G:\Codex_Projects\sol-advisor\plugins\sol-advisor\mcp\server.ts` with the exact `PLUGIN_DATA` directory from the design and send `initialize`, `tools/list`, and `get_setup_status` requests.

Expected: server name `sol-advisor`, eight tools listed, and setup status `missing`.

### Task 2: Add the standalone MCP entry

**Files:**
- Modify through Codex CLI: `C:\Users\SYX001\.codex\config.toml`

- [ ] **Step 1: Add the exact stdio entry**

Run with `CODEX_HOME=C:\Users\SYX001\.codex`:

```powershell
& 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin\cfac6bda2d141e07\codex.exe' mcp add sol-advisor-local `
  --env 'PLUGIN_DATA=C:\Users\SYX001\.codex\plugins\data\agent-plugins\db20ee8601361d3e7482b6f3f7e227fc19034ad8ba0c1ba9660fe47a0ac8d320' `
  -- 'C:\Users\SYX001\.bun\bin\bun.exe' `
  'G:\Codex_Projects\sol-advisor\plugins\sol-advisor\mcp\server.ts'
```

Expected: `Added global MCP server 'sol-advisor-local'` or equivalent success output.

- [ ] **Step 2: Verify the persisted entry**

Run:

```powershell
& 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin\cfac6bda2d141e07\codex.exe' mcp get sol-advisor-local
```

Expected: enabled stdio entry with the exact Bun command, workspace server argument, and a redacted `PLUGIN_DATA` value.

- [ ] **Step 3: Verify existing MCP entries remain present**

Run:

```powershell
& 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin\cfac6bda2d141e07\codex.exe' mcp list
```

Expected: `node_repl`, `chatcut`, and `sol-advisor-local` are enabled; no existing entry is removed or changed.

### Task 3: Verify after the required restart

**Files:**
- No repository or configuration writes.

- [ ] **Step 1: Restart Codex once**

Fully exit and reopen Codex, then return to `G:\Codex_Projects\sol-advisor`.

- [ ] **Step 2: Verify tool registration**

Confirm the tool inventory contains the eight `sol-advisor-local` MCP tools, including `get_setup_status`, `save_preferences`, `render_client_adapter`, and `install_client_adapter`.

- [ ] **Step 3: Call setup status before writes**

Call `get_setup_status` with `{}`.

Expected: `{"status":"missing"}`. If the status differs, stop and follow the setup skill's `ready`, `schema-old`, or `corrupt` branch without manufacturing configuration.

### Task 4: Roll back only if standalone registration fails

**Files:**
- Modify through Codex CLI only on failure: `C:\Users\SYX001\.codex\config.toml`

- [ ] **Step 1: Remove the standalone entry**

Run with `CODEX_HOME=C:\Users\SYX001\.codex`:

```powershell
& 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin\cfac6bda2d141e07\codex.exe' mcp remove sol-advisor-local
```

Expected: only `sol-advisor-local` is removed; `node_repl`, `chatcut`, the Sol Advisor plugin, its data directory, preferences, and adapters remain untouched.
