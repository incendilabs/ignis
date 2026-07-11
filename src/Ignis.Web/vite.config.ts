import { existsSync, readFileSync } from "node:fs";
import type { ServerOptions } from "node:https";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

function csv(value: string | undefined): string[] {
  return value?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
}

function resolveConfigPath(path: string): string {
  return isAbsolute(path) ? path : fileURLToPath(new URL(path, import.meta.url));
}

function httpsConfig(env: Record<string, string>): ServerOptions | undefined {
  if (env.IGNIS_WEB_DEV_HTTPS !== "true") return undefined;

  const keyPath = env.IGNIS_WEB_DEV_HTTPS_KEY;
  const certPath = env.IGNIS_WEB_DEV_HTTPS_CERT;
  if (!keyPath || !certPath)
    throw new Error(
      "IGNIS_WEB_DEV_HTTPS is enabled but IGNIS_WEB_DEV_HTTPS_KEY and IGNIS_WEB_DEV_HTTPS_CERT are not set.",
    );

  const resolvedKeyPath = resolveConfigPath(keyPath);
  const resolvedCertPath = resolveConfigPath(certPath);
  if (!existsSync(resolvedKeyPath) || !existsSync(resolvedCertPath))
    throw new Error(
      `IGNIS_WEB_DEV_HTTPS cert files not found: ${resolvedKeyPath}, ${resolvedCertPath}. ` +
        "Generate them with 'dotnet dev-certs https --export-path certs/ignis-web-localhost.pem --format Pem --no-password'.",
    );

  return {
    key: readFileSync(resolvedKeyPath),
    cert: readFileSync(resolvedCertPath),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number.parseInt(env.IGNIS_WEB_DEV_PORT || "5202", 10);
  const allowedHosts = csv(env.IGNIS_WEB_DEV_ALLOWED_HOSTS);

  return {
    server: {
      port,
      https: httpsConfig(env),
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
    // Force a single React instance. 
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    plugins: [
      tailwindcss(),
      reactRouter(),
      paraglideVitePlugin({
        project: "./app/i18n/project.inlang",
        outdir: "./app/i18n/paraglide",
        emitTsDeclarations: true,
        strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
      }),
    ],
  };
});
