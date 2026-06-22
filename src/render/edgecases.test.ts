// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import type { Frame } from "../model/types";
import { fitViewBox } from "../view/viewport";
import { buildWallSvg, defaultViewBox, renderFrame } from "./wall";

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "f",
    x: 0,
    y: 0,
    aperture: { width: 21, height: 29.7 },
    standardSizeId: "A4",
    thickness: 1,
    passpartout: null,
    color: "#1a1a1a",
    rotation: 0,
    photoId: null,
    ...overrides,
  };
}

describe("edge cases", () => {
  it("renders an empty project (wall only, no frames)", () => {
    const p = defaultProject();
    const svg = buildWallSvg(p, defaultViewBox(p), new Set());
    expect(svg.querySelector(".wall-bg")).not.toBeNull();
    expect(svg.querySelectorAll(".frame").length).toBe(0);
  });

  it("fits very large and very small walls to finite viewBoxes", () => {
    const big = fitViewBox({ width: 10000, height: 8000 }, 800, 600);
    const small = fitViewBox({ width: 5, height: 3 }, 800, 600);
    for (const vb of [big, small]) {
      expect(Number.isFinite(vb.width)).toBe(true);
      expect(vb.width).toBeGreaterThan(0);
      expect(vb.height).toBeGreaterThan(0);
    }
  });

  it("renders ~20 overlapping frames", () => {
    const p = defaultProject();
    for (let i = 0; i < 20; i++) {
      p.frames.push(frame({ id: `f${i}`, x: i, y: i }));
    }
    const svg = buildWallSvg(p, defaultViewBox(p), new Set());
    expect(svg.querySelectorAll(".frame").length).toBe(20);
  });

  it("renders a custom-size frame", () => {
    const g = renderFrame(
      frame({ standardSizeId: null, aperture: { width: 33, height: 12 } }),
      null,
      false,
    );
    const outer = g.querySelector("rect");
    expect(outer?.getAttribute("width")).toBe("35"); // 33 + 2*1
  });

  it("renders rotation + passpartout together", () => {
    const g = renderFrame(
      frame({
        rotation: 90,
        passpartout: { id: "A5", name: "A5", width: 14.8, height: 21 },
      }),
      null,
      false,
    );
    expect(g.getAttribute("transform")).toContain("rotate(90)");
    // outer + mat + white inner-window backing
    expect(g.querySelectorAll("rect").length).toBe(3);
  });
});
