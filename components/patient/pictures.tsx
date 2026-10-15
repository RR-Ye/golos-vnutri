"use client";

import type { ReactNode } from "react";
import type { Candidate } from "@/engine";
import { frameById } from "@/engine/ontology";
import type { Entity, FaceLevel } from "@/engine/types";
import { EntityPicture } from "../EntityPicture";
import { BodyMini } from "./BodyFigure";
import { Icon } from "../Icon";

/** Цвет и выражение лица различаются одновременно: смысл не держится на одном цвете. */
const FACE: Record<FaceLevel, { fill: string; label: string }> = {
  1: { fill: "#2FA84F", label: "очень хорошо" },
  2: { fill: "#8BC34A", label: "хорошо" },
  3: { fill: "#F2C230", label: "нормально" },
  4: { fill: "#F08C2E", label: "плохо" },
  5: { fill: "#D9412E", label: "очень плохо" },
};

export function FaceSvg({ level, size }: { level: FaceLevel; size: number }) {
  const ink = "#1b1b1b";
  const sw = 4.5;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" fill={FACE[level].fill} stroke={ink} strokeWidth="3" />
      {/* брови */}
      {level === 1 && <path d="M26 30 Q34 22 42 30 M58 30 Q66 22 74 30" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 2 && <path d="M27 31 Q34 27 41 31 M59 31 Q66 27 73 31" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 3 && <path d="M27 31 H41 M59 31 H73" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 4 && <path d="M27 33 L41 28 M59 28 L73 33" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 5 && <path d="M26 36 L42 26 M58 26 L74 36" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {/* глаза */}
      {level < 5 ? (
        <>
          <circle cx="35" cy="42" r="5" fill={ink} />
          <circle cx="65" cy="42" r="5" fill={ink} />
        </>
      ) : (
        <path d="M28 43 Q35 37 42 43 M58 43 Q65 37 72 43" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* рот */}
      {level === 1 && <path d="M28 58 Q50 86 72 58 Z" fill={ink} />}
      {level === 2 && <path d="M32 62 Q50 76 68 62" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 3 && <path d="M34 67 H66" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 4 && <path d="M33 72 Q50 60 67 72" fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />}
      {level === 5 && (
        <>
          <path d="M30 78 Q50 52 70 78 Z" fill={ink} />
          <path d="M27 50 q-4 8 0 12 q4 -4 0 -12 Z M73 50 q-4 8 0 12 q4 -4 0 -12 Z" fill="#4AA3DF" stroke={ink} strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

export function faceLabel(level: FaceLevel): string {
  return FACE[level].label;
}

/** Картинка мысли: иконка фрейма, а если есть человек или вещь — их фото с иконкой в углу. */
export function CandidatePicture({
  candidate,
  entities,
  size,
  lang,
}: {
  candidate: Candidate;
  entities: ReadonlyMap<string, Entity>;
  size: number;
  lang: "ru" | "kk";
}) {
  const frame = frameById(candidate.frame);
  const main = Object.entries(candidate.slots)
    .map(([, v]) => (v ? entities.get(v) : undefined))
    .find((e) => e && e.type !== "severity");
  const icon = frame?.icon ?? "question";
  if (!main) return <Icon id={icon} size={size} />;
  if (main.type === "bodypart") return <BodyMini zone={main.id} size={size} />;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <EntityPicture entity={main} size={size} lang={lang} />
      <span className="absolute -right-2 -bottom-2 rounded-full bg-surface p-1 shadow-[0_0_0_2px_var(--line)]">
        <Icon id={icon} size={Math.round(size * 0.42)} />
      </span>
    </div>
  );
}

/** Знаки связок: простые, различимые по форме. */
export function ConnectiveGlyph({ id, size }: { id: "because" | "but" | "so" | "and" | "then"; size: number }) {
  const c = { fill: "none", stroke: "var(--accent)", strokeWidth: 8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {id === "and" && <path d="M50 22 V78 M22 50 H78" {...c} />}
      {id === "so" && <path d="M18 50 H78 M60 32 L80 50 L60 68" {...c} />}
      {id === "because" && <path d="M82 50 H22 M40 32 L20 50 L40 68" {...c} />}
      {id === "but" && <path d="M20 36 H64 M52 24 L66 36 L52 48 M80 64 H36 M48 52 L34 64 L48 76" {...c} />}
      {id === "then" && (
        <>
          <circle cx="40" cy="50" r="26" {...c} />
          <path d="M40 34 V50 L52 58 M74 50 H90 M82 42 L90 50 L82 58" {...c} />
        </>
      )}
    </svg>
  );
}

/** Картинка сущности для вопросов: часть тела — фигурой, остальное — фото или иконкой. */
export function EntityOrBody({ entity, size, lang }: { entity: Entity; size: number; lang: "ru" | "kk" }) {
  if (entity.type === "bodypart") return <BodyMini zone={entity.id} size={size} />;
  return <EntityPicture entity={entity} size={size} lang={lang} />;
}

/** Динамик со значком языка: «ещё раз» и «на другом языке» различаются без чтения. */
export function SpeakerLang({ lang, size }: { lang?: "ru" | "kk"; size: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Icon id="speaker" size={size} />
      {lang && (
        <span className="absolute -right-3 -bottom-1 rounded-md bg-accent px-1.5 text-[15px] font-bold text-accent-ink">
          {lang === "kk" ? "ҚАЗ" : "РУС"}
        </span>
      )}
    </div>
  );
}

/** Подпись под картинкой для собеседника (мелко) — читать бабушке не нужно. */
export function Caption({ children }: { children: ReactNode }) {
  return <span className="text-[15px] leading-tight text-ink-2">{children}</span>;
}
