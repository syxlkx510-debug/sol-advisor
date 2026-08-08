# Visual Multimodal Luna Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an explicitly authorized `visual-required` Luna activation mode and update Sol Advisor so qualifying visual implementation requests create a user-visible GPT-5.6 Luna / Max app task without changing the three native roles or permitting fallback.

**Architecture:** Extend the existing optional `appTaskLane` preference with an optional activation discriminator while treating legacy absence as explicit-only. Keep semantic classification in the setup/orchestration/Luna contracts, retain Luna outside native subagent V2, and verify the contract with executable Bun tests plus the existing shell/plugin validators.

**Tech Stack:** TypeScript, Bun test, MCP stdio server, Markdown skills/contracts, YAML skill UI metadata, JSON plugin manifests, PowerShell, Python plugin cachebuster/validator, Codex plugin CLI.

---

## Execution constraints

- Work in `G:\Codex_Projects\sol-advisor` on the existing `codex/windows-plugin-data-acl` branch.
- Preserve all pre-existing dirty Windows ACL, MCP discovery, Cursor, manifest, and private-directory changes. Never revert them.
- `plugins/sol-advisor/mcp/server.ts`, `plugins/sol-advisor/mcp/server.test.ts`, `package.json`, and both plugin manifests already contain unrelated uncommitted work. Do not commit those files unless staged-diff inspection proves that only feature hunks are staged.
- Do not spawn subagents unless the user explicitly requests them. Inline execution is the default for this plan.
- Do not save preferences containing model or effort fields while the active Codex session reports a post-start model-catalog change. Source changes and tests may proceed; preference persistence waits for a fresh session.
- Use `git -c safe.directory=G:/Codex_Projects/sol-advisor` for repository commands. Do not modify global Git configuration.
- Use `apply_patch` for repository file edits. Marketplace files and Codex configuration are never hand-edited.

## File map

- Modify `plugins/sol-advisor/mcp/server.ts`: activation type, validation, save normalization, and MCP input schema.
- Modify `plugins/sol-advisor/mcp/server.test.ts`: persistence, legacy compatibility, invalid activation, and unchanged native-adapter assertions.
- Create `tools/luna-activation-contract.test.ts`: executable assertions for packaged setup/orchestration/Luna authorization rules.
- Modify `plugins/sol-advisor/skills/setup/SKILL.md`: interview and complete-object preview requirements.
- Modify `plugins/sol-advisor/skills/orchestration/SKILL.md`: visual-required selection, exclusions, opt-out, and fail-closed routing.
- Modify `plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md`: normative standing-authorization contract.
- Modify `plugins/sol-advisor/skills/orchestration/agents/openai.yaml`: accurate user-visible prompt guidance.
- Modify `plugins/sol-advisor/scripts/verify.sh`: packaged contract markers.
- Modify `package.json`: include the new contract test and synchronize the cachebuster version.
- Modify `plugins/sol-advisor/.codex-plugin/plugin.json`: accurate visual-required description and cachebuster version.
- Modify `plugins/sol-advisor/plugin.json`: accurate visual-required description and synchronized version.

### Task 1: Persist and validate app-task activation

**Files:**
- Modify: `plugins/sol-advisor/mcp/server.test.ts`
- Modify: `plugins/sol-advisor/mcp/server.ts`

- [ ] **Step 1: Add the failing preference tests**

Add these tests inside `describe("configuration", ...)` in `server.test.ts`:

```ts
test("persists app task lane activation", async()=>{
 const visual:any={...base(),appTaskLane:{enabled:true,activation:"visual-required"}};
 const visualSaved:any=await callTool("save_preferences",visual);
 expect(visualSaved.preferences.appTaskLane).toEqual({enabled:true,model:"gpt-5.6-luna",effort:"max",activation:"visual-required"});
 expect((await callTool("get_preferences") as any).appTaskLane.activation).toBe("visual-required");
 const explicit:any={...base(),appTaskLane:{enabled:true,activation:"explicit"}};
 const explicitSaved:any=await callTool("save_preferences",explicit);
 expect(explicitSaved.preferences.appTaskLane.activation).toBe("explicit");
});

test("keeps legacy Luna preferences explicit-only and rejects unknown activation",async()=>{
 const legacy:any=await callTool("save_preferences",{...base(),appTaskLane:{enabled:true}});
 expect(legacy.preferences.appTaskLane).toEqual({enabled:true,model:"gpt-5.6-luna",effort:"max"});
 expect((await callTool("get_setup_status") as any).status).toBe("ready");
 await expect(callTool("save_preferences",{...base(),appTaskLane:{enabled:true,activation:"always"}})).rejects.toThrow("activation");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts
```

