// Drag-and-drop payload types used between the left panel (drag sources) and
// the wall (drop target). Values are read in Phase 9's drop wiring.

/** Dragging a standard empty frame; value = standard size id (or "custom"). */
export const DND_FRAME_SIZE = "application/x-photowall-frame-size";

/** Dragging a project photo; value = photo id. */
export const DND_PHOTO_ID = "application/x-photowall-photo-id";
