import { describe, expect, it } from "vitest";
import { resolveMode, utterancesFor, type SoundSettings } from "./sound";

const s: SoundSettings = { primaryLang: "ru", sound: { global: "ru", byCategory: { people: "kk-ru" } } };
const water = { text: { ru: "Вода", kk: "Су" }, category: "needs" as const };

describe("режимы звучания", () => {
  it("общий режим: только русский", () => {
    expect(utterancesFor(water, s)).toEqual([{ lang: "ru", text: "Вода", mediaId: undefined }]);
  });

  it("категория важнее общего: люди звучат по-казахски, затем по-русски", () => {
    const aliya = { text: { ru: "Алия", kk: "Әлия" }, category: "people" as const };
    expect(utterancesFor(aliya, s).map((u) => u.text)).toEqual(["Әлия", "Алия"]);
  });

  it("режим элемента важнее категории", () => {
    const aliya = { text: { ru: "Алия", kk: "Әлия" }, category: "people" as const, mode: "ru" as const };
    expect(utterancesFor(aliya, s).map((u) => u.lang)).toEqual(["ru"]);
  });

  it("все четыре режима", () => {
    for (const [mode, langs] of [
      ["ru", ["ru"]],
      ["ru-kk", ["ru", "kk"]],
      ["kk-ru", ["kk", "ru"]],
      ["kk", ["kk"]],
    ] as const) {
      expect(utterancesFor({ ...water, mode }, s).map((u) => u.lang)).toEqual(langs);
    }
  });

  it("слово для развития всегда двуязычное: «Вода. Су.»", () => {
    expect(utterancesFor({ ...water, develop: true }, s).map((u) => u.text)).toEqual(["Вода", "Су"]);
    expect(resolveMode({ category: "needs", develop: true, mode: "kk" }, s)).toBe("ru-kk");
    expect(resolveMode({ category: "needs", develop: true, mode: "kk-ru" }, s)).toBe("kk-ru");
  });

  it("вопросы и итоговые фразы по умолчанию — на основном языке", () => {
    expect(resolveMode({ category: "prompts" }, { ...s, primaryLang: "kk" })).toBe("kk");
    expect(resolveMode({ category: "phrases" }, s)).toBe("ru");
  });

  it("запись голосом подставляется для своего языка", () => {
    const u = utterancesFor({ ...water, mode: "ru-kk", audio: { kk: "aud_1" } }, s);
    expect(u).toEqual([
      { lang: "ru", text: "Вода", mediaId: undefined },
      { lang: "kk", text: "Су", mediaId: "aud_1" },
    ]);
  });

  it("нет текста на нужном языке — говорим на другом, а не молчим", () => {
    expect(utterancesFor({ text: { ru: "Пульт", kk: "" }, category: "things", mode: "kk" }, s)).toEqual([
      { lang: "ru", text: "Пульт", mediaId: undefined },
    ]);
  });
});
