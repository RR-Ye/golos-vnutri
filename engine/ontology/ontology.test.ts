import { describe, expect, it } from "vitest";
import { FRAMES, OntologyError, TEMPLATES, TOPIC_IDS, validateFrames } from "./index.ts";

describe("онтология", () => {
  it("загружает не меньше 40 фреймов с шаблонами на обоих языках", () => {
    expect(FRAMES.length).toBeGreaterThanOrEqual(40);
    for (const f of FRAMES) {
      expect(TEMPLATES.ru.frames[f.id]?.say).toBeTruthy();
      expect(TEMPLATES.kk.frames[f.id]?.ask).toBeTruthy();
    }
  });

  it("отклоняет фрейм с неизвестной темой", () => {
    expect(() =>
      validateFrames([{ id: "x", topic: "nope" as never, icon: "", slots: [], prior: 1, face: "any" }], TOPIC_IDS),
    ).toThrow(OntologyError);
  });

  it("отклоняет повтор id", () => {
    const f = { id: "x", topic: "needs" as const, icon: "", slots: [], prior: 1, face: "any" as const };
    expect(() => validateFrames([f, f], TOPIC_IDS)).toThrow(/повторяется/);
  });
});
