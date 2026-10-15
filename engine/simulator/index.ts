// Симулятор: виртуальная бабушка с заданной мыслью проходит те же экраны, что и в приложении,
// нажимает с ошибками, отвечает с шумом, повторяет слова. Меряем шаги до правильной фразы.
import { FRAMES, frameTopics } from "../ontology/index.ts";
import { posterior } from "../inference/search.ts";
import {
  entityActionTiles,
  homeTiles,
  needsSlotChoice,
  paginate,
  preferEntityActions,
  slotChoiceTiles,
  tileKey,
  topicTiles,
  type FlowTile,
} from "../flow/index.ts";
import { slotOptions } from "../inference/likelihood.ts";
import { buildModel, type EngineInput, type EngineModel, type LearnedCounts } from "../inference/model.ts";
import { addEvidence, answerGrid, answerQuestion, evaluate, newSession, rejectConfirm, type SessionState } from "../inference/session.ts";
import { candidateKey, type Candidate, type Question } from "../inference/types.ts";
import { questionTruth } from "../inference/likelihood.ts";
import { learnConfirmed, learnRejected } from "../learning/index.ts";
import type { BuiltinEntity } from "../ontology/index.ts";
import type { FaceLevel, TopicId } from "../types.ts";

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GrandmaProfile {
  /** Ошибка в выборе темы. */
  topicError: number;
  /** Ошибка нажатия на плитку (соседняя плитка). */
  tileError: number;
  /** Истинная вероятность ошибочного ответа «да/нет». */
  answerError: number;
  /** Вероятность сказать своё слово в начале. */
  wordUse: number;
  /** Вероятность, что слово сказано серией повторов. */
  repeat: number;
  /** Вероятность сказать слово невпопад (значение не связано с мыслью). */
  wordNoise: number;
  /** Вероятность, что распознавание выберет не то слово. */
  asrError: number;
}

/** Ровно то, что в ТЗ: шумные ответы (0.1) и повторы слов, нажимает туда, куда хотела. */
export const SPEC: GrandmaProfile = { topicError: 0, tileError: 0, answerError: 0.1, wordUse: 0.3, repeat: 0.3, wordNoise: 0, asrError: 0.1 };
export const MATCHED: GrandmaProfile = { topicError: 0.08, tileError: 0.06, answerError: 0.1, wordUse: 0.3, repeat: 0.3, wordNoise: 0, asrError: 0.1 };
export const MISMATCH: GrandmaProfile = { topicError: 0.15, tileError: 0.12, answerError: 0.15, wordUse: 0.35, repeat: 0.4, wordNoise: 0.3, asrError: 0.15 };

export interface SimOptions {
  threshold: number;
  maxQuestions: number;
  tilesPerPage: number;
  homeTopics: TopicId[];
  maxSteps: number;
  trace?: (line: string) => void;
}

export const DEFAULT_SIM: SimOptions = {
  threshold: 0.75,
  maxQuestions: 6,
  tilesPerPage: 6,
  homeTopics: ["needs", "health", "people", "feelings", "things", "places", "memories", "opinion"],
  maxSteps: 25,
};

export interface RunResult {
  target: string;
  confirmed: string | null;
  correct: boolean;
  steps: number;
  questions: number;
  grids: number;
  restarts: number;
}

function sampleIndex(r: () => number, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]!;
    if (x <= 0) return i;
  }
  return weights.length - 1;
}

/** Мысль из априора модели (с подмешанной равномерной частью, если flatten > 0). */
export function sampleTarget(model: EngineModel, r: () => number, flatten = 0): Candidate {
  const frames = model.frames.filter((f) => FRAMES.includes(f));
  const w = frames.map((f) => (1 - flatten) * Math.exp(model.logFramePrior.get(f.id) ?? -Infinity) + flatten / frames.length);
  const f = frames[sampleIndex(r, w)]!;
  const slots: Record<string, string | null> = {};
  for (const s of f.slots) {
    let opts = slotOptions(model, f, s);
    // После выбора зоны тела интерфейс всегда спрашивает силу боли.
    if (s.types.includes("severity")) opts = opts.filter((o) => o.value !== null);
    slots[s.name] = opts[sampleIndex(r, opts.map((o) => Math.exp(o.logP)))]!.value;
  }
  return { frame: f.id, slots };
}

