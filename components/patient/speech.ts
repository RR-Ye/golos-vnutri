// Что говорит экран бабушки: тексты на двух языках для очереди озвучки.
import {
  framePhrase,
  hypothesisQuestion,
  resolveSlots,
  slotQuestion,
  topicQuestion,
  type Candidate,
  type NlgOptions,
  type Question,
} from "@/engine";
import { TEMPLATES, frameById, topicById } from "@/engine/ontology";
import type { Bilingual, Entity, Lang, TopicId } from "@/engine/types";
import type { SoundCategory } from "@/lib/db/types";
import type { SoundItem } from "@/lib/audio/sound";
import { kk, ru } from "@/lib/i18n";

const TOPIC_CATEGORY: Partial<Record<TopicId, SoundCategory>> = {
  needs: "needs",
  health: "health",
  people: "people",
  feelings: "feelings",
  things: "things",
  places: "places",
};

const ENTITY_CATEGORY: Record<string, SoundCategory> = {
  person: "people",
  place: "places",
  thing: "things",
  food: "food",
  medicine: "medicine",
  bodypart: "health",
  severity: "health",
  action: "needs",
  event: "phrases",
};

export function frameCategory(frameId: string): SoundCategory {
  const f = frameById(frameId);
  return (f && TOPIC_CATEGORY[f.topic]) ?? "phrases";
}

export function topicItem(topic: TopicId): SoundItem {
  const t = topicById(topic);
  return { text: t?.name ?? { ru: topic, kk: topic }, category: TOPIC_CATEGORY[topic] ?? "prompts" };
}

export function entityItem(e: Entity): SoundItem {
  return { text: e.name, audio: e.audio, mode: e.soundMode, develop: e.develop, category: ENTITY_CATEGORY[e.type] ?? "things" };
}

function both(fn: (lang: Lang) => string): Bilingual {
  return { ru: fn("ru"), kk: fn("kk") };
}

/** Фраза от её лица («Я хочу пить.» / «Мен су ішкім келеді.»). */
export function candidateText(c: Candidate, entities: ReadonlyMap<string, Entity>, opts: NlgOptions): Bilingual {
  return both((lang) => framePhrase(c.frame, resolveSlots(c, entities), "say", lang, opts).text);
}

/** Записи голосом для фраз без имён и вещей: ключ "<frame>:say:<lang>". */
export type PhraseAudio = ReadonlyMap<string, string>;

export function candidateItem(
  c: Candidate,
  entities: ReadonlyMap<string, Entity>,
  opts: NlgOptions,
  category?: SoundCategory,
  phraseAudio?: PhraseAudio,
): SoundItem {
  const slotless = Object.values(c.slots).every((v) => !v);
  const audio = slotless && phraseAudio
    ? { ru: phraseAudio.get(`${c.frame}:say:ru`), kk: phraseAudio.get(`${c.frame}:say:kk`) }
    : undefined;
  return { text: candidateText(c, entities, opts), category: category ?? frameCategory(c.frame), audio };
}

/** Есть ли у мысли обязательный слот, который ещё не выбран (кроме силы боли). */
export function frameNeedsChoice(frameId: string): boolean {
  return !!frameById(frameId)?.slots.some((s) => !s.optional && !s.types.includes("severity"));
}

/** Короткая подпись мысли на двух языках. */
export function frameLabels(frameId: string, opts: NlgOptions): Bilingual {
  const ruLabel = TEMPLATES.ru.frames[frameId]?.label;
  const kkLabel = TEMPLATES.kk.frames[frameId]?.label;
  if (frameNeedsChoice(frameId)) return { ru: ruLabel ?? frameId, kk: kkLabel ?? ruLabel ?? frameId };
  return both((lang) => framePhrase(frameId, {}, "say", lang, opts).text.replace(/[.!]$/, ""));
}

/** Плитка мысли звучит полной фразой, а если нужно выбрать кого/что — подписью. */
export function frameTileItem(frameId: string, opts: NlgOptions, phraseAudio?: ReadonlyMap<string, string>): SoundItem {
  if (frameNeedsChoice(frameId)) return { text: frameLabels(frameId, opts), category: frameCategory(frameId) };
  const audio = phraseAudio ? { ru: phraseAudio.get(`${frameId}:say:ru`), kk: phraseAudio.get(`${frameId}:say:kk`) } : undefined;
  return { text: both((lang) => framePhrase(frameId, {}, "say", lang, opts).text), category: frameCategory(frameId), audio };
}

export function questionText(q: Question, entities: ReadonlyMap<string, Entity>, opts: NlgOptions): Bilingual {
  if (q.level === "topic") return both((lang) => topicQuestion(q.topic, lang, opts));
  if (q.level === "slot") {
    const e = entities.get(q.entity);
    return e ? both((lang) => slotQuestion(e, lang, opts)) : { ru: "", kk: "" };
  }
  return both((lang) => hypothesisQuestion(q.candidate, entities, lang, opts));
}

type PatientKey = keyof typeof ru.patient;

/** Подсказка экрана бабушки на двух языках (вопросы и подсказки звучат на основном). */
export function promptItem(key: PatientKey): SoundItem {
  return { text: { ru: String(ru.patient[key]), kk: String(kk.patient[key]) }, category: "prompts" };
}

export function textItem(text: Bilingual, category: SoundCategory = "prompts"): SoundItem {
  return { text, category };
}
