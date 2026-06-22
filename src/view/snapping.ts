import { outerAABB } from "../model/geometry";
import type { AABB, Frame } from "../model/types";

/** Snap engagement tolerance in cm (see DESIGN.md → Snapping). */
export const SNAP_TOLERANCE = 0.5;

export interface SnapResult {
  /** correction in cm to add to the proposed position, per axis */
  dx: number;
  dy: number;
  /** guide lines to render while dragging */
  guides: { vertical: number[]; horizontal: number[] };
}

/** Union of several AABBs (the group bounding box). */
export function unionAABB(boxes: readonly AABB[]): AABB | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface Span {
  mainStart: number;
  mainEnd: number;
  perpStart: number;
  perpEnd: number;
}

interface Candidate {
  delta: number;
  guides: number[];
  /** 0 = alignment (preferred on ties), 1 = spacing */
  priority: number;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Computes the best snap along one axis. `main` is the axis being snapped;
 * `perp` is used for row/column overlap tests. Considers alignment (edge +
 * center lines, no overlap required) and spacing (match an existing gap to a
 * neighbor in the same row/column).
 */
function computeAxisSnap(
  moving: Span,
  others: readonly Span[],
  tolerance: number,
): { delta: number; guides: number[] } | null {
  const movingEdges = [
    moving.mainStart,
    (moving.mainStart + moving.mainEnd) / 2,
    moving.mainEnd,
  ];
  const candidates: Candidate[] = [];

  // --- Alignment: line up edges/centers with any other frame ---
  for (const o of others) {
    const lines = [o.mainStart, (o.mainStart + o.mainEnd) / 2, o.mainEnd];
    for (const me of movingEdges) {
      for (const ln of lines) {
        const delta = ln - me;
        if (Math.abs(delta) <= tolerance) {
          candidates.push({ delta, guides: [ln], priority: 0 });
        }
      }
    }
  }

  // --- Spacing: match an existing inter-frame gap ---
  const gaps: number[] = [];
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue;
      const a = others[i]!;
      const b = others[j]!;
      if (!overlaps(a.perpStart, a.perpEnd, b.perpStart, b.perpEnd)) continue;
      const gap = b.mainStart - a.mainEnd;
      if (gap > tolerance) gaps.push(gap);
    }
  }

  for (const n of others) {
    if (!overlaps(moving.perpStart, moving.perpEnd, n.perpStart, n.perpEnd)) {
      continue;
    }
    for (const g of gaps) {
      if (n.mainEnd <= moving.mainStart) {
        // neighbor is before the moving box
        const delta = n.mainEnd + g - moving.mainStart;
        if (Math.abs(delta) <= tolerance) {
          candidates.push({
            delta,
            guides: [n.mainEnd, moving.mainStart + delta],
            priority: 1,
          });
        }
      } else if (n.mainStart >= moving.mainEnd) {
        // neighbor is after the moving box
        const delta = n.mainStart - g - moving.mainEnd;
        if (Math.abs(delta) <= tolerance) {
          candidates.push({
            delta,
            guides: [moving.mainEnd + delta, n.mainStart],
            priority: 1,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      Math.abs(a.delta) - Math.abs(b.delta) || a.priority - b.priority,
  );
  const best = candidates[0]!;
  return { delta: best.delta, guides: best.guides };
}

/**
 * Computes the snap correction for a moving group bounding box (outer edges,
 * cm) against the other frames' outer boxes.
 */
export function computeSnap(
  movingBox: AABB,
  others: readonly AABB[],
  tolerance = SNAP_TOLERANCE,
): SnapResult {
  const movingX: Span = {
    mainStart: movingBox.x,
    mainEnd: movingBox.x + movingBox.width,
    perpStart: movingBox.y,
    perpEnd: movingBox.y + movingBox.height,
  };
  const othersX: Span[] = others.map((o) => ({
    mainStart: o.x,
    mainEnd: o.x + o.width,
    perpStart: o.y,
    perpEnd: o.y + o.height,
  }));
  const movingY: Span = {
    mainStart: movingBox.y,
    mainEnd: movingBox.y + movingBox.height,
    perpStart: movingBox.x,
    perpEnd: movingBox.x + movingBox.width,
  };
  const othersY: Span[] = others.map((o) => ({
    mainStart: o.y,
    mainEnd: o.y + o.height,
    perpStart: o.x,
    perpEnd: o.x + o.width,
  }));

  const x = computeAxisSnap(movingX, othersX, tolerance);
  const y = computeAxisSnap(movingY, othersY, tolerance);

  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guides: {
      vertical: x?.guides ?? [],
      horizontal: y?.guides ?? [],
    },
  };
}

/** Convenience: outer bounding box of a set of frames at their current pos. */
export function groupBox(frames: readonly Frame[]): AABB | null {
  return unionAABB(frames.map(outerAABB));
}
