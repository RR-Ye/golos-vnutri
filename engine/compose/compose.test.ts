import { describe, expect, it } from "vitest";
import { demoEntities } from "../demo/index.ts";
import { BUILTIN_ENTITIES } from "../ontology/index.ts";
import { DEFAULT_NLG } from "../nlg/index.ts";
import type { Entity } from "../types.ts";
import { contextEntities, messageText, type MessageSentence } from "./index.ts";

const ents = new Map<string, Entity>([...BUILTIN_ENTITIES, ...demoEntities()].map((e) => [e.id, e]));

describe("составные сообщения", () => {
  const msg: MessageSentence[] = [
    { candidate: { frame: "feel.sad", slots: {} } },
    { candidate: { frame: "feel.miss", slots: { person: "p.aliya" } }, connective: "because" },
    { candidate: { frame: "people.call", slots: { person: "p.aliya" } }, connective: "so" },
  ];

  it("собирает три предложения со связками на обоих языках", () => {
    expect(messageText(msg, ents, "ru", DEFAULT_NLG)).toBe(
      "Мне грустно, потому что я скучаю по Алии, поэтому позвони Алии, пожалуйста.",
    );
    expect(messageText(msg, ents, "kk", DEFAULT_NLG)).toBe(
      "Көңілім жоқ, себебі мен Әлияны сағындым, сондықтан Әлияға қоңырау шалшы.",
    );
  });

  it("вводящая фраза «Передай…» склеивается со следующим предложением без связки", () => {
    const m: MessageSentence[] = [
      { candidate: { frame: "people.tell", slots: { person: "p.erlan" } } },
      { candidate: { frame: "addr.love", slots: {} }, connective: "and" },
    ];
    expect(messageText(m, ents, "ru", DEFAULT_NLG)).toBe("Передай Ерлану: я тебя люблю.");
  });

  it("сущности первого предложения становятся контекстом", () => {
    expect(contextEntities(msg)).toEqual(["p.aliya"]);
  });
});
