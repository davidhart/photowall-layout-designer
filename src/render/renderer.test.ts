// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  addFrame,
  addPhoto,
  deleteFrames,
  moveFrames,
  recolorFrames,
  updateWall,
} from "../state/commands";
import { Store } from "../state/store";
import type { Frame, Photo } from "../model/types";
import { WallView } from "./renderer";

function frame(id: string, overrides: Partial<Frame> = {}): Frame {
  return {
    id,
    x: 10,
    y: 10,
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
  name: "p.jpg",
  dataUrl: "data:image/png;base64,AAAA",
  thumbnailDataUrl: "data:image/png;base64,T",
  pixelWidth: 2100,
  pixelHeight: 2970,
};

describe("WallView incremental rendering", () => {
  let container: HTMLElement;
  let store: Store;
  let view: WallView;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.replaceChildren(container);
    store = new Store();
    view = new WallView(container, store);
    view.render();
  });

  it("pan/zoom updates the viewBox in place without recreating the SVG or images", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));

    const svgBefore = view.element;
    const imageBefore = svgBefore?.querySelector("image");
    expect(imageBefore).not.toBeNull();

    // Simulate a pan/zoom: viewBox-only change.
    store.setViewBox({ x: 5, y: 5, width: 100, height: 80 });

    // Same <svg> node and same <image> node — nothing was rebuilt.
    expect(view.element).toBe(svgBefore);
    expect(view.element?.querySelector("image")).toBe(imageBefore);
    expect(view.element?.getAttribute("viewBox")).toBe("5 5 100 80");
  });

  it("dragging moves the frame group's transform in place, keeping the image node", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));

    const group = view.element?.querySelector<SVGGElement>('[data-frame-id="f1"]');
    const imageNode = group?.querySelector("image");
    const transformBefore = group?.getAttribute("transform");

    store.setDrag({ ids: ["f1"], dx: 10, dy: 0 });

    // Same group + image nodes; only the transform changed.
    expect(view.element?.querySelector('[data-frame-id="f1"]')).toBe(group);
    expect(group?.querySelector("image")).toBe(imageNode);
    expect(group?.getAttribute("transform")).not.toBe(transformBefore);
  });

  it("adds a frame group in place — same <svg> element, new .frame appears", () => {
    const svgBefore = view.element;
    expect(svgBefore?.querySelectorAll(".frame").length).toBe(0);
    store.dispatch(addFrame(frame("f1")));
    expect(view.element).toBe(svgBefore);
    expect(view.element?.querySelectorAll(".frame").length).toBe(1);
  });

  it("recoloring one frame doesn't touch the other frames' image nodes", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));
    store.dispatch(addFrame(frame("f2", { photoId: "p1", x: 50 })));

    const f1Group = view.element?.querySelector<SVGGElement>('[data-frame-id="f1"]');
    const f2Group = view.element?.querySelector<SVGGElement>('[data-frame-id="f2"]');
    const f1Image = f1Group?.querySelector("image");
    const f2Image = f2Group?.querySelector("image");

    store.dispatch(recolorFrames(["f1"], "#ff0000"));

    // f1's group was rebuilt (color changed) — its image is a fresh node.
    expect(view.element?.querySelector('[data-frame-id="f1"]')).not.toBe(f1Group);
    // f2 is untouched: same group AND same image element survive.
    expect(view.element?.querySelector('[data-frame-id="f2"]')).toBe(f2Group);
    expect(f2Group?.querySelector("image")).toBe(f2Image);
    // Sanity: f1's new image still has the correct href.
    const f1NewImage = view.element
      ?.querySelector('[data-frame-id="f1"]')
      ?.querySelector("image");
    expect(f1NewImage?.getAttribute("href")).toBe(photo.dataUrl);
    // (Avoid unused-var complaint.)
    expect(f1Image).not.toBeNull();
  });

  it("updateWall edits the wall-bg + grid attrs in place; no frame groups touched", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));
    store.dispatch(addFrame(frame("f2", { x: 50 })));

    const svgBefore = view.element;
    const f1GroupBefore = svgBefore?.querySelector('[data-frame-id="f1"]');
    const f2GroupBefore = svgBefore?.querySelector('[data-frame-id="f2"]');
    const imageBefore = svgBefore?.querySelector("image");

    store.dispatch(updateWall({ color: "#aabbcc", width: 300 }));

    // Same SVG and same frame/image nodes.
    expect(view.element).toBe(svgBefore);
    expect(view.element?.querySelector('[data-frame-id="f1"]')).toBe(f1GroupBefore);
    expect(view.element?.querySelector('[data-frame-id="f2"]')).toBe(f2GroupBefore);
    expect(view.element?.querySelector("image")).toBe(imageBefore);
    // Wall-bg + grid picked up the new dimensions / color.
    const bg = view.element?.querySelector<SVGRectElement>(".wall-bg");
    expect(bg?.getAttribute("fill")).toBe("#aabbcc");
    expect(bg?.getAttribute("width")).toBe("300");
    const grid = view.element?.querySelector<SVGRectElement>(".wall-grid");
    expect(grid?.getAttribute("width")).toBe("300");
  });

  it("deleting a frame removes only its group; other frames are untouched", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));
    store.dispatch(addFrame(frame("f2", { x: 50 })));

    const f2GroupBefore = view.element?.querySelector('[data-frame-id="f2"]');

    store.dispatch(deleteFrames(["f1"]));

    expect(view.element?.querySelector('[data-frame-id="f1"]')).toBeNull();
    expect(view.element?.querySelector('[data-frame-id="f2"]')).toBe(f2GroupBefore);
  });

  it("selecting/deselecting only toggles the selection rect — no SVG/image rebuild", () => {
    store.dispatch(addPhoto(photo));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));
    store.dispatch(addFrame(frame("f2", { x: 50 })));

    const svgBefore = view.element;
    const imageBefore = svgBefore?.querySelector("image");
    const selectionRect = svgBefore?.querySelector<SVGRectElement>(
      '[data-frame-id="f1"] .frame__selection',
    );
    expect(selectionRect?.getAttribute("display")).toBe("none");

    store.setSelection(["f1"]);

    // Same <svg> + same <image> — no rebuild, no photo re-decode.
    expect(view.element).toBe(svgBefore);
    expect(view.element?.querySelector("image")).toBe(imageBefore);
    // The selection rect went from hidden to visible in place.
    expect(selectionRect?.getAttribute("display")).toBeNull();

    // Deselect: same node, hidden again.
    store.setSelection([]);
    expect(view.element).toBe(svgBefore);
    expect(selectionRect?.getAttribute("display")).toBe("none");
  });

  it("commits a drag offset into frame positions on moveFrames", () => {
    store.dispatch(addFrame(frame("f1", { x: 10, y: 10 })));
    store.setDrag({ ids: ["f1"], dx: 7, dy: 3 });
    store.setDrag(null);
    store.dispatch(moveFrames(["f1"], 7, 3));
    expect(store.getProject().frames[0]).toMatchObject({ x: 17, y: 13 });
  });
});