const SEVERITY_FACE: Record<string, FaceLevel> = { "sev.1": 3, "sev.2": 4, "sev.3": 5 };

type Screen =
  | { kind: "home"; page: number }
  | { kind: "topic"; topic: TopicId; page: number }
  | { kind: "actions"; entity: string; page: number }
  | { kind: "choices"; frame: string; page: number }
  | { kind: "body" }
  | { kind: "severity" }
  | { kind: "faces" };

const ENTITY_TOPIC: Record<string, TopicId> = {
  person: "people",
  thing: "things",
  food: "things",
  medicine: "things",
  place: "places",
  event: "memories",
};

/** Цель на экранах: зона тела, фото сущности или плитка мысли. */
interface Goal {
  topic: TopicId;
  body: boolean;
  entity: string | null;
  /** Сначала плитка мысли, потом выбор сущности (для действий). */
  viaFrame: boolean;
}

function goalFor(model: EngineModel, target: Candidate, homeTopics: readonly TopicId[]): Goal {
  const f = model.frameIndex.get(target.frame)!;
  if (f.slots.some((sl) => sl.types.includes("bodypart"))) return { topic: "health", body: true, entity: null, viaFrame: false };
  const topics = frameTopics(f) as TopicId[];
  const frameTopic = topics.find((t) => homeTopics.includes(t)) ?? topics[0]!;
  const entitySlot = f.slots.find((sl) => target.slots[sl.name] && !sl.types.includes("severity"));
  const entity = entitySlot ? target.slots[entitySlot.name]! : null;
  if (entity) {
    const t = ENTITY_TOPIC[model.entities.get(entity)!.type];
    if (t) return { topic: t, body: false, entity, viaFrame: false };
    return { topic: frameTopic, body: false, entity, viaFrame: true };
  }
  return { topic: frameTopic, body: false, entity: null, viaFrame: false };
}

