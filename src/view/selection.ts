import { aabbsOverlap, outerAABB } from "../model/geometry";
import type { AABB, Frame } from "../model/types";

/** Builds a normalized AABB from two corner points (in any order). */
export function rectFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): AABB {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/**
 * Ids of frames whose outer moulding box overlaps the given marquee rect (cm).
 */
export function framesInRect(
  frames: readonly Frame[],
  rect: AABB,
): string[] {
  return frames
    .filter((f) => aabbsOverlap(outerAABB(f), rect))
    .map((f) => f.id);
}

/** Toggles an id in a selection list (immutably). */
export function toggleSelection(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Unions two id lists, preserving order and removing duplicates. */
export function unionSelection(
  a: readonly string[],
  b: readonly string[],
): string[] {
  const seen = new Set(a);
  const result = [...a];
  for (const id of b) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}
