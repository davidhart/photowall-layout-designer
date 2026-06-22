import { effectivePrintSize } from "../model/geometry";
import type { Project } from "../model/types";

/** A photo to print, at a given effective print size, with a quantity. */
export interface PrintItem {
  photoId: string;
  name: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  quantity: number;
}

/** A frame size to buy, with a quantity. */
export interface FrameItem {
  label: string;
  width: number;
  height: number;
  quantity: number;
}

/** A passpartout to buy, with a quantity. */
export interface PasspartoutItem {
  label: string;
  width: number;
  height: number;
  quantity: number;
}

export interface BillOfMaterials {
  prints: PrintItem[];
  frames: FrameItem[];
  passpartouts: PasspartoutItem[];
}

/** Rounds a cm value to 1 decimal for stable grouping + display. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Aggregates a project into a purchasing/printing report: photos to print at
 * their effective print size, frame sizes to buy, and passpartouts to buy.
 */
export function buildBillOfMaterials(project: Project): BillOfMaterials {
  const photosById = new Map(project.photos.map((p) => [p.id, p]));
  const sizeNameById = new Map(
    project.wall.standardSizes.map((s) => [s.id, s.name]),
  );

  const prints = new Map<string, PrintItem>();
  const frames = new Map<string, FrameItem>();
  const passpartouts = new Map<string, PasspartoutItem>();

  for (const frame of project.frames) {
    // --- Frames to buy ---
    const fw = round1(frame.aperture.width);
    const fh = round1(frame.aperture.height);
    const frameLabel = frame.standardSizeId
      ? sizeNameById.get(frame.standardSizeId) ?? frame.standardSizeId
      : `Custom ${fw}×${fh} cm`;
    const frameKey = `${frameLabel}|${fw}x${fh}`;
    const fExisting = frames.get(frameKey);
    if (fExisting) fExisting.quantity += 1;
    else frames.set(frameKey, { label: frameLabel, width: fw, height: fh, quantity: 1 });

    // --- Passpartouts to buy ---
    if (frame.passpartout) {
      const pw = round1(frame.passpartout.width);
      const ph = round1(frame.passpartout.height);
      const ppKey = `${frame.passpartout.name}|${pw}x${ph}`;
      const ppExisting = passpartouts.get(ppKey);
      if (ppExisting) ppExisting.quantity += 1;
      else
        passpartouts.set(ppKey, {
          label: frame.passpartout.name,
          width: pw,
          height: ph,
          quantity: 1,
        });
    }

    // --- Photos to print (only frames that contain a photo) ---
    if (frame.photoId) {
      const photo = photosById.get(frame.photoId);
      if (photo) {
        const print = effectivePrintSize(frame);
        const w = round1(print.width);
        const h = round1(print.height);
        const printKey = `${photo.id}|${w}x${h}`;
        const existing = prints.get(printKey);
        if (existing) existing.quantity += 1;
        else
          prints.set(printKey, {
            photoId: photo.id,
            name: photo.name,
            thumbnailDataUrl: photo.thumbnailDataUrl || photo.dataUrl,
            width: w,
            height: h,
            quantity: 1,
          });
      }
    }
  }

  return {
    prints: [...prints.values()],
    frames: [...frames.values()],
    passpartouts: [...passpartouts.values()],
  };
}
