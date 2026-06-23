import type { DragState, Store } from "../state/store";
import type { AABB, Frame, Project } from "../model/types";
import {
  buildWallSvg,
  defaultViewBox,
  frameTransform,
  renderFrame,
  renderSnapGuides,
  setFrameGroupSelected,
} from "./wall";

/**
 * Mounts the wall SVG and keeps it in sync with the store **incrementally**:
 *
 * - The first render builds the full SVG (wall bg, grid, frame groups, guides
 *   container) via `buildWallSvg`.
 * - On project change, we **diff frames** against the previous project:
 *   removed frames' groups are detached, added frames get fresh groups, and
 *   only frames whose object reference changed are rebuilt. Unchanged frames
 *   (preserved JS references via immutable updates) keep their existing
 *   groups — and crucially their existing `<image>` nodes, so the browser
 *   doesn't drop the decoded photo bitmap. Wall settings (size/color) update
 *   the wall-bg + grid rect attributes in place.
 * - Selection changes flip a pre-rendered selection rect's `display`
 *   attribute on the affected frame groups — no SVG/`<image>` churn.
 * - Pan/zoom updates the `viewBox` attribute in place.
 * - Frame drags update the affected groups' `transform` in place.
 *
 * The store emits on every pointer move and click; this rebuild discipline
 * is what makes selecting/editing remain smooth at ~20 photos.
 */
export class WallView {
  private svg: SVGSVGElement | null = null;
  private wallBgRect: SVGRectElement | null = null;
  private gridRect: SVGRectElement | null = null;
  private guidesGroup: SVGGElement | null = null;
  private framesById = new Map<string, Frame>();
  private frameGroups = new Map<string, SVGGElement>();

  private lastProject: Project | null = null;
  private lastSelection = new Set<string>();
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

    if (this.svg === null) {
      this.initialBuild(project, viewBox, new Set(ui.selection.frameIds));
    } else if (project !== this.lastProject) {
      this.reconcileProject(this.lastProject!, project);
    }
    this.lastProject = project;

    // Selection delta (cheap; pre-rendered rect, just toggles display).
    this.applySelection(ui.selection.frameIds);

    // Pan/zoom: cheap attribute update, no DOM rebuild.
    this.svg!.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );

    // Drag: move affected groups in place; never recreates <image> elements.
    this.applyDrag(ui.drag, viewBox);
  }

  private initialBuild(project: Project, viewBox: AABB, selection: Set<string>): void {
    const svg = buildWallSvg(project, viewBox, selection, null);
    // Replace any prior SVG; leave sibling overlays (zoom controls) alone.
    this.container.appendChild(svg);
    this.svg = svg;
    this.wallBgRect = svg.querySelector<SVGRectElement>(".wall-bg");
    this.gridRect = svg.querySelector<SVGRectElement>(".wall-grid");
    this.guidesGroup = svg.querySelector<SVGGElement>(".snap-guides");

    this.framesById = new Map(project.frames.map((f) => [f.id, f]));
    this.frameGroups = new Map();
    for (const g of svg.querySelectorAll<SVGGElement>("[data-frame-id]")) {
      const id = g.getAttribute("data-frame-id");
      if (id) this.frameGroups.set(id, g);
    }
    this.lastSelection = new Set(selection);
    this.dragWasActive = false;
  }

  /**
   * Reconciles SVG DOM with a new project snapshot. Each unchanged frame
   * (same JS reference) keeps its existing group + image node; only frames
   * whose reference changed are rebuilt.
   */
  private reconcileProject(prev: Project, next: Project): void {
    // Wall settings.
    if (next.wall !== prev.wall) {
      if (this.wallBgRect) {
        this.wallBgRect.setAttribute("width", String(next.wall.width));
        this.wallBgRect.setAttribute("height", String(next.wall.height));
        this.wallBgRect.setAttribute("fill", next.wall.color);
      }
      if (this.gridRect) {
        this.gridRect.setAttribute("width", String(next.wall.width));
        this.gridRect.setAttribute("height", String(next.wall.height));
      }
    }

    // Frame diff. Identity-based: unchanged frames share their reference with
    // prev (commands like updateFrames map and keep unaffected entries).
    if (next.frames !== prev.frames) {
      this.reconcileFrames(prev, next);
    }
  }

  private reconcileFrames(prev: Project, next: Project): void {
    const photosById = new Map(next.photos.map((p) => [p.id, p]));
    const prevById = new Map(prev.frames.map((f) => [f.id, f]));
    const nextIds = new Set(next.frames.map((f) => f.id));

    // Remove frames that no longer exist.
    for (const [id, group] of this.frameGroups) {
      if (nextIds.has(id)) continue;
      group.remove();
      this.frameGroups.delete(id);
      this.framesById.delete(id);
      // Selection of a gone frame is pruned by the store before emit; drop
      // it locally too so applySelection doesn't try to retarget a stale id.
      this.lastSelection.delete(id);
    }

    // Update existing + add new (in target order, so the snap-guides group
    // stays the last sibling and z-order matches `next.frames`).
    for (const frame of next.frames) {
      const prevFrame = prevById.get(frame.id);
      const existing = this.frameGroups.get(frame.id);
      if (existing && prevFrame === frame) {
        // Same object reference = nothing in this frame changed. Skip.
        continue;
      }
      const photo = frame.photoId ? photosById.get(frame.photoId) ?? null : null;
      const selected = this.lastSelection.has(frame.id);
      const fresh = renderFrame(frame, photo, selected);
      if (existing) existing.replaceWith(fresh);
      else this.svg!.insertBefore(fresh, this.guidesGroup);
      this.frameGroups.set(frame.id, fresh);
      this.framesById.set(frame.id, frame);
    }

    // Ensure DOM order matches `next.frames` (in case order changed). Walk
    // back-to-front so each anchor is the already-positioned next sibling.
    let anchor: Node | null = this.guidesGroup;
    for (let i = next.frames.length - 1; i >= 0; i--) {
      const g = this.frameGroups.get(next.frames[i]!.id)!;
      if (g.nextSibling !== anchor) this.svg!.insertBefore(g, anchor);
      anchor = g;
    }
  }

  /**
   * Flips the selection rect's visibility on affected frame groups. Only the
   * delta between previous and next selection is touched — no SVG rebuild,
   * no `<image>` re-decode.
   */
  private applySelection(ids: readonly string[]): void {
    const next = new Set(ids);
    for (const id of this.lastSelection) {
      if (next.has(id)) continue;
      const g = this.frameGroups.get(id);
      if (g) setFrameGroupSelected(g, false);
    }
    for (const id of next) {
      if (this.lastSelection.has(id)) continue;
      const g = this.frameGroups.get(id);
      if (g) setFrameGroupSelected(g, true);
    }
    this.lastSelection = next;
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