Expected: FAIL because `activation` is currently ignored, `visualSaved.preferences.appTaskLane.activation` is missing, and the invalid value is not rejected.

- [ ] **Step 3: Implement the minimal activation contract**

Change the persisted type in `server.ts` to:

```ts
appTaskLane?: {
  enabled: boolean;
  model: "gpt-5.6-luna";
  effort: "max";
  activation?: "explicit" | "visual-required";
};
```

Allow and validate the optional persisted field:

```ts
unknown(value.appTaskLane,["enabled","model","effort","activation"],"appTaskLane");

if (value.appTaskLane !== undefined && (
  value.appTaskLane.enabled !== true ||
  value.appTaskLane.model !== "gpt-5.6-luna" ||
  value.appTaskLane.effort !== "max"
)) errors.push("appTaskLane is an explicit opt-in gpt-5.6-luna/max lane only");
const activation=value.appTaskLane?.activation;
if (activation !== undefined && activation !== "explicit" && activation !== "visual-required") {
  errors.push("appTaskLane activation must be explicit or visual-required");
}
```

Validate the save input before constructing the candidate:

```ts
rejectUnknown(args.appTaskLane,["enabled","activation"],"appTaskLane");
```

Preserve an explicitly supplied activation without adding it to legacy input:

```ts
...(args.appTaskLane?.enabled===true?{
  appTaskLane:{
    enabled:true,
    model:"gpt-5.6-luna",
    effort:"max",
    ...(args.appTaskLane.activation!==undefined?{activation:args.appTaskLane.activation}:{})
  }
}:{})
```

Extend the `save_preferences` input schema:

```ts
appTaskLane:{
  type:"object",
  properties:{
    enabled:{const:true},
    activation:{type:"string",enum:["explicit","visual-required"]}
  },
  required:["enabled"],
  additionalProperties:false
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts
```

Expected: all MCP server tests pass with no new warnings.

- [ ] **Step 5: Add the unchanged-native-adapter regression assertion**

In the existing adapter rendering matrix test, add a profile with:

```ts
p.appTaskLane={enabled:true,model:"gpt-5.6-luna",effort:"max",activation:"visual-required"};
```

Retain these assertions:

```ts
expect(a.files).toHaveLength(3);
expect(a.files.map(file=>file.role)).toEqual(["routine","high","advisor"]);
expect(a.files.some(file=>file.content.includes("gpt-5.6-luna"))).toBe(false);
```

Run the server test again and expect PASS.

- [ ] **Step 6: Inspect the feature diff without staging unrelated changes**

Run:

```powershell
git -c safe.directory=G:/Codex_Projects/sol-advisor diff -- plugins/sol-advisor/mcp/server.ts plugins/sol-advisor/mcp/server.test.ts
```

Expected: the diff contains both pre-existing Windows changes and the new activation hunks. Leave these overlapping files unstaged unless a feature-only cached diff can be proven.

### Task 2: Make the visual-required authorization contract executable

**Files:**
- Create: `tools/luna-activation-contract.test.ts`
- Modify: `plugins/sol-advisor/skills/setup/SKILL.md`
- Modify: `plugins/sol-advisor/skills/orchestration/SKILL.md`
- Modify: `plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md`
- Modify: `plugins/sol-advisor/skills/orchestration/agents/openai.yaml`

- [ ] **Step 1: Create the failing contract test**

