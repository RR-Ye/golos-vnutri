"use client";

import { useRef, useState } from "react";
import { deleteMedia, putMedia, useMediaUrl } from "@/lib/db/media";
import { ManualRecorder, type Recording } from "@/lib/audio/recorder";
import { t } from "@/lib/i18n";
import { Btn } from "./ui";

export function useRecorder() {
  const rec = useRef<ManualRecorder | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    rec.current = new ManualRecorder();
    try {
      await rec.current.start();
      setState("recording");
    } catch (e) {
      setState("error");
      setError((e as Error).message === "unsupported" ? t.care.recorder.unsupported : t.care.recorder.denied);
    }
  }

  async function stop(): Promise<Recording | null> {
    if (!rec.current) return null;
    const r = await rec.current.stop();
    rec.current = null;
    setState("idle");
    return r;
  }

  return { state, error, start, stop };
}

export function PlayButton({ mediaId, label = t.care.recorder.play }: { mediaId: string; label?: string }) {
  const url = useMediaUrl(mediaId);
  return (
    <Btn
      disabled={!url}
      onClick={() => {
        if (url) void new Audio(url).play();
      }}
    >
      {label}
    </Btn>
  );
}

/** Одна запись голосом: записать, прослушать, удалить. */
export function VoiceRecorder({
  value,
  onChange,
  label,
}: {
  value: string | undefined;
  onChange: (mediaId: string | undefined) => void;
  label: string;
}) {
  const r = useRecorder();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-28 text-[15px] text-ink-2">{label}</span>
      {r.state === "recording" ? (
        <Btn
          tone="primary"
          onClick={async () => {
            const rec = await r.stop();
            if (!rec || rec.durationMs < 150) return;
            const id = await putMedia(rec.wav, "audio");
            await deleteMedia(value);
            onChange(id);
          }}
        >
          {t.care.words.stop}
        </Btn>
      ) : (
        <Btn onClick={() => void r.start()}>{t.care.words.record}</Btn>
      )}
      {value && r.state !== "recording" && (
        <>
          <PlayButton mediaId={value} />
          <Btn
            tone="quiet"
            onClick={async () => {
              await deleteMedia(value);
              onChange(undefined);
            }}
          >
            {t.care.common.delete}
          </Btn>
        </>
      )}
      {r.state === "recording" && <span className="text-[15px] text-danger">{t.care.recorder.recording}</span>}
      {r.error && <span className="text-[15px] text-danger">{r.error}</span>}
    </div>
  );
}
