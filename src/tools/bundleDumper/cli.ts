/**
 * Game-bundle dumper CLI.
 *
 *   npm run dump -- <source> [--out <dir>]
 *
 * `<source>` is a local `client.zip` path OR an exact http(s) URL to one. The
 * dumper does NOT discover URLs by probing a CDN — hand it a bundle you already
 * have (device cache) or a URL you already know. It extracts the bundle safely
 * and writes a protocol report (urls, ws endpoints, protoo methods) alongside it.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { analyzeBundle } from "./analyze.js";
import { readZip, extractTo } from "./unzip.js";

interface Args {
  source: string;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const rest = argv.slice(2);
  let source: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--out") out = rest[++i];
    else if (!a.startsWith("--")) source = a;
  }
  if (!source) {
    throw new Error("usage: dump <client.zip | https://…/client.zip> [--out <dir>]");
  }
  const defaultOut = join("dump", basename(source).replace(/\.zip$/i, "") || "bundle");
  return { source, out: out ?? defaultOut };
}

async function readSource(source: string): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(readFileSync(source));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const bytes = await readSource(args.source);
  const files = readZip(bytes);

  mkdirSync(args.out, { recursive: true });
  const extract = extractTo(files, args.out);
  const report = analyzeBundle(files);

  writeFileSync(join(args.out, "manifest.json"), JSON.stringify(report.files, null, 2));
  writeFileSync(
    join(args.out, "protocol-report.json"),
    JSON.stringify(
      {
        urls: report.urls,
        wsEndpoints: report.wsEndpoints,
        protooMethods: report.protooMethods,
        interestingStrings: report.interestingStrings,
      },
      null,
      2,
    ),
  );

  /* eslint-disable no-console */
  console.log(`extracted ${extract.written.length} files -> ${args.out}`);
  if (extract.skipped.length) {
    console.log(`skipped ${extract.skipped.length} unsafe entries:`);
    for (const s of extract.skipped) console.log(`  - ${s.name} (${s.reason})`);
  }
  console.log(`\n${report.fileCount} files, ${(report.totalBytes / 1024).toFixed(1)} KiB`);
  summarise("http(s) URLs", report.urls);
  summarise("ws endpoints", report.wsEndpoints);
  summarise("protoo methods", report.protooMethods);
  summarise("event-like strings", report.interestingStrings);
  console.log(`\nfull report -> ${join(args.out, "protocol-report.json")}`);
  /* eslint-enable no-console */
}

function summarise(label: string, items: string[]): void {
  // eslint-disable-next-line no-console
  console.log(`\n${label} (${items.length}):`);
  for (const item of items.slice(0, 40)) {
    // eslint-disable-next-line no-console
    console.log(`  ${item}`);
  }
  if (items.length > 40) {
    // eslint-disable-next-line no-console
    console.log(`  … +${items.length - 40} more`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("dump failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
