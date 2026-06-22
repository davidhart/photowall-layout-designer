import { describe, expect, it } from "vitest";
import { isLikelySupported, thumbnailSize } from "./import";

describe("isLikelySupported", () => {
  it("accepts jpeg/png by MIME", () => {
    expect(isLikelySupported({ type: "image/jpeg", name: "a" })).toBe(true);
    expect(isLikelySupported({ type: "image/png", name: "a" })).toBe(true);
  });
  it("attempts HEIC/HEIF", () => {
    expect(isLikelySupported({ type: "image/heic", name: "a" })).toBe(true);
  });
  it("falls back to extension when MIME is empty", () => {
    expect(isLikelySupported({ type: "", name: "photo.JPG" })).toBe(true);
    expect(isLikelySupported({ type: "", name: "photo.heic" })).toBe(true);
  });
  it("rejects unsupported types", () => {
    expect(isLikelySupported({ type: "application/pdf", name: "a.pdf" })).toBe(false);
    expect(isLikelySupported({ type: "", name: "a.gif" })).toBe(false);
  });
});

describe("thumbnailSize", () => {
  it("scales the longest edge down to max, preserving aspect", () => {
    expect(thumbnailSize(4000, 3000, 256)).toEqual({ width: 256, height: 192 });
    expect(thumbnailSize(3000, 4000, 256)).toEqual({ width: 192, height: 256 });
  });
  it("never upscales small images", () => {
    expect(thumbnailSize(100, 50, 256)).toEqual({ width: 100, height: 50 });
  });
  it("clamps to at least 1px", () => {
    expect(thumbnailSize(0, 0, 256)).toEqual({ width: 1, height: 1 });
  });
});
