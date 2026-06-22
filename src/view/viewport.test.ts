import { describe, expect, it } from "vitest";
import {
  clampScale,
  fitViewBox,
  matchAspect,
  panBy,
  pxToCm,
  scaleOf,
  zoomAt,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./viewport";

const wall = { width: 200, height: 150 };

describe("matchAspect", () => {
  it("widens a box to a wider aspect, keeping center", () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const out = matchAspect(box, 2); // want width:height = 2:1
    expect(out.width / out.height).toBeCloseTo(2);
    expect(out.x + out.width / 2).toBeCloseTo(50); // center preserved
    expect(out.height).toBe(100);
  });

  it("heightens a box to a taller aspect, keeping center", () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const out = matchAspect(box, 0.5);
    expect(out.width / out.height).toBeCloseTo(0.5);
    expect(out.y + out.height / 2).toBeCloseTo(50);
    expect(out.width).toBe(100);
  });
});

describe("fitViewBox", () => {
  it("matches the container aspect and contains the wall", () => {
    const vb = fitViewBox(wall, 800, 400); // 2:1 container
    expect(vb.width / vb.height).toBeCloseTo(2);
    // wall (with margin) fully inside
    expect(vb.x).toBeLessThanOrEqual(0);
    expect(vb.y).toBeLessThanOrEqual(0);
    expect(vb.x + vb.width).toBeGreaterThanOrEqual(wall.width);
    expect(vb.y + vb.height).toBeGreaterThanOrEqual(wall.height);
  });
});

describe("scaleOf + clampScale", () => {
  it("computes px per cm", () => {
    expect(scaleOf({ x: 0, y: 0, width: 200, height: 100 }, 800)).toBe(4);
  });
  it("clamps within zoom range", () => {
    expect(clampScale(1000, 10)).toBe(10 * ZOOM_MAX);
    expect(clampScale(0.001, 10)).toBe(10 * ZOOM_MIN);
    expect(clampScale(25, 10)).toBe(25);
  });
});

describe("zoomAt", () => {
  const vb = { x: 0, y: 0, width: 200, height: 100 };
  const cw = 800;
  const ch = 400;
  const fitScale = scaleOf(vb, cw); // 4

  it("keeps the cm point under the cursor fixed", () => {
    const cursorX = 200;
    const cursorY = 100;
    const cmBefore = pxToCm(vb, cw, ch, cursorX, cursorY);
    const zoomed = zoomAt(vb, cw, ch, cursorX, cursorY, 2, fitScale * 8);
    const cmAfter = pxToCm(zoomed, cw, ch, cursorX, cursorY);
    expect(cmAfter.x).toBeCloseTo(cmBefore.x);
    expect(cmAfter.y).toBeCloseTo(cmBefore.y);
  });

  it("zooming in shrinks the viewBox", () => {
    const zoomed = zoomAt(vb, cw, ch, 400, 200, 2, fitScale * 8);
    expect(zoomed.width).toBeLessThan(vb.width);
  });

  it("respects the max-zoom clamp", () => {
    const zoomed = zoomAt(vb, cw, ch, 400, 200, 1000, fitScale);
    // can't zoom past fitScale * ZOOM_MAX
    expect(scaleOf(zoomed, cw)).toBeCloseTo(fitScale * ZOOM_MAX);
  });
});

describe("panBy", () => {
  it("moves the viewBox opposite the drag direction, scaled to cm", () => {
    const vb = { x: 0, y: 0, width: 200, height: 100 };
    // scale = 800/200 = 4 px/cm; drag right 40px -> 10cm left
    const out = panBy(vb, 800, 40, 20);
    expect(out.x).toBeCloseTo(-10);
    expect(out.y).toBeCloseTo(-5);
    expect(out.width).toBe(200);
  });
});
