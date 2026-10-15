"use client";

import type { Lang, SoundMode, SpeakerGender } from "@/engine/types";
import { SOUND_CATEGORIES, type SoundCategory } from "@/lib/db/types";
import { useSettings } from "@/lib/db/useSettings";
import { t } from "@/lib/i18n";
import { Choice, Field, Rows, SectionHeader, Select, Toggle } from "./ui";

const MODES: SoundMode[] = ["ru", "ru-kk", "kk-ru", "kk"];

export function LanguagesSection() {
  const [s, save] = useSettings();
  if (!s) return null;
  const L = t.care.languages;
  return (
    <section className="max-w-[720px]">
      <SectionHeader title={t.care.nav.languages} lead={L.lead} />
      <Field label={L.primary} hint={L.primaryHint}>
        {() => (
          <Choice<Lang>
            name={L.primary}
            value={s.primaryLang}
            options={[
              { value: "ru", label: L.lang.ru },
              { value: "kk", label: L.lang.kk },
            ]}
            onChange={(primaryLang) => void save({ primaryLang })}
          />
        )}
      </Field>
      <Field label={L.global}>
        {(id) => (
          <Select id={id} value={s.sound.global} onChange={(e) => void save({ sound: { ...s.sound, global: e.target.value as SoundMode } })}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {L.modes[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <h2 className="mt-4 text-[18px] font-semibold">{L.byCategory}</h2>
      <Rows>
        {SOUND_CATEGORIES.map((c: SoundCategory) => (
          <Field key={c} label={L.categories[c]} inline>
            {(id) => (
              <Select
                id={id}
                className="max-w-[320px]"
                value={s.sound.byCategory[c] ?? ""}
                onChange={(e) => {
                  const byCategory = { ...s.sound.byCategory };
                  if (e.target.value) byCategory[c] = e.target.value as SoundMode;
                  else delete byCategory[c];
                  void save({ sound: { ...s.sound, byCategory } });
                }}
              >
                <option value="">{`${t.care.common.soundModeInherit}: ${L.modes[s.sound.global].toLowerCase()}`}</option>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {L.modes[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </Rows>

      <Field label={L.gender} hint={L.genderHint}>
        {() => (
          <Choice<SpeakerGender>
            name={L.gender}
            value={s.speakerGender}
            options={[
              { value: "f", label: L.genderF },
              { value: "m", label: L.genderM },
            ]}
            onChange={(speakerGender) => void save({ speakerGender })}
          />
        )}
      </Field>
      <Field label={L.address}>
        {() => (
          <Choice<"ty" | "vy">
            name={L.address}
            value={s.addressForm}
            options={[
              { value: "ty", label: L.addressTy },
              { value: "vy", label: L.addressVy },
            ]}
            onChange={(addressForm) => void save({ addressForm })}
          />
        )}
      </Field>
      <Toggle
        checked={s.declineSoftSignNames}
        onChange={(declineSoftSignNames) => void save({ declineSoftSignNames })}
        label={L.softSign}
      />
    </section>
  );
}
