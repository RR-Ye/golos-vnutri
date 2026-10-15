// Русская морфология на правилах: склонение имён, существительных и согласованных
// с ними прилагательных. Неправильные формы родственник вводит вручную (entity.forms).
import type { RuCase, RuGender, RuNounInfo } from "../types.ts";

const VOWELS = "аеёиоуыэюя";
const SIBILANT_VELAR = "гкхжшчщ"; // после них пишется -и, а не -ы
const HUSHING = "жшчщц"; // после них безударное -ей/-ем вместо -ой/-ом

const isUpper = (ch: string) => ch !== ch.toLowerCase();

/** Переносит регистр первой буквы с образца. */
function keepCase(sample: string, result: string): string {
  if (!sample || !result) return result;
  return isUpper(sample[0]!) ? result[0]!.toUpperCase() + result.slice(1) : result;
}

const last = (w: string, n = 1) => w.slice(-n).toLowerCase();
const stem = (w: string, n = 1) => w.slice(0, -n);

export type RuNumberGender = RuGender | "pl";

export function numberGender(info: RuNounInfo | undefined): RuNumberGender {
  if (!info) return "m";
  return info.pluralOnly ? "pl" : info.gender;
}

// ---------- существительные и имена ----------

export interface DeclineOptions {
  /** Склонять ли женские имена на -ь (Айгуль → Айгули). */
  softSignFeminineDeclines?: boolean;
  /** Это имя собственное человека. */
  personName?: boolean;
}

/** Склонение одного существительного в единственном числе. */
function declineSingular(word: string, info: RuNounInfo, c: RuCase, opts: DeclineOptions): string {
  if (c === "nom" || info.indeclinable) return word;
  const w = word.toLowerCase();
  const end = last(w);
  const prev = w.length > 1 ? w[w.length - 2]! : "";

  // Женские имена на согласный не склоняются: Гульнар, Айгерим.
  if (opts.personName && info.gender === "f" && !VOWELS.includes(end) && end !== "ь") return word;

  // -ия: Алия, Мария, больница не сюда
  if (w.endsWith("ия")) {
    const s = stem(word, 1);
    return { gen: s + "и", dat: s + "и", acc: s + "ю", ins: s + "ей", pre: s + "и" }[c];
  }
  if (end === "а") {
    const s = stem(word, 1);
    const i = SIBILANT_VELAR.includes(prev) ? "и" : "ы";
    const ins = HUSHING.includes(prev) ? "ей" : "ой";
    return { gen: s + i, dat: s + "е", acc: s + "у", ins: s + ins, pre: s + "е" }[c];
  }
  if (end === "я") {
    const s = stem(word, 1);
    return { gen: s + "и", dat: s + "е", acc: s + "ю", ins: s + "ей", pre: s + "е" }[c];
  }
  if (end === "ь") {
    const s = stem(word, 1);
    if (info.gender === "f") {
      if (opts.personName && !opts.softSignFeminineDeclines) return word;
      return { gen: s + "и", dat: s + "и", acc: word, ins: s + "ью", pre: s + "и" }[c];
    }
    // мужской на -ь: Игорь, пень
    const acc = info.animate ? s + "я" : word;
    return { gen: s + "я", dat: s + "ю", acc, ins: s + "ем", pre: s + "е" }[c];
  }
  if (end === "й") {
    const s = stem(word, 1);
    const acc = info.animate ? s + "я" : word;
    if (prev === "и") return { gen: s + "я", dat: s + "ю", acc, ins: s + "ем", pre: s + "и" }[c];
    return { gen: s + "я", dat: s + "ю", acc, ins: s + "ем", pre: s + "е" }[c];
  }
  if (end === "о") {
    const s = stem(word, 1);
    return { gen: s + "а", dat: s + "у", acc: word, ins: s + "ом", pre: s + "е" }[c];
  }
  if (end === "е" || end === "ё") {
    const s = stem(word, 1);
    const pre = prev === "и" ? s + "и" : s + "е";
    return { gen: s + "я", dat: s + "ю", acc: word, ins: s + "ем", pre }[c];
  }
  if (VOWELS.includes(end)) return word; // -и, -у, -ю, -э: несклоняемые заимствования
  // мужской на твёрдый согласный
  const acc = info.animate ? word + "а" : word;
  const ins = HUSHING.includes(end) ? "ем" : "ом";
  return { gen: word + "а", dat: word + "у", acc, ins: word + ins, pre: word + "е" }[c];
}

