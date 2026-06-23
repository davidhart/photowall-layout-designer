import { DEFAULT_FRAME_THICKNESS } from "./defaults";
import {
  nearestStandardSize,
  orientationFromPixels,
  orientSize,
} from "./geometry";
import { newId } from "../state/ids";
import type { Frame, Photo, SizeCm, WallSettings } from "./types";

/** Longest aperture edge (cm) for a custom-size frame fallback. */
const CUSTOM_TARGET_LONG = 30;
/** Default aperture used for a blank "custom" palette frame. */
const CUSTOM_DEFAULT: SizeCm = { width: 21, height: 29.7 };

/** Positions a frame so its outer moulding is centered on (centerX, centerY). */
function placeCentered(
  aperture: SizeCm,
  thickness: number,
  centerX: number,
  centerY: number,
): { x: number; y: number } {
  const outerW = aperture.width + thickness * 2;
  const outerH = aperture.height + thickness * 2;
  return { x: centerX - outerW / 2, y: centerY - outerH / 2 };
}

/** Aperture for a photo with no close standard size: keep aspect, long edge 30cm. */
export function customApertureForPhoto(photo: Photo): SizeCm {
  const orientation = orientationFromPixels(photo.pixelWidth, photo.pixelHeight);
  const aspect = photo.pixelWidth / photo.pixelHeight; // w/h
  if (orientation === "landscape") {
    return { width: CUSTOM_TARGET_LONG, height: CUSTOM_TARGET_LONG / aspect };
  }
  return { width: CUSTOM_TARGET_LONG * aspect, height: CUSTOM_TARGET_LONG };
}

/**
 * Creates a frame sized to a photo: nearest standard size matching the photo's
 * orientation, or a custom aperture preserving aspect when nothing is close.
 */
export function createFrameForPhoto(
  photo: Photo,
  wall: WallSettings,
  color: string,
  centerX: number,
  centerY: number,
): Frame {
  const orientation = orientationFromPixels(photo.pixelWidth, photo.pixelHeight);
  const aspect = photo.pixelWidth / photo.pixelHeight;
  const standard = nearestStandardSize(aspect, orientation, wall.standardSizes);

  const aperture = standard
    ? orientSize(standard, orientation)
    : customApertureForPhoto(photo);
  const thickness = DEFAULT_FRAME_THICKNESS;
  const { x, y } = placeCentered(aperture, thickness, centerX, centerY);

  return {
    id: newId("frame"),
    x,
    y,
    aperture,
    standardSizeId: standard ? standard.id : null,
    thickness,
    passpartout: null,
    color,
    rotation: 0,
    photoId: photo.id,
  };
}

/**
 * Parses a custom-aperture frame template id of the form "custom:<w>x<h>" (in
 * cm). Returns the aperture or null if the id is not in that form.
 */
function parseCustomApertureId(sizeId: string): SizeCm | null {
  const match = /^custom:([0-9]+(?:\.[0-9]+)?)x([0-9]+(?:\.[0-9]+)?)$/.exec(sizeId);
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return { width: w, height: h };
}

/**
 * Creates an empty placeholder frame from a standard size id, "custom", or
 * "custom:<w>x<h>" (a reusable custom-size template). Centered on the drop
 * point.
 */
export function createEmptyFrame(
  sizeId: string,
  wall: WallSettings,
  color: string,
  centerX: number,
  centerY: number,
): Frame {
  const customAperture = parseCustomApertureId(sizeId);
  const standard =
    customAperture || sizeId === "custom"
      ? null
      : wall.standardSizes.find((s) => s.id === sizeId) ?? null;
  const aperture: SizeCm = standard
    ? { width: standard.width, height: standard.height }
    : customAperture ?? { ...CUSTOM_DEFAULT };
  const thickness = DEFAULT_FRAME_THICKNESS;
  const { x, y } = placeCentered(aperture, thickness, centerX, centerY);

  return {
    id: newId("frame"),
    x,
    y,
    aperture,
    standardSizeId: standard ? standard.id : null,
    thickness,
    passpartout: null,
    color,
    rotation: 0,
    photoId: null,
  };
}
