"use client";

import { useState } from "react";
import { TOPICS } from "@/engine/ontology";
import type { TopicId } from "@/engine/types";
import { isValidPin, makePinRecord } from "@/lib/db/settings";
import { wipeAll } from "@/lib/db/seed";
import { useSettings } from "@/lib/db/useSettings";
import { t } from "@/lib/i18n";
import { Btn, Choice, Field, Rows, SectionHeader, TextInput, Toggle } from "./ui";

const SPIRITUAL = ["spirit.pray", "spirit.dua"];

export function GeneralSection() {
  const [s, save] = useSettings();
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  if (!s) return null;
  const G = t.care.general;

  const moveTopic = (id: TopicId, dir: -1 | 1) => {
    const list = [...s.topics];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    void save({ topics: list });
  };

  return (
    <section className="max-w-[720px]">
      <SectionHeader title={t.care.nav.general} />
      <Field label={G.personName}>
        {(id) => <TextInput id={id} value={s.personName} onChange={(e) => void save({ personName: e.target.value })} />}
      </Field>
      <Field label={G.hand}>
        {() => (
          <Choice<"left" | "right">
            name={G.hand}
            value={s.hand}
            options={[
              { value: "left", label: G.handLeft },
              { value: "right", label: G.handRight },
            ]}
            onChange={(hand) => void save({ hand })}
          />
        )}
      </Field>
      <Toggle checked={s.micEnabled} onChange={(micEnabled) => void save({ micEnabled })} label={G.mic} />
      <Field label={G.theme}>
        {() => (
          <Choice<"light" | "dark">
            name={G.theme}
            value={s.patientTheme}
            options={[
              { value: "light", label: G.themeLight },
              { value: "dark", label: G.themeDark },
            ]}
            onChange={(patientTheme) => void save({ patientTheme })}
          />
        )}
      </Field>

      <h2 className="mt-4 text-[18px] font-semibold">{G.topics}</h2>
      <p className="text-[14px] text-ink-2">{G.topicsHint}</p>
      <Rows>
        {[...s.topics, ...TOPICS.map((tp) => tp.id).filter((id) => !s.topics.includes(id))].map((id) => {
          const on = s.topics.includes(id);
          const info = TOPICS.find((tp) => tp.id === id)!;
          return (
            <div key={id} className="flex flex-wrap items-center gap-2">
              <div className="flex-1">
                <Toggle
                  checked={on}
                  label={info.name.ru}
                  onChange={(v) => void save({ topics: v ? [...s.topics, id] : s.topics.filter((x) => x !== id) })}
                />
              </div>
              {on && (
                <>
                  <Btn tone="quiet" onClick={() => moveTopic(id, -1)}>
                    {G.up}
                  </Btn>
                  <Btn tone="quiet" onClick={() => moveTopic(id, 1)}>
                    {G.down}
                  </Btn>
                </>
              )}
            </div>
          );
        })}
      </Rows>
      <Toggle
        checked={SPIRITUAL.every((f) => s.frameToggles[f])}
        onChange={(on) => {
          const frameToggles = { ...s.frameToggles };
          for (const f of SPIRITUAL) frameToggles[f] = on;
          void save({ frameToggles });
        }}
        label={G.spiritual}
        hint={G.spiritualHint}
      />

      <Field label={`${G.threshold}: ${Math.round(s.confirmThreshold * 100)}%`} hint={G.thresholdHint}>
        {(id) => (
          <input
            id={id}
            type="range"
            min={0.6}
            max={0.95}
            step={0.05}
            value={s.confirmThreshold}
            onChange={(e) => void save({ confirmThreshold: Number(e.target.value) })}
            className="h-11 w-full accent-[var(--accent)]"
          />
        )}
      </Field>
      <Field label={`${G.maxQuestions}: ${s.maxQuestions}`}>
        {(id) => (
          <input
            id={id}
            type="range"
            min={3}
            max={10}
            step={1}
            value={s.maxQuestions}
            onChange={(e) => void save({ maxQuestions: Number(e.target.value) })}
            className="h-11 w-full accent-[var(--accent)]"
          />
        )}
      </Field>
      <Toggle
        checked={s.epsilon === null}
        onChange={(auto) => void save({ epsilon: auto ? null : 0.1 })}
        label={`${G.epsilon}: ${G.epsilonAuto}`}
      />
      {s.epsilon !== null && (
        <Field label={`${G.epsilon}: ${Math.round(s.epsilon * 100)}%`}>
          {(id) => (
            <input
              id={id}
              type="range"
              min={0.02}
              max={0.35}
              step={0.01}
              value={s.epsilon ?? 0.1}
              onChange={(e) => void save({ epsilon: Number(e.target.value) })}
              className="h-11 w-full accent-[var(--accent)]"
            />
          )}
        </Field>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <Field label={G.newPin}>
          {(id) => (
            <TextInput id={id} inputMode="numeric" autoComplete="new-password" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
          )}
        </Field>
        <Btn
          disabled={!isValidPin(pin)}
          onClick={async () => {
            await save(await makePinRecord(pin));
            setPin("");
            setPinMsg(t.care.common.saved);
          }}
        >
          {G.changePin}
        </Btn>
        {pinMsg && <span className="ml-3 text-[15px] text-ink-2">{pinMsg}</span>}
      </div>

      <div className="mt-8 border-t border-line pt-4">
        <Btn
          tone="danger"
          onClick={async () => {
            if (!window.confirm(G.wipeConfirm)) return;
            await wipeAll();
            window.location.href = "/";
          }}
        >
          {G.wipe}
        </Btn>
      </div>
    </section>
  );
}
