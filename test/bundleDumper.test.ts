import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { analyzeBundle, scanText } from "../src/tools/bundleDumper/analyze.js";
import { readZip, isSafeEntryPath, extractTo } from "../src/tools/bundleDumper/unzip.js";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sampleJs = `
  const API = "https://games-prod.platocdn.com/match_monsters/client.zip";
  const sock = new WebSocket("wss://rtc.example.com/?roomId=1&peerId=2", "protoo");
  peer.request("mm:getState", {});
  peer.notify("mm:moveResult", r);
  bus.on({ method: "gameOver" });
  if (msg.method === "turnEnded") { handle(); }
  const evt = "match:started";
`;

function sampleBundle(): Uint8Array {
  return zipSync({
    "index.html": strToU8("<script src=game.js></script>"),
    "game.js": strToU8(sampleJs),
    "assets/sprite.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    "data/config.json": strToU8('{"method":"join"}'),
  });
}

describe("bundle analysis", () => {
  it("surfaces urls, ws endpoints and protoo methods from JS", () => {
    const report = analyzeBundle(readZip(sampleBundle()));
    expect(report.urls).toContain("https://games-prod.platocdn.com/match_monsters/client.zip");
    expect(report.wsEndpoints).toContain("wss://rtc.example.com/?roomId=1&peerId=2");
    expect(report.protooMethods).toEqual(
      expect.arrayContaining(["mm:getState", "mm:moveResult", "gameOver", "join", "turnEnded"]),
    );
    expect(report.interestingStrings).toContain("match:started");
  });

  it("hashes and classifies every file", () => {
    const report = analyzeBundle(readZip(sampleBundle()));
    expect(report.fileCount).toBe(4);
    const png = report.files.find((f) => f.path.endsWith(".png"));
    expect(png?.kind).toBe("binary");
    expect(png?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.files.find((f) => f.path === "game.js")?.kind).toBe("js");
  });

  it("scanText ignores plain words and keeps namespaced events", () => {
    const sinks = {
      urls: new Set<string>(),
      wsEndpoints: new Set<string>(),
      protooMethods: new Set<string>(),
      interesting: new Set<string>(),
    };
    scanText('"hello" "foo:bar" "plainword"', sinks);
    expect([...sinks.interesting]).toEqual(["foo:bar"]);
  });
});

describe("safe extraction", () => {
  it("accepts normal paths and rejects traversal / absolute paths", () => {
    expect(isSafeEntryPath("a/b/c.js")).toBe(true);
    expect(isSafeEntryPath("../evil.js")).toBe(false);
    expect(isSafeEntryPath("a/../../evil.js")).toBe(false);
    expect(isSafeEntryPath("/etc/passwd")).toBe(false);
  });

  it("writes safe entries to disk and skips unsafe ones", () => {
    const zip = zipSync({
      "ok.js": strToU8("console.log(1)"),
      "nested/ok2.js": strToU8("console.log(2)"),
    });
    const dir = mkdtempSync(join(tmpdir(), "dump-"));
    const res = extractTo(readZip(zip), dir);
    expect(res.written.sort()).toEqual(["nested/ok2.js", "ok.js"]);
    expect(existsSync(join(dir, "ok.js"))).toBe(true);
    expect(readFileSync(join(dir, "nested/ok2.js"), "utf8")).toBe("console.log(2)");
  });
});
