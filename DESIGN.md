# Photowall Layout Designer — Design

## Overview

A browser-based tool for designing photo walls (gallery walls). It lets the user
lay out framed photos to scale on a virtual wall, experiment with arrangement,
and visualize the result before hanging anything.

The tool is **fully client-side**: it reads photos from the local filesystem and
never uploads anything to a server. It ships as a **single static HTML file**.

## Goals & Principles

- **Local-first / privacy-preserving.** All processing happens in the browser.
  No network requests for user content.
- **Single-file distribution.** The build output is one self-contained `.html`
  file (HTML + CSS + JS, including any inlined assets).
- **To scale.** Every photo and frame is rendered at true relative scale based on
  real-world dimensions (centimeters), so the layout reflects reality.
- **Direct manipulation.** Drag, drop, snap, and select — minimal modal UI.

## Technology

- **TypeScript** for all application code.
- **Vite** as the bundler. The dev server is used for iterating during
  development; the production build inlines everything into a **single static
  HTML file** (e.g. via a single-file inliner plugin).
- No server component. No uploads.
- **SVG** is the render target for the wall. The tool is designed for layouts of
  up to **~20 frames**, so SVG/DOM hit-testing and rendering are sufficient (no
  Canvas needed).
- Filesystem access via drag-and-drop and a file picker (`<input type="file">`
  and/or the File System Access API where available).
- Supported image formats: **JPEG, PNG**, and **HEIC only where the browser
  decodes it natively** (e.g. Safari). The tool does **not** bundle a HEIC
  decoder; on browsers without native HEIC support, HEIC is simply unsupported.
- **EXIF orientation** is applied on import (the imported pixels are oriented
  upright), unless overridden by manual rotation.

---

## Top Toolbar

A toolbar across the top of the window provides project-level actions:

- **New** — start a fresh, empty project.
- **Save** — write the project out as a **JSON** file (download).
- **Load** — read a project back from a **JSON** file.
- **Generate Bill of Materials** — produce a shopping/printing report for the
  current layout (see Bill of Materials).

In addition to explicit Save/Load, the current layout is **auto-persisted to
`localStorage`** so reopening the tool restores the last project.

---

## Main View — The Wall

- A single **zoomable, pannable grid view** representing the wall.
- The grid provides a visual reference for scale and alignment.
- The wall has configurable real-world dimensions (see Settings).
- Everything on the wall (frames + photos) is rendered **to scale** relative to
  the wall dimensions and the current zoom level.

On load, the view **fits the whole wall to the viewport**. Zoom range is roughly
**10%–800%**.

### Interactions

- **Zoom** — e.g. scroll / pinch / zoom controls.
- **Pan** — e.g. drag on empty canvas / space-drag / middle-mouse.
- **Select** — click a frame to select it.
- **Multi-select** — select several frames at once (e.g. shift/ctrl-click and/or
  rubber-band selection). Shared properties (such as color) can then be edited
  for all selected frames together.
- **Move** — drag a frame to reposition it (with snapping, see below). When
  multiple frames are selected, dragging moves them **together as a group**,
  preserving their relative positions.
- **Delete** — selected frame(s) can be deleted (e.g. Delete/Backspace key).
- **Drop targets** — the wall accepts dropped photos (from the filesystem) and
  dropped empty frames (from the Frames tab).

Frames may **overlap** each other and may extend **beyond the wall bounds** —
neither is constrained.

### Undo / Redo

- The editor supports **undo and redo** across mutating operations (add, delete,
  move, resize, recolor, rotate, photo placement/replacement, property changes).
- Standard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y).

---

## Left Floating Panel — Project

A floating panel docked on the left contains the project, organized into **two
tabs**:

### 1. Project Tab

- Configure the **wall / canvas dimensions** (real-world size, in cm). Default
  wall size: **200 × 150 cm**.
