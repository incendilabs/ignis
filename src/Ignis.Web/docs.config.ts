/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { defineDocsConfig } from "@eventuras/lectio-docs";

/**
 * Gathers the repository's documentation into `.lectio/` for the web app to
 * serve at /docs. 
 */
export default defineDocsConfig({
  output: ".lectio",
  editUrl: "https://github.com/incendilabs/ignis/edit/main/{path}",
  // Links to files outside the collected set — the component READMEs, the
  // decision records — go to GitHub rather than nowhere.
  sourceUrl: "https://github.com/incendilabs/ignis/blob/main/{path}",
  sources: [
    {
      glob: "docs/**/*.md",
      target: "/",
      // Decision records are internal working notes. They stay readable on
      // GitHub, and the links to them resolve there.
      ignore: ["docs/ADR/**"],
    },
  ],
});
