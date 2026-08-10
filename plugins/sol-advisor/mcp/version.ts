const MAX_VERSION_LENGTH = 256;

function isDigit(value: string): boolean {
  return value >= "0" && value <= "9";
}

function isAsciiLetter(value: string): boolean {
  return (value >= "A" && value <= "Z") || (value >= "a" && value <= "z");
}

function isNumericIdentifier(value: string, start: number, end: number): boolean {
  if (start === end || (end - start > 1 && value[start] === "0")) return false;
  for (let index = start; index < end; index++) if (!isDigit(value[index]!)) return false;
  return true;
}

function isValidCore(value: string): boolean {
  let start = 0;
  let components = 0;
  for (let index = 0; index <= value.length; index++) {
    if (index === value.length || value[index] === ".") {
      if (!isNumericIdentifier(value, start, index)) return false;
      components++;
      start = index + 1;
    }
  }
  return components === 3;
}

function isValidPreReleaseIdentifier(value: string, start: number, end: number): boolean {
  if (start === end) return false;
  let numeric = true;
  for (let index = start; index < end; index++) {
    const character = value[index]!;
    if (!isDigit(character)) numeric = false;
    if (!isDigit(character) && !isAsciiLetter(character) && character !== "-") return false;
  }
  return !numeric || isNumericIdentifier(value, start, end);
}

function isValidBaseVersion(value: string): boolean {
  const dash = value.indexOf("-");
  const core = dash === -1 ? value : value.slice(0, dash);
  if (!isValidCore(core)) return false;
  if (dash === -1) return true;

  const preRelease = value.slice(dash + 1);
  let start = 0;
  for (let index = 0; index <= preRelease.length; index++) {
    if (index === preRelease.length || preRelease[index] === ".") {
      if (!isValidPreReleaseIdentifier(preRelease, start, index)) return false;
      start = index + 1;
    }
  }
  return true;
}

function isValidCachebuster(value: string): boolean {
  if (!value.length || value[0] === "-" || value[value.length - 1] === "-") return false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (!isDigit(character) && !(character >= "a" && character <= "z") && character !== "-") return false;
  }
  return true;
}

export function parseCodexVersion(value: string): { base: string; cachebuster: string | null } {
  if (typeof value !== "string" || value.length > MAX_VERSION_LENGTH) throw new Error("invalid version");

  const separator = value.indexOf("+");
  if (separator === -1) {
    if (!isValidBaseVersion(value)) throw new Error("invalid base version");
    return { base: value, cachebuster: null };
  }
  if (value.indexOf("+", separator + 1) !== -1 || !isValidBaseVersion(value.slice(0, separator))) throw new Error("invalid base version");

  const metadata = value.slice(separator + 1);
  if (!metadata.startsWith("codex.")) throw new Error("invalid Codex cachebuster");
  const cachebuster = metadata.slice("codex.".length);
  if (!isValidCachebuster(cachebuster)) throw new Error("invalid Codex cachebuster");
  return { base: value.slice(0, separator), cachebuster };
}

export const baseVersion = (value: string): string => parseCodexVersion(value).base;

export function productVersionFromManifest(value: unknown): string {
  try {
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    const version = (value as { version?: unknown }).version;
    if (typeof version !== "string") throw new Error();
    return baseVersion(version);
  } catch {
    throw new Error("invalid Codex plugin manifest");
  }
}
