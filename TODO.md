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
- Photo fit = SVG `preserveAspectRatio="xMidYMid slice"` (cover) clipped to the
  aperture — the photo's smaller edge fills the aperture and the overflow is
  cropped (no white gaps). "Exact fit" is just the case where aspect ratios
  match. Placing a photo re-orients the frame to the photo's orientation.
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

- [x] Define core TypeScript types: `Project`, `WallSettings`, `Photo`,
      `Frame`, `StandardSize`, `PasspartoutSize`, `FrameColor`, `Selection`.
- [x] Encode the **ISO A-series A0–A6** size table in cm (portrait baseline).
- [x] Helpers (pure, unit-tested):
  - [x] `cm` is the canonical unit throughout; no px in the model.
  - [x] Orientation from photo pixel dims (portrait/landscape).
  - [x] **Nearest standard size** for a given aspect ratio + orientation
        (with custom fallback when nothing is close).
  - [x] **Effective photo print size** = passpartout inner-window if set, else
        aperture.
  - [x] Frame **outer AABB** = aperture + thickness on each side (+ rotation
        swap of w/h for 90°/270°).
  - [x] Default per-frame-size **passpartout options** = all smaller standard
        sizes (e.g. A3 → A4, A5, A6).
- [x] Define the **default project** (wall 200×150 cm, white wall, default
      sizes/passpartout config).

## Phase 2 — State store, mutations & undo/redo

- [x] Central **store** holding the `Project` + transient UI state (selection,
      zoom/pan, last-used frame color).
- [x] All edits expressed as **commands** applied immutably to the project.
- [x] **History stack** (undo/redo) wrapping every mutating command:
      add/delete/move/resize/recolor/rotate/photo place+replace/property change.
- [x] Subscribe mechanism to trigger re-render on change.
- [x] Keyboard: **Ctrl/Cmd+Z** (undo), **Ctrl/Cmd+Shift+Z** / **Ctrl+Y** (redo).

## Phase 3 — Wall rendering (SVG)

- [x] Create SVG element with **viewBox in cm**.
- [x] Render **wall rectangle** filled with the configurable wall color.
- [x] Render the **grid** background as a scale reference.
- [x] Render a **frame** from the model:
  - [x] Outer moulding rectangle in the frame color.
  - [x] Mat/passpartout region (between aperture and inner window) when set.
  - [x] Aperture / inner-window area.
  - [x] Photo via `<image>` with `preserveAspectRatio="xMidYMid slice"` (cover)
        clipped to the aperture (smaller edge fills, overflow cropped, no white
        gaps; exact-fit is the matching-aspect case).
  - [x] Empty frame → **white rectangle** in the center instead of a photo.
  - [x] Apply **90° rotation** transform (image + frame together).
- [x] Render selection highlight(s) for selected frame(s).
- [x] Render frames to scale; verify ~20 frames perform fine.

## Phase 4 — Zoom & pan

- [x] **Fit-whole-wall-to-viewport** on load.
- [x] Zoom (scroll/pinch + controls), clamped to **~10%–800%**, zoom toward
      cursor.
- [x] Pan (drag empty canvas / space-drag / middle-mouse).
- [x] All implemented by mutating the SVG viewBox; confirm cm geometry unaffected.

## Phase 5 — Selection & manipulation

- [x] Click to **select** a frame; click empty space to clear.
- [x] **Multi-select**: shift/ctrl-click toggle + **rubber-band** marquee.
- [x] **Move** by dragging (screen px delta → cm via current zoom).
- [x] **Group move**: dragging any selected frame moves all, preserving relative
      positions.
- [x] **Delete** selected frame(s) via Delete/Backspace.
- [x] Confirm overlap and out-of-bounds placement are allowed (no clamping).

## Phase 6 — Snapping (during move)

- [x] Compute snap candidates in **cm** against other frames' **outer edges**.
- [x] **Alignment snap**: top/bottom/left/right edges + center lines, within
      **0.5 cm** tolerance.
