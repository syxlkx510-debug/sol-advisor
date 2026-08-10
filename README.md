# Sol Advisor

Sol Advisor is a Codex plugin for architect-first development. It keeps the
requirements, architecture, decomposition, diff review, verification, and final
acceptance in the parent chat, while three configured Codex roles handle bounded
implementation, complex implementation, and independent review.

The plugin also exposes a separate Luna app-task lane. That lane is available only
for a current request that explicitly authorizes it and only when it was enabled and
saved during setup.

## Prerequisites

- Codex with plugin support.
- Bun 1.3.x on `PATH` for the MCP server and Windows verification commands.
- A local checkout of this repository. The repository marketplace source is the
  `.agents/plugins/marketplace.json` file; its `sol-advisor` entry points to
  `plugins/sol-advisor`.

## Install from the local repository marketplace

Before either marketplace command, use the same PowerShell window that you will use
for installation and resolve one executable Codex CLI. This checks the command on
`PATH` first; if it cannot run, it checks the bundled candidates without copying an
executable or changing `PATH`:

```powershell
$codexCli = $null
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if ($codexCommand) {
    $probeExitCode = 1
    try {
        & $codexCommand.Source plugin --help *> $null
        $probeExitCode = $LASTEXITCODE
    } catch {}
    if ($probeExitCode -eq 0) { $codexCli = $codexCommand.Source }
}
if (-not $codexCli) {
    $codexBinRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    $bundledCandidates = @(
        Get-ChildItem -LiteralPath $codexBinRoot -Filter 'codex.exe' -Recurse -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
    )
    foreach ($candidate in $bundledCandidates) {
        $probeExitCode = 1
        try {
            & $candidate.FullName plugin --help *> $null
            $probeExitCode = $LASTEXITCODE
        } catch {}
        if ($probeExitCode -eq 0) {
            $codexCli = $candidate.FullName
            break
        }
    }
}
if (-not $codexCli) {
    throw 'No executable Codex CLI with plugin support was found. Stop and repair Codex before continuing.'
}
& $codexCli --version
if ($LASTEXITCODE -ne 0) { throw 'Codex --version failed; stop.' }
& $codexCli plugin --help
if ($LASTEXITCODE -ne 0) { throw 'Codex plugin support preflight failed; stop.' }
bun --version
```

The two real `$codexCli` preflight commands must start successfully and print their
output. If `Get-Command codex` returns `Access is denied`, `拒绝访问`, `Access denied`,
reports that it cannot be found, or otherwise cannot execute, the resolver clears it
and tries the bundled candidates one at a time. If all candidates fail, stop immediately.
Do not run marketplace or plugin installation, copy a WindowsApps
executable, edit `PATH`, or hand-edit the Codex cache/configuration. Switch to a user
terminal where the Codex CLI executes, or have the Codex app/administrator repair the
CLI executable, then repeat this resolution and preflight.

After the preflight, stay in the repository root and resolve the current checkout
dynamically:

```powershell
$repoRoot = (Resolve-Path -LiteralPath (Get-Location).Path).Path
& $codexCli plugin marketplace add $repoRoot
& $codexCli plugin add sol-advisor@sol-advisor
```

The marketplace command is needed once per Codex installation. The second command
installs the plugin by the name declared in the local marketplace. Installation makes
the skills and MCP setup tools discoverable; it does not run setup or write role
files.

After installing or reinstalling, fully exit Codex, reopen the existing project, and
create a new task. A new project is not required. The full exit releases any older
MCP process, and the new task makes the newly installed skills and tools visible.
The MCP setup tools become discoverable only after this install, the full exit/reopen,
and the new task.

Sol Advisor stores non-secret preferences in the private `PLUGIN_DATA` directory
provided by Codex. It does not store credentials in that configuration.

Start the workflow in the parent chat with:

```text
Use $sol-advisor:orchestration for this request. Keep architecture and acceptance in
the parent task, use the saved configured role, and obtain a fresh advisor review.
```

## Lazy setup and exact-token installation

Setup is lazy: the first orchestration request calls `get_setup_status` and
`get_preferences`. If setup is missing, old, or corrupt, the setup skill stays in the
parent chat and asks one focused question at a time. It records:

1. project or user scope (project is recommended) and the existing workspace;
2. the exact Codex model ID and reasoning effort for `routine`, `high`, and
   `advisor`;
3. whether the separate Luna / Max app-task lane should be saved as enabled.

The model IDs are copied exactly from Codex. Sol Advisor does not guess aliases,
normalize names, silently substitute a model, or choose a fallback role.

Before writing anything, setup shows the complete preference object. After the user
accepts it, `save_preferences` stores the non-secret profile and
`render_client_adapter` shows every destination and the complete contents of the
three generated files. Installation requires repeating the exact short-lived token
shown in that preview:

```text
INSTALL <the exact nonce from the preview>
```

User scope also returns a separate `INSTALL USER <nonce>` token. A generic “yes” is
not accepted. The server computes the allowlisted destinations and refuses traversal,
symlink, unmanaged-conflict, stale-file, expired-token, and replayed-token cases.

Setup then calls `validate_configuration`. Continue only when the profile is valid and
`adapterStatus` is `current`. After a successful install, fully restart Codex and
create a new task again so role discovery is refreshed.

## The three configured roles

The generated project files are:

