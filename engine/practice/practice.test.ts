import { describe, expect, it } from "vitest";
import { difficulty, firstSyllable, newCard, nextLevel, pickNext, record } from "./index.ts";

const NOW = 1_700_000_000_000;

describe("развитие речи", () => {
  it("ступени подсказки: сама — меньше, не смогла — больше", () => {
    expect(nextLevel(0, "self")).toBe(1);
    expect(nextLevel(1, "self")).toBe(2);
    expect(nextLevel(2, "self")).toBe(2);
    expect(nextLevel(2, "failed")).toBe(1);
    expect(nextLevel(0, "failed")).toBe(0);
    expect(nextLevel(1, "prompted")).toBe(1);
  });

  it("трудное — снова в этом занятии, лёгкое — через дни и всё реже", () => {
    let c = newCard("w:su", NOW);
    c = record(c, "failed", NOW);
    expect(c.due - NOW).toBe(2 * 60 * 1000);
    c = record(c, "self", NOW);
    const d1 = c.due - NOW;
    c = record(c, "self", NOW);
    const d2 = c.due - NOW;
    expect(d1).toBe(24 * 60 * 60 * 1000);
    expect(d2).toBe(2 * d1);
  });

  it("чаще показывает то, что пока трудно", () => {
    let easy = newCard("easy", NOW);
    let hard = newCard("hard", NOW);
    for (let i = 0; i < 3; i++) {
      easy = record(easy, "self", NOW);
      hard = record(hard, "failed", NOW);
    }
    expect(difficulty(hard)).toBeGreaterThan(difficulty(easy));
    // у «hard» срок подошёл через 2 минуты, у «easy» — через дни
    expect(pickNext([easy, hard], NOW + 3 * 60 * 1000)?.key).toBe("hard");
    // если срок ни у кого не подошёл — всё равно самая трудная
    expect(pickNext([easy, hard], NOW)?.key).toBe("hard");
  });

  it("не повторяет только что показанную карточку", () => {
    const a = newCard("a", NOW);
    const b = newCard("b", NOW);
    expect(pickNext([a, b], NOW, "a")?.key).toBe("b");
    expect(pickNext([a], NOW, "a")?.key).toBe("a");
  });

  it("первый слог", () => {
    expect(firstSyllable("вода")).toBe("во");
    expect(firstSyllable("Алия")).toBe("А");
    expect(firstSyllable("Ерлан")).toBe("Е");
    expect(firstSyllable("Болат")).toBe("Бо");
    expect(firstSyllable("су")).toBe("с");
    expect(firstSyllable("нан")).toBe("н");
    expect(firstSyllable("Әлия")).toBe("Ә");
    expect(firstSyllable("Нұрлан")).toBe("Нұ");
  });
});
