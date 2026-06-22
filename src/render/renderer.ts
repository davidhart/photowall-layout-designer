import type { DragState, Store } from "../state/store";
import type { AABB, Frame, Project } from "../model/types";
import {
  buildWallSvg,
  defaultViewBox,
  frameTransform,
  renderSnapGuides,
} from "./wall";

/**
 * Mounts the wall SVG and keeps it in sync with the store **incrementally**:
 *
 * - The full SVG (including the `<image>` elements, which carry large image
 *   data URLs) is rebuilt only when the project or selection changes.
 * - Pan/zoom (viewBox changes) only mutate the `viewBox` attribute in place.
 * - Frame drags only update the affected groups' `transform` in place.
 *
 * This matters because the store emits on every pan/zoom/drag pointer move;
 * rebuilding the whole SVG (and re-decoding every photo) each time made the
 * canvas crawl once photos were placed.
 */
export class WallView {
  private svg: SVGSVGElement | null = null;
  private framesById = new Map<string, Frame>();
  private frameGroups = new Map<string, SVGGElement>();
  private guidesGroup: SVGGElement | null = null;

  private lastProject: Project | null = null;
  private lastSelectionKey = "";
  private dragWasActive = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly store: Store,
  ) {
    this.store.subscribe(() => this.render());
  }

  /** The current live SVG element, if rendered. */
  get element(): SVGSVGElement | null {
    return this.svg;
  }

  render(): void {
    const project = this.store.getProject();
    const ui = this.store.getUI();
    const viewBox = ui.viewBox ?? defaultViewBox(project);
    const selectionKey = ui.selection.frameIds.join("|");

    const structural =
      this.svg === null ||
      project !== this.lastProject ||
      selectionKey !== this.lastSelectionKey;

    if (structural) {
      this.rebuild(project, viewBox, new Set(ui.selection.frameIds));
      this.lastProject = project;
      this.lastSelectionKey = selectionKey;
    }

    // Pan/zoom: cheap attribute update, no DOM rebuild.
    this.svg!.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );

    // Drag: move affected groups in place; never recreates <image> elements.
    this.applyDrag(ui.drag, viewBox);
  }

  private rebuild(project: Project, viewBox: AABB, selection: Set<string>): void {
    const svg = buildWallSvg(project, viewBox, selection, null);
    // Replace only our own <svg>, leaving sibling overlays (zoom controls)
    // untouched.
    if (this.svg) this.svg.replaceWith(svg);
    else this.container.appendChild(svg);
    this.svg = svg;

    this.framesById = new Map(project.frames.map((f) => [f.id, f]));
    this.frameGroups = new Map();
    for (const g of svg.querySelectorAll<SVGGElement>("[data-frame-id]")) {
      const id = g.getAttribute("data-frame-id");
      if (id) this.frameGroups.set(id, g);
    }
    this.guidesGroup = svg.querySelector<SVGGElement>(".snap-guides");
    // A fresh build already reflects no drag.
    this.dragWasActive = false;
  }

  private applyDrag(drag: DragState | null, viewBox: AABB): void {
    const active = drag !== null;
    // Skip entirely when there's no drag now and there wasn't one to clear.
    if (!active && !this.dragWasActive) return;

    const dragIds = active ? new Set(drag!.ids) : null;
    for (const [id, group] of this.frameGroups) {
      const frame = this.framesById.get(id);
      if (!frame) continue;
      const offset = dragIds?.has(id)
        ? { ...frame, x: frame.x + drag!.dx, y: frame.y + drag!.dy }
        : frame;
      group.setAttribute("transform", frameTransform(offset));
    }

    if (this.guidesGroup) {
      renderSnapGuides(this.guidesGroup, drag?.guides ?? null, viewBox);
    }
    this.dragWasActive = active;
  }
}