/** Один разговор. */
export function runOne(model: EngineModel, target: Candidate, profile: GrandmaProfile, opts: SimOptions, r: () => number): RunResult {
  const targetKey = candidateKey(target);
  const tf = model.frameIndex.get(target.frame)!;
  const policy = { threshold: opts.threshold, maxQuestions: opts.maxQuestions };
  const goal = goalFor(model, target, opts.homeTopics);
  let s: SessionState = newSession();
  let steps = 0;
  let questions = 0;
  let grids = 0;
  let restarts = 0;
  let screen = { kind: "home", page: 0 } as Screen;
  let topicNow: TopicId = goal.topic;
  const homePrior = posterior(model, []);
  const flip = (truth: boolean) => (r() < profile.answerError ? !truth : truth);
  const result = (confirmed: string | null): RunResult => ({
    target: targetKey,
    confirmed,
    correct: confirmed === targetKey,
    steps,
    questions,
    grids,
    restarts,
  });

  const isWanted = (t: FlowTile) =>
    goal.body
      ? t.kind === "body"
      : goal.entity && !goal.viaFrame
        ? t.kind === "entity" && t.entity === goal.entity
        : t.kind === "frame" && t.frame === target.frame;

  /** Нажатие с возможной ошибкой: вместо нужной — соседняя плитка. */
  const tap = (tiles: FlowTile[], want: (t: FlowTile) => boolean): FlowTile | null => {
    const idx = tiles.findIndex(want);
    if (idx < 0) return null;
    if (r() < profile.tileError && tiles.length > 1) {
      let j = Math.floor(r() * (tiles.length - 1));
      if (j >= idx) j++;
      return tiles[j]!;
    }
    return tiles[idx]!;
  };

  const restart = () => {
    s = newSession();
    screen = { kind: "home", page: 0 };
    restarts++;
  };

  // Своё слово в начале разговора
  if (r() < profile.wordUse) {
    const words = [...model.words.values()];
    const relevant = words.filter((w) =>
      w.meanings.some((m) =>
        m.target.kind === "frame"
          ? m.target.frame === target.frame
          : m.target.kind === "topic"
            ? frameTopics(tf).includes(m.target.topic)
            : Object.values(target.slots).includes(m.target.entity),
      ),
    );
    let pick = r() < profile.wordNoise ? words[Math.floor(r() * words.length)] : relevant[Math.floor(r() * relevant.length)];
    if (pick) {
      if (r() < profile.asrError) pick = words[Math.floor(r() * words.length)]!;
      const repeats = r() < profile.repeat ? 2 + Math.floor(r() * 3) : 1;
      s = addEvidence(s, { kind: "word", word: pick.entry.id, confidence: 0.6 + 0.35 * r(), repeats });
      steps++;
    }
  }

  while (steps < opts.maxSteps) {
    // На экранах тела, силы боли и лиц она выбирает — движок не перебивает вопросами.
    const midFlow = screen.kind === "body" || screen.kind === "severity" || screen.kind === "faces";
    const evaluated = evaluate(model, s, policy);
    const post = evaluated.post;
    const decision = midFlow ? ({ kind: "wait" } as const) : evaluated.decision;
    const last = s.evidence[s.evidence.length - 1];

    opts.trace?.(`  лучшая ${post.ranked[0]?.key} p=${post.ranked[0]?.p.toFixed(2)} → ${decision.kind}${decision.kind === "ask" ? " " + JSON.stringify(decision.question) : ""}`);
    if (decision.kind === "accept") return result(decision.top.key);
    if (decision.kind === "confirm") {
      steps++;
      questions++;
      if (flip(decision.top.key === targetKey)) return result(decision.top.key);
      s = rejectConfirm(s, decision.top.candidate);
      continue;
    }
    if (decision.kind === "grid") {
      grids++;
      steps++;
      const keys = decision.options.map((o) => o.key);
      let picked: string | null = keys.includes(targetKey) ? targetKey : null;
      if (r() < profile.tileError) picked = r() < 0.5 ? null : keys[Math.floor(r() * keys.length)]!;
      s = answerGrid(s, keys, picked);
      continue;
    }
    if (screen.kind !== "choices" && needsSlotChoice(model, decision, last) && last?.kind === "frame") {
      screen = { kind: "choices", frame: last.frame, page: 0 };
    }
    if (decision.kind === "ask" && screen.kind !== "choices") {
      const actions = last?.kind === "entity" ? entityActionTiles(model, post, last.entity) : [];
      if (screen.kind !== "actions" && last?.kind === "entity" && preferEntityActions(decision, last, actions)) {
        screen = { kind: "actions", entity: last.entity, page: 0 };
      }
      if (screen.kind !== "actions") {
        const q: Question = decision.question;
        steps++;
        questions++;
        s = answerQuestion(s, q, flip(questionTruth(model, q, target) === true) ? "yes" : "no");
        continue;
      }
    }

    // Навигация по экранам: каждое нажатие — шаг.
    steps++;
    const sc: Screen = screen;
    opts.trace?.(`экран ${sc.kind}${"topic" in sc ? " " + sc.topic : ""}${"page" in sc ? " стр." + sc.page : ""}`);
    switch (sc.kind) {
      case "home": {
        const all = homeTiles(model, homePrior, opts.homeTopics);
        const page = paginate(all, opts.tilesPerPage, sc.page);
        const suggestion = page.tiles.find((t) => t.kind === "candidate");
        if (suggestion?.kind === "candidate" && suggestion.key === targetKey) {
          s = addEvidence(s, { kind: "grid", shown: [suggestion.key], picked: suggestion.key });
          break;
        }
        const want = r() < profile.topicError ? opts.homeTopics[Math.floor(r() * opts.homeTopics.length)]! : goal.topic;
        if (!page.tiles.some((t) => t.kind === "topic" && t.topic === want)) {
          screen = { kind: "home", page: sc.page + 1 };
          break;
        }
        topicNow = want;
        s = addEvidence(s, { kind: "topic", topic: want });
        screen = { kind: "topic", topic: want, page: 0 };
        break;
      }
      case "topic": {
        const all = topicTiles(model, post, sc.topic);
        // Не та тема (промах): она сразу начинает заново.
        if (!all.some(isWanted)) {
          restart();
          break;
        }
        const page = paginate(all, opts.tilesPerPage, sc.page);
        const tapped = tap(page.tiles, isWanted) ?? page.tiles.find((t) => t.kind === "more") ?? null;
        if (!tapped) {
          restart();
          break;
        }
        if (tapped.kind === "more") screen = { kind: "topic", topic: sc.topic, page: sc.page + 1 };
        else if (tapped.kind === "body") screen = { kind: "body" };
        else if (tapped.kind === "faces") screen = { kind: "faces" };
        else if (tapped.kind === "frame") s = addEvidence(s, { kind: "frame", frame: tapped.frame });
        else if (tapped.kind === "entity") s = addEvidence(s, { kind: "entity", entity: tapped.entity });
        break;
      }
      case "actions": {
        const current = sc;
        const all = entityActionTiles(model, post, current.entity);
        const page = paginate(all, opts.tilesPerPage, current.page);
        const tapped = tap(page.tiles, (t) => t.kind === "frame" && t.frame === target.frame) ?? page.tiles.find((t) => t.kind === "more") ?? null;
        if (!tapped) {
          restart();
          break;
        }
        if (tapped.kind === "more") {
          screen = { kind: "actions", entity: current.entity, page: current.page + 1 };
          break;
        }
        if (tapped.kind === "frame") s = addEvidence(s, { kind: "frame", frame: tapped.frame });
        screen = { kind: "topic", topic: topicNow, page: 0 };
        break;
      }
      case "choices": {
        const current = sc;
        const all = slotChoiceTiles(model, post, current.frame);
        const page = paginate(all, opts.tilesPerPage, current.page);
        const wantId = goal.entity ?? Object.values(target.slots).find((v) => v) ?? null;
        const tapped = tap(page.tiles, (t) => t.kind === "entity" && t.entity === wantId) ?? page.tiles.find((t) => t.kind === "more") ?? null;
        if (!tapped) {
          restart();
          break;
        }
        if (tapped.kind === "more") {
          screen = { kind: "choices", frame: current.frame, page: current.page + 1 };
          break;
        }
        if (tapped.kind === "entity") s = addEvidence(s, { kind: "entity", entity: tapped.entity });
        screen = { kind: "topic", topic: topicNow, page: 0 };
        break;
      }
      case "body": {
        const zones = (model.byType.get("bodypart") ?? []) as BuiltinEntity[];
        const want = target.slots.body ?? zones[0]!.id;
        const zone = r() < profile.tileError ? zones[Math.floor(r() * zones.length)]!.id : want;
        if (zones.find((z) => z.id === want)?.side === "back") steps++; // кнопка «Сзади»
        s = addEvidence(s, { kind: "body", entity: zone });
        screen = { kind: "severity" };
        break;
      }
      case "severity": {
        const sev = target.slots.severity;
        let level: FaceLevel = sev ? SEVERITY_FACE[sev]! : 3;
        if (r() < profile.tileError) level = Math.min(5, Math.max(1, level + (r() < 0.5 ? -1 : 1))) as FaceLevel;
        s = addEvidence(s, { kind: "severity", level });
        screen = { kind: "topic", topic: "health", page: 0 };
        break;
      }
      case "faces": {
        const level: FaceLevel = tf.face === "positive" ? 2 : tf.face === "negative" ? 4 : tf.face === "pain" ? 5 : 3;
        s = addEvidence(s, { kind: "face", level });
        screen = { kind: "topic", topic: topicNow, page: 0 };
        break;
      }
    }
  }
  return result(null);
}