- (These dimensions drive the to-scale rendering of everything on the wall.)
- Configure the **wall color** (background of the wall). Default **white**. This
  uses a plain **free color picker** — it does **not** use the frame custom-color
  palette logic (no saved swatches list).
- Configure the list of **standard frame sizes** offered in the Frames tab and in
  the frame properties dropdown. This list is **user-configurable**; the
  **default set is the ISO A-series A0–A6** (A0, A1, A2, A3, A4, A5, A6).
- Configure the **passpartout (inner-window) sizes** offered **per frame size**.
  Each supported frame size has its own configurable list of selectable inner
  windows. **Default:** a frame may select any **smaller standard size** as its
  inner window (e.g. an **A3** frame defaults to offering **A4, A5, A6**). These
  lists are kept **separately per supported frame size** so they can be
  customized later (e.g. adding `A3 – 5 cm` style entries); the data model should
  allow arbitrary named inner-window sizes in cm.

### 2. Frames Tab

- Presents a set of **standard-size empty frames** plus a generic **Custom**
  template.
- Empty frames can be **dragged into the wall as placeholders** (frames with no
  photo yet).
- Whenever the wall contains one or more **custom-sized frames** (a frame whose
  size does not match a standard size), each distinct custom aperture is also
  surfaced in this list as its own draggable template, so the same custom size
  can be added again without re-entering dimensions. Templates dedupe by
  aperture (width × height in cm).

---

## Photos

- The project still tracks an internal set of photos (for serialization and so
  a placed photo survives Save / Load round-trips), but **there is no Photos
  tab** to browse them — photos enter the project only by being placed on the
  wall or into a frame.
- Ways to add a photo to the project:
  1. **Drag from the filesystem onto the wall** — adds the photo to the project
     *and* creates a frame for it.
  2. **Drag from the filesystem onto an existing frame** — adds the photo to the
     project and fills (or replaces) that frame.
  3. **Choose Photo** button in the Frame Properties panel (with a frame
     selected) — opens a file picker; behaves identically to dragging the
     selected file onto the selected frame.
- The tool reads each photo's **original dimensions / orientation** (pixel
  width/height) to derive aspect ratio and orientation.

---

## Frames

Frames are the core objects placed on the wall. A frame may be **empty** (a
placeholder) or **contain a photo**.

### Frame geometry & sizing

- A frame's **size** is defined as the **size of the photo it supports** — i.e.
  the **printed photo size** (its aperture), *not* the outer moulding size.
  Example: an "A4" frame holds an A4 print.
- The **frame thickness** (moulding border, default 1 cm) is rendered **outside**
  that aperture, so the frame's outer dimensions = aperture + thickness on each
  side.
- **Passpartout (mat):** when present, the passpartout sets a **smaller inner
  window** — the size of the printed photo it can display. Selecting a
  passpartout therefore reduces the effective photo size from the frame's full
  aperture to the passpartout's inner-window size. The mat fills the space
  between the frame aperture and the inner window. The selectable inner-window
  sizes depend on the frame size and **default to all smaller standard sizes**
  (e.g. an A3 frame offers A4, A5, A6); see Settings.
- The **effective photo print size** of a frame is the passpartout inner-window
  size if a passpartout is set, otherwise the frame's aperture size. (This is the
  value used by the Bill of Materials.)

### Creating frames

- Drag a **photo** onto the wall → creates a frame for that photo, sized to the
  **nearest standard size** (from the configured list) matching the photo's
  orientation, with a **custom size** as fallback if nothing is close.
- Drag a **standard empty frame** from the Frames tab onto the wall → creates an
  empty placeholder frame.

### Empty frame appearance

- An empty (photo-less) placeholder frame renders as a normal frame (moulding in
  its selected color) with a plain **white rectangle** filling the center where
  the photo would go.

### Filling / replacing photos in a frame

- Dragging a photo from the filesystem **onto an empty frame** places that
  photo in the frame.
