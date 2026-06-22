import { describe, expect, it } from "vitest";
import type { Frame } from "../model/types";
import {
  framesInRect,
  rectFromPoints,
  toggleSelection,
  unionSelection,
} from "./selection";

function frame(id: string, x: number, y: number): Frame {
  return {
    id,
    x,
    y,
    aperture: { width: 18, height: 18 }, // outer 20x20 with thickness 1
    standardSizeId: null,
    thickness: 1,
    passpartout: null,
    color: "#000",
    rotation: 0,
    photoId: null,
  };
}

describe("rectFromPoints", () => {
  it("normalizes corners in any order", () => {
    expect(rectFromPoints(30, 40, 10, 20)).toEqual({
      x: 10,
      y: 20,
      width: 20,
      height: 20,
    });
  });
});

describe("framesInRect", () => {
  const frames = [frame("a", 0, 0), frame("b", 100, 100), frame("c", 10, 10)];

  it("selects frames overlapping the marquee", () => {
    const hits = framesInRect(frames, { x: -5, y: -5, width: 30, height: 30 });
    expect(hits.sort()).toEqual(["a", "c"]);
  });

  it("excludes frames outside the marquee", () => {
    const hits = framesInRect(frames, { x: 200, y: 200, width: 10, height: 10 });
    expect(hits).toEqual([]);
  });
});

describe("toggleSelection", () => {
  it("adds when absent, removes when present", () => {
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("unionSelection", () => {
  it("merges without duplicates, preserving order", () => {
    expect(unionSelection(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});
