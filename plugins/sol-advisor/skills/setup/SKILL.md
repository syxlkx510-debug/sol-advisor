---
name: setup
description: "Use when Sol Advisor setup is missing, outdated, corrupt, or being reconfigured for exact client-native models, role efforts, scope, adapter installation, or Luna activation."
---

# Sol Advisor setup

Run this interview in the parent/main chat. Never delegate it. Orchestration must call
`get_setup_status` before doing anything else and route here when status is `missing`,
`schema-old`, or `corrupt`. Plugin installation does not run this interview and does
not install a hook; setup is lazy on the first orchestration invocation.

Ask one focused question at a time:

1. Client: `codex`, `cursor`, `vscode`, `github-copilot`, or `kiro`.
2. Scope: `project` or `user`. Explain that user scope needs separate consent.
3. Ask for the explicit existing workspace directory used to key this profile and to
   compute allowlisted adapter destinations.
4. Ask the user to open the client's model picker or `/model` and copy the **exact
   native model ID** for routine implementation, high-complexity implementation, and
   advisor. Never enumerate, normalize, guess, or silently substitute model IDs.
5. Where supported, ask for the exact native reasoning setting. Codex and Cursor may
   store per-role effort. VS Code/GitHub Copilot adapters store model only; explain
   the parent cost-tier constraint. Kiro effort is session/per-model, not per-agent.
6. Confirm the advisor is requested as read-only. Explain that behavioral read-only
   is not OS enforcement unless the client exposes sandbox evidence.
7. Confirm fail-closed behavior: no fallback roles or models.
8. Preserve the optional Codex app-task lane separately. Enable Luna / Max only after
   explicit opt-in; it is never a fallback or a routine native role. Ask whether its
   activation is `explicit` or `visual-required`. `visual-required` is standing
   authorization to create a user-visible Luna task only when an image, screenshot,
   or rendered interface is a material input to implementation or acceptance.

Offer these current Codex recommendations as editable defaults, not universal IDs:

- routine: `gpt-5.6-terra`, effort `high`
- high: `gpt-5.6-terra`, effort `high`
- advisor: `gpt-5.6-sol`, effort `high`, requested read-only
- orchestrator: always `inherit`; recommend selecting Sol / High in the main chat

When `visual-required` is selected, the complete logical preference object must show:

~~~json
"appTaskLane": {
  "enabled": true,
  "model": "gpt-5.6-luna",
  "effort": "max",
  "activation": "visual-required"
}
~~~

Missing activation remains explicit-only. A current request that opts out of Luna or
task creation takes precedence over standing authorization.

Call `save_preferences` only after showing the complete logical preference object.
Use no secrets. For an unsupported execution surface (ChatGPT Work web, Kiro web/mobile, or a
skills-only client), do not claim or store a native profile: those surfaces are not in
the client enum. Use parent-chat prompt guidance only and say role bindings are not
enforceable there.

For native adapter installation, require an explicit existing workspace directory.
Call `render_client_adapter`, then show every exact destination, full content,
warning, and confirmation token. Do not pass an arbitrary write path: only the
workspace goes to the MCP server, which computes allowlisted destinations. Call
`install_client_adapter` only after the user repeats the exact install token; user
scope additionally requires the exact separate user-scope token. Never treat “yes”
as either token.

After install, tell the user to start a new chat or reload the client. Reconfiguration
repeats the interview and exact preview. Uninstall first previews its managed files
and exact token, then removes only the unchanged managed files after confirmation.
