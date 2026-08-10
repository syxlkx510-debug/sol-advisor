import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, rmdirSync, symlinkSync, writeFileSync, existsSync, realpathSync, chmodSync, statSync, renameSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { __resetDataPinForTests, __setManifestWriteFaultForTests, callTool, handle, renderAdapter } from "./server";
import * as server from "./server";
import * as packagedVersion from "./version";
import { __setWindowsAclReaderForTests } from "./private-directory";

let root="", data="", workspace="";
const base=(scope:"project"|"user"="project")=>({client:"codex",scope,workspace,orchestrator:{model:"inherit",recommendation:{model:"gpt-5.6-sol",effort:"high"}},roles:{routine:{model:"gpt-5.6-luna",effort:"max"},high:{model:"gpt-5.6-terra",effort:"xhigh"},advisor:{model:"gpt-5.6-sol",effort:"xhigh",readonly:true}}});
const setHomeResolverForTests=(resolver?:()=>string)=>(server as any).__setHomeResolverForTests?.(resolver);
const privateWindowsAcl=()=>({owner:"S-1-5-21-test",currentUser:"S-1-5-21-test",rules:[{identity:"S-1-5-21-test",access:"Allow" as const,rights:2032127}]});
beforeEach(()=>{setHomeResolverForTests();__resetDataPinForTests();__setWindowsAclReaderForTests(privateWindowsAcl);root=realpathSync(mkdtempSync(join(tmpdir(),"sol-advisor-test-")));data=join(root,"data");workspace=join(root,"work");mkdirSync(data);if(process.platform!=="win32")chmodSync(data,0o700);mkdirSync(workspace);process.env.PLUGIN_DATA=data;});
afterEach(()=>{__setManifestWriteFaultForTests(undefined);__setWindowsAclReaderForTests();__resetDataPinForTests();setHomeResolverForTests();delete process.env.PLUGIN_DATA;rmSync(root,{recursive:true,force:true});});

describe("MCP protocol",()=>{
 test("derives product version only from a valid packaged Codex manifest",()=>{
  const productVersionFromManifest=(packagedVersion as any).productVersionFromManifest;
  expect(productVersionFromManifest).toBeTypeOf("function");
  expect(productVersionFromManifest({version:"0.6.0+codex.local-1"})).toBe("0.6.0");
  for(const manifest of [null,[],{}, {version:undefined},{version:1},{version:"0.6.0+build.1"},{version:"01.6.0"},{version:"0.6.0+codex.BAD"}]){
   let message="";try{productVersionFromManifest(manifest);}catch(error){message=error instanceof Error?error.message:String(error);}
   expect(message).toBe("invalid Codex plugin manifest");
  }
 });
 test("reports and saves the packaged Codex manifest base version",async()=>{
  const codexManifest=JSON.parse(readFileSync(join(import.meta.dir,"..",".codex-plugin","plugin.json"),"utf8"));
  const expectedProductVersion="0.6.0";
  const initialized:any=await handle({jsonrpc:"2.0",id:8,method:"initialize",params:{protocolVersion:"2025-03-26"}});
  const saved:any=await callTool("save_preferences",base());
  expect(initialized.result.serverInfo.version).toBe(expectedProductVersion);
  expect(saved.preferences.pluginVersion).toBe(expectedProductVersion);
  expect(expectedProductVersion).toBe(String(codexManifest.version).split("+",1)[0]);
 });
 test("initialize ping and tools",async()=>{
  expect((await handle({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"x"}}))?.result.serverInfo.name).toBe("sol-advisor");
  expect((await handle({jsonrpc:"2.0",id:10,method:"initialize",params:{protocolVersion:"unknown-future"}}))?.result.protocolVersion).toBe("2025-03-26");
  expect((await handle({jsonrpc:"2.0",id:2,method:"ping"}))?.result).toEqual({});
  expect((await handle({jsonrpc:"2.0",id:3,method:"tools/list"}))?.result.tools).toHaveLength(8);
  expect((await handle({jsonrpc:"2.0",id:4,method:"nope"}))?.error.message).toContain("method not found");
  expect((await handle({jsonrpc:"2.0",id:5,method:"nope"}))?.error.code).toBe(-32601);
  expect((await handle({jsonrpc:"2.0",id:6,method:"tools/call",params:{}}))?.error.code).toBe(-32602);
  expect(await handle({jsonrpc:"2.0",method:"ping"})).toBeNull();
  const toolFailure:any=await handle({jsonrpc:"2.0",id:7,method:"tools/call",params:{name:"get_preferences",arguments:{}}});expect(toolFailure.error).toBeUndefined();expect(toolFailure.result.isError).toBe(true);
 });
 test("actual stdio server accepts newline-delimited JSON",async()=>{
  const proc=Bun.spawn([process.execPath,join(import.meta.dir,"server.ts")],{env:{...process.env,PLUGIN_DATA:data},stdin:"pipe",stdout:"pipe",stderr:"pipe"});
  proc.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"ping"})+"\n"); proc.stdin.end();
  const out=await new Response(proc.stdout).text(); expect(await proc.exited).toBe(0); expect(JSON.parse(out).result).toEqual({});
 });
});

