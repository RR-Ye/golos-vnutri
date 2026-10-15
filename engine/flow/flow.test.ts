import { describe, expect, it } from "vitest";
import { demoEntities, demoWords } from "../demo/index.ts";
import { buildModel, emptyLearned } from "../inference/model.ts";
import { posterior } from "../inference/search.ts";
import { learnConfirmed } from "../learning/index.ts";
import { entityActionTiles, homeTiles, paginate, slotChoiceTiles, tileKey, topicTiles } from "./index.ts";

const NIGHT = new Date(2026, 9, 15, 23, 0).getTime();
const model = buildModel({ entities: demoEntities(), words: demoWords(), notes: [], routine: [], now: NIGHT });

describe("экраны", () => {
  it("тема «Люди» начинается с фото родных", () => {
    const tiles = topicTiles(model, posterior(model, [{ kind: "topic", topic: "people" }]), "people");
    expect(tiles[0]!.kind).toBe("entity");
    expect(tiles.filter((t) => t.kind === "entity")).toHaveLength(7);
  });

  it("в «Боль и здоровье» первыми идут тело и лица", () => {
    const tiles = topicTiles(model, posterior(model, []), "health");
    expect(tiles.slice(0, 2).map((t) => t.kind)).toEqual(["body", "faces"]);
  });

  it("«Сделай…» доступно плиткой в потребностях, действия — выбором после неё", () => {
    const tiles = topicTiles(model, posterior(model, []), "needs");
    expect(tiles.some((t) => t.kind === "frame" && t.frame === "addr.do")).toBe(true);
    const choices = slotChoiceTiles(model, posterior(model, [{ kind: "frame", frame: "addr.do" }]), "addr.do");
    expect(choices.every((t) => t.kind === "entity" && t.entity.startsWith("act."))).toBe(true);
  });

  it("после фото — мысли с этим человеком", () => {
    const tiles = entityActionTiles(model, posterior(model, [{ kind: "entity", entity: "p.aliya" }]), "p.aliya");
    const frames = tiles.map((t) => (t.kind === "frame" ? t.frame : ""));
    expect(frames).toContain("people.call");
    expect(frames).toContain("feel.miss");
  });

  it("листание без прокрутки: последняя плитка — «Ещё»", () => {
    const all = topicTiles(model, posterior(model, []), "needs");
    expect(all.length).toBeGreaterThan(6);
    const p0 = paginate(all, 6, 0);
    expect(p0.tiles).toHaveLength(6);
    expect(p0.tiles[5]!.kind).toBe("more");
    const seen = new Set<string>();
    for (let i = 0; i < p0.pages; i++) for (const t of paginate(all, 6, i).tiles) seen.add(tileKey(t));
    for (const t of all) expect(seen.has(tileKey(t))).toBe(true);
  });

  it("догадка на главном экране появляется только после обучения", () => {
    const topics = ["needs", "health", "people"] as const;
    expect(homeTiles(model, posterior(model, []), topics)[0]!.kind).toBe("topic");
    let learned = emptyLearned();
    for (let i = 0; i < 40; i++) learned = learnConfirmed(learned, model, { frame: "need.turn", slots: {} }, []);
    const m2 = buildModel({ entities: demoEntities(), words: demoWords(), notes: [], routine: [], now: NIGHT, learned });
    const first = homeTiles(m2, posterior(m2, []), topics)[0]!;
    expect(first).toEqual({ kind: "candidate", key: "need.turn" });
  });
});
