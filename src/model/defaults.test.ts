import { describe, expect, it } from "vitest";
import { defaultProject } from "./defaults";
import { standardPasspartoutOptions, standardSizes } from "./standards";

describe("defaultProject", () => {
  it("is a 200x150 white wall with no content", () => {
    const p = defaultProject();
    expect(p.wall.width).toBe(200);
    expect(p.wall.height).toBe(150);
    expect(p.wall.color).toBe("#ffffff");
    expect(p.photos).toEqual([]);
    expect(p.frames).toEqual([]);
    expect(p.customColors).toEqual([]);
  });
});

describe("standard sizes + passpartout defaults", () => {
  it("ships the ISO A-series A0..A6 as the hardcoded standard sizes", () => {
    expect(standardSizes().map((s) => s.id)).toEqual([
      "A0",
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
    ]);
  });

  it("seeds default passpartout options per frame size (smaller standards only)", () => {
    expect(standardPasspartoutOptions()["A3"]?.map((o) => o.id)).toEqual([
      "A4",
      "A5",
      "A6",
    ]);
  });

  it("returns independent copies (no shared mutable state)", () => {
    const a = standardSizes();
    const b = standardSizes();
    a[0]!.width = 999;
    expect(b[0]!.width).not.toBe(999);
  });
});
