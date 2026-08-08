import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __setWindowsAclReaderForTests, assertPrivateDirectory } from "./private-directory";

const roots: string[] = [];

afterEach(() => {
  __setWindowsAclReaderForTests();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function powershell(script: string, path: string) {
  const result = Bun.spawnSync([
    "powershell.exe",
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ], { env: { ...process.env, SOL_ADVISOR_TEST_PATH: path } });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || result.stdout.toString());
}

function setWindowsAcl(path: string, includeEveryone: boolean) {
  powershell(`
    $path = $env:SOL_ADVISOR_TEST_PATH
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($user)
    foreach ($sid in @($user.Value, 'S-1-5-18', 'S-1-5-32-544')) {
      $identity = [System.Security.Principal.SecurityIdentifier]::new($sid)
      $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
      $acl.AddAccessRule($rule)
    }
    if (${includeEveryone ? "$true" : "$false"}) {
      $everyone = [System.Security.Principal.SecurityIdentifier]::new('S-1-1-0')
      $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
        $everyone, 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
      $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $path -AclObject $acl
  `, path);
}

describe("private plugin data directories", () => {
  test.skipIf(process.platform !== "win32")("accepts a Windows ACL limited to the user and operating-system administrators", () => {
    const root = mkdtempSync(join(tmpdir(), "sol-advisor-private-"));
    roots.push(root);
    setWindowsAcl(root, false);
    expect(() => assertPrivateDirectory(root)).not.toThrow();
  }, 30_000);

  test.skipIf(process.platform !== "win32")("rejects a Windows ACL granting access to Everyone", () => {
    const root = mkdtempSync(join(tmpdir(), "sol-advisor-public-"));
    roots.push(root);
    setWindowsAcl(root, true);
    expect(() => assertPrivateDirectory(root)).toThrow("private");
  }, 30_000);
});
