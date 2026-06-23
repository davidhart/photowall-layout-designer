// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFrame } from "./state/commands";
import type { Store } from "./state/store";
import type { Frame } from "./model/types";

const BODY = `
  <div id="app">
    <main id="wall-view" class="wall-view"></main>
    <aside id="left-panel" class="left-panel">
      <button id="left-panel-toggle" class="left-panel__toggle" aria-expanded="true">‹</button>
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

    // Project actions rendered in the panel (no top toolbar anymore).
    const actionLabels = Array.from(
      settings?.querySelectorAll(".project-actions button") ?? [],
    ).map((b) => b.textContent);
    expect(actionLabels).toEqual(["New", "Open", "Save", "Generate BOM"]);

    // Frames palette rendered.
    expect(
      document.querySelectorAll('[data-tab-panel="frames"] .palette-item').length,
    ).toBeGreaterThan(0);

    // Bundled examples surfaced as a grid in the Project tab.
    expect(
      document.querySelectorAll('[data-tab-panel="project"] .example-thumb').length,
    ).toBeGreaterThan(0);
  });

  it("toggles the left panel collapsed/expanded via the chevron button", async () => {
    await import("./main");
    const panel = document.getElementById("left-panel")!;
    const toggle = document.getElementById("left-panel-toggle")!;
    expect(panel.classList.contains("left-panel--collapsed")).toBe(false);
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.classList.contains("left-panel--collapsed")).toBe(true);
    expect(toggle.textContent).toBe("›");
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.classList.contains("left-panel--collapsed")).toBe(false);
    expect(toggle.textContent).toBe("‹");
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

  it("refits the viewBox after replaceProject (so drag/drop don't lock up)", async () => {
    // Give the wall container a non-zero size so the fit math can run.
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }) as DOMRect,
    });

    await import("./main");
    const store = (window as unknown as { __store: Store }).__store;
    // Wait for the initial rAF-deferred fit().
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(store.getUI().viewBox).not.toBeNull();

    // Simulate Load Example / New / Open — replaceProject nulls the viewBox,
    // and the listener must refit synchronously so pointer/drop handlers
    // (which read store.viewBox directly) don't bail out.
    const fresh = { ...store.getProject(), frames: [] };
    store.replaceProject(fresh);
    expect(store.getUI().viewBox).not.toBeNull();
  });
});
