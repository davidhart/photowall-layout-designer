import { DEFAULT_FRAME_COLORS } from "../model/colors";
import { orientSize } from "../model/geometry";
import type { Frame, FrameColor, PasspartoutSize, Project } from "../model/types";
import {
  addCustomColor,
  recolorFrames,
  rotateFramesBy,
  updateFrames,
} from "../state/commands";
import type { Store } from "../state/store";
import { h } from "./dom";

/**
 * Floating frame-properties panel. Shows on selection: full controls for a
 * single frame, and shared controls (color / thickness / rotation) for a
 * multi-selection. Re-renders only when the selection or project changes.
 */
export class PropertiesPanel {
  private lastSelection: unknown = null;
  private lastProject: unknown = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly store: Store,
  ) {
    this.store.subscribe(() => this.render());
    this.render();
  }

  render(): void {
    const ui = this.store.getUI();
    const project = this.store.getProject();
    if (ui.selection.frameIds === this.lastSelection && project === this.lastProject) {
      return;
    }
    this.lastSelection = ui.selection.frameIds;
    this.lastProject = project;

    const ids = ui.selection.frameIds;
    if (ids.length === 0) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }

    const frames = ids
      .map((id) => project.frames.find((f) => f.id === id))
      .filter((f): f is Frame => f !== undefined);
    if (frames.length === 0) {
      this.el.hidden = true;
      return;
    }

    this.el.hidden = false;
    if (frames.length === 1) {
      this.renderSingle(frames[0]!, project);
    } else {
      this.renderMulti(ids, frames, project);
    }
  }

  private get selectedIds(): string[] {
    return this.store.getUI().selection.frameIds;
  }

  // ---- Single-frame panel ----

  private renderSingle(frame: Frame, project: Project): void {
    this.el.replaceChildren(
      h("h3", { text: "Frame" }),
      this.sizeControl(frame, project),
      frame.standardSizeId === null ? this.customSizeControl(frame) : "",
      this.thicknessControl(frame),
      this.passpartoutControl(frame, project),
      this.colorControl(frame.color, project),
      this.rotationControl(),
    );
  }

  private renderMulti(ids: string[], frames: Frame[], project: Project): void {
    const sharedColor = frames.every((f) => f.color === frames[0]!.color)
      ? frames[0]!.color
      : null;
    this.el.replaceChildren(
      h("h3", { text: `${ids.length} frames selected` }),
      this.colorControl(sharedColor, project),
      this.rotationControl(),
    );
  }

  // ---- Controls ----

  private field(label: string, control: Node): HTMLElement {
    return h("label", { class: "field prop-field" }, [
      h("span", { text: label }),
      control,
    ]);
  }

  private sizeControl(frame: Frame, project: Project): HTMLElement {
    const select = h(
      "select",
      {
        onchange: (e: Event) =>
          this.changeSize(frame, (e.target as HTMLSelectElement).value, project),
      },
      [
        ...project.wall.standardSizes.map((s) =>
          h("option", {
            value: s.id,
            text: s.name,
            ...(frame.standardSizeId === s.id ? { selected: "true" } : {}),
          }),
        ),
        h("option", {
          value: "custom",
          text: "Custom…",
          ...(frame.standardSizeId === null ? { selected: "true" } : {}),
        }),
      ],
    );
    return this.field("Size", select);
  }

  private changeSize(frame: Frame, sizeId: string, project: Project): void {
    const orientation =
      frame.aperture.width > frame.aperture.height ? "landscape" : "portrait";
    if (sizeId === "custom") {
      this.store.dispatch(updateFrames([frame.id], { standardSizeId: null }));
      return;
    }
    const size = project.wall.standardSizes.find((s) => s.id === sizeId);
    if (!size) return;
    const aperture = orientSize(size, orientation);
    // Clear passpartout on size change to avoid invalid combinations.
    this.store.dispatch(
      updateFrames([frame.id], {
        standardSizeId: size.id,
        aperture,
        passpartout: null,
      }),
    );
  }

  private customSizeControl(frame: Frame): HTMLElement {
    const num = (key: "width" | "height") =>
      h("input", {
        class: "size-num",
        type: "number",
        min: "0.1",
        step: "0.1",
        value: String(frame.aperture[key]),
        onchange: (e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (!(n > 0)) return;
          this.store.dispatch(
            updateFrames([frame.id], {
              aperture: { ...frame.aperture, [key]: n },
            }),
          );
        },
      });
    return this.field(
      "Custom size (cm)",
      h("span", { class: "custom-size" }, [num("width"), " × ", num("height")]),
    );
  }

  private thicknessControl(frame: Frame): HTMLElement {
    return this.field(
      "Thickness (cm)",
      h("input", {
        type: "number",
        min: "0",
        step: "0.1",
        value: String(frame.thickness),
        onchange: (e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (n >= 0) {
            this.store.dispatch(updateFrames(this.selectedIds, { thickness: n }));
          }
        },
      }),
    );
  }

  private passpartoutControl(frame: Frame, project: Project): HTMLElement {
    const options: PasspartoutSize[] = frame.standardSizeId
      ? project.wall.passpartoutOptions[frame.standardSizeId] ?? []
      : [];
    const select = h(
      "select",
      {
        onchange: (e: Event) => {
          const val = (e.target as HTMLSelectElement).value;
          const found = options.find((o) => o.id === val) ?? null;
          this.store.dispatch(updateFrames([frame.id], { passpartout: found }));
        },
      },
      [
        h("option", {
          value: "",
          text: "None",
          ...(frame.passpartout === null ? { selected: "true" } : {}),
        }),
        ...options.map((o) =>
          h("option", {
            value: o.id,
            text: o.name,
            ...(frame.passpartout?.id === o.id ? { selected: "true" } : {}),
          }),
        ),
      ],
    );
    return this.field("Passpartout", select);
  }

  private colorControl(activeHex: string | null, project: Project): HTMLElement {
    const palette = this.palette(project);
    const swatches = palette.map((c) =>
      h("button", {
        type: "button",
        class: `swatch${activeHex === c.hex ? " swatch--active" : ""}`,
        title: c.label,
        style: `background:${c.hex}`,
        onclick: () => this.applyColor(c, false),
      }),
    );

    const custom = h("input", {
      type: "color",
      class: "swatch-custom",
      title: "Custom color",
      value: activeHex ?? "#000000",
      onchange: (e: Event) => {
        const hex = (e.target as HTMLInputElement).value;
        this.applyColor({ id: `custom_${hex}`, label: hex, hex }, true);
      },
    });

    return h("div", { class: "prop-field" }, [
      h("span", { class: "field-label", text: "Color" }),
      h("div", { class: "swatches" }, [...swatches, custom]),
    ]);
  }

  /** Default colors plus any custom colors already in the project (dedup by hex). */
  private palette(project: Project): FrameColor[] {
    const seen = new Set<string>();
    const result: FrameColor[] = [];
    for (const c of [...DEFAULT_FRAME_COLORS, ...project.customColors]) {
      if (!seen.has(c.hex)) {
        seen.add(c.hex);
        result.push(c);
      }
    }
    return result;
  }

  private applyColor(color: FrameColor, isCustom: boolean): void {
    const ids = this.selectedIds;
    // One undoable step: register the custom color (if any) + recolor.
    this.store.dispatch((p) => {
      let next = recolorFrames(ids, color.hex)(p);
      if (isCustom) next = addCustomColor(color)(next);
      return next;
    });
    this.store.setLastFrameColor(color.hex);
  }

  private rotationControl(): HTMLElement {
    return h("div", { class: "prop-field" }, [
      h("span", { class: "field-label", text: "Rotation" }),
      h("div", { class: "rotate-row" }, [
        h("button", {
          type: "button",
          text: "⟲ 90°",
          onclick: () => this.store.dispatch(rotateFramesBy(this.selectedIds, -90)),
        }),
        h("button", {
          type: "button",
          text: "⟳ 90°",
          onclick: () => this.store.dispatch(rotateFramesBy(this.selectedIds, 90)),
        }),
      ]),
    ]);
  }
}
