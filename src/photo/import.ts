import { newId } from "../state/ids";
import type { Photo } from "../model/types";

/** Max thumbnail edge in pixels (used for panel + Bill of Materials). */
export const THUMBNAIL_MAX = 256;

/** Thrown when a file can't be imported (unsupported / undecodable). */
export class PhotoImportError extends Error {}

const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

/**
 * Whether a file looks like a supported image by MIME or extension. HEIC/HEIF
 * is only *attempted*; whether it actually decodes depends on the browser
 * (Safari yes, most others no) — decode failure is reported separately.
 */
export function isLikelySupported(file: { type: string; name: string }): boolean {
  if (SUPPORTED_MIME.has(file.type)) return true;
  return /\.(jpe?g|png|heic|heif)$/i.test(file.name);
}

/** Computes thumbnail dimensions, preserving aspect ratio, never upscaling. */
export function thumbnailSize(
  width: number,
  height: number,
  max = THUMBNAIL_MAX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = longest > 0 ? Math.min(1, max / longest) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Output encoding for the full-resolution stored image. */
function encodingFor(file: File): { mime: string; quality?: number } {
  if (file.type === "image/png") return { mime: "image/png" };
  return { mime: "image/jpeg", quality: 0.9 };
}

/**
 * Decodes a file to an ImageBitmap with EXIF orientation **applied** so the
 * resulting pixels are upright. Throws PhotoImportError if the browser can't
 * decode it (e.g. HEIC without native support).
 */
async function decodeUpright(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new PhotoImportError("Image decoding is not supported in this browser");
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoImportError(
      `Could not decode "${file.name}" — this format may be unsupported by your browser`,
    );
  }
}

/** Draws a source image onto a canvas at the given size and returns a data URL. */
function rasterToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  mime: string,
  quality?: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoImportError("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL(mime, quality);
}

/**
 * Imports a single image file into a Photo: upright pixels (EXIF applied),
 * original dimensions/orientation, a full-res data URL, and a thumbnail.
 */
export async function importPhotoFile(file: File): Promise<Photo> {
  if (!isLikelySupported(file)) {
    throw new PhotoImportError(`Unsupported file type: "${file.name}"`);
  }
  const bitmap = await decodeUpright(file);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const enc = encodingFor(file);
    const dataUrl = rasterToDataUrl(bitmap, width, height, enc.mime, enc.quality);
    const ts = thumbnailSize(width, height);
    const thumbnailDataUrl = rasterToDataUrl(
      bitmap,
      ts.width,
      ts.height,
      "image/jpeg",
      0.7,
    );
    return {
      id: newId("photo"),
      name: file.name,
      dataUrl,
      thumbnailDataUrl,
      pixelWidth: width,
      pixelHeight: height,
    };
  } finally {
    bitmap.close();
  }
}

export interface ImportResult {
  photos: Photo[];
  errors: string[];
}

/** Imports many files, collecting successes and human-readable errors. */
export async function importPhotoFiles(
  files: Iterable<File>,
): Promise<ImportResult> {
  const photos: Photo[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      photos.push(await importPhotoFile(file));
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : `Failed to import ${file.name}`,
      );
    }
  }
  return { photos, errors };
}
