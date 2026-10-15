"use client";

// Резервная копия: все таблицы и медиа одним zip-файлом (.golos).
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { db, TABLES } from "@/lib/db";

const FORMAT = "golos-vnutri-backup";
const VERSION = 1;

const extOf = (mime: string) => (mime.includes("wav") ? "wav" : mime.includes("jpeg") ? "jpg" : mime.includes("png") ? "png" : "bin");

/** Float32Array не переживает JSON — кладём как массив чисел с пометкой. */
function encodeValue(v: unknown): unknown {
  if (v instanceof Float32Array) return { __f32: Array.from(v) };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (v && typeof v === "object" && !(v instanceof Blob)) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x)]));
  }
  return v;
}

function decodeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decodeValue);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.__f32)) return Float32Array.from(o.__f32 as number[]);
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, decodeValue(x)]));
  }
  return v;
}

export async function exportBackup(): Promise<Blob> {
  const d = db();
  const tables: Record<string, unknown[]> = {};
  const files: Zippable = {};
  for (const name of TABLES) {
    if (name === "media") continue;
    tables[name] = (await d.table(name).toArray()).map(encodeValue);
  }
  const media = await d.media.toArray();
  tables.media = media.map((m) => ({ id: m.id, kind: m.kind, mime: m.mime, createdAt: m.createdAt, file: `media/${m.id}.${extOf(m.mime)}` }));
  for (const m of media) files[`media/${m.id}.${extOf(m.mime)}`] = [new Uint8Array(await m.blob.arrayBuffer()), { level: 0 }];
  files["data.json"] = strToU8(JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: Date.now(), tables }));
  const zipped = zipSync(files);
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

export class BackupFormatError extends Error {}

export async function importBackup(file: Blob): Promise<void> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const raw = entries["data.json"];
  if (!raw) throw new BackupFormatError("нет data.json");
  const data = JSON.parse(strFromU8(raw)) as { format?: string; tables?: Record<string, unknown[]> };
  if (data.format !== FORMAT || !data.tables) throw new BackupFormatError("чужой формат");
  const d = db();
  await d.transaction("rw", TABLES.map((t) => d.table(t)), async () => {
    for (const name of TABLES) await d.table(name).clear();
    for (const name of TABLES) {
      const rows = data.tables![name] ?? [];
      if (name === "media") {
        for (const r of rows as { id: string; kind: "photo" | "audio"; mime: string; createdAt: number; file: string }[]) {
          const bytes = entries[r.file];
          if (!bytes) continue;
          await d.media.put({ id: r.id, kind: r.kind, mime: r.mime, createdAt: r.createdAt, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: r.mime }) });
        }
      } else if (rows.length) {
        await d.table(name).bulkPut(rows.map(decodeValue));
      }
    }
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