Create `tools/luna-activation-contract.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const plugin=join(import.meta.dir,"..","plugins","sol-advisor");
const read=(...parts:string[])=>readFileSync(join(plugin,...parts),"utf8");

describe("visual-required Luna contract",()=>{
 test("setup records standing activation in the complete preference preview",()=>{
  const setup=read("skills","setup","SKILL.md");
  expect(setup).toContain('activation: "visual-required"');
  expect(setup).toContain("standing authorization");
  expect(setup).toContain("complete logical preference object");
 });

 test("orchestration routes only material visual implementation and honors opt-out",()=>{
  const skill=read("skills","orchestration","SKILL.md");
  expect(skill).toContain('activation: "visual-required"');
  expect(skill).toContain("material input to implementation or acceptance");
  expect(skill).toContain("current request opts out");
  expect(skill).toContain("Ambiguity defaults to no automatic task creation");
  expect(skill).toContain("never use it as fallback");
 });

 test("normative Luna contract preserves explicit-only legacy behavior",()=>{
  const contract=read("skills","orchestration","references","luna-task-lane.md");
  expect(contract).toContain("Missing activation means explicit-only");
  expect(contract).toContain("standing visual-required authorization");
  expect(contract).toContain("current request opts out");
  expect(contract).toContain("stop without fallback");
 });
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
bun test tools/luna-activation-contract.test.ts
```

Expected: FAIL because the existing skills require a per-request explicit phrase and contain none of the new activation contract markers.

- [ ] **Step 3: Update setup authorization guidance**

Replace the Luna setup step with text that includes this exact logical shape and behavior:

```markdown
8. Preserve the optional Codex app-task lane separately. Enable Luna / Max only after
   explicit opt-in; it is never a fallback or a routine native role. Ask whether its
   activation is `explicit` or `visual-required`. `visual-required` is standing
   authorization to create a user-visible Luna task only when an image, screenshot,
   or rendered interface is a material input to implementation or acceptance.

When `visual-required` is selected, the complete logical preference object must show:

~~~json
"appTaskLane": {
  "enabled": true,
  "model": "gpt-5.6-luna",
  "effort": "max",
  "activation": "visual-required"
}
~~~
```

State that missing activation remains explicit-only and that current-request opt-out takes precedence.

- [ ] **Step 4: Update orchestration selection rules**

Replace the unconditional “never activated implicitly” and exact-phrase-only wording with this contract:

```markdown
The Luna lane remains separately and explicitly authorized. A saved
`activation: "visual-required"` is standing authorization for a user-visible app task
only when an image, screenshot, or rendered interface is a material input to
implementation or acceptance. Missing activation means explicit-only. Never use it
as fallback.

Do not activate for text-only work, ordinary frontend work without material visual
input, incidental attachments, image explanation without implementation, raw audio
or raw video without an accepted frame workflow, or when the current request opts out.
Ambiguity defaults to no automatic task creation.
```

Keep the exact `list_projects` → `create_thread` → monitor/read → primary verification flow and exact Luna / Max values unchanged.

- [ ] **Step 5: Update the normative Luna authorization section**

Replace the first authorization bullets in `luna-task-lane.md` with:

```markdown
- Create a Luna task when the current request explicitly asks for this lane, or when
  the saved Codex profile carries standing visual-required authorization and the
  current request has a material visual implementation or acceptance dependency.
  Missing activation means explicit-only.
- Standing authorization does not apply when the current request opts out, when an
  attachment is incidental, or when the visual dependency is ambiguous.
- A created task remains user-visible and user-owned. The authorization never extends
  to PR creation, pushing, merging, fallback, or unrelated external actions.
```

Retain every project identity, worktree, monitoring, correction, PR authorization, and primary acceptance rule.

- [ ] **Step 6: Update skill UI guidance**

Set `openai.yaml` values to:

```yaml
interface:
  display_name: "Sol Advisor Orchestration"
  short_description: "Use native roles or an authorized visual-required Luna task, then verify and accept"
  default_prompt: "Use $orchestration for configured native roles and fresh Sol review; when saved visual-required authorization applies, use the user-visible Luna / Max app-task lane only for material visual implementation or acceptance input, honor current-request opt-out, and keep primary monitoring, review, correction, and acceptance in this task."
```

- [ ] **Step 7: Run the contract test and verify GREEN**

Run:

```powershell
bun test tools/luna-activation-contract.test.ts
```

Expected: 3 tests pass.

### Task 3: Package the contract and prevent regression

**Files:**
- Modify: `plugins/sol-advisor/scripts/verify.sh`
- Modify: `package.json`
- Modify: `plugins/sol-advisor/.codex-plugin/plugin.json`
- Modify: `plugins/sol-advisor/plugin.json`

- [ ] **Step 1: Extend the failing package-level assertions**

Add a fourth test to `tools/luna-activation-contract.test.ts`:

