import type { Store } from "../state/store";
import { saveProjectToStorage, savePalette } from "./storage";

const DEBOUNCE_MS = 400;

/**
 * Auto-saves the project to localStorage (debounced) whenever it changes, and
 * persists the custom palette immediately when it changes. `onWarn` is called
 * at most once if saving fails (e.g. quota exceeded). Returns an unsubscribe.
 */
export function attachAutosave(
  store: Store,
  onWarn: (message: string) => void = () => {},
): () => void {
  let lastProject = store.getProject();
  let lastPalette = store.getUI().customPalette;
  let warned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = (): void => {
    const outcome = saveProjectToStorage(store.getProject());
    if (!outcome.ok && !warned) {
      warned = true;
      onWarn(outcome.error ?? "Auto-save failed.");
    }
  };

  return store.subscribe(() => {
    const project = store.getProject();
    if (project !== lastProject) {
      lastProject = project;
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, DEBOUNCE_MS);
    }
    const palette = store.getUI().customPalette;
    if (palette !== lastPalette) {
      lastPalette = palette;
      savePalette(palette);
    }
  });
}
