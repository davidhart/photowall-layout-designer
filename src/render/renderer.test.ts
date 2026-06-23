// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addFrame, addPhoto, moveFrames } from "../state/commands";
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

  it("rebuilds (new SVG) when the project structurally changes", () => {
    const svgBefore = view.element;
    store.dispatch(addFrame(frame("f1")));
    expect(view.element).not.toBe(svgBefore);
    expect(view.element?.querySelectorAll(".frame").length).toBe(1);
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
