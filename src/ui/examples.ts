// Examples are layout-only `.json` snapshots dropped into `/examples/`. Vite
// bundles every file matched by the glob below into the production single-file
// HTML — adding a new layout is literally "save the file into /examples/".

import { outerAABB, outerSize } from "../model/geometry";
import { deserializeProject } from "../persistence/serialize";
import { svgEl } from "../render/svg";
import { newId } from "../state/ids";
import type { Frame, Project } from "../model/types";

export interface Example {
  /** Display name (filename without `.json`, slashes turned into spaces). */
  name: string;
  /** Decoded project for thumbnail rendering + click-to-load. */
  project: Project;
}

// Eager-load so each example becomes a static JS object in the bundle. Vite
// resolves the JSON imports at build time; on dev it serves them via HMR.
const modules = import.meta.glob<unknown>("/examples/*.json", {
  eager: true,
  import: "default",
});

/**
 * The bundled set of example layouts, sorted by name. Filenames that fail to
 * parse are dropped (and logged) rather than crashing the app.
 */
export function loadBundledExamples(): Example[] {
  const out: Example[] = [];
  for (const [path, raw] of Object.entries(modules)) {
    const name = displayNameFromPath(path);
    try {
      const json = typeof raw === "string" ? raw : JSON.stringify(raw);
      out.push({ name, project: deserializeProject(json) });
    } catch (err) {
      // Don't take the whole UI down for one bad example.
      console.warn(`Skipping example "${name}":`, err);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function displayNameFromPath(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.json$/i, "").replace(/[-_]+/g, " ");
}

/**
 * Re-centers + freshly-ids the example's frames so they can be merged into
 * the current project (preserving the current wall settings). The frame
 * bounding box's center is translated to the wall's center.
 */
export function importExampleFrames(
  example: Example,
  wallWidth: number,
  wallHeight: number,
): Frame[] {
  const frames = example.project.frames;
  if (frames.length === 0) return [];

  // Union of all frame outer AABBs.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of frames) {
    const aabb = outerAABB(f);
    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.width);
    maxY = Math.max(maxY, aabb.y + aabb.height);
  }
  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;
  const wallCx = wallWidth / 2;
  const wallCy = wallHeight / 2;
  const dx = wallCx - bboxCx;
  const dy = wallCy - bboxCy;

  // Drop any photo reference — examples ship without photos — and assign
  // fresh ids so re-importing the same example creates new frames.
  return frames.map((f) => ({
    ...f,
    id: newId("frame"),
    x: f.x + dx,
    y: f.y + dy,
    photoId: null,
  }));
}

/**
 * Frame-only thumbnail SVG for an example layout. Renders each frame as a
 * filled rectangle in its frame color against the example's wall outline.
 * No grid, no photos, no labels — small enough to live in a 2-col grid.
 */
export function renderExampleThumbnail(example: Example): SVGSVGElement {
  const { wall, frames } = example.project;
  // Use the wall as the viewBox (with a small margin). Frames may overflow,
  // but most examples place frames within or near the wall extents.
  const margin = Math.max(wall.width, wall.height) * 0.05;
  const vb = `${-margin} ${-margin} ${wall.width + margin * 2} ${
    wall.height + margin * 2
  }`;
  const svg = svgEl("svg", {
    viewBox: vb,
    preserveAspectRatio: "xMidYMid meet",
    class: "example-thumb__svg",
  }) as SVGSVGElement;

  // Wall outline.
  svg.appendChild(
    svgEl("rect", {
      x: 0,
      y: 0,
      width: wall.width,
      height: wall.height,
      fill: wall.color,
      stroke: "#d0d0d6",
      "stroke-width": 0.5,
      "vector-effect": "non-scaling-stroke",
    }),
  );

  // Each frame is drawn as an outlined rectangle (a frame-on-wall preview),
  // not a filled box. Stroke uses the frame's own color; `non-scaling-stroke`
  // keeps the line a consistent thickness regardless of thumbnail size.
  // Outer size already handles 90°/270° rotation (width/height swap).
  for (const f of frames) {
    const size = outerSize(f);
    svg.appendChild(
      svgEl("rect", {
        x: f.x,
        y: f.y,
        width: size.width,
        height: size.height,
        fill: "none",
        stroke: f.color,
        "stroke-width": 1.5,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  return svg;
}
