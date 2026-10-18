/** Мост к оболочке Android (APK). Его нет в браузере — там всё работает как на сайте. */
interface GolosAndroidBridge {
  /** Сохраняет файл в «Загрузки» планшета; возвращает "ok" или текст ошибки. */
  saveFile(name: string, mime: string, base64: string): string;
}

declare global {
  interface Window {
    GolosAndroid?: GolosAndroidBridge;
  }
}

/** Приложение открыто из APK: все файлы внутри, service worker не нужен. */
export function inAndroidApp(): boolean {
  return typeof window !== "undefined" && !!window.GolosAndroid;
}

export async function saveFileAndroid(blob: Blob, name: string): Promise<boolean> {
  const bridge = window.GolosAndroid;
  if (!bridge) return false;
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return bridge.saveFile(name, blob.type || "application/octet-stream", base64) === "ok";
}
