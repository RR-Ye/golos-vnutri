"use client";

import { useState } from "react";
import { checkPin } from "@/lib/db/settings";
import type { Settings } from "@/lib/db/types";
import { t } from "@/lib/i18n";
import { Btn, TextInput } from "./care/ui";

const KEY = "golos-care-unlocked";

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* приватный режим: вход сработает, но не запомнится */
  }
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function lock(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
}

export function PinForm({ settings, onOk, onCancel }: { settings: Settings; onOk: () => void; onCancel?: () => void }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className="flex w-full max-w-[360px] flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await checkPin(settings, pin)) {
          markUnlocked();
          onOk();
        } else {
          setWrong(true);
          setPin("");
        }
      }}
    >
      <h1 className="text-[26px] font-semibold">{t.pin.title}</h1>
      <label htmlFor="pin" className="text-[16px] text-ink-2">
        {t.pin.enter}
      </label>
      <TextInput
        id="pin"
        data-testid="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          setWrong(false);
        }}
      />
      {wrong && (
        <p role="alert" className="text-[16px] text-danger">
          {t.pin.wrong}
        </p>
      )}
      <div className="flex gap-3">
        <Btn tone="primary" type="submit" disabled={pin.length < 4}>
          {t.pin.ok}
        </Btn>
        {onCancel && <Btn onClick={onCancel}>{t.pin.cancel}</Btn>}
      </div>
    </form>
  );
}
