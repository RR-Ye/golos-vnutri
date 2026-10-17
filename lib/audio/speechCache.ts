// Синтезированные фразы на устройстве: частые фразы звучат сразу и всегда одинаково
// (синтез каждый раз чуть разный по темпу). Отдельная база — это кэш, не данные:
// в резервную копию не входит, при сбросе стирается вместе со всем.
import Dexie, { type EntityTable } from "dexie";

interface Clip {
  key: string;
  pcm: Int16Array;
  rate: number;
  usedAt: number;
}

class SpeechCacheDB extends Dexie {
  clips!: EntityTable<Clip, "key">;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ clips: "key, usedAt" });
  }
}

/** Около 400 фраз — до 30 МБ. */
export const SPEECH_CACHE_LIMIT = 400;

let instance: SpeechCacheDB | null = null;
const cdb = () => (instance ??= new SpeechCacheDB("golos-speech-cache"));

/** Только для тестов. */
export function setSpeechCacheForTests(name: string): void {
  instance = new SpeechCacheDB(name);
}

export async function loadClip(key: string): Promise<{ pcm: Float32Array; rate: number } | null> {
  try {
    const c = await cdb().clips.get(key);
    if (!c) return null;
    void cdb().clips.update(key, { usedAt: Date.now() });
    return { pcm: Float32Array.from(c.pcm, (x) => x / 32767), rate: c.rate };
  } catch {
    return null;
  }
}

export async function saveClip(key: string, pcm: Float32Array, rate: number): Promise<void> {
  try {
    const int = Int16Array.from(pcm, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767));
    await cdb().clips.put({ key, pcm: int, rate, usedAt: Date.now() });
    const extra = (await cdb().clips.count()) - SPEECH_CACHE_LIMIT;
    if (extra > 0) await cdb().clips.orderBy("usedAt").limit(extra).delete();
  } catch {
    /* нет места — просто не кэшируем */
  }
}

export async function clearSpeechCache(): Promise<void> {
  try {
    await cdb().clips.clear();
  } catch {
    /* базы ещё нет */
  }
}
