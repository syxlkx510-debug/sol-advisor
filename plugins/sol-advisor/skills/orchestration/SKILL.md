---
name: orchestration
description: "Codex-only architect workflow that uses saved routine, high, and advisor roles, with a separate explicit Luna app-task lane."
---

# Sol Advisor Orchestration

Act as the architect. Own the user's intent, settled architecture, decomposition,
complete task packet, parent verification, and final acceptance. The parent session
inherits its own selected model and effort; this skill never changes them.

## Setup and configuration gate

Before selecting any native lane, call `get_setup_status` and `get_preferences`. If
setup is `missing`, `schema-old`, or `corrupt`, run the `setup` interview in the
parent chat and stop until it completes. Use the saved workspace from preferences to
call `validate_configuration`. Require valid configuration and
`adapterStatus: "current"`; otherwise stop without a role, model, or effort fallback.

## Routing

| Work type | Configured native role |
| --- | --- |
| Bounded or mechanical work | `sol_advisor_routine` |
| Complex, security-sensitive, or broad work | `sol_advisor_high` |
| Architecture consultation or final review | `sol_advisor_advisor` |
| Explicit current-request Luna authorization | Codex app-task lane |

Select the native role from work complexity, not from a model family. A configured
routine role may be backed by Luna when that exact model is saved. Model family does not select the execution lane and a saved Luna routine does not authorize the app-task lane.

## Required configured native spawn protocol

Before every configured native spawn, complete this sequence and fail closed on any
missing or inconsistent evidence:

1. Call `get_setup_status` and `get_preferences`; require ready setup and a saved
   Codex preference profile.
2. Call `validate_configuration` for the saved workspace.
3. Require `adapterStatus=current`.
4. Confirm the exact configured role name is exposed by the collaboration tool.
5. Spawn that exact role with this shape:

   ```text
   agent_type: <the exact configured role>
   fork_turns: "none"
   ```

   Do not pass `model`, `reasoning_effort`, or effort overrides. `fork_turns: "none"`
   is required: the configured role file alone controls its saved model and effort,
   and the spawn starts with independent context.
6. Inspect public runtime details first. On Windows, set `$skillDir` to the directory
   containing this `SKILL.md`, resolve the Bun inspector from it, and run it with the
   UUID returned for the native child:

   ```powershell
   $runtimeInspector = [IO.Path]::GetFullPath((Join-Path $skillDir '..\..\scripts\inspect-agent-runtime.ts'))
   bun $runtimeInspector $nativeSubagentThreadId
   ```

7. Compare observed `agent_role`, `model`, and `effort` with the saved preferences.
   Public and local runtime values must agree whenever both are observable.
8. For `sol_advisor_advisor`, capture the observed sandbox policy and permission
   profile. `read-only` is enforced only when the host reports it. If it reports
   `workspace-write` with a managed permission profile, describe the review as
   behaviorally read-only only after checking before-and-after repository and artifact
   state; do not describe it as host-enforced read-only.
9. Stop the lane when role exposure, adapter state, runtime values, sandbox evidence,
   or permission evidence is unavailable or inconsistent.

The configured role file, not the spawn call, owns the saved model and effort.

## Delegation and review

Read [the configured role contracts](references/role-contracts.md) before the first
configured native delegation in a session. Give every worker a complete bounded packet
with file ownership. State that it is not alone in the codebase, must preserve
concurrent edits, and must adapt to changes already present. A full packet is their
only context; workers and reviewers must not rely on inherited history.

Keep requirements resolution, architecture, interface decisions, complete diff
inspection, and verification in the parent session. Treat worker reports as claims.
Inspect the actual diff, confirm the changed-file scope, and rerun the specified
verification before acceptance.

For a correction, use `sol_advisor_routine` or `sol_advisor_high` again according to
the corrected work's complexity. Do not silently repair a child result in the parent
or substitute a different role. After parent verification, final native review always
uses a fresh `sol_advisor_advisor`. The reviewer returns `ship`, `fix-first`, or
`rethink` and never implements its own fixes. Corrections and this final fresh advisor
review use the same `fork_turns: "none"` spawn shape and complete packet.

## Explicit Luna app-task lane

Use the Codex app-task lane only when the user's current request explicitly says to
use it. Ordinary implementation work, an earlier authorization, skill activation, or
a saved native Luna routine does not authorize this lane. Even with current-request
authorization, first call `get_setup_status` and `get_preferences`. Require ready
setup and a saved `appTaskLane` with `appTaskLane.enabled=true`,
`model: "gpt-5.6-luna"`, and `effort: "max"`. The MCP stores `appTaskLane` only when
it is enabled, so an absent value is disabled. If the value is absent, false, or
inconsistent, fail closed: do not enable it, write preferences, create a task, or fall
back to a configured native role.

Only after these checks pass, read [the Luna task-lane contract](references/luna-task-lane.md)
and follow it. Keep this lane separate from configured native role routing.
