---
name: setup
description: "Run Sol Advisor's Codex-only setup interview in the parent chat, save exact configured roles, preview the adapter, and install only after exact confirmation."
---

# Sol Advisor setup

Run this interview in the parent/main chat. Never delegate it. Orchestration calls
`get_setup_status` before routing and runs this interview when the status is `missing`,
`schema-old`, or `corrupt`. Plugin installation does not run setup or install an
adapter; setup is lazy on the first orchestration invocation.

Ask one focused question at a time. The setup sequence is exactly these 11 steps;
do not add a client-selection, compatibility, or automatic-route step.

### 1. Scope and user-scope consent

Ask whether the profile scope is `project` or `user`. Recommend `project`. If the
user selects `user`, obtain separate explicit consent for user scope before continuing.

### 2. Existing workspace

Ask for the explicit existing workspace directory. Use it to key the saved profile and
to compute the allowlisted adapter destination; never accept an arbitrary write path.

### 3. Exact Codex role preferences

Ask the user to copy from Codex the exact model ID and exact reasoning effort for
`routine`, `high`, and `advisor`. Never enumerate, normalize, guess, or substitute
these values. Confirm that the advisor is requested as read-only and explain that a
behavioral request is not host-enforced isolation without observed sandbox evidence.
Confirm fail-closed behavior: no fallback role, model, or effort.

### 4. Optional explicit Luna / Max app-task availability

Ask whether the user explicitly wants the separate Luna / Max app-task lane available
for a future current request. The native routine role may use any exact saved model,
including Luna. Choosing Luna for routine does not enable or select the app-task lane;
model family does not select the execution lane.

### 5. Complete Codex preference preview

Show the complete proposed preference object, including `client: "codex"`, scope,
workspace, all three exact role model/effort values, the advisor read-only request,
and the separate Luna app-task availability decision. Use no secrets.

### 6. Save preferences

Call `save_preferences` only after the user accepts the complete preview. Stop if it
rejects the data; do not write a substitute local configuration.

### 7. Full adapter preview

Call `render_client_adapter` with the saved workspace. Show every destination, full
file content, warning, and confirmation token returned by the MCP tool.

### 8. Exact installation token

Require the user to repeat the exact installation token from the preview. For user
scope, require the separate user-scope confirmation token as well when it is returned.
Never treat a general affirmation as either exact token.

### 9. Install the adapter

Call `install_client_adapter` only with the exact returned token or tokens. The MCP
server computes all destinations; setup never supplies a direct destination path.

### 10. Validate current configuration

Call `validate_configuration` for the saved workspace. Continue only when it reports
valid configuration and `adapterStatus: "current"`; otherwise show the returned state
and stop fail-closed.

### 11. Restart and new task

Tell the user to fully restart Codex and create a new task in the same workspace.
Existing tasks can retain stale role discovery. Reconfiguration repeats this exact
eleven-step interview.