export interface SimSummary {
  runs: number;
  correctRate: number;
  meanSteps: number;
  maxSteps: number;
  meanStepsCorrect: number;
  p90Steps: number;
  meanQuestions: number;
  gridRate: number;
  restartRate: number;
  worst: RunResult[];
}

export function summarize(results: RunResult[]): SimSummary {
  const n = results.length;
  const steps = results.map((x) => x.steps).sort((a, b) => a - b);
  const correct = results.filter((x) => x.correct);
  return {
    runs: n,
    correctRate: correct.length / n,
    meanSteps: steps.reduce((s, x) => s + x, 0) / n,
    maxSteps: steps[n - 1] ?? 0,
    meanStepsCorrect: correct.reduce((s, x) => s + x.steps, 0) / Math.max(1, correct.length),
    p90Steps: steps[Math.floor(n * 0.9)] ?? 0,
    meanQuestions: results.reduce((s, x) => s + x.questions, 0) / n,
    gridRate: results.filter((x) => x.grids > 0).length / n,
    restartRate: results.filter((x) => x.restarts > 0).length / n,
    worst: [...results].sort((a, b) => b.steps - a.steps).slice(0, 5),
  };
}

export interface BatchOptions {
  runs: number;
  seed: number;
  profile: GrandmaProfile;
  /** Доля равномерной примеси в распределении мыслей (расхождение с априором движка). */
  flatten: number;
  sim?: Partial<SimOptions>;
}

