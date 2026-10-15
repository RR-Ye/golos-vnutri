"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { firstSyllable, newCard, pickNext, record, type CardState } from "@/engine";
import type { Lang, RepeatResult } from "@/engine/types";
import { EntityPicture } from "@/components/EntityPicture";
import { Icon } from "@/components/Icon";
import { isUnlocked, PinForm } from "@/components/PinForm";
import { Press } from "@/components/patient/Press";
import { langsOf, resolveMode, utterancesFor } from "@/lib/audio/sound";
import { speaker } from "@/lib/audio/speaker";
import { db, newId } from "@/lib/db";
import { useSettings } from "@/lib/db/useSettings";
import { ru } from "@/lib/i18n";
import { practiceItems, type PracticeItem } from "@/lib/practice";

const P = ru.care.practice;
const RESULTS: { r: RepeatResult; color: string }[] = [
  { r: "self", color: "var(--yes)" },
  { r: "prompted", color: "var(--almost)" },
  { r: "failed", color: "var(--ink-2)" },
];

export default function PracticePage() {
  const [settings] = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const data = useLiveQuery(async () => {
    const [entities, words, practice] = await Promise.all([db().entities.toArray(), db().words.toArray(), db().practice.toArray()]);
    return { entities, words, practice };
  }, []);

  useEffect(() => setUnlocked(isUnlocked()), []);

  const items = useMemo(() => (data ? practiceItems(data.entities, data.words) : []), [data]);
  const cards = useMemo(() => {
    const now = Date.now();
    return items.map((it) => (data?.practice.find((p) => p.key === it.key) as CardState | undefined) ?? newCard(it.key, now));
  }, [items, data?.practice]);

  const item = items.find((i) => i.key === current) ?? null;
  const card = cards.find((c) => c.key === current) ?? null;

  const play = (it: PracticeItem, level: number) => {
    if (!settings) return;
    if (level >= 2) return;
    const base = { text: it.text, audio: it.audio, mode: it.mode, develop: it.develop, category: it.category };
    if (level === 0) {
      void speaker.speak(utterancesFor(base, settings), { interrupt: true });
      return;
    }
    // Первый слог: на каждом языке режима, записи тут не годятся — нужен синтез или голос устройства.
    const langs: Lang[] = langsOf(resolveMode(base, settings));
    void speaker.speak(
      langs.filter((l) => it.text[l]).map((l) => ({ lang: l, text: firstSyllable(it.text[l]) })),
      { interrupt: true },
    );
  };

  const show = (key: string) => {
    setCurrent(key);
    const it = items.find((i) => i.key === key);
    const c = cards.find((x) => x.key === key);
    if (it && c) play(it, c.level);
  };

  const next = (last?: string) => {
    const c = pickNext(cards, Date.now(), last);
    if (c) show(c.key);
  };

  if (!settings) return null;
  if (!unlocked) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <PinForm settings={settings} onOk={() => setUnlocked(true)} onCancel={() => window.location.assign("/")} />
      </main>
    );
  }

  const mark = async (result: RepeatResult) => {
    if (!card || !item) return;
    const now = Date.now();
    const updated = record(card, result, now);
    await db().practice.put({ ...updated });
    await db().attempts.put({
      id: newId("att"),
      at: now,
      wordId: item.key.startsWith("word:") ? item.key.slice(5) : null,
      text: item.text[settings.primaryLang] || item.text.ru,
      kind: "practice",
      result,
    });
    setDone((n) => n + 1);
    const others = cards.map((c) => (c.key === card.key ? updated : c));
    const nxt = pickNext(others, now, card.key);
    if (nxt) show(nxt.key);
  };

  return (
    <main className="patient-root flex flex-col gap-6 bg-bg p-6 text-ink" data-theme={settings.patientTheme}>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold">{P.title}</h1>
          <p className="text-[15px] text-ink-2">{P.lead}</p>
        </div>
        <a href="/care/?s=progress" className="min-h-12 rounded-lg border border-line bg-surface px-5 py-3 text-[16px] font-medium">
          {P.finish}
          {done > 0 && ` (${done})`}
        </a>
      </header>

      {!started || !item || !card ? (
        <div className="flex flex-1 items-center justify-center">
          {items.length === 0 ? (
            <p className="max-w-[48ch] text-center text-[18px] text-ink-2">{P.empty}</p>
          ) : (
            <Press
              label={P.start}
              testId="practice-start"
              onPress={() => {
                setStarted(true);
                next();
              }}
              className="flex h-[280px] w-[420px] max-w-full flex-col items-center justify-center gap-3 rounded-[36px] bg-accent text-accent-ink"
            >
              <Icon id="book" size={110} />
              <span className="text-[28px] font-semibold">{P.start}</span>
              <span className="text-[16px] opacity-90">{`${P.cards}: ${items.length}`}</span>
            </Press>
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 items-center gap-8 rounded-3xl bg-surface p-6 max-sm:flex-col" data-testid="practice-card">
            <div className="shrink-0">
              {item.entity ? <EntityPicture entity={item.entity} size={260} lang={settings.primaryLang} /> : <Icon id={item.icon ?? "chat"} size={240} />}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-[56px] leading-none font-semibold tracking-[-0.015em]" lang="kk">
                {item.text.kk}
              </p>
              <p className="text-[40px] leading-none font-semibold text-ink-2">{item.text.ru}</p>
              <p className="mt-2 text-[17px]" data-testid="practice-level">
                {P.levelLabel}: <b>{P.levels[card.level]}</b>
                {card.level === 1 && ` (${firstSyllable(item.text.kk || item.text.ru)}…)`}
              </p>
              <button
                type="button"
                onClick={() => play(item, Math.min(card.level, 1))}
                className="mt-2 flex min-h-12 w-fit items-center gap-2 rounded-lg border border-line px-4 text-[16px]"
              >
                <Icon id="speaker" size={28} />
                {card.level < 2 ? P.again : P.hintNow}
              </button>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-6 max-sm:grid-cols-1">
            {RESULTS.map(({ r, color }) => (
              <button
                key={r}
                type="button"
                data-testid={`practice-${r}`}
                onClick={() => void mark(r)}
                className="flex min-h-[120px] flex-col items-center justify-center rounded-3xl text-[22px] font-semibold text-white"
                style={{ background: color }}
              >
                {ru.care.history.results[r]}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
