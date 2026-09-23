/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { type Dirent } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { locales } from "#app/i18n/paraglide/runtime";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "docs" });

export interface ContentMount {
  /** Every markdown file in the mount, locale subdirectories included. Null when unreadable. */
  list(): Promise<string[] | null>;
  /** A document's text; null when it is gone or no longer inside the mount. */
  read(file: string): Promise<string | null>;
}

/**
 * A directory of markdown mounted at runtime. Entries may be symlinks — that is
 * how a ConfigMap volume presents its keys — so every read is checked to still
 * land inside the mount, or a link could publish any file the server can read.
 */
export function contentMount(dir: string): ContentMount {
  return { list: () => list(dir), read: (file) => read(dir, file) };
}

async function list(dir: string): Promise<string[] | null> {
  const rootEntries = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    logger.warn({ error, context: { dir } }, "Content directory could not be read");
    return null;
  });
  if (rootEntries === null) return null;

  const files: string[] = [];
  for (const entry of rootEntries) {
    if (isMarkdown(entry)) {
      files.push(entry.name);
      continue;
    }

    if (!entry.isDirectory() || !locales.some((locale) => locale === entry.name)) continue;

    const nested = await readdir(path.join(dir, entry.name), { withFileTypes: true }).catch(
      (error: unknown) => {
        logger.warn({ error, context: { dir: entry.name } }, "Locale directory could not be read");
        return [];
      },
    );
    for (const nestedEntry of nested) {
      if (isMarkdown(nestedEntry)) files.push(`${entry.name}/${nestedEntry.name}`);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function read(dir: string, file: string): Promise<string | null> {
  try {
    const resolved = await realpath(path.join(dir, file));
    if (!isInside(await realpath(dir), resolved)) {
      logger.warn({ context: { file } }, "Document outside the content directory ignored");
      return null;
    }
    return await readFile(resolved, "utf8");
  } catch (error) {
    logger.warn({ error, context: { file } }, "Document could not be read");
    return null;
  }
}

function isMarkdown(entry: Dirent): boolean {
  if (!entry.isFile() && !entry.isSymbolicLink()) return false;
  return entry.name.toLowerCase().endsWith(".md");
}

// Segment-wise, not a `..` prefix: a ConfigMap mounted at the content root
// resolves through a revision directory literally named `..<timestamp>`.
function isInside(root: string, resolved: string): boolean {
  const relative = path.relative(root, resolved);
  if (relative === "" || path.isAbsolute(relative)) return false;
  return relative.split(path.sep)[0] !== "..";
}
