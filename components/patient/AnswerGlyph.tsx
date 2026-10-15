import type { AnswerIcon } from "@/lib/db/types";

/** Крупный белый знак на кнопке ответа. Форма различает кнопки и без цвета. */
export function AnswerGlyph({ icon, size }: { icon: AnswerIcon; size: number }) {
  const common = { fill: "none", stroke: "#fff", strokeWidth: 12, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {icon === "check" && <path d="M20 54 L42 76 L82 26" {...common} />}
      {icon === "cross" && <path d="M26 26 L74 74 M74 26 L26 74" {...common} />}
      {icon === "tilde" && <path d="M18 56 C30 34 44 34 50 50 S70 66 82 44" {...common} />}
      {icon === "thumbs_up" && (
        <path d="M30 86 V48 M30 48 L48 18 C54 14 60 18 58 26 L54 42 H78 C84 42 88 48 86 54 L80 78 C78 84 74 86 68 86 H30" {...common} strokeWidth={9} />
      )}
      {icon === "thumbs_down" && (
        <path d="M30 14 V52 M30 52 L48 82 C54 86 60 82 58 74 L54 58 H78 C84 58 88 52 86 46 L80 22 C78 16 74 14 68 14 H30" {...common} strokeWidth={9} />
      )}
      {icon === "hand" && (
        <path d="M34 86 V40 M34 40 V18 M50 40 V12 M66 40 V18 M80 46 V30 M34 86 H72 C78 86 80 80 80 74 V46" {...common} strokeWidth={9} />
      )}
    </svg>
  );
}
