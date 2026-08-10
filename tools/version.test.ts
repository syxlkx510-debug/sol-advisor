import { describe, expect, test } from "bun:test";
import { baseVersion, parseCodexVersion } from "./version";

describe("Codex plugin version identity", () => {
  test("accepts a release base with an optional single Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0")).toEqual({ base: "0.6.0", cachebuster: null });
    expect(parseCodexVersion("0.6.0+codex.20260809135432")).toEqual({
      base: "0.6.0",
      cachebuster: "20260809135432",
    });
    expect(parseCodexVersion("0.6.0+codex.local-1")).toEqual({
      base: "0.6.0",
      cachebuster: "local-1",
    });
  });

  test("uses the plugin-owned parser as the single implementation", async () => {
    const packaged = await import("../plugins/sol-advisor/mcp/version");
    expect(parseCodexVersion).toBe(packaged.parseCodexVersion);
    expect(baseVersion).toBe(packaged.baseVersion);
  });

  test("preserves a SemVer pre-release while separating its Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0-rc.1+codex.cache-2")).toEqual({
      base: "0.6.0-rc.1",
      cachebuster: "cache-2",
    });
    expect(baseVersion("0.6.0-rc.1+codex.cache-2")).toBe("0.6.0-rc.1");
  });

  test("accepts strict SemVer pre-release identifiers", () => {
    for (const value of ["0.6.0-0", "0.6.0-rc.1", "0.6.0-alpha-9.Z1"]) {
      expect(parseCodexVersion(value)).toEqual({ base: value, cachebuster: null });
    }
  });

  test("rejects non-canonical core and pre-release versions", () => {
    for (const value of [
      "01.6.0",
      "0.06.0",
      "0.6.00",
      "0.6.0-rc..1",
      "0.6.0-.rc",
      "0.6.0-rc.",
      "0.6.0-01",
    ]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects malformed bases, non-Codex metadata, and repeated suffixes", () => {
    for (const value of ["0.6", "0.6.0+other.x", "0.6.0+codex.a+codex.b", "v0.6.0"]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects empty and invalid Codex cachebusters", () => {
    for (const value of [
      "0.6.0+",
      "0.6.0+codex.",
      "0.6.0+codex.-local",
      "0.6.0+codex.local-",
      "0.6.0+codex.LOCAL",
      "0.6.0+codex.local_1",
    ]) {
      expect(() => parseCodexVersion(value)).toThrow();
    }
  });

  test("rejects an overlong base version before parsing it", () => {
    const overlongBase = `1${"0".repeat(256)}.0.0`;
    expect(() => parseCodexVersion(overlongBase)).toThrow("invalid version");
  });

  test("rejects an overlong Codex cachebuster before parsing it", () => {
    const overlongCachebuster = `0.6.0+codex.${"a".repeat(257)}`;
    expect(() => parseCodexVersion(overlongCachebuster)).toThrow("invalid version");
  });
});
