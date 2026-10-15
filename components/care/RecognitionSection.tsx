"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import type { LooResult } from "@/engine/asr";
import { evaluateMySamples, Listener, loadTemplates, recognizeRecording, type HeardSeries } from "@/lib/audio/asr";
import { db } from "@/lib/db";
import { fmt, t } from "@/lib/i18n";
import { Btn, Rows, SectionHeader } from "./ui";

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function RecognitionSection() {
  const R = t.care.recognition;
  const words = useLiveQuery(() => db().words.toArray(), []);
  const name = (id: string | null) => (id ? (words?.find((w) => w.id === id)?.text ?? id) : R.unknown);
  const [loo, setLoo] = useState<LooResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<HeardSeries[] | null>(null);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listener | null>(null);

  return (
    <section className="max-w-[760px]">
      <SectionHeader title={t.care.nav.recognition} lead={R.lead} />

      <h2 className="mt-2 text-[20px] font-semibold">{R.looTitle}</h2>
      <p className="text-[15px] text-ink-2">{R.looHint}</p>
      <Btn
        tone="primary"
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setLoo(await evaluateMySamples());
          setBusy(false);
        }}
      >
        {busy ? R.running : R.run}
      </Btn>
      {loo && (
        <div className="mt-4" data-testid="loo-result">
          {loo.total === 0 ? (
            <p className="text-ink-2">{R.notEnough}</p>
          ) : (
            <>
              <p className="text-[28px] font-semibold">
                {pct(loo.accuracy)} <span className="text-[16px] font-normal text-ink-2">{fmt(R.ofRecordings, { n: loo.total })}</span>
              </p>
              {Object.keys(loo.perWord).length < 2 ? (
                <p className="text-[15px] text-ink-2">{R.oneWord}</p>
              ) : (
                <p className={`text-[15px] ${loo.accuracy >= 0.85 ? "text-yes" : "text-danger"}`}>{loo.accuracy >= 0.85 ? R.goalMet : R.goalNotMet}</p>
              )}
              <Rows>
                {Object.entries(loo.perWord).map(([id, v]) => (
                  <div key={id} className="flex justify-between py-2 text-[17px]">
                    <span>{name(id)}</span>
                    <span className="text-ink-2">
                      {v.correct} / {v.total}
                    </span>
                  </div>
                ))}
              </Rows>
              {loo.confusions.length > 0 && (
                <p className="mt-3 text-[15px] text-ink-2">
                  {R.confusions}: {loo.confusions.map((c) => `«${name(c.truth)}» → «${name(c.predicted)}»`).join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <h2 className="mt-8 text-[20px] font-semibold">{R.liveTitle}</h2>
      <p className="text-[15px] text-ink-2">{R.liveHint}</p>
      <Btn
        tone={listening ? "danger" : "secondary"}
        className="mt-3"
        onClick={async () => {
          if (listening) {
            await listener.current?.stop();
            return;
          }
          setLive(null);
          setListening(true);
          listener.current = new Listener();
          try {
            const pcm = await listener.current.listen();
            setLive(await recognizeRecording(pcm, await loadTemplates()));
          } finally {
            setListening(false);
          }
        }}
      >
        {listening ? t.care.recorder.recording : R.liveStart}
      </Btn>
      {live && (
        <div className="mt-4" data-testid="live-result">
          {live.length === 0 && <p className="text-ink-2">{R.nothingHeard}</p>}
          {live.map((h, i) => (
            <div key={i} className="border-t border-line py-3">
              <p className="text-[20px] font-semibold">
                {name(h.wordId)}
                {h.repeats > 1 && <span className="font-normal text-ink-2"> × {h.repeats}</span>}
              </p>
              <p className="text-[15px] text-ink-2">
                {h.recognition.matches
                  .slice(0, 3)
                  .map((m) => `${name(m.wordId)} ${pct(m.confidence)}`)
                  .join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