/** Серия разговоров в разное время суток. */
export function runBatch(base: Omit<EngineInput, "now">, opts: BatchOptions): SimSummary {
  const r = rng(opts.seed);
  const sim = { ...DEFAULT_SIM, ...opts.sim };
  const hours = [8, 13, 19, 23];
  const models = hours.map((h) => buildModel({ ...base, now: new Date(2026, 9, 15, h, 0).getTime() }));
  const results: RunResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const model = models[i % models.length]!;
    const target = sampleTarget(model, r, opts.flatten);
    results.push(runOne(model, target, opts.profile, sim, r));
  }
  return summarize(results);
}

/**
 * Обучение на истории: у бабушки свои типичные просьбы. Прогоняем недели разговоров,
 * после каждого обновляем счётчики и смотрим, как сокращается путь.
 */
export function runLearning(
  base: Omit<EngineInput, "now" | "learned">,
  opts: { weeks: number; perDay: number; seed: number; profile: GrandmaProfile; habits: { hour: number; candidate: Candidate }[] },
): { week: number; meanSteps: number; correctRate: number; typicalSteps: number }[] {
  const r = rng(opts.seed);
  let learned: LearnedCounts | undefined;
  const out: { week: number; meanSteps: number; correctRate: number; typicalSteps: number }[] = [];
  const hours = [8, 13, 19, 23];
  for (let w = 0; w < opts.weeks; w++) {
    const week: RunResult[] = [];
    const typical: RunResult[] = [];
    for (let d = 0; d < 7 * opts.perDay; d++) {
      const hour = hours[d % hours.length]!;
      const now = new Date(2026, 9, 15, hour, 0).getTime();
      const model = buildModel({ ...base, now, learned });
      // 70 % — её привычные просьбы в это время суток, остальное — что угодно
      const mine = opts.habits.filter((h) => h.hour === hour);
      const habitual = mine.length > 0 && r() < 0.7;
      const target = habitual ? mine[Math.floor(r() * mine.length)]!.candidate : sampleTarget(model, r, 0.3);
      const res = runOne(model, target, opts.profile, DEFAULT_SIM, r);
      week.push(res);
      if (habitual) typical.push(res);
      if (res.confirmed) {
        const [frame] = res.confirmed.split("|");
        const confirmed = res.correct ? target : { frame: frame!, slots: {} };
        learned = res.correct ? learnConfirmed(learned, model, confirmed, []) : learnRejected(learned, confirmed, model.band);
      }
    }
    out.push({
      week: w + 1,
      meanSteps: week.reduce((s, x) => s + x.steps, 0) / week.length,
      correctRate: week.filter((x) => x.correct).length / week.length,
      typicalSteps: typical.reduce((s, x) => s + x.steps, 0) / Math.max(1, typical.length),
    });
  }
  return out;
}

export { tileKey };
