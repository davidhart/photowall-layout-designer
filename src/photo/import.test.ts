import { afterEach, describe, expect, it, vi } from "vitest";
import { importPhotoFiles, isLikelySupported, thumbnailSize } from "./import";

describe("importPhotoFiles", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("snapshots the file list so a source emptied mid-import isn't truncated", async () => {
    // Reproduces the picker bug: the input's live FileList is cleared after the
    // async import starts. importPhotoFiles must process every file regardless.
    const src = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.jpg", { type: "image/jpeg" }),
    ];
    let calls = 0;
    vi.stubGlobal("createImageBitmap", () => {
      calls += 1;
      if (calls === 1) src.length = 0; // emulate the live FileList being emptied
      return Promise.reject(new Error("decode disabled in test"));
    });

    const { photos, errors } = await importPhotoFiles(src);
    // Decoding is stubbed to fail, so nothing imports — but all three were
    // *attempted*, proving the list was snapshotted before the await loop.
    expect(photos).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });
});

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
