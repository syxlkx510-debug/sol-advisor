# Sol Advisor Standalone Workspace MCP Design

## Problem

Codex discovers Sol Advisor's packaged `.mcp.json`, but a fully restarted Windows session does not register its tools. The installed TypeScript entrypoint intermittently fails with `EPERM` when executed from the read-only plugin cache. The same server launched from the project workspace initializes successfully, lists all eight tools, and reports setup status `missing` when run with the existing private plugin data directory.

## Selected approach

Keep the installed plugin for its skills and add one normal Codex stdio MCP entry named `sol-advisor-local`:

- command: `C:\Users\SYX001\.bun\bin\bun.exe`
- argument: `G:\Codex_Projects\sol-advisor\plugins\sol-advisor\mcp\server.ts`
- environment: `PLUGIN_DATA=C:\Users\SYX001\.codex\plugins\data\agent-plugins\db20ee8601361d3e7482b6f3f7e227fc19034ad8ba0c1ba9660fe47a0ac8d320`

The distinct MCP name prevents a future recovered packaged MCP from colliding with the standalone entry.

## Scope and safety

- The MCP tool entry is visible to Codex generally, but Sol Advisor preferences remain keyed to `codex:project:G:\Codex_Projects\sol-advisor`.
- Adapter installation remains project-scoped and still requires the exact preview confirmation token.
- This change does not write role models, reasoning settings, fallbacks, or adapters.
- The private data directory is the existing Codex-managed directory already used by the packaged plugin; no alternate data store is introduced.
- Existing MCP entries `node_repl` and `chatcut` are preserved.

## Verification

1. Preview the exact `codex mcp add` command and confirm the target name is absent.
2. Add `sol-advisor-local` using the versioned Codex CLI with the real `CODEX_HOME`.
3. Verify `codex mcp get sol-advisor-local` shows the exact command, argument, and redacted `PLUGIN_DATA` environment value.
4. Restart Codex once.
5. Confirm the eight `sol-advisor-local` tools are registered and call `get_setup_status` before any configuration write.

## Rollback

Run `codex mcp remove sol-advisor-local`. This removes only the standalone MCP entry; it does not uninstall the Sol Advisor plugin, delete preferences, alter adapters, or touch existing MCP servers.

## Completion criteria

The workaround is complete only after a restarted Codex task exposes the standalone tools and `get_setup_status` returns successfully. Model and reasoning selections remain part of the subsequent setup interview.
