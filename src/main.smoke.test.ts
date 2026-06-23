// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFrame } from "./state/commands";
import type { Store } from "./state/store";
import type { Frame } from "./model/types";

const BODY = `
  <div id="app">
    <header id="toolbar" class="toolbar">
      <div class="toolbar__actions">
        <button data-action="new">New</button>
        <button data-action="save">Save</button>
        <button data-action="load">Load</button>
        <button data-action="bom">BOM</button>
      </div>
    </header>
    <main id="wall-view" class="wall-view"></main>
    <aside id="left-panel" class="left-panel">
      <nav class="left-panel__tabs">
        <button role="tab" data-tab="project" aria-selected="true">Project</button>
        <button role="tab" data-tab="frames">Frames</button>
      </nav>
      <div class="left-panel__body">
        <section class="tab-panel" data-tab-panel="project"></section>
        <section class="tab-panel" data-tab-panel="frames" hidden></section>
      </div>
    </aside>
    <aside id="properties-panel" class="properties-panel" hidden></aside>
  </div>
`;

function frame(id: string): Frame {
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
  };
}

describe("app boot (integration smoke)", () => {
  beforeEach(() => {
    // jsdom in this environment lacks localStorage; provide a Map-backed stub.
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    });
    document.body.innerHTML = BODY;
    // jsdom lacks ResizeObserver; stub it.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    vi.resetModules();
  });

  it("boots without throwing and renders the wall + panels", async () => {
    await import("./main");

    // Wall SVG mounted.
    const svg = document.querySelector("#wall-view svg");
    expect(svg).not.toBeNull();
    // Wall background rendered.
    expect(svg?.querySelector(".wall-bg")).not.toBeNull();
    // Zoom controls overlay present.
    expect(document.querySelector(".zoom-controls")).not.toBeNull();

    // Project panel rendered some inputs.
    const settings = document.querySelector('[data-tab-panel="project"]');
    expect(settings?.querySelectorAll("input").length).toBeGreaterThan(0);

    // Frames palette rendered.
    expect(
      document.querySelectorAll('[data-tab-panel="frames"] .palette-item').length,
    ).toBeGreaterThan(0);
  });

  it("re-renders the wall when the store changes", async () => {
    await import("./main");
    const store = (window as unknown as { __store: Store }).__store;
    expect(store).toBeTruthy();

    store.dispatch(addFrame(frame("f1")));
    const frames = document.querySelectorAll("#wall-view svg .frame");
    expect(frames.length).toBe(1);

    // Selecting the frame reveals the properties panel.
    store.setSelection(["f1"]);
    const panel = document.getElementById("properties-panel");
    expect(panel?.hidden).toBe(false);
  });
});
