// Persistent file storage backed by the store's existing MySQL database.
// No Manus/Forge credentials or external storage account are required.

import { randomUUID } from "node:crypto";
import { getStoredMedia, saveStoredMedia } from "./db";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await saveStoredMedia({
    storageKey: key,
    contentType,
    dataBase64: buffer.toString("base64"),
  });
  return { key, url: `/api/media/${encodeURIComponent(key)}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/media/${encodeURIComponent(key)}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return (await storageGet(relKey)).url;
}

export async function readStoredMedia(key: string) {
  return getStoredMedia(normalizeKey(key));
}
