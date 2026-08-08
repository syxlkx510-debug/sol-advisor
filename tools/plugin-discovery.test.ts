import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const pluginRoot = resolve(import.meta.dir, "..", "plugins", "sol-advisor");
const manifest = JSON.parse(
  readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);
const companion = JSON.parse(
  readFileSync(join(pluginRoot, ".mcp.json"), "utf8"),
);

describe("Codex MCP discovery", () => {
  test("declares the conventional companion file", () => {
    expect(manifest.mcpServers).toBe("./.mcp.json");
    expect(existsSync(join(pluginRoot, ".mcp.json"))).toBe(true);
  });

  test("does not ship an undiscoverable legacy filename", () => {
    expect(existsSync(join(pluginRoot, "mcp.json"))).toBe(false);
  });

  test("uses the Codex companion shape", () => {
    expect(companion.$schema).toBeUndefined();
    expect(Object.keys(companion)).toEqual(["mcpServers"]);
  });
});
