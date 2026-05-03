import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5202,
  },
  resolve: {
    tsconfigPaths: true,
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
});
