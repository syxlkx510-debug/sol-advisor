import { statSync } from "node:fs";

type WindowsAclRule = {
  identity: string;
  access: "Allow" | "Deny";
  rights: number;
};

type WindowsAcl = {
  owner: string;
  currentUser: string;
  rules: WindowsAclRule[];
};

type WindowsAclReader = (path: string) => WindowsAcl;

const WINDOWS_SYSTEM_SID = "S-1-5-18";
const WINDOWS_ADMINISTRATORS_SID = "S-1-5-32-544";

function readWindowsAcl(path: string): WindowsAcl {
  const script = `
    $acl = Get-Acl -LiteralPath $env:SOL_ADVISOR_ACL_PATH
    $owner = ([System.Security.Principal.NTAccount]::new($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value
    $current = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object {
      [pscustomobject]@{
        identity = $_.IdentityReference.Value
        access = $_.AccessControlType.ToString()
        rights = [int64]$_.FileSystemRights
      }
    })
    [pscustomobject]@{ owner = $owner; currentUser = $current; rules = $rules } | ConvertTo-Json -Compress -Depth 4
  `;
  const result = Bun.spawnSync([
    "powershell.exe",
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ], { env: { ...process.env, SOL_ADVISOR_ACL_PATH: path } });
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString().trim() || result.stdout.toString().trim();
    throw new Error(`PLUGIN_DATA Windows ACL inspection failed${detail ? `: ${detail}` : ""}`);
  }
  try {
    const parsed = JSON.parse(result.stdout.toString()) as WindowsAcl;
    if (!parsed.owner || !parsed.currentUser || !Array.isArray(parsed.rules)) throw new Error("incomplete ACL result");
    return parsed;
  } catch (error) {
    throw new Error(`PLUGIN_DATA Windows ACL inspection returned invalid data: ${String(error)}`);
  }
}

let windowsAclReader: WindowsAclReader = readWindowsAcl;

export function __setWindowsAclReaderForTests(reader?: WindowsAclReader) {
  windowsAclReader = reader ?? readWindowsAcl;
}

export function assertPrivateDirectory(path: string) {
  if (process.platform !== "win32") {
    if ((statSync(path).mode & 0o077) !== 0) {
      throw new Error("PLUGIN_DATA must be private (no group/world permission bits)");
    }
    return;
  }

  const acl = windowsAclReader(path);
  const allowed = new Set([acl.currentUser, WINDOWS_SYSTEM_SID, WINDOWS_ADMINISTRATORS_SID]);
  if (!allowed.has(acl.owner)) throw new Error(`PLUGIN_DATA must be private (unexpected Windows owner ${acl.owner})`);
  const broadAllow = acl.rules.find(rule => rule.access === "Allow" && rule.rights !== 0 && !allowed.has(rule.identity));
  if (broadAllow) {
    throw new Error(`PLUGIN_DATA must be private (Windows ACL grants ${broadAllow.identity}; current ${acl.currentUser}; owner ${acl.owner})`);
  }
}
