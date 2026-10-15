import type { TopicId } from "@/engine/types";
import { db } from "./index";
import type { AnswerButton, Settings } from "./types";

export const DEFAULT_TOPICS: TopicId[] = [
  "needs",
  "health",
  "people",
  "feelings",
  "things",
  "places",
  "memories",
  "opinion",
];

export const DEFAULT_ANSWER_BUTTONS: AnswerButton[] = [
  { id: "yes", color: "#1E7B3A", icon: "check", label: { ru: "Да", kk: "Иә" }, meaning: "yes" },
  { id: "no", color: "#B3261E", icon: "cross", label: { ru: "Нет", kk: "Жоқ" }, meaning: "no" },
  { id: "almost", color: "#8A5A00", icon: "tilde", label: { ru: "Почти", kk: "Жақын" }, meaning: "almost" },
];

export function defaultSettings(): Settings {
  return {
    id: "main",
    personName: "",
    pinHash: "",
    pinSalt: "",
    primaryLang: "ru",
    speakerGender: "f",
    addressForm: "ty",
    hand: "left",
    sound: { global: "ru", byCategory: { people: "kk-ru", words: "kk-ru" } },
    answerButtons: DEFAULT_ANSWER_BUTTONS.map((b) => ({ ...b, label: { ...b.label } })),
    thirdButton: false,
    topics: [...DEFAULT_TOPICS],
    frameToggles: {},
    epsilon: null,
    confirmThreshold: 0.75,
    maxQuestions: 6,
    micEnabled: true,
    systemVoice: true,
    patientTheme: "light",
    declineSoftSignNames: true,
    lastBackupAt: null,
    createdAt: Date.now(),
  };
}

export async function loadSettings(): Promise<Settings | undefined> {
  return db().settings.get("main");
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = (await loadSettings()) ?? defaultSettings();
  const next: Settings = { ...current, ...patch, id: "main" };
  await db().settings.put(next);
  return next;
}

const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export async function makePinRecord(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const pinSalt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { pinHash: await hashPin(pin, pinSalt), pinSalt };
}

export async function checkPin(settings: Settings, pin: string): Promise<boolean> {
  if (!settings.pinHash) return true;
  return (await hashPin(pin, settings.pinSalt)) === settings.pinHash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
