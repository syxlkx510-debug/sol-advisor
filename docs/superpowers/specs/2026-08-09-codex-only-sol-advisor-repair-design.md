# Codex-Only Sol Advisor Repair Design

## Status

Approved direction: Sol Advisor will support Codex only. Cross-client adapters and
the retained legacy compatibility roles are no longer product requirements.

This design supersedes the cross-client packaging, Cursor adapter, automatic visual
Luna activation, and retained `sol_advisor_terra_implementer` /
`sol_advisor_sol_reviewer` compatibility decisions in earlier plans and specs. The
explicit Luna app-task lane remains supported and opt-in.

## Objective

Make the repository produce one locally installable Codex plugin whose MCP tools and
configured native roles are discoverable in a fresh Codex task, with deterministic
Windows-compatible validation and an auditable reinstall procedure.

## User outcome

After installation from this repository's marketplace and a full Codex restart, a new
task in the project can:

- call the Sol Advisor MCP setup and validation tools;
- invoke exactly `sol_advisor_routine`, `sol_advisor_high`, and
  `sol_advisor_advisor` using the saved project preferences;
- use the separate Luna / Max app-task lane only when the current request explicitly
  authorizes it;
- fail closed if a configured role, model, effort, or required runtime tool is absent;
- report observed runtime model, effort, sandbox policy, and permission profile
  without claiming stronger isolation than the host supplies.

## Non-goals

- Agent Plugins portable-package conformance.
- Cursor, VS Code, GitHub Copilot, or Kiro installation and role adapters.
- Automatic Luna routing based on visual content or attachments.
- The legacy `sol_advisor_terra_implementer` and
  `sol_advisor_sol_reviewer` compatibility lane.
- OS-enforced read-only isolation when the Codex host exposes only
  `workspace-write`.

## Architecture

### 1. One Codex plugin package

The only plugin manifest is `plugins/sol-advisor/.codex-plugin/plugin.json`. It points
to `./skills/` and `./.mcp.json`. The MCP companion launches the existing Bun server
from `${PLUGIN_ROOT}/mcp/server.ts` and keeps persistent configuration in the
client-provided `PLUGIN_DATA` directory.

Remove the portable root `plugin.json`, portable `mcp.json` contract, Cursor local
installer, non-Codex adapter rendering, and tests or documentation that exist only to
support those paths. Keep the repository marketplace at
`.agents/plugins/marketplace.json` as the installation source.

### 2. One configured native role lane

Setup stores exact Codex-native preferences for three roles:

- `routine`: bounded, fully specified implementation work;
- `high`: complex, security-sensitive, or broad implementation work;
- `advisor`: behaviorally read-only architecture and final review.

The generated project role files remain:

- `.codex/agents/sol-advisor-routine.toml`;
- `.codex/agents/sol-advisor-high.toml`;
- `.codex/agents/sol-advisor-advisor.toml`.

Orchestration always selects these configured roles. Preflight, correction, and final
review use the selected configured role rather than hard-coded compatibility roles.
No native role is silently substituted. The parent task owns architecture, complete
specification, diff inspection, verification, and final acceptance.

### 3. Separate explicit Luna app-task lane

The Luna lane remains outside native roles. It may be entered only when the current
request explicitly authorizes the Luna task lane. It uses Codex app task tools at the
saved Luna / Max setting, never a custom-agent TOML and never as a fallback.

### 4. Windows-native verification

Mandatory validation and runtime inspection are implemented as Bun/TypeScript
commands. Shell scripts may remain as optional wrappers but cannot be the only
supported entrypoint. Repository attributes keep any retained shell wrapper at LF.

The exactness check verifies managed role-file content without changing it. The
runtime inspector reads the child rollout's allowlisted role, model, effort, sandbox,
and permission metadata. An unobservable or inconsistent required field stops the
lane.

### 5. Release version versus local cache identity

The repository has one strict semantic base version. Release tags compare against the
base version, for example `v0.5.1` against `0.5.1`.

Local Codex iteration may add one `+codex.<cachebuster>` suffix to the Codex manifest.
Validation intentionally compares base versions while separately validating the
cachebuster syntax. The MCP server reports the base product version from one
authoritative source instead of a duplicated hard-coded value.

The cachebuster is changed only through the plugin-creator update helper. Marketplace
configuration and plugin caches are not edited by hand.

## Removal and migration

Implementation removes cross-client code, fixtures, documentation claims, and
compatibility-role instructions. Historical design documents that describe removed
behavior receive a clear `superseded` notice pointing to this design; they are not
silently left as current guidance.

Installed legacy companion role files are treated as user-owned. The repair may
detect and report them, but must not delete them without an explicit removal step and
confirmation. They are ignored by the new orchestration flow.

## Error handling

- Missing or corrupt setup stops orchestration and routes to setup.
- A missing configured role, unavailable configured model/effort, or inconsistent
  runtime metadata stops the affected lane without fallback.
- A stale or conflicting managed adapter file stops installation and reports its exact
  path and expected remediation.
- A host-broadened reviewer sandbox is reported as behavioral no-write only. The
  parent records Git state before and after review; any mutation invalidates the
  verdict.
- Failed reinstall or discovery is reported as incomplete. A source manifest, cached
  package, or passing unit test is not accepted as live runtime proof.

## Verification strategy

### Automated verification

- Focused tests first cover Codex manifest discovery, MCP launch configuration,
  exact three-role rendering, configured routing, explicit-only Luna authorization,
  Windows-safe validation entrypoints, version/tag behavior, and cachebuster handling.
- Run the complete Bun test suite.
- Run repository validation and release-package checking.
- Run Git whitespace and working-tree checks.

### Installation acceptance

1. Confirm the repository marketplace resolves to `plugins/sol-advisor`.
2. Update the Codex cachebuster with the plugin-creator helper.
3. Reinstall `sol-advisor@sol-advisor` through the Codex CLI without editing the
   marketplace or cache by hand.
4. Fully exit and restart Codex, reopen this project, and create a new task.
5. Confirm the registered MCP reports ready configuration and exposes all expected
   tools.
6. Invoke routine, high, and advisor roles separately and inspect each child rollout's
   actual role, model, effort, sandbox policy, and permission profile.
7. Confirm the advisor made no working-tree or artifact changes and report whether
   isolation was enforced or behavioral only.

The repair is complete only when this fresh-task user path succeeds. Build, type, or
unit-test results alone are insufficient.

## Completion criteria

- Only Codex package and routing paths remain supported.
- The plugin installs from the repository marketplace and is discovered after a full
  restart in a new task.
- The configured three roles route exactly and fail closed.
- The Luna app-task lane remains explicit-only.
- Mandatory checks work on the target Windows machine without requiring `sh`.
- Release, cachebuster, and runtime version identities are internally consistent.
- Historical contradictory guidance is marked superseded.
- No live acceptance claim is made without observed MCP and child-runtime evidence.
