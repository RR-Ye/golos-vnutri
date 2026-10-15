// Демо-данные: вымышленная бабушка Зейнеп и её семья. Все имена и события вымышлены.
import type { DayNote, Entity, RoutineItem, WordEntry } from "@/engine/types";
import type { Settings } from "./types";
import { defaultSettings } from "./settings";

const DAY = 24 * 60 * 60 * 1000;

const person = (
  id: string,
  ru: string,
  kk: string,
  relation: string,
  gender: "m" | "f",
  extra: Partial<Entity> = {},
): Entity => ({
  id,
  type: "person",
  name: { ru, kk },
  relation,
  ruMorph: { gender, animate: true },
  develop: true,
  ...extra,
});

export function demoEntities(): Entity[] {
  return [
    person("p.aliya", "Алия", "Әлия", "дочь", "f", { order: 1 }),
    person("p.erlan", "Ерлан", "Ерлан", "сын", "m", { order: 2 }),
    person("p.aigul", "Айгуль", "Айгүл", "внучка", "f", { order: 3 }),
    person("p.bolat", "Болат", "Болат", "зять", "m", { order: 4 }),
    person("p.nurlan", "Нурлан", "Нұрлан", "внук", "m", { order: 5 }),
    person("p.daulet", "Даулет", "Дәулет", "брат", "m", { order: 6 }),
    person("p.gulnar", "Гульнар", "Гүлнар", "соседка, подруга", "f", { order: 7, develop: false }),

    { id: "pl.home", type: "place", name: { ru: "дом", kk: "үй" }, icon: "home", ruMorph: { gender: "m" }, forms: { ru: { dir: "домой" } }, order: 1 },
    { id: "pl.hospital", type: "place", name: { ru: "больница", kk: "аурухана" }, icon: "hospital", ruMorph: { gender: "f" }, order: 2 },
    { id: "pl.dacha", type: "place", name: { ru: "дача", kk: "саяжай" }, icon: "tree", ruMorph: { gender: "f" }, forms: { ru: { dir: "на дачу", loc: "на даче" } }, order: 3 },
    { id: "pl.mosque", type: "place", name: { ru: "мечеть", kk: "мешіт" }, icon: "pray", ruMorph: { gender: "f" }, order: 4 },
    { id: "pl.aul", type: "place", name: { ru: "аул", kk: "ауыл" }, icon: "sunrise", ruMorph: { gender: "m" }, order: 5 },

    { id: "th.phone", type: "thing", name: { ru: "телефон", kk: "телефон" }, icon: "phone", ruMorph: { gender: "m" }, develop: true, order: 1 },
    { id: "th.glasses", type: "thing", name: { ru: "очки", kk: "көзілдірік" }, icon: "book", ruMorph: { gender: "n", pluralOnly: true }, order: 2 },
    { id: "th.remote", type: "thing", name: { ru: "пульт", kk: "пульт" }, icon: "tv", ruMorph: { gender: "m" }, order: 3 },
    { id: "th.blanket", type: "thing", name: { ru: "одеяло", kk: "көрпе" }, icon: "bed", ruMorph: { gender: "n" }, order: 4 },
    { id: "th.pillow", type: "thing", name: { ru: "подушка", kk: "жастық" }, icon: "bed", ruMorph: { gender: "f" }, order: 5 },
    { id: "th.beads", type: "thing", name: { ru: "чётки", kk: "тәспі" }, icon: "beads", ruMorph: { gender: "f", pluralOnly: true }, order: 6 },

    { id: "fd.bread", type: "food", name: { ru: "хлеб", kk: "нан" }, icon: "bread", ruMorph: { gender: "m" }, develop: true, order: 1 },
    { id: "fd.tea", type: "food", name: { ru: "чай", kk: "шай" }, icon: "water", ruMorph: { gender: "m" }, develop: true, order: 2 },
    { id: "fd.soup", type: "food", name: { ru: "суп", kk: "сорпа" }, icon: "food", ruMorph: { gender: "m" }, order: 3 },
    { id: "fd.porridge", type: "food", name: { ru: "каша", kk: "ботқа" }, icon: "food", ruMorph: { gender: "f" }, order: 4 },
    { id: "fd.apple", type: "food", name: { ru: "яблоко", kk: "алма" }, icon: "food", ruMorph: { gender: "n" }, order: 5 },

    { id: "md.morning", type: "medicine", name: { ru: "утренние таблетки", kk: "таңғы дәрі" }, icon: "pill", ruMorph: { gender: "f", pluralOnly: true }, schedule: ["morning"], order: 1 },
    { id: "md.evening", type: "medicine", name: { ru: "вечерние таблетки", kk: "кешкі дәрі" }, icon: "pill", ruMorph: { gender: "f", pluralOnly: true }, schedule: ["evening"], order: 2 },
    { id: "md.drops", type: "medicine", name: { ru: "капли", kk: "тамшы" }, icon: "droplet", ruMorph: { gender: "f", pluralOnly: true }, schedule: ["morning", "evening"], order: 3 },

    { id: "ev.wedding", type: "event", name: { ru: "свадьба Алии", kk: "Әлияның тойы" }, icon: "heart", ruMorph: { gender: "f" }, forms: { ru: { acc: "свадьбу Алии", pre: "свадьбе Алии" } }, order: 1 },
    { id: "ev.nauryz", type: "event", name: { ru: "Наурыз", kk: "Наурыз" }, icon: "sunrise", ruMorph: { gender: "m" }, order: 2 },
    { id: "ev.school", type: "event", name: { ru: "работа в школе", kk: "мектептегі жұмыс" }, icon: "book", ruMorph: { gender: "f" }, forms: { ru: { acc: "работу в школе", pre: "работе в школе" } }, order: 3 },
  ];
}

