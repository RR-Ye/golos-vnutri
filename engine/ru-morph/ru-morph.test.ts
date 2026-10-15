import { describe, expect, it } from "vitest";
import { agree, declineName, declinePhrase, fixPrepositions, numberGender } from "./index.ts";

describe("ru-morph: имена", () => {
  it("Алия: женское на -ия", () => {
    expect(declineName("Алия", "f", "gen")).toBe("Алии");
    expect(declineName("Алия", "f", "dat")).toBe("Алии");
    expect(declineName("Алия", "f", "acc")).toBe("Алию");
    expect(declineName("Алия", "f", "ins")).toBe("Алией");
    expect(declineName("Алия", "f", "pre")).toBe("Алии");
  });

  it("Ерлан, Болат, Нурлан, Даулет: мужские на согласный", () => {
    expect(declineName("Ерлан", "m", "gen")).toBe("Ерлана");
    expect(declineName("Ерлан", "m", "dat")).toBe("Ерлану");
    expect(declineName("Ерлан", "m", "acc")).toBe("Ерлана");
    expect(declineName("Ерлан", "m", "ins")).toBe("Ерланом");
    expect(declineName("Ерлан", "m", "pre")).toBe("Ерлане");
    expect(declineName("Болат", "m", "acc")).toBe("Болата");
    expect(declineName("Нурлан", "m", "dat")).toBe("Нурлану");
    expect(declineName("Даулет", "m", "ins")).toBe("Даулетом");
  });

  it("Гульнар: женское на согласный не склоняется", () => {
    for (const c of ["gen", "dat", "acc", "ins", "pre"] as const) expect(declineName("Гульнар", "f", c)).toBe("Гульнар");
  });

  it("Айгуль: склоняется или нет по настройке", () => {
    expect(declineName("Айгуль", "f", "dat", { softSignFeminineDeclines: true })).toBe("Айгули");
    expect(declineName("Айгуль", "f", "ins", { softSignFeminineDeclines: true })).toBe("Айгулью");
    expect(declineName("Айгуль", "f", "acc", { softSignFeminineDeclines: true })).toBe("Айгуль");
    expect(declineName("Айгуль", "f", "dat", { softSignFeminineDeclines: false })).toBe("Айгуль");
  });

  it("мужское имя на -а склоняется как женское", () => {
    expect(declineName("Муса", "m", "acc")).toBe("Мусу");
    expect(declineName("Муса", "m", "gen")).toBe("Мусы");
  });
});

describe("ru-morph: существительные", () => {
  it("вода, хлеб, лекарство, дом, телефон", () => {
    expect(declinePhrase("вода", { gender: "f" }, "acc")).toBe("воду");
    expect(declinePhrase("вода", { gender: "f" }, "gen")).toBe("воды");
    expect(declinePhrase("хлеб", { gender: "m" }, "acc")).toBe("хлеб");
    expect(declinePhrase("хлеб", { gender: "m" }, "gen")).toBe("хлеба");
    expect(declinePhrase("лекарство", { gender: "n" }, "acc")).toBe("лекарство");
    expect(declinePhrase("лекарство", { gender: "n" }, "pre")).toBe("лекарстве");
    expect(declinePhrase("дом", { gender: "m" }, "pre")).toBe("доме");
    expect(declinePhrase("телефон", { gender: "m" }, "acc")).toBe("телефон");
    expect(declinePhrase("телефон", { gender: "m" }, "ins")).toBe("телефоном");
  });

  it("каша, дача, больница, мечеть, чай, одеяло", () => {
    expect(declinePhrase("каша", { gender: "f" }, "acc")).toBe("кашу");
    expect(declinePhrase("каша", { gender: "f" }, "gen")).toBe("каши");
    expect(declinePhrase("дача", { gender: "f" }, "ins")).toBe("дачей");
    expect(declinePhrase("больница", { gender: "f" }, "acc")).toBe("больницу");
    expect(declinePhrase("мечеть", { gender: "f" }, "acc")).toBe("мечеть");
    expect(declinePhrase("мечеть", { gender: "f" }, "pre")).toBe("мечети");
    expect(declinePhrase("чай", { gender: "m" }, "gen")).toBe("чая");
    expect(declinePhrase("одеяло", { gender: "n" }, "acc")).toBe("одеяло");
  });

  it("прилагательное с существительным: левая рука, правая нога", () => {
    expect(declinePhrase("левая рука", { gender: "f" }, "acc")).toBe("левую руку");
    expect(declinePhrase("левая рука", { gender: "f" }, "gen")).toBe("левой руки");
    expect(declinePhrase("правая нога", { gender: "f" }, "pre")).toBe("правой ноге");
  });

  it("только множественное: утренние таблетки, капли, очки", () => {
    const info = { gender: "f" as const, pluralOnly: true };
    expect(declinePhrase("утренние таблетки", info, "acc")).toBe("утренние таблетки");
    expect(declinePhrase("утренние таблетки", info, "pre")).toBe("утренних таблетках");
    expect(declinePhrase("утренние таблетки", info, "gen")).toBe("утренних таблеток");
    expect(declinePhrase("капли", info, "dat")).toBe("каплям");
    expect(declinePhrase("очки", { gender: "n", pluralOnly: true }, "pre")).toBe("очках");
  });

  it("зависимые слова после главного не меняются", () => {
    expect(declinePhrase("свадьба Алии", { gender: "f" }, "acc")).toBe("свадьбу Алии");
    expect(declinePhrase("работа в школе", { gender: "f" }, "pre")).toBe("работе в школе");
  });

  it("несклоняемое по отметке", () => {
    expect(declinePhrase("пальто", { gender: "n", indeclinable: true }, "gen")).toBe("пальто");
  });
});

describe("ru-morph: согласование и предлоги", () => {
  it("род и число", () => {
    const forms = ["закончился", "закончилась", "закончилось", "закончились"] as const;
    expect(agree(numberGender({ gender: "f", pluralOnly: true }), forms)).toBe("закончились");
    expect(agree(numberGender({ gender: "f" }), forms)).toBe("закончилась");
    expect(agree(numberGender({ gender: "n" }), forms)).toBe("закончилось");
  });

  it("о → об перед гласной", () => {
    expect(fixPrepositions("Я беспокоюсь о Алии.")).toBe("Я беспокоюсь об Алии.");
    expect(fixPrepositions("Расскажите о Ерлане.")).toBe("Расскажите о Ерлане.");
    expect(fixPrepositions("Поговорим о Наурызе.")).toBe("Поговорим о Наурызе.");
  });
});
