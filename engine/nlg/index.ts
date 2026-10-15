// Генерация фраз: шаблон + сущности в слотах + морфология языка.
import { kkCase, kkPossessive, questionParticle } from "../kk-morph/index.ts";
import { TEMPLATES, frameById } from "../ontology/index.ts";
import { agree, declineName, declinePhrase, fixPrepositions, numberGender } from "../ru-morph/index.ts";
import type {
  ConnectiveId,
  Entity,
  EntityType,
  KkCase,
  Lang,
  RuCase,
  SpeakerGender,
  TopicId,
} from "../types.ts";

export interface NlgOptions {
  speakerGender: SpeakerGender;
  addressForm: "ty" | "vy";
  softSignFeminineDeclines: boolean;
  /** Правки шаблонов от родственника: ключ "<frame>:<вид>:<язык>". */
  overrides?: Record<string, string>;
}

export const DEFAULT_NLG: NlgOptions = { speakerGender: "f", addressForm: "ty", softSignFeminineDeclines: true };

const RU_CASES: readonly string[] = ["nom", "gen", "dat", "acc", "ins", "pre"];
const KK_CASES: readonly string[] = ["nom", "gen", "dat", "acc", "loc", "abl", "ins"];

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const decap = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

/** Форма сущности: ручная, если есть, иначе по правилам. */
export function entityForm(e: Entity, lang: Lang, form: string, opts: NlgOptions): string {
  const wantForm = (form === "imp" && opts.addressForm === "vy" ? "impPl" : form) || "nom";
  const manual = e.forms?.[lang]?.[wantForm] ?? e.forms?.[lang]?.[form];
  if (manual) return manual;
  const base = lang === "kk" ? e.name.kk || e.name.ru : e.name.ru || e.name.kk;
  if (wantForm === "nom" || wantForm === "imp" || wantForm === "impPl") return base;

  if (lang === "ru") {
    if (wantForm === "dir") return `в ${entityForm(e, "ru", "acc", opts)}`;
    if (wantForm === "loc") return `в ${entityForm(e, "ru", "pre", opts)}`;
    if (!RU_CASES.includes(wantForm)) return base;
    const c = wantForm as RuCase;
    if (e.type === "person") {
      const g = e.ruMorph?.gender === "f" ? "f" : "m";
      return declineName(base, g, c, { softSignFeminineDeclines: opts.softSignFeminineDeclines });
    }
    return declinePhrase(base, e.ruMorph ?? { gender: "m" }, c);
  }

  if (wantForm === "poss1sg") return kkPossessive(base, "1sg");
  if (wantForm === "poss2pl") return kkPossessive(base, "2pl");
  if (KK_CASES.includes(wantForm)) return kkCase(base, wantForm as KkCase);
  return base;
}

const Q_MARK = "\u0001";

/** Подстановка слотов и служебных пометок в шаблон. */
export function renderTemplate(tpl: string, slots: Record<string, Entity>, lang: Lang, opts: NlgOptions): string {
  let out = tpl.replace(/\{([^{}]+)\}/g, (_m, body: string) => {
    if (body === "q") return Q_MARK;
    const [head, ...rest] = body.split(":");
    if (head === "g" || head === "a") {
      const [first, second] = rest.join(":").split("|") as [string, string?];
      const pickSecond = head === "g" ? opts.speakerGender === "f" : opts.addressForm === "vy";
      return pickSecond ? (second ?? first) : first;
    }
    if (head === "n" || head === "gn") {
      const slotName = rest[0]!;
      const variants = rest.slice(1).join(":").split("|");
      const e = slots[slotName];
      if (head === "n") return lang === "ru" && e?.ruMorph?.pluralOnly ? (variants[1] ?? variants[0]!) : variants[0]!;
      const forms = [variants[0]!, variants[1] ?? variants[0]!, variants[2] ?? variants[0]!, variants[3] ?? variants[0]!] as const;
      return agree(numberGender(e?.ruMorph), forms);
    }
    // {slot}, {slot:form}, {slot|cap}, {slot:form|cap}
    const [ref, mod] = body.split("|") as [string, string?];
    const [slotName, form = "nom"] = ref.split(":") as [string, string?];
    const e = slots[slotName];
    if (!e) return "";
    const text = entityForm(e, lang, form, opts);
    return mod === "cap" ? cap(text) : text;
  });

  // Вопросительная частица согласуется с предыдущим словом.
  out = out.replace(new RegExp(`(\\S+)\\s*${Q_MARK}`, "g"), (_m, word: string) => `${word} ${questionParticle(word)}`);
  out = out.replace(/\s+/g, " ").replace(/\s+([,.!?:])/g, "$1").trim();
  if (lang === "ru") out = fixPrepositions(out);
  return cap(out);
}

