import { defaultProject } from "../model/defaults";
import type { Project } from "../model/types";
import { deserializeProject, serializeProject } from "../persistence/serialize";
import type { Store } from "../state/store";

export interface ToolbarHandlers {
  onGenerateBom?: () => void;
  onError?: (message: string) => void;
}

/** Merges a project's embedded custom colors into the cross-project palette. */
export function mergeProjectColorsIntoPalette(store: Store, project: Project): void {
  for (const color of project.customColors) {
    store.addCustomPaletteColor(color);
  }
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Wires the top-toolbar actions (New / Save / Load / Generate BOM). */
export function initToolbar(store: Store, handlers: ToolbarHandlers = {}): void {
  const onError = handlers.onError ?? ((m) => alert(m));
  const action = (name: string): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);

  action("new")?.addEventListener("click", () => {
    const ok = confirm(
      "Start a new project? The current layout will be cleared (Save first to keep it).",
    );
    if (ok) store.replaceProject(defaultProject());
  });

  action("save")?.addEventListener("click", () => {
    downloadJson("photowall.json", serializeProject(store.getProject()));
  });

  const loadInput = document.createElement("input");
  loadInput.type = "file";
  loadInput.accept = "application/json,.json";
  loadInput.style.display = "none";
  document.body.appendChild(loadInput);
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files?.[0];
    loadInput.value = "";
    if (!file) return;
    try {
      const project = deserializeProject(await file.text());
      store.replaceProject(project);
      mergeProjectColorsIntoPalette(store, project);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load project file.");
    }
  });
  action("load")?.addEventListener("click", () => loadInput.click());

  action("bom")?.addEventListener("click", () => handlers.onGenerateBom?.());
}
