import type { NextConfig } from "next";

// GitHub Pages отдаёт приложение по адресу /golos-vnutri/, APK — по /app/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
