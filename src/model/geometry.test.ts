import { describe, expect, it } from "vitest";
import {
  aabbsOverlap,
  aspectRatio,
  defaultPasspartoutOptions,
  effectivePrintSize,
  nearestStandardSize,
  orientationFromPixels,
  orientSize,
  outerAABB,
  outerSize,
} from "./geometry";
import { ISO_A_SERIES, defaultStandardSizes } from "./sizes";
import type { Frame, SizeCm } from "./types";

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "f1",
    x: 10,
    y: 20,
    aperture: { width: 21.0, height: 29.7 },
    standardSizeId: "A4",
    thickness: 1,
    passpartout: null,
    color: "#1a1a1a",
    rotation: 0,
    photoId: null,
    ...overrides,
  };
}

describe("orientationFromPixels", () => {
  it("landscape when wider than tall", () => {
    expect(orientationFromPixels(4000, 3000)).toBe("landscape");
  });
  it("portrait when taller than wide", () => {
    expect(orientationFromPixels(3000, 4000)).toBe("portrait");
  });
  it("square counts as portrait", () => {
    expect(orientationFromPixels(1000, 1000)).toBe("portrait");
  });
});

describe("orientSize", () => {
  it("keeps portrait baseline", () => {
    expect(orientSize({ width: 21, height: 29.7 }, "portrait")).toEqual({
      width: 21,
      height: 29.7,
    });
  });
  it("swaps for landscape", () => {
    expect(orientSize({ width: 21, height: 29.7 }, "landscape")).toEqual({
      width: 29.7,
      height: 21,
    });
  });
});

describe("nearestStandardSize", () => {
  const sizes = defaultStandardSizes();
  const aRatio = aspectRatio({ width: 21, height: 29.7 }); // ~0.707 portrait

  it("matches A-series ratio and tie-breaks to A4 (portrait)", () => {
    const result = nearestStandardSize(aRatio, "portrait", sizes);
    expect(result?.id).toBe("A4");
  });

  it("matches landscape A-series ratio, tie-break A4", () => {
    const landscapeRatio = 29.7 / 21; // ~1.414
    const result = nearestStandardSize(landscapeRatio, "landscape", sizes);
    expect(result?.id).toBe("A4");
  });

  it("returns null (custom fallback) for a far-off square-ish ratio", () => {
    const result = nearestStandardSize(1.0, "portrait", sizes);
    expect(result).toBeNull();
  });

  it("honors a custom preferred size id on ties", () => {
    const result = nearestStandardSize(aRatio, "portrait", sizes, {
      preferredSizeId: "A2",
    });
    expect(result?.id).toBe("A2");
  });

  it("returns null for empty size list", () => {
    expect(nearestStandardSize(aRatio, "portrait", [])).toBeNull();
  });
});

describe("effectivePrintSize", () => {
  it("uses aperture when no passpartout", () => {
    expect(effectivePrintSize(makeFrame())).toEqual({ width: 21, height: 29.7 });
  });
  it("uses passpartout inner window when set", () => {
    const frame = makeFrame({
      passpartout: { id: "A5", name: "A5", width: 14.8, height: 21.0 },
    });
    expect(effectivePrintSize(frame)).toEqual({ width: 14.8, height: 21.0 });
  });
});

describe("outerSize / outerAABB", () => {
  it("adds thickness on each side", () => {
    expect(outerSize(makeFrame({ thickness: 2 }))).toEqual({
      width: 21 + 4,
      height: 29.7 + 4,
    });
  });

  it("swaps width/height for 90° rotation", () => {
    const s = outerSize(makeFrame({ thickness: 1, rotation: 90 }));
    expect(s).toEqual({ width: 29.7 + 2, height: 21 + 2 });
  });

  it("keeps dimensions for 180° rotation", () => {
    const s = outerSize(makeFrame({ thickness: 1, rotation: 180 }));
    expect(s).toEqual({ width: 21 + 2, height: 29.7 + 2 });
  });

  it("AABB uses outer top-left position", () => {
    expect(outerAABB(makeFrame({ x: 5, y: 7, thickness: 1 }))).toEqual({
      x: 5,
      y: 7,
      width: 23,
      height: 31.7,
    });
  });
});

describe("defaultPasspartoutOptions", () => {
  it("A3 offers A4, A5, A6", () => {
    const opts = defaultPasspartoutOptions(defaultStandardSizes());
    expect(opts["A3"]?.map((o) => o.id)).toEqual(["A4", "A5", "A6"]);
  });

  it("A6 (smallest) offers nothing", () => {
    const opts = defaultPasspartoutOptions(defaultStandardSizes());
    expect(opts["A6"]).toEqual([]);
  });

  it("A0 offers all smaller sizes", () => {
    const opts = defaultPasspartoutOptions(defaultStandardSizes());
    expect(opts["A0"]?.map((o) => o.id)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
    ]);
  });

  it("covers every standard size as a key", () => {
    const opts = defaultPasspartoutOptions(ISO_A_SERIES);
    expect(Object.keys(opts).sort()).toEqual(
      ISO_A_SERIES.map((s) => s.id).sort(),
    );
  });
});

describe("aabbsOverlap", () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  it("detects overlap", () => {
    expect(aabbsOverlap(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
  it("touching edges do not overlap", () => {
    expect(aabbsOverlap(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });
  it("separate boxes do not overlap", () => {
    expect(aabbsOverlap(a, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
  });
});

describe("aspectRatio", () => {
  it("computes width/height", () => {
    const s: SizeCm = { width: 16, height: 9 };
    expect(aspectRatio(s)).toBeCloseTo(1.777, 2);
  });
});
