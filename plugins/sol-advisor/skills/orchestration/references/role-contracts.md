# Configured Codex role contracts

Use these contracts with the saved, configured native roles. They do not change the
parent model or global defaults. Read the [Luna task-lane contract](luna-task-lane.md)
only after the user's current request explicitly authorizes that separate app-task
lane.

## Risk-tier evidence contract

Use the risk tier selected by `SKILL.md` to decide how often setup, runtime, parent
verification, and independent review are repeated.

### Adaptive low and medium risk

Before the first configured native delegation in the parent task:

1. Call `get_setup_status`, require `ready`, and retain the complete non-secret
   preference object returned with that ready state.
2. Call `validate_configuration` for the saved workspace and require
   `adapterStatus=current`.
3. Record the three returned adapter paths and run
   `inspect-adapter-snapshot.ts` to obtain the task-local adapter fingerprint.
4. Spawn the exact configured role with `fork_turns: "none"`. Do not pass `model`,
   `reasoning_effort`, or effort overrides.
5. On the first spawn of each configured role after snapshot creation, compare
   observed role, model, and effort with the saved preferences using the runtime
   evidence protocol in `SKILL.md`. For an advisor spawn, also capture the observed
   sandbox policy and permission profile.

Before every later adaptive native spawn, call `get_setup_status` once, compare the
complete returned preferences with the task-local copy, and run the adapter snapshot
inspector with `--expect` and the saved fingerprint. Reuse verified role/runtime
evidence only when both lightweight checks succeed.
A successful reuse therefore has concrete current evidence; it is not based only on
the parent remembering an earlier result.

If preferences differ, the adapter fingerprint differs, a file is missing or unsafe,
or either check is unavailable, invalidate the snapshot. Run
`validate_configuration`, require `adapterStatus=current`, refresh the fingerprint,
and obtain fresh runtime evidence for affected roles. Stop without fallback when the
current state cannot be established.

A reused task-local snapshot is orchestration state only. Do not persist it, write a
new configuration file, weaken the saved fail-closed policy, or use it across a new
parent task.

### Strict risk

Before every native spawn, follow the strict configured native spawn protocol in
`SKILL.md`: require ready setup, saved preferences, `adapterStatus=current`, exact role
exposure, and fresh runtime evidence. Spawn the exact configured role with
`fork_turns: "none"`. Do not pass `model`, `reasoning_effort`, or effort overrides.
Compare the observed role, model, and effort with saved preferences, and stop on absent
or inconsistent evidence. For the reviewer, also capture the observed sandbox policy
and permission profile.

## Worker selections

- Use `sol_advisor_routine` for bounded, mechanical, or fully specified work.
- Use `sol_advisor_high` for complex, security-sensitive, algorithmic, debugging, or
  broad work.

Worker selection is based on implementation complexity. Verification intensity is
based on risk tier, so a `sol_advisor_high` implementation may still use medium-risk
verification when the change is reversible and project-local.

Both worker selections receive this complete packet. Replace every placeholder and do
not omit a section. Spawn `sol_advisor_routine` or `sol_advisor_high` with
`fork_turns: "none"`; the worker must not rely on inherited history because this
complete packet is its only context.

```text
OBJECTIVE
<Observable outcome and why it matters.>

FILES AND OWNERSHIP
You own only:
- <exact file or module>

You are not alone in the codebase. Other agents or the user may edit concurrently.
Preserve their edits, do not revert unrelated work, and adapt to changes already
present. Do not modify files outside your ownership.

INTERFACES
- <Signatures, types, schemas, commands, or behavior that must remain compatible.>

CONSTRAINTS
- <Repository conventions, safety boundaries, excluded scope, and settled decisions.>

VERIFICATION
- Run: <exact targeted command appropriate to this worker's change>
  Success: <concrete expected result>
- Inspect: <exact file, diff, or generated artifact>
  Success: <concrete expected evidence>

RETURN
Return exact commands and actual evidence. A completion claim without evidence is
invalid.

IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
OBJECTIVE: <one-line restatement>
CHANGES: <file-by-file summary from the actual diff>
VERIFIED: <exact commands plus concrete output evidence>
JUDGMENT CALLS: <decisions the specification left open, or none>
GAPS: <unfinished work, ambiguity, or none>
```

The parent always inspects the actual diff and changed-file scope after every worker
report. Treat the worker's verification report as evidence, not as permission to skip
inspection.

## Verification by risk tier

### Low risk

The worker runs the packet's targeted verification. The parent inspects the actual
diff, ownership boundaries, and returned evidence. The parent does not rerun the full
verification suite and does not require a final advisor by default.

Escalate to medium or strict before acceptance when the diff exceeds the bounded
packet, verification is missing or contradictory, the worker changed an interface the
packet said to preserve, or new risk becomes visible.

### Medium risk

Each worker runs targeted verification for its own change. The parent inspects every
actual diff and accumulates the change set. Normally run broader parent verification
once when the implementation reaches a coherent milestone or is ready for final
review, rather than after every worker iteration.

After that broader parent verification, obtain one fresh `sol_advisor_advisor` review
of the accumulated change set before acceptance. If several worker corrections can be
batched safely, make those corrections before requesting the next final advisor pass.
Any code change after an advisor verdict invalidates that verdict for final acceptance.

### Strict risk

Preserve the 0.6.0 fail-closed behavior.
The parent reruns the specified verification after every worker report. After parent
verification, spawn a fresh `sol_advisor_advisor` with `fork_turns: "none"` and fresh
strict runtime evidence. If the verdict is `fix-first`, delegate a corrected bounded
packet to the configured worker selected by complexity, rerun parent verification,
and obtain a new fresh advisor review. If the verdict is `rethink`, revise the
architecture before continuing. A reviewer verdict is invalid after any code change.

## Configured reviewer packet

Whenever medium or strict policy requires an advisor review, spawn
`sol_advisor_advisor` with `fork_turns: "none"` using the applicable runtime evidence
protocol. Do not pass `model`, `reasoning_effort`, or effort overrides. The reviewer
must remain behaviorally read-only, inspect the actual files and accumulated change
set, never implement fixes, and must not rely on inherited history: the complete
reviewer packet below is its only context and produces a fresh independent review.

```text
STATED GOAL
<The user's requested outcome.>

ACCUMULATED CHANGE SET
<Exact allowed files plus complete working-tree diff, or explicit base/head revisions.>

INTERFACES AND CONSTRAINTS
- <Compatibility, repository rules, safety boundaries, and excluded scope.>

VERIFICATION EVIDENCE
- <command> -> <actual parent-session output evidence>
- <artifact or diff inspection> -> <actual evidence>

REVIEW
Inspect the actual files and accumulated change set. Judge correctness, completeness,
regressions, scope discipline, interface preservation, test adequacy, and material risk.

VERDICT: ship | fix-first | rethink
REASON: <decisive evidence-based reason>
FINDINGS: <precise file references and required fixes, or none>
RESIDUAL RISK: <most important remaining risk, or none>
```

Use observed isolation rather than requested isolation. With an observed `read-only`
sandbox, report enforced isolation. With broader host access, proceed only when hard
isolation is not required, the reviewer is instructed not to edit, and the parent
captures before-and-after repository and artifact state. Report the actual sandbox
policy and permission profile; do not upgrade behavioral non-mutation to enforcement.

## Observability contract

Track observed orchestration counts while the task runs. The final summary must report
the selected risk tier, configured role spawns, Luna app tasks, full and lightweight
configuration checks, successful snapshot reuses, runtime inspections, parent
verification runs, corrections, and escalations. Do not estimate missing counts or
present request counts as token measurements.
