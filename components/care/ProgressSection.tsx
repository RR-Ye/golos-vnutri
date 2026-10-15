"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { Lang } from "@/engine/types";
import { db, newId } from "@/lib/db";
import { featuresFromPcm } from "@/lib/audio/asr";
import { decodeWav, resample, TARGET_RATE, trimSilence } from "@/engine/asr";
import { fmt, t } from "@/lib/i18n";
import { Btn, SectionHeader } from "./ui";
import { PlayButton } from "./VoiceRecorder";

const P = t.care.progress;

interface Row {
  key: string;
  text: string;
  lang: Lang;
  saidFirst: number | null;
  saidCount: number;
  repeatFirst: number | null;
  repeatCount: number;
}

const date = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "—");

export function ProgressSection({ onOpenWord }: { onOpenWord?: (wordId: string) => void }) {
  const data = useLiveQuery(async () => {
    const [words, attempts, history, practice, entities] = await Promise.all([
      db().words.toArray(),
      db().attempts.orderBy("at").toArray(),
      db().history.toArray(),
      db().practice.toArray(),
      db().entities.toArray(),
    ]);
    return { words, attempts, history, practice, entities };
  }, []);
  if (!data) return null;

  const rows = new Map<string, Row>();
  const row = (key: string, text: string, lang: Lang) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { key, text, lang, saidFirst: null, saidCount: 0, repeatFirst: null, repeatCount: 0 }));
    return r;
  };
  // Сказала сама: распознанные слова
  for (const a of data.attempts) {
    if (!a.wordId || a.kind === "practice") continue;
    const w = data.words.find((x) => x.id === a.wordId);
    if (!w) continue;
    const r = row(`w:${w.id}:${w.lang}`, w.text, w.lang);
    r.saidCount += a.repeatCount ?? 1;
    r.saidFirst ??= a.at;
  }
  // Повторила фразу: отметки в истории
  for (const m of data.history) {
    for (const lang of ["ru", "kk"] as const) {
      const res = m.repeat[lang];
      if (res !== "self" && res !== "prompted") continue;
      const text = m.text?.[lang] ?? m.sentences.map((s) => s.text[lang]).join(" ");
      const r = row(`m:${text}`, text, lang);
      r.repeatCount++;
      r.repeatFirst = r.repeatFirst === null ? m.at : Math.min(r.repeatFirst, m.at);
    }
  }
  // Повторила слово на занятиях развития речи
  for (const p of data.practice) {
    const [kind, id] = p.key.split(":") as [string, string];
    const name =
      kind === "word" ? data.words.find((w) => w.id === id) : data.entities.find((e) => e.id === id);
    if (!name) continue;
    for (const res of p.results) {
      if (res.result === "failed") continue;
      const langs: Lang[] = ["ru", "kk"];
      for (const lang of langs) {
        const text = "text" in name ? (name.lang === lang ? name.text : (name.translation ?? "")) : name.name[lang];
        if (!text) continue;
        const r = row(`p:${p.key}:${lang}`, text, lang);
        r.repeatCount++;
        r.repeatFirst = r.repeatFirst === null ? res.at : Math.min(r.repeatFirst, res.at);
      }
    }
  }
  const unknown = data.attempts.filter((a) => !a.wordId && a.mediaId).slice(-20).reverse();
  const list = [...rows.values()].sort((a, b) => (b.saidCount + b.repeatCount) - (a.saidCount + a.repeatCount));

  return (
    <section className="max-w-[820px]">
      <SectionHeader title={t.care.nav.progress} lead={P.lead} />
      {(["kk", "ru"] as const).map((lang) => {
        const mine = list.filter((r) => r.lang === lang);
        return (
          <div key={lang} className="mb-6">
            <h2 className="text-[20px] font-semibold">{t.care.languages.lang[lang]}</h2>
            {mine.length === 0 && <p className="text-ink-2">{P.empty}</p>}
            <table className="mt-2 w-full text-left text-[16px]">
              {mine.length > 0 && (
                <thead className="text-[14px] text-ink-2">
                  <tr>
                    <th className="py-1 font-normal"></th>
                    <th className="py-1 font-normal">{P.said}</th>
                    <th className="py-1 font-normal">{P.repeated}</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {mine.map((r) => (
                  <tr key={r.key} className="border-t border-line align-top">
                    <td className="py-2 pr-3 font-medium" lang={lang}>
                      {r.text}
                    </td>
                    <td className="py-2 pr-3 text-ink-2">
                      {r.saidCount ? `${fmt(P.times, { n: r.saidCount })}, ${P.firstTime} ${date(r.saidFirst)}` : "—"}
                    </td>
                    <td className="py-2 text-ink-2">
                      {r.repeatCount ? `${fmt(P.times, { n: r.repeatCount })}, ${P.firstTime} ${date(r.repeatFirst)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <h2 className="mt-4 text-[20px] font-semibold">{P.unknownTitle}</h2>
      <p className="text-[15px] text-ink-2">{P.unknownHint}</p>
      {unknown.length === 0 && <p className="mt-2 text-ink-2">{P.empty}</p>}
      <div className="mt-2">
        {unknown.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 border-t border-line py-2">
            <span className="min-w-36 text-[15px] text-ink-2">{new Date(a.at).toLocaleString("ru-RU")}</span>
            <PlayButton mediaId={a.mediaId!} />
            <Btn
              tone="primary"
              onClick={async () => {
                const id = newId("w");
                const n = (await db().words.count()) + 1;
                await db().words.put({
                  id,
                  text: `${P.newWord} ${n}`,
                  lang: "kk",
                  meanings: [],
                  oftenRepeats: false,
                  develop: true,
                  createdAt: Date.now(),
                });
                const media = await db().media.get(a.mediaId!);
                if (media) {
                  const { pcm, rate } = decodeWav(new Uint8Array(await media.blob.arrayBuffer()));
                  const clean = trimSilence(resample(pcm, rate, TARGET_RATE), TARGET_RATE);
                  await db().samples.put({
                    id: newId("smp"),
                    wordId: id,
                    mediaId: a.mediaId!,
                    ...featuresFromPcm(clean),
                    durationMs: Math.round((clean.length / TARGET_RATE) * 1000),
                    createdAt: Date.now(),
                  });
                }
                await db().attempts.update(a.id, { wordId: id });
                onOpenWord?.(id);
              }}
            >
              {P.addToDict}
            </Btn>
          </div>
        ))}
      </div>
    </section>
  );
}
