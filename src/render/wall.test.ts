// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import type { Frame, Photo } from "../model/types";
import { buildWallSvg, defaultViewBox, renderFrame } from "./wall";

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: "f1",
    x: 10,
    y: 20,
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

const photo: Photo = {
  id: "p1",
  name: "p1.jpg",
  dataUrl: "data:image/png;base64,AAAA",
  thumbnailDataUrl: "data:image/png;base64,T",
  pixelWidth: 3000,
  pixelHeight: 4000,
};

describe("renderFrame", () => {
  it("renders an empty frame with a white center, no image", () => {
    const g = renderFrame(frame(), null, false);
    expect(g.getAttribute("data-frame-id")).toBe("f1");
    expect(g.querySelector("image")).toBeNull();
    const rects = g.querySelectorAll("rect");
    // outer moulding + white photo backing
    expect(rects.length).toBe(2);
  });

  it("positions the group at the outer-AABB center", () => {
    const g = renderFrame(frame({ x: 10, y: 20, thickness: 1 }), null, false);
    // outer size = 23 x 31.7 -> center = (10 + 11.5, 20 + 15.85)
    expect(g.getAttribute("transform")).toBe("translate(21.5 35.85) rotate(0)");
  });

  it("renders an <image> when a photo is present", () => {
    const g = renderFrame(frame({ photoId: "p1" }), photo, false);
    const image = g.querySelector("image");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
    expect(image?.getAttribute("href")).toBe(photo.dataUrl);
  });

  it("adds a mat rect when a passpartout is set", () => {
    const g = renderFrame(
      frame({
        passpartout: { id: "A5", name: "A5", width: 14.8, height: 21 },
      }),
      null,
      false,
    );
    // outer + mat (aperture) + white inner-window backing
    expect(g.querySelectorAll("rect").length).toBe(3);
  });

  it("adds a selection highlight when selected", () => {
    const g = renderFrame(frame(), null, true);
    expect(g.querySelector(".frame__selection")).not.toBeNull();
  });

  it("rotates 90° via the group transform", () => {
    const g = renderFrame(frame({ rotation: 90 }), null, false);
    expect(g.getAttribute("transform")).toContain("rotate(90)");
  });
});

describe("buildWallSvg", () => {
  it("renders wall background + grid + frames", () => {
    const project = defaultProject();
    project.frames.push(frame(), frame({ id: "f2", x: 50 }));
    const svg = buildWallSvg(project, defaultViewBox(project), new Set(["f1"]));

    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.querySelector(".wall-bg")?.getAttribute("fill")).toBe("#ffffff");
    expect(svg.querySelectorAll(".frame").length).toBe(2);
    expect(svg.querySelectorAll(".frame__selection").length).toBe(1);
  });

  it("sets a cm-based viewBox", () => {
    const project = defaultProject();
    const vb = defaultViewBox(project);
    const svg = buildWallSvg(project, vb, new Set());
    expect(svg.getAttribute("viewBox")).toBe(
      `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
    );
  });
});
