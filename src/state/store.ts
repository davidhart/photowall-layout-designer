import { defaultProject } from "../model/defaults";
import { DEFAULT_FRAME_COLOR_HEX } from "../model/colors";
import type { AABB, Project, Selection } from "../model/types";
import type { Command } from "./commands";

/**
 * Transient UI state. This is intentionally **not** part of the undo history —
 * you don't undo a pan, a zoom, or a selection change.
 */
/** Transient live-drag offset (in cm) applied to frames while dragging. */
export interface DragState {
  ids: string[];
  dx: number;
  dy: number;
  /** snap guide lines to render while dragging (cm positions) */
  guides?: { vertical: number[]; horizontal: number[] };
}

export interface UIState {
  selection: Selection;
  /** current view rectangle in cm (the SVG viewBox); null until first fit */
  viewBox: AABB | null;
  /** color a newly added frame inherits (last selected frame's color) */
  lastFrameColor: string;
  /** live drag preview offset, or null when not dragging */
  drag: DragState | null;
}

function initialUIState(): UIState {
  return {
    selection: { frameIds: [] },
    viewBox: null,
    lastFrameColor: DEFAULT_FRAME_COLOR_HEX,
    drag: null,
  };
}

const HISTORY_LIMIT = 200;

/**
 * Central store: holds the `Project` plus transient UI state, runs every
 * mutating edit through an immutable command, and keeps a snapshot-based
 * undo/redo history. Subscribers are notified on any change.
 */
export class Store {
  private project: Project;
  private ui: UIState;
  private past: Project[] = [];
  private future: Project[] = [];
  private listeners = new Set<() => void>();

  constructor(project: Project = defaultProject()) {
    this.project = project;
    this.ui = initialUIState();
  }

  getProject(): Project {
    return this.project;
  }

  getUI(): UIState {
    return this.ui;
  }

  // ---- Project mutations (history-tracked) ----

  /**
   * Applies a command, recording the prior project for undo. If the command
   * returns the same project reference (a no-op), nothing is recorded or
   * emitted.
   */
  dispatch(command: Command): void {
    const next = command(this.project);
    if (next === this.project) return;
    this.past.push(this.project);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.project = next;
    this.pruneSelection();
    this.emit();
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const prev = this.past.pop();
    if (prev === undefined) return;
    this.future.push(this.project);
    this.project = prev;
    this.pruneSelection();
    this.emit();
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.project);
    this.project = next;
    this.pruneSelection();
    this.emit();
  }

  /**
   * Replaces the entire project (New / Load). Clears history and resets
   * transient UI selection; the viewBox is reset so the next render refits.
   */
  replaceProject(project: Project): void {
    this.project = project;
    this.past = [];
    this.future = [];
    this.ui = initialUIState();
    this.emit();
  }

  // ---- Transient UI state (not history-tracked) ----

  setSelection(frameIds: readonly string[]): void {
    this.ui = { ...this.ui, selection: { frameIds: [...frameIds] } };
    this.updateLastFrameColorFromSelection();
    this.emit();
  }

  clearSelection(): void {
    this.setSelection([]);
  }

  setViewBox(viewBox: AABB): void {
    this.ui = { ...this.ui, viewBox };
    this.emit();
  }

  /** Sets (or clears) the live drag preview offset. */
  setDrag(drag: DragState | null): void {
    this.ui = { ...this.ui, drag };
    this.emit();
  }

  setLastFrameColor(hex: string): void {
    this.ui = { ...this.ui, lastFrameColor: hex };
    this.emit();
  }

  // ---- Subscription ----

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** Drops selected ids that no longer correspond to an existing frame. */
  private pruneSelection(): void {
    const existing = new Set(this.project.frames.map((f) => f.id));
    const pruned = this.ui.selection.frameIds.filter((id) => existing.has(id));
    if (pruned.length !== this.ui.selection.frameIds.length) {
      this.ui = { ...this.ui, selection: { frameIds: pruned } };
    }
  }

  /** Tracks the last-selected frame's color for new-frame inheritance. */
  private updateLastFrameColorFromSelection(): void {
    const ids = this.ui.selection.frameIds;
    if (ids.length === 0) return;
    const lastId = ids[ids.length - 1];
    const frame = this.project.frames.find((f) => f.id === lastId);
    if (frame) {
      this.ui = { ...this.ui, lastFrameColor: frame.color };
    }
  }
}
