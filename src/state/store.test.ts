import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import type { Frame, Photo } from "../model/types";
import {
  addFrame,
  addPhoto,
  deleteFrames,
  moveFrames,
  placePhotoInFrame,
  recolorFrames,
  removePhoto,
  rotateFramesBy,
} from "./commands";
import { Store } from "./store";

function frame(id: string, overrides: Partial<Frame> = {}): Frame {
  return {
    id,
    x: 0,
    y: 0,
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

function photo(id: string): Photo {
  return {
    id,
    name: `${id}.jpg`,
    dataUrl: "data:image/jpeg;base64,xxx",
    thumbnailDataUrl: "data:image/jpeg;base64,t",
    pixelWidth: 3000,
    pixelHeight: 4000,
  };
}

describe("Store dispatch + immutability", () => {
  it("applies a command and does not mutate the previous project", () => {
    const store = new Store(defaultProject());
    const before = store.getProject();
    store.dispatch(addFrame(frame("f1")));
    expect(before.frames).toHaveLength(0);
    expect(store.getProject().frames).toHaveLength(1);
    expect(store.getProject()).not.toBe(before);
  });

  it("notifies subscribers on change", () => {
    const store = new Store();
    let calls = 0;
    store.subscribe(() => calls++);
    store.dispatch(addFrame(frame("f1")));
    expect(calls).toBe(1);
  });

  it("ignores no-op commands (same reference)", () => {
    const store = new Store();
    let calls = 0;
    store.subscribe(() => calls++);
    store.dispatch((p) => p);
    expect(calls).toBe(0);
    expect(store.canUndo()).toBe(false);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes a mutation", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1")));
    expect(store.getProject().frames).toHaveLength(1);

    store.undo();
    expect(store.getProject().frames).toHaveLength(0);
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(store.getProject().frames).toHaveLength(1);
  });

  it("a new mutation clears the redo stack", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1")));
    store.undo();
    store.dispatch(addFrame(frame("f2")));
    expect(store.canRedo()).toBe(false);
    expect(store.getProject().frames.map((f) => f.id)).toEqual(["f2"]);
  });

  it("undo/redo across several command types", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1")));
    store.dispatch(addFrame(frame("f2")));
    store.dispatch(moveFrames(["f1", "f2"], 5, 10));
    store.dispatch(recolorFrames(["f1"], "#ff0000"));

    expect(store.getProject().frames.find((f) => f.id === "f1")?.color).toBe(
      "#ff0000",
    );
    store.undo(); // undo recolor
    expect(store.getProject().frames.find((f) => f.id === "f1")?.color).toBe(
      "#1a1a1a",
    );
    store.undo(); // undo move
    expect(store.getProject().frames.find((f) => f.id === "f1")?.x).toBe(0);
  });
});

describe("selection pruning + last color", () => {
  it("prunes selection when a selected frame is deleted", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1")));
    store.setSelection(["f1"]);
    store.dispatch(deleteFrames(["f1"]));
    expect(store.getUI().selection.frameIds).toEqual([]);
  });

  it("tracks last-selected frame color", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1", { color: "#abcdef" })));
    store.setSelection(["f1"]);
    expect(store.getUI().lastFrameColor).toBe("#abcdef");
  });
});

describe("removePhoto empties frames using it", () => {
  it("removes the photo and clears referencing frames", () => {
    const store = new Store();
    store.dispatch(addPhoto(photo("p1")));
    store.dispatch(addFrame(frame("f1", { photoId: "p1" })));
    store.dispatch(addFrame(frame("f2", { photoId: "p1" })));
    store.dispatch(removePhoto("p1"));

    expect(store.getProject().photos).toHaveLength(0);
    expect(store.getProject().frames.every((f) => f.photoId === null)).toBe(true);
  });
});

describe("placePhotoInFrame orients the frame to the photo", () => {
  function landscapePhoto(id: string): Photo {
    return { ...photo(id), pixelWidth: 4000, pixelHeight: 3000 };
  }

  it("leaves a matching-orientation frame unchanged (just sets photoId)", () => {
    const store = new Store();
    store.dispatch(addPhoto(photo("p1"))); // portrait
    store.dispatch(addFrame(frame("f1"))); // portrait aperture 21x29.7
    store.dispatch(placePhotoInFrame("f1", "p1"));
    const f = store.getProject().frames[0]!;
    expect(f.photoId).toBe("p1");
    expect(f.aperture).toEqual({ width: 21, height: 29.7 });
  });

  it("swaps the aperture for a mismatched orientation (portrait frame, landscape photo)", () => {
    const store = new Store();
    store.dispatch(addPhoto(landscapePhoto("p1")));
    store.dispatch(addFrame(frame("f1", { rotation: 90 })));
    store.dispatch(placePhotoInFrame("f1", "p1"));
    const f = store.getProject().frames[0]!;
    expect(f.aperture).toEqual({ width: 29.7, height: 21 });
    // re-deriving orientation clears the manual rotation
    expect(f.rotation).toBe(0);
  });

  it("is undoable", () => {
    const store = new Store();
    store.dispatch(addPhoto(landscapePhoto("p1")));
    store.dispatch(addFrame(frame("f1")));
    store.dispatch(placePhotoInFrame("f1", "p1"));
    store.undo();
    expect(store.getProject().frames[0]?.photoId).toBeNull();
    expect(store.getProject().frames[0]?.aperture).toEqual({ width: 21, height: 29.7 });
  });
});

describe("rotateFramesBy", () => {
  it("rotates each selected frame, wrapping 0-270", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1", { rotation: 270 })));
    store.dispatch(addFrame(frame("f2", { rotation: 0 })));
    store.dispatch(rotateFramesBy(["f1", "f2"], 90));
    expect(store.getProject().frames.find((f) => f.id === "f1")?.rotation).toBe(0);
    expect(store.getProject().frames.find((f) => f.id === "f2")?.rotation).toBe(90);
  });

  it("wraps negative deltas", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1", { rotation: 0 })));
    store.dispatch(rotateFramesBy(["f1"], -90));
    expect(store.getProject().frames[0]?.rotation).toBe(270);
  });
});

describe("replaceProject", () => {
  it("clears history and selection", () => {
    const store = new Store();
    store.dispatch(addFrame(frame("f1")));
    store.setSelection(["f1"]);
    store.replaceProject(defaultProject());
    expect(store.canUndo()).toBe(false);
    expect(store.getUI().selection.frameIds).toEqual([]);
    expect(store.getProject().frames).toHaveLength(0);
  });
});
