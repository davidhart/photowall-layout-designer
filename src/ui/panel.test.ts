// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { standardSizes } from "../model/standards";
import { addFrame } from "../state/commands";
import { Store } from "../state/store";
import type { Frame } from "../model/types";
import { LeftPanel } from "./panel";

const PANELS = `
  <section data-tab-panel="project"></section>
  <section data-tab-panel="frames"></section>
`;

function customFrame(id: string, width: number, height: number): Frame {
  return {
    id,
    x: 0,
    y: 0,
    aperture: { width, height },
    standardSizeId: null,
    thickness: 1,
    passpartout: null,
    color: "#1a1a1a",
    rotation: 0,
    photoId: null,
  };
}

describe("LeftPanel — Frames palette", () => {
  beforeEach(() => {
    document.body.innerHTML = PANELS;
  });

  it("renders one palette item per standard size plus a generic Custom template", () => {
    const store = new Store();
    new LeftPanel(store);
    const items = document.querySelectorAll(
      '[data-tab-panel="frames"] .palette-item',
    );
    // Default project ships ISO A0..A6 (7 sizes) + generic Custom.
    expect(items.length).toBe(standardSizes().length + 1);
  });

  it("surfaces each distinct custom aperture on the wall as its own template", () => {
    const store = new Store();
    new LeftPanel(store);
    const beforeCount = document.querySelectorAll(
      '[data-tab-panel="frames"] .palette-item',
    ).length;

    store.dispatch(addFrame(customFrame("f1", 25, 35)));
    store.dispatch(addFrame(customFrame("f2", 25, 35))); // dupe — coalesces
    store.dispatch(addFrame(customFrame("f3", 40, 50)));

    const items = document.querySelectorAll(
      '[data-tab-panel="frames"] .palette-item',
    );
    // +2 templates (25×35 and 40×50), not +3.
    expect(items.length).toBe(beforeCount + 2);

    // Labels should reflect the cm dimensions.
    const labels = Array.from(items).map((el) => el.textContent ?? "");
    expect(labels.some((t) => t.includes("25×35"))).toBe(true);
    expect(labels.some((t) => t.includes("40×50"))).toBe(true);
  });
});
