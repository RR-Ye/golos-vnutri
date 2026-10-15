import { describe, expect, it } from "vitest";
import { demoEntities, demoWords } from "../demo/index.ts";
import { buildModel } from "./model.ts";
import { posterior } from "./search.ts";
import { answerGrid, answerQuestion, newSession, addEvidence } from "./session.ts";
import { candidateKey, parseCandidateKey, questionKey } from "./types.ts";

const model = buildModel({ entities: demoEntities(), words: demoWords(), notes: [], routine: [], now: new Date(2026, 9, 15, 13, 0).getTime() });

describe("ответы и сетка", () => {
  it("ключ кандидата разбирается обратно", () => {
    const c = { frame: "health.pain", slots: { body: "body.head", severity: "sev.2" } };
    expect(parseCandidateKey(candidateKey(c))).toEqual(c);
    const e = { frame: "need.eat", slots: { food: null } };
    expect(parseCandidateKey(candidateKey(e))).toEqual(e);
    expect(questionKey({ level: "topic", topic: "needs" })).toBe("t:needs");
  });

  it("«Почти» на гипотезу: тот же фрейм с другим человеком становится вероятнее", () => {
    let s = addEvidence(newSession(), { kind: "entity", entity: "p.aliya" });
    s = addEvidence(s, { kind: "frame", frame: "people.call" });
    const before = posterior(model, s.evidence).ranked.find((r) => r.key === "people.call|person=p.erlan")!.p;
    s = answerQuestion(s, { level: "hypothesis", candidate: { frame: "people.call", slots: { person: "p.aliya" } } }, "almost");
    const after = posterior(model, s.evidence).ranked.find((r) => r.key === "people.call|person=p.erlan")!.p;
    expect(after).toBeGreaterThan(before);
  });

  it("«Почти» на тему — слабое «да»", () => {
    const s = answerQuestion(addEvidence(newSession(), { kind: "face", level: 4 }), { level: "topic", topic: "health" }, "almost");
    const top = posterior(model, s.evidence).ranked[0]!;
    expect(model.frameIndex.get(top.candidate.frame)!.topic === "health" || model.frameIndex.get(top.candidate.frame)!.alsoTopics?.includes("health")).toBe(true);
  });

  it("выбор в сетке делает выбранную мысль лучшей", () => {
    const shown = ["need.drink", "need.toilet", "need.sleep", "need.cold"];
    const s = answerGrid(addEvidence(newSession(), { kind: "face", level: 3 }), shown, "need.sleep");
    expect(posterior(model, s.evidence).ranked[0]!.key).toBe("need.sleep");
  });

  it("«Нет на всех» убирает показанные мысли наверх списка", () => {
    const shown = ["need.drink", "need.toilet", "need.sleep", "need.cold"];
    let s = addEvidence(newSession(), { kind: "topic", topic: "needs" });
    s = addEvidence(s, { kind: "face", level: 3 });
    s = answerGrid(s, shown, null);
    const top4 = posterior(model, s.evidence).ranked.slice(0, 4).map((r) => r.key);
    for (const k of shown) expect(top4).not.toContain(k);
    expect(s.rejectedInGrid.size).toBe(4);
    expect(s.questionsSinceGrid).toBe(0);
  });
});
