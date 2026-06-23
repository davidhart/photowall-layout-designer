import "./style.css";
import { WallView } from "./render/renderer";
import { bindHistoryShortcuts } from "./state/keyboard";
import { generateBillOfMaterials } from "./bom/print";
import { attachAutosave } from "./persistence/autosave";
import {
  loadPalette,
  loadProjectFromStorage,
} from "./persistence/storage";
import { Store } from "./state/store";
import { LeftPanel } from "./ui/panel";
import {
  mergeProjectColorsIntoPalette,
  newProject,
  openProject,
  saveProject,
} from "./ui/projectActions";
import { PropertiesPanel } from "./ui/properties";
import { ViewportControls } from "./view/controls";
import { InteractionController } from "./view/interaction";
import { DropController } from "./view/dropController";

/** Wires up the left-panel tab switching. */
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

  // Restore the last auto-saved project + cross-project custom palette.
  const restored = loadProjectFromStorage();
  const store = new Store(restored ?? undefined);
  store.setCustomPalette(loadPalette());
  if (restored) mergeProjectColorsIntoPalette(store, restored);

  const wallView = new WallView(wallContainer, store);
  wallView.render();

  const showErrors = (errors: string[]): void => {
    if (errors.length) alert(errors.join("\n"));
  };

  new ViewportControls(wallContainer, store);
  new InteractionController(wallContainer, store);
  new LeftPanel(store, {
    onNew: () => newProject(store),
    onOpen: () => openProject(store, (m) => alert(m)),
    onSave: () => saveProject(store),
    onGenerateBom: () => generateBillOfMaterials(store.getProject()),
  });
  new DropController(wallContainer, store, showErrors);

  const propsEl = document.getElementById("properties-panel");
  if (propsEl) new PropertiesPanel(propsEl, store, (m) => showErrors([m]));

  attachAutosave(store, (message) => showErrors([message]));

  bindHistoryShortcuts(store);
  initTabs();

  // Expose for ad-hoc debugging during development.
  (window as unknown as { __store?: Store }).__store = store;
}

boot();
