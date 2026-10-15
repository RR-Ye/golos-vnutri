// Казахская морфология на правилах: сингармонизм, ассимиляция согласных на стыке,
// падежи, притяжательные окончания, множественное число, вопросительная частица.
// Формы требуют проверки носителем языка (TODO.md); ручные формы важнее правил.
import type { KkCase } from "../types.ts";

const BACK = "аоұыя";
const FRONT = "әөүіеэ";
const AMBIG = "иуюё"; // и, у, ю ряда не задают однозначно
const ALL_VOWELS = BACK + FRONT + AMBIG;

const VOICELESS = "кқпстшщфхһцчбвгд"; // б, в, г, д на конце заимствований оглушаются
const SONORANT_LRYU = "лрйу";
const NASAL = "мнң";
const VOICED_ZH = "жз";

export type Harmony = "back" | "front";
export type FinalClass = "vowel" | "lryu" | "nasal" | "zhz" | "voiceless";

const lower = (s: string) => s.toLowerCase();

/** Последнее слово группы: склоняется только оно («сол қол» → «сол қолым»). */
function splitLast(phrase: string): [string, string] {
  const i = phrase.lastIndexOf(" ");
  return i < 0 ? ["", phrase] : [phrase.slice(0, i + 1), phrase.slice(i + 1)];
}

/** Ряд слова по последнему гласному, с учётом мягкого знака и неоднозначных гласных. */
export function harmony(word: string): Harmony {
  const w = lower(word);
  if (w.endsWith("ь")) return "front"; // Айгуль → Айгульге
  for (let i = w.length - 1; i >= 0; i--) {
    const ch = w[i]!;
    if (BACK.includes(ch)) return "back";
    if (FRONT.includes(ch)) return "front";
    if (ch === "и" || ch === "ю") {
      // ищем дальше определённый гласный; если его нет — мягкий ряд
      for (let j = i - 1; j >= 0; j--) {
        if (BACK.includes(w[j]!)) return "back";
        if (FRONT.includes(w[j]!)) return "front";
      }
      return "front";
    }
    if (ch === "у" || ch === "ё") {
      for (let j = i - 1; j >= 0; j--) {
        if (BACK.includes(w[j]!)) return "back";
        if (FRONT.includes(w[j]!)) return "front";
      }
      return "back";
    }
  }
  return "back";
}

/** Класс последнего звука для выбора варианта окончания. */
export function finalClass(word: string): FinalClass {
  const w = lower(word).replace(/[ьъ]$/, "");
  const ch = w[w.length - 1] ?? "";
  if (ch === "у" || ch === "й") {
    // у после гласного — согласный [w]: «ауру»? нет; «су» → [суw]: окончания как после сонорных
    return "lryu";
  }
  if (ch === "и" && w.length > 1 && ALL_VOWELS.includes(w[w.length - 2]!)) return "lryu";
  if (ALL_VOWELS.includes(ch)) return "vowel";
  if (SONORANT_LRYU.includes(ch)) return "lryu";
  if (NASAL.includes(ch)) return "nasal";
  if (VOICED_ZH.includes(ch)) return "zhz";
  if (VOICELESS.includes(ch)) return "voiceless";
  return "vowel";
}

const pick = (h: Harmony, back: string, front: string) => (h === "back" ? back : front);

/** Озвончение конечного к/қ/п перед гласным окончанием: кітап → кітабы, аяқ → аяғым. */
function voiceFinal(word: string): string {
  const end = word[word.length - 1];
  const map: Record<string, string> = { к: "г", қ: "ғ", п: "б", К: "Г", Қ: "Ғ", П: "Б" };
  // Короткие односложные заимствования не озвончаются; здесь простое правило для исконных слов.
  return end && map[end] && word.length > 2 ? word.slice(0, -1) + map[end] : word;
}

function caseSuffix(word: string, c: KkCase): string {
  const h = harmony(word);
  const f = finalClass(word);
  switch (c) {
    case "nom":
      return "";
    case "gen":
      if (f === "vowel" || f === "nasal") return pick(h, "ның", "нің");
      if (f === "voiceless") return pick(h, "тың", "тің");
      return pick(h, "дың", "дің");
    case "acc":
      if (f === "vowel") return pick(h, "ны", "ні");
      if (f === "voiceless") return pick(h, "ты", "ті");
      return pick(h, "ды", "ді");
    case "dat":
      if (f === "voiceless") return pick(h, "қа", "ке");
      return pick(h, "ға", "ге");
    case "loc":
      if (f === "voiceless") return pick(h, "та", "те");
      return pick(h, "да", "де");
    case "abl":
      if (f === "voiceless") return pick(h, "тан", "тен");
      if (f === "nasal") return pick(h, "нан", "нен");
      return pick(h, "дан", "ден");
    case "ins":
      if (f === "voiceless") return "пен";
      if (f === "zhz") return "бен";
      return "мен";
  }
}

/** Падежная форма слова или именной группы. */
export function kkCase(phrase: string, c: KkCase): string {
  const [head, word] = splitLast(phrase);
  return head + word + caseSuffix(word, c);
}

export function kkPlural(phrase: string): string {
  const [head, word] = splitLast(phrase);
  const h = harmony(word);
  const f = finalClass(word);
  const s =
    f === "vowel" || (f === "lryu" && !lower(word).endsWith("л"))
      ? pick(h, "лар", "лер")
      : f === "voiceless"
        ? pick(h, "тар", "тер")
        : pick(h, "дар", "дер");
  return head + word + s;
}

export type KkPerson = "1sg" | "2sg" | "2pl" | "3";

/** Притяжательная форма: менің басым, сенің басың, сіздің басыңыз, оның басы. */
export function kkPossessive(phrase: string, person: KkPerson): string {
  const [head, word] = splitLast(phrase);
  const h = harmony(word);
  const vowelEnd = finalClass(word) === "vowel";
  const base = vowelEnd ? word : voiceFinal(word);
  switch (person) {
    case "1sg":
      return head + base + (vowelEnd ? "м" : pick(h, "ым", "ім"));
    case "2sg":
      return head + base + (vowelEnd ? "ң" : pick(h, "ың", "ің"));
    case "2pl":
      return head + base + (vowelEnd ? pick(h, "ңыз", "ңіз") : pick(h, "ыңыз", "іңіз"));
    case "3":
      return head + base + (vowelEnd ? pick(h, "сы", "сі") : pick(h, "ы", "і"));
  }
}

/** Вопросительная частица после слова: ма/ме, ба/бе, па/пе. */
export function questionParticle(word: string): string {
  const w = word.replace(/[^\p{L}]+$/u, "");
  const h = harmony(w);
  const f = finalClass(w);
  if (f === "voiceless") return pick(h, "па", "пе");
  if (f === "nasal" || f === "zhz") return pick(h, "ба", "бе");
  return pick(h, "ма", "ме");
}