| Role | Use it for | Native name |
| --- | --- | --- |
| Routine | Bounded, mechanical, fully specified work | `sol_advisor_routine` |
| High | Complex, security-sensitive, or broad work | `sol_advisor_high` |
| Advisor | Architecture consultation and final evidence review | `sol_advisor_advisor` |

The saved model and effort belong to the role file. Orchestration spawns the exact
configured name without passing a second model or effort override. The parent remains
responsible for the complete packet, file ownership, diff inspection, verification,
correction decisions, and acceptance.

The advisor file requests `sandbox_mode = "read-only"`; the actual guarantee is
reported from runtime evidence, as described below.

## Explicit Luna app-task lane

The Luna lane is separate from the configured native roles. Use it only when the
current request explicitly says to use the Luna task lane. Before creating a task,
the saved profile must contain all of:

```text
appTaskLane.enabled=true
model: "gpt-5.6-luna"
effort: "max"
```

Saving Luna as the model for the native `routine` role does not enable or select this
app-task lane. An earlier request, an attachment, or a skill invocation is not current
authorization. If the lane is absent, disabled, inconsistent, or unavailable,
orchestration stops without enabling it, creating a task, or falling back to a native
role.

## Windows-native verification

From the repository root, these commands use Bun and work in PowerShell without a
POSIX shell dependency:

```powershell
bun install --frozen-lockfile
bun run test
bun run validate
bun run release:check
bun run tag:check -- v0.6.0
git diff --check
```

To inspect one child rollout's observed metadata, use the bundled TypeScript
inspector with its lowercase UUID:

```powershell
bun plugins/sol-advisor/scripts/inspect-agent-runtime.ts <child-rollout-uuid>
```

It reports the role, model, reasoning effort, sandbox policy, permission profile, and
working directory from the matching rollout. An explicit sessions directory can be
provided with `--sessions-dir`; ambiguous, incomplete, or conflicting evidence fails
closed.

These source checks do not prove a fresh installed task. Live acceptance additionally
requires reinstalling from the local marketplace, fully exiting Codex, reopening the
project, creating a new task, and invoking all three configured roles.

## Read-only reporting

The advisor is requested to make no project or artifact changes. Sol Advisor compares
Git and relevant artifact state before and after the review and records the observed
runtime metadata.

- If the host reports an enforced read-only sandbox, report that observed policy.
- If the host reports `workspace-write` with a managed permission profile, call the
  review **behaviorally read-only** only after the before/after state is unchanged.
- A TOML field, manifest, or passing test cannot be upgraded into host-enforced
  isolation. Any mutation invalidates the review.

## Development cachebuster

The Codex manifest has a release base version and may carry one local cachebuster. In
development, ask Codex explicitly:

```text
Use `$plugin-creator` to run `scripts/update_plugin_cachebuster.py` for the current
checkout's `plugins/sol-advisor`. Resolve the plugin-creator skill root and an
available runtime first; do not hand-edit the manifest, marketplace, or cache.
```

The skill resolves its own helper path and runtime. If it cannot resolve them, stop
and report that instead of editing the manifest manually.

After the helper succeeds, rerun the version/discovery checks and, in the same
PowerShell that resolved `$codexCli`, reinstall from the same repository marketplace:

```powershell
& $codexCli plugin add sol-advisor@sol-advisor
```

Then fully exit Codex and create a new task. Do not hand-edit the marketplace file, the
installed plugin cache, or the manifest's cachebuster. Do not force-delete a cache
directory to make a new version appear.

## Reconfigure, uninstall, and troubleshooting

To change the saved profile, run this in the parent chat:

```text
Use $sol-advisor:setup to reconfigure the Codex scope, workspace, and exact role
choices. Show the complete preview and wait for the exact installation token.
```

Adapter removal is also preview-first. Call `uninstall_client_adapter`, inspect the
managed paths and token, then repeat the exact token. It removes only unchanged files
owned by the active profile; it does not remove user-owned files. In the same
PowerShell that resolved `$codexCli`, remove the plugin only after its managed adapters
are gone:

```powershell
& $codexCli plugin remove sol-advisor@sol-advisor
```

If you open a new terminal, repeat the CLI resolution and preflight before running the
remove command. Do not delete user configuration, drifted adapter files, or the plugin
cache manually.

If the MCP tools are missing, confirm that the local marketplace points at this
checkout, run the install command again, fully exit Codex, reopen the project, and
create a new task. If setup reports `missing`, `schema-old`, or `corrupt`, run the
setup interview rather than editing `PLUGIN_DATA` by hand. If
`validate_configuration` reports `missing`, `stale`, or `conflict`, inspect the exact
paths in its response and use the preview/token flow; never overwrite an unmanaged
file.

If a child rollout has a different role, model, effort, sandbox, or permission value,
stop the lane and inspect it with the Bun runtime inspector. Do not substitute another
role or claim exact routing from source files alone. If an old installation remains
active, repeat the full-exit/restart/new-task boundary; never hand-edit or force-delete
the Codex plugin cache.

## MCP tools

The installed server exposes exactly these setup and validation tools over stdio:

- `get_setup_status`
- `get_preferences`
- `save_preferences`
- `render_client_adapter`
- `install_client_adapter`
- `uninstall_client_adapter`
- `validate_configuration`
- `reset_configuration`

Configuration writes are schema-checked and atomic. Adapter installation and removal
use managed hashes, private backups, and fail-closed transaction recovery.

## License

MIT. See the [LICENSE file](https://github.com/DannyMac180/sol-advisor/blob/main/LICENSE).
