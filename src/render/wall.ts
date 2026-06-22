import { orientSize, outerSize } from "../model/geometry";
import type { AABB, Frame, Photo, Project } from "../model/types";
import { setHref, svgEl } from "./svg";

/** Mat (passpartout) fill — a neutral off-white. */
const MAT_COLOR = "#f0ece3";
/** Letterbox / empty-frame backing color. */
const PHOTO_BACKING_COLOR = "#ffffff";
/** Selection highlight color. */
const SELECT_COLOR = "#2b6cff";
/** Grid line color. */
const GRID_COLOR = "rgba(0, 0, 0, 0.12)";
/** Grid spacing in cm. */
const GRID_STEP = 10;

/**
 * Computes a default fit-to-wall viewBox (with margin) in cm. Phase 4 replaces
 * this with proper aspect-aware fitting + zoom/pan; this keeps something sane on
 * screen before then.
 */
export function defaultViewBox(project: Project): AABB {
  const { width, height } = project.wall;
  const margin = Math.max(width, height) * 0.08;
  return {
    x: -margin,
    y: -margin,
    width: width + margin * 2,
    height: height + margin * 2,
  };
}

/** Orientation of an aperture from its own dimensions. */
function apertureOrientation(frame: Frame): "portrait" | "landscape" {
  return frame.aperture.width > frame.aperture.height ? "landscape" : "portrait";
}

/**
 * Renders a single frame as an SVG group. The group is built in a local,
 * centered, *unrotated* coordinate space and then positioned + rotated as a
 * whole, so the image and frame rotate together and stay axis-aligned.
 */
export function renderFrame(
  frame: Frame,
  photo: Photo | null,
  selected: boolean,
): SVGGElement {
  const t = frame.thickness;
  const aw = frame.aperture.width;
  const ah = frame.aperture.height;
  const uw = aw + t * 2; // unrotated outer width
  const uh = ah + t * 2; // unrotated outer height

  // Rotation preserves the center, so position the group at the final AABB
  // center and rotate around it.
  const outer = outerSize(frame);
  const cx = frame.x + outer.width / 2;
  const cy = frame.y + outer.height / 2;

  const g = svgEl("g", {
    transform: `translate(${cx} ${cy}) rotate(${frame.rotation})`,
    "data-frame-id": frame.id,
    class: "frame",
  });

  // Outer moulding.
  g.appendChild(
    svgEl("rect", {
      x: -uw / 2,
      y: -uh / 2,
      width: uw,
      height: uh,
      fill: frame.color,
    }),
  );

  // Determine the photo area: the passpartout inner window if set, else the
  // full aperture. When a mat is present, the aperture is filled mat-colored.
  let photoW = aw;
  let photoH = ah;
  if (frame.passpartout) {
    g.appendChild(
      svgEl("rect", {
        x: -aw / 2,
        y: -ah / 2,
        width: aw,
        height: ah,
        fill: MAT_COLOR,
      }),
    );
    const inner = orientSize(frame.passpartout, apertureOrientation(frame));
    photoW = inner.width;
    photoH = inner.height;
  }

  // White backing: the empty-frame center. (Photos cover the aperture, so this
  // is normally hidden behind the image.)
  g.appendChild(
    svgEl("rect", {
      x: -photoW / 2,
      y: -photoH / 2,
      width: photoW,
      height: photoH,
      fill: PHOTO_BACKING_COLOR,
    }),
  );

  if (photo) {
    const image = svgEl("image", {
      x: -photoW / 2,
      y: -photoH / 2,
      width: photoW,
      height: photoH,
      // "slice" = cover: the photo's smallest edge fills the aperture and any
      // overflow on the longer edge is cropped (no white gaps). Exact fit is
      // just the matching aspect-ratio case. The <image> rect clips overflow.
      preserveAspectRatio: "xMidYMid slice",
    });
    setHref(image, photo.dataUrl);
    g.appendChild(image);
  }

  // Selection highlight (constant on-screen width regardless of zoom).
  if (selected) {
    g.appendChild(
      svgEl("rect", {
        x: -uw / 2,
        y: -uh / 2,
        width: uw,
        height: uh,
        fill: "none",
        stroke: SELECT_COLOR,
        "stroke-width": 2,
        "stroke-dasharray": "6 4",
        "vector-effect": "non-scaling-stroke",
        class: "frame__selection",
      }),
    );
  }

  return g;
}

/** Builds the grid pattern definition (lines every GRID_STEP cm). */
function buildGridDefs(): SVGDefsElement {
  const path = svgEl("path", {
    d: `M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`,
    fill: "none",
    stroke: GRID_COLOR,
    "stroke-width": 0.2,
  });
  const pattern = svgEl(
    "pattern",
    {
      id: "wall-grid",
      width: GRID_STEP,
      height: GRID_STEP,
      patternUnits: "userSpaceOnUse",
    },
    [path],
  );
  return svgEl("defs", {}, [pattern]) as SVGDefsElement;
}

/**
 * Builds the full wall SVG from the project and selection. Full re-render on
 * each change is fine for the ~20-frame target.
 */
/** A live drag offset applied to a set of frame ids during rendering. */
export interface DragOffset {
  ids: ReadonlySet<string>;
  dx: number;
  dy: number;
  guides?: { vertical: number[]; horizontal: number[] };
}

/** Snap guide color. */
const GUIDE_COLOR = "#ff2d6c";

/** Builds the snap-guide overlay lines spanning the current viewBox. */
function buildGuides(
  guides: { vertical: number[]; horizontal: number[] },
  viewBox: AABB,
): SVGGElement {
  const g = svgEl("g", { class: "snap-guides" });
  for (const x of guides.vertical) {
    g.appendChild(
      svgEl("line", {
        x1: x,
        y1: viewBox.y,
        x2: x,
        y2: viewBox.y + viewBox.height,
        stroke: GUIDE_COLOR,
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  for (const y of guides.horizontal) {
    g.appendChild(
      svgEl("line", {
        x1: viewBox.x,
        y1: y,
        x2: viewBox.x + viewBox.width,
        y2: y,
        stroke: GUIDE_COLOR,
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  return g;
}

export function buildWallSvg(
  project: Project,
  viewBox: AABB,
  selection: ReadonlySet<string>,
  drag: DragOffset | null = null,
): SVGSVGElement {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const svg = svgEl("svg", {
    viewBox: vb,
    preserveAspectRatio: "xMidYMid meet",
    class: "wall-svg",
  }) as SVGSVGElement;

  svg.appendChild(buildGridDefs());

  const { width, height, color } = project.wall;

  // Wall background.
  svg.appendChild(
    svgEl("rect", { x: 0, y: 0, width, height, fill: color, class: "wall-bg" }),
  );
  // Grid overlay (clipped to the wall area).
  svg.appendChild(
    svgEl("rect", { x: 0, y: 0, width, height, fill: "url(#wall-grid)" }),
  );

  const photosById = new Map(project.photos.map((p) => [p.id, p]));
  for (const frame of project.frames) {
    const photo = frame.photoId ? photosById.get(frame.photoId) ?? null : null;
    const drawn =
      drag && drag.ids.has(frame.id)
        ? { ...frame, x: frame.x + drag.dx, y: frame.y + drag.dy }
        : frame;
    svg.appendChild(renderFrame(drawn, photo, selection.has(frame.id)));
  }

  if (drag?.guides) {
    svg.appendChild(buildGuides(drag.guides, viewBox));
  }

  return svg;
}
