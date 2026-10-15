import Dexie, { type EntityTable } from "dexie";
import type { DayNote, Entity, RoutineItem, WordEntry } from "@/engine/types";
import type {
  HistoryMessage,
  LearnedState,
  MediaRecord,
  PracticeState,
  SampleRecord,
  Settings,
  SpeechAttempt,
  TemplateOverride,
} from "./types";

export class GolosDB extends Dexie {
  settings!: EntityTable<Settings, "id">;
  entities!: EntityTable<Entity, "id">;
  words!: EntityTable<WordEntry, "id">;
  samples!: EntityTable<SampleRecord, "id">;
  media!: EntityTable<MediaRecord, "id">;
  notes!: EntityTable<DayNote, "id">;
  routine!: EntityTable<RoutineItem, "id">;
  overrides!: EntityTable<TemplateOverride, "key">;
  history!: EntityTable<HistoryMessage, "id">;
  attempts!: EntityTable<SpeechAttempt, "id">;
  learned!: EntityTable<LearnedState, "id">;
  practice!: EntityTable<PracticeState, "key">;

  constructor(name = "golos-vnutri") {
    super(name);
    this.version(1).stores({
      settings: "id",
      entities: "id, type, order",
      words: "id, lang, text",
      samples: "id, wordId",
      media: "id, kind",
      notes: "id, until",
      routine: "id, band",
      overrides: "key",
      history: "id, at",
      attempts: "id, at, wordId",
      learned: "id",
      practice: "key, due",
    });
  }
}

let instance: GolosDB | null = null;

export function db(): GolosDB {
  if (!instance) instance = new GolosDB();
  return instance;
}

/** Только для тестов: подменить базу. */
export function setDbForTests(next: GolosDB): void {
  instance = next;
}

export const TABLES = [
  "settings",
  "entities",
  "words",
  "samples",
  "media",
  "notes",
  "routine",
  "overrides",
  "history",
  "attempts",
  "learned",
  "practice",
] as const;

export type TableName = (typeof TABLES)[number];

export function newId(prefix: string): string {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}${rnd[0]!.toString(36)}${rnd[1]!.toString(36)}`;
}
