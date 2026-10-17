"use client";

import { useState } from "react";
import type { Lang } from "@/engine/types";
import { ensurePiper, type PiperBackend } from "@/lib/audio/piper";
import { speaker } from "@/lib/audio/speaker";
import { fmt, t } from "@/lib/i18n";
import { Btn } from "./ui";

const V = t.care.voice;
const SAMPLE: Record<Lang, string> = { ru: "Мне грустно, потому что я скучаю по Алии.", kk: "Көңілім жоқ, себебі мен Әлияны сағындым." };

const sec = (x: number) => x.toFixed(1).replace(".", ",");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Проверка локального синтеза и замер скорости прямо на этом планшете. */
export function VoiceCheck() {
  const [state, setState] = useState<"idle" | "busy" | "none" | "failed">("idle");
  const [rows, setRows] = useState<{ lang: Lang; name: string; load: number; first: number; again: number; audio: number }[]>([]);
  return (
    <div className="border-t border-line py-4" data-testid="voice-check">
      <h2 className="text-[18px] font-semibold">{V.title}</h2>
      <p className="text-[14px] text-ink-2">{V.hint}</p>
      <Btn
        className="mt-3"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const b: PiperBackend | null = await ensurePiper((x) => (speaker.synth = x));
          if (!b) return setState("none");
          const tLoad = performance.now();
          if (!(await b.whenReady())) return setState("failed");
          const load = performance.now() - tLoad;
          const out: typeof rows = [];
          for (const lang of ["ru", "kk"] as const) {
            if (!b.supports(lang)) continue;
            const t0 = performance.now();
            const r = await b.measure(SAMPLE[lang], lang);
            const first = performance.now() - t0;
            const t1 = performance.now();
            await b.measure(SAMPLE[lang], lang);
            const again = performance.now() - t1;
            out.push({ lang, name: b.voices[lang]?.name ?? "", load, first, again, audio: r.pcm.length / r.rate });
          }
          setRows(out);
          // Звучит после замера, чтобы не мешать ему.
          void speaker.speak(out.map((r) => ({ lang: r.lang, text: SAMPLE[r.lang] })));
          setState("idle");
        }}
      >
        {state === "busy" ? V.running : V.run}
      </Btn>
      {state === "none" && <p className="mt-2 text-[15px] text-danger">{V.none}</p>}
      {state === "failed" && <p className="mt-2 text-[15px] text-danger">{V.failed}</p>}
      {rows.map((r) => (
        <p key={r.lang} className="mt-2 text-[15px]" data-testid={`voice-${r.lang}`}>
          <b>{capitalize(t.care.languages.lang[r.lang])}</b>, {fmt(V.voiceName, { name: r.name.split("-")[1] ?? r.name })}:{" "}
          {fmt(V.result, { load: sec(r.load / 1000), first: sec(r.first / 1000), again: sec(r.again / 1000), audio: sec(r.audio) })}
        </p>
      ))}
    </div>
  );
}
