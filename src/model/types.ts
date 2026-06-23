// Core domain types for the Photowall Layout Designer.
//
// IMPORTANT: every spatial dimension in the model is in **centimeters** (cm).
// There are no pixel values in the domain model — cm→px conversion happens only
// at the SVG viewBox edge (see the renderer in later phases).

/** A real-world size in centimeters. */
export interface SizeCm {
  /** width in cm */
  width: number;
  /** height in cm */
  height: number;
}

/** An axis-aligned bounding box in cm (top-left origin, y-down). */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Orientation = "portrait" | "landscape";

/** Frames rotate only in 90° steps, keeping everything axis-aligned. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * A named standard frame size, stored in **portrait baseline**
 * (width <= height). The ISO A-series is the default set.
 */
export interface StandardSize {
  /** stable id, e.g. "A4" */
  id: string;
  /** display label, e.g. "A4" */
  name: string;
  /** portrait-baseline width in cm */
  width: number;
  /** portrait-baseline height in cm */
  height: number;
}

/**
 * A selectable passpartout (mat) inner-window size, in cm. May mirror a
 * standard size or be an arbitrary named cm size (e.g. "A3 – 5 cm"), per the
 * data-model flexibility required by DESIGN.md.
 */
export interface PasspartoutSize {
  /** stable id */
  id: string;
  /** display label */
  name: string;
  /** portrait-baseline width in cm */
  width: number;
  /** portrait-baseline height in cm */
  height: number;
}

/** A frame color option (named default or a custom color). */
export interface FrameColor {
  /** stable id, e.g. "black" or "custom-3a3a3a" */
  id: string;
  /** display label */
  label: string;
  /** rendered fill, a CSS hex string */
  hex: string;
}

/** A photo in the project. Pixels are stored upright (EXIF orientation applied). */
export interface Photo {
  id: string;
  /** original filename, for display + identification */
  name: string;
  /** full-resolution image as a base64 data URL (upright pixels) */
  dataUrl: string;
  /** small thumbnail data URL for the panel + Bill of Materials */
  thumbnailDataUrl: string;
  /** original pixel width (after EXIF orientation) */
  pixelWidth: number;
  /** original pixel height (after EXIF orientation) */
  pixelHeight: number;
}

/**
 * A frame placed on the wall. May be empty (placeholder) or hold a photo.
 *
 * Position (`x`,`y`) is the **outer moulding top-left** in cm. The aperture
 * (printed-photo area) sits inset by `thickness` on each side. `aperture` is
 * stored already-oriented (portrait or landscape as placed); `rotation` is an
 * additional manual 90° override applied on top.
 */
export interface Frame {
  id: string;
  /** outer moulding top-left x, in cm */
  x: number;
  /** outer moulding top-left y, in cm */
  y: number;
  /** aperture (printed photo) size in cm, before `rotation` is applied */
  aperture: SizeCm;
  /** id of the standard size this frame matches, or null if custom */
  standardSizeId: string | null;
  /** moulding border width in cm (default 1) */
  thickness: number;
  /** optional passpartout inner window; null = no mat */
  passpartout: PasspartoutSize | null;
  /** frame color as a CSS hex string */
  color: string;
  /** manual rotation override in 90° steps */
  rotation: Rotation;
  /** id of the contained photo, or null for an empty placeholder */
  photoId: string | null;
}

/** Wall + project configuration (the Project tab edits this). */
export interface WallSettings {
  /** wall width in cm */
  width: number;
  /** wall height in cm */
  height: number;
  /** wall background color (free color, CSS hex) */
  color: string;
  /** standard frame sizes offered in the Frames tab + properties dropdown */
  standardSizes: StandardSize[];
  /** passpartout inner-window options, keyed by standard size id */
  passpartoutOptions: Record<string, PasspartoutSize[]>;
}

/** A complete project. This is what gets serialized to JSON / localStorage. */
export interface Project {
  /** schema version for migration safety */
  version: number;
  wall: WallSettings;
  photos: Photo[];
  frames: Frame[];
  /**
   * Custom colors actually used by frames, embedded so a project opened on
   * another machine still renders correctly (see DESIGN.md → Persistence).
   */
  customColors: FrameColor[];
}

/** Transient selection state (which frames are selected). */
export interface Selection {
  frameIds: string[];
}
