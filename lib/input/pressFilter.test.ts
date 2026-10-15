import { describe, expect, it } from "vitest";
import { PressFilter } from "./pressFilter";

const P = (pointerId: number, time: number, target = "a", width = 10, height = 10) => ({
  pointerId,
  time,
  target,
  width,
  height,
});

describe("PressFilter", () => {
  it("срабатывает на обычное касание", () => {
    const f = new PressFilter();
    f.down(P(1, 0));
    expect(f.up(P(1, 120), "a")).toEqual({ fire: true, target: "a" });
  });

  it("игнорирует касание короче 60 мс", () => {
    const f = new PressFilter();
    f.down(P(1, 0));
    expect(f.up(P(1, 40), "a")).toEqual({ fire: false, reason: "short" });
  });

  it("игнорирует повтор в течение 800 мс и пропускает после", () => {
    const f = new PressFilter();
    f.down(P(1, 0));
    expect(f.up(P(1, 100), "a").fire).toBe(true);
    f.down(P(2, 300));
    expect(f.up(P(2, 400), "a")).toEqual({ fire: false, reason: "cooldown" });
    f.down(P(3, 900));
    expect(f.up(P(3, 1000), "a").fire).toBe(true);
  });

  it("мультитач не срабатывает ни одним пальцем", () => {
    const f = new PressFilter();
    f.down(P(1, 0, "a"));
    f.down(P(2, 20, "b"));
    expect(f.up(P(1, 150), "a")).toEqual({ fire: false, reason: "multitouch" });
    expect(f.up(P(2, 160), "b")).toEqual({ fire: false, reason: "multitouch" });
    // после того как все пальцы подняты, обычное касание снова работает
    f.down(P(3, 2000));
    expect(f.up(P(3, 2100), "a").fire).toBe(true);
  });

  it("ладонь не срабатывает, в том числе если контакт расплылся позже", () => {
    const f = new PressFilter();
    f.down(P(1, 0, "a", 90, 90));
    expect(f.up(P(1, 150), "a")).toEqual({ fire: false, reason: "palm" });
    f.down(P(2, 2000, "a", 10, 10));
    f.move(P(2, 2050, "a", 80, 70));
    expect(f.up(P(2, 2150), "a")).toEqual({ fire: false, reason: "palm" });
  });

  it("без данных о площади касание считается пальцем", () => {
    const f = new PressFilter();
    f.down(P(1, 0, "a", 1, 1));
    expect(f.up(P(1, 100), "a").fire).toBe(true);
  });

  it("палец, съехавший с кнопки, не срабатывает", () => {
    const f = new PressFilter();
    f.down(P(1, 0, "a"));
    expect(f.up(P(1, 100), "b")).toEqual({ fire: false, reason: "moved-off" });
  });
});