export type PhraseKind = "say" | "ask" | "lead";

export interface Rendered {
  text: string;
  /** Фраза начинается с имени (не понижать регистр при склейке). */
  startsWithName: boolean;
}

/** Фраза или вопрос для заполненного фрейма с выбором варианта по заполненным слотам. */
export function framePhrase(
  frameId: string,
  slots: Record<string, Entity>,
  kind: PhraseKind,
  lang: Lang,
  opts: NlgOptions,
): Rendered {
  const frame = frameById(frameId);
  const set = TEMPLATES[lang].frames[frameId];
  if (!frame || !set) throw new Error(`нет фрейма ${frameId}`);
  const filledOptional = frame.slots.filter((s) => s.optional && slots[s.name]).map((s) => s.name).sort();
  const variant = filledOptional.length ? `${kind}+${filledOptional.join("+")}` : kind;
  const override = opts.overrides?.[`${frameId}:${variant}:${lang}`] ?? opts.overrides?.[`${frameId}:${kind}:${lang}`];
  const tpl = override ?? set[variant] ?? set[kind] ?? set.say;
  const text = renderTemplate(tpl, slots, lang, opts);
  const startsWithName = Object.values(slots).some(
    (e) => e.type === "person" && text.toLowerCase().startsWith((lang === "kk" ? e.name.kk : e.name.ru).toLowerCase().slice(0, 3)),
  );
  return { text, startsWithName };
}

export function topicQuestion(topic: TopicId, lang: Lang, opts: NlgOptions): string {
  return opts.overrides?.[`topic:${topic}:${lang}`] ?? TEMPLATES[lang].topics[topic];
}

export function slotQuestion(entity: Entity, lang: Lang, opts: NlgOptions): string {
  const tpl = TEMPLATES[lang].slotAsk[entity.type as EntityType] ?? TEMPLATES[lang].slotAsk.thing!;
  return renderTemplate(tpl, { value: entity }, lang, opts);
}

export interface SentencePart {
  text: string;
  startsWithName: boolean;
  /** Связка перед этим предложением (у первого нет). */
  connective?: ConnectiveId;
  /** Предыдущее предложение — «вводящее» («Передай Алии:»). */
  afterLead?: boolean;
}

/** Склейка составного сообщения: «Мне грустно, потому что …». */
export function joinSentences(parts: SentencePart[], lang: Lang): string {
  let out = "";
  for (const [i, p] of parts.entries()) {
    if (i === 0) {
      out = p.text;
      continue;
    }
    const body = p.startsWithName ? p.text : decap(p.text);
    if (p.afterLead) {
      out = `${out} ${body}`;
      continue;
    }
    const join = p.connective ? TEMPLATES[lang].connectives[p.connective]?.join : ". ";
    const prev = out.replace(/[.!]+$/, "");
    const glue = join ?? ". ";
    const next = glue.trim().endsWith(".") || glue === ". " ? cap(body) : body;
    out = `${prev}${glue}${next}`;
  }
  return out;
}
