import type {
  Bilingual,
  ConnectiveId,
  Lang,
  RepeatResult,
  SoundMode,
  SpeakerGender,
  TimeBand,
  TopicId,
} from "@/engine/types";

/** Категории, для которых задаётся режим звучания по умолчанию. */
export type SoundCategory =
  | "people"
  | "needs"
  | "health"
  | "feelings"
  | "things"
  | "places"
  | "food"
  | "medicine"
  | "words"
  | "phrases"
  | "prompts";

export const SOUND_CATEGORIES: readonly SoundCategory[] = [
  "people",
  "needs",
  "health",
  "feelings",
  "things",
  "places",
  "food",
  "medicine",
  "words",
  "phrases",
  "prompts",
];

export type AnswerMeaning = "yes" | "no" | "almost";
export type AnswerIcon = "check" | "cross" | "tilde" | "thumbs_up" | "thumbs_down" | "hand";

export interface AnswerButton {
  id: AnswerMeaning;
  color: string;
  icon: AnswerIcon;
  label: Bilingual;
  /** Записи: может быть её собственное слово. */
  audio?: Partial<Record<Lang, string>>;
  meaning: AnswerMeaning;
}

export interface Settings {
  id: "main";
  /** Как зовут человека, для которого настроено приложение (для экрана родственника). */
  personName: string;
  pinHash: string;
  pinSalt: string;
  primaryLang: Lang;
  speakerGender: SpeakerGender;
  /** Обращение к собеседнику в фразах: на «ты» или на «вы». */
  addressForm: "ty" | "vy";
  hand: "left" | "right";
  sound: {
    global: SoundMode;
    byCategory: Partial<Record<SoundCategory, SoundMode>>;
  };
  answerButtons: AnswerButton[];
  thirdButton: boolean;
  /** Порядок и набор тем на главном экране. */
  topics: TopicId[];
  /** Фреймы, которые родственник включил или выключил вопреки значению по умолчанию. */
  frameToggles: Record<string, boolean>;
  /** Ручная вероятность ошибочного нажатия; null — учиться по истории. */
  epsilon: number | null;
  confirmThreshold: number;
  maxQuestions: number;
  micEnabled: boolean;
  /** Голос устройства как запасной (только локальные голоса, без облачных). */
  systemVoice: boolean;
  patientTheme: "light" | "dark";
  /** Склонять ли женские имена на -ь (Айгуль → Айгули). */
  declineSoftSignNames: boolean;
  lastBackupAt: number | null;
  createdAt: number;
}

export interface MediaRecord {
  id: string;
  kind: "photo" | "audio";
  blob: Blob;
  mime: string;
  createdAt: number;
}

/** Образец произношения слова для распознавания. */
export interface SampleRecord {
  id: string;
  wordId: string;
  mediaId: string;
  /** Признаки MFCC, развёрнутые построчно: nFrames × dims. */
  features: Float32Array | null;
  nFrames: number;
  dims: number;
  durationMs: number;
  createdAt: number;
}

export interface TemplateOverride {
  /** Ключ: "<frameId>:<kind>:<lang>", например "need.drink:say:kk". */
  key: string;
  text?: string;
  audio?: string;
  /** Отметка носителя языка: «верно». */
  verified?: boolean;
  updatedAt: number;
}

export interface WhyItem {
  /** Ключ кандидата. */
  key: string;
  text: string;
  p: number;
  /** Вклад априора и каждого свидетельства (в натах относительно «ничего из этого»). */
  contributions: { label: string; weight: number }[];
}

export interface SentenceRecord {
  frame: string;
  slots: Record<string, string>;
  connective?: ConnectiveId;
  text: Bilingual;
  /** «Почему так»: лучшие гипотезы в момент подтверждения. */
  why?: WhyItem[];
}

export interface HistoryMessage {
  id: string;
  at: number;
  /** Всё сообщение целиком, со связками. */
  text?: Bilingual;
  sentences: SentenceRecord[];
  steps: number;
  questions: number;
  /** Сколько серий повторов слова было в разговоре. */
  repeatSeries: number;
  repeat: Partial<Record<Lang, RepeatResult>>;
}

export interface SpeechAttempt {
  id: string;
  at: number;
  /** null — слово не распознано. */
  wordId: string | null;
  text?: string;
  lang?: Lang;
  kind: "spontaneous" | "repeat" | "practice";
  result?: RepeatResult;
  confidence?: number;
  mediaId?: string;
  repeatCount?: number;
}

export interface LearnedState {
  id: "main";
  /** Счётчики Дирихле: фрейм × время суток. */
  frameTime: Record<string, Partial<Record<TimeBand, number>>>;
  /** Частоты сущностей в подтверждённых сообщениях. */
  entityFreq: Record<string, number>;
  /** Уточнённые веса значений слов: wordId → ключ значения → счётчик. */
  wordMeaning: Record<string, Record<string, number>>;
  /** Бета-счётчик ошибочных ответов: [ошибки, всего]. */
  answerErrors: [number, number];
}

export interface PracticeState {
  /** Ключ карточки: "entity:<id>" или "word:<id>". */
  key: string;
  /** Ступень подсказки: 0 — полное слово, 1 — первый слог, 2 — только фото. */
  level: 0 | 1 | 2;
  results: { at: number; result: RepeatResult; level: number }[];
  due: number;
}