export function demoWords(now = Date.now()): WordEntry[] {
  return [
    {
      id: "w.sen",
      text: "сен",
      lang: "kk",
      translation: "ты",
      meanings: [
        { target: { kind: "topic", topic: "address" }, weight: 0.5 },
        { target: { kind: "frame", frame: "addr.help" }, weight: 0.3 },
        { target: { kind: "frame", frame: "addr.its_you" }, weight: 0.2 },
      ],
      oftenRepeats: true,
      develop: true,
      createdAt: now,
    },
    {
      id: "w.su",
      text: "су",
      lang: "kk",
      translation: "вода",
      meanings: [
        { target: { kind: "frame", frame: "need.drink" }, weight: 0.6 },
        { target: { kind: "frame", frame: "health.bad" }, weight: 0.3 },
        { target: { kind: "frame", frame: "need.toilet" }, weight: 0.1 },
      ],
      oftenRepeats: false,
      develop: true,
      createdAt: now,
    },
    {
      id: "w.zhok",
      text: "жоқ",
      lang: "kk",
      translation: "нет",
      meanings: [
        { target: { kind: "frame", frame: "op.disagree" }, weight: 0.5 },
        { target: { kind: "frame", frame: "op.dont" }, weight: 0.3 },
        { target: { kind: "frame", frame: "med.refuse" }, weight: 0.2 },
      ],
      oftenRepeats: false,
      develop: false,
      createdAt: now,
    },
    {
      id: "w.aliya",
      text: "Алия",
      lang: "ru",
      translation: "Әлия",
      meanings: [{ target: { kind: "entity", entity: "p.aliya" }, weight: 1 }],
      oftenRepeats: false,
      develop: true,
      createdAt: now,
    },
  ];
}

export function demoRoutine(): RoutineItem[] {
  return [
    { id: "r1", band: "morning", frame: "med.give", strength: 3 },
    { id: "r2", band: "morning", frame: "need.eat", strength: 2 },
    { id: "r3", band: "morning", frame: "need.wash", strength: 2 },
    { id: "r4", band: "day", frame: "need.eat", strength: 2 },
    { id: "r5", band: "day", frame: "place.outside", strength: 1 },
    { id: "r6", band: "evening", frame: "med.give", strength: 2 },
    { id: "r7", band: "evening", frame: "need.sleep", strength: 2 },
    { id: "r8", band: "night", frame: "need.toilet", strength: 2 },
    { id: "r9", band: "night", frame: "need.turn", strength: 2 },
  ];
}

export function demoNotes(now = Date.now()): DayNote[] {
  return [
    { id: "n1", text: "Сегодня приезжал врач", entityIds: [], topics: ["health"], createdAt: now, until: now + DAY },
    { id: "n2", text: "Звонила Алия", entityIds: ["p.aliya"], topics: ["people"], createdAt: now, until: now + DAY },
    { id: "n3", text: "Завтра приедет Ерлан", entityIds: ["p.erlan"], topics: ["people"], createdAt: now, until: now + 2 * DAY },
  ];
}

export function demoSettings(pin: { pinHash: string; pinSalt: string }): Settings {
  return { ...defaultSettings(), ...pin, personName: "Зейнеп апа" };
}
