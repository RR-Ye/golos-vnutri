import { clearSpeechCache } from "@/lib/audio/speechCache";
import { db, TABLES } from "./index";
import { demoEntities, demoNotes, demoRoutine, demoSettings, demoWords } from "./demo";
import { defaultSettings, makePinRecord } from "./settings";

export async function wipeAll(): Promise<void> {
  const d = db();
  await d.transaction("rw", TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) await d.table(t).clear();
  });
  await clearSpeechCache();
}

export async function setupEmpty(pin: string): Promise<void> {
  await wipeAll();
  await db().settings.put({ ...defaultSettings(), ...(await makePinRecord(pin)) });
}

export async function setupDemo(pin: string): Promise<void> {
  await wipeAll();
  const d = db();
  const pinRecord = await makePinRecord(pin);
  await d.transaction("rw", [d.settings, d.entities, d.words, d.routine, d.notes], async () => {
    await d.settings.put(demoSettings(pinRecord));
    await d.entities.bulkPut(demoEntities());
    await d.words.bulkPut(demoWords());
    await d.routine.bulkPut(demoRoutine());
    await d.notes.bulkPut(demoNotes());
  });
}
