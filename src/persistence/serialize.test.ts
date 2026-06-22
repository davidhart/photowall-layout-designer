import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import type { Frame } from "../model/types";
import {
  deserializeProject,
  ProjectParseError,
  serializeProject,
} from "./serialize";

function frame(id: string, overrides: Partial<Frame> = {}): Frame {
  return {
    id,
    x: 5,
    y: 6,
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

describe("serialize / deserialize round-trip", () => {
  it("preserves wall, frames, and photos", () => {
    const p = defaultProject();
    p.frames.push(frame("f1", { rotation: 90 }));
    p.photos.push({
      id: "p1",
      name: "p.jpg",
      dataUrl: "data:image/png;base64,AAA",
      thumbnailDataUrl: "data:image/png;base64,T",
      pixelWidth: 100,
      pixelHeight: 200,
    });
    const back = deserializeProject(serializeProject(p));
    expect(back.wall.width).toBe(p.wall.width);
    expect(back.frames[0]?.rotation).toBe(90);
    expect(back.photos[0]?.dataUrl).toBe("data:image/png;base64,AAA");
  });

  it("omits images and clears photoIds when embedImages is false (localStorage mode)", () => {
    const p = defaultProject();
    p.photos.push({
      id: "p1",
      name: "p.jpg",
      dataUrl: "data:image/png;base64,HUGE",
      thumbnailDataUrl: "data:image/png;base64,T",
      pixelWidth: 100,
      pixelHeight: 200,
    });
    p.frames.push(frame("f1", { photoId: "p1" }));

    const json = serializeProject(p, { embedImages: false });
    expect(json).not.toContain("HUGE"); // no image data persisted
    const back = deserializeProject(json);
    expect(back.photos).toEqual([]);
    expect(back.frames[0]?.photoId).toBeNull(); // restores as empty placeholder
    // layout is preserved
    expect(back.frames[0]?.aperture).toEqual({ width: 21, height: 29.7 });
    expect(back.wall.width).toBe(p.wall.width);
  });

  it("embeds only custom colors used by frames", () => {
    const p = defaultProject();
    p.customColors.push(
      { id: "c1", label: "Used", hex: "#abcdef" },
      { id: "c2", label: "Unused", hex: "#123456" },
    );
    p.frames.push(frame("f1", { color: "#abcdef" }));
    const back = deserializeProject(serializeProject(p));
    expect(back.customColors.map((c) => c.hex)).toEqual(["#abcdef"]);
  });
});

describe("deserialize validation", () => {
  it("rejects non-JSON", () => {
    expect(() => deserializeProject("{not json")).toThrow(ProjectParseError);
  });
  it("rejects payloads missing frames/photos", () => {
    expect(() => deserializeProject('{"wall":{}}')).toThrow(ProjectParseError);
  });
  it("is lenient about missing optional fields", () => {
    const json = JSON.stringify({
      frames: [{ id: "f1", x: 1, y: 2, aperture: { width: 10, height: 20 } }],
      photos: [],
    });
    const p = deserializeProject(json);
    expect(p.frames[0]?.thickness).toBe(1); // defaulted
    expect(p.frames[0]?.color).toBe("#1a1a1a"); // defaulted
    expect(p.wall.width).toBe(200); // default wall
  });

  it("coerces invalid rotation to 0", () => {
    const json = JSON.stringify({
      frames: [{ id: "f", x: 0, y: 0, aperture: { width: 1, height: 1 }, rotation: 45 }],
      photos: [],
    });
    expect(deserializeProject(json).frames[0]?.rotation).toBe(0);
  });
});
