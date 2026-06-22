# Photowall Layout Designer — Implementation TODO

A step-by-step build plan derived from `DESIGN.md`. Ordered by dependency:
each phase should be runnable/verifiable before moving on. Check items off as
completed.

**Key architectural decisions baked into this plan:**

- All mutations flow through a **central store + command/history stack** from
  Phase 2 — undo/redo is impossible to retrofit cleanly, so it goes in early.
- The SVG **`viewBox` is expressed in centimeters**. Zoom/pan = adjusting the
  viewBox. All geometry math stays in real-world cm; cm→px is only the final
  viewBox→viewport mapping.
- Photo fit = SVG `preserveAspectRatio="xMidYMid meet"` (contain) inside an
  aperture clip. "Exact fit" is just the case where aspect ratios match.
- Frames stay **axis-aligned** (90° rotation only), so all snapping/bounds math
  can use simple AABBs.

---

## Phase 0 — Project scaffold

- [x] `npm init` and install **Vite** + **TypeScript**.
- [x] Add `vite-plugin-singlefile` (or equivalent) so `vite build` emits one
      self-contained `.html`.
- [x] Configure `tsconfig.json` (strict mode).
- [x] Create `index.html` shell with three layout regions: **top toolbar**,
      **left floating panel**, **main wall view**. Skeleton CSS for the layout.
- [x] Confirm `vite dev` serves and `vite build` produces a single inlined HTML
      file that opens standalone.

## Phase 1 — Domain model, units & geometry (pure, no UI)

- [ ] Define core TypeScript types: `Project`, `WallSettings`, `Photo`,
      `Frame`, `StandardSize`, `PasspartoutSize`, `FrameColor`, `Selection`.
- [ ] Encode the **ISO A-series A0–A6** size table in cm (portrait baseline).
- [ ] Helpers (pure, unit-tested):
  - [ ] `cm` is the canonical unit throughout; no px in the model.
  - [ ] Orientation from photo pixel dims (portrait/landscape).
  - [ ] **Nearest standard size** for a given aspect ratio + orientation
        (with custom fallback when nothing is close).
  - [ ] **Effective photo print size** = passpartout inner-window if set, else
        aperture.
  - [ ] Frame **outer AABB** = aperture + thickness on each side (+ rotation
        swap of w/h for 90°/270°).
  - [ ] Default per-frame-size **passpartout options** = all smaller standard
        sizes (e.g. A3 → A4, A5, A6).
- [ ] Define the **default project** (wall 200×150 cm, white wall, default
      sizes/passpartout config).

## Phase 2 — State store, mutations & undo/redo

- [ ] Central **store** holding the `Project` + transient UI state (selection,
      zoom/pan, last-used frame color).
- [ ] All edits expressed as **commands** applied immutably to the project.
- [ ] **History stack** (undo/redo) wrapping every mutating command:
      add/delete/move/resize/recolor/rotate/photo place+replace/property change.
- [ ] Subscribe mechanism to trigger re-render on change.
- [ ] Keyboard: **Ctrl/Cmd+Z** (undo), **Ctrl/Cmd+Shift+Z** / **Ctrl+Y** (redo).

## Phase 3 — Wall rendering (SVG)

- [ ] Create SVG element with **viewBox in cm**.
- [ ] Render **wall rectangle** filled with the configurable wall color.
- [ ] Render the **grid** background as a scale reference.
- [ ] Render a **frame** from the model:
  - [ ] Outer moulding rectangle in the frame color.
  - [ ] Mat/passpartout region (between aperture and inner window) when set.
  - [ ] Aperture / inner-window area.
  - [ ] Photo via `<image>` with `preserveAspectRatio="xMidYMid meet"` clipped
        to the aperture (handles both exact-fit and scale-to-fit; letterbox
        backing color defined here).
  - [ ] Empty frame → **white rectangle** in the center instead of a photo.
  - [ ] Apply **90° rotation** transform (image + frame together).
- [ ] Render selection highlight(s) for selected frame(s).
- [ ] Render frames to scale; verify ~20 frames perform fine.

## Phase 4 — Zoom & pan

- [ ] **Fit-whole-wall-to-viewport** on load.
- [ ] Zoom (scroll/pinch + controls), clamped to **~10%–800%**, zoom toward
      cursor.
- [ ] Pan (drag empty canvas / space-drag / middle-mouse).
- [ ] All implemented by mutating the SVG viewBox; confirm cm geometry unaffected.

## Phase 5 — Selection & manipulation

- [ ] Click to **select** a frame; click empty space to clear.
- [ ] **Multi-select**: shift/ctrl-click toggle + **rubber-band** marquee.
- [ ] **Move** by dragging (screen px delta → cm via current zoom).
- [ ] **Group move**: dragging any selected frame moves all, preserving relative
      positions.
