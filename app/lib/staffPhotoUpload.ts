import "server-only";
import { randomUUID } from "node:crypto";
import { detectImageKind, MAX_IMAGE_BYTES, mimeMatchesKind, safeObjectPath } from "./staffPhotoCore";

export async function inspectImage(entry: FormDataEntryValue | null, purpose: "daily" | "issue") {
  if (!(entry instanceof File) || entry.size === 0) return { error: "Please choose a photo." } as const;
  if (entry.size > MAX_IMAGE_BYTES) return { error: "Photo must be 5 MB or smaller." } as const;
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind || !mimeMatchesKind(entry.type, kind)) return { error: "Use a real JPG, PNG, or WebP image." } as const;
  const id = randomUUID();
  return { id, bytes, kind, mime: entry.type, size: entry.size, originalName: entry.name.slice(0, 120), objectPath: safeObjectPath(kind, purpose, id) } as const;
}
