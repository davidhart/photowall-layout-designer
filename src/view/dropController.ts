import { createEmptyFrame, createFrameForPhoto } from "../model/frameFactory";
import { importAndAddPhotos } from "../photo/photoService";
import { addFrame, placePhotoInFrame } from "../state/commands";
import type { Store } from "../state/store";
import { DND_FRAME_SIZE } from "../ui/dnd";
import { pxToCm } from "./viewport";

/** Cascade offset (cm) between frames created from a multi-photo drop. */
const CASCADE = 4;

/**
 * Wires drag-and-drop onto the wall:
 * - Filesystem files → wall: import + create a frame per photo (or fill a
 *   targeted frame with the first photo).
 * - Standard/custom frame template → wall: create an empty placeholder.
 */
export class DropController {
  constructor(
    private readonly wall: HTMLElement,
    private readonly store: Store,
    private readonly onErrors: (errors: string[]) => void = () => {},
  ) {
    this.attachWall();
  }

  private attachWall(): void {
    this.wall.addEventListener("dragover", this.allowDrop);
    this.wall.addEventListener("drop", this.onDrop);
  }

  private allowDrop = (event: DragEvent): void => {
    if (!event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  private dropPointCm(event: DragEvent): { x: number; y: number } {
    const rect = this.wall.getBoundingClientRect();
    const vb = this.store.getUI().viewBox;
    if (!vb) return { x: 0, y: 0 };
    return pxToCm(
      vb,
      rect.width,
      rect.height,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }

  private targetFrameId(event: DragEvent): string | null {
    const el = (event.target as Element | null)?.closest("[data-frame-id]");
    return el?.getAttribute("data-frame-id") ?? null;
  }

  private onDrop = (event: DragEvent): void => {
    const dt = event.dataTransfer;
    if (!dt) return;
    event.preventDefault();

    const frameId = this.targetFrameId(event);
    const point = this.dropPointCm(event);

    // 1) Filesystem files.
    if (dt.files && dt.files.length > 0) {
      const files = dt.files;
      void importAndAddPhotos(this.store, files).then(({ added, errors }) => {
        if (errors.length) this.onErrors(errors);
        if (added.length === 0) return;
        if (frameId) {
          // Fill/replace the targeted frame with the first imported photo,
          // orienting the frame to the photo.
          this.store.dispatch(placePhotoInFrame(frameId, added[0]!.id));
        } else {
          added.forEach((photo, i) =>
            this.createPhotoFrame(photo.id, point.x + i * CASCADE, point.y + i * CASCADE),
          );
        }
      });
      return;
    }

    // 2) Standard / custom empty frame dragged from the Frames tab.
    const sizeId = dt.getData(DND_FRAME_SIZE);
    if (sizeId) {
      const { wall } = this.store.getProject();
      const color = this.store.getUI().lastFrameColor;
      const frame = createEmptyFrame(sizeId, wall, color, point.x, point.y);
      this.store.dispatch(addFrame(frame));
    }
  };

  private createPhotoFrame(photoId: string, x: number, y: number): void {
    const project = this.store.getProject();
    const photo = project.photos.find((p) => p.id === photoId);
    if (!photo) return;
    const color = this.store.getUI().lastFrameColor;
    this.store.dispatch(addFrame(createFrameForPhoto(photo, project.wall, color, x, y)));
  }
}
