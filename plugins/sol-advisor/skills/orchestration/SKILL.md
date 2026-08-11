---
name: orchestration
description: "Codex-only architect workflow that uses saved routine, high, and advisor roles, with a separate explicit Luna app-task lane."
---

# Sol Advisor Orchestration

Act as the architect. Own the user's intent, settled architecture, decomposition,
complete task packet, parent verification, and final acceptance. The parent session
inherits its own selected model and effort; this skill never changes them.

## Risk policy

Adaptive orchestration is the default. Risk tier controls verification intensity;
implementation complexity still controls whether work uses `sol_advisor_routine` or
`sol_advisor_high`. A complex task is not automatically strict merely because it uses
the high role.

Use these tiers:

- **Low risk**: bounded local edits with small blast radius and no persistent or
  external side effects, such as UI/CSS, copy, tests, small components, and fully
  specified mechanical refactors.
- **Medium risk**: multi-file features, local APIs, data-shape changes, agent/workflow
  logic, algorithmic work, or debugging that remains reversible inside the project.
- **Strict**: use the full fail-closed protocol when the user explicitly asks for
  strict review, or when work touches authentication, authorization, secrets,
  permissions, destructive or bulk filesystem operations, database migrations,
  deployment/release/installers, dependency or supply-chain security, MCP/plugin
  discovery, role adapters/routing, Sol Advisor configuration, or similarly
  irreversible/high-blast-radius behavior.

When the tier is genuinely unclear, choose medium rather than strict. Escalate to
strict when concrete evidence reveals a strict trigger. A direct request for an
advisor review adds the requested review at the selected low or medium tier but does
not by itself force strict per-spawn validation. Only a direct strict-review request or
a strict risk trigger selects the strict protocol.

## Setup and configuration gate

### Adaptive low and medium risk

Before the first configured native lane in a parent task, call `get_setup_status`.
When it reports `ready`, use the non-secret preferences returned with that ready state.
If setup is `missing`, `schema-old`, or `corrupt`, run the `setup` interview in the
parent chat and stop until it completes. Call `validate_configuration` once for the
saved workspace and require valid configuration plus `adapterStatus: "current"`;
otherwise stop without a role, model, or effort fallback.

Create a task-local validation snapshot containing all of the following observed
values:

- the complete returned preference object, including `profileKey`, `workspace`,
  `updatedAt`, `pluginVersion`, and exact role model/effort values;
- the three adapter paths returned by `validate_configuration`;
- one adapter fingerprint from `inspect-adapter-snapshot.ts`.

On Windows, set `$skillDir` to the directory containing this `SKILL.md`, resolve the
snapshot inspector, and pass the exact three adapter paths returned by validation:

```powershell
$adapterSnapshotInspector = [IO.Path]::GetFullPath((Join-Path $skillDir '..\..\scripts\inspect-adapter-snapshot.ts'))
bun $adapterSnapshotInspector $routineAdapterPath $highAdapterPath $advisorAdapterPath
```

Keep the returned lowercase SHA-256 fingerprint only in the current parent task. Do
not persist a new cache or change the MCP schema.

Before every later configured native spawn in adaptive work:

1. Call `get_setup_status` once and require `ready`.
2. Compare the newly returned complete preference object with the task-local snapshot.
3. Run the adapter inspector against the same three paths with the saved fingerprint:

   ```powershell
   bun $adapterSnapshotInspector --expect $adapterFingerprint $routineAdapterPath $highAdapterPath $advisorAdapterPath
   ```

4. Reuse the snapshot only when the preferences are unchanged and the inspector exits
   successfully with `matches_expected: true`.
5. If either check differs or becomes unavailable, invalidate the snapshot, call
   `validate_configuration`, and require `adapterStatus: "current"` before refreshing
   the snapshot. The next spawn of each affected role must obtain fresh runtime
   evidence. Stop rather than silently falling back when current state cannot be
   established.

A new parent task, Codex restart, setup change, adapter change, role-exposure change,
runtime conflict, or escalation to strict invalidates the adaptive snapshot.

### Strict risk

Strict work does not reuse the adaptive snapshot. Before every configured native
spawn, use the complete strict protocol below.

## Routing

| Work type | Configured native role |
| --- | --- |
| Bounded or mechanical work | `sol_advisor_routine` |
| Complex, security-sensitive, or broad work | `sol_advisor_high` |
| Architecture consultation or final review | `sol_advisor_advisor` |
| Explicit current-request Luna authorization | Codex app-task lane |

Select the native role from work complexity, not from a model family. A configured
routine role may be backed by Luna when that exact model is saved. Model family does
not select the execution lane and a saved Luna routine does not authorize the app-task
lane.

## Configured native spawn protocol

All configured native roles use this spawn shape:

```text
agent_type: <the exact configured role>
fork_turns: "none"
```

Do not pass `model`, `reasoning_effort`, or effort overrides. `fork_turns: "none"`
is required: the configured role file alone controls its saved model and effort, and
the spawn starts with independent context.

