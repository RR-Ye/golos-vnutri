import { describe, expect, it } from "vitest";
import { DEFAULT_NLG, framePhrase } from "@/engine";
import type { Entity } from "@/engine/types";
import { buildLexicon, stressFixes, vowelCount } from "./stress";

const NAMES: [string, string, "m" | "f"][] = [
  ["Асель", "Әсел", "f"],
  ["Махамбет", "Махамбет", "m"],
  ["Серик", "Серік", "m"],
  ["Ариянна", "Ариянна", "f"],
  ["Арон", "Арон", "m"],
  ["Алдияр", "Алдияр", "m"],
];
const person = ([ru, kk, gender]: (typeof NAMES)[number]): Entity => ({ id: `p.${ru}`, type: "person", name: { ru, kk }, ruMorph: { gender } });
const say = (frame: string, e: Entity, lang: "ru" | "kk") => framePhrase(frame, { person: e }, "say", lang, DEFAULT_NLG).text;
const lex = buildLexicon();

describe("ударения в именах", () => {
  it("по-русски ударение остаётся на той же гласной во всех падежах", () => {
    const want: Record<string, number> = { Асель: 2, Махамбет: 3, Серик: 2, Ариянна: 3, Арон: 2, Алдияр: 3 };
    for (const n of NAMES) {
      const e = person(n);
      for (const frame of ["people.call", "people.see", "people.worry", "people.when", "people.thanks"]) {
        const text = say(frame, e, "ru");
        const fixes = stressFixes(text, "ru", lex);
        expect(fixes, text).toHaveLength(1);
        expect(fixes[0]!.vowel, text).toBe(want[n[0]]);
      }
    }
    expect(stressFixes("Я беспокоюсь об Ариянне.", "ru", lex)).toEqual([{ word: "Ариянне", vowel: 3, total: 4 }]);
  });

  it("по-казахски в начальной форме — по словарю, с окончанием — на последний слог", () => {
    expect(stressFixes("Рақмет, Ариянна!", "kk", lex)).toEqual([{ word: "Ариянна", vowel: 3, total: 4 }]);
    expect(stressFixes("Арияннаға қоңырау шалшы.", "kk", lex)).toEqual([{ word: "Арияннаға", vowel: 5, total: 5 }]);
    expect(stressFixes(say("people.see", person(NAMES[5]!), "kk"), "kk", lex)).toEqual([{ word: "Алдиярды", vowel: 4, total: 4 }]);
  });

  it("обычные слова не трогает", () => {
    expect(stressFixes("Я хочу пить. Мне нужно в туалет.", "ru", lex)).toEqual([]);
    expect(stressFixes("Мен су ішкім келеді.", "kk", lex)).toEqual([]);
    expect(stressFixes("Когда придёт Алия?", "ru", lex).map((f) => f.word)).toEqual(["Алия"]);
  });

  it("ударение из карточки важнее словаря и считается по всему имени", () => {
    const lex2 = buildLexicon([
      { id: "p.x", type: "person", name: { ru: "Арон", kk: "Арон" }, stress: { ru: 1 } },
      { id: "p.y", type: "person", name: { ru: "тётя Камила", kk: "Камила апай" }, stress: { ru: 4, kk: 2 } },
    ]);
    expect(stressFixes("Спасибо, Арон!", "ru", lex2)).toEqual([{ word: "Арон", vowel: 1, total: 2 }]);
    expect(stressFixes("Позвони Камиле.", "ru", lex2)).toEqual([{ word: "Камиле", vowel: 2, total: 3 }]);
    expect(stressFixes("Камила", "kk", lex2)).toEqual([{ word: "Камила", vowel: 2, total: 3 }]);
  });

  it("в казахском «у» после гласной не слог", () => {
    expect(vowelCount("Дәулет", "kk")).toBe(2);
    expect(vowelCount("Даулет", "ru")).toBe(3);
  });
});
