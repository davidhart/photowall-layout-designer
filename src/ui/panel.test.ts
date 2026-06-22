// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../state/store";
import { LeftPanel } from "./panel";

const PANELS = `
  <section data-tab-panel="settings"></section>
  <section data-tab-panel="photos"></section>
  <section data-tab-panel="frames"></section>
`;

describe("Photos tab — Add photos file picker", () => {
  beforeEach(() => {
    document.body.innerHTML = PANELS;
  });

  it("renders a file input that allows selecting multiple images", () => {
    const store = new Store();
    new LeftPanel(store);

    const input = document.querySelector<HTMLInputElement>(
      '[data-tab-panel="photos"] input[type="file"]',
    );
    expect(input).not.toBeNull();
    // The OS picker must allow multi-select.
    expect(input!.multiple).toBe(true);
    expect(input!.accept).toContain("image/");
  });

  it("forwards a stable snapshot of every picked file (survives input reset)", () => {
    const store = new Store();
    let received: File[] | null = null;
    new LeftPanel(store, { onAddPhotos: (files) => (received = files) });

    const input = document.querySelector<HTMLInputElement>(
      '[data-tab-panel="photos"] input[type="file"]',
    )!;
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.png", { type: "image/png" }),
      new File(["c"], "c.jpg", { type: "image/jpeg" }),
    ];
    // jsdom has no DataTransfer; a length-bearing array stands in for FileList.
    Object.defineProperty(input, "files", {
      value: files as unknown as FileList,
      configurable: true,
    });

    input.dispatchEvent(new Event("change"));

    // Simulate the live FileList being emptied (as the browser does on reset).
    Object.defineProperty(input, "files", {
      value: [] as unknown as FileList,
      configurable: true,
    });

    expect(received).not.toBeNull();
    // All three survive because the handler snapshotted into an array.
    expect(received!.length).toBe(3);
    expect(Array.isArray(received)).toBe(true);
  });
});
