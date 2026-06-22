import type { AABB, SizeCm } from "../model/types";

/** Zoom clamp relative to the fit-to-viewport scale (~10%–800%). */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

/** Default margin around the wall when fitting, as a fraction of wall size. */
const DEFAULT_MARGIN = 0.06;

/**
 * Expands a box (centered) so its aspect ratio matches `aspect`
 * (= containerWidthPx / containerHeightPx). Matching the viewBox aspect to the
 * container means `preserveAspectRatio="xMidYMid meet"` never letterboxes, so
 * px↔cm mapping stays a simple linear scale.
 */
export function matchAspect(box: AABB, aspect: number): AABB {
  const boxAspect = box.width / box.height;
  let { x, y, width, height } = box;
  if (boxAspect < aspect) {
    const newWidth = height * aspect;
    x -= (newWidth - width) / 2;
    width = newWidth;
  } else {
    const newHeight = width / aspect;
    y -= (newHeight - height) / 2;
    height = newHeight;
  }
  return { x, y, width, height };
}

/** Computes a viewBox that fits the whole wall (plus margin) to the viewport. */
export function fitViewBox(
  wall: SizeCm,
  containerW: number,
  containerH: number,
  margin = DEFAULT_MARGIN,
): AABB {
  const mx = wall.width * margin;
  const my = wall.height * margin;
  const base: AABB = {
    x: -mx,
    y: -my,
    width: wall.width + mx * 2,
    height: wall.height + my * 2,
  };
  if (containerW <= 0 || containerH <= 0) return base;
  return matchAspect(base, containerW / containerH);
}

/** Current scale in screen px per cm (aspect is matched, so width-based). */
export function scaleOf(viewBox: AABB, containerW: number): number {
  return containerW / viewBox.width;
}

/** Clamps a target scale to the allowed zoom range relative to fit scale. */
export function clampScale(scale: number, fitScale: number): number {
  return Math.min(
    Math.max(scale, fitScale * ZOOM_MIN),
    fitScale * ZOOM_MAX,
  );
}

/**
 * Zooms by `factor` about a cursor position (in container px), keeping the cm
 * point under the cursor fixed. Scale is clamped relative to `fitScale`.
 */
export function zoomAt(
  viewBox: AABB,
  containerW: number,
  containerH: number,
  cursorX: number,
  cursorY: number,
  factor: number,
  fitScale: number,
): AABB {
  if (containerW <= 0 || containerH <= 0) return viewBox;
  const scale = scaleOf(viewBox, containerW);
  const newScale = clampScale(scale * factor, fitScale);
  const newWidth = containerW / newScale;
  const newHeight = containerH / newScale;
  const fx = cursorX / containerW;
  const fy = cursorY / containerH;
  const cmX = viewBox.x + fx * viewBox.width;
  const cmY = viewBox.y + fy * viewBox.height;
  return {
    x: cmX - fx * newWidth,
    y: cmY - fy * newHeight,
    width: newWidth,
    height: newHeight,
  };
}

/** Pans the viewBox by a screen-pixel delta (drag), converting px→cm. */
export function panBy(
  viewBox: AABB,
  containerW: number,
  dxPx: number,
  dyPx: number,
): AABB {
  const scale = scaleOf(viewBox, containerW);
  return {
    ...viewBox,
    x: viewBox.x - dxPx / scale,
    y: viewBox.y - dyPx / scale,
  };
}

/** Converts a container-relative pixel point to a cm point in wall space. */
export function pxToCm(
  viewBox: AABB,
  containerW: number,
  containerH: number,
  px: number,
  py: number,
): { x: number; y: number } {
  return {
    x: viewBox.x + (px / containerW) * viewBox.width,
    y: viewBox.y + (py / containerH) * viewBox.height,
  };
}
