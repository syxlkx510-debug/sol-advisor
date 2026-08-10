const basePattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const cachePattern = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;

export function parseCodexVersion(value: string): { base: string; cachebuster: string | null } {
  const parts = value.split("+");
  if (parts.length > 2 || !basePattern.test(parts[0]!)) throw new Error("invalid base version");
  if (parts.length === 1) return { base: parts[0]!, cachebuster: null };

  const match = /^codex\.(.+)$/.exec(parts[1]!);
  if (!match || !cachePattern.test(match[1]!)) throw new Error("invalid Codex cachebuster");
  return { base: parts[0]!, cachebuster: match[1]! };
}

export const baseVersion = (value: string): string => parseCodexVersion(value).base;
