"use client";

import type { ReactNode } from "react";
import { Press } from "./Press";

/**
 * Плитка экрана бабушки: крупная картинка, мелкая подпись для близких.
 * Значок «развитие речи» — небольшая точка-волна в углу.
 */
export function Tile({
  picture,
  label,
  sublabel,
  onPress,
  develop,
  testId,
  selected,
}: {
  picture: ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  develop?: boolean;
  testId?: string;
  selected?: boolean;
}) {
  return (
    <Press
      label={label}
      testId={testId}
      onPress={onPress}
      className={`relative flex h-full min-h-[120px] w-full min-w-[120px] flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 bg-surface p-3 ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">{picture}</div>
      <span className="text-center text-[17px] font-medium leading-tight text-ink">{label}</span>
      {sublabel && sublabel !== label && <span className="-mt-1.5 text-center text-[14px] leading-tight text-ink-2">{sublabel}</span>}
      {develop && (
        <svg className="absolute top-3 right-3" width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <circle cx="14" cy="14" r="13" fill="var(--accent-soft)" />
          <path d="M8 15c2-4 4-4 6 0s4 4 6 0" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
    </Press>
  );
}

/** Сетка плиток рабочей области: фиксированные строки и столбцы, без прокрутки. */
export function TileGrid({ cols, rows, children }: { cols: number; rows: number; children: ReactNode }) {
  return (
    <div
      className="grid h-full w-full gap-6"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
