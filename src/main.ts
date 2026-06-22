import "./style.css";
import { WallView } from "./render/renderer";
import { bindHistoryShortcuts } from "./state/keyboard";
import { importAndAddPhotos } from "./photo/photoService";
import { removePhoto } from "./state/commands";
import { Store } from "./state/store";
import { LeftPanel } from "./ui/panel";
import { ViewportControls } from "./view/controls";
import { InteractionController } from "./view/interaction";
import { DropController } from "./view/dropController";

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

  const showErrors = (errors: string[]): void => {
    if (errors.length) alert(errors.join("\n"));
  };

  new ViewportControls(wallContainer, store);
  new InteractionController(wallContainer, store);
  new LeftPanel(store, {
    onAddPhotos: (files) => {
      void importAndAddPhotos(store, files).then(({ errors }) => showErrors(errors));
    },
    onRemovePhoto: (photoId) => {
      const inUse = store
        .getProject()
        .frames.filter((f) => f.photoId === photoId).length;
      if (inUse > 0) {
        const ok = confirm(
          `This photo is used by ${inUse} frame${inUse > 1 ? "s" : ""}. ` +
            `Removing it will empty ${inUse > 1 ? "those frames" : "that frame"}. Continue?`,
        );
        if (!ok) return;
      }
      store.dispatch(removePhoto(photoId));
    },
  });

  const drops = new DropController(wallContainer, store, showErrors);
  const photosPanel = document.querySelector<HTMLElement>('[data-tab-panel="photos"]');
  if (photosPanel) drops.attachPhotosPanel(photosPanel);

  bindHistoryShortcuts(store);
  initTabs();

  // Expose for ad-hoc debugging during development.
  (window as unknown as { __store?: Store }).__store = store;
}

boot();
