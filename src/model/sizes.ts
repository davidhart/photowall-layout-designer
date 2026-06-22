import type { StandardSize } from "./types";

/**
 * ISO A-series sizes A0–A6 in **centimeters**, portrait baseline
 * (width <= height). These are the default standard frame sizes.
 *
 * Values are the standard ISO 216 millimeter dimensions converted to cm.
 */
export const ISO_A_SERIES: readonly StandardSize[] = [
  { id: "A0", name: "A0", width: 84.1, height: 118.9 },
  { id: "A1", name: "A1", width: 59.4, height: 84.1 },
  { id: "A2", name: "A2", width: 42.0, height: 59.4 },
  { id: "A3", name: "A3", width: 29.7, height: 42.0 },
  { id: "A4", name: "A4", width: 21.0, height: 29.7 },
  { id: "A5", name: "A5", width: 14.8, height: 21.0 },
  { id: "A6", name: "A6", width: 10.5, height: 14.8 },
] as const;

/** Returns a fresh (deeply cloned) copy of the default standard size list. */
export function defaultStandardSizes(): StandardSize[] {
  return ISO_A_SERIES.map((s) => ({ ...s }));
}
