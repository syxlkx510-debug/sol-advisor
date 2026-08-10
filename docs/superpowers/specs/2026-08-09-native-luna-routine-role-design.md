# Native Luna Routine Role Design

> **Partially Superseded:** The active Codex-only design is
> [Codex-Only Sol Advisor Repair Design](2026-08-09-codex-only-sol-advisor-repair-design.md).
> Keep only the historical reference to the explicit separation between the native routine role and the opt-in app-task lane.
> Cross-client, compatibility-role, and automatic visual Luna decisions in this document must not be implemented.

## Objective

Allow a user to explicitly select Luna as the model for Sol Advisor's native
`routine` role while preserving the separate, opt-in Luna app-task lane.

The two routes are independent:

- the native routine role runs through the installed `sol_advisor_routine` adapter;
- the app-task lane creates and monitors a separate user-visible Codex task;
- choosing Luna for the native routine role does not enable, disable, or implicitly
  select the app-task lane.

## User outcome

A valid project profile may contain both:

```json
{
  "roles": {
    "routine": {
      "model": "gpt-5.6-luna",
      "effort": "max"
    }
  },
  "appTaskLane": {
    "enabled": true,
    "model": "gpt-5.6-luna",
    "effort": "max"
  }
}
```

For a bounded native implementation request, Sol Advisor may invoke
`sol_advisor_routine`; the adapter's exact saved model and effort control the native
role. Sol Advisor selects the app-task lane only when the current request explicitly
authorizes that lane.

## Rules

1. The setup interview continues to require exact client-native model IDs and
   supported reasoning settings. It must not guess, normalize, or substitute Luna.
2. Luna is allowed for the native routine role when the user explicitly selects it.
3. The Luna app-task lane remains separately enabled and current-request opt-in.
4. A Luna model in the routine role is not evidence that the app-task lane was
   selected. Likewise, enabling the app-task lane does not rewrite the routine role.
5. Both routes remain fail-closed. If the selected native role or requested app-task
   route is unavailable, Sol Advisor stops that route without substitution.
6. The native `high` and `advisor` roles, the retained Terra/Sol compatibility lane,
   advisor read-only requirements, and parent verification responsibilities do not
   change.

## Components and changes

### Setup guidance

Update `plugins/sol-advisor/skills/setup/SKILL.md` to remove the prohibition against
using Luna as the native routine model. State instead that routine accepts any exact
user-selected native model, including Luna, while app-task authorization remains a
separate choice.

### Orchestration guidance

Update `plugins/sol-advisor/skills/orchestration/SKILL.md` so lane selection depends
on the requested execution route, not the model family stored in the routine adapter.
The native routine role may therefore be Luna-backed without becoming an app task.

Retain the rule that the Luna app-task lane does not use a Luna custom-agent TOML;
that statement describes the app-task lane only and must not be generalized into a
ban on Luna-backed native roles.

### Public documentation and metadata

Update README and plugin-facing descriptions only where they currently imply that
all Luna use must go through app tasks. Keep descriptions of the explicit app-task
lane accurate without claiming exclusive ownership of the Luna model family.

### Runtime and persisted preferences

No schema migration is required. The MCP already stores exact arbitrary role model
IDs and validates the current profile with Luna as routine. Existing profiles remain
valid and are not rewritten merely because the rule changes.

### Tests

Add or adjust contract coverage to prove that:

- setup explicitly permits a user-selected Luna native routine role;
- orchestration distinguishes a Luna-backed native routine role from the explicit
  Luna app-task lane;
- a profile containing both routes persists and validates;
- rendering the Codex routine adapter preserves the exact Luna model and effort;
- no rule implicitly activates the app-task lane from the routine model;
- fail-closed, advisor read-only, exact-ID, and no-fallback requirements remain.

Tests must avoid requiring a live Luna delegation. Fresh-task runtime routing is a
separate post-install verification step.

## Packaging and rollout

After source tests pass, run repository validation, release checking, and plugin
validation. Refresh the cachebuster and reinstall the local plugin through the
supported plugin workflow. Do not rewrite the already-valid saved profile merely to
apply this policy change.

A fresh Codex task is required only to verify that the reinstalled packaged skills
and native adapter discovery reflect the new rule. It is not evidence that the user
changed the model directory.

## Acceptance criteria

1. The active setup and orchestration skills no longer prohibit Luna as native
   routine.
2. They explicitly distinguish native routine execution from the Luna app-task lane.
3. The current profile with Luna routine plus the enabled app-task lane remains
   `ready` and `valid` without being rewritten.
4. Focused contract tests, the full test suite, validation, release checking, and
   plugin validation pass.
5. The refreshed plugin is installed and a fresh task exposes the updated packaged
   rules.
6. No model or reasoning override is applied by the implementation workflow.
