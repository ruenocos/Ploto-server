/**
 * Safe zip extraction for game bundles.
 *
 * Game bundles (`client.zip`) are third-party content, so extraction guards
 * against zip-slip: any entry whose normalised path escapes the output directory
 * (absolute paths, `..` traversal) is refused. Unzipping itself is delegated to
 * `fflate` — we do not hand-roll the zip format.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { unzipSync, type Unzipped } from "fflate";

export interface UnsafeEntry {
  readonly name: string;
  readonly reason: string;
}

export interface ExtractResult {
  readonly written: string[];
  readonly skipped: UnsafeEntry[];
}

/** Parse zip bytes into an in-memory map of `path -> bytes`. */
export function readZip(bytes: Uint8Array): Unzipped {
  return unzipSync(bytes);
}

/** True if `entryName` stays within a root directory once normalised. */
export function isSafeEntryPath(entryName: string): boolean {
  if (entryName.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(entryName)) return false;
  const norm = normalize(entryName);
  if (norm.startsWith("..")) return false;
  return !norm.split(/[\\/]/).includes("..");
}

/** Extract a parsed zip into `outDir`, skipping directory entries and unsafe paths. */
export function extractTo(files: Unzipped, outDir: string): ExtractResult {
  const written: string[] = [];
  const skipped: UnsafeEntry[] = [];

  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("/")) continue; // directory marker
    if (!isSafeEntryPath(name)) {
      skipped.push({ name, reason: "path escapes output directory" });
      continue;
    }
    const target = join(outDir, name);
    if (!target.startsWith(outDir + sep) && target !== outDir) {
      skipped.push({ name, reason: "resolved path escapes output directory" });
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    written.push(name);
  }
  return { written, skipped };
}
