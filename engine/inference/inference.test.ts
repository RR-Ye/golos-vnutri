import { describe, expect, it } from "vitest";
import { demoEntities, demoNotes, demoRoutine, demoWords } from "../demo/index.ts";
import type { Evidence } from "./types.ts";
import { candidateKey } from "./types.ts";
import { buildModel, type EngineInput } from "./model.ts";
import { logPrior } from "./likelihood.ts";
import { beamSearch, explain, posterior, scoreCandidate } from "./search.ts";
import { answerQuestion, evaluate, newSession, addEvidence } from "./session.ts";

const MORNING = new Date(2026, 9, 15, 9, 0).getTime();
const NIGHT = new Date(2026, 9, 15, 23, 30).getTime();

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    entities: demoEntities(),
    words: demoWords(),
    notes: [],
    routine: [],
    now: MORNING,
    ...over,
  };
}

const top = (ev: Evidence[], over: Partial<EngineInput> = {}) => posterior(buildModel(input(over)), ev).ranked[0]!;

describe("вывод: свидетельства", () => {
  it("слово «су» ведёт к «хочу пить»", () => {
    expect(top([{ kind: "word", word: "w.su", confidence: 0.9, repeats: 1 }]).key).toBe("need.drink");
  });

  it("тема «Люди» и фото Алии ведут к мысли про Алию", () => {
    const t = top([
      { kind: "topic", topic: "people" },
      { kind: "entity", entity: "p.aliya" },
    ]);
    expect(Object.values(t.candidate.slots)).toContain("p.aliya");
  });

  it("голова и красное лицо — сильная боль в голове", () => {
    const t = top([
      { kind: "body", entity: "body.head" },
      { kind: "severity", level: 5 },
    ]);
    expect(t.key).toBe(candidateKey({ frame: "health.pain", slots: { body: "body.head", severity: "sev.3" } }));
  });

  it("плитка мысли почти однозначна", () => {
    const t = top([
      { kind: "topic", topic: "needs" },
      { kind: "frame", frame: "need.toilet" },
    ]);
    expect(t.key).toBe("need.toilet");
    expect(t.p).toBeGreaterThan(0.75);
  });

  it("повтор слова усиливает, если слово не помечено «часто повторяет»", () => {
    const m = buildModel(input());
    const once = posterior(m, [{ kind: "word", word: "w.su", confidence: 0.9, repeats: 1 }]).ranked[0]!.p;
    const thrice = posterior(m, [{ kind: "word", word: "w.su", confidence: 0.9, repeats: 3 }]).ranked[0]!.p;
    expect(thrice).toBeGreaterThan(once);
    // «сен» помечено «часто повторяет» — повтор ничего не меняет
    const a = posterior(m, [{ kind: "word", word: "w.sen", confidence: 0.9, repeats: 1 }]).ranked[0]!;
    const b = posterior(m, [{ kind: "word", word: "w.sen", confidence: 0.9, repeats: 4 }]).ranked[0]!;
    expect(b.p).toBeCloseTo(a.p, 10);
  });

  it("низкая уверенность распознавания ослабляет слово", () => {
    const m = buildModel(input());
    const sure = posterior(m, [{ kind: "word", word: "w.su", confidence: 0.95, repeats: 1 }]).ranked[0]!.p;
    const unsure = posterior(m, [{ kind: "word", word: "w.su", confidence: 0.3, repeats: 1 }]).ranked[0]!.p;
    expect(unsure).toBeLessThan(sure);
  });
});

describe("вывод: априоры", () => {
  it("ночью сон вероятнее, чем утром", () => {
    const night = buildModel(input({ now: NIGHT }));
    const morning = buildModel(input({ now: MORNING }));
    const c = { frame: "need.sleep", slots: {} };
    expect(logPrior(night, c)).toBeGreaterThan(logPrior(morning, c));
  });

  it("распорядок поднимает утренние лекарства", () => {
    const withRoutine = buildModel(input({ routine: demoRoutine() }));
    const without = buildModel(input());
    const c = { frame: "med.give", slots: { med: "md.morning" } };
    expect(logPrior(withRoutine, c)).toBeGreaterThan(logPrior(without, c));
  });

  it("заметка дня поднимает связанного человека", () => {
    const m = buildModel(input({ notes: demoNotes(MORNING - 1000) }));
    const erlan = logPrior(m, { frame: "people.when", slots: { person: "p.erlan" } });
    const bolat = logPrior(m, { frame: "people.when", slots: { person: "p.bolat" } });
    expect(erlan).toBeGreaterThan(bolat);
  });

  it("выключенные фреймы не участвуют, пока их не включат", () => {
    expect(buildModel(input()).frameIndex.has("spirit.pray")).toBe(false);
    expect(buildModel(input({ frameToggles: { "spirit.pray": true } })).frameIndex.has("spirit.pray")).toBe(true);
  });
});

