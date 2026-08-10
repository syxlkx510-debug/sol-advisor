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

  test("preserves a SemVer pre-release while separating its Codex cachebuster", () => {
    expect(parseCodexVersion("0.6.0-rc.1+codex.cache-2")).toEqual({
      base: "0.6.0-rc.1",
      cachebuster: "cache-2",
    });
    expect(baseVersion("0.6.0-rc.1+codex.cache-2")).toBe("0.6.0-rc.1");
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
});
