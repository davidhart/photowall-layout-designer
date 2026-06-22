import type { Store } from "./store";

/** True when the event target is a text-editing field we shouldn't hijack. */
function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Binds undo/redo keyboard shortcuts:
 * - Undo: Ctrl/Cmd+Z
 * - Redo: Ctrl/Cmd+Shift+Z or Ctrl+Y
 *
 * Returns a disposer that removes the listener.
 */
export function bindHistoryShortcuts(
  store: Store,
  target: Window | HTMLElement = window,
): () => void {
  const handler = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (isEditingTarget(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    const key = e.key.toLowerCase();
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    } else if (key === "y") {
      e.preventDefault();
      store.redo();
    }
  };

  target.addEventListener("keydown", handler);
  return () => target.removeEventListener("keydown", handler);
}
