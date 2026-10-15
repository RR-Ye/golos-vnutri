"use client";

import type { AnswerButton, AnswerIcon, AnswerMeaning } from "@/lib/db/types";
import { useSettings } from "@/lib/db/useSettings";
import { t } from "@/lib/i18n";
import { AnswerGlyph } from "../patient/AnswerGlyph";
import { Choice, Field, SectionHeader, Select, TextInput, Toggle } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

/** Цвета, на которых белый знак читается с контрастом не ниже 4.5:1. */
const SAFE_COLORS = ["#1E7B3A", "#B3261E", "#8A5A00", "#0A6A86", "#6B3FA0", "#47575F", "#14232B"];
const ICONS: AnswerIcon[] = ["check", "cross", "tilde", "thumbs_up", "thumbs_down", "hand"];
const MEANINGS: AnswerMeaning[] = ["yes", "no", "almost"];

export function ButtonsSection() {
  const [s, save] = useSettings();
  if (!s) return null;
  const B = t.care.buttons;
  const update = (id: AnswerMeaning, patch: Partial<AnswerButton>) =>
    void save({ answerButtons: s.answerButtons.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  const shown = s.answerButtons.filter((b) => b.id !== "almost" || s.thirdButton);

  return (
    <section className="max-w-[760px]">
      <SectionHeader title={t.care.nav.buttons} lead={B.lead} />
      <Toggle checked={s.thirdButton} onChange={(thirdButton) => void save({ thirdButton })} label={B.third} hint={B.thirdHint} />
      {shown.map((b) => (
        <div key={b.id} className="border-t border-line py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl" style={{ background: b.color }}>
              <AnswerGlyph icon={b.icon} size={64} />
              <span className="text-[15px] font-semibold text-white">{b.label.ru}</span>
            </div>
            <h2 className="text-[20px] font-semibold">{B.names[b.id]}</h2>
          </div>
          <Field label={B.color}>
            {() => (
              <div role="radiogroup" aria-label={B.color} className="flex flex-wrap gap-2">
                {SAFE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={b.color === c}
                    aria-label={c}
                    onClick={() => update(b.id, { color: c })}
                    className={`h-12 w-12 rounded-lg ${b.color === c ? "ring-4 ring-accent ring-offset-2" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
          </Field>
          <Field label={B.icon}>
            {() => (
              <Choice<AnswerIcon>
                name={B.icon}
                value={b.icon}
                options={ICONS.map((i) => ({ value: i, label: B.icons[i] }))}
                onChange={(icon) => update(b.id, { icon })}
              />
            )}
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label={`${B.label}: ${t.care.languages.lang.ru}`}>
              {(id) => <TextInput id={id} value={b.label.ru} onChange={(e) => update(b.id, { label: { ...b.label, ru: e.target.value } })} />}
            </Field>
            <Field label={`${B.label}: ${t.care.languages.lang.kk}`}>
              {(id) => (
                <TextInput id={id} lang="kk" value={b.label.kk} onChange={(e) => update(b.id, { label: { ...b.label, kk: e.target.value } })} />
              )}
            </Field>
          </div>
          <Field label={B.meaning}>
            {(id) => (
              <Select id={id} value={b.meaning} onChange={(e) => update(b.id, { meaning: e.target.value as AnswerMeaning })}>
                {MEANINGS.map((m) => (
                  <option key={m} value={m}>
                    {B.meanings[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col gap-2 py-2">
            <span className="text-[15px] font-medium">{t.care.common.voice}</span>
            <VoiceRecorder label={t.care.languages.lang.ru} value={b.audio?.ru} onChange={(ru) => update(b.id, { audio: { ...b.audio, ru } })} />
            <VoiceRecorder label={t.care.languages.lang.kk} value={b.audio?.kk} onChange={(kk) => update(b.id, { audio: { ...b.audio, kk } })} />
          </div>
        </div>
      ))}
    </section>
  );
}
