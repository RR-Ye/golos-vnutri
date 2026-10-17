import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { clearSpeechCache, loadClip, saveClip, SPEECH_CACHE_LIMIT, setSpeechCacheForTests } from "./speechCache";

describe("кэш синтезированных фраз", () => {
  it("возвращает сохранённый звук с той же частотой", async () => {
    setSpeechCacheForTests("speech-cache-1");
    await saveClip("ru|Я хочу пить.", Float32Array.from([0, 0.5, -0.5, 1, -1]), 22050);
    const c = await loadClip("ru|Я хочу пить.");
    expect(c?.rate).toBe(22050);
    expect(Array.from(c!.pcm).map((x) => Math.round(x * 100) / 100)).toEqual([0, 0.5, -0.5, 1, -1]);
    expect(await loadClip("ru|другая")).toBeNull();
  });

  it("хранит не больше предела, вытесняя давно не звучавшие", async () => {
    setSpeechCacheForTests("speech-cache-2");
    for (let i = 0; i < SPEECH_CACHE_LIMIT + 5; i++) await saveClip(`k${i}`, Float32Array.from([0.1]), 16000);
    expect(await loadClip("k0")).toBeNull();
    expect(await loadClip(`k${SPEECH_CACHE_LIMIT + 4}`)).not.toBeNull();
    await clearSpeechCache();
    expect(await loadClip(`k${SPEECH_CACHE_LIMIT + 4}`)).toBeNull();
  });
});
