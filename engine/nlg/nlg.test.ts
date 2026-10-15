import { describe, expect, it } from "vitest";
import { demoEntities } from "../demo/index.ts";
import { BUILTIN_ENTITIES } from "../ontology/index.ts";
import type { Entity } from "../types.ts";
import { DEFAULT_NLG, framePhrase, joinSentences, renderTemplate, slotQuestion, type NlgOptions } from "./index.ts";

const all = new Map<string, Entity>([...BUILTIN_ENTITIES, ...demoEntities()].map((e) => [e.id, e]));
const E = (id: string) => all.get(id)!;
const opts: NlgOptions = DEFAULT_NLG;

describe("nlg: русский", () => {
  it("простые фразы и род говорящего", () => {
    expect(framePhrase("need.drink", {}, "say", "ru", opts).text).toBe("Я хочу пить.");
    expect(framePhrase("feel.glad", {}, "say", "ru", opts).text).toBe("Я рада.");
    expect(framePhrase("feel.glad", {}, "say", "ru", { ...opts, speakerGender: "m" }).text).toBe("Я рад.");
    expect(framePhrase("feel.tired", {}, "say", "ru", opts).text).toBe("Я устала.");
  });

  it("склонение имён в слотах", () => {
    expect(framePhrase("people.see", { person: E("p.aliya") }, "say", "ru", opts).text).toBe("Я хочу увидеть Алию.");
    expect(framePhrase("people.call", { person: E("p.erlan") }, "say", "ru", opts).text).toBe("Позвони Ерлану, пожалуйста.");
    expect(framePhrase("people.worry", { person: E("p.aliya") }, "say", "ru", opts).text).toBe("Я беспокоюсь об Алии.");
    expect(framePhrase("feel.miss", { person: E("p.gulnar") }, "say", "ru", opts).text).toBe("Я скучаю по Гульнар.");
    expect(framePhrase("people.see", { person: E("p.aigul") }, "ask", "ru", opts).text).toBe("Вы хотите увидеть Айгуль?");
  });

  it("обращение на «вы»", () => {
    expect(framePhrase("people.call", { person: E("p.aliya") }, "say", "ru", { ...opts, addressForm: "vy" }).text).toBe(
      "Позвоните Алии, пожалуйста.",
    );
    expect(framePhrase("addr.do", { action: E("act.window_open") }, "say", "ru", { ...opts, addressForm: "vy" }).text).toBe(
      "Пожалуйста, откройте окно.",
    );
  });

  it("боль: число, сила", () => {
    expect(framePhrase("health.pain", { body: E("body.head") }, "say", "ru", opts).text).toBe("У меня болит голова.");
    expect(framePhrase("health.pain", { body: E("body.eyes") }, "say", "ru", opts).text).toBe("У меня болят глаза.");
    expect(framePhrase("health.pain", { body: E("body.head"), severity: E("sev.2") }, "say", "ru", opts).text).toBe(
      "У меня сильно болит голова.",
    );
    expect(framePhrase("health.pain", { body: E("body.lleg") }, "ask", "ru", opts).text).toBe("У вас болит левая нога?");
  });

  it("лекарства во множественном, места с предлогом", () => {
    expect(framePhrase("med.out", { med: E("md.drops") }, "say", "ru", opts).text).toBe("Капли закончились.");
    expect(framePhrase("med.give", { med: E("md.morning") }, "say", "ru", opts).text).toBe("Дай мне утренние таблетки.");
    expect(framePhrase("place.go", { place: E("pl.hospital") }, "say", "ru", opts).text).toBe("Я хочу в больницу.");
    expect(framePhrase("place.go", { place: E("pl.dacha") }, "say", "ru", opts).text).toBe("Я хочу на дачу.");
  });

  it("необязательный слот выбирает вариант шаблона", () => {
    expect(framePhrase("need.eat", {}, "say", "ru", opts).text).toBe("Я хочу есть.");
    expect(framePhrase("need.eat", { food: E("fd.porridge") }, "say", "ru", opts).text).toBe("Я хочу кашу.");
  });

  it("вопросы о слоте", () => {
    expect(slotQuestion(E("p.aliya"), "ru", opts)).toBe("Это про Алию?");
    expect(slotQuestion(E("body.teeth"), "ru", opts)).toBe("Болят зубы?");
  });
});

