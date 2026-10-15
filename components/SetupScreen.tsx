"use client";

import { useState } from "react";
import { isValidPin } from "@/lib/db/settings";
import { setupDemo, setupEmpty } from "@/lib/db/seed";
import { t } from "@/lib/i18n";
import { Btn, Field, TextInput } from "./care/ui";
import { markUnlocked } from "./PinForm";

/** Первый запуск: PIN для близких и выбор — пример или пустая анкета. */
export function SetupScreen() {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const S = t.setup;
  const error = pin && !isValidPin(pin) ? S.pinInvalid : pin2 && pin !== pin2 ? S.pinMismatch : null;
  const ready = isValidPin(pin) && pin === pin2 && !busy;

  const go = async (demo: boolean) => {
    setBusy(true);
    await (demo ? setupDemo(pin) : setupEmpty(pin));
    markUnlocked();
    window.location.href = demo ? "/" : "/care/";
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.01em]">{t.appName}</h1>
      <p className="text-[18px] leading-relaxed text-ink-2">{S.lead}</p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label={S.pin}>
          {(id) => (
            <TextInput id={id} data-testid="setup-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          )}
        </Field>
        <Field label={S.pinRepeat}>
          {(id) => (
            <TextInput id={id} data-testid="setup-pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} />
          )}
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Btn tone="primary" disabled={!ready} onClick={() => void go(true)} data-testid="setup-demo">
            {busy ? S.working : S.demo}
          </Btn>
          <p className="text-[15px] text-ink-2">{S.demoHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Btn disabled={!ready} onClick={() => void go(false)}>
            {S.empty}
          </Btn>
          <p className="text-[15px] text-ink-2">{S.emptyHint}</p>
        </div>
      </div>
    </main>
  );
}