- [ ] **Delete** selected frame(s) via Delete/Backspace.
- [ ] Confirm overlap and out-of-bounds placement are allowed (no clamping).

## Phase 6 — Snapping (during move)

- [ ] Compute snap candidates in **cm** against other frames' **outer edges**.
- [ ] **Alignment snap**: top/bottom/left/right edges + center lines, within
      **0.5 cm** tolerance.
- [ ] **Spacing snap**: match horizontal/vertical gaps to nearby frame gaps.
- [ ] Render **snap guide** indicators while dragging.
- [ ] Snapping works for group moves (snap the group's bounding box).

## Phase 7 — Left panel & tabs (UI shell)

- [ ] Floating left panel with **Settings / Photos / Frames** tabs.
- [ ] **Settings tab**: wall width/height inputs; **wall color** (plain free
      color picker, no swatch list); editable **standard frame sizes** list;
      **per-frame-size passpartout** options config.
- [ ] **Photos tab**: thumbnail list, **Add** button (file picker), remove
      control.
- [ ] **Frames tab**: palette of standard empty frames to drag onto the wall.

## Phase 8 — Photo import pipeline

- [ ] Read files (JPEG/PNG; **HEIC only if browser decodes natively** — feature
      detect, otherwise reject with a message).
- [ ] Apply **EXIF orientation** on import so stored pixels are upright.
- [ ] Capture original pixel **dimensions/orientation**.
- [ ] Store image as **data URL** (base64) for persistence/round-trip.
- [ ] Generate **small thumbnail** by resizing dimensions (for panel + BOM).

## Phase 9 — Drag & drop wiring

- [ ] Filesystem → **Photos tab**: add photo(s) to project.
- [ ] Filesystem → **wall**: add photo to project **and** create a frame.
- [ ] Photos tab → **wall**: create a frame containing that photo.
- [ ] Photo (filesystem or Photos tab) → **onto a frame**: fill if empty,
      **replace** if occupied.
- [ ] Frames tab → **wall**: create an empty placeholder frame.
- [ ] On photo placement: derive **orientation** + size frame to **nearest
      standard size** (custom fallback).
- [ ] **Remove photo in use** → warning dialog; on accept, remove photo and
      **empty** all frames using it.

## Phase 10 — Frame properties panel

- [ ] Floating properties panel appears on (single) selection.
- [ ] **Frame size** dropdown (standard list) + **custom size** entry.
- [ ] **Thickness** input (per frame, default 1 cm).
- [ ] **Passpartout** dropdown (options depend on frame size).
- [ ] **Color** control: defaults (black/brown/red-brown/gold/silver) + **custom
      picker**; adding a custom color **pushes it into the options list**.
- [ ] New frame inherits **last-selected frame's color**.
- [ ] **Rotation** control (90° steps).
- [ ] **Multi-select**: shared properties (esp. color) edit **all** selected
      frames at once.

## Phase 11 — Persistence

- [ ] Serialize project → **JSON** (embed image data URLs + **used custom
      colors**).
- [ ] Deserialize / validate JSON → project.
- [ ] **Auto-save to `localStorage`**; restore on load.
- [ ] Toolbar **Save** (download .json), **Load** (file picker), **New** (reset).
- [ ] **Custom color palette** persisted separately in `localStorage` (across
      projects).
- [ ] Handle `localStorage` quota gracefully (warn; IndexedDB fallback noted as
      future work).

## Phase 12 — Bill of Materials

- [ ] **Generate Bill of Materials** toolbar action.
- [ ] Build a **print-styled HTML view** with print CSS for **two A4 pages**.
- [ ] **Page 1**: wall layout rendered **fit to A4** for reference.
- [ ] **Page 2**: aggregated lists —
  - [ ] **Photos to print**: thumbnail + **effective print size** per photo.
  - [ ] **Frames to buy**: counts per frame size.
  - [ ] **Passpartouts**: counts per passpartout, if any.
- [ ] Trigger `window.print()` (native save-as-PDF); restore app view after.

## Phase 13 — Build, cross-browser & polish

- [ ] Verify production **single-file build** opens and works standalone.
- [ ] Sanity-check across browsers (note HEIC only on native-support browsers).
- [ ] Edge cases: empty project, very large/small walls, many overlapping
      frames, custom-size frames, rotation + passpartout combinations.
- [ ] Final pass on the deferred items in `DESIGN.md` Open Questions (HEX
      colors, extra passpartout sizes, snap-guide visuals, zoom/pan bindings).

---

## Cross-cutting (keep in mind throughout)

- Every state change goes through the store/command layer so it is **undoable**
  and **auto-saved**.
- Keep all spatial math in **cm**; only convert to px at the SVG/viewBox edge.
- Frames are axis-aligned (90° rotation) → AABB math everywhere.
