// Серия одинаковых слов подряд («сен, сен, сен») — одно слово с пометкой о повторе.

export interface Heard {
  wordId: string | null;
  confidence: number;
  /** Время конца слова, мс. */
  at: number;
}

export interface Series {
  wordId: string | null;
  confidence: number;
  repeats: number;
  at: number;
}

/** Склеивает одинаковые слова, сказанные в пределах windowMs друг от друга. */
export function collapseSeries(heard: readonly Heard[], windowMs = 3000): Series[] {
  const out: Series[] = [];
  for (const h of heard) {
    const last = out[out.length - 1];
    if (last && h.wordId !== null && last.wordId === h.wordId && h.at - last.at <= windowMs) {
      last.repeats++;
      last.at = h.at;
      last.confidence = Math.max(last.confidence, h.confidence);
    } else {
      out.push({ wordId: h.wordId, confidence: h.confidence, repeats: 1, at: h.at });
    }
  }
  return out;
}
