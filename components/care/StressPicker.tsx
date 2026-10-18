"use client";

import { useState } from "react";
import { DEFAULT_NLG, framePhrase } from "@/engine";
import type { Entity, Lang } from "@/engine/types";
import { ensurePiper } from "@/lib/audio/piper";
import { speaker } from "@/lib/audio/speaker";
import { buildLexicon, builtinStress, setStressLexicon, vowelPositions } from "@/lib/audio/stress";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { Btn } from "./ui";

const S = t.care.stress;

/** Ударение в имени для синтеза: нажать на ударную гласную и послушать. */
export function StressPicker({ entity, onChange }: { entity: Entity; onChange: (stress: Entity["stress"]) => void }) {
  const [noSynth, setNoSynth] = useState(false);

  const listen = async (lang: Lang) => {
    const synth = await ensurePiper((b) => (speaker.synth = b));
    if (!synth || !(await synth.whenReady())) setNoSynth(true);
    // Словарь с ещё не сохранённой карточкой — чтобы сразу было слышно новое ударение.
    const all = await db().entities.toArray();
    setStressLexicon(buildLexicon([...all.filter((x) => x.id !== entity.id), entity]));
    const name = entity.name[lang].trim();
    const list = [{ lang, text: name }];
    if (entity.type === "person") list.push({ lang, text: framePhrase("people.call", { person: entity }, "say", lang, DEFAULT_NLG).text });
    void speaker.speak(list, { interrupt: true });
  };

  return (
    <div className="flex flex-col gap-3 py-3" data-testid="stress-picker">
      <span className="text-[15px] font-medium">{S.title}</span>
      <span className="-mt-2 text-[14px] text-ink-2">{S.hint}</span>
      {(["ru", "kk"] as const).map((lang) => {
        const name = entity.name[lang];
        const vowels = vowelPositions(name, lang);
        if (vowels.length < 2) return null;
        const own = entity.stress?.[lang];
        const chosen = own ?? builtinStress(name, lang);
        return (
          <div key={lang} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="w-28 text-[15px] first-letter:uppercase">{t.care.languages.lang[lang]}</span>
            <span className="flex items-center" lang={lang} role="group" aria-label={`${S.title}: ${name}`}>
              {[...name].map((ch, i) => {
                const k = vowels.indexOf(i) + 1;
                if (!k) return (
                  <span key={i} className="px-0.5 text-[22px]">
                    {ch}
                  </span>
                );
                const on = chosen === k;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${ch}, ${S.syllable} ${k}`}
                    onClick={() => onChange({ ...entity.stress, [lang]: k })}
                    className={`min-h-11 min-w-11 rounded-md border text-[22px] font-medium ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"}`}
                  >
                    {ch}
                  </button>
                );
              })}
            </span>
            <Btn tone="quiet" onClick={() => void listen(lang)}>
              {S.listen}
            </Btn>
            {own !== undefined && (
              <Btn
                tone="quiet"
                onClick={() => {
                  const next = { ...entity.stress };
                  delete next[lang];
                  onChange(next);
                }}
              >
                {S.reset}
              </Btn>
            )}
          </div>
        );
      })}
      {noSynth && <p className="text-[14px] text-danger">{S.noSynth}</p>}
    </div>
  );
}
