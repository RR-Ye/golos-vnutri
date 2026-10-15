// Онтология: фреймы, темы и встроенные сущности из JSON-данных с проверкой схемы.
import framesJson from "../data/frames.json" with { type: "json" };
import builtinsJson from "../data/builtins.json" with { type: "json" };
import templatesRu from "../data/templates.ru.json" with { type: "json" };
import templatesKk from "../data/templates.kk.json" with { type: "json" };
import type { Bilingual, Entity, EntityType, FrameDef, Lang, TopicId } from "../types";

export interface TopicInfo {
  id: TopicId;
  icon: string;
  name: Bilingual;
}

export interface BuiltinEntity extends Entity {
  /** Зона на силуэте (для частей тела). */
  zone?: string;
  side?: "front" | "back" | "both";
  /** Уровень силы боли 1–3. */
  level?: number;
  /** Относительный априорный вес (голова болит чаще, чем уши). */
  weight?: number;
}

export interface FrameTemplates {
  label?: string;
  say: string;
  ask: string;
  lead?: string;
  [variant: string]: string | undefined;
}

export interface TemplateSet {
  frames: Record<string, FrameTemplates>;
  topics: Record<TopicId, string>;
  slotAsk: Partial<Record<EntityType, string>>;
  connectives: Record<string, { join: string }>;
}

const ENTITY_TYPES: readonly EntityType[] = [
  "person",
  "place",
  "thing",
  "food",
  "medicine",
  "bodypart",
  "event",
  "action",
  "severity",
];

export class OntologyError extends Error {}

/** Проверяет фреймы: уникальные id, известные темы и типы слотов. */
export function validateFrames(frames: FrameDef[], topics: readonly TopicId[]): FrameDef[] {
  const seen = new Set<string>();
  for (const f of frames) {
    if (seen.has(f.id)) throw new OntologyError(`повторяется фрейм ${f.id}`);
    seen.add(f.id);
    if (!topics.includes(f.topic)) throw new OntologyError(`${f.id}: неизвестная тема ${f.topic}`);
    for (const t of f.alsoTopics ?? []) if (!topics.includes(t)) throw new OntologyError(`${f.id}: неизвестная тема ${t}`);
    if (!(f.prior > 0)) throw new OntologyError(`${f.id}: априор должен быть > 0`);
    const names = new Set<string>();
    for (const s of f.slots) {
      if (names.has(s.name)) throw new OntologyError(`${f.id}: повторяется слот ${s.name}`);
      names.add(s.name);
      for (const t of s.types) if (!ENTITY_TYPES.includes(t)) throw new OntologyError(`${f.id}: неизвестный тип ${t}`);
    }
  }
  return frames;
}

/** Проверяет, что у каждого фрейма есть шаблоны say и ask на обоих языках. */
export function validateTemplates(frames: FrameDef[], sets: Record<Lang, TemplateSet>): void {
  for (const lang of ["ru", "kk"] as const) {
    for (const f of frames) {
      const t = sets[lang].frames[f.id];
      if (!t?.say || !t.ask) throw new OntologyError(`${f.id}: нет шаблонов say/ask (${lang})`);
    }
  }
}

export const TOPICS: TopicInfo[] = builtinsJson.topics as TopicInfo[];
export const TOPIC_IDS: TopicId[] = TOPICS.map((t) => t.id);
export const FRAMES: FrameDef[] = validateFrames(framesJson.frames as FrameDef[], TOPIC_IDS);
export const BUILTIN_ENTITIES: BuiltinEntity[] = builtinsJson.entities as BuiltinEntity[];
export const TEMPLATES: Record<Lang, TemplateSet> = {
  ru: templatesRu as unknown as TemplateSet,
  kk: templatesKk as unknown as TemplateSet,
};
validateTemplates(FRAMES, TEMPLATES);

const frameIndex = new Map(FRAMES.map((f) => [f.id, f]));

export function frameById(id: string): FrameDef | undefined {
  return frameIndex.get(id);
}

export function topicById(id: TopicId): TopicInfo | undefined {
  return TOPICS.find((t) => t.id === id);
}

/** Короткое название мысли для экрана близких. */
export function frameLabel(id: string): string {
  return TEMPLATES.ru.frames[id]?.label ?? id;
}

/** Все темы фрейма: основная и дополнительные. */
export function frameTopics(f: FrameDef): TopicId[] {
  return [f.topic, ...(f.alsoTopics ?? [])];
}
