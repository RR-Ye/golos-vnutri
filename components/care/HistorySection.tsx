"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import type { Lang, RepeatResult } from "@/engine/types";
import { db } from "@/lib/db";
import type { HistoryMessage, WhyItem } from "@/lib/db/types";
import { fmt, t } from "@/lib/i18n";
import { Btn, Choice, SectionHeader } from "./ui";

const H = t.care.history;
const RESULTS: RepeatResult[] = ["self", "prompted", "failed"];

export function WhyView({ items }: { items: WhyItem[] }) {
  return (
    <div className="mt-2 rounded-lg bg-surface-2 p-3" data-testid="why">
      <p className="mb-2 text-[14px] text-ink-2">{t.care.why.hint}</p>
      {items.map((w, i) => (
        <div key={w.key} className={i ? "mt-3 border-t border-line pt-3" : ""}>
          <p className="text-[16px] font-medium">
            {w.text} <span className="font-normal text-ink-2">{Math.round(w.p * 100)} %</span>
            {i === 0 && <span className="ml-2 rounded bg-accent-soft px-1.5 text-[13px]">{t.care.why.chosen}</span>}
          </p>
          <ul className="mt-1">
            {w.contributions.map((c, j) => (
              <li key={j} className="flex justify-between gap-4 text-[14px]">
                <span>{c.label}</span>
                <span className={`tabular-nums ${c.weight >= 0 ? "text-yes" : "text-danger"}`}>
                  {c.weight >= 0 ? "+" : "−"}
                  {Math.abs(c.weight).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MessageRow({ m }: { m: HistoryMessage }) {
  const [open, setOpen] = useState(false);
  const setRepeat = (lang: Lang, r: RepeatResult) => void db().history.update(m.id, { repeat: { ...m.repeat, [lang]: r } });
  return (
    <article className="border-b border-line py-4" data-testid="history-item">
      <p className="text-[14px] text-ink-2">
        {new Date(m.at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        {" — "}
        {fmt(H.steps, { n: m.steps })}, {fmt(H.questions, { n: m.questions })}
        {m.repeatSeries > 0 && `, ${fmt(H.repeats, { n: m.repeatSeries })}`}
      </p>
      <p className="mt-1 text-[19px] font-medium">{m.text?.ru ?? m.sentences.map((s) => s.text.ru).join(" ")}</p>
      <p className="text-[16px] text-ink-2" lang="kk">
        {m.text?.kk ?? m.sentences.map((s) => s.text.kk).join(" ")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {(["ru", "kk"] as const).map((lang) => (
          <div key={lang} className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] text-ink-2">
              {H.repeated} ({t.care.languages.lang[lang]}):
            </span>
            <Choice<RepeatResult>
              name={`${H.repeated} ${lang}`}
              value={m.repeat[lang] ?? ("" as RepeatResult)}
              options={RESULTS.map((r) => ({ value: r, label: H.results[r] }))}
              onChange={(r) => setRepeat(lang, r)}
            />
          </div>
        ))}
      </div>
      {m.sentences.some((s) => s.why?.length) && (
        <Btn tone="quiet" className="mt-2" onClick={() => setOpen((o) => !o)}>
          {open ? H.hideWhy : H.showWhy}
        </Btn>
      )}
      {open && m.sentences.map((s, i) => (s.why ? <WhyView key={i} items={s.why} /> : null))}
    </article>
  );
}

export function HistorySection() {
  const items = useLiveQuery(() => db().history.orderBy("at").reverse().limit(200).toArray(), []);
  return (
    <section className="max-w-[820px]">
      <SectionHeader title={t.care.nav.history} lead={H.lead} />
      {items?.length === 0 && <p className="text-ink-2">{H.empty}</p>}
      {items?.map((m) => <MessageRow key={m.id} m={m} />)}
    </section>
  );
}