```ts
test("package metadata exposes visual-required activation without changing native roles",()=>{
 const codex=JSON.parse(read(".codex-plugin","plugin.json"));
 const standard=JSON.parse(read("plugin.json"));
 expect(codex.interface.longDescription).toContain("visual-required");
 expect(standard.description).toContain("visual-required");
 expect(codex.interface.defaultPrompt.join(" ")).toContain("visual-required");
});
```

Run the contract test and expect FAIL because current descriptions say only explicit opt-in.

- [ ] **Step 2: Update package descriptions without changing capabilities**

Update `.codex-plugin/plugin.json` so its description, short description, long description, and second default prompt explain that setup can persist explicit or visual-required authorization. Keep the existing name, author, capabilities, MCP path, skill path, and app tool list unchanged.

Update `plugin.json` description to:

```json
"description": "Configurable cross-client architect orchestration with lazy setup, exact user-selected native roles, safe adapter installation, and a separate explicitly authorized Codex Luna app-task lane with visual-required activation."
```

- [ ] **Step 3: Add packaged shell guards**

After the existing Luna model/Max checks in `verify.sh`, add:

```sh
grep -Fq 'activation: "visual-required"' "$skill" || fail "skill omits visual-required activation"
grep -Fq 'material input to implementation or acceptance' "$skill" || fail "skill omits material visual trigger"
grep -Fq 'current request opts out' "$skill" || fail "skill omits current-request opt-out"
grep -Fq 'Missing activation means explicit-only' "$luna_contract" || fail "Luna contract omits legacy explicit-only behavior"
grep -Fq 'standing visual-required authorization' "$luna_contract" || fail "Luna contract omits standing authorization"
```

- [ ] **Step 4: Add the contract test to the default suite**

Append `tools/luna-activation-contract.test.ts` to the existing `test` script in `package.json` without removing any current test file.

- [ ] **Step 5: Verify package-level GREEN**

Run:

```powershell
bun test tools/luna-activation-contract.test.ts
bun run test
```

Expected: the contract test reports 4 passes and the full suite reports zero failures.

- [ ] **Step 6: Commit only clean, non-overlapping contract files when safe**

Inspect:

```powershell
git -c safe.directory=G:/Codex_Projects/sol-advisor diff --cached --name-only
git -c safe.directory=G:/Codex_Projects/sol-advisor diff -- tools/luna-activation-contract.test.ts plugins/sol-advisor/skills/setup/SKILL.md plugins/sol-advisor/skills/orchestration/SKILL.md plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md plugins/sol-advisor/skills/orchestration/agents/openai.yaml plugins/sol-advisor/scripts/verify.sh
```

If those files had no pre-existing edits and their complete diffs are feature-only, stage and commit them with:

```powershell
git -c safe.directory=G:/Codex_Projects/sol-advisor add -- tools/luna-activation-contract.test.ts plugins/sol-advisor/skills/setup/SKILL.md plugins/sol-advisor/skills/orchestration/SKILL.md plugins/sol-advisor/skills/orchestration/references/luna-task-lane.md plugins/sol-advisor/skills/orchestration/agents/openai.yaml plugins/sol-advisor/scripts/verify.sh
git -c safe.directory=G:/Codex_Projects/sol-advisor -c user.name=lovecswar -c user.email=lovecswar@users.noreply.github.com commit -m "feat: authorize visual Luna tasks"
```

Do not stage `package.json`, either manifest, `server.ts`, or `server.test.ts` at this checkpoint because those paths already overlap unrelated dirty work.

### Task 4: Run source and release validation

**Files:**
- Verify only; fix only failures caused by this feature.

- [ ] **Step 1: Run focused tests**

