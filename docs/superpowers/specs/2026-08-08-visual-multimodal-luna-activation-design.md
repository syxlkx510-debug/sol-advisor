# Visual Multimodal Luna Activation Design

## Objective

Allow an explicitly configured Codex profile to create a user-visible GPT-5.6 Luna / Max app task automatically when visual material is necessary for implementation or acceptance, while preserving Sol Advisor's three existing native roles and fail-closed behavior.

The Luna lane remains separate from native subagent V2. It is not a fallback, does not receive a custom-agent TOML, and does not replace `sol_advisor_routine`, `sol_advisor_high`, or `sol_advisor_advisor`.

## User outcome

After the user explicitly enables visual-multimodal activation during setup:

- a request whose implementation or acceptance materially depends on an image, screenshot, or rendered interface may create a Luna / Max Codex app task without requiring the phrase "Use the Luna task lane";
- ordinary text-only implementation, ordinary frontend work, and incidental attachments continue through the configured native routine or high-complexity role;
- the current request can opt out by saying not to use Luna or not to create another task;
- an unavailable Luna lane stops with a concrete explanation and never silently falls back.

## Scope

This change covers:

1. the persisted logical preference that records explicit standing authorization for visual-multimodal activation;
2. setup guidance for obtaining that authorization;
3. orchestration and Luna task-lane contracts for applying the authorization safely;
4. validation and regression tests for the new preference shape and preserved legacy behavior;
5. plugin validation, cachebuster update, reinstall, and a fresh-task integration check.

This change does not:

- add a fourth native role;
- dynamically change the model pinned by an existing native role;
- route raw audio or raw video directly to Luna;
- use Luna for a merely decorative, incidental, or non-essential attachment;
- allow fallback to another model, effort, role, or lane;
- change the parent task's selected model or reasoning setting.

## Persisted preference contract

The existing optional `appTaskLane` preference gains an optional activation field:

```json
{
  "enabled": true,
  "model": "gpt-5.6-luna",
  "effort": "max",
  "activation": "visual-required"
}
```

Allowed activation values are:

- `explicit`: create a Luna task only when the current request explicitly asks for the Luna task lane;
- `visual-required`: the setup choice is standing authorization to create a Luna task when the current request satisfies the visual-required routing rules.

Compatibility rules:

- an existing saved `appTaskLane` without `activation` is interpreted as `explicit`;
- saving a newly interviewed visual-multimodal profile persists `visual-required` exactly;
- the existing configuration schema version remains valid because the new field is optional and legacy semantics are preserved;
- `gpt-5.6-luna` and `max` remain fixed by the app-task-lane contract rather than guessed or normalized from another value.

## Setup and authorization

Setup continues to run in the parent chat and asks one focused question at a time. When the user enables the Codex Luna lane, setup must distinguish:

1. explicit activation for individual requests; or
2. standing visual-required activation.

Before saving, setup shows the complete logical preference object including `activation`. The existing preview and exact-token installation gates remain unchanged.

The current user has explicitly chosen `visual-required` for the project profile at `G:\Codex_Projects\sol-advisor`. This authorization is limited to qualifying Luna task creation and does not authorize unrelated external actions, PR creation, pushing, merging, or model fallback.

## Routing rules

Orchestration loads setup status and current preferences on every invocation. It must not rely on remembered defaults.

### Qualifying request

`visual-required` activates only when all of the following are true:

1. the active client is Codex;
2. the saved app task lane is enabled with `activation: "visual-required"`;
3. an image, screenshot, or rendered interface is a material input to implementation or acceptance;
4. the current request does not opt out of Luna or task creation;
5. the required Codex app task tools and the exact Luna / Max route are available.

Examples that qualify include implementing against an attached screenshot, correcting a visual defect that must be inspected in a rendered interface, or validating implementation fidelity against a supplied image.

### Non-qualifying request

The Luna lane does not activate for:

- text-only backend, configuration, or documentation work;
- ordinary frontend implementation with no material visual input;
- an image attached only as context or decoration;
- a request that only asks for an explanation of an image and does not need a separate implementation task;
- raw audio or raw video without an accepted visual-frame workflow;
- an ambiguous case where the primary task cannot establish that visual material is necessary;
- any request that explicitly opts out.

