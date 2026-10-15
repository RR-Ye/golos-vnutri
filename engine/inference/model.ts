// Сборка модели: априоры фреймов по времени суток, веса сущностей, значения слов, шум ответов.
import likelihoodsJson from "../data/likelihoods.json" with { type: "json" };
import { BUILTIN_ENTITIES, FRAMES, frameTopics } from "../ontology/index.ts";
import type {
  DayNote,
  Entity,
  EntityType,
  FrameDef,
  MeaningTarget,
  RoutineItem,
  TimeBand,
  WordEntry,
} from "../types.ts";

export type Likelihoods = typeof likelihoodsJson;
export const LIKELIHOODS: Likelihoods = likelihoodsJson;

/** Накопленные счётчики обучения (форма совпадает с LearnedState в хранилище). */
export interface LearnedCounts {
  frameTime: Record<string, Partial<Record<TimeBand, number>>>;
  entityFreq: Record<string, number>;
  wordMeaning: Record<string, Record<string, number>>;
  answerErrors: [number, number];
}

export function emptyLearned(): LearnedCounts {
  return { frameTime: {}, entityFreq: {}, wordMeaning: {}, answerErrors: [0, 0] };
}

export interface EngineInput {
  entities: Entity[];
  words: WordEntry[];
  notes: DayNote[];
  routine: RoutineItem[];
  frameToggles?: Record<string, boolean>;
  learned?: LearnedCounts;
  now: number;
  /** Ручная вероятность ошибочного нажатия; null/undefined — по истории. */
  epsilon?: number | null;
  /** Сущности из уже подтверждённых предложений этого сообщения. */
  context?: string[];
  likelihoods?: Likelihoods;
}

export interface EffectiveWord {
  entry: WordEntry;
  meanings: { target: MeaningTarget; weight: number }[];
}

export interface EngineModel {
  frames: FrameDef[];
  frameIndex: Map<string, FrameDef>;
  entities: Map<string, Entity>;
  byType: Map<EntityType, Entity[]>;
  words: Map<string, EffectiveWord>;
  band: TimeBand;
  logFramePrior: Map<string, number>;
  /** Относительный вес сущности в априоре слота. */
  entityWeight: Map<string, number>;
  /** Сколько раз необязательный слот был заполнен или пуст (ключи slotUsageKey). */
  slotUsage: Map<string, number>;
  epsilon: number;
  L: Likelihoods;
}

export function timeBand(now: number): TimeBand {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

export function targetKey(t: MeaningTarget): string {
  return t.kind === "frame" ? `frame:${t.frame}` : t.kind === "topic" ? `topic:${t.topic}` : `entity:${t.entity}`;
}

export function parseTargetKey(key: string): MeaningTarget | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  if (kind === "frame") return { kind: "frame", frame: id };
  if (kind === "topic") return { kind: "topic", topic: id as never };
  if (kind === "entity") return { kind: "entity", entity: id };
  return null;
}

export function isFrameEnabled(f: FrameDef, toggles: Record<string, boolean> = {}): boolean {
  const t = toggles[f.id];
  return t === undefined ? !f.off : t;
}

/** Базовый вес фрейма до обучения: априор × время суток × распорядок × заметки. */
function baseFrameWeight(f: FrameDef, band: TimeBand, routine: RoutineItem[], noteTopics: Set<string>, L: Likelihoods): number {
  let w = f.prior * (f.time?.[band] ?? 1);
  for (const r of routine) {
    if (r.frame === f.id && r.band === band) w *= L.prior.routineBoost[String(r.strength) as "1" | "2" | "3"];
  }
  if (frameTopics(f).some((t) => noteTopics.has(t))) w *= L.prior.noteFrameTopicBoost;
  return w;
}

export function effectiveEpsilon(manual: number | null | undefined, learned: LearnedCounts | undefined): number {
  if (manual != null) return manual;
  const [errors, total] = learned?.answerErrors ?? [0, 0];
  // Бета-априор со средним 0.1 и весом 10 ответов.
  return Math.min(0.35, Math.max(0.02, (errors + 1) / (total + 10)));
}

