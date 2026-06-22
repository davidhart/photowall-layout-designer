import type {
  AABB,
  Frame,
  Orientation,
  PasspartoutSize,
  SizeCm,
  StandardSize,
} from "./types";

/** Orientation derived from raw pixel dimensions. Square counts as portrait. */
export function orientationFromPixels(
  pixelWidth: number,
  pixelHeight: number,
): Orientation {
  return pixelWidth > pixelHeight ? "landscape" : "portrait";
}

/** Aspect ratio (width / height) of a size. */
export function aspectRatio(size: SizeCm): number {
  return size.width / size.height;
}

/**
 * Returns a standard size oriented for the given orientation. Standard sizes
 * are stored portrait-baseline; landscape swaps width/height.
 */
export function orientSize(size: SizeCm, orientation: Orientation): SizeCm {
  if (orientation === "landscape") {
    return { width: size.height, height: size.width };
  }
  return { width: size.width, height: size.height };
}

/**
 * Picks the standard size whose aspect ratio is closest to `photoAspect`
 * (photo width / height), oriented to `orientation`.
 *
 * The A-series all share the same aspect ratio, so ratio alone cannot pick a
 * specific size; ties are broken toward `preferredSizeId` (default "A4") if
 * present, otherwise the first candidate. Returns `null` when nothing is within
 * `tolerance` (relative aspect-ratio difference), signalling a custom-size
 * fallback to the caller.
 */
export function nearestStandardSize(
  photoAspect: number,
  orientation: Orientation,
  sizes: readonly StandardSize[],
  options: { tolerance?: number; preferredSizeId?: string } = {},
): StandardSize | null {
  const { tolerance = 0.15, preferredSizeId = "A4" } = options;
  if (sizes.length === 0) return null;

  let best: { size: StandardSize; diff: number } | null = null;
  const within: StandardSize[] = [];
  const epsilon = 1e-6;

  for (const size of sizes) {
    const oriented = orientSize(size, orientation);
    const sizeAspect = aspectRatio(oriented);
    // relative difference so large + small sizes are compared fairly
    const diff = Math.abs(photoAspect - sizeAspect) / sizeAspect;
    if (best === null || diff < best.diff) {
      best = { size, diff };
    }
  }

  if (best === null || best.diff > tolerance) {
    return null;
  }

  // Gather all candidates effectively tied with the best for tie-breaking.
  for (const size of sizes) {
    const oriented = orientSize(size, orientation);
    const diff = Math.abs(photoAspect - aspectRatio(oriented)) / aspectRatio(oriented);
    if (Math.abs(diff - best.diff) <= epsilon) {
      within.push(size);
    }
  }

  const preferred = within.find((s) => s.id === preferredSizeId);
  return preferred ?? within[0] ?? best.size;
}

/**
 * The effective printed-photo size of a frame: the passpartout inner-window
 * size when a mat is present, otherwise the frame's aperture. This is the value
 * the Bill of Materials uses (see DESIGN.md).
 */
export function effectivePrintSize(frame: Frame): SizeCm {
  if (frame.passpartout) {
    return { width: frame.passpartout.width, height: frame.passpartout.height };
  }
  return { width: frame.aperture.width, height: frame.aperture.height };
}

/**
 * Outer moulding size of a frame = aperture + `thickness` on each side, with
 * width/height swapped for 90°/270° rotation (frames stay axis-aligned).
 */
export function outerSize(frame: Frame): SizeCm {
  const width = frame.aperture.width + frame.thickness * 2;
  const height = frame.aperture.height + frame.thickness * 2;
  if (frame.rotation === 90 || frame.rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

/** Axis-aligned bounding box of a frame's outer moulding, in cm. */
export function outerAABB(frame: Frame): AABB {
  const size = outerSize(frame);
  return { x: frame.x, y: frame.y, width: size.width, height: size.height };
}

/** True if size `a` is strictly smaller than `b` in both dimensions. */
function isStrictlySmaller(a: SizeCm, b: SizeCm): boolean {
  return a.width < b.width && a.height < b.height;
}

/**
 * Default passpartout options per frame size: every *smaller* standard size
 * (both dimensions strictly smaller, portrait baseline). E.g. an A3 frame
 * offers A4, A5, A6. Returned keyed by standard size id.
 */
export function defaultPasspartoutOptions(
  sizes: readonly StandardSize[],
): Record<string, PasspartoutSize[]> {
  const result: Record<string, PasspartoutSize[]> = {};
  for (const frameSize of sizes) {
    const options: PasspartoutSize[] = [];
    for (const candidate of sizes) {
      if (candidate.id !== frameSize.id && isStrictlySmaller(candidate, frameSize)) {
        options.push({
          id: candidate.id,
          name: candidate.name,
          width: candidate.width,
          height: candidate.height,
        });
      }
    }
    result[frameSize.id] = options;
  }
  return result;
}

/** Do two AABBs overlap (touching edges do not count as overlap)? */
export function aabbsOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
