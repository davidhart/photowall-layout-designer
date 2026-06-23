import { reconcilePasspartoutOptions, sizeToPasspartout } from "../model/settings";
import type { Frame, PasspartoutSize, StandardSize } from "../model/types";
import { updateWall } from "../state/commands";
import type { Store } from "../state/store";
import { DND_FRAME_SIZE, encodeCustomFrameSizeId } from "./dnd";
import { h } from "./dom";

/**
 * Renders the left panel's two tabs (Project / Frames) from store state.
 * Rebuilds only when the project reference changes, so view-only updates
 * (pan/zoom/selection) don't disturb inputs mid-edit.
 */
export class LeftPanel {
  private projectEl: HTMLElement;
  private framesEl: HTMLElement;
  private lastProject: unknown = null;

  constructor(private readonly store: Store) {
    this.projectEl = this.panel("project");
    this.framesEl = this.panel("frames");
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

    const wallColor = h("label", { class: "field" }, [
      h("span", { text: "Wall color" }),
      h("input", {
        type: "color",
        value: wall.color,
        onchange: (e: Event) =>
          this.store.dispatch(
            updateWall({ color: (e.target as HTMLInputElement).value }),
          ),
      }),
    ]);

    this.projectEl.replaceChildren(
      h("h3", { text: "Wall" }),
      h("div", { class: "field-row" }, [
        dimInput("Width (cm)", wall.width, "width"),
        dimInput("Height (cm)", wall.height, "height"),
      ]),
      wallColor,
      h("h3", { text: "Standard frame sizes" }),
      this.renderSizesEditor(wall.standardSizes),
      h("h3", { text: "Passpartout options" }),
      this.renderPasspartoutEditor(wall.standardSizes, wall.passpartoutOptions),
    );
  }

  private commitSizes(sizes: StandardSize[]): void {
    const wall = this.store.getProject().wall;
    this.store.dispatch(
      updateWall({
        standardSizes: sizes,
        passpartoutOptions: reconcilePasspartoutOptions(
          sizes,
          wall.passpartoutOptions,
        ),
      }),
    );
  }

  private renderSizesEditor(sizes: readonly StandardSize[]): HTMLElement {
    const rows = sizes.map((size, index) =>
      h("div", { class: "size-row" }, [
        h("input", {
          class: "size-name",
          value: size.name,
          onchange: (e: Event) => {
            const next = sizes.map((s, i) =>
              i === index
                ? { ...s, name: (e.target as HTMLInputElement).value }
                : s,
            );
            this.commitSizes(next);
          },
        }),
        this.sizeNumber(sizes, index, "width"),
        h("span", { text: "×" }),
        this.sizeNumber(sizes, index, "height"),
        h("button", {
          type: "button",
          class: "icon-btn",
          title: "Remove",
          text: "✕",
          onclick: () => this.commitSizes(sizes.filter((_, i) => i !== index)),
        }),
      ]),
    );

    const addBtn = h("button", {
      type: "button",
      text: "+ Add size",
      onclick: () => {
        const id = `size_${Date.now().toString(36)}`;
        const next: StandardSize[] = [
          ...sizes,
          { id, name: "Custom", width: 20, height: 30 },
        ];
        this.commitSizes(next);
      },
    });

    return h("div", { class: "sizes-editor" }, [...rows, addBtn]);
  }

  private sizeNumber(
    sizes: readonly StandardSize[],
    index: number,
    key: "width" | "height",
  ): HTMLElement {
    return h("input", {
      class: "size-num",
      type: "number",
      min: "0.1",
      step: "0.1",
      value: String(sizes[index]![key]),
      onchange: (e: Event) => {
        const n = Number((e.target as HTMLInputElement).value);
        if (!(n > 0)) return;
        const next = sizes.map((s, i) => (i === index ? { ...s, [key]: n } : s));
        this.commitSizes(next);
      },
    });
  }

  private renderPasspartoutEditor(
    sizes: readonly StandardSize[],
    options: Record<string, PasspartoutSize[]>,
  ): HTMLElement {
    const sections = sizes.map((size) => {
      const current = options[size.id] ?? [];
      const currentIds = new Set(current.map((o) => o.id));
      // Candidates to add: any other standard size not already an option.
      const candidates = sizes.filter(
        (s) => s.id !== size.id && !currentIds.has(s.id),
      );

      const chips = current.map((opt) =>
        h("span", { class: "chip" }, [
          opt.name,
          h("button", {
            type: "button",
            class: "chip-x",
            text: "✕",
            onclick: () =>
              this.commitPasspartout(
                size.id,
                current.filter((o) => o.id !== opt.id),
              ),
          }),
        ]),
      );

      const addSelect = h(
        "select",
        {
          onchange: (e: Event) => {
            const sel = (e.target as HTMLSelectElement).value;
            const found = sizes.find((s) => s.id === sel);
            if (found) {
              this.commitPasspartout(size.id, [
                ...current,
                sizeToPasspartout(found),
              ]);
            }
          },
        },
        [
          h("option", { value: "", text: "+ add…" }),
          ...candidates.map((c) =>
            h("option", { value: c.id, text: c.name }),
          ),
        ],
      );

      return h("div", { class: "pp-section" }, [
        h("div", { class: "pp-title", text: size.name }),
        h("div", { class: "pp-chips" }, [
          ...chips,
          ...(candidates.length ? [addSelect] : []),
        ]),
      ]);
    });

    return h("div", { class: "pp-editor" }, sections);
  }

  private commitPasspartout(sizeId: string, list: PasspartoutSize[]): void {
    const wall = this.store.getProject().wall;
    this.store.dispatch(
      updateWall({
        passpartoutOptions: { ...wall.passpartoutOptions, [sizeId]: list },
      }),
    );
  }

  // ---- Frames tab ----

  private renderFrames(): void {
    const project = this.store.getProject();
    const items = project.wall.standardSizes.map((size) =>
      this.framePaletteItem(size),
    );
    items.push(this.customFramePaletteItem());
    for (const aperture of distinctCustomFrameApertures(project.frames)) {
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
