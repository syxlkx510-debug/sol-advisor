# Configured Codex role contracts

Use these contracts with the saved, configured native roles. They do not change the
parent model or global defaults. Read the [Luna task-lane contract](luna-task-lane.md)
only after the user's current request explicitly authorizes that separate app-task
lane.

## Required configured-role evidence

Before every native spawn, follow the configured native spawn protocol in `SKILL.md`:
require ready setup, saved preferences, `adapterStatus=current`, exact role exposure,
and runtime evidence. Spawn with no model or effort override. Compare the observed
role, model, and effort with saved preferences, and stop on absent or inconsistent
evidence. For the reviewer, also capture the observed sandbox policy and permission
profile.

## Worker selections

- Use `sol_advisor_routine` for bounded, mechanical, or fully specified work.
- Use `sol_advisor_high` for complex, security-sensitive, algorithmic, debugging, or
  broad work.

Both worker selections receive this complete packet. Replace every placeholder and do
not omit a section.

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
- Run: <exact command>
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

The parent inspects the actual diff and reruns verification after every worker report.

## Final configured reviewer

After parent verification, spawn a fresh `sol_advisor_advisor` using the same runtime
evidence protocol. The reviewer must remain behaviorally read-only, inspect the actual
files and accumulated change set, and never implement fixes.

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

If the verdict is `fix-first`, the parent delegates a corrected, bounded packet to the
configured worker selected by complexity, reruns verification, and obtains a new fresh
review. If it is `rethink`, revise the architecture before continuing. A reviewer
verdict is invalid after a change.

Use observed isolation rather than requested isolation. With an observed `read-only`
sandbox, report enforced isolation. With broader host access, proceed only when hard
isolation is not required, the reviewer is instructed not to edit, and the parent
captures before-and-after repository and artifact state. Report the actual sandbox
policy and permission profile; do not upgrade behavioral non-mutation to enforcement.
