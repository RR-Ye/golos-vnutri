"use client";

import type { ReactNode } from "react";
import type { Lang } from "@/engine/types";
import type { AnswerButton, AnswerMeaning, Settings } from "@/lib/db/types";
import { patientDict } from "@/lib/i18n";
import { Icon } from "../Icon";
import { AnswerGlyph } from "./AnswerGlyph";
import { Press } from "./Press";
import type { PatientLayout } from "./useLayout";

export const GAP = 24;
export const PAD = 24;

export interface ShellHandlers {
  onHelp: () => void;
  onRestart: () => void;
  onSay?: () => void;
  onAnswer: (meaning: AnswerMeaning, button: AnswerButton) => void;
}

function RailButton({
  label,
  sub,
  icon,
  onPress,
  tone,
  testId,
  className = "",
}: {
  label: string;
  sub?: string;
  icon: string;
  onPress: () => void;
  tone: "help" | "plain";
  testId: string;
  className?: string;
}) {
  const style = tone === "help" ? "bg-help text-white" : "bg-surface text-ink border-2 border-line";
  return (
    <Press
      label={label}
      testId={testId}
      onPress={onPress}
      className={`flex min-h-[120px] min-w-[120px] flex-col items-center justify-center gap-1 rounded-2xl ${style} ${className}`}
    >
      <Icon id={icon} size={56} />
      <span className="text-[17px] font-semibold leading-tight">{label}</span>
      {sub && <span className="text-[13px] leading-tight opacity-80">{sub}</span>}
    </Press>
  );
}

function AnswerPress({ b, onAnswer, lang, testId, className = "" }: { b: AnswerButton; onAnswer: ShellHandlers["onAnswer"]; lang: Lang; testId: string; className?: string }) {
  const other: Lang = lang === "ru" ? "kk" : "ru";
  return (
    <Press
      label={b.label[lang]}
      testId={testId}
      onPress={() => onAnswer(b.meaning, b)}
      className={`flex min-h-[120px] min-w-[120px] flex-col items-center justify-center rounded-3xl text-white ${className}`}
      style={{ background: b.color }}
    >
      <AnswerGlyph icon={b.icon} size={88} />
      <span className="text-[19px] font-semibold leading-tight">{b.label[lang]}</span>
      <span className="text-[14px] leading-tight opacity-90">{b.label[other]}</span>
    </Press>
  );
}

/**
 * Каркас экрана бабушки: постоянная панель (Помогите, Сначала, Сказать, кнопки ответа)
 * на одних и тех же местах у рабочей руки и рабочая область для плиток.
 */
export function Shell({
  settings,
  layout,
  handlers,
  children,
}: {
  settings: Settings;
  layout: PatientLayout;
  handlers: ShellHandlers;
  children: ReactNode;
}) {
  const lang = settings.primaryLang;
  const d = patientDict(lang);
  const dk = patientDict(lang === "ru" ? "kk" : "ru");
  const answers = settings.answerButtons.filter((b) => b.id !== "almost" || settings.thirdButton);
  const mirror = settings.hand === "right";
  const say = settings.micEnabled && handlers.onSay;

  const help = (
    <RailButton testId="btn-help" tone="help" icon="bell" label={d.help} sub={dk.help} onPress={handlers.onHelp} />
  );
  const restart = (
    <RailButton testId="btn-restart" tone="plain" icon="turn" label={d.restart} onPress={handlers.onRestart} />
  );
  const sayBtn = say ? (
    <RailButton testId="btn-say" tone="plain" icon="mic" label={d.say} onPress={handlers.onSay!} />
  ) : null;
  const answerEls = answers.map((b) => (
    <AnswerPress key={b.id} b={b} lang={lang} onAnswer={handlers.onAnswer} testId={`btn-${b.id}`} className="flex-1" />
  ));

  const content = (
    <div className="relative min-h-0 min-w-0 flex-1" data-testid="work-area">
      {children}
    </div>
  );

  if (layout.mode === "landscape") {
    return (
      <div className={`flex h-full gap-6 p-6 ${mirror ? "flex-row-reverse" : ""}`}>
        <div className="flex w-[280px] shrink-0 flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 grid">{help}</div>
            <div className={`grid ${say ? "" : "col-span-2"}`}>{restart}</div>
            {sayBtn && <div className="grid">{sayBtn}</div>}
          </div>
          <div className="flex-1" />
          <div className="flex flex-col gap-6" style={{ height: answers.length > 2 ? 456 : 424 }}>
            {answerEls}
          </div>
        </div>
        {content}
      </div>
    );
  }

  if (layout.mode === "portrait") {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        {/* Правый верхний угол свободен: там невидимая зона входа для близких. */}
        <div className={`flex gap-6 ${mirror ? "flex-row-reverse" : ""}`}>
          <div className="grid w-[200px]">{help}</div>
          <div className="grid w-[160px]">{restart}</div>
        </div>
        {content}
        <div className={`flex h-[180px] gap-6 ${mirror ? "flex-row-reverse" : ""}`}>
          {answerEls}
          {sayBtn && <div className="grid w-[160px]">{sayBtn}</div>}
        </div>
      </div>
    );
  }

  // Телефон
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className={`flex gap-6 ${mirror ? "flex-row-reverse" : ""}`}>
        <div className="grid flex-1">{help}</div>
        <div className="grid w-[120px]">{restart}</div>
      </div>
      {content}
      <div className={`flex h-[130px] gap-6 ${mirror ? "flex-row-reverse" : ""}`}>{answerEls}</div>
      {sayBtn && <div className="grid">{sayBtn}</div>}
    </div>
  );
}
