import { DEFAULT_WALL_COLOR_HEX } from "./colors";
import type { Project, WallSettings } from "./types";

/** Current project schema version. */
export const PROJECT_VERSION = 1;

/** Default wall size in cm (see DESIGN.md → Project Tab). */
export const DEFAULT_WALL_WIDTH = 200;
export const DEFAULT_WALL_HEIGHT = 150;

/** Default moulding thickness for a new frame, in cm. */
export const DEFAULT_FRAME_THICKNESS = 1;

/** Builds default wall settings: 200×150 cm white wall. */
export function defaultWallSettings(): WallSettings {
  return {
    width: DEFAULT_WALL_WIDTH,
    height: DEFAULT_WALL_HEIGHT,
    color: DEFAULT_WALL_COLOR_HEX,
  };
}

/** Builds a fresh, empty default project. */
export function defaultProject(): Project {
  return {
    version: PROJECT_VERSION,
    wall: defaultWallSettings(),
    photos: [],
    frames: [],
    customColors: [],
  };
}
