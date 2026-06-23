// Drag-and-drop payload types used between the left panel (drag sources) and
// the wall (drop target).

/**
 * Dragging an empty frame template from the Frames palette. Value is one of:
 *   - a standard size id (e.g. "A4")
 *   - "custom" — a blank custom-size frame at the default aperture
 *   - "custom:<w>x<h>" — a custom-size frame with the given aperture in cm
 */
export const DND_FRAME_SIZE = "application/x-photowall-frame-size";

/** Encodes a (width, height) custom aperture as a DND_FRAME_SIZE payload. */
export function encodeCustomFrameSizeId(width: number, height: number): string {
  return `custom:${width}x${height}`;
}