- Dragging a photo onto a frame that already contains a photo **replaces** the
  existing photo.
- Selecting a frame and clicking **Choose Photo** in the Frame Properties panel
  is equivalent to dragging the chosen file onto that frame.
- In **all** cases the frame is **re-oriented to match the photo** (see Frame
  orientation): a landscape photo dropped onto a portrait frame turns the frame
  landscape, and vice versa.

### Frame orientation

- Frame orientation (portrait / landscape) is **automatically derived from the
  original photo's dimensions / orientation** whenever a photo is placed —
  including when filling or replacing the photo in an existing frame. If the
  photo's orientation differs from the frame's current aperture orientation, the
  aperture's width and height are **swapped** so the photo sits the right way up
  in a frame of the matching orientation (a landscape photo in a landscape
  frame, a portrait photo in a portrait frame).
- Placing a photo **re-derives** orientation and therefore **clears any manual
  rotation**. Afterwards this auto-orientation can be **overridden by rotating**
  the frame manually (see Properties → Rotation); rotation rotates **both the
  image and the frame together**, so a landscape image in a (rotated) frame
  still reads correctly.

### Photo fitting within a frame

- The photo is rendered to **cover** the frame's aperture (its effective photo
  area): it is scaled so its **smaller edge fills the aperture**, the longer
  edge overflows, and the overflow is **cropped** to the aperture. This leaves
  **no white gaps** around the photo.
- If the photo's **aspect ratio matches** the aperture's, cover degenerates to
  an **exact fit** (no cropping). Because frames are oriented to the photo
  (above), a matching photo is the common case.

### Frame color

- Every frame has an individually selectable **color** property.
- Frames are rendered as **simple rectangles** in the selected color.
- The default color is **black**.
- Color is chosen from a set of sensible defaults: **black, brown, red-brown,
  gold, silver**, plus **custom**. (Exact HEX values for these are placeholders
  to be refined later; gold/silver render as flat fills, not gradients.)
- Choosing **custom** lets the user pick any color; once added, that custom color
  is **pushed into the selectable options list** for reuse.
- When a new frame is added, it defaults to the **color of the last selected
  frame**.
- With multiple frames selected, changing the color applies to **all selected
  frames at once**.

### Rendering

- Frames and their photos are rendered **to scale** along with everything else on
  the wall.

---

## Frame Properties Panel

When a frame is selected, a small **floating properties panel** appears, from
which the frame can be configured.

Properties:

- **Choose Photo** — a button that opens a file picker; the chosen image is
  imported and placed in the selected frame, equivalent to dragging the file
  onto the frame (orientation re-derived, manual rotation cleared).
- **Frame size** — a dropdown to choose from the standard size options.
- **Custom frame size** — a special "custom" frame type that lets the user
  specify the frame dimensions directly.
- **Frame thickness** — width of the frame border (moulding), editable per
  frame. **Default 1 cm.**
- **Passpartout (mat)** — optional. Selects a **smaller inner-window size** (the
  printed photo size it can display) from the configured passpartout size list.
  See Frames → Frame geometry & sizing.
- **Color** — frame color, chosen from the defaults (black, brown, red-brown,
  gold, silver) or **custom**. See Frames → Frame color. Editable across a
  multi-selection.
- **Rotation** — rotates in **90° steps only** (no free transform). Rotating a
  selected frame rotates **both the image and the frame** together, and
  **overrides** the orientation otherwise derived from the photo's dimensions.
  Because rotation is constrained to 90°, all frames remain axis-aligned, which
  keeps snapping simple.

---

## Bill of Materials

The **Generate Bill of Materials** toolbar action produces a report for the
current layout to support actually buying and printing everything.

The report is generated as a **print-styled HTML view** and output via the
**browser's native print / save-as-PDF** dialog (no PDF library; keeps the
single-file, no-dependency approach). Print CSS lays it out as **two A4 pages**:

