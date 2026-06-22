import { defaultWallSettings, PROJECT_VERSION } from "../model/defaults";
import type {
  Frame,
  FrameColor,
  PasspartoutSize,
  Photo,
  Project,
  Rotation,
  WallSettings,
} from "../model/types";

/** Thrown when a JSON payload can't be parsed/validated into a Project. */
export class ProjectParseError extends Error {}

export interface SerializeOptions {
  /**
   * Whether to embed photo image data (data URLs). True for the explicit JSON
   * **Save** (portable round-trip). False for **localStorage auto-save**, which
   * stores only the layout — no images (see DESIGN.md → Persistence).
   */
  embedImages?: boolean;
}

/**
 * Serializes a project to JSON. With `embedImages` (default) it embeds photo
 * data URLs and only the custom colors used by frames. Without it, the `photos`
 * array is dropped and every frame's `photoId` is cleared, so only frames + the
 * wall/layout configuration are stored (frames that held a photo restore as
 * empty placeholders).
 */
export function serializeProject(
  project: Project,
  options: SerializeOptions = {},
): string {
  const { embedImages = true } = options;
  const usedHexes = new Set(project.frames.map((f) => f.color));
  const customColors = project.customColors.filter((c) => usedHexes.has(c.hex));
  const photos = embedImages ? project.photos : [];
  const frames = embedImages
    ? project.frames
    : project.frames.map((f) => ({ ...f, photoId: null }));
  return JSON.stringify({ ...project, photos, frames, customColors }, null, 0);
}

// ---- Validation helpers ----

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function parseRotation(v: unknown): Rotation {
  return v === 90 || v === 180 || v === 270 ? v : 0;
}

function parsePasspartout(v: unknown): PasspartoutSize | null {
  if (!isObj(v)) return null;
  return {
    id: str(v.id, "pp"),
    name: str(v.name, "pp"),
    width: num(v.width, 0),
    height: num(v.height, 0),
  };
}

function parseFrame(v: unknown): Frame {
  if (!isObj(v)) throw new ProjectParseError("Invalid frame");
  const ap = isObj(v.aperture) ? v.aperture : {};
  return {
    id: str(v.id, ""),
    x: num(v.x, 0),
    y: num(v.y, 0),
    aperture: { width: num(ap.width, 21), height: num(ap.height, 29.7) },
    standardSizeId: typeof v.standardSizeId === "string" ? v.standardSizeId : null,
    thickness: num(v.thickness, 1),
    passpartout: v.passpartout ? parsePasspartout(v.passpartout) : null,
    color: str(v.color, "#1a1a1a"),
    rotation: parseRotation(v.rotation),
    photoId: typeof v.photoId === "string" ? v.photoId : null,
  };
}

function parsePhoto(v: unknown): Photo {
  if (!isObj(v)) throw new ProjectParseError("Invalid photo");
  return {
    id: str(v.id, ""),
    name: str(v.name, "photo"),
    dataUrl: str(v.dataUrl, ""),
    thumbnailDataUrl: str(v.thumbnailDataUrl, str(v.dataUrl, "")),
    pixelWidth: num(v.pixelWidth, 0),
    pixelHeight: num(v.pixelHeight, 0),
  };
}

function parseColor(v: unknown): FrameColor | null {
  if (!isObj(v)) return null;
  return { id: str(v.id, "c"), label: str(v.label, "Custom"), hex: str(v.hex, "#000000") };
}

function parseWall(v: unknown): WallSettings {
  const fallback = defaultWallSettings();
  if (!isObj(v)) return fallback;
  const sizes = Array.isArray(v.standardSizes)
    ? v.standardSizes
        .filter(isObj)
        .map((s) => ({
          id: str(s.id, ""),
          name: str(s.name, ""),
          width: num(s.width, 0),
          height: num(s.height, 0),
        }))
    : fallback.standardSizes;
  const ppRaw = isObj(v.passpartoutOptions) ? v.passpartoutOptions : {};
  const passpartoutOptions: Record<string, PasspartoutSize[]> = {};
  for (const [key, list] of Object.entries(ppRaw)) {
    if (Array.isArray(list)) {
      passpartoutOptions[key] = list
        .map(parsePasspartout)
        .filter((p): p is PasspartoutSize => p !== null);
    }
  }
  return {
    width: num(v.width, fallback.width),
    height: num(v.height, fallback.height),
    color: str(v.color, fallback.color),
    standardSizes: sizes,
    passpartoutOptions:
      Object.keys(passpartoutOptions).length > 0
        ? passpartoutOptions
        : fallback.passpartoutOptions,
  };
}

/** Parses + validates a JSON string into a Project (lenient, with defaults). */
export function deserializeProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ProjectParseError("File is not valid JSON");
  }
  if (!isObj(raw)) throw new ProjectParseError("Not a valid project file");
  if (!Array.isArray(raw.frames) || !Array.isArray(raw.photos)) {
    throw new ProjectParseError("Project file is missing frames/photos");
  }
  return {
    version: num(raw.version, PROJECT_VERSION),
    wall: parseWall(raw.wall),
    photos: raw.photos.map(parsePhoto),
    frames: raw.frames.map(parseFrame),
    customColors: Array.isArray(raw.customColors)
      ? raw.customColors.map(parseColor).filter((c): c is FrameColor => c !== null)
      : [],
  };
}