```powershell
bun test plugins/sol-advisor/mcp/server.test.ts
bun test tools/luna-activation-contract.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run the complete Bun suite**

```powershell
bun run test
```

Expected: all configured test files pass, with the existing platform-specific skips only.

- [ ] **Step 3: Run repository validation**

```powershell
bun run validate
bun run release:check
```

Expected: both commands exit 0 and the release archive includes the updated skills, contract, MCP server, and manifests.

- [ ] **Step 4: Run the shell contract validator**

```powershell
sh plugins/sol-advisor/scripts/verify.sh
```

Expected: exit 0 with the Luna app-tool, visual-required, legacy, opt-out, native-role, and PR-boundary checks passing. If `sh` itself is unavailable, report the environment limitation and do not count this step as passed.

- [ ] **Step 5: Run the Codex plugin validator**

```powershell
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py G:\Codex_Projects\sol-advisor\plugins\sol-advisor
```

Expected: plugin validation succeeds with `.codex-plugin/plugin.json`, `.mcp.json`, and skills accepted.

- [ ] **Step 6: Inspect the complete working-tree delta**

```powershell
git -c safe.directory=G:/Codex_Projects/sol-advisor status --short
git -c safe.directory=G:/Codex_Projects/sol-advisor diff --check
```

Expected: no whitespace errors; every pre-existing unrelated change remains present.

### Task 5: Update the cachebuster and reinstall the local plugin

**Files:**
- Modify mechanically: `plugins/sol-advisor/.codex-plugin/plugin.json`
- Modify mechanically: `plugins/sol-advisor/plugin.json`
- Modify mechanically: `package.json`
- Read only: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Confirm the existing local marketplace identity**

Run:

```powershell
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\read_marketplace_name.py --marketplace-path G:\Codex_Projects\sol-advisor\.agents\plugins\marketplace.json
```

Expected: `sol-advisor`.

- [ ] **Step 2: Update the Codex cachebuster through the supported helper**

Run:

```powershell
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\update_plugin_cachebuster.py G:\Codex_Projects\sol-advisor\plugins\sol-advisor
```

Expected: one line showing `0.5.0+codex.20260808111803` changing to one new version with the same `0.5.0+codex.` prefix and the helper-generated UTC digit suffix.

- [ ] **Step 3: Synchronize the exact generated version**

Read the exact new version from `.codex-plugin/plugin.json`, then use `apply_patch` to replace the old version in `plugins/sol-advisor/plugin.json` and `package.json`. Do not modify marketplace JSON. Verify:

```powershell
$codexVersion=(Get-Content -Raw 'plugins\sol-advisor\.codex-plugin\plugin.json' | ConvertFrom-Json).version
$standardVersion=(Get-Content -Raw 'plugins\sol-advisor\plugin.json' | ConvertFrom-Json).version
$packageVersion=(Get-Content -Raw 'package.json' | ConvertFrom-Json).version
@($codexVersion,$standardVersion,$packageVersion) | Select-Object -Unique
```

Expected: exactly one unique version.

- [ ] **Step 4: Re-run all validation after version synchronization**

```powershell
bun run test
bun run validate
bun run release:check
python C:\Users\SYX001\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py G:\Codex_Projects\sol-advisor\plugins\sol-advisor
```

Expected: every command exits 0.

- [ ] **Step 5: Reinstall from the existing `sol-advisor` marketplace**

Resolve the newest usable standalone CLI and reinstall:

```powershell
$codexCli=Get-ChildItem -LiteralPath 'C:\Users\SYX001\AppData\Local\OpenAI\Codex\bin' -Recurse -Filter codex.exe -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if(-not $codexCli){throw 'No standalone Codex CLI found'}
$env:CODEX_HOME='C:\Users\SYX001\.codex'
& $codexCli.FullName plugin add sol-advisor@sol-advisor
```

Expected: Codex reports the newly generated cachebuster version installed and enabled.

- [ ] **Step 6: Verify the installed cache matches source**

Read `$codexVersion` from the synchronized manifest and locate the installed directory with:

```powershell
$codexVersion=(Get-Content -Raw 'plugins\sol-advisor\.codex-plugin\plugin.json' | ConvertFrom-Json).version
$installedRoot=Join-Path 'C:\Users\SYX001\.codex\plugins\cache\sol-advisor\sol-advisor' $codexVersion
if(-not (Test-Path -LiteralPath $installedRoot)){throw "Installed cache missing: $installedRoot"}
```

Compare source and installed hashes for:

```text
skills/setup/SKILL.md
skills/orchestration/SKILL.md
skills/orchestration/references/luna-task-lane.md
mcp/server.ts
.codex-plugin/plugin.json
```

Expected: each cached hash equals its workspace-source hash.

- [ ] **Step 7: Stop at the discovery boundary**

Tell the user exactly once that a new Codex task or reload is required because installed skills, MCP schemas, and native role files are discovered at task startup. Do not attribute this reload to a repeatedly changing local model catalog.

### Task 6: Save the confirmed logical profile and preview the native adapter

**Files:**
- External logical data through Sol Advisor MCP only.
- No direct filesystem writes.

This task runs only after the user starts a fresh Codex session and confirms continuation.

- [ ] **Step 1: Verify setup status**

Call `get_setup_status`.

Expected: `missing` for the current project profile, with the updated tool schema exposing app-task activation.

- [ ] **Step 2: Show the complete logical object again**

Show exactly:

```json
{
  "client": "codex",
  "scope": "project",
  "workspace": "G:\\Codex_Projects\\sol-advisor",
  "orchestrator": { "model": "inherit" },
  "roles": {
    "routine": { "model": "opencode-go/deepseek-v4-flash", "effort": "xhigh" },
    "high": { "model": "gpt-5.6-terra", "effort": "xhigh" },
    "advisor": { "model": "gpt-5.6-sol", "effort": "xhigh", "readonly": true }
  },
  "fallbackPolicy": "fail-closed",
  "fallbacks": [],
  "appTaskLane": {
    "enabled": true,
    "model": "gpt-5.6-luna",
    "effort": "max",
    "activation": "visual-required"
  }
}
```

- [ ] **Step 3: Save exact preferences**

Call `save_preferences` with `appTaskLane: { enabled: true, activation: "visual-required" }` and the exact client, scope, workspace, orchestrator, role model IDs, efforts, and advisor read-only value shown above.

Expected: `saved: true`; the persisted `appTaskLane` returns Luna / Max plus `activation: "visual-required"`.

- [ ] **Step 4: Read back and compare preferences**

Call `get_preferences` and compare every user-selected field, fallback policy, app lane value, workspace, and profile key.

Expected: exact match; no silent model normalization or fallback entry.

- [ ] **Step 5: Render the project adapter**

Call `render_client_adapter` with workspace `G:\Codex_Projects\sol-advisor`.

Expected: exactly three allowlisted project-scoped native role files, their full contents, warnings, expiry, and one exact install confirmation token.

- [ ] **Step 6: Present the complete preview and stop**

Show every destination and full content exactly. Ask the user to repeat the exact install token. Do not treat “yes”, “确认”, or an approximate token as authorization.

### Task 7: Install the adapter and perform fresh-task acceptance

**Files:**
- External adapter files through Sol Advisor MCP only after exact token confirmation.

- [ ] **Step 1: Install with the repeated exact token**

Call `install_client_adapter` with the exact workspace and exact token returned by the latest unexpired preview.

Expected: exactly three managed project-scoped files installed; no user-scope token required.

- [ ] **Step 2: Validate the installed configuration**

Call `validate_configuration` with the workspace.

Expected: ready logical profile, renderable adapter, and managed-file integrity for all three roles.

- [ ] **Step 3: Start one fresh task for role and skill discovery**

Ask for a fresh Codex task or one reload after adapter installation. This is the single expected discovery reload.

- [ ] **Step 4: Verify the non-qualifying control path**

In the fresh task, issue a text-only bounded implementation request with no material visual input.

Expected: no Luna app task is created; orchestration chooses the configured native routine or high role according to complexity.

- [ ] **Step 5: Verify the qualifying visual path**

Attach a screenshot whose visual content is necessary to implement or accept a bounded UI correction and invoke Sol Advisor without saying “Use the Luna task lane.”

Expected: the saved `visual-required` authorization is loaded, a user-visible Luna / Max task is created through the app task tools, and the parent monitors, reads, verifies, and accepts or corrects it.

- [ ] **Step 6: Record runtime evidence honestly**

Record the observed task identity, project, environment/worktree, and any app-provided model/thinking metadata. If routing, model, thinking, or automatic activation cannot be observed, mark that acceptance item blocked rather than inferring success.

- [ ] **Step 7: Run final source verification**

```powershell
bun run test
bun run validate
bun run release:check
git -c safe.directory=G:/Codex_Projects/sol-advisor diff --check
git -c safe.directory=G:/Codex_Projects/sol-advisor status --short
```

Expected: tests and validators pass, no whitespace errors, and pre-existing unrelated dirty changes remain preserved.

## Final acceptance report

Report separately:

- repository implementation and automated verification;
- installed plugin cache verification;
- saved logical profile and exact adapter installation;
- non-qualifying native-lane runtime result;
- qualifying Luna automatic-routing runtime result;
- any unverified or blocked runtime metadata;
- all remaining unrelated dirty files without claiming ownership of them.
