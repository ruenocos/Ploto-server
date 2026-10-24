/**
 * Room codes: 4 characters from an alphabet without look-alikes (no O/0/1/I),
 * unique among the codes currently in use.
 */
import { randomUUID } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(taken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!taken(code)) return code;
  }
  return randomUUID().slice(0, 8).toUpperCase(); // astronomically unlikely
}

/** A code as players type it: trimmed, upper case ("" for anything else). */
export const normalizeCode = (raw: unknown): string => (typeof raw === "string" ? raw.trim().toUpperCase() : "");
