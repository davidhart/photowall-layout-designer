import { standardSizes } from "../model/standards";
import type { Frame, StandardSize } from "../model/types";
import { updateWall } from "../state/commands";
import type { Store } from "../state/store";
import { DND_FRAME_SIZE, encodeCustomFrameSizeId } from "./dnd";
import { h } from "./dom";
import {
  type Example,
  loadBundledExamples,
  renderExampleThumbnail,
} from "./examples";

export interface ProjectActions {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onGenerateBom: () => void;
  /** Load the given example layout into the current project. */
  onLoadExample: (example: Example) => void;
}

/**
 * Renders the left panel's two tabs (Project / Frames) from store state.
 * Rebuilds only when the project reference changes, so view-only updates
 * (pan/zoom/selection) don't disturb inputs mid-edit.
 */
export class LeftPanel {
  private projectEl: HTMLElement;
  private framesEl: HTMLElement;
  private lastProject: unknown = null;
  /** Static — bundled at build time, doesn't change across renders. */
  private readonly examples: Example[];

  constructor(
    private readonly store: Store,
    private readonly actions: ProjectActions,
  ) {
    this.projectEl = this.panel("project");
    this.framesEl = this.panel("frames");
    this.examples = loadBundledExamples();
    this.store.subscribe(() => this.render());
    this.render();
  }

  private panel(name: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-tab-panel="${name}"]`);
    if (!el) throw new Error(`tab panel "${name}" not found`);
    return el;
  }

  render(): void {
    const project = this.store.getProject();
    if (project === this.lastProject) return;
    this.lastProject = project;
    this.renderProject();
    this.renderFrames();
  }

  // ---- Project tab ----

  private renderProject(): void {
    const wall = this.store.getProject().wall;

    const actionButton = (label: string, onClick: () => void) =>
      h("button", { type: "button", text: label, onclick: onClick });

    const dimInput = (label: string, value: number, key: "width" | "height") =>
      h("label", { class: "field" }, [
        h("span", { text: label }),
        h("input", {
          type: "number",
          min: "1",
          step: "1",
          value: String(value),
          onchange: (e: Event) => {
            const n = Number((e.target as HTMLInputElement).value);
            if (n > 0) this.store.dispatch(updateWall({ [key]: n }));
          },
        }),
      ]);

    const colorField = h("label", { class: "field" }, [
      h("span", { text: "Color" }),
      h("input", {
        type: "color",
        value: wall.color,
        onchange: (e: Event) =>
          this.store.dispatch(
            updateWall({ color: (e.target as HTMLInputElement).value }),
          ),
      }),
    ]);

    const children: Node[] = [
      h("div", { class: "project-actions" }, [
        h("div", { class: "project-actions__row" }, [
          actionButton("New", this.actions.onNew),
          actionButton("Open", this.actions.onOpen),
          actionButton("Save", this.actions.onSave),
        ]),
        actionButton("Generate BOM", this.actions.onGenerateBom),
      ]),
      h("h3", { text: "Wall" }),
      h("div", { class: "field-row" }, [
        colorField,
        dimInput("Width (cm)", wall.width, "width"),
        dimInput("Height (cm)", wall.height, "height"),
      ]),
    ];
    if (this.examples.length > 0) {
      children.push(h("h3", { text: "Examples" }), this.renderExamplesGrid());
    }
    this.projectEl.replaceChildren(...children);
  }

  private renderExamplesGrid(): HTMLElement {
    const items = this.examples.map((example) =>
      h(
        "button",
        {
          type: "button",
          class: "example-thumb",
          // Title is the only place the example's name surfaces (hover).
          title: example.name,
          onclick: () => this.actions.onLoadExample(example),
        },
        [renderExampleThumbnail(example)],
      ),
    );
    return h("div", { class: "examples-grid" }, items);
  }

  // ---- Frames tab ----

  private renderFrames(): void {
    const items = standardSizes().map((size) => this.framePaletteItem(size));
    items.push(this.customFramePaletteItem());
    for (const aperture of distinctCustomFrameApertures(
      this.store.getProject().frames,
    )) {
      items.push(this.customApertureItem(aperture));
    }
    this.framesEl.replaceChildren(
      h("p", { class: "hint", text: "Drag a frame onto the wall." }),
      h("div", { class: "frame-palette" }, items),
    );
  }

  private framePaletteItem(size: StandardSize): HTMLElement {
    const aspect = size.width / size.height;
    return h(
      "div",
      {
        class: "palette-item",
        draggable: "true",
        title: `${size.name} (${size.width}×${size.height} cm)`,
        ondragstart: (e: DragEvent) =>
          e.dataTransfer?.setData(DND_FRAME_SIZE, size.id),
      },
      [
        h("div", {
          class: "palette-thumb",
          style: `aspect-ratio:${aspect}`,
        }),
        h("span", { text: size.name }),
      ],
    );
  }

  private customFramePaletteItem(): HTMLElement {
    return h(
      "div",
      {
        class: "palette-item",
        draggable: "true",
        title: "Custom-size frame",
        ondragstart: (e: DragEvent) =>
          e.dataTransfer?.setData(DND_FRAME_SIZE, "custom"),
      },
      [
        h("div", { class: "palette-thumb palette-thumb--custom" }),
        h("span", { text: "Custom" }),
      ],
    );
  }

  private customApertureItem(aperture: { width: number; height: number }): HTMLElement {
    const aspect = aperture.width / aperture.height;
    const label = `${formatCm(aperture.width)}×${formatCm(aperture.height)}`;
    return h(
      "div",
      {
        class: "palette-item",
        draggable: "true",
        title: `Custom ${label} cm`,
        ondragstart: (e: DragEvent) =>
          e.dataTransfer?.setData(
            DND_FRAME_SIZE,
            encodeCustomFrameSizeId(aperture.width, aperture.height),
          ),
      },
      [
        h("div", {
          class: "palette-thumb palette-thumb--custom",
          style: `aspect-ratio:${aspect}`,
        }),
        h("span", { text: label }),
      ],
    );
  }
}

/** Trim trailing zeros for a compact cm label (e.g. 21, 29.7). */
function formatCm(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/**
 * Distinct apertures of custom-sized frames currently on the wall, deduped by
 * (width, height) so identical custom sizes coalesce to a single template.
 */
function distinctCustomFrameApertures(
  frames: readonly Frame[],
): { width: number; height: number }[] {
  const seen = new Set<string>();
  const result: { width: number; height: number }[] = [];
  for (const f of frames) {
    if (f.standardSizeId !== null) continue;
    const key = `${f.aperture.width}x${f.aperture.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ width: f.aperture.width, height: f.aperture.height });
  }
  return result;
}
