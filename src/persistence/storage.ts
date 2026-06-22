import type { FrameColor, Project } from "../model/types";
import { deserializeProject, serializeProject } from "./serialize";

const PROJECT_KEY = "photowall.project";
const PALETTE_KEY = "photowall.customPalette";

export interface SaveOutcome {
  ok: boolean;
  /** human-readable reason when ok === false (e.g. quota exceeded) */
  error?: string;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/** Auto-saves the project to localStorage; reports quota failures gracefully. */
export function saveProjectToStorage(project: Project): SaveOutcome {
  try {
    localStorage.setItem(PROJECT_KEY, serializeProject(project));
    return { ok: true };
  } catch (err) {
    if (isQuotaError(err)) {
      return {
        ok: false,
        error:
          "Storage limit reached — your layout could not be auto-saved. " +
          "Use Save to download a JSON backup. (IndexedDB fallback is future work.)",
      };
    }
    return { ok: false, error: "Auto-save failed." };
  }
}

/** Loads the auto-saved project, or null if none / unreadable. */
export function loadProjectFromStorage(): Project | null {
  const json = localStorage.getItem(PROJECT_KEY);
  if (!json) return null;
  try {
    return deserializeProject(json);
  } catch {
    return null;
  }
}

/** Persists the cross-project custom color palette. */
export function savePalette(colors: FrameColor[]): void {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(colors));
  } catch {
    /* palette is non-critical; ignore quota failures */
  }
}

/** Loads the cross-project custom color palette. */
export function loadPalette(): FrameColor[] {
  const json = localStorage.getItem(PALETTE_KEY);
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((c): c is FrameColor => typeof c?.hex === "string")
      .map((c) => ({
        id: String(c.id ?? c.hex),
        label: String(c.label ?? c.hex),
        hex: String(c.hex),
      }));
  } catch {
    return [];
  }
}
