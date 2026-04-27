import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 5202,
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    paraglideVitePlugin({
      project: "./app/i18n/project.inlang",
      outdir: "./app/i18n/paraglide",
      emitTsDeclarations: true,
      strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
    }),
  ],
});
