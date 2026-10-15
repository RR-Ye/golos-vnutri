// Распознавание её слов: сравнение с её же записанными образцами (ближайшие соседи по DTW).
import { dtwDistance } from "./dtw.ts";
import type { Features } from "./mfcc.ts";

export interface Template {
  wordId: string;
  features: Features;
}

export interface Match {
  wordId: string;
  /** Среднее из двух лучших расстояний до образцов этого слова. */
  distance: number;
  /** Уверенность 0–1 среди слов словаря. */
  confidence: number;
}

export interface Recognition {
  /** Лучшие совпадения по убыванию уверенности. */
  matches: Match[];
  /** Ничего не похоже: слово не из словаря или шум. */
  unknown: boolean;
}

export interface ClassifierOptions {
  /** Сколько ближайших образцов слова усреднять. */
  k: number;
  /** «Температура» перевода расстояний в уверенность. */
  temperature: number;
  /** Расстояние, выше которого слово считается незнакомым. */
  rejectDistance: number;
  band: number;
}

export const DEFAULT_CLASSIFIER: ClassifierOptions = { k: 2, temperature: 0.12, rejectDistance: 3.2, band: 0.25 };

export function recognize(query: Features, templates: readonly Template[], opts: Partial<ClassifierOptions> = {}): Recognition {
  const o = { ...DEFAULT_CLASSIFIER, ...opts };
  const byWord = new Map<string, number[]>();
  for (const t of templates) {
    const d = dtwDistance(query, t.features, o.band);
    const list = byWord.get(t.wordId) ?? [];
    list.push(d);
    byWord.set(t.wordId, list);
  }
  const scored = [...byWord.entries()].map(([wordId, ds]) => {
    ds.sort((a, b) => a - b);
    const top = ds.slice(0, o.k);
    return { wordId, distance: top.reduce((s, x) => s + x, 0) / top.length };
  });
  if (!scored.length) return { matches: [], unknown: true };
  const best = Math.min(...scored.map((s) => s.distance));
  // Уверенность — softmax по относительным расстояниям.
  const w = scored.map((s) => Math.exp(-(s.distance - best) / (o.temperature * best || 1)));
  const z = w.reduce((s, x) => s + x, 0);
  const matches = scored
    .map((s, i) => ({ ...s, confidence: w[i]! / z }))
    .sort((a, b) => b.confidence - a.confidence);
  return { matches, unknown: best > o.rejectDistance };
}

export interface LooResult {
  accuracy: number;
  total: number;
  confusions: { truth: string; predicted: string }[];
  perWord: Record<string, { correct: number; total: number }>;
}

/** Проверка с исключением по одной записи: каждую запись распознаём по остальным. */
export function leaveOneOut(templates: readonly Template[], opts: Partial<ClassifierOptions> = {}): LooResult {
  let correct = 0;
  const confusions: { truth: string; predicted: string }[] = [];
  const perWord: Record<string, { correct: number; total: number }> = {};
  templates.forEach((t, i) => {
    const rest = templates.filter((_, j) => j !== i);
    const r = recognize(t.features, rest, opts);
    const predicted = r.matches[0]?.wordId ?? "";
    const pw = (perWord[t.wordId] ??= { correct: 0, total: 0 });
    pw.total++;
    if (predicted === t.wordId) {
      correct++;
      pw.correct++;
    } else confusions.push({ truth: t.wordId, predicted });
  });
  return { accuracy: templates.length ? correct / templates.length : 0, total: templates.length, confusions, perWord };
}
