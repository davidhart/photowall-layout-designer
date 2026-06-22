import { describe, expect, it } from "vitest";
import { defaultProject, defaultWallSettings } from "./defaults";

describe("defaultProject", () => {
  it("is a 200x150 white wall with A-series sizes and no content", () => {
    const p = defaultProject();
    expect(p.wall.width).toBe(200);
    expect(p.wall.height).toBe(150);
    expect(p.wall.color).toBe("#ffffff");
    expect(p.wall.standardSizes.map((s) => s.id)).toEqual([
      "A0",
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
    ]);
    expect(p.photos).toEqual([]);
    expect(p.frames).toEqual([]);
    expect(p.customColors).toEqual([]);
  });

  it("seeds default passpartout options per frame size", () => {
    const p = defaultProject();
    expect(p.wall.passpartoutOptions["A3"]?.map((o) => o.id)).toEqual([
      "A4",
      "A5",
      "A6",
    ]);
  });

  it("returns independent copies (no shared mutable state)", () => {
    const a = defaultWallSettings();
    const b = defaultWallSettings();
    a.standardSizes[0]!.width = 999;
    expect(b.standardSizes[0]!.width).not.toBe(999);
  });
});
