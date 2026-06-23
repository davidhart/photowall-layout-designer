import type { Store } from "../state/store";
import {
  fitViewBox,
  panBy,
  scaleOf,
  zoomAt,
} from "./viewport";

const WHEEL_ZOOM_BASE = 1.0015;
const BUTTON_ZOOM_STEP = 1.25;

/**
 * Wires zoom + pan to the wall container by mutating the store's viewBox (all
 * geometry stays in cm; only the viewBox→viewport mapping changes).
 *
 * - Zoom: wheel (toward cursor) + on-screen +/−/fit buttons.
 * - Pan: drag on empty canvas, space-drag, or middle-mouse drag.
 */
export class ViewportControls {
  private spaceHeld = false;
  private panning = false;
  private lastPointer = { x: 0, y: 0 };
  private lastSize = { w: 0, h: 0 };

  constructor(
    private readonly container: HTMLElement,
    private readonly store: Store,
  ) {
    this.attach();
    // Refit whenever the store emits with a null viewBox — this is how
    // `store.replaceProject` (New / Open / Load Example) signals "you've got
    // a fresh project, please refit me." Without this, the viewBox stays
    // null after a project swap and every gesture that needs px↔cm (drag a
    // frame, drop a photo, drop an empty frame) silently bails out.
    this.store.subscribe(() => this.maybeRefit());
    // Defer initial fit until layout has a size.
    requestAnimationFrame(() => this.fit());
  }

  private maybeRefit(): void {
    if (this.store.getUI().viewBox !== null) return;
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) return;
    this.fit();
  }

  private size(): { w: number; h: number; rect: DOMRect } {
    const rect = this.container.getBoundingClientRect();
    return { w: rect.width, h: rect.height, rect };
  }

  private fitScale(): number {
    const { w, h } = this.size();
    const wall = this.store.getProject().wall;
    return scaleOf(fitViewBox(wall, w, h), w);
  }

  /** Fits the whole wall to the viewport. */
  fit(): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) return;
    const wall = this.store.getProject().wall;
    this.store.setViewBox(fitViewBox(wall, w, h));
    this.lastSize = { w, h };
  }

  private zoomByFactor(factor: number, cursorX: number, cursorY: number): void {
    const vb = this.store.getUI().viewBox;
    const { w, h } = this.size();
    if (!vb || w <= 0 || h <= 0) return;
    this.store.setViewBox(zoomAt(vb, w, h, cursorX, cursorY, factor, this.fitScale()));
  }

  private attach(): void {
    this.container.addEventListener("wheel", this.onWheel, { passive: false });
    this.container.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(this.container);

    this.buildZoomButtons();
  }

  private onResize(): void {
    const vb = this.store.getUI().viewBox;
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) return;
    if (!vb || this.lastSize.w <= 0) {
      this.fit();
      return;
    }
    // Preserve scale (px/cm) and center across the resize.
    const scale = this.lastSize.w / vb.width;
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    const width = w / scale;
    const height = h / scale;
    this.store.setViewBox({ x: cx - width / 2, y: cy - height / 2, width, height });
    this.lastSize = { w, h };
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { rect } = this.size();
    const factor = Math.pow(WHEEL_ZOOM_BASE, -event.deltaY);
    this.zoomByFactor(factor, event.clientX - rect.left, event.clientY - rect.top);
  };

  /**
   * A pan starts on middle-mouse or space-drag. Plain left-drag is reserved for
   * selection / move / rubber-band (handled by the interaction controller).
   */
  private isPanStart(event: PointerEvent): boolean {
    if (event.button === 1) return true; // middle mouse
    if (event.button === 0 && this.spaceHeld) return true;
    return false;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.isPanStart(event)) return;
    this.panning = true;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.container.style.cursor = "grabbing";
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.panning) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    const vb = this.store.getUI().viewBox;
    const { w } = this.size();
    if (!vb || w <= 0) return;
    this.store.setViewBox(panBy(vb, w, dx, dy));
  };

  private onPointerUp = (): void => {
    if (!this.panning) return;
    this.panning = false;
    this.container.style.cursor = "";
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") this.spaceHeld = true;
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") this.spaceHeld = false;
  };

  private buildZoomButtons(): void {
    const controls = document.createElement("div");
    controls.className = "zoom-controls";
    const make = (
      label: string,
      title: string,
      onClick: () => void,
    ): HTMLButtonElement => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener("click", onClick);
      controls.appendChild(btn);
      return btn;
    };
    const center = (): { x: number; y: number } => {
      const { w, h } = this.size();
      return { x: w / 2, y: h / 2 };
    };
    make("−", "Zoom out", () => {
      const c = center();
      this.zoomByFactor(1 / BUTTON_ZOOM_STEP, c.x, c.y);
    });
    // U+26F6 SQUARE FOUR CORNERS — the conventional fit-to-screen glyph.
    make("⛶", "Fit to view", () => this.fit());
    make("+", "Zoom in", () => {
      const c = center();
      this.zoomByFactor(BUTTON_ZOOM_STEP, c.x, c.y);
    });
    this.container.appendChild(controls);
  }
}
