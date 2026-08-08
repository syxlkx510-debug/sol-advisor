import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const plugin=join(import.meta.dir,"..","plugins","sol-advisor");
const read=(...parts:string[])=>readFileSync(join(plugin,...parts),"utf8");
const normalized=(text:string)=>text.replace(/\s+/g," ");

describe("visual-required Luna contract",()=>{
 test("setup records standing activation in the complete preference preview",()=>{
  const setup=read("skills","setup","SKILL.md");
  expect(setup).toContain('"activation": "visual-required"');
  expect(setup).toContain("standing authorization");
  expect(setup).toContain("complete logical preference object");
 });

 test("orchestration routes only material visual implementation and honors opt-out",()=>{
  const skill=read("skills","orchestration","SKILL.md");
  expect(skill).toContain('activation: "visual-required"');
  expect(normalized(skill)).toContain("material input to implementation or acceptance");
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

 test("package metadata exposes visual-required activation without changing native roles",()=>{
  const codex=JSON.parse(read(".codex-plugin","plugin.json"));
  const standard=JSON.parse(read("plugin.json"));
  const ui=read("skills","orchestration","agents","openai.yaml");
  expect(codex.interface.longDescription).toContain("visual-required");
  expect(standard.description).toContain("visual-required");
  expect(codex.interface.defaultPrompt.join(" ")).toContain("visual-required");
  expect(ui).toContain("visual-required");
  expect(ui).toContain("$orchestration");
 });
});