1. **Page 1 — Layout reference.** The wall layout rendered **fit to A4** for
   reference.
2. **Page 2 — Materials list**, containing:
   - **Photos to print** — each photo that needs printing, the **print size** it
     should be produced at, and a **small thumbnail** for identification. The
     thumbnail is produced by simply resizing the photo's dimensions down (no
     separate downscaling pipeline).
   - **Frames to buy** — which **frame sizes** are needed (and how many of each).
   - **Passpartouts** — which passpartouts / mats are needed, if any.

The **print size** for each photo is the frame's **effective photo print size** —
i.e. the passpartout inner-window size if a passpartout is set, otherwise the
frame's aperture size (see Frames → Frame geometry & sizing).

---

## Snapping

While dragging frames around the wall, the tool assists alignment with two kinds
of snapping. Snapping operates in **real-world cm** (not screen pixels), so snap
behavior is independent of zoom level.

Snap tolerance: **0.5 cm** (the max distance at which a snap engages). Edge
snapping uses the frame's **outer moulding edge** (what visually aligns on a
wall).

### Alignment snap

- Edges of the dragged frame snap to line up with the **edges of other frames**
  (e.g. shared top / bottom / left / right edges, and likely center lines).

### Spacing snap

- The **horizontal / vertical gap** between the dragged frame and nearby frames
  snaps to **match** the horizontal / vertical gaps between other nearby frames.
- This produces consistent, evenly-spaced layouts.

---

## Units & Scale

- Real-world units are **centimeters**.
- Wall dimensions, frame sizes, frame thickness, passpartout, and spacing are all
  expressed in cm.
- The wall view maps cm → screen pixels via the current zoom level, and all
  objects are rendered consistently to scale.

---

## Persistence

There are two distinct persistence paths, which deliberately store **different
amounts of data**:

- **Auto-save to `localStorage`** — stores **layout only**: the wall settings,
  the standard-size / passpartout configuration, and every frame (position,
  size, thickness, color, rotation, passpartout). It does **not** store any
  image data — image data URLs are large and would quickly exceed the
  `localStorage` quota. On reopen, the layout is restored, but **frames that
  held a photo come back as empty placeholders** (the pictures are not kept in
  the browser). To keep the actual photos, use **Save**.
- **Save / Load** (toolbar) — serialize the project to / from a **JSON** file.
  This is the portable, complete backup: it **embeds image data** (base64 /
  data URLs) so a saved project survives reload and JSON round-trips and can be
  opened on another machine. (The browser cannot persist photos by filesystem
  path, so embedding is the only way for the file to be self-contained.)
- **New** (toolbar) clears the project to start fresh.

Note: loading a JSON file restores the embedded photos for the session, but the
next `localStorage` auto-save still stores layout-only — reopening later
(without re-loading the file) again shows those frames as empty placeholders.

### Custom colors

- The **custom color palette** (custom colors added via the color picker) is
  stored in **`localStorage`**, so it persists across projects on the same
  machine.
- Any custom colors **actually used by frames** in a project are additionally
  **embedded in the exported project JSON**, so a project opened elsewhere still
  renders its frames with the correct colors.

---

## Open Questions / To Refine

- Additional **passpartout inner-window sizes** beyond the smaller-standard-size
  default (e.g. `A3 – 5 cm` entries) and their configuration UI — to be specified
  later.
- Final **HEX values** for the default frame colors (black, brown, red-brown,
  gold, silver) — placeholders for now.
- Precise zoom/pan input bindings (scroll vs. pinch, modifier keys).
- Visual snap guides (rendering of the snap indicators).
- Browser-persisting the **actual photos** across reloads (e.g. an IndexedDB
  store of image blobs) so reopened layouts keep their pictures rather than
  showing empty placeholders. Resolved for now by **not** persisting images to
  `localStorage` at all (layout-only auto-save; images live only in the
  in-memory session and in explicitly Saved JSON files).
