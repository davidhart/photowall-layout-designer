import { outerAABB } from "../model/geometry";
import { deleteFrames, moveFrames } from "../state/commands";
import type { Store } from "../state/store";
import {
  framesInRect,
  rectFromPoints,
  toggleSelection,
  unionSelection,
} from "./selection";
import { computeSnap, unionAABB } from "./snapping";
import { pxToCm, scaleOf } from "./viewport";

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 3;

type Mode = "idle" | "pendingFrame" | "movingFrame" | "marquee";

/**
 * Handles selection, multi-select, group move, rubber-band marquee, and delete
 * on the wall. Operates on left-button gestures only; pan (space/middle-mouse)
 * is handled separately by ViewportControls.
 */
export class InteractionController {
  private mode: Mode = "idle";
  private startClient = { x: 0, y: 0 };
  private additive = false;
  private spaceHeld = false;

  // frame-press state
  private pressedFrameId: string | null = null;
  private dragIds: string[] = [];

  // marquee state
  private marqueeEl: HTMLDivElement | null = null;
  private baseSelection: string[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly store: Store,
  ) {
    this.container.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private rect(): DOMRect {
    return this.container.getBoundingClientRect();
  }

  private clientToCm(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.rect();
    const vb = this.store.getUI().viewBox;
    if (!vb) return { x: 0, y: 0 };
    return pxToCm(vb, r.width, r.height, clientX - r.left, clientY - r.top);
  }

  private isAdditive(event: PointerEvent | MouseEvent): boolean {
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  private onPointerDown = (event: PointerEvent): void => {
    // Left button only; space-drag is a pan owned by ViewportControls.
    if (event.button !== 0 || this.spaceHeld) return;
    const target = event.target as Element | null;
    const frameEl = target?.closest<SVGGElement>("[data-frame-id]");
    this.startClient = { x: event.clientX, y: event.clientY };
    this.additive = this.isAdditive(event);

    if (frameEl) {
      const id = frameEl.getAttribute("data-frame-id")!;
      this.pressedFrameId = id;
      const current = this.store.getUI().selection.frameIds;

      if (this.additive) {
        const next = toggleSelection(current, id);
        this.store.setSelection(next);
        this.dragIds = next;
      } else if (current.includes(id)) {
        // keep the existing (possibly multi) selection so a group move works
        this.dragIds = current;
      } else {
        this.store.setSelection([id]);
        this.dragIds = [id];
      }
      this.mode = "pendingFrame";
    } else {
      // Empty canvas: begin a marquee (or a click that clears selection).
      this.mode = "marquee";
      this.baseSelection = this.additive
        ? [...this.store.getUI().selection.frameIds]
        : [];
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.mode === "idle") return;
    const dxPx = event.clientX - this.startClient.x;
    const dyPx = event.clientY - this.startClient.y;
    const moved = Math.hypot(dxPx, dyPx) >= DRAG_THRESHOLD;

    if (this.mode === "pendingFrame" && moved) {
      this.mode = "movingFrame";
    }

    if (this.mode === "movingFrame") {
      const vb = this.store.getUI().viewBox;
      const r = this.rect();
      if (!vb || r.width <= 0) return;
      const scale = scaleOf(vb, r.width);
      const rawDx = dxPx / scale;
      const rawDy = dyPx / scale;

      // Snap the moving group's outer bounding box against the other frames.
      const project = this.store.getProject();
      const moving = new Set(this.dragIds);
      const movingBoxes = project.frames
        .filter((f) => moving.has(f.id))
        .map((f) => {
          const b = outerAABB(f);
          return { ...b, x: b.x + rawDx, y: b.y + rawDy };
        });
      const otherBoxes = project.frames
        .filter((f) => !moving.has(f.id))
        .map(outerAABB);
      const groupBox = unionAABB(movingBoxes);
      const snap = groupBox
        ? computeSnap(groupBox, otherBoxes)
        : { dx: 0, dy: 0, guides: { vertical: [], horizontal: [] } };

      this.store.setDrag({
        ids: this.dragIds,
        dx: rawDx + snap.dx,
        dy: rawDy + snap.dy,
        guides: snap.guides,
      });
    } else if (this.mode === "marquee") {
      this.updateMarquee(event.clientX, event.clientY);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const mode = this.mode;
    this.mode = "idle";

    if (mode === "movingFrame") {
      const drag = this.store.getUI().drag;
      this.store.setDrag(null);
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        this.store.dispatch(moveFrames(drag.ids, drag.dx, drag.dy));
      }
    } else if (mode === "pendingFrame") {
      // A click without a drag: collapse a multi-selection to the clicked frame
      // (unless it was an additive toggle, already applied on pointerdown).
      if (!this.additive && this.pressedFrameId) {
        this.store.setSelection([this.pressedFrameId]);
      }
    } else if (mode === "marquee") {
      this.finishMarquee(event);
    }

    this.pressedFrameId = null;
    this.dragIds = [];
  };

  private updateMarquee(clientX: number, clientY: number): void {
    const r = this.rect();
    const x = Math.min(clientX, this.startClient.x) - r.left;
    const y = Math.min(clientY, this.startClient.y) - r.top;
    const w = Math.abs(clientX - this.startClient.x);
    const h = Math.abs(clientY - this.startClient.y);
    if (!this.marqueeEl) {
      this.marqueeEl = document.createElement("div");
      this.marqueeEl.className = "marquee";
      this.container.appendChild(this.marqueeEl);
    }
    Object.assign(this.marqueeEl.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
  }

  private finishMarquee(event: PointerEvent): void {
    const movedPx = Math.hypot(
      event.clientX - this.startClient.x,
      event.clientY - this.startClient.y,
    );
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }

    if (movedPx < DRAG_THRESHOLD) {
      // A plain click on empty space clears the selection.
      if (!this.additive) this.store.clearSelection();
      return;
    }

    const start = this.clientToCm(this.startClient.x, this.startClient.y);
    const end = this.clientToCm(event.clientX, event.clientY);
    const rect = rectFromPoints(start.x, start.y, end.x, end.y);
    const hits = framesInRect(this.store.getProject().frames, rect);
    const next = this.additive
      ? unionSelection(this.baseSelection, hits)
      : hits;
    this.store.setSelection(next);
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") this.spaceHeld = false;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceHeld = true;
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    const ids = this.store.getUI().selection.frameIds;
    if (ids.length === 0) return;
    event.preventDefault();
    this.store.dispatch(deleteFrames(ids));
  };
}
