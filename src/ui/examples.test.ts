// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { outerAABB } from "../model/geometry";
import {
  type Example,
  importExampleFrames,
  loadBundledExamples,
  renderExampleThumbnail,
} from "./examples";
import type { Frame } from "../model/types";

function fr(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "fx",
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

function example(frames: Frame[]): Example {
  return {
    name: "test",
    project: {
      version: 1,
      wall: { width: 200, height: 150, color: "#ffffff" },
      photos: [],
      frames,
      customColors: [],
    },
  };
}

describe("loadBundledExamples", () => {
  it("picks up every .json file in /examples/ and decodes it", () => {
    const examples = loadBundledExamples();
    // We ship at least one example in the repo's /examples/ folder.
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((e) => e.project.frames.length > 0)).toBe(true);
  });

  it("returns examples sorted by display name", () => {
    const names = loadBundledExamples().map((e) => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

describe("importExampleFrames", () => {
  it("centers the frame bounding box on the wall center", () => {
    // Two A4 frames placed far from center.
    const ex = example([fr({ id: "a", x: 0, y: 0 }), fr({ id: "b", x: 50, y: 30 })]);
    const wallW = 200;
    const wallH = 150;
    const imported = importExampleFrames(ex, wallW, wallH);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const f of imported) {
      const a = outerAABB(f);
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.width);
      maxY = Math.max(maxY, a.y + a.height);
    }
    expect((minX + maxX) / 2).toBeCloseTo(wallW / 2);
    expect((minY + maxY) / 2).toBeCloseTo(wallH / 2);
  });

  it("assigns fresh ids and clears photo references", () => {
    const ex = example([fr({ id: "orig", photoId: "p1" })]);
    const [imported] = importExampleFrames(ex, 200, 150);
    expect(imported!.id).not.toBe("orig");
    expect(imported!.photoId).toBeNull();
  });

  it("returns an empty array for an example with no frames", () => {
    expect(importExampleFrames(example([]), 200, 150)).toEqual([]);
  });
});

describe("renderExampleThumbnail", () => {
  it("renders one rect per frame (plus the wall outline)", () => {
    const ex = example([fr({ id: "a" }), fr({ id: "b", x: 50 })]);
    const svg = renderExampleThumbnail(ex);
    // 1 wall outline + 2 frame rects.
    expect(svg.querySelectorAll("rect").length).toBe(3);
  });
});
