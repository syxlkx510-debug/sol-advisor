# Native Luna Routine Role Implementation Plan

> **Partially Superseded:** The active Codex-only design is
> [Codex-Only Sol Advisor Repair Design](../specs/2026-08-09-codex-only-sol-advisor-repair-design.md).
> Keep only the historical reference to the explicit separation between the native routine role and the opt-in app-task lane.
> Cross-client, compatibility-role, and automatic visual Luna decisions in this document must not be implemented.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit an explicitly selected Luna model for the native `routine` role while keeping the Luna app-task lane separate, explicit, and fail-closed.

**Architecture:** Preserve the existing exact-model preference schema and adapter renderer because they already accept and render Luna for routine. Change the normative setup/orchestration contract and public README, then add contract and MCP characterization tests that prove a Luna-backed native role does not implicitly select the app-task lane.

**Tech Stack:** Bun 1.3.x, TypeScript, Bun test, Markdown skill contracts, Codex plugin packaging and cachebuster workflow.

---

### Task 1: Add the failing native-Luna contract test

**Files:**
- Modify: `tools/luna-explicit-contract.test.ts`
- Test: `tools/luna-explicit-contract.test.ts`

- [ ] **Step 1: Add a test that expresses the approved policy**

Append this test inside the existing `describe("explicit Luna task contract", ...)` block:

```ts
 test("allows an explicitly selected Luna native routine without selecting the app-task lane",()=>{
  const setup=read("skills","setup","SKILL.md");
  const skill=read("skills","orchestration","SKILL.md");
  const readme=readFileSync(join(import.meta.dir,"..","README.md"),"utf8");
  expect(setup).toContain("including Luna");
  expect(setup).toContain("does not enable or select the app-task lane");
  expect(setup).not.toContain("never a fallback or a routine native role");
  expect(skill).toContain("may be backed by Luna");
  expect(skill).toContain("Model family does not select the execution lane");
  expect(readme).toContain("A native routine role may use Luna");
  expect(readme).toContain("does not authorize the Luna app-task lane");
 });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
bun test tools/luna-explicit-contract.test.ts
```

Expected: the new test fails because setup still contains `never a fallback or a routine native role` and the approved positive contract text is absent.

### Task 2: Update setup, orchestration, and README contracts

**Files:**
- Modify: `plugins/sol-advisor/skills/setup/SKILL.md`
- Modify: `plugins/sol-advisor/skills/orchestration/SKILL.md`
- Modify: `README.md`
- Test: `tools/luna-explicit-contract.test.ts`

- [ ] **Step 1: Replace the setup prohibition with independent-route guidance**

Replace setup item 8 with:

```markdown
8. Preserve the optional Codex app-task lane separately. Enable Luna / Max app tasks
   only after explicit opt-in. The native routine role may use any exact
   user-selected client-native model, including Luna; choosing Luna for routine does
   not enable or select the app-task lane. Neither route is a fallback for the other.
```

- [ ] **Step 2: Make orchestration lane selection independent of model family**

Replace the native/app-lane overview paragraph with:

```markdown
Act as the architect. Own the user's intent, architecture, decomposition, complete
task specification, parent verification, and final acceptance. The default native
lane delegates implementation to the configured routine or high-complexity role and
requires the configured advisor verdict. A native routine role may be backed by Luna
when that exact model was explicitly saved. The explicit Luna task lane instead
creates a separate user-visible Codex app task at GPT-5.6 Luna / Max; the primary task
monitors, reviews, corrects, authorizes PR creation, and orders dependent stacks.
Model family does not select the execution lane. The app-task lane is outside native
subagent V2, does not use a Luna app-task custom-agent TOML, and is never activated
implicitly.
```

Add this paragraph immediately after the configured native role names in `Choose a lane`:

```markdown
The saved routine model may be Luna. Invoke `sol_advisor_routine` for native routine
work regardless of model family; do not reinterpret that saved model as app-task
authorization. Select the Luna app-task lane only from the current request's explicit
execution-route authorization.
```

- [ ] **Step 3: Correct the README first-use and routing explanations**

Replace the first-use Luna paragraph with:

```markdown
These are editable recommendations, not a universal model catalog. Sol Advisor never
guesses, normalizes, silently falls back, or claims a model exists in another client.
A native routine role may use Luna when the user copies and saves that exact native
model ID. This does not authorize the Luna app-task lane, which remains a distinct
current-request opt-in for a separate user-visible `gpt-5.6-luna` / Max task.
```

Replace the orchestration compatibility paragraph with:

```markdown
The historical exact Codex compatibility lane remains available as separately
installed Terra / High implementation and Sol / High review profiles. It does not
use a Luna companion TOML. Configured cross-client native roles are independent and
may use any exact saved model, including Luna. The Luna app-task lane instead uses
app task tools and remains outside native subagent V2.
```

- [ ] **Step 4: Run the focused contract test and verify GREEN**

Run:

```powershell
bun test tools/luna-explicit-contract.test.ts
```

Expected: all tests in the file pass with zero failures.

- [ ] **Step 5: Commit the contract change**

Stage only these files and commit:

```powershell
git add -- tools/luna-explicit-contract.test.ts plugins/sol-advisor/skills/setup/SKILL.md plugins/sol-advisor/skills/orchestration/SKILL.md README.md
git commit -m "docs: allow Luna for native routine roles"
```

### Task 3: Characterize persisted Luna routine behavior

**Files:**
- Modify: `plugins/sol-advisor/mcp/server.test.ts`
- Test: `plugins/sol-advisor/mcp/server.test.ts`