Ambiguity defaults to no automatic task creation. The primary task may ask one focused question when the routing choice materially affects the requested outcome.

## Execution flow

For a qualifying request:

1. load and validate the saved profile;
2. read the Luna task-lane contract;
3. verify that all required app task tools are exposed;
4. list projects and resolve the intended project from an observed `projectId` and `isGitRepository` value;
5. construct the complete Luna task packet, including owned files, starting state, verification, git boundaries, and PR prohibition;
6. create a user-visible task with model `gpt-5.6-luna` and thinking `max`;
7. monitor and read the real task identity;
8. inspect the actual worktree, branch, diff, and verification evidence in the primary task;
9. send corrections back to the same task when needed;
10. accept the result only after primary verification.

For a non-qualifying request, use the existing configured native routine or high-complexity role. The advisor and final-review behavior remain unchanged.

## Failure behavior

The lane is fail-closed:

- missing setup, corrupt preferences, unavailable Luna, unavailable Max, missing app tools, unresolved project identity, or unobservable task identity stops the lane;
- the response names the failed precondition and does not claim that a task was created;
- no other model, reasoning effort, native role, or app lane is substituted;
- no restart loop is prescribed merely because a runtime model list changed;
- if a client reload is genuinely required after adapter or plugin installation, it is requested once with the specific discovery reason.

## Components and files

The implementation is expected to update:

- `plugins/sol-advisor/mcp/server.ts` for the optional activation preference and validation;
- `plugins/sol-advisor/mcp/server.test.ts` for persistence, validation, and backward compatibility;
- `plugins/sol-advisor/skills/setup/SKILL.md` for explicit standing authorization and complete-object preview;
- `plugins/sol-advisor/skills/orchestration/SKILL.md` for visual-required lane selection and per-request opt-out;
- `plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md` for the normative authorization and routing contract;
- validation tests or scripts that assert the packaged skill contract;
- plugin version and cachebuster metadata only through the existing validated update flow.

Existing unrelated Windows ACL, MCP discovery, Cursor, and private-directory changes in the dirty worktree must be preserved and not reverted or committed as part of this feature unless a feature test necessarily touches the same file.

## Test strategy

Implementation follows test-driven development.

### Preference tests

- saving `activation: "visual-required"` returns and persists that exact value;
- saving `activation: "explicit"` preserves explicit-only behavior;
- a legacy stored lane without `activation` validates and is interpreted as explicit-only;
- unknown activation values are rejected;
- Luna remains fixed to `gpt-5.6-luna` and `max`;
- fallback arrays remain empty and the policy remains fail-closed.

### Contract tests

- packaged setup guidance requires a complete preference preview containing activation;
- packaged orchestration guidance defines all qualifying conditions and non-qualifying exclusions;
- the current-request opt-out takes precedence over standing authorization;
- the Luna contract forbids implicit fallback and preserves primary verification;
- the three native role names and adapter contents remain unchanged by this feature.

### Integration verification

- run the focused MCP and validation tests first;
- run the full project test suite and plugin validator;
- update the plugin cachebuster with the supported helper and reinstall the local plugin;
- start a fresh Codex task only after installation so packaged skill discovery can be observed;
- verify one qualifying visual implementation request and one non-qualifying text-only request without claiming success from static files alone.

The integration check must report whether a real Luna task was created and routed with observable evidence. If the app does not expose enough runtime evidence, the lane remains unverified rather than being described as working.

## Acceptance criteria

The feature is accepted only when:

1. the new preference round-trips through `save_preferences` and `get_preferences`;
2. legacy profiles remain explicit-only;
3. setup renders the exact complete logical object before saving;
4. qualifying visual-required requests are authorized by the stored setting and follow the Luna app-task contract;
5. non-qualifying and opted-out requests remain on native lanes;
6. unavailable Luna routing stops without fallback or restart loops;
7. all focused and full validations pass;
8. packaged plugin contents match the source after cachebuster update and reinstall;
9. at least one fresh-task user path is checked with real runtime evidence, or is honestly reported as blocked.