describe("PLUGIN_DATA boundary",()=>{
 test("rejects root home plugin root and symlink ancestors without chmod",async()=>{
  if(process.platform==="win32"){
   __setWindowsAclReaderForTests(()=>({owner:"S-1-5-21-test",currentUser:"S-1-5-21-test",rules:[{identity:"S-1-1-0",access:"Allow",rights:1}]}));
   await expect(callTool("get_setup_status")).rejects.toThrow("must be private");__setWindowsAclReaderForTests(privateWindowsAcl);await callTool("get_setup_status");
  }else{chmodSync(data,0o755);await expect(callTool("get_setup_status")).rejects.toThrow("must be private");expect(statSync(data).mode&0o777).toBe(0o755);chmodSync(data,0o700);await callTool("get_setup_status");}
  for(const bad of [realpathSync(process.platform==="win32"?process.env.SystemDrive+"\\":"/"),realpathSync(homedir()),realpathSync(join(import.meta.dir,".."))]){process.env.PLUGIN_DATA=bad;await expect(callTool("get_setup_status")).rejects.toThrow("cannot be");}
  const actual=join(root,"actual");mkdirSync(join(actual,"data"),{recursive:true});symlinkSync(actual,join(root,"linked"),process.platform==="win32"?"junction":undefined);process.env.PLUGIN_DATA=join(root,"linked","data");await expect(callTool("get_setup_status")).rejects.toThrow("symlink ancestor");process.env.PLUGIN_DATA=data;
 });
 test("pins PLUGIN_DATA device and inode for process lifetime",async()=>{
  await callTool("get_setup_status");renameSync(data,join(root,"old-data"));mkdirSync(data);if(process.platform!=="win32")chmodSync(data,0o700);await expect(callTool("get_setup_status")).rejects.toThrow("identity changed");
 });
});

