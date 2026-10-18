// Ударения в именах для синтеза. espeak-ng, который даёт синтезу фонемы, не знает казахских
// имён и в русском ставит ударение наугад («А́сель», «Алди́яр»), а в казахском путает
// слова с «и» и «я» («А́риянна»). Здесь — какое слово в тексте и на какую гласную
// ударять; саму замену фонем делает воркер синтеза.
import type { Entity, Lang } from "@/engine/types";

export const VOWELS: Record<Lang, string> = { ru: "аеёиоуыэюя", kk: "аәеёиоөуұүыіэюя" };

/**
 * Встроенный словарь: имя в начальной форме → номер ударной гласной (с 1).
 * Родственник может поправить ударение в карточке — его выбор важнее.
 */
export const BUILTIN_STRESS: Record<Lang, Record<string, number>> = {
  ru: {
    асель: 2,
    махамбет: 3,
    серик: 2,
    ариянна: 3,
    арон: 2,
    алдияр: 3,
    алия: 2,
    ерлан: 2,
    айгуль: 2,
    болат: 2,
    нурлан: 2,
    даулет: 3,
    гульнар: 2,
  },
  kk: {
    әсел: 2,
    махамбет: 3,
    серік: 2,
    ариянна: 3,
    арон: 2,
    алдияр: 3,
    әлия: 3,
    ерлан: 2,
    айгүл: 2,
    болат: 2,
    нұрлан: 2,
    дәулет: 2,
    гүлнар: 2,
  },
};

export type StressLexicon = Record<Lang, Map<string, number>>;

/** Какую гласную слова ударять: слово как в тексте, номер гласной (с 1) и сколько их всего. */
export interface StressFix {
  word: string;
  vowel: number;
  total: number;
}

/** Где в слове гласные-слоги (номера букв). В казахском «у» после гласной — не слог (Дәулет). */
export function vowelPositions(word: string, lang: Lang): number[] {
  const out: number[] = [];
  let prevVowel = false;
  [...word.toLowerCase()].forEach((ch, i) => {
    const v = VOWELS[lang].includes(ch) && !(lang === "kk" && ch === "у" && prevVowel);
    if (v) out.push(i);
    prevVowel = v;
  });
  return out;
}

export function vowelCount(word: string, lang: Lang): number {
  return vowelPositions(word, lang).length;
}

/** Ударение по встроенному словарю для имени из одного слова. */
export function builtinStress(name: string, lang: Lang): number | undefined {
  return BUILTIN_STRESS[lang][name.trim().toLowerCase()];
}

/** Ударение из карточки: номер гласной во всём имени → слово имени и номер гласной в нём. */
function entityEntries(e: Entity, lang: Lang): [string, number][] {
  const k = e.stress?.[lang];
  const name = e.name[lang].trim().toLowerCase();
  if (!k || !name) return [];
  let left = k;
  for (const word of name.split(/[^\p{L}]+/u).filter(Boolean)) {
    const n = vowelCount(word, lang);
    if (left <= n) return [[word, left]];
    left -= n;
  }
  return [];
}

export function buildLexicon(entities: Iterable<Entity> = []): StressLexicon {
  const lex: StressLexicon = { ru: new Map(Object.entries(BUILTIN_STRESS.ru)), kk: new Map(Object.entries(BUILTIN_STRESS.kk)) };
  for (const e of entities) for (const lang of ["ru", "kk"] as const) for (const [w, v] of entityEntries(e, lang)) lex[lang].set(w, v);
  return lex;
}

/** Основа для поиска падежных форм: «Асель» → «асел» (Асели, Аселью), «Ариянна» → «ариянн». */
function ruStem(base: string): string {
  return /[аеёиоуыэюяьй]$/.test(base) ? base.slice(0, -1) : base;
}

function ruLookup(w: string, lex: Map<string, number>): number | undefined {
  const exact = lex.get(w);
  if (exact) return exact;
  // Падежные формы имени: ударение в русских именах остаётся на той же гласной основы.
  let best: { len: number; v: number } | undefined;
  for (const [base, v] of lex) {
    const stem = ruStem(base);
    if (stem.length < 3 || !w.startsWith(stem) || w.length - stem.length > 3) continue;
    if (v > vowelCount(stem, "ru")) continue;
    if (!best || stem.length > best.len) best = { len: stem.length, v };
  }
  return best?.v;
}

function kkLookup(w: string, lex: Map<string, number>): number | undefined {
  const exact = lex.get(w);
  if (exact) return exact;
  // С окончаниями ударение в казахском уходит на последний слог: Әселге́, Арияннаға́.
  for (const base of lex.keys()) {
    if (base.length >= 3 && w.startsWith(base) && w.length - base.length <= 8) return vowelCount(w, "kk");
  }
  return undefined;
}

export function stressFixes(text: string, lang: Lang, lex: StressLexicon): StressFix[] {
  const out: StressFix[] = [];
  for (const word of text.match(/\p{L}+/gu) ?? []) {
    const w = word.toLowerCase();
    if (lang === "ru" && w.includes("ё")) continue; // «ё» всегда ударная, espeak это знает
    const v = lang === "ru" ? ruLookup(w, lex.ru) : kkLookup(w, lex.kk);
    const total = vowelCount(w, lang);
    if (v && v <= total && total > 1) out.push({ word, vowel: v, total });
  }
  return out;
}

let current: StressLexicon = buildLexicon();

/** Словарь, по которому сейчас говорит синтез. */
export function stressLexicon(): StressLexicon {
  return current;
}

export function setStressLexicon(lex: StressLexicon): void {
  current = lex;
}