export function buildModel(input: EngineInput): EngineModel {
  const L = input.likelihoods ?? LIKELIHOODS;
  const band = timeBand(input.now);
  const learned = input.learned ?? emptyLearned();
  const frames = FRAMES.filter((f) => isFrameEnabled(f, input.frameToggles));
  const activeNotes = input.notes.filter((n) => n.until >= input.now && n.createdAt <= input.now);
  const noteTopics = new Set<string>(activeNotes.flatMap((n) => n.topics));
  const noteEntities = new Set<string>(activeNotes.flatMap((n) => n.entityIds));

  // Априор фреймов: среднее Дирихле с псевдосчётами от базовых весов.
  const base = frames.map((f) => baseFrameWeight(f, band, input.routine, noteTopics, L));
  const baseSum = base.reduce((s, x) => s + x, 0);
  const alphaTotal = L.prior.dirichletScale * frames.length;
  const counts = frames.map((f, i) => {
    const alpha = (alphaTotal * base[i]!) / baseSum;
    const n = learned.frameTime[f.id]?.[band] ?? 0;
    return Math.max(alpha * 0.2, alpha + n); // отрицательные обновления не обнуляют фрейм
  });
  const countSum = counts.reduce((s, x) => s + x, 0);
  const logFramePrior = new Map(frames.map((f, i) => [f.id, Math.log(((1 - L.other.prior) * counts[i]!) / countSum)]));

  const entities = new Map<string, Entity>();
  for (const e of BUILTIN_ENTITIES) entities.set(e.id, e);
  for (const e of input.entities) entities.set(e.id, e);
  const byType = new Map<EntityType, Entity[]>();
  for (const e of entities.values()) {
    const list = byType.get(e.type) ?? [];
    list.push(e);
    byType.set(e.type, list);
  }

  const context = new Set(input.context ?? []);
  const entityWeight = new Map<string, number>();
  for (const e of entities.values()) {
    const baseWeight = (e as { weight?: number }).weight ?? 1;
    let w = baseWeight * (1 + L.prior.entityFreqScale * (learned.entityFreq[e.id] ?? 0));
    if (noteEntities.has(e.id)) w *= L.prior.noteEntityBoost;
    if (e.type === "medicine" && e.schedule?.includes(band)) w *= L.prior.scheduleBoost;
    if (context.has(e.id)) w *= L.prior.contextBoost;
    entityWeight.set(e.id, w);
  }

  const words = new Map<string, EffectiveWord>();
  for (const w of input.words) {
    const total = w.meanings.reduce((s, m) => s + m.weight, 0) || 1;
    const acc = new Map<string, number>();
    for (const m of w.meanings) {
      const k = targetKey(m.target);
      acc.set(k, (acc.get(k) ?? 0) + (L.prior.wordMeaningScale * m.weight) / total);
    }
    for (const [k, n] of Object.entries(learned.wordMeaning[w.id] ?? {})) acc.set(k, Math.max(0, (acc.get(k) ?? 0) + n));
    const sum = [...acc.values()].reduce((s, x) => s + x, 0) || 1;
    const meanings = [...acc.entries()]
      .map(([k, v]) => ({ target: parseTargetKey(k), weight: v / sum }))
      .filter((m): m is { target: MeaningTarget; weight: number } => m.target !== null && m.weight > 0);
    words.set(w.id, { entry: w, meanings });
  }

  return {
    frames,
    frameIndex: new Map(frames.map((f) => [f.id, f])),
    entities,
    byType,
    words,
    band,
    logFramePrior,
    entityWeight,
    slotUsage: new Map(Object.entries(learned.entityFreq).filter(([k]) => k.startsWith("slot:"))),
    epsilon: effectiveEpsilon(input.epsilon, learned),
    L,
  };
}
