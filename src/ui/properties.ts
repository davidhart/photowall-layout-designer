import { DEFAULT_FRAME_COLORS } from "../model/colors";
import { orientSize } from "../model/geometry";
import { standardPasspartoutOptions, standardSizes } from "../model/standards";
import type { Frame, FrameColor, PasspartoutSize, Project } from "../model/types";
import { importAndAddPhotos } from "../photo/photoService";
import {
  addCustomColor,
  placePhotoInFrame,
  recolorFrames,
  rotateFramesBy,
  updateFrames,
} from "../state/commands";
import type { Store } from "../state/store";
import { h } from "./dom";

export type PropertiesErrorHandler = (message: string) => void;

/** Sentinel select value used to switch a passpartout to a Custom… inner window. */
const PP_CUSTOM_VALUE = "__custom__";

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
    private readonly onError: PropertiesErrorHandler = () => {},
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
      this.choosePhotoControl(frame),
      this.sizeControl(frame),
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

  private choosePhotoControl(frame: Frame): HTMLElement {
    const fileInput = h("input", {
      type: "file",
      accept: "image/jpeg,image/png,image/heic,image/heif",
      style: "display:none",
      onchange: (e: Event) => {
        const input = e.target as HTMLInputElement;
        // Snapshot before resetting — clearing the input empties the live
        // FileList and would drop the picked file mid-import.
        const files = input.files ? Array.from(input.files) : [];
        input.value = "";
        if (files.length === 0) return;
        void importAndAddPhotos(this.store, files).then(({ added, errors }) => {
          if (errors.length) this.onError(errors.join("\n"));
          const photo = added[0];
          if (photo) this.store.dispatch(placePhotoInFrame(frame.id, photo.id));
        });
      },
    }) as HTMLInputElement;
    const hasPhoto = frame.photoId !== null;
    const chooseButton = h("button", {
      type: "button",
      class: "photo-btn",
      text: hasPhoto ? "Replace Photo" : "Choose Photo",
      onclick: () => fileInput.click(),
    });
    const children: Node[] = [chooseButton];
    if (hasPhoto) {
      children.push(
        h("button", {
          type: "button",
          class: "photo-btn photo-btn--icon",
          title: "Remove photo",
          "aria-label": "Remove photo",
          // U+1F5D1 WASTEBASKET — trash-can icon.
          text: "🗑",
          // Clear the photoId only — keep the frame's aperture / orientation
          // / rotation. The photo itself stays in the project (it may be in
          // use by other frames).
          onclick: () =>
            this.store.dispatch(updateFrames([frame.id], { photoId: null })),
        }),
      );
    }
    return h("div", { class: "prop-field photo-row" }, [...children, fileInput]);
  }

  private sizeControl(frame: Frame): HTMLElement {
    const sizes = standardSizes();
    const select = h(
      "select",
      {
        onchange: (e: Event) =>
          this.changeSize(frame, (e.target as HTMLSelectElement).value),
      },
      [
        ...sizes.map((s) =>
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

  private changeSize(frame: Frame, sizeId: string): void {
    const orientation =
      frame.aperture.width > frame.aperture.height ? "landscape" : "portrait";
    if (sizeId === "custom") {
      this.store.dispatch(
        updateFrames([frame.id], { standardSizeId: null, passpartout: null }),
      );
      return;
    }
    const size = standardSizes().find((s) => s.id === sizeId);
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
    if (frame.standardSizeId === null) {
      // Passpartouts are only meaningful on standard-size frames (the smaller
      // standard sizes derive from the parent's standard size). Custom-size
      // frames have no parent-size scope, so the control is omitted entirely.
      return h("span", {});
    }
    const options = passpartoutOptionsFor(frame, project);
    const activeId = frame.passpartout?.id ?? "";
    const isCustomActive = activeId.startsWith("custom:");

    const select = h(
      "select",
      {
        onchange: (e: Event) => {
          const val = (e.target as HTMLSelectElement).value;
          if (val === PP_CUSTOM_VALUE) {
            // Switch to a fresh custom passpartout sized at half the aperture.
            const w = round1(frame.aperture.width / 2);
            const hh = round1(frame.aperture.height / 2);
            this.setPasspartout(frame, makeCustomPasspartout(w, hh));
            return;
          }
          const found = options.find((o) => o.id === val) ?? null;
          this.setPasspartout(frame, found);
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
            ...(activeId === o.id ? { selected: "true" } : {}),
          }),
        ),
        h("option", {
          value: PP_CUSTOM_VALUE,
          text: "Custom…",
          ...(isCustomActive ? { selected: "true" } : {}),
        }),
      ],
    );

    const children: (Node | string)[] = [this.field("Passpartout", select)];
    if (isCustomActive && frame.passpartout) {
      children.push(this.customPasspartoutControl(frame, frame.passpartout));
    }
    return h("div", {}, children);
  }

  private customPasspartoutControl(
    frame: Frame,
    pp: PasspartoutSize,
  ): HTMLElement {
    const num = (key: "width" | "height") =>
      h("input", {
        class: "size-num",
        type: "number",
        min: "0.1",
        step: "0.1",
        value: String(pp[key]),
        onchange: (e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (!(n > 0)) return;
          const next = { ...pp, [key]: n };
          this.setPasspartout(frame, makeCustomPasspartout(next.width, next.height));
        },
      });
    return this.field(
      "Custom mat (cm)",
      h("span", { class: "custom-size" }, [num("width"), " × ", num("height")]),
    );
  }

  private setPasspartout(frame: Frame, pp: PasspartoutSize | null): void {
    this.store.dispatch(updateFrames([frame.id], { passpartout: pp }));
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

  /** Default colors + cross-project palette + this project's custom colors. */
  private palette(project: Project): FrameColor[] {
    const seen = new Set<string>();
    const result: FrameColor[] = [];
    const all = [
      ...DEFAULT_FRAME_COLORS,
      ...this.store.getUI().customPalette,
      ...project.customColors,
    ];
    for (const c of all) {
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
    // Persist custom colors across projects (cross-project palette).
    if (isCustom) this.store.addCustomPaletteColor(color);
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

/** Round to 1 decimal cm for stable identity / display. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A custom passpartout option keyed by its dimensions so duplicates coalesce. */
function makeCustomPasspartout(width: number, height: number): PasspartoutSize {
  const w = round1(width);
  const hh = round1(height);
  const label = `${w}×${hh}`;
  return { id: `custom:${w}x${hh}`, name: label, width: w, height: hh };
}

/**
 * The passpartout dropdown's options for a given frame: every default
 * smaller-standard-size inner window for the frame's standard size, plus any
 * custom-size passpartouts already in use on another frame of the same
 * standard size (so a one-off custom mat becomes reusable across like
 * frames). Deduped by id.
 */
function passpartoutOptionsFor(
  frame: Frame,
  project: Project,
): PasspartoutSize[] {
  if (frame.standardSizeId === null) return [];
  const defaults = standardPasspartoutOptions()[frame.standardSizeId] ?? [];
  const inUse: PasspartoutSize[] = [];
  for (const other of project.frames) {
    if (other.standardSizeId !== frame.standardSizeId) continue;
    if (!other.passpartout) continue;
    if (!other.passpartout.id.startsWith("custom:")) continue;
    inUse.push(other.passpartout);
  }
  const seen = new Set<string>();
  const result: PasspartoutSize[] = [];
  for (const opt of [...defaults, ...inUse]) {
    if (seen.has(opt.id)) continue;
    seen.add(opt.id);
    result.push(opt);
  }
  return result;
}
