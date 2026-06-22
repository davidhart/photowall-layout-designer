import "./style.css";
import { WallView } from "./render/renderer";
import { bindHistoryShortcuts } from "./state/keyboard";
import { Store } from "./state/store";

/** Wires up the left-panel tab switching (real panel content comes later). */
function initTabs(): void {
  const tabs = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.left-panel__tabs [role="tab"]'),
  );
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tab-panel]"),
  );
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
      for (const panel of panels) panel.hidden = panel.dataset.tabPanel !== name;
    });
  }
}

function boot(): void {
  const wallContainer = document.getElementById("wall-view");
  if (!wallContainer) throw new Error("#wall-view not found");

  const store = new Store();
  const wallView = new WallView(wallContainer, store);
  wallView.render();

  bindHistoryShortcuts(store);
  initTabs();

  // Expose for ad-hoc debugging during development.
  (window as unknown as { __store?: Store }).__store = store;
}

boot();
