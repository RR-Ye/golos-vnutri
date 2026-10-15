import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, GolosDB, setDbForTests } from "@/lib/db";
import { setupDemo } from "@/lib/db/seed";
import { exportBackup, importBackup } from "./backup";

describe("резервная копия", () => {
  it("всё возвращается из файла: анкета, слова, медиа, признаки", async () => {
    setDbForTests(new GolosDB("backup-test"));
    await setupDemo("1234");
    await db().media.put({ id: "aud_1", kind: "audio", blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/wav" }), mime: "audio/wav", createdAt: 1 });
    await db().samples.put({ id: "s1", wordId: "w.su", mediaId: "aud_1", features: Float32Array.from([0.5, -1.25, 3]), nFrames: 1, dims: 3, durationMs: 10, createdAt: 1 });
    const before = { entities: await db().entities.count(), words: await db().words.count(), settings: await db().settings.get("main") };

    const file = await exportBackup();
    await db().entities.clear();
    await db().media.clear();
    await db().samples.clear();
    await importBackup(file);

    expect(await db().entities.count()).toBe(before.entities);
    expect(await db().words.count()).toBe(before.words);
    expect((await db().settings.get("main"))?.pinHash).toBe(before.settings?.pinHash);
    const s = await db().samples.get("s1");
    expect(s?.features).toBeInstanceOf(Float32Array);
    expect(Array.from(s!.features!)).toEqual([0.5, -1.25, 3]);
    const m = await db().media.get("aud_1");
    expect(new Uint8Array(await m!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("чужой файл отклоняется", async () => {
    await expect(importBackup(new Blob(["not a zip"]))).rejects.toThrow();
  });
});