describe("configuration",()=>{
 test("missing corrupt old and ready states",async()=>{
  expect((await callTool("get_setup_status") as any).status).toBe("missing");
  mkdirSync(data,{recursive:true});writeFileSync(join(data,"config.json"),"{");expect((await callTool("get_setup_status") as any).status).toBe("corrupt");
  writeFileSync(join(data,"config.json"),JSON.stringify({schemaVersion:0}));expect((await callTool("get_setup_status") as any).status).toBe("schema-old");
  await callTool("save_preferences",base());expect((await callTool("get_setup_status") as any).status).toBe("ready");
 });
 test("validate_configuration without a workspace retains ready logical validity",async()=>{
  await callTool("save_preferences",base());const result:any=await callTool("validate_configuration",{});expect(result.status).toBe("ready");expect(result.valid).toBe(true);expect(result.preview).toBeUndefined();
 });
 test("rejects secrets and creates update backup",async()=>{
  await expect(callTool("save_preferences",{...base(),roles:{...(base() as any).roles,advisor:{...(base() as any).roles.advisor,token:"SECRET2"}}})).rejects.toThrow("forbidden");
  await callTool("save_preferences",base()); expect(readFileSync(join(data,"config.json"),"utf8")).not.toContain("SECRET");
  await callTool("save_preferences",base());expect(existsSync(join(data,"backups"))).toBe(true);
 });
  test("rejects every non-Codex client and invalid values fail closed",async()=>{
   for(const client of ["cursor","vscode","github-copilot","kiro"])await expect(callTool("save_preferences",{...base(),client})).rejects.toThrow("client must be codex");
   const blank:any=base();blank.roles.high.model="";await expect(callTool("save_preferences",blank)).rejects.toThrow("exact");
   await expect(callTool("get_setup_status",{extra:true})).rejects.toThrow("unknown");
  });
  test("requires an exact native effort for every configured role without requiring an orchestrator recommendation effort",async()=>{
   const saved:any=await callTool("save_preferences",base());
   for(const role of ["routine","high","advisor"] as const){
    const missing:any=structuredClone(saved.preferences);delete missing.roles[role].effort;
    expect((server as any).validatePreferences(missing)).toContain(`roles.${role}.effort must be an exact, non-empty client-native identifier`);
    const input:any=base();delete input.roles[role].effort;
    await expect(callTool("save_preferences",input)).rejects.toThrow(`roles.${role}.effort must be an exact, non-empty client-native identifier`);
   }
   for(const effort of ["","   ","xhigh\u0001"]){
    const invalid:any=structuredClone(saved.preferences);invalid.roles.high.effort=effort;
    expect((server as any).validatePreferences(invalid)).toContain("roles.high.effort must be an exact, non-empty client-native identifier");
    const input:any=base();input.roles.high.effort=effort;
    await expect(callTool("save_preferences",input)).rejects.toThrow("roles.high.effort must be an exact, non-empty client-native identifier");
   }
   const noRecommendationEffort:any=structuredClone(saved.preferences);delete noRecommendationEffort.orchestrator.recommendation.effort;
   expect((server as any).validatePreferences(noRecommendationEffort)).toEqual([]);
   const input:any=base();delete input.orchestrator.recommendation.effort;
   await expect(callTool("save_preferences",input)).resolves.toMatchObject({saved:true});
  });
  test("treats a persisted profile missing a configured role effort as corrupt",async()=>{
   await callTool("save_preferences",base());const path=join(data,"config.json"),stored=JSON.parse(readFileSync(path,"utf8"));delete stored.profiles[stored.activeProfile].roles.advisor.effort;writeFileSync(path,JSON.stringify(stored));
   expect((await callTool("get_setup_status") as any).status).toBe("corrupt");await expect(callTool("get_preferences")).rejects.toThrow("corrupt");
  });
  test("requires exact model and effort fields in every save_preferences role schema",()=>{
   const savePreferences=(server as any).tools.find((tool:any)=>tool.name==="save_preferences");
   for(const role of ["routine","high","advisor"]){
    expect(savePreferences.inputSchema.properties.roles.properties[role].required).toEqual(["model","effort"]);
   }
  });
  test("keeps the explicit Luna task lane and rejects activation routing",async()=>{
  const saved:any=await callTool("save_preferences",{...base(),appTaskLane:{enabled:true}});
  expect(saved.preferences.appTaskLane).toEqual({enabled:true,model:"gpt-5.6-luna",effort:"max"});
  expect((await callTool("get_preferences") as any).appTaskLane).toEqual({enabled:true,model:"gpt-5.6-luna",effort:"max"});
  expect((await callTool("get_setup_status") as any).status).toBe("ready");
  await expect(callTool("save_preferences",{...base(),appTaskLane:{enabled:true,activation:"visual-required"}})).rejects.toThrow("unknown appTaskLane field: activation");
 });
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
 test("tampered persisted profiles with unknown fields fail closed",async()=>{
  await callTool("save_preferences",base());const path=join(data,"config.json"),stored=JSON.parse(readFileSync(path,"utf8"));stored.profiles[stored.activeProfile].roles.routine.apiToken="MUST_NOT_DISCLOSE";writeFileSync(path,JSON.stringify(stored));
  expect((await callTool("get_setup_status") as any).status).toBe("corrupt");await expect(callTool("get_preferences")).rejects.toThrow("corrupt");
 });
 test("confirmed reset purges config empty manifest and backups",async()=>{
  await callTool("save_preferences",base());await callTool("save_preferences",base());writeFileSync(join(data,"managed-files.json"),JSON.stringify({schemaVersion:1,files:[],updatedAt:"x"}));expect(existsSync(join(data,"backups"))).toBe(true);
  const out:any=await callTool("reset_configuration",{confirmationToken:"RESET SOL ADVISOR CONFIGURATION"});expect(out.purged).toBe(true);for(const name of ["config.json","managed-files.json","backups"])expect(existsSync(join(data,name))).toBe(false);
 });

 test("tampered recovery journal cannot mutate an arbitrary path",async()=>{
  await callTool("save_preferences",base());const stored=JSON.parse(readFileSync(join(data,"config.json"),"utf8")),sentinel=join(root,"sentinel");writeFileSync(sentinel,"KEEP");const journal={schemaVersion:1,operation:"install",phase:"targets-committed",committed:1,entries:[{target:sentinel,stage:join(root,"evil.stage"),newHash:"a".repeat(64),wasMissing:true}],manifestExisted:false,originalManifest:"",newManifest:"{}",profileKey:stored.activeProfile};writeFileSync(join(data,"transaction.json"),JSON.stringify(journal));await expect(callTool("get_setup_status")).rejects.toThrow("pending transaction recovery required");await expect(callTool("save_preferences",base())).rejects.toThrow("transaction journal");expect(readFileSync(sentinel,"utf8")).toBe("KEEP");expect(existsSync(join(data,"transaction.json"))).toBe(true);
 });

 test("preexisting backups symlink is rejected without external writes",async()=>{
  await callTool("save_preferences",base());const external=join(root,"external-backups");mkdirSync(external);symlinkSync(external,join(data,"backups"),process.platform==="win32"?"junction":undefined);await expect(callTool("save_preferences",base())).rejects.toThrow("backups must be a real directory");expect(existsSync(join(external,"config.json.bak"))).toBe(false);expect(readdirSync(external)).toHaveLength(0);
 });

});

