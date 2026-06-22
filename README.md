# Photowall Layout Designer

A fully client-side, browser-based tool for designing photo walls (gallery
walls) to scale. Lay out framed photos on a virtual wall, arrange them with
snapping, and generate a printable Bill of Materials. See [`DESIGN.md`](./DESIGN.md)
for the full specification and [`TODO.md`](./TODO.md) for the build plan.

Everything runs in the browser — **no uploads, no server**. The production
build is a single self-contained `.html` file.

## Develop

```bash
npm install
npm run dev        # Vite dev server
npm run typecheck  # tsc --noEmit (strict)
npm test           # vitest
```

## Build

```bash
npm run build      # type-checks, then emits dist/index.html
```

`dist/index.html` inlines all JS/CSS (via `vite-plugin-singlefile`) and opens
standalone by double-clicking — no web server required.

## Usage notes

- **Units** are centimetres throughout; the SVG `viewBox` is expressed in cm and
  zoom/pan only adjust that viewBox.
- **Pan**: drag with the middle mouse button or hold <kbd>Space</kbd> and drag.
  **Zoom**: scroll wheel (toward the cursor) or the on-screen `+ / − / Fit`
  controls. **Select**: click a frame; <kbd>Shift</kbd>/<kbd>Ctrl</kbd>-click or
  rubber-band for multi-select. **Delete**: <kbd>Delete</kbd>/<kbd>Backspace</kbd>.
  **Undo/redo**: <kbd>Cmd/Ctrl</kbd>+<kbd>Z</kbd> /
  <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> (or <kbd>Ctrl</kbd>+<kbd>Y</kbd>).
- **Images**: JPEG and PNG are supported everywhere. **HEIC/HEIF** is only
  supported on browsers that decode it natively (e.g. Safari) — the tool does
  not bundle a HEIC decoder, and undecodable files are reported per-file.
- The current layout **auto-saves to `localStorage`** and is restored on reopen.
  If storage is full, you are warned to use **Save** for a JSON backup
  (IndexedDB fallback is noted as future work).
