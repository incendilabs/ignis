import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Config } from "@react-router/dev/config";

function loadLocalEnv(): Record<string, string> {
  const path = fileURLToPath(new URL(".env", import.meta.url));
  if (!existsSync(path)) return process.env as Record<string, string>;

  const parsed = Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }),
  );

  return { ...parsed, ...process.env } as Record<string, string>;
}

function csv(value: string | undefined): string[] {
  return value?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
}

function hostFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

const env = loadLocalEnv();
const webPort = env.IGNIS_WEB_DEV_PORT || "5202";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  allowedActionOrigins: unique([
    ...csv(env.IGNIS_WEB_DEV_ALLOWED_ACTION_ORIGINS),
    hostFromUrl(env.IGNIS_WEB_APP_URL),
    `localhost:${webPort}`,
    `127.0.0.1:${webPort}`,
    `[::1]:${webPort}`,
  ]),
} satisfies Config;