- [ ] **Step 1: Add an MCP persistence and rendering test**

Insert this test after `keeps the explicit Luna task lane and rejects activation routing`:

```ts
 test("persists Luna routine independently of the explicit app-task lane",async()=>{
  const candidate:any=base();
  candidate.roles.routine={model:"gpt-5.6-luna",effort:"max"};
  candidate.appTaskLane={enabled:true};
  const saved:any=await callTool("save_preferences",candidate);
  expect(saved.preferences.roles.routine).toEqual({model:"gpt-5.6-luna",effort:"max"});
  expect(saved.preferences.appTaskLane).toEqual({enabled:true,model:"gpt-5.6-luna",effort:"max"});
  const preview:any=await callTool("render_client_adapter",{workspace});
  const routine=preview.files.find((file:any)=>file.role==="routine");
  expect(routine.content).toContain('model = "gpt-5.6-luna"');
  expect(routine.content).toContain('model_reasoning_effort = "max"');
 });
```

- [ ] **Step 2: Run the focused MCP test**

Run:

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts
```

Expected: every server test passes. This is characterization coverage for existing runtime behavior; Task 1 supplied the required RED test for the policy change.

- [ ] **Step 3: Commit the characterization test**

```powershell
git add -- plugins/sol-advisor/mcp/server.test.ts
git commit -m "test: cover native Luna routine profiles"
```

### Task 4: Run complete source verification

**Files:**
- Verification only

- [ ] **Step 1: Run the full Bun test suite**

Run:

```powershell
bun run test
```

Expected: all configured tests pass with zero failures.

- [ ] **Step 2: Run repository validation**

Run:

```powershell
bun run validate
```

Expected: `PASS: validate`.

- [ ] **Step 3: Run extracted-package verification**

Run:

```powershell
bun run release:check
```

Expected: `PASS: release-check` and no retained temporary release directory.

- [ ] **Step 4: Run plugin validation**

Run:

```powershell
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: `Plugin validation passed`.

- [ ] **Step 5: Check the complete diff**

Run:

```powershell
git diff --check HEAD~2..HEAD
git status --short
```

Expected: no whitespace errors and no uncommitted source changes.

### Task 5: Refresh and reinstall the local plugin

**Files:**
- Modify through helper: `plugins/sol-advisor/.codex-plugin/plugin.json`
- Modify: `plugins/sol-advisor/plugin.json`
- Modify: `package.json`
- External managed state: `C:\Users\SYX001\.codex\plugins\cache\sol-advisor`

- [ ] **Step 1: Read the plugin-creator skill before changing packaging metadata**

Read:

```text
C:\Users\SYX001\.codex\skills\.system\plugin-creator\SKILL.md
```

Follow its existing-plugin cachebuster and reinstall workflow exactly.

- [ ] **Step 2: Refresh the cachebuster**

Run:

```powershell
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\update_plugin_cachebuster.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: the helper writes a version beginning with `0.5.0+codex.` followed by a new 14-digit UTC value in `.codex-plugin/plugin.json`.

- [ ] **Step 3: Synchronize the emitted version without changing other metadata**

Read the exact `version` from `plugins/sol-advisor/.codex-plugin/plugin.json`. Use `apply_patch` to replace only the version string in:

```text
plugins/sol-advisor/plugin.json
package.json
```

All three version strings must be byte-for-byte identical.

- [ ] **Step 4: Re-run packaging verification**

Run:

```powershell
bun run test
bun run validate
bun run release:check
python "C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" "G:\Codex_Projects\sol-advisor\plugins\sol-advisor"
```

Expected: every command exits zero with no test failures or validation errors.

- [ ] **Step 5: Commit the cachebuster refresh**

```powershell
git add -- plugins/sol-advisor/.codex-plugin/plugin.json plugins/sol-advisor/plugin.json package.json
git commit -m "chore: refresh native Luna routine plugin"
```

- [ ] **Step 6: Reinstall through the configured local marketplace**

Run the current versioned Codex CLI with `CODEX_HOME=C:\Users\SYX001\.codex`:

```text
codex plugin add sol-advisor@sol-advisor
```

Expected: the installed cache uses the new cachebuster and contains the updated setup and orchestration skill files. Existing MCP entries and saved profile data remain present.

### Task 6: Verify the installed package and stop at the reload boundary

**Files:**
- Verification only

- [ ] **Step 1: Compare installed rule text with the source**

Locate the cache directory whose name matches the new cachebuster and compare these files byte-for-byte with the source plugin:

```text
skills/setup/SKILL.md
skills/orchestration/SKILL.md
```

Expected: both comparisons match.

- [ ] **Step 2: Verify saved configuration was not rewritten**

Call `get_setup_status` and `validate_configuration` through `sol-advisor-local`.

Expected: `status=ready`, `valid=true`, routine remains `gpt-5.6-luna` / `max`, the app-task lane remains enabled, and no save/install tool is called.

- [ ] **Step 3: Verify the repository state**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -5
```

Expected: branch `codex/native-luna-routine`, clean worktree, and separate commits for the design, policy change, characterization test, and cachebuster refresh.

- [ ] **Step 4: Request one Codex reload for packaged skill discovery**

Ask the user to restart or reload Codex once, with the specific reason that the installed packaged skill text changed. Do not attribute this to the user changing models and do not prescribe a restart loop.

After reload, inspect the active installed skill files and confirm the native Luna routine rule is discoverable before reporting end-to-end completion.
