/**
 * Префикс адреса, если приложение живёт не в корне сайта: на GitHub Pages это
 * /golos-vnutri, в APK — /app. Задаётся при сборке (NEXT_PUBLIC_BASE_PATH).
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Путь внутри приложения: href("/care/") → "/golos-vnutri/care/". */
export const href = (path: string): string => BASE + path;
