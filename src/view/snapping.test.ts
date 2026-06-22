import { describe, expect, it } from "vitest";
import type { AABB } from "../model/types";
import { computeSnap, unionAABB } from "./snapping";

describe("unionAABB", () => {
  it("returns null for no boxes", () => {
    expect(unionAABB([])).toBeNull();
  });
  it("unions boxes", () => {
    const boxes: AABB[] = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 5, width: 10, height: 10 },
    ];
    expect(unionAABB(boxes)).toEqual({ x: 0, y: 0, width: 30, height: 15 });
  });
});

describe("computeSnap — alignment", () => {
  it("snaps a near-aligned left edge to another frame's left edge", () => {
    const moving: AABB = { x: 50.3, y: 0, width: 20, height: 20 };
    const other: AABB = { x: 50, y: 40, width: 20, height: 20 };
    const snap = computeSnap(moving, [other]);
    expect(snap.dx).toBeCloseTo(-0.3);
    expect(snap.guides.vertical.length).toBeGreaterThan(0);
  });

  it("does not snap when outside tolerance", () => {
    const moving: AABB = { x: 52, y: 0, width: 20, height: 20 };
    const other: AABB = { x: 50, y: 40, width: 20, height: 20 };
    const snap = computeSnap(moving, [other]);
    expect(snap.dx).toBe(0);
  });

  it("snaps top edges to align horizontally", () => {
    const moving: AABB = { x: 0, y: 10.4, width: 20, height: 20 };
    const other: AABB = { x: 40, y: 10, width: 20, height: 20 };
    const snap = computeSnap(moving, [other]);
    expect(snap.dy).toBeCloseTo(-0.4);
    // top/center/bottom all align here; a horizontal guide is shown
    expect(snap.guides.horizontal.length).toBeGreaterThan(0);
  });

  it("snaps center lines", () => {
    // moving center x ~ 60.2; other center x = 60 -> snap -0.2
    const moving: AABB = { x: 50.2, y: 0, width: 20, height: 20 };
    const other: AABB = { x: 50, y: 100, width: 20, height: 20 };
    const snap = computeSnap(moving, [other]);
    expect(snap.dx).toBeCloseTo(-0.2);
  });
});

describe("computeSnap — spacing", () => {
  it("matches an existing horizontal gap to a neighbor", () => {
    // Two reference frames with a 10cm gap between them (a.right=20, b.left=30).
    const a: AABB = { x: 0, y: 0, width: 20, height: 20 };
    const b: AABB = { x: 30, y: 0, width: 20, height: 20 };
    // Moving frame to the right of b: b.right = 50; want gap 10 -> left at 60.
    // Place it slightly off (60.3) so spacing snap pulls it to 60.
    const moving: AABB = { x: 60.3, y: 0, width: 20, height: 20 };
    const snap = computeSnap(moving, [a, b]);
    expect(snap.dx).toBeCloseTo(-0.3);
  });
});