- [x] **Spacing snap**: match horizontal/vertical gaps to nearby frame gaps.
- [x] Render **snap guide** indicators while dragging.
- [x] Snapping works for group moves (snap the group's bounding box).

## Phase 7 — Left panel & tabs (UI shell)

- [x] Floating left panel with **Settings / Photos / Frames** tabs.
- [x] **Settings tab**: wall width/height inputs; **wall color** (plain free
      color picker, no swatch list); editable **standard frame sizes** list;
      **per-frame-size passpartout** options config.
- [x] **Photos tab**: thumbnail list, **Add** button (file picker), remove
      control.
- [x] **Frames tab**: palette of standard empty frames to drag onto the wall.

## Phase 8 — Photo import pipeline

- [x] Read files (JPEG/PNG; **HEIC only if browser decodes natively** — feature
      detect, otherwise reject with a message).
- [x] Apply **EXIF orientation** on import so stored pixels are upright.
- [x] Capture original pixel **dimensions/orientation**.
- [x] Store image as **data URL** (base64) for persistence/round-trip.
- [x] Generate **small thumbnail** by resizing dimensions (for panel + BOM).

## Phase 9 — Drag & drop wiring

- [x] Filesystem → **Photos tab**: add photo(s) to project.
- [x] Filesystem → **wall**: add photo to project **and** create a frame.
- [x] Photos tab → **wall**: create a frame containing that photo.
- [x] Photo (filesystem or Photos tab) → **onto a frame**: fill if empty,
      **replace** if occupied.
- [x] Frames tab → **wall**: create an empty placeholder frame.
- [x] On photo placement: derive **orientation** + size frame to **nearest
      standard size** (custom fallback).
- [x] **Remove photo in use** → warning dialog; on accept, remove photo and
      **empty** all frames using it.

## Phase 10 — Frame properties panel

- [x] Floating properties panel appears on (single) selection.
- [x] **Frame size** dropdown (standard list) + **custom size** entry.
- [x] **Thickness** input (per frame, default 1 cm).
- [x] **Passpartout** dropdown (options depend on frame size).
- [x] **Color** control: defaults (black/brown/red-brown/gold/silver) + **custom
      picker**; adding a custom color **pushes it into the options list**.
- [x] New frame inherits **last-selected frame's color**.
- [x] **Rotation** control (90° steps).
- [x] **Multi-select**: shared properties (esp. color) edit **all** selected
      frames at once.

## Phase 11 — Persistence

- [x] Serialize project → **JSON** (embed image data URLs + **used custom
      colors**).
- [x] Deserialize / validate JSON → project.
- [x] **Auto-save to `localStorage`**; restore on load.
- [x] Toolbar **Save** (download .json), **Load** (file picker), **New** (reset).
- [x] **Custom color palette** persisted separately in `localStorage` (across
      projects).
- [x] Handle `localStorage` quota gracefully (warn; IndexedDB fallback noted as
      future work).

## Phase 12 — Bill of Materials

- [x] **Generate Bill of Materials** toolbar action.
- [x] Build a **print-styled HTML view** with print CSS for **two A4 pages**.
- [x] **Page 1**: wall layout rendered **fit to A4** for reference.
- [x] **Page 2**: aggregated lists —
  - [x] **Photos to print**: thumbnail + **effective print size** per photo.
  - [x] **Frames to buy**: counts per frame size.
  - [x] **Passpartouts**: counts per passpartout, if any.
- [x] Trigger `window.print()` (native save-as-PDF); restore app view after.

## Phase 13 — Build, cross-browser & polish

- [x] Verify production **single-file build** opens and works standalone.
- [x] Sanity-check across browsers (note HEIC only on native-support browsers).
- [x] Edge cases: empty project, very large/small walls, many overlapping
      frames, custom-size frames, rotation + passpartout combinations.
- [x] Final pass on the deferred items in `DESIGN.md` Open Questions (HEX
      colors, extra passpartout sizes, snap-guide visuals, zoom/pan bindings).

---

## Cross-cutting (keep in mind throughout)

- Every state change goes through the store/command layer so it is **undoable**
  and **auto-saved**.
- Keep all spatial math in **cm**; only convert to px at the SVG/viewBox edge.
- Frames are axis-aligned (90° rotation) → AABB math everywhere.
