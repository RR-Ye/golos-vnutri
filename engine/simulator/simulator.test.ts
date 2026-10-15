import { describe, expect, it } from "vitest";
import { demoEntities, demoNotes, demoRoutine, demoWords } from "../demo/index.ts";
import { MATCHED, SPEC, runBatch } from "./index.ts";

const base = { entities: demoEntities(), words: demoWords(), notes: demoNotes(new Date(2026, 9, 15, 0, 0).getTime()), routine: demoRoutine() };

describe("симулятор", () => {
  it("цель ТЗ: в среднем не больше 5 шагов и не меньше 90 % правильных фраз", () => {
    const s = runBatch(base, { runs: 1000, seed: 45, profile: SPEC, flatten: 0 });
    expect(s.correctRate).toBeGreaterThanOrEqual(0.9);
    expect(s.meanSteps).toBeLessThanOrEqual(5);
  }, 60_000);

  it("с промахами мимо плиток остаётся не меньше 90 % правильных", () => {
    const s = runBatch(base, { runs: 300, seed: 7, profile: MATCHED, flatten: 0 });
    expect(s.correctRate).toBeGreaterThanOrEqual(0.9);
  }, 60_000);

  it("детерминирован при одном seed", () => {
    const a = runBatch(base, { runs: 50, seed: 3, profile: MATCHED, flatten: 0 });
    const b = runBatch(base, { runs: 50, seed: 3, profile: MATCHED, flatten: 0 });
    expect(a.meanSteps).toBe(b.meanSteps);
  });
});
