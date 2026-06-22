import { defaultPasspartoutOptions } from "./geometry";
import type { PasspartoutSize, StandardSize } from "./types";

/**
 * Reconciles the per-frame-size passpartout option map after the standard size
 * list changes: keeps existing (possibly customized) entries for surviving
 * sizes, seeds new sizes with their default smaller-size options, and drops
 * entries for removed sizes.
 */
export function reconcilePasspartoutOptions(
  sizes: readonly StandardSize[],
  existing: Record<string, PasspartoutSize[]>,
): Record<string, PasspartoutSize[]> {
  const defaults = defaultPasspartoutOptions(sizes);
  const result: Record<string, PasspartoutSize[]> = {};
  for (const size of sizes) {
    result[size.id] = existing[size.id] ?? defaults[size.id] ?? [];
  }
  return result;
}

/** Converts a standard size into a passpartout option entry. */
export function sizeToPasspartout(size: StandardSize): PasspartoutSize {
  return { id: size.id, name: size.name, width: size.width, height: size.height };
}
