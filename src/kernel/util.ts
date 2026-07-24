// Deterministic primitives: hashing (for ids/fingerprints) and covenant-grade rounding.

import { createHash } from "node:crypto";
import type { Rounding } from "./types.js";

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function sha1Hex(s: string): string {
  return createHash("sha1").update(s, "utf8").digest("hex");
}

// Round a positive ratio. half_up = round half away from zero; a small epsilon absorbs
// binary-FP representation error (e.g. 6.3450292… must land on 6.35, 220/29 → 7.59).
export function round(value: number, rounding?: Rounding): number {
  const decimals = rounding?.decimals ?? 2;
  const mode = rounding?.mode ?? "half_up";
  const f = 10 ** decimals;
  const scaled = value * f;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(scaled);
  let r: number;
  switch (mode) {
    case "truncate":
      r = Math.trunc(abs);
      break;
    case "half_even": {
      const floor = Math.floor(abs);
      const frac = abs - floor;
      if (Math.abs(frac - 0.5) < 1e-9) r = floor % 2 === 0 ? floor : floor + 1;
      else r = Math.round(abs);
      break;
    }
    case "half_up":
    default:
      r = Math.floor(abs + 0.5 + 1e-9);
      break;
  }
  return (sign * r) / f;
}