describe("nlg: казахский", () => {
  it("простые фразы", () => {
    expect(framePhrase("need.drink", {}, "say", "kk", opts).text).toBe("Мен су ішкім келеді.");
    expect(framePhrase("need.drink", {}, "ask", "kk", opts).text).toBe("Су ішкіңіз келе ме?");
  });

  it("падежи имён", () => {
    expect(framePhrase("people.see", { person: E("p.erlan") }, "say", "kk", opts).text).toBe("Мен Ерланды көргім келеді.");
    expect(framePhrase("people.call", { person: E("p.aliya") }, "say", "kk", opts).text).toBe("Әлияға қоңырау шалшы.");
    expect(framePhrase("people.call", { person: E("p.aliya") }, "say", "kk", { ...opts, addressForm: "vy" }).text).toBe(
      "Әлияға қоңырау шалыңызшы.",
    );
    expect(framePhrase("feel.miss", { person: E("p.daulet") }, "say", "kk", opts).text).toBe("Мен Дәулетті сағындым.");
    expect(framePhrase("place.go", { place: E("pl.mosque") }, "say", "kk", opts).text).toBe("Мен мешітке барғым келеді.");
  });

  it("части тела с притяжательным окончанием", () => {
    expect(framePhrase("health.pain", { body: E("body.head") }, "say", "kk", opts).text).toBe("Басым ауырып тұр.");
    expect(framePhrase("health.pain", { body: E("body.lleg"), severity: E("sev.2") }, "say", "kk", opts).text).toBe(
      "Сол аяғым қатты ауырып тұр.",
    );
    expect(framePhrase("health.pain", { body: E("body.ears") }, "ask", "kk", opts).text).toBe("Құлағыңыз ауырып тұр ма?");
  });

  it("вопросительная частица согласуется", () => {
    expect(slotQuestion(E("sev.2"), "kk", opts)).toBe("Қатты ма?");
    expect(slotQuestion(E("sev.1"), "kk", opts)).toBe("Сәл ме?");
  });

  it("ручная форма важнее правил", () => {
    expect(framePhrase("mem.remember", { about: E("ev.wedding") }, "say", "kk", opts).text).toBe("Мен Әлияның тойын есіме алдым.");
    expect(framePhrase("mem.remember", { about: E("ev.wedding") }, "say", "ru", opts).text).toBe("Я вспомнила свадьбу Алии.");
  });
});

describe("nlg: составные сообщения", () => {
  it("связки на обоих языках", () => {
    const a = framePhrase("feel.sad", {}, "say", "ru", opts);
    const b = framePhrase("people.call", { person: E("p.aliya") }, "say", "ru", opts);
    expect(joinSentences([a, { ...b, connective: "so" }], "ru")).toBe("Мне грустно, поэтому позвони Алии, пожалуйста.");
    const c = framePhrase("feel.miss", { person: E("p.aliya") }, "say", "ru", opts);
    expect(joinSentences([a, { ...c, connective: "because" }], "ru")).toBe("Мне грустно, потому что я скучаю по Алии.");
    expect(joinSentences([a, { ...b, connective: "then" }], "ru")).toBe("Мне грустно. Потом позвони Алии, пожалуйста.");

    const ak = framePhrase("feel.sad", {}, "say", "kk", opts);
    const ck = framePhrase("feel.miss", { person: E("p.aliya") }, "say", "kk", opts);
    expect(joinSentences([ak, { ...ck, connective: "because" }], "kk")).toBe("Көңілім жоқ, себебі мен Әлияны сағындым.");
  });

  it("имя в начале второго предложения не теряет заглавную", () => {
    const a = framePhrase("feel.sad", {}, "say", "kk", opts);
    const b = framePhrase("people.call", { person: E("p.aliya") }, "say", "kk", opts);
    expect(joinSentences([a, { ...b, connective: "so" }], "kk")).toBe("Көңілім жоқ, сондықтан Әлияға қоңырау шалшы.");
  });

  it("вводящая фраза", () => {
    const lead = framePhrase("people.tell", { person: E("p.erlan") }, "lead", "ru", opts);
    const next = framePhrase("feel.miss", { person: E("p.erlan") }, "say", "ru", opts);
    expect(joinSentences([lead, { ...next, afterLead: true }], "ru")).toBe("Передай Ерлану: я скучаю по Ерлану.");
  });

  it("шаблон без слотов не ломается от лишних пробелов", () => {
    expect(renderTemplate("Я  {g:рад|рада} .", {}, "ru", opts)).toBe("Я рада.");
  });
});
