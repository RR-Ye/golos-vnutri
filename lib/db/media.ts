"use client";

import { useEffect, useState } from "react";
import { db, newId } from "./index";
import type { MediaRecord } from "./types";

export async function putMedia(blob: Blob, kind: MediaRecord["kind"]): Promise<string> {
  const id = newId(kind === "photo" ? "img" : "aud");
  await db().media.put({ id, kind, blob, mime: blob.type, createdAt: Date.now() });
  return id;
}

export async function deleteMedia(id: string | undefined | null): Promise<void> {
  if (id) await db().media.delete(id);
}

/** URL объекта для медиа из хранилища; освобождается при размонтировании. */
export function useMediaUrl(id: string | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    setUrl(null);
    if (!id) return;
    void db()
      .media.get(id)
      .then((rec) => {
        if (!alive || !rec) return;
        made = URL.createObjectURL(rec.blob);
        setUrl(made);
      });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}

/** Уменьшает фото на устройстве: длинная сторона не больше maxSide, JPEG. */
export async function resizePhoto(file: Blob, maxSide = 720): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d недоступен");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("не удалось сжать фото"))), "image/jpeg", 0.85),
  );
}
