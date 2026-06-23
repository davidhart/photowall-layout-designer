import { defaultProject } from "../model/defaults";
import type { Project } from "../model/types";
import { deserializeProject, serializeProject } from "../persistence/serialize";
import type { Store } from "../state/store";

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

/** Confirms with the user, then replaces the current project with a fresh one. */
export function newProject(store: Store): void {
  const ok = confirm(
    "Start a new project? The current layout will be cleared (Save first to keep it).",
  );
  if (ok) store.replaceProject(defaultProject());
}

/** Saves the current project as a downloaded JSON file. */
export function saveProject(store: Store): void {
  downloadJson("photowall.json", serializeProject(store.getProject()));
}

/**
 * Opens a hidden file picker to load a project JSON; on success, replaces the
 * current project and merges its custom colors into the cross-project palette.
 */
export function openProject(
  store: Store,
  onError: (message: string) => void = (m) => alert(m),
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    input.remove();
    if (!file) return;
    try {
      const project = deserializeProject(await file.text());
      store.replaceProject(project);
      mergeProjectColorsIntoPalette(store, project);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load project file.");
    }
  });
  input.click();
}
