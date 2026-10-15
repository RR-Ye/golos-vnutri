// Обучение на её истории: счётчики Дирихле для априоров фреймов по времени суток,
// частот сущностей и весов значений слов, бета-счётчик ошибочных ответов.
// Чистые функции: принимают счётчики и возвращают новые.
import { frameTopics } from "../ontology/index.ts";
import { questionTruth, slotUsageKey } from "../inference/likelihood.ts";
import { emptyLearned, type EngineModel, type LearnedCounts } from "../inference/model.ts";
import type { Candidate, Evidence } from "../inference/types.ts";
import type { TimeBand } from "../types.ts";

/** Насколько сильно отклонённая финальная фраза уменьшает счётчик. */
export const NEGATIVE_STEP = 0.3;

function clone(l: LearnedCounts): LearnedCounts {
  return {
    frameTime: Object.fromEntries(Object.entries(l.frameTime).map(([k, v]) => [k, { ...v }])),
    entityFreq: { ...l.entityFreq },
    wordMeaning: Object.fromEntries(Object.entries(l.wordMeaning).map(([k, v]) => [k, { ...v }])),
    answerErrors: [l.answerErrors[0], l.answerErrors[1]],
  };
}

/** Ключи значений, которые «объясняет» подтверждённый кандидат (для уточнения весов слов). */
function explainedTargets(model: EngineModel, c: Candidate): string[] {
  const f = model.frameIndex.get(c.frame);
  const keys = [`frame:${c.frame}`];
  if (f) for (const t of frameTopics(f)) keys.push(`topic:${t}`);
  for (const v of Object.values(c.slots)) if (v) keys.push(`entity:${v}`);
  return keys;
}

/** Подтверждённое сообщение: всё, что к нему привело, становится чуть вероятнее. */
export function learnConfirmed(
  learned: LearnedCounts | undefined,
  model: EngineModel,
  confirmed: Candidate,
  evidence: readonly Evidence[],
  band: TimeBand = model.band,
): LearnedCounts {
  const l = clone(learned ?? emptyLearned());
  const ft = (l.frameTime[confirmed.frame] ??= {});
  ft[band] = (ft[band] ?? 0) + 1;
  for (const v of Object.values(confirmed.slots)) if (v) l.entityFreq[v] = (l.entityFreq[v] ?? 0) + 1;
  const frame = model.frameIndex.get(confirmed.frame);
  for (const sl of frame?.slots ?? []) {
    if (!sl.optional) continue;
    const key = slotUsageKey(confirmed.frame, sl.name, confirmed.slots[sl.name] != null);
    l.entityFreq[key] = (l.entityFreq[key] ?? 0) + 1;
  }

  const targets = explainedTargets(model, confirmed);
  for (const e of evidence) {
    if (e.kind === "word") {
      const w = model.words.get(e.word);
      if (!w) continue;
      const wm = (l.wordMeaning[e.word] ??= {});
      // Засчитываем только самое конкретное объяснённое значение из известных слову.
      const known = new Set(w.meanings.map((m) => (m.target.kind === "frame" ? `frame:${m.target.frame}` : m.target.kind === "topic" ? `topic:${m.target.topic}` : `entity:${m.target.entity}`)));
      const hit = targets.find((t) => known.has(t)) ?? targets[0]!;
      wm[hit] = (wm[hit] ?? 0) + 1;
    }
    if (e.kind === "answer" && e.answer !== "almost") {
      const truth = questionTruth(model, e.question, confirmed);
      if (truth === undefined) continue;
      const wrong = (e.answer === "yes") !== truth;
      l.answerErrors = [l.answerErrors[0] + (wrong ? 1 : 0), l.answerErrors[1] + 1];
    }
  }
  return l;
}

/** Отклонённая финальная фраза: отрицательное обновление (с нижней границей в модели). */
export function learnRejected(learned: LearnedCounts | undefined, rejected: Candidate, band: TimeBand): LearnedCounts {
  const l = clone(learned ?? emptyLearned());
  const ft = (l.frameTime[rejected.frame] ??= {});
  ft[band] = (ft[band] ?? 0) - NEGATIVE_STEP;
  for (const v of Object.values(rejected.slots)) {
    if (v) l.entityFreq[v] = Math.max(0, (l.entityFreq[v] ?? 0) - NEGATIVE_STEP);
  }
  return l;
}