/** Склонение существительного во множественном числе (именительный дан). */
function declinePlural(word: string, info: RuNounInfo, c: RuCase): string {
  if (c === "nom") return word;
  const w = word.toLowerCase();
  const end = last(w);
  const prev = w.length > 1 ? w[w.length - 2]! : "";
  const s = stem(word, 1);
  const soft = end === "я" || (end === "и" && !SIBILANT_VELAR.includes(prev));
  const a = soft ? "я" : "а";
  let gen: string;
  if (w.endsWith("ки")) gen = stem(word, 2) + "ок"; // таблетки → таблеток
  else if (end === "ы") gen = s + "ов"; // зубы → зубов
  else if (soft) gen = s + "ей";
  else gen = s;
  const acc = info.animate ? gen : word;
  return { gen, dat: `${s}${a}м`, acc, ins: `${s}${a}ми`, pre: `${s}${a}х` }[c];
}

// ---------- прилагательные ----------

const ADJ_ENDINGS = ["ая", "яя", "ый", "ий", "ой", "ое", "ее", "ые", "ие"];

export function looksLikeAdjective(word: string): boolean {
  const w = word.toLowerCase();
  return w.length > 3 && ADJ_ENDINGS.some((e) => w.endsWith(e));
}

function declineAdjective(adj: string, ng: RuNumberGender, animate: boolean, c: RuCase): string {
  if (c === "nom") return adj;
  const w = adj.toLowerCase();
  const s = stem(adj, 2);
  const before = w.length > 2 ? w[w.length - 3]! : "";
  const soft = w.endsWith("яя") || w.endsWith("ее") || ((w.endsWith("ий") || w.endsWith("ие")) && !SIBILANT_VELAR.includes(before));
  const hushOrVelar = SIBILANT_VELAR.includes(before);
  if (ng === "f") {
    return soft
      ? { gen: s + "ей", dat: s + "ей", acc: s + "юю", ins: s + "ей", pre: s + "ей" }[c]
      : { gen: s + "ой", dat: s + "ой", acc: s + "ую", ins: s + "ой", pre: s + "ой" }[c];
  }
  if (ng === "pl") {
    const y = soft || hushOrVelar ? "и" : "ы";
    const gen = `${s}${y}х`;
    return { gen, dat: `${s}${y}м`, acc: animate ? gen : adj, ins: `${s}${y}ми`, pre: gen }[c];
  }
  const o = soft ? "е" : "о";
  const y = soft || hushOrVelar ? "и" : "ы";
  const gen = `${s}${o}го`;
  const acc = ng === "n" ? adj : animate ? gen : adj;
  return { gen, dat: `${s}${o}му`, acc, ins: `${s}${y}м`, pre: `${s}${o}м` }[c];
}

// ---------- фразы ----------

/**
 * Склоняет именную группу: прилагательные перед главным словом согласуются с ним,
 * главное слово склоняется, всё после него («свадьба Алии», «работа в школе») не меняется.
 */
export function declinePhrase(phrase: string, info: RuNounInfo, c: RuCase, opts: DeclineOptions = {}): string {
  if (c === "nom") return phrase;
  const parts = phrase.split(" ");
  const headIdx = parts.findIndex((p, i) => !(looksLikeAdjective(p) && i < parts.length - 1));
  if (headIdx < 0) return phrase;
  const ng = numberGender(info);
  const out = parts.map((p, i) => {
    if (i < headIdx) return keepCase(p, declineAdjective(p, ng, !!info.animate, c));
    if (i === headIdx) {
      const r = info.pluralOnly ? declinePlural(p, info, c) : declineSingular(p, info, c, opts);
      return keepCase(p, r);
    }
    return p;
  });
  return out.join(" ");
}

/** Склонение имени человека. Пол берётся из настройки, а не угадывается. */
export function declineName(name: string, gender: "m" | "f", c: RuCase, opts: Omit<DeclineOptions, "personName"> = {}): string {
  return declinePhrase(name, { gender, animate: true }, c, { ...opts, personName: true });
}

// ---------- согласование ----------

/** Выбор формы по роду и числу: [м, ж, ср, мн]. */
export function agree(ng: RuNumberGender, forms: readonly [string, string, string, string]): string {
  return forms[{ m: 0, f: 1, n: 2, pl: 3 }[ng]]!;
}

/** «о» → «об» перед гласной: «об Алии», «об аул». */
export function fixPrepositions(text: string): string {
  return text.replace(/(^|[\s(«])([оО]) (?=[аэиоуыАЭИОУЫ])/g, "$1$2б ");
}
