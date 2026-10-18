/**
 * Static analysis of an extracted game bundle.
 *
 * The point of the dumper: turn a `client.zip` into a protocol map. We walk the
 * bundle's text files (JS/JSON/HTML) and surface anything that describes how the
 * game talks to a server — URLs, WebSocket endpoints, protoo request/notify
 * method names, and recurring event-like string literals. This is the input for
 * finishing the in-game message mapping in the server (the ⏳ item in
 * docs/PROTOCOL.md).
 */
import { createHash } from "node:crypto";
import type { Unzipped } from "fflate";

export interface FileEntry {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
  readonly kind: "js" | "json" | "html" | "css" | "text" | "binary";
}

export interface BundleReport {
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly files: FileEntry[];
  /** All http(s) URLs found in text files. */
  readonly urls: string[];
  /** ws:// and wss:// endpoints. */
  readonly wsEndpoints: string[];
  /** Candidate protoo request/notification method names. */
  readonly protooMethods: string[];
  /** Other recurring event-like string literals worth inspecting. */
  readonly interestingStrings: string[];
}

const TEXT_EXT: Record<string, FileEntry["kind"]> = {
  js: "js",
  mjs: "js",
  cjs: "js",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  txt: "text",
  map: "json",
};

function kindOf(path: string): FileEntry["kind"] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXT[ext] ?? "binary";
}

const decoder = new TextDecoder("utf-8", { fatal: false });

export function analyzeBundle(files: Unzipped): BundleReport {
  const entries: FileEntry[] = [];
  const urls = new Set<string>();
  const wsEndpoints = new Set<string>();
  const protooMethods = new Set<string>();
  const interesting = new Set<string>();
  let totalBytes = 0;

  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith("/")) continue;
    const kind = kindOf(path);
    totalBytes += data.length;
    entries.push({
      path,
      size: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
      kind,
    });
    if (kind === "binary") continue;

    const text = decoder.decode(data);
    scanText(text, { urls, wsEndpoints, protooMethods, interesting });
  }

  entries.sort((a, b) => b.size - a.size);
  return {
    fileCount: entries.length,
    totalBytes,
    files: entries,
    urls: [...urls].sort(),
    wsEndpoints: [...wsEndpoints].sort(),
    protooMethods: [...protooMethods].sort(),
    interestingStrings: [...interesting].sort(),
  };
}

interface Sinks {
  urls: Set<string>;
  wsEndpoints: Set<string>;
  protooMethods: Set<string>;
  interesting: Set<string>;
}

const RE_URL = /\bhttps?:\/\/[^\s"'`<>()]+/g;
const RE_WS = /\bwss?:\/\/[^\s"'`<>()]+/g;
// protoo clients call .request('method', …) / .notify('method', …); also
// server-dispatch tables switch on request.method === 'name'.
const RE_PROTOO = /\.(?:request|notify)\(\s*['"]([a-zA-Z][\w:.-]{1,48})['"]/g;
// Matches `method: 'x'`, `method = "x"`, the JSON form `"method":"x"`, and
// dispatch comparisons `method === "x"` / `method == "x"`.
const RE_METHOD_FIELD = /["']?method["']?\s*(?::|={1,3})\s*['"]([a-zA-Z][\w:.-]{1,48})['"]/g;
// Event-ish literals: contain a ':' or are clearly namespaced (foo.bar / fooBar).
const RE_EVENTISH = /['"]([a-zA-Z][\w-]*(?::[\w-]+)+|[a-z]+[A-Z][a-zA-Z]{2,})['"]/g;

export function scanText(text: string, sinks: Sinks): void {
  for (const m of text.matchAll(RE_URL)) sinks.urls.add(trimPunct(m[0]));
  for (const m of text.matchAll(RE_WS)) sinks.wsEndpoints.add(trimPunct(m[0]));
  for (const m of text.matchAll(RE_PROTOO)) sinks.protooMethods.add(m[1]!);
  for (const m of text.matchAll(RE_METHOD_FIELD)) sinks.protooMethods.add(m[1]!);
  for (const m of text.matchAll(RE_EVENTISH)) {
    const s = m[1]!;
    if (s.includes(":")) sinks.interesting.add(s);
  }
}

function trimPunct(s: string): string {
  return s.replace(/[.,;:]+$/, "");
}
