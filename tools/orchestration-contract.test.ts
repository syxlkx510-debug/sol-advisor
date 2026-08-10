import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const plugin = join(import.meta.dir, "..", "plugins", "sol-advisor");
const read = (...parts: string[]) => readFileSync(join(plugin, ...parts), "utf8");
const activeDesign = "2026-08-09-codex-only-sol-advisor-repair-design.md";
const activePlanDesign = `../specs/${activeDesign}`;

const historicalGuidance = [
  {
    path: join("docs", "superpowers", "specs", "2026-08-08-codex-mcp-discovery-fix-design.md"),
    link: activeDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "specs", "2026-08-08-standalone-workspace-mcp-design.md"),
    link: activeDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "specs", "2026-08-08-visual-multimodal-luna-activation-design.md"),
    link: activeDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "specs", "2026-08-09-native-luna-routine-role-design.md"),
    link: activeDesign,
    heading: "Partially Superseded",
  },
  {
    path: join("docs", "superpowers", "plans", "2026-08-08-codex-mcp-discovery-fix.md"),
    link: activePlanDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "plans", "2026-08-08-standalone-workspace-mcp.md"),
    link: activePlanDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "plans", "2026-08-08-visual-multimodal-luna-activation.md"),
    link: activePlanDesign,
    heading: "Superseded",
  },
  {
    path: join("docs", "superpowers", "plans", "2026-08-09-native-luna-routine-role.md"),
    link: activePlanDesign,
    heading: "Partially Superseded",
  },
] as const;

