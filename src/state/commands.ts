import { orientationFromPixels } from "../model/geometry";
import type {
  Frame,
  FrameColor,
  Photo,
  Project,
  Rotation,
  WallSettings,
} from "../model/types";

/**
 * A command is a pure transformation of the project. It must return a **new**
 * project (immutable update) rather than mutating its input — the store relies
 * on this for snapshot-based undo/redo.
 */
export type Command = (project: Project) => Project;

/** Adds a frame to the wall. */
export function addFrame(frame: Frame): Command {
  return (p) => ({ ...p, frames: [...p.frames, frame] });
}

/** Deletes the given frames by id. */
export function deleteFrames(ids: readonly string[]): Command {
  const set = new Set(ids);
  return (p) => ({ ...p, frames: p.frames.filter((f) => !set.has(f.id)) });
}

/** Moves the given frames by a shared (dx, dy) delta in cm (group move). */
export function moveFrames(
  ids: readonly string[],
  dx: number,
  dy: number,
): Command {
  const set = new Set(ids);
  return (p) => ({
    ...p,
    frames: p.frames.map((f) =>
      set.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f,
    ),
  });
}

/** Sets the absolute position of a single frame (used after a snapped move). */
export function setFramePosition(id: string, x: number, y: number): Command {
  return (p) => ({
    ...p,
    frames: p.frames.map((f) => (f.id === id ? { ...f, x, y } : f)),
  });
}

/**
 * Applies a partial patch to one or more frames. This is the generic
 * property-change command backing recolor / resize / thickness / passpartout
 * edits across single or multi selections.
 */
export function updateFrames(
  ids: readonly string[],
  patch: Partial<Omit<Frame, "id">>,
): Command {
  const set = new Set(ids);
  return (p) => ({
    ...p,
    frames: p.frames.map((f) => (set.has(f.id) ? { ...f, ...patch } : f)),
  });
}

/** Recolors the given frames. */
export function recolorFrames(ids: readonly string[], hex: string): Command {
  return updateFrames(ids, { color: hex });
}

/** Sets rotation (90° steps) for a single frame. */
export function rotateFrame(id: string, rotation: Rotation): Command {
  return updateFrames([id], { rotation });
}

/** Rotates each given frame by a relative delta (90° steps), wrapping 0–270. */
export function rotateFramesBy(ids: readonly string[], delta: number): Command {
  const set = new Set(ids);
  return (p) => ({
    ...p,
    frames: p.frames.map((f) =>
      set.has(f.id)
        ? { ...f, rotation: ((((f.rotation + delta) % 360) + 360) % 360) as Rotation }
        : f,
    ),
  });
}

/**
 * Places (or replaces) a photo in a frame and re-derives the frame's
 * orientation from the photo: if the photo's orientation differs from the
 * frame's aperture orientation, the aperture's width/height are swapped so a
 * landscape photo sits in a landscape frame (and portrait in portrait), and any
 * manual rotation is cleared. A photo placed always re-derives orientation;
 * subsequent manual rotation overrides it (see DESIGN.md → Frame orientation).
 */
export function placePhotoInFrame(frameId: string, photoId: string): Command {
  return (p) => {
    const photo = p.photos.find((ph) => ph.id === photoId);
    return {
      ...p,
      frames: p.frames.map((f) => {
        if (f.id !== frameId) return f;
        if (!photo) return { ...f, photoId };
        const photoOrientation = orientationFromPixels(
          photo.pixelWidth,
          photo.pixelHeight,
        );
        const apertureOrientation =
          f.aperture.width > f.aperture.height ? "landscape" : "portrait";
        if (photoOrientation === apertureOrientation) {
          return { ...f, photoId };
        }
        return {
          ...f,
          photoId,
          aperture: { width: f.aperture.height, height: f.aperture.width },
          rotation: 0,
        };
      }),
    };
  };
}

/** Adds a photo to the project. */
export function addPhoto(photo: Photo): Command {
  return (p) => ({ ...p, photos: [...p.photos, photo] });
}

/**
 * Removes a photo and empties every frame that referenced it (reverts those
 * frames to empty placeholders).
 */
export function removePhoto(photoId: string): Command {
  return (p) => ({
    ...p,
    photos: p.photos.filter((ph) => ph.id !== photoId),
    frames: p.frames.map((f) =>
      f.photoId === photoId ? { ...f, photoId: null } : f,
    ),
  });
}

/** Applies a partial patch to the wall settings. */
export function updateWall(patch: Partial<WallSettings>): Command {
  return (p) => ({ ...p, wall: { ...p.wall, ...patch } });
}

/** Registers a custom color in the project's embedded list (idempotent by id). */
export function addCustomColor(color: FrameColor): Command {
  return (p) =>
    p.customColors.some((c) => c.id === color.id)
      ? p
      : { ...p, customColors: [...p.customColors, color] };
}
