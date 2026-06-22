import type { Store } from "../state/store";
import { buildWallSvg, defaultViewBox } from "./wall";

/**
 * Mounts the wall SVG into a container and re-renders on every store change.
 * Holds the live <svg> element so later phases (zoom/pan, interaction) can read
 * its CTM for screen↔cm mapping.
 */
export class WallView {
  private svg: SVGSVGElement | null = null;

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
    const selection = new Set(ui.selection.frameIds);
    const svg = buildWallSvg(project, viewBox, selection);
    // Replace only our own <svg>, leaving sibling overlays (e.g. zoom
    // controls) untouched.
    if (this.svg) this.svg.replaceWith(svg);
    else this.container.appendChild(svg);
    this.svg = svg;
  }
}
