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
  const verifier=read("scripts","verify.sh");
  const readme=readFileSync(join(import.meta.dir,"..","README.md"),"utf8");
  for(const text of [setup,skill,contract,roleContracts,agent,verifier,readme]) expect(text).not.toContain("visual-required");
  expect(contract).toContain("only when the user's current request explicitly authorizes it");
  expect(skill).toContain("only when the user's current request explicitly says");
  expect(roleContracts).toContain("current request explicitly authorizes");
  expect(readme).toContain("Use the Luna task lane only with current-request authorization");
 });

 test("plugin metadata describes an explicit Luna task lane",()=>{
  const codex=JSON.parse(read(".codex-plugin","plugin.json"));
  const standard=JSON.parse(read("plugin.json"));
  expect(codex.description).toContain("explicit opt-in");
  expect(codex.interface.defaultPrompt.join(" ")).toContain("explicitly authorize");
  expect(standard.description).toContain("separate explicit Codex Luna app-task lane");
  expect(JSON.stringify({codex,standard})).not.toContain("visual-required");
 });

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

 test("shell verifier compares the three metadata versions instead of a release literal",()=>{
  const verifier=read("scripts","verify.sh");
  expect(verifier).toContain("standard_manifest=$plugin_dir/plugin.json");
  expect(verifier).toContain("package_manifest=$repo_dir/package.json");
  expect(verifier).toContain('"$manifest" "$standard_manifest" "$package_manifest"');
  expect(verifier).toContain("codex_version=$(jq -r '.version // empty' \"$manifest\")");
  expect(verifier).toContain("standard_version=$(jq -r '.version // empty' \"$standard_manifest\")");
  expect(verifier).toContain("package_version=$(jq -r '.version // empty' \"$package_manifest\")");
  expect(verifier).toContain('[ "$codex_version" = "$standard_version" ]');
  expect(verifier).toContain('[ "$codex_version" = "$package_version" ]');
  expect(verifier).not.toContain('= 0.5.0');
 });
});
