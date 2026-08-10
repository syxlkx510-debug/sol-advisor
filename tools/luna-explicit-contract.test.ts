import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const plugin=join(import.meta.dir,"..","plugins","sol-advisor");
const read=(...parts:string[])=>readFileSync(join(plugin,...parts),"utf8");

describe("explicit Luna task contract",()=>{
 test("active contracts require current-request authorization without visual activation",()=>{
  const setup=read("skills","setup","SKILL.md");
  const skill=read("skills","orchestration","SKILL.md");
  const contract=read("skills","orchestration","references","luna-task-lane.md");
  const roleContracts=read("skills","orchestration","references","role-contracts.md");
  const agent=read("skills","orchestration","agents","openai.yaml");
  for(const text of [setup,skill,contract,roleContracts,agent]) expect(text).not.toContain("visual-required");
  expect(contract).toContain("only when the user's current request explicitly authorizes it");
  expect(skill).toContain("only when the user's current request explicitly says");
  expect(roleContracts).toContain("current request explicitly authorizes");
 });

 test("Codex plugin metadata describes an explicit Luna task lane",()=>{
  const codex=JSON.parse(read(".codex-plugin","plugin.json"));
  expect(codex.description).toContain("explicit opt-in");
  expect(codex.interface.defaultPrompt.join(" ")).toContain("explicitly authorize");
  expect(JSON.stringify(codex)).not.toContain("visual-required");
 });

 test("allows an explicitly selected Luna native routine without selecting the app-task lane",()=>{
  const setup=read("skills","setup","SKILL.md");
  const skill=read("skills","orchestration","SKILL.md");
  expect(setup).toContain("including Luna");
  expect(setup).toContain("does not enable or select the app-task lane");
  expect(setup).not.toContain("never a fallback or a routine native role");
  expect(skill).toContain("may be backed by Luna");
  expect(skill).toContain("Model family does not select the execution lane");
 });
});