describe("Codex-only configured orchestration", () => {
  test("contains only configured native role names", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    const contracts = read("skills", "orchestration", "references", "role-contracts.md");
    const setup = read("skills", "setup", "SKILL.md");
    const lunaLane = read("skills", "orchestration", "references", "luna-task-lane.md");
    const active = `${skill}\n${contracts}\n${setup}\n${lunaLane}`;
    for (const role of ["sol_advisor_routine", "sol_advisor_high", "sol_advisor_advisor"]) {
      expect(active).toContain(role);
    }
    for (const removed of [
      "sol_advisor_terra_implementer", "sol_advisor_sol_reviewer",
      "cursor", "vscode", "github-copilot", "kiro", "portable entry",
      "GPT-5.6 Sol / High", "native Terra", "fresh Sol", "Terra / High",
    ]) expect(active.toLowerCase()).not.toContain(removed.toLowerCase());
    for (const role of ["sol_advisor_routine", "sol_advisor_high", "sol_advisor_advisor"]) {
      expect(lunaLane).toContain(role);
    }
    expect(lunaLane).toMatch(/parent retains\s+its own selected model and effort/i);
    expect(lunaLane).toContain("never a fallback");
  });

  test("does not ship compatibility templates or shell preflight", () => {
    expect(existsSync(join(plugin, "agents"))).toBe(false);
    expect(existsSync(join(plugin, "scripts", "install-agents.sh"))).toBe(false);
    expect(existsSync(join(plugin, "scripts", "verify.sh"))).toBe(false);
    expect(existsSync(join(plugin, "skills", "orchestration", "references", "portable-entry.md"))).toBe(false);
  });

  test("uses configuration validation and Bun runtime evidence", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    expect(skill).toContain("validate_configuration");
    expect(skill).toContain("adapterStatus");
    expect(skill).toContain("inspect-agent-runtime.ts");
    expect(skill).toContain("On Windows");
    expect(skill).toContain("$nativeSubagentThreadId");
    expect(skill).toContain("workspace-write");
    expect(skill).toContain("behaviorally read-only");
    expect(skill).toContain("Do not pass `model`, `reasoning_effort`, or effort overrides.");
    expect(skill).toContain("saved preferences");
  });

  test("uses the exact eleven-step Codex setup sequence", () => {
    const setup = read("skills", "setup", "SKILL.md");
    expect(setup).toContain("The setup sequence is exactly these 11 steps");
    expect([...setup.matchAll(/^### (\d+)\. /gm)].map((match) => match[1])).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
    ]);
  });

  test("requires a configured reviewer verdict and observed isolation evidence", () => {
    const contracts = read("skills", "orchestration", "references", "role-contracts.md");
    for (const section of ["OBJECTIVE", "FILES AND OWNERSHIP", "INTERFACES", "CONSTRAINTS", "VERIFICATION", "RETURN"]) {
      expect(contracts).toContain(section);
    }
    expect(contracts).toContain("VERDICT: ship | fix-first | rethink");
    expect(contracts).toContain("never implement fixes");
    expect(contracts).toContain("sandbox policy");
    expect(contracts).toContain("permission profile");
  });

  test("fails closed unless the explicit Luna lane is saved and exact", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    const lane = skill.slice(skill.indexOf("## Explicit Luna app-task lane"));
    expect(lane).toContain("call `get_setup_status` and `get_preferences`");
    expect(lane).toContain("appTaskLane.enabled=true");
    expect(lane).toContain('model: "gpt-5.6-luna"');
    expect(lane).toContain('effort: "max"');
    expect(lane).toMatch(/absent, false, or\s+inconsistent/);
    expect(lane).toContain("do not enable it");
    expect(lane).toContain("fail closed");
  });

  test("spawns every configured native role as an isolated complete-packet task", () => {
    const skill = read("skills", "orchestration", "SKILL.md");
    const contracts = read("skills", "orchestration", "references", "role-contracts.md");
    for (const role of ["sol_advisor_routine", "sol_advisor_high", "sol_advisor_advisor"]) {
      expect(skill).toContain(role);
      expect(contracts).toContain(role);
    }
    for (const text of [skill, contracts]) {
      expect(text).toContain('fork_turns: "none"');
      expect(text).toMatch(/Do not pass `model`,\s*`reasoning_effort`, or effort overrides\./);
    }
    expect(skill).toMatch(/full packet is their\s+only context/);
    expect(contracts).toContain("must not rely on inherited history");
    expect(contracts).toContain("fresh independent review");
  });

  test("publishes the configured-role prompt and TypeScript-only package commands", () => {
    const agent = read("skills", "orchestration", "agents", "openai.yaml");
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
    expect(agent).toBe([
      "interface:",
      '  display_name: "Sol Advisor Orchestration"',
      '  short_description: "Use configured Codex roles or explicitly authorize a Luna task"',
      '  default_prompt: "Use $orchestration with the saved routine, high, and advisor roles; use the Luna app-task lane only when I explicitly authorize it."',
      "",
    ].join("\n"));
    expect(pkg.scripts.ci).toBe("bun run test && bun run validate && bun run release:check");
    expect(pkg.scripts.test).toBe("bun test plugins/sol-advisor/mcp/server.test.ts plugins/sol-advisor/mcp/private-directory.test.ts tools/plugin-discovery.test.ts tools/orchestration-contract.test.ts tools/luna-explicit-contract.test.ts tools/version.test.ts");
  });

  test("README exposes only the Codex install and configured-role path", () => {
    const readme = readFileSync(join(import.meta.dir, "..", "README.md"), "utf8");
    const prerequisitesStart = readme.indexOf("## Prerequisites");
    const prerequisitesEnd = readme.indexOf("\n## ", prerequisitesStart + "## Prerequisites".length);
    expect(prerequisitesStart).toBeGreaterThanOrEqual(0);
    expect(prerequisitesEnd).toBeGreaterThan(prerequisitesStart);
    const prerequisites = readme.slice(prerequisitesStart, prerequisitesEnd);
    expect(prerequisites).toMatch(/^- Codex with plugin support\.\s*$/m);
    expect(prerequisites).toMatch(/^- Bun 1\.3\.x on `PATH`/m);
    expect(prerequisites).toMatch(/^- A local checkout of this repository\./m);
    expect(prerequisites.match(/^- /gm) ?? []).toHaveLength(3);
    expect(prerequisites).not.toMatch(/MCP tools?\s+(?:enabled|available|present)/i);
    expect(prerequisites).not.toMatch(/enabled.*MCP|MCP.*enabled/i);
    expect(prerequisites).not.toContain("PLUGIN_DATA");
    const preflight = readme.indexOf("& $codexCli --version");
    const bunPreflight = readme.indexOf("& $bunCli --version");
    const codexSupportPreflight = readme.indexOf("& $codexCli plugin --help");
    const marketplaceInstall = readme.indexOf("& $codexCli plugin marketplace add $repoRoot");
    const pluginInstall = readme.indexOf("& $codexCli plugin add sol-advisor@sol-advisor");
    const pluginRemove = readme.indexOf("& $codexCli plugin remove sol-advisor@sol-advisor");
    expect(preflight).toBeGreaterThan(prerequisitesEnd);
    expect(bunPreflight).toBeGreaterThan(preflight);
    expect(codexSupportPreflight).toBeGreaterThan(preflight);
    expect(marketplaceInstall).toBeGreaterThan(codexSupportPreflight);
    expect(pluginInstall).toBeGreaterThan(marketplaceInstall);
    expect(pluginRemove).toBeGreaterThan(pluginInstall);
    const nativeChecked = (text: string, command: string) => {
      const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(text).toMatch(new RegExp(`${escaped}\\r?\\n\\s*Assert-NativeSuccess`));
    };
    expect(readme).toContain("function Assert-NativeSuccess");
    nativeChecked(readme, "& $codexCli --version");
    nativeChecked(readme, "& $codexCli plugin --help");
    nativeChecked(readme, "& $codexCli plugin marketplace add $repoRoot");
    nativeChecked(readme, "& $codexCli plugin remove sol-advisor@sol-advisor");
    const pluginAddChecks = [...readme.matchAll(/& \$codexCli plugin add sol-advisor@sol-advisor\r?\n\s*Assert-NativeSuccess/g)];
    expect(pluginAddChecks.length).toBeGreaterThanOrEqual(2);
    const windowsStart = readme.indexOf("## Windows-native verification");
    const windowsEnd = readme.indexOf("\n## Read-only reporting", windowsStart + "## Windows-native verification".length);
    expect(windowsStart).toBeGreaterThanOrEqual(0);
    expect(windowsEnd).toBeGreaterThan(windowsStart);
    const windowsVerification = readme.slice(windowsStart, windowsEnd);
    expect(windowsVerification).toContain("function Assert-NativeSuccess");
    expect(windowsVerification).toContain("Get-Command bun");
    expect(windowsVerification).toContain("$bunCli");
    for (const command of [
      "& $bunCli --version",
      "& $bunCli install --frozen-lockfile",
      "& $bunCli run test",
      "& $bunCli run validate",
      "& $bunCli run release:check",
      "& $bunCli run tag:check -- v0.6.0",
      "& $gitCli diff --check",
    ]) nativeChecked(windowsVerification, command);
    expect(windowsVerification).toContain("Get-Command git");
    expect(windowsVerification).toContain("$gitCli");
    expect(windowsVerification).toMatch(/& \$bunCli \$runtimeInspector[^\r\n]*\r?\n\s*Assert-NativeSuccess/);
    expect(readme).not.toMatch(/^\s*bun\s+(?:install|run)\b/gm);
    expect(readme).not.toMatch(/^\s*(?:bun|git|codex)\s+(?:--version|plugin|install|run|diff)\b/gm);
    const uninstallSectionStart = readme.indexOf("## Reconfigure, uninstall, and troubleshooting");
    const uninstallSectionEnd = readme.indexOf("\n## MCP tools", uninstallSectionStart + "## Reconfigure, uninstall, and troubleshooting".length);
    expect(uninstallSectionStart).toBeGreaterThanOrEqual(0);
    expect(uninstallSectionEnd).toBeGreaterThan(uninstallSectionStart);
    const uninstallSection = readme.slice(uninstallSectionStart, uninstallSectionEnd);
    const parentUninstall = uninstallSection.indexOf("uninstall_client_adapter");
    const fullExit = uninstallSection.indexOf("Fully exit Codex");
    const mcpEnded = uninstallSection.indexOf("active MCP");
    const cliRemove = uninstallSection.indexOf("& $codexCli plugin remove sol-advisor@sol-advisor");
    expect(parentUninstall).toBeGreaterThanOrEqual(0);
    expect(fullExit).toBeGreaterThan(parentUninstall);
    expect(mcpEnded).toBeGreaterThan(fullExit);
    expect(cliRemove).toBeGreaterThan(mcpEnded);
    expect(uninstallSection.replace(/\s+/g, " ")).toMatch(/do not run `plugin remove` while active codex or mcp is still running/i);
    expect(readme).toContain("Get-Command codex");
    expect(readme).toContain("Join-Path $env:LOCALAPPDATA 'OpenAI\\Codex\\bin'");
    expect(readme).toContain("Get-ChildItem");
    expect(readme).toContain("-Recurse");
    expect(readme).toContain("Sort-Object LastWriteTime -Descending");
    expect(readme).toContain("probeExitCode -eq 0");
    expect(readme).toContain("throw");
    expect(readme).toContain("If you open a new terminal, repeat the CLI resolution and preflight");
    expect(readme).toContain("$repoRoot = (Resolve-Path");
    expect(readme).toContain("& $codexCli plugin marketplace add $repoRoot");
    expect(readme).toContain("& $codexCli plugin add sol-advisor@sol-advisor");
    expect(readme).toContain("& $codexCli plugin remove sol-advisor@sol-advisor");
    expect(readme).not.toMatch(/^\s*codex\s+plugin\s+(?:marketplace add|add|remove)\b/gm);
    expect(readme).not.toMatch(/cfac/i);
    expect(readme).not.toMatch(/[0-9a-f]{32,}/i);
    expect(readme).toContain("sol_advisor_routine");
    expect(readme).toContain("sol_advisor_high");
    expect(readme).toContain("sol_advisor_advisor");
    expect(readme).toContain(".agents/plugins/marketplace.json");
    expect(readme).toContain("restart Codex");
    expect(readme).toContain("new task");
    expect(readme).toContain("app-task lane");
    expect(readme).toContain("behaviorally read-only");
    expect(readme).toContain("workspace-write");
    expect(readme).toContain("& $codexCli --version");
    expect(readme).toContain("& $codexCli plugin --help");
    expect(readme).toContain("& $bunCli --version");
    expect(readme).toContain("Access is denied");
    expect(readme).toContain("拒绝访问");
    expect(readme).toContain("WindowsApps");
    expect(readme).toContain("stop immediately");
    expect(readme).toContain("$plugin-creator");
    expect(readme).toContain("scripts/update_plugin_cachebuster.py");
    expect(readme).toContain("current checkout");
    expect(readme).toContain("plugin marketplace add $repoRoot");
    expect(readme).not.toMatch(/[A-Z]:\\Users\\/i);
    expect(readme).not.toMatch(/[A-Z]:\\Codex_Projects\\/i);
    expect(readme).not.toMatch(/\bpython(?:3)?(?:\.exe)?\b/i);
    for (const removed of [
      "Cursor", "VS Code", "GitHub Copilot", "Kiro",
      "portable Agent Plugins", "sol_advisor_terra_implementer", "sol_advisor_sol_reviewer",
      "automatic visual Luna", "visual-required", "install-agents.sh", "verify.sh",
    ]) expect(readme).not.toContain(removed);
  });

  test("marks every historical design and plan with the active Codex-only banner", () => {
    for (const document of historicalGuidance) {
      const absolutePath = join(import.meta.dir, "..", document.path);
      const content = readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
      const lines = content.split("\n");
      const titleIndex = lines.findIndex((line) => line.startsWith("# "));
      expect(titleIndex).toBe(0);
      const banner = lines.slice(titleIndex + 1, titleIndex + 8).join("\n");
      expect(banner).toContain(`> **${document.heading}:**`);
      expect(banner).toContain(`[Codex-Only Sol Advisor Repair Design](${document.link})`);
      expect(banner).toContain("Cross-client, compatibility-role, and automatic visual Luna decisions");
      expect(banner).toContain("must not be implemented");
      if (document.heading === "Partially Superseded") {
        expect(banner).toContain("explicit separation between the native routine role and the opt-in app-task lane");
      }
    }
  });
});
