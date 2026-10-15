import { describe, expect, it } from "vitest";
import { demoEntities, demoWords } from "../demo/index.ts";
import { logPrior } from "../inference/likelihood.ts";
import { buildModel, emptyLearned, type EngineInput } from "../inference/model.ts";
import { posterior } from "../inference/search.ts";
import type { Evidence } from "../inference/types.ts";
import { learnConfirmed, learnRejected } from "./index.ts";

const MORNING = new Date(2026, 9, 15, 9, 0).getTime();
const base = (learned = emptyLearned()): EngineInput => ({
  entities: demoEntities(),
  words: demoWords(),
  notes: [],
  routine: [],
  now: MORNING,
  learned,
});

describe("обучение", () => {
  it("подтверждения поднимают априор фрейма в это время суток", () => {
    let learned = emptyLearned();
    const m0 = buildModel(base());
    const c = { frame: "people.call", slots: { person: "p.nurlan" } };
    for (let i = 0; i < 15; i++) learned = learnConfirmed(learned, buildModel(base(learned)), c, []);
    const m1 = buildModel(base(learned));
    expect(logPrior(m1, c)).toBeGreaterThan(logPrior(m0, c) + 1);
  });

  it("веса значений слова уточняются по истории", () => {
    let learned = emptyLearned();
    const ev: Evidence[] = [{ kind: "word", word: "w.su", confidence: 0.9, repeats: 1 }];
    // «су» у неё на самом деле чаще значит «мне плохо»
    for (let i = 0; i < 10; i++) learned = learnConfirmed(learned, buildModel(base(learned)), { frame: "health.bad", slots: {} }, ev);
    const top = posterior(buildModel(base(learned)), ev).ranked[0]!;
    expect(top.key).toBe("health.bad");
  });

  it("ошибочные ответы учат вероятность ошибки", () => {
    let learned = emptyLearned();
    const m = buildModel(base());
    const truth = { frame: "need.drink", slots: {} };
    const wrong: Evidence = { kind: "answer", question: { level: "topic", topic: "needs" }, answer: "no" };
    const right: Evidence = { kind: "answer", question: { level: "topic", topic: "health" }, answer: "no" };
    for (let i = 0; i < 10; i++) learned = learnConfirmed(learned, m, truth, [wrong, right]);
    expect(learned.answerErrors).toEqual([10, 20]);
    expect(buildModel(base(learned)).epsilon).toBeGreaterThan(0.3);
  });

  it("отклонённая фраза снижает априор, но не обнуляет", () => {
    const c = { frame: "feel.angry", slots: {} };
    let learned = emptyLearned();
    for (let i = 0; i < 50; i++) learned = learnRejected(learned, c, "morning");
    const m0 = buildModel(base());
    const m1 = buildModel(base(learned));
    expect(logPrior(m1, c)).toBeLessThan(logPrior(m0, c));
    expect(Number.isFinite(logPrior(m1, c))).toBe(true);
  });
});
