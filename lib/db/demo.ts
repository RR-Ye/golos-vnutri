// Демо-данные живут в движке (их использует и симулятор); здесь только настройки.
import { defaultSettings } from "./settings";
import type { Settings } from "./types";

export { demoEntities, demoNotes, demoRoutine, demoWords } from "@/engine/demo";

export function demoSettings(pin: { pinHash: string; pinSalt: string }): Settings {
  return { ...defaultSettings(), ...pin, personName: "Зейнеп апа" };
}
