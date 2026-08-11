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
strict when concrete evidence reveals a strict trigger. The stock invocation wording
about obtaining a fresh advisor review does not itself opt a low-risk task into strict;
review requirements follow this risk policy unless the user separately requests a
strict review.

## Setup and configuration gate

Before the first configured native lane in a parent task, call `get_setup_status` and
`get_preferences`. If setup is `missing`, `schema-old`, or `corrupt`, run the `setup`
interview in the parent chat and stop until it completes. Use the saved workspace from
preferences to call `validate_configuration`. Require valid configuration and
`adapterStatus: "current"`; otherwise stop without a role, model, or effort fallback.

For adaptive low/medium work, retain this as a task-local validation snapshot in the
parent task. Do not persist a new cache or change the MCP schema. Revalidate only when
setup/preferences are changed, adapter state becomes stale or inconsistent, Codex is
restarted into a new parent task, role exposure changes, runtime evidence conflicts,
or the task escalates to strict.

Strict work does not reuse the adaptive snapshot: it follows the complete per-spawn
protocol below.

## Routing

| Work type | Configured native role |
| --- | --- |
| Bounded or mechanical work | `sol_advisor_routine` |
| Complex, security-sensitive, or broad work | `sol_advisor_high` |
| Architecture consultation or final review | `sol_advisor_advisor` |
| Explicit current-request Luna authorization | Codex app-task lane |

Select the native role from work complexity, not from a model family. A configured
routine role may be backed by Luna when that exact model is saved. Model family does not select the execution lane and a saved Luna routine does not authorize the app-task lane.

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

1. Establish the task-local setup/configuration snapshot once using the setup gate
   above.
2. Confirm the selected configured role name is exposed by the collaboration tool.
3. On the first spawn of each configured role in the parent task, inspect public
   runtime details. On Windows, set `$skillDir` to the directory containing this
   `SKILL.md`, resolve the Bun inspector from it, and run it with the UUID returned
   for the native child:

   ```powershell
   $runtimeInspector = [IO.Path]::GetFullPath((Join-Path $skillDir '..\..\scripts\inspect-agent-runtime.ts'))
   bun $runtimeInspector $nativeSubagentThreadId
   ```

4. Compare observed `agent_role`, `model`, and `effort` with the saved preferences.
   Public and local runtime values must agree whenever both are observable.
5. Reuse the verified role/runtime snapshot for later spawns of the same configured
   role in this parent task unless an invalidation condition from the setup gate is
   observed.
6. For `sol_advisor_advisor`, when it is used, capture the observed sandbox policy and
   permission profile on its first spawn. `read-only` is enforced only when the host
   reports it. If it reports `workspace-write` with a managed permission profile,
   describe the review as behaviorally read-only only after checking before-and-after
   repository and artifact state; do not describe it as host-enforced read-only.
7. If role exposure, configuration state, or runtime evidence becomes unavailable or
   inconsistent, invalidate the task-local snapshot and stop the affected lane rather
   than silently falling back.

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
