import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const plugin = join(import.meta.dir, "..", "plugins", "sol-advisor");
const read = (...parts: string[]) => readFileSync(join(plugin, ...parts), "utf8");

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
    expect(skill).toContain("without model or effort overrides");
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
});
