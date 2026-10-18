// Предметные типы, общие для движка и приложения. Без зависимостей от UI и браузера.

export type Lang = "ru" | "kk";
export const LANGS: readonly Lang[] = ["ru", "kk"];

/** Режим звучания: какой язык и в каком порядке звучит. */
export type SoundMode = "ru" | "ru-kk" | "kk-ru" | "kk";

export type SpeakerGender = "f" | "m";

export type TimeBand = "morning" | "day" | "evening" | "night";
export const TIME_BANDS: readonly TimeBand[] = ["morning", "day", "evening", "night"];

export type EntityType =
  | "person"
  | "place"
  | "thing"
  | "food"
  | "medicine"
  | "bodypart"
  | "event"
  | "action"
  | "severity";

export type TopicId =
  | "needs"
  | "health"
  | "people"
  | "feelings"
  | "things"
  | "places"
  | "memories"
  | "opinion"
  | "daily"
  | "address"
  | "spiritual";

export interface Bilingual {
  ru: string;
  kk: string;
}

export type RuGender = "m" | "f" | "n";
export type RuCase = "nom" | "gen" | "dat" | "acc" | "ins" | "pre";
export type KkCase = "nom" | "gen" | "dat" | "acc" | "loc" | "abl" | "ins";

export interface RuNounInfo {
  gender: RuGender;
  animate?: boolean;
  /** Не склоняется (Гульнар, иностранные на -о). */
  indeclinable?: boolean;
  pluralOnly?: boolean;
}

/**
 * Ручные формы слова. Ключи: падеж ("acc", "dat"…) или особая форма
 * ("poss1sg" — «басым»). Ручная форма всегда важнее правил.
 */
export type FormOverrides = Partial<Record<Lang, Record<string, string>>>;

export interface Entity {
  id: string;
  type: EntityType;
  /** Как бабушка называет: по-русски и по-казахски. */
  name: Bilingual;
  ruMorph?: RuNounInfo;
  forms?: FormOverrides;
  /** Кем приходится (для людей), по-русски. */
  relation?: string;
  /** Идентификатор фото в хранилище медиа. */
  photo?: string;
  /** Встроенная иконка, если фото нет. */
  icon?: string;
  /** Записи голосом родственника. */
  audio?: Partial<Record<Lang, string>>;
  soundMode?: SoundMode;
  /** Ударение для синтеза: номер ударной гласной в имени (с 1), если синтез ошибается. */
  stress?: Partial<Record<Lang, number>>;
  /** Слово для развития: всегда звучит на двух языках. */
  develop?: boolean;
  /** Время приёма (для лекарств) или привязка к распорядку. */
  schedule?: TimeBand[];
  /** Свободная заметка родственника. */
  note?: string;
  order?: number;
  hidden?: boolean;
}

export type MeaningTarget =
  | { kind: "frame"; frame: string }
  | { kind: "topic"; topic: TopicId }
  | { kind: "entity"; entity: string };

export interface WordMeaning {
  target: MeaningTarget;
  weight: number;
}

/** Слово из личного словаря бабушки. */
export interface WordEntry {
  id: string;
  text: string;
  lang: Lang;
  /** Перевод на второй язык, чтобы слово звучало в двуязычном режиме. */
  translation?: string;
  meanings: WordMeaning[];
  oftenRepeats: boolean;
  develop: boolean;
  /** Чистая запись слова голосом родственника. */
  audio?: string;
  soundMode?: SoundMode;
  createdAt: number;
}

export type FaceLevel = 1 | 2 | 3 | 4 | 5; // 1 — очень хорошо, 5 — очень плохо

export type FaceProfile = "pain" | "negative" | "neutral" | "positive" | "any";

export interface SlotDef {
  name: string;
  types: EntityType[];
  optional?: boolean;
}

export interface FrameDef {
  id: string;
  topic: TopicId;
  alsoTopics?: TopicId[];
  icon: string;
  slots: SlotDef[];
  /** Относительный априорный вес. */
  prior: number;
  /** Множители априора по времени суток. */
  time?: Partial<Record<TimeBand, number>>;
  face: FaceProfile;
  /** Фраза обращена к собеседнику («ты помоги мне»). */
  addressee?: boolean;
  /** Выключен, пока родственник не включит (например, духовное). */
  off?: boolean;
  /** После подтверждения сразу ищется следующее предложение («Передайте Алие: …»). */
  leadsOn?: boolean;
}

export interface DayNote {
  id: string;
  text: string;
  entityIds: string[];
  topics: TopicId[];
  createdAt: number;
  /** Конец действия, мс с эпохи. */
  until: number;
}

export interface RoutineItem {
  id: string;
  band: TimeBand;
  frame: string;
  /** Насколько это типично: 1 — иногда, 3 — почти всегда. */
  strength: 1 | 2 | 3;
}

export type ConnectiveId = "because" | "but" | "so" | "and" | "then";
export const CONNECTIVES: readonly ConnectiveId[] = ["because", "but", "so", "and", "then"];

export type RepeatResult = "self" | "prompted" | "failed";
