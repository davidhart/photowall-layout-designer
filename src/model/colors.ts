import type { FrameColor } from "./types";

/**
 * Default frame color palette: black, brown, red-brown, gold, silver.
 * Gold/silver are flat fills (no gradients). HEX values are sensible
 * placeholders to be refined later (see DESIGN.md → Open Questions).
 */
export const DEFAULT_FRAME_COLORS: readonly FrameColor[] = [
  { id: "black", label: "Black", hex: "#1a1a1a" },
  { id: "brown", label: "Brown", hex: "#5b3a29" },
  { id: "red-brown", label: "Red-brown", hex: "#7a2e1d" },
  { id: "gold", label: "Gold", hex: "#c9a227" },
  { id: "silver", label: "Silver", hex: "#b8b8b8" },
] as const;

/** The default color for a brand-new frame when no last-used color exists. */
export const DEFAULT_FRAME_COLOR_HEX = "#1a1a1a";

/** Default wall background color. */
export const DEFAULT_WALL_COLOR_HEX = "#ffffff";
