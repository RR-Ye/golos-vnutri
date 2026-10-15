// Какие языки и в каком порядке звучат: режим элемента → категории → общий.
// Чистые функции, без DOM.
import type { Bilingual, Lang, SoundMode } from "@/engine/types";
import type { SoundCategory } from "@/lib/db/types";

export interface SoundSettings {
  primaryLang: Lang;
  sound: { global: SoundMode; byCategory: Partial<Record<SoundCategory, SoundMode>> };
}

export interface SoundItem {
  text: Bilingual;
  /** Записи голосом по языкам (id медиа). */
  audio?: Partial<Record<Lang, string>>;
  /** Режим самого элемента, если задан. */
  mode?: SoundMode;
  category: SoundCategory;
  /** Слово для развития: всегда на двух языках. */
  develop?: boolean;
}

export interface Utterance {
  lang: Lang;
  text: string;
  mediaId?: string;
}

const other = (l: Lang): Lang => (l === "ru" ? "kk" : "ru");

/** Двуязычный режим, начиная с основного языка. */
export function bilingualFrom(primary: Lang): SoundMode {
  return primary === "ru" ? "ru-kk" : "kk-ru";
}

export function resolveMode(item: Pick<SoundItem, "mode" | "category" | "develop">, s: SoundSettings): SoundMode {
  if (item.develop) {
    const m = item.mode ?? s.sound.byCategory[item.category];
    // Уже двуязычный режим сохраняем (порядок мог выбрать родственник).
    return m === "ru-kk" || m === "kk-ru" ? m : bilingualFrom(s.primaryLang);
  }
  if (item.mode) return item.mode;
  const cat = s.sound.byCategory[item.category];
  if (cat) return cat;
  // Вопросы, подсказки и итоговые фразы по умолчанию звучат на основном языке.
  if (item.category === "prompts" || item.category === "phrases") return s.primaryLang;
  return s.sound.global;
}

export function langsOf(mode: SoundMode): Lang[] {
  switch (mode) {
    case "ru":
      return ["ru"];
    case "kk":
      return ["kk"];
    case "ru-kk":
      return ["ru", "kk"];
    case "kk-ru":
      return ["kk", "ru"];
  }
}

/** Последовательность фраз для озвучки элемента. Пустой текст на языке пропускается. */
export function utterancesFor(item: SoundItem, s: SoundSettings): Utterance[] {
  const out: Utterance[] = [];
  for (const lang of langsOf(resolveMode(item, s))) {
    const text = item.text[lang]?.trim() || "";
    const mediaId = item.audio?.[lang];
    if (!text && !mediaId) continue;
    out.push({ lang, text, mediaId });
  }
  if (out.length === 0) {
    // Если на нужном языке нет ни текста, ни записи — лучше сказать на другом, чем молчать.
    const fallback = other(s.primaryLang);
    for (const lang of [s.primaryLang, fallback]) {
      if (item.text[lang] || item.audio?.[lang]) return [{ lang, text: item.text[lang] ?? "", mediaId: item.audio?.[lang] }];
    }
  }
  return out;
}
