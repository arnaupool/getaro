import { supabaseConfig } from "./config";

export const ROOM_IMAGES_BUCKET = "room-images";

/** URL pública de la foto de una sala (solo servidor; la base sale de la config en tiempo de ejecución) */
export function roomImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseConfig().url}/storage/v1/object/public/${ROOM_IMAGES_BUCKET}/${path}`;
}