describe("adapter rendering and lifecycle",()=>{
 test("renders only the exact three Codex TOML roles",async()=>{
  const saved:any=await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});const workspacePath=realpathSync(workspace);
  expect((renderAdapter(saved.preferences,workspace,{registerPreview:false}) as any).confirmationToken).toBeUndefined();
  expect(saved.preferences.profileKey).toBe(`codex:project:${workspacePath}`);
  expect(preview.files.map((file:any)=>({role:file.role,path:file.path,content:file.content}))).toEqual([
   {role:"routine",path:join(workspacePath,".codex","agents","sol-advisor-routine.toml"),content:'# sol-advisor-managed:v1\nname = "sol_advisor_routine"\ndescription = "Sol Advisor routine role"\nmodel = "gpt-5.6-luna"\nmodel_reasoning_effort = "max"\ndeveloper_instructions = "Implement bounded, well-specified, mechanical work. Preserve the settled architecture, owned files, interfaces, and concurrent edits. Run requested checks and report evidence."\n'},
   {role:"high",path:join(workspacePath,".codex","agents","sol-advisor-high.toml"),content:'# sol-advisor-managed:v1\nname = "sol_advisor_high"\ndescription = "Sol Advisor high role"\nmodel = "gpt-5.6-terra"\nmodel_reasoning_effort = "xhigh"\ndeveloper_instructions = "Implement complex, security-sensitive, algorithmic, debugging, or wide-blast-radius work within the settled architecture. Surface ambiguity, preserve concurrent edits, and report verification evidence."\n'},
   {role:"advisor",path:join(workspacePath,".codex","agents","sol-advisor-advisor.toml"),content:'# sol-advisor-managed:v1\nname = "sol_advisor_advisor"\ndescription = "Sol Advisor advisor role"\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "xhigh"\nsandbox_mode = "read-only"\ndeveloper_instructions = "Review the architecture, specification, actual diff, and verification evidence. Remain behaviorally read-only. Return ship, fix-first, or rethink; never implement fixes."\n'},
   ]);
   for(const file of preview.files)expect(file.content).toContain("model_reasoning_effort");
   expect(preview.warnings).toEqual([]);
  });
 test("validate_configuration returns a non-installable inspection preview",async()=>{
  await callTool("save_preferences",base());const inspected:any=await callTool("validate_configuration",{workspace});
  expect(inspected.preview.confirmationToken).toBeUndefined();expect(inspected.preview.userScopeConfirmationToken).toBeUndefined();expect(inspected.preview.expiresAt).toBeUndefined();
  await expect(callTool("install_client_adapter",{workspace,confirmationToken:inspected.preview.confirmationToken})).rejects.toThrow("exact unexpired");
 });
 test("validate_configuration reports missing, conflict, current, and stale adapter files",async()=>{
  await callTool("save_preferences",base());let inspected:any=await callTool("validate_configuration",{workspace});expect(inspected.adapterStatus).toBe("missing");expect(inspected.files.map((file:any)=>file.state)).toEqual(["missing","missing","missing"]);
  let preview:any=await callTool("render_client_adapter",{workspace});mkdirSync(dirname(preview.files[0].path),{recursive:true});writeFileSync(preview.files[0].path,"USER OWNED");
  inspected=await callTool("validate_configuration",{workspace});expect(inspected.adapterStatus).toBe("conflict");expect(inspected.files[0]).toEqual({role:"routine",path:preview.files[0].path,state:"conflict"});
  rmSync(preview.files[0].path);preview=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});
  inspected=await callTool("validate_configuration",{workspace});expect(inspected.adapterStatus).toBe("current");expect(inspected.files.map((file:any)=>file.state)).toEqual(["current","current","current"]);
  writeFileSync(preview.files[0].path,`${preview.files[0].content}changed`);inspected=await callTool("validate_configuration",{workspace});expect(inspected.adapterStatus).toBe("stale");expect(inspected.files[0].state).toBe("stale");
 });
 test("requires exact consent, refuses conflict, backs up updates, and uninstalls exact files",async()=>{
  await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});
  await expect(callTool("install_client_adapter",{workspace,confirmationToken:"yes"})).rejects.toThrow("exact unexpired");
  mkdirSync(join(workspace,".codex","agents"),{recursive:true});writeFileSync(preview.files[0].path,"mine");
  await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow("unchanged target state");rmSync(preview.files[0].path);
  const installed:any=await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});expect(installed.installed).toHaveLength(3);
  await callTool("save_preferences",{...base(),roles:{...(base() as any).roles,routine:{model:"gpt-5.6-terra-2",effort:"high"}}});const p2:any=await callTool("render_client_adapter",{workspace});const updated:any=await callTool("install_client_adapter",{workspace,confirmationToken:p2.confirmationToken});expect(updated.backups.length).toBe(3);
  const ask:any=await callTool("uninstall_client_adapter",{});expect(ask.requiresConfirmation).toBe(true);const gone:any=await callTool("uninstall_client_adapter",{confirmationToken:ask.confirmationToken});expect(gone.removed).toHaveLength(3);expect(gone.removed.every((x:string)=>!existsSync(x))).toBe(true);
 });
 test("refuses traversal, symlink paths, and modified managed uninstall",async()=>{
  await callTool("save_preferences",base());await expect(callTool("render_client_adapter",{workspace:join(workspace,"..","missing")})).rejects.toThrow();
  mkdirSync(join(workspace,".codex"));symlinkSync(root,join(workspace,".codex","agents"),process.platform==="win32"?"junction":undefined);await expect(callTool("render_client_adapter",{workspace})).rejects.toThrow("symlink");
  rmdirSync(join(workspace,".codex","agents"));const preview:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});writeFileSync(preview.files[0].path,readFileSync(preview.files[0].path,"utf8")+"changed");const ask:any=await callTool("uninstall_client_adapter",{});await expect(callTool("uninstall_client_adapter",{confirmationToken:ask.confirmationToken})).rejects.toThrow("changed");
 });
 test("user scope requires separate consent",async()=>{
   await callTool("save_preferences",base("user"));const p:any=await callTool("render_client_adapter",{workspace});await expect(callTool("install_client_adapter",{workspace,confirmationToken:p.confirmationToken})).rejects.toThrow("separate exact user-scope");
 });
 test("preview nonce is one-time and reset refuses live installs",async()=>{
  await callTool("save_preferences",base());const p:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:p.confirmationToken});
  await expect(callTool("install_client_adapter",{workspace,confirmationToken:p.confirmationToken})).rejects.toThrow("one-time");
  await expect(callTool("reset_configuration",{confirmationToken:"RESET SOL ADVISOR CONFIGURATION"})).rejects.toThrow("uninstall");
 });



 test("install detects target swap before quarantine and restores the swapped file",async()=>{
  await callTool("save_preferences",base());let preview:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});await callTool("save_preferences",{...base(),roles:{...(base() as any).roles,routine:{model:"gpt-5.6-terra-updated",effort:"high"}}});preview=await callTool("render_client_adapter",{workspace});const target=preview.files[0].path,saved=`${target}.attacker-saved`;__setManifestWriteFaultForTests(point=>{if(point==="install-before-quarantine-1"){renameSync(target,saved);writeFileSync(target,"IMPOSTOR")}});await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow("quarantine identity/hash mismatch");expect(readFileSync(target,"utf8")).toBe("IMPOSTOR");expect(existsSync(saved)).toBe(true);expect(existsSync(join(data,"transaction.json"))).toBe(true);
 });
 test("uninstall detects target swap before quarantine and restores the swapped file",async()=>{
  await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});const ask:any=await callTool("uninstall_client_adapter",{}),target=preview.files[0].path,saved=`${target}.attacker-saved`;__setManifestWriteFaultForTests(point=>{if(point==="uninstall-before-quarantine-1"){renameSync(target,saved);writeFileSync(target,"IMPOSTOR")}});await expect(callTool("uninstall_client_adapter",{confirmationToken:ask.confirmationToken})).rejects.toThrow("quarantine identity/hash mismatch");expect(readFileSync(target,"utf8")).toBe("IMPOSTOR");expect(existsSync(saved)).toBe(true);expect(existsSync(join(data,"transaction.json"))).toBe(true);
 });
 test("target appearing after preview is never clobbered",async()=>{
  await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});__setManifestWriteFaultForTests(point=>{if(point==="install-before-targets"){mkdirSync(join(workspace,".codex","agents"),{recursive:true});writeFileSync(preview.files[0].path,"ATTACKER")}});await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow("rollback incomplete");expect(readFileSync(preview.files[0].path,"utf8")).toBe("ATTACKER");expect(preview.files.slice(1).every((f:any)=>!existsSync(f.path))).toBe(true);
 });
 test("install faults after each target and manifest commit roll back zero partial mutation",async()=>{
  await callTool("save_preferences",base());for(const fault of ["install-target-1","install-target-2","install-target-3","install-manifest-commit"]){const preview:any=await callTool("render_client_adapter",{workspace});__setManifestWriteFaultForTests(point=>{if(point===fault)throw new Error(`injected ${fault}`)});await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow(fault);expect(preview.files.every((f:any)=>!existsSync(f.path))).toBe(true);expect(existsSync(join(data,"managed-files.json"))).toBe(false);expect(existsSync(join(data,"transaction.json"))).toBe(false);}
  __setManifestWriteFaultForTests(undefined);
 });
 test("uninstall faults quarantine transaction and restore all files",async()=>{
  await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});for(const fault of ["uninstall-target-1","uninstall-target-2","uninstall-target-3","uninstall-manifest-commit"]){const ask:any=await callTool("uninstall_client_adapter",{});__setManifestWriteFaultForTests(point=>{if(point===fault)throw new Error(`injected ${fault}`)});await expect(callTool("uninstall_client_adapter",{confirmationToken:ask.confirmationToken})).rejects.toThrow(fault);for(const f of preview.files)expect(readFileSync(f.path,"utf8")).toBe(f.content);expect(JSON.parse(readFileSync(join(data,"managed-files.json"),"utf8")).files).toHaveLength(3);expect(existsSync(join(data,"transaction.json"))).toBe(false);}
  __setManifestWriteFaultForTests(undefined);
 });
 test("durable journal recovers simulated install and uninstall crashes",async()=>{
   await callTool("save_preferences",base());let preview:any=await callTool("render_client_adapter",{workspace});__setManifestWriteFaultForTests(point=>{if(point==="install-target-2")throw new Error("__SIMULATED_CRASH__")});await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow("SIMULATED_CRASH");expect(existsSync(join(data,"transaction.json"))).toBe(true);__setManifestWriteFaultForTests(undefined);await callTool("save_preferences",base());expect((await callTool("get_setup_status") as any).status).toBe("ready");expect(preview.files.every((f:any)=>!existsSync(f.path))).toBe(true);
   preview=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken});const ask:any=await callTool("uninstall_client_adapter",{});__setManifestWriteFaultForTests(point=>{if(point==="uninstall-target-2")throw new Error("__SIMULATED_CRASH__")});await expect(callTool("uninstall_client_adapter",{confirmationToken:ask.confirmationToken})).rejects.toThrow("SIMULATED_CRASH");expect(existsSync(join(data,"transaction.json"))).toBe(true);__setManifestWriteFaultForTests(undefined);await callTool("save_preferences",base());expect((await callTool("get_setup_status") as any).status).toBe("ready");for(const f of preview.files)expect(readFileSync(f.path,"utf8")).toBe(f.content);
  });

 test("read-only tools fail closed without recovering a pending transaction",async()=>{
  await callTool("save_preferences",base());const preview:any=await callTool("render_client_adapter",{workspace});__setManifestWriteFaultForTests(point=>{if(point==="install-target-2")throw new Error("__SIMULATED_CRASH__")});await expect(callTool("install_client_adapter",{workspace,confirmationToken:preview.confirmationToken})).rejects.toThrow("SIMULATED_CRASH");__setManifestWriteFaultForTests(undefined);
  const snapshot=(path:string)=>existsSync(path)?{exists:true,bytes:readFileSync(path,"utf8")}:{exists:false,bytes:undefined};const before=()=>({targets:preview.files.map((file:any)=>({path:file.path,...snapshot(file.path)})),manifest:snapshot(join(data,"managed-files.json")),journal:snapshot(join(data,"transaction.json"))}),initial=before();expect(initial.journal.exists).toBe(true);
  for(const [name,args] of [["get_setup_status",{}],["get_preferences",{}],["render_client_adapter",{workspace}],["validate_configuration",{workspace}]] as const){await expect(callTool(name,args)).rejects.toThrow("pending transaction recovery required");expect(before()).toEqual(initial);}
  await expect(callTool("save_preferences",base())).resolves.toMatchObject({saved:true});expect(preview.files.every((file:any)=>!existsSync(file.path))).toBe(true);expect(existsSync(join(data,"managed-files.json"))).toBe(false);expect(existsSync(join(data,"transaction.json"))).toBe(false);
 });

 test("separate user-scope Codex profiles cannot take missing paths owned by another profile",async()=>{
  const home=join(root,"home"),workspaceA=join(root,"workspace-a"),workspaceB=join(root,"workspace-b");mkdirSync(home);mkdirSync(workspaceA);mkdirSync(workspaceB);setHomeResolverForTests(()=>home);
  const savedA:any=await callTool("save_preferences",{...base("user"),workspace:workspaceA}),previewA:any=await callTool("render_client_adapter",{workspace:workspaceA});expect(previewA.files.every((file:any)=>file.path.startsWith(join(realpathSync(home),".codex","agents")))).toBe(true);
  await callTool("install_client_adapter",{workspace:workspaceA,confirmationToken:previewA.confirmationToken,userScopeConfirmationToken:previewA.userScopeConfirmationToken});const before=previewA.files.map((file:any)=>readFileSync(file.path,"utf8"));rmSync(previewA.files[0].path);expect(existsSync(previewA.files[0].path)).toBe(false);
  const savedB:any=await callTool("save_preferences",{...base("user"),workspace:workspaceB}),validatedB:any=await callTool("validate_configuration",{workspace:workspaceB});expect(validatedB.adapterStatus).toBe("conflict");expect(validatedB.files[0]).toEqual({role:previewA.files[0].role,path:previewA.files[0].path,state:"conflict"});
  const previewB:any=await callTool("render_client_adapter",{workspace:workspaceB});await expect(callTool("install_client_adapter",{workspace:workspaceB,confirmationToken:previewB.confirmationToken,userScopeConfirmationToken:previewB.userScopeConfirmationToken})).rejects.toThrow("different profile");
  expect(await callTool("uninstall_client_adapter",{})).toEqual({removed:[]});const manifest=JSON.parse(readFileSync(join(data,"managed-files.json"),"utf8"));expect(manifest.files.every((file:any)=>file.profileKey===savedA.profileKey)).toBe(true);expect(previewA.files.slice(1).map((file:any)=>readFileSync(file.path,"utf8"))).toEqual(before.slice(1));expect(savedB.profileKey).not.toBe(savedA.profileKey);
 });

 test("duplicate manifest path ownership is rejected",async()=>{
  await callTool("save_preferences",base());const p:any=await callTool("render_client_adapter",{workspace});await callTool("install_client_adapter",{workspace,confirmationToken:p.confirmationToken});const path=join(data,"managed-files.json"),manifest=JSON.parse(readFileSync(path,"utf8"));manifest.files.push({...manifest.files[0],profileKey:"other:profile"});writeFileSync(path,JSON.stringify(manifest));await expect(callTool("uninstall_client_adapter",{})).rejects.toThrow("duplicate path ownership");
 });

});