describe("вывод: шумные ответы", () => {
  it("один ошибочный «нет» не убивает правильную гипотезу", () => {
    const m = buildModel(input());
    let s = newSession();
    s = addEvidence(s, { kind: "word", word: "w.su", confidence: 0.9, repeats: 1 });
    s = answerQuestion(s, { level: "hypothesis", candidate: { frame: "need.drink", slots: {} } }, "no"); // ошиблась
    s = answerQuestion(s, { level: "topic", topic: "needs" }, "yes");
    s = answerQuestion(s, { level: "hypothesis", candidate: { frame: "need.drink", slots: {} } }, "yes");
    const r = evaluate(m, s, { threshold: 0.75, maxQuestions: 6 });
    expect(r.post.ranked[0]!.key).toBe("need.drink");
  });

  it("«да» на вопрос о целой гипотезе выше порога — сразу принять", () => {
    const m = buildModel(input());
    let s = newSession();
    s = addEvidence(s, { kind: "word", word: "w.su", confidence: 0.9, repeats: 1 });
    s = answerQuestion(s, { level: "hypothesis", candidate: { frame: "need.drink", slots: {} } }, "yes");
    expect(evaluate(m, s, { threshold: 0.75, maxQuestions: 6 }).decision.kind).toBe("accept");
  });

  it("только навигация по темам — ещё не спрашиваем", () => {
    const m = buildModel(input());
    const s = addEvidence(newSession(), { kind: "topic", topic: "people" });
    expect(evaluate(m, s, { threshold: 0.75, maxQuestions: 6 }).decision.kind).toBe("wait");
  });

  it("после лимита вопросов предлагается сетка из 4 картинок", () => {
    const m = buildModel(input());
    let s = addEvidence(newSession(), { kind: "topic", topic: "feelings" });
    s = addEvidence(s, { kind: "face", level: 4 });
    for (const t of ["needs", "health", "people", "places", "things", "daily"] as const) {
      s = answerQuestion(s, { level: "topic", topic: t }, "no");
    }
    const d = evaluate(m, s, { threshold: 0.99, maxQuestions: 6 }).decision;
    expect(d.kind).toBe("grid");
    if (d.kind === "grid") expect(d.options.length).toBe(4);
  });
});

describe("вывод: лучевой поиск", () => {
  it("находит то же лучшее, что и полный перебор", () => {
    const m = buildModel(input({ routine: demoRoutine(), notes: demoNotes(MORNING - 1000) }));
    const sets: Evidence[][] = [
      [{ kind: "topic", topic: "people" }, { kind: "entity", entity: "p.erlan" }],
      [{ kind: "face", level: 5 }, { kind: "body", entity: "body.lleg" }],
      [{ kind: "word", word: "w.sen", confidence: 0.8, repeats: 3 }],
      [{ kind: "topic", topic: "things" }, { kind: "entity", entity: "th.glasses" }, { kind: "word", word: "w.zhok", confidence: 0.7, repeats: 1 }],
    ];
    for (const ev of sets) {
      // полный перебор
      let bestKey = "";
      let best = -Infinity;
      for (const f of m.frames) {
        const combos: Record<string, string | null>[] = [{}];
        for (const s of f.slots) {
          const vals: (string | null)[] = s.types.flatMap((t) => (m.byType.get(t) ?? []).map((e) => e.id));
          if (s.optional) vals.push(null);
          const next: Record<string, string | null>[] = [];
          for (const c of combos) for (const v of vals) next.push({ ...c, [s.name]: v });
          combos.splice(0, combos.length, ...next);
        }
        for (const slots of combos) {
          const sc = scoreCandidate(m, ev, { frame: f.id, slots });
          if (sc > best) {
            best = sc;
            bestKey = candidateKey({ frame: f.id, slots });
          }
        }
      }
      expect(candidateKey(beamSearch(m, ev)[0]!.c)).toBe(bestKey);
    }
  });

  it("объяснение показывает вклад каждого свидетельства", () => {
    const m = buildModel(input());
    const ev: Evidence[] = [{ kind: "word", word: "w.su", confidence: 0.9, repeats: 1 }, { kind: "face", level: 2 }];
    const ex = explain(m, ev, { frame: "need.drink", slots: {} });
    expect(ex.map((x) => x.label)).toEqual(["prior", "word", "face"]);
    expect(ex[1]!.weight).toBeGreaterThan(0);
  });
});
