// Развитие речи: ступени подсказки и расписание карточек. Чистые функции.
import type { RepeatResult } from "../types.ts";

/** 0 — полное слово, 1 — первый слог, 2 — только картинка без звука. */
export type HintLevel = 0 | 1 | 2;

export interface CardState {
  key: string;
  level: HintLevel;
  results: { at: number; result: RepeatResult; level: number }[];
  due: number;
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export function newCard(key: string, now: number): CardState {
  return { key, level: 0, results: [], due: now };
}

/** Сама — подсказки меньше; не смогла — больше; с подсказкой — та же ступень. */
export function nextLevel(level: HintLevel, result: RepeatResult): HintLevel {
  if (result === "self") return Math.min(2, level + 1) as HintLevel;
  if (result === "failed") return Math.max(0, level - 1) as HintLevel;
  return level;
}

/** Сколько раз подряд в конце — «сама». */
function selfStreak(c: CardState): number {
  let n = 0;
  for (let i = c.results.length - 1; i >= 0 && c.results[i]!.result === "self"; i--) n++;
  return n;
}

/**
 * Когда показать снова: трудное — в этом же занятии, лёгкое — через дни, и чем дольше
 * получается, тем реже.
 */
export function nextDue(c: CardState, result: RepeatResult, now: number): number {
  if (result === "failed") return now + 2 * MIN;
  if (result === "prompted") return now + 10 * MIN;
  const streak = selfStreak(c);
  return now + DAY * 2 ** Math.min(5, Math.max(0, streak - 1));
}

export function record(c: CardState, result: RepeatResult, now: number): CardState {
  const withResult: CardState = { ...c, results: [...c.results, { at: now, result, level: c.level }] };
  return { ...withResult, level: nextLevel(c.level, result), due: nextDue(withResult, result, now) };
}

/** Доля неудач среди последних попыток — чем больше, тем чаще показываем. */
export function difficulty(c: CardState, lastN = 6): number {
  const recent = c.results.slice(-lastN);
  if (!recent.length) return 0.5;
  const bad = recent.reduce((s, r) => s + (r.result === "failed" ? 1 : r.result === "prompted" ? 0.5 : 0), 0);
  return bad / recent.length;
}

/**
 * Следующая карточка: сначала те, чей срок подошёл (трудные вперёд), иначе — самая трудная.
 * Только что показанную не повторяем, если есть другие.
 */
export function pickNext(cards: readonly CardState[], now: number, lastKey?: string): CardState | null {
  const pool = cards.length > 1 ? cards.filter((c) => c.key !== lastKey) : [...cards];
  if (!pool.length) return null;
  const due = pool.filter((c) => c.due <= now);
  const list = due.length ? due : pool;
  return [...list].sort((a, b) => difficulty(b) - difficulty(a) || a.due - b.due)[0]!;
}

const VOWELS = "аеёиоуыэюяәөүұіAEЁИОУЫЭЮЯӘӨҮҰІ".toLowerCase();

/**
 * Подсказка «первый слог»: начало слова до первой гласной включительно («Во…» для «вода»).
 * Для односложных слов — только начальные согласные («с…» для «су»).
 */
export function firstSyllable(word: string): string {
  const w = word.trim();
  const lower = w.toLowerCase();
  const vowelIdx = [...lower].findIndex((ch) => VOWELS.includes(ch));
  if (vowelIdx < 0) return w.slice(0, 1);
  const vowels = [...lower].filter((ch) => VOWELS.includes(ch)).length;
  if (vowels <= 1) return vowelIdx === 0 ? w.slice(0, 1) : w.slice(0, vowelIdx);
  return w.slice(0, vowelIdx + 1);
}
