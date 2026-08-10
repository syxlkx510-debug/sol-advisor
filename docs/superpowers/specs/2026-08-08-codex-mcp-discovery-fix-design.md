# Sol Advisor Codex MCP Discovery Fix

> **Superseded:** The active Codex-only design is
> [Codex-Only Sol Advisor Repair Design](2026-08-09-codex-only-sol-advisor-repair-design.md).
> Cross-client, compatibility-role, and automatic visual Luna decisions in this
> document must not be implemented.

## Problem

The installed Sol Advisor plugin exposes its skills, but Codex does not register the plugin's MCP setup tools after restart. The MCP server itself is healthy: its protocol, configuration, adapter lifecycle, and private-directory tests pass. The discovery failure occurs before the server starts because the Codex plugin manifest does not declare an MCP companion file.

## Selected approach

Use the native Codex plugin contract instead of adding a separate user-level MCP entry:

1. Rename the plugin companion file from `mcp.json` to `.mcp.json`.
2. Add `"mcpServers": "./.mcp.json"` to `.codex-plugin/plugin.json`.
3. Add a repository validation regression that fails when a plugin ships an MCP companion without the corresponding manifest declaration, or declares a missing companion.
4. Refresh the existing local plugin through the cachebuster and reinstall workflow; do not hand-edit the marketplace or Codex configuration.
5. After Codex restarts, verify that `get_setup_status` is available before continuing the A-scheme setup interview.

## Alternatives considered

- Add Sol Advisor directly to the user's global MCP configuration. This bypasses plugin discovery, but creates duplicate ownership and can drift from the installed plugin, so it is rejected.
- Run the MCP server manually. This is useful for diagnosis but is not a durable Codex integration, so it is rejected.
- Wait for a future upstream release. This leaves the approved configuration blocked, so it is rejected.

## Boundaries

- Preserve all existing uncommitted work and avoid unrelated refactors.
- Do not change saved role models, reasoning settings, routing policy, or A-scheme behavior as part of this fix.
- Do not edit marketplace or Codex configuration files by hand.
- Do not claim setup is complete until a restarted Codex task exposes the MCP tools and `get_setup_status` returns successfully.

## Validation

Implementation follows a test-first sequence:

1. Add a failing validation case that represents the current undiscoverable plugin shape.
2. Update the manifest and companion filename minimally.
3. Run the focused validation test, the full Bun test suite, repository validation, and plugin validation.
4. Refresh and reinstall the local plugin using the official cachebuster helper flow.
5. In a new Codex task after restart, confirm the Sol Advisor MCP tools appear and continue the setup interview.

## Failure handling

- If the focused test does not fail before the fix, revise the test rather than changing production files.
- If reinstall resolves to a non-local marketplace, stop before writing and report the mismatch.
- If tools remain absent after reinstall and restart, inspect the Codex MCP startup error and command environment; do not add a second fallback registration.
- If setup state is missing, old, or corrupt, follow the setup skill's interview and exact-confirmation flow rather than manufacturing preferences.

## Completion criteria

The fix is complete only when the repository checks pass, the updated local plugin is installed, Codex has restarted, and Sol Advisor's `get_setup_status` tool is callable. A-scheme role preferences and adapters remain a separate setup step governed by their explicit preview and confirmation tokens.
