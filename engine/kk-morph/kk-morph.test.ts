import { describe, expect, it } from "vitest";
import { finalClass, harmony, kkCase, kkPlural, kkPossessive, questionParticle } from "./index.ts";

describe("kk-morph: сингармонизм", () => {
  it("твёрдый и мягкий ряд по последнему гласному", () => {
    expect(harmony("Ерлан")).toBe("back");
    expect(harmony("Дәулет")).toBe("front");
    expect(harmony("Айгүл")).toBe("front");
    expect(harmony("Нұрлан")).toBe("back");
    expect(harmony("үй")).toBe("front");
    expect(harmony("дәрі")).toBe("front");
    expect(harmony("телефон")).toBe("back");
  });

  it("русские написания тоже получают ряд", () => {
    expect(harmony("Нурлан")).toBe("back");
    expect(harmony("Айгуль")).toBe("front");
    expect(harmony("Гульнар")).toBe("back");
  });

  it("класс последнего звука", () => {
    expect(finalClass("Әлия")).toBe("vowel");
    expect(finalClass("Ерлан")).toBe("nasal");
    expect(finalClass("Болат")).toBe("voiceless");
    expect(finalClass("су")).toBe("lryu");
    expect(finalClass("көз")).toBe("zhz");
  });
});

describe("kk-morph: падежи на именах", () => {
  it("ілік (родительный)", () => {
    expect(kkCase("Әлия", "gen")).toBe("Әлияның");
    expect(kkCase("Ерлан", "gen")).toBe("Ерланның");
    expect(kkCase("Болат", "gen")).toBe("Болаттың");
    expect(kkCase("Дәулет", "gen")).toBe("Дәулеттің");
    expect(kkCase("Айгүл", "gen")).toBe("Айгүлдің");
    expect(kkCase("Гүлнар", "gen")).toBe("Гүлнардың");
    expect(kkCase("Нұрлан", "gen")).toBe("Нұрланның");
    expect(kkCase("үй", "gen")).toBe("үйдің");
  });

  it("барыс (дательный)", () => {
    expect(kkCase("Әлия", "dat")).toBe("Әлияға");
    expect(kkCase("Ерлан", "dat")).toBe("Ерланға");
    expect(kkCase("Болат", "dat")).toBe("Болатқа");
    expect(kkCase("Дәулет", "dat")).toBe("Дәулетке");
    expect(kkCase("Айгүл", "dat")).toBe("Айгүлге");
    expect(kkCase("үй", "dat")).toBe("үйге");
    expect(kkCase("ауыл", "dat")).toBe("ауылға");
    expect(kkCase("мешіт", "dat")).toBe("мешітке");
  });

  it("табыс (винительный)", () => {
    expect(kkCase("Әлия", "acc")).toBe("Әлияны");
    expect(kkCase("Ерлан", "acc")).toBe("Ерланды");
    expect(kkCase("Болат", "acc")).toBe("Болатты");
    expect(kkCase("Дәулет", "acc")).toBe("Дәулетті");
    expect(kkCase("су", "acc")).toBe("суды");
    expect(kkCase("нан", "acc")).toBe("нанды");
    expect(kkCase("дәрі", "acc")).toBe("дәріні");
    expect(kkCase("телефон", "acc")).toBe("телефонды");
    expect(kkCase("таңғы дәрі", "acc")).toBe("таңғы дәріні");
  });

  it("жатыс, шығыс, көмектес", () => {
    expect(kkCase("үй", "loc")).toBe("үйде");
    expect(kkCase("Болат", "loc")).toBe("Болатта");
    expect(kkCase("Ерлан", "abl")).toBe("Ерланнан");
    expect(kkCase("үй", "abl")).toBe("үйден");
    expect(kkCase("Әлия", "abl")).toBe("Әлиядан");
    expect(kkCase("Болат", "abl")).toBe("Болаттан");
    expect(kkCase("Әлия", "ins")).toBe("Әлиямен");
    expect(kkCase("Болат", "ins")).toBe("Болатпен");
    expect(kkCase("көз", "ins")).toBe("көзбен");
    expect(kkCase("Айгүл", "ins")).toBe("Айгүлмен");
  });
});

describe("kk-morph: притяжательные и множественное", () => {
  it("менің … (1 л. ед. ч.) с озвончением", () => {
    expect(kkPossessive("бас", "1sg")).toBe("басым");
    expect(kkPossessive("тіс", "1sg")).toBe("тісім");
    expect(kkPossessive("құлақ", "1sg")).toBe("құлағым");
    expect(kkPossessive("аяқ", "1sg")).toBe("аяғым");
    expect(kkPossessive("сол аяқ", "1sg")).toBe("сол аяғым");
    expect(kkPossessive("кеуде", "1sg")).toBe("кеудем");
    expect(kkPossessive("тамақ", "1sg")).toBe("тамағым");
    expect(kkPossessive("үй", "1sg")).toBe("үйім");
  });

  it("сіздің … (вежливое 2 л.) и оның … (3 л.)", () => {
    expect(kkPossessive("бас", "2pl")).toBe("басыңыз");
    expect(kkPossessive("кеуде", "2pl")).toBe("кеудеңіз");
    expect(kkPossessive("тері", "2pl")).toBe("теріңіз");
    expect(kkPossessive("кітап", "3")).toBe("кітабы");
    expect(kkPossessive("әке", "3")).toBe("әкесі");
  });

  it("множественное число", () => {
    expect(kkPlural("үй")).toBe("үйлер");
    expect(kkPlural("бала")).toBe("балалар");
    expect(kkPlural("адам")).toBe("адамдар");
    expect(kkPlural("кітап")).toBe("кітаптар");
    expect(kkPlural("көз")).toBe("көздер");
    expect(kkPlural("көл")).toBe("көлдер");
  });

  it("вопросительная частица", () => {
    expect(questionParticle("Қатты")).toBe("ма");
    expect(questionParticle("сәл")).toBe("ме");
    expect(questionParticle("кітап")).toBe("па");
    expect(questionParticle("көз")).toBe("бе");
    expect(questionParticle("келе")).toBe("ме");
    expect(questionParticle("Ерлан")).toBe("ба");
    expect(questionParticle("Дәулет")).toBe("пе");
  });
});
