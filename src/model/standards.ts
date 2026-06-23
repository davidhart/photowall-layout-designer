// Hardcoded standard frame sizes and default passpartout options.
//
// These used to be editable per-project (Project tab). They're now app-level
// constants: customization happens per-frame via the Custom… controls in the
// Frame Properties panel.

import { defaultPasspartoutOptions } from "./geometry";
import { defaultStandardSizes } from "./sizes";
import type { PasspartoutSize, StandardSize } from "./types";

/**
 * The standard frame sizes offered in the Frames palette and the frame-size
 * dropdown. Returns a fresh copy so callers can't mutate the canonical list.
 */
export function standardSizes(): StandardSize[] {
  return defaultStandardSizes();
}

/**
 * Default passpartout (mat) inner-window options per standard frame size:
 * every *smaller* standard size (e.g. A3 → A4, A5, A6). Returns a fresh copy.
 */
export function standardPasspartoutOptions(): Record<string, PasspartoutSize[]> {
  return defaultPasspartoutOptions(standardSizes());
}
