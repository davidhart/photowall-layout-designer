import { describe, expect, it } from "vitest";
import { defaultWallSettings } from "./defaults";
import {
  createEmptyFrame,
  createFrameForPhoto,
  customApertureForPhoto,
} from "./frameFactory";
import type { Photo } from "./types";

function photo(pw: number, ph: number): Photo {
  return {
    id: "p1",
    name: "p.jpg",
    dataUrl: "data:,",
    thumbnailDataUrl: "data:,",
    pixelWidth: pw,
    pixelHeight: ph,
  };
}

const wall = defaultWallSettings();

describe("createFrameForPhoto", () => {
  it("picks a matching A-series size for an A-ratio portrait photo", () => {
    // 21:29.7 ratio portrait
    const f = createFrameForPhoto(photo(2100, 2970), wall, "#abc", 100, 75);
    expect(f.standardSizeId).toBe("A4");
    expect(f.aperture).toEqual({ width: 21, height: 29.7 });
    expect(f.photoId).toBe("p1");
    expect(f.color).toBe("#abc");
  });

  it("orients the aperture landscape for a landscape photo", () => {
    const f = createFrameForPhoto(photo(2970, 2100), wall, "#000", 0, 0);
    expect(f.standardSizeId).toBe("A4");
    expect(f.aperture).toEqual({ width: 29.7, height: 21 });
  });

  it("falls back to a custom aperture for an odd aspect ratio", () => {
    const f = createFrameForPhoto(photo(1000, 1000), wall, "#000", 0, 0);
    expect(f.standardSizeId).toBeNull();
    expect(f.aperture).toEqual({ width: 30, height: 30 });
  });

  it("centers the outer moulding on the drop point", () => {
    const f = createFrameForPhoto(photo(2100, 2970), wall, "#000", 100, 75);
    // outer = 23 x 31.7 -> top-left = (100-11.5, 75-15.85)
    expect(f.x).toBeCloseTo(88.5);
    expect(f.y).toBeCloseTo(59.15);
  });
});

describe("customApertureForPhoto", () => {
  it("keeps aspect with long edge 30cm (landscape)", () => {
    const ap = customApertureForPhoto(photo(4000, 2000));
    expect(ap.width).toBe(30);
    expect(ap.height).toBeCloseTo(15);
  });
});

describe("createEmptyFrame", () => {
  it("creates a standard empty frame", () => {
    const f = createEmptyFrame("A3", wall, "#111", 50, 50);
    expect(f.standardSizeId).toBe("A3");
    expect(f.aperture).toEqual({ width: 29.7, height: 42 });
    expect(f.photoId).toBeNull();
    expect(f.color).toBe("#111");
  });

  it("creates a custom empty frame", () => {
    const f = createEmptyFrame("custom", wall, "#111", 0, 0);
    expect(f.standardSizeId).toBeNull();
    expect(f.aperture).toEqual({ width: 21, height: 29.7 });
  });
});
