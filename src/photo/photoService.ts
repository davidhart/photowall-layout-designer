import { addPhoto } from "../state/commands";
import type { Store } from "../state/store";
import type { Photo } from "../model/types";
import { importPhotoFiles } from "./import";

/**
 * Imports image files and adds each successfully decoded photo to the project
 * (one undoable command per photo). Returns the added photos and any
 * human-readable import errors so the caller can surface them.
 */
export async function importAndAddPhotos(
  store: Store,
  files: Iterable<File>,
): Promise<{ added: Photo[]; errors: string[] }> {
  const { photos, errors } = await importPhotoFiles(files);
  for (const photo of photos) {
    store.dispatch(addPhoto(photo));
  }
  return { added: photos, errors };
}