### Adaptive protocol

For low and medium risk work:

1. Establish and verify the task-local configuration snapshot using the adaptive gate
   above.
2. Confirm the selected configured role name is exposed by the collaboration tool.
3. On the first spawn of each configured role in the parent task after the snapshot is
   created or refreshed, inspect public runtime details. On Windows, resolve the Bun
   inspector from `$skillDir` and run it with the UUID returned for the native child:

   ```powershell
   $runtimeInspector = [IO.Path]::GetFullPath((Join-Path $skillDir '..\..\scripts\inspect-agent-runtime.ts'))
   bun $runtimeInspector $nativeSubagentThreadId
   ```

4. Compare observed `agent_role`, `model`, and `effort` with the saved preferences.
   Public and local runtime values must agree whenever both are observable.
5. Reuse the verified role/runtime snapshot for later spawns of the same configured
   role only while the lightweight configuration and adapter fingerprint checks keep
   succeeding.
6. For `sol_advisor_advisor`, when it is used, capture the observed sandbox policy and
   permission profile on its first spawn after snapshot creation or refresh.
   `read-only` is enforced only when the host reports it. If it reports
   `workspace-write` with a managed permission profile, describe the review as
   behaviorally read-only only after checking before-and-after repository and artifact
   state; do not describe it as host-enforced read-only.
7. If role exposure, configuration state, adapter fingerprint, or runtime evidence
   becomes unavailable or inconsistent, invalidate the snapshot and stop the affected
   lane rather than silently falling back.

### Strict protocol

Before every configured native spawn in strict work, complete this sequence and fail
closed on any missing or inconsistent evidence:

1. Call `get_setup_status` and `get_preferences`; require ready setup and a saved
   Codex preference profile.
2. Call `validate_configuration` for the saved workspace.
3. Require `adapterStatus=current`.
4. Confirm the exact configured role name is exposed by the collaboration tool.
5. Spawn the exact configured role with the required `fork_turns: "none"` shape and
   without model or effort overrides.
6. Run `inspect-agent-runtime.ts` for the returned child thread id.
7. Compare observed `agent_role`, `model`, and `effort` with the saved preferences.
8. For `sol_advisor_advisor`, capture sandbox policy and permission profile and report
   host-enforced versus behaviorally read-only isolation accurately.
9. Stop the lane when role exposure, adapter state, runtime values, sandbox evidence,
   or permission evidence is unavailable or inconsistent.

The configured role file, not the spawn call, owns the saved model and effort.

## Delegation and review

Read [the configured role contracts](references/role-contracts.md) before the first
configured native delegation in a session. Give every worker a complete bounded packet
with file ownership. State that it is not alone in the codebase, must preserve
concurrent edits, and must adapt to changes already present. A full packet is their
only context; workers and reviewers must not rely on inherited history.

Keep requirements resolution, architecture, interface decisions, actual diff
inspection, correction decisions, and final acceptance in the parent session. Treat
worker reports as claims and inspect the actual diff plus changed-file scope after
every worker.

Verification and review follow the risk tier:

- **Low risk**: require the worker to run the packet's targeted verification. The
  parent inspects the actual diff and evidence. Do not rerun the full verification or
  spawn `sol_advisor_advisor` by default. Escalate when evidence is weak, the diff
  exceeds ownership, or new risk appears.
- **Medium risk**: workers run targeted verification after their own changes. The
  parent inspects every diff, but normally reruns the broader verification once at a
  milestone or after the accumulated implementation is ready. Then obtain one fresh
  `sol_advisor_advisor` review of the accumulated change set before acceptance.
  Corrections happen before the next final review whenever practical, so several
  worker iterations do not each force their own advisor pass.
- **Strict**: preserve the 0.6.0 fail-closed behavior. The parent reruns the specified
  verification after every worker report. After parent verification, final native
  review always uses a fresh `sol_advisor_advisor`. A `fix-first` correction is
  delegated to the configured worker selected by complexity, parent verification is
  rerun, and a new fresh advisor review is required because any code change
  invalidates the previous verdict.

For any correction, use `sol_advisor_routine` or `sol_advisor_high` again according to
the corrected work's complexity. Do not silently repair a child result in the parent
or substitute a different role.

## Orchestration summary

Before the final user-facing completion message, report a compact summary using only
observed counts. Do not estimate unavailable data and do not claim token savings from
request counts alone.

```text
ORCHESTRATION SUMMARY
Risk tier: low | medium | strict
Configured role spawns: routine=<n>, high=<n>, advisor=<n>
Luna app tasks: <n>
Configuration checks: full=<n>, lightweight=<n>, snapshot_reuses=<n>
Runtime inspections: <n>
Parent verification: targeted=<n>, broader=<n>
Corrections: <n>
Escalations: <none or concise reason>
```

A lightweight check means one ready `get_setup_status` comparison plus one successful
adapter fingerprint comparison. A snapshot reuse counts only when both checks pass.
Keep this summary separate from correctness claims and verification evidence.

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
