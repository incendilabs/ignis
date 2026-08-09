/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  createContentSource,
  parseFrontmatter,
  pathToPage,
  type ContentSource,
  type Manifest,
  type PageMeta,
} from "@eventuras/lectio-docs/content";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { env } from "#app/env.server";
import { baseLocale, locales } from "#app/i18n/paraglide/runtime";
import { Logger } from "#app/logger";

import type { CollectionId } from "./collections.shared";

const logger = Logger.create({ namespace: "docs" });

export interface LoadedCollection {
  source: ContentSource;
  /** Template for linking a file the collection doesn't publish to its forge. */
  sourceUrl: string | null;
}

/** The loaded collection, or null when this deployment or build hasn't got it. */
export function loadCollection(collection: CollectionId): Promise<LoadedCollection | null> {
  return collection === "pages" ? loadMountedPages() : loadBuiltDocs();
}

export function isEnabled(collection: CollectionId): boolean {
  return collection === "pages" ? contentDir() !== null : existsSync(docsManifest());
}

// ── pages: a directory mounted at runtime ────────────────────────────────────

/**
 * Directory of markdown this deployment publishes.
 */
function contentDir(): string | null {
  const dir = env("IGNIS_WEB_CONTENT_DIR", { default: "" });
  return dir === "" ? null : path.resolve(dir);
}

// Mounted content can change under a running pod, so it is re-read rather than
// resolved once — briefly cached. Never in dev, so an edit shows up on reload.
const MOUNTED_TTL_MS = import.meta.env.DEV ? 0 : 30_000;

let mounted: { dir: string; expiresAt: number; value: Promise<LoadedCollection | null>; } | null =
  null;

function loadMountedPages(): Promise<LoadedCollection | null> {
  const dir = contentDir();
  if (dir === null) return Promise.resolve(null);

  const now = Date.now();
  if (mounted !== null && mounted.dir === dir && now < mounted.expiresAt) return mounted.value;

  const value = scanDirectory(dir);
  mounted = { dir, expiresAt: now + MOUNTED_TTL_MS, value };
  return value;
}

async function scanDirectory(dir: string): Promise<LoadedCollection | null> {
  const files = await listMarkdownFiles(dir);
  if (files === null) return null;

  const pages: PageMeta[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const raw = await readDocument(dir, file);
    if (raw === null) continue;

    const { frontmatter, unsupportedKeys } = parseFrontmatter(raw);
    if (unsupportedKeys.length > 0) {
      logger.warn({ context: { file, keys: unsupportedKeys } }, "Frontmatter keys not read");
    }

    const { slug, locale } = pathToPage(file, { locales, defaultLocale: baseLocale, frontmatter });

    // Ignor duplicate slugs
    const key = `${locale}\n${slug}`;
    if (seen.has(key)) {
      logger.warn({ context: { file, slug, locale } }, "Duplicate document ignored");
      continue;
    }
    seen.add(key);

    pages.push({
      slug,
      locale,
      title: asString(frontmatter.title) ?? slug.slice(1),
      source: file,
      file,
      frontmatter,
    });
  }

  logger.debug({ context: { dir, pages: pages.length } }, "Mounted collection scanned");
  return {
    source: createContentSource({
      manifest: { version: 1, pages },
      loadBody: (page) => readFile(path.join(dir, page.file), "utf8"),
      defaultLocale: baseLocale,
    }),
    sourceUrl: null,
  };
}

async function listMarkdownFiles(dir: string): Promise<string[] | null> {
  let rootEntries;
  try {
    rootEntries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    logger.warn({ error, context: { dir } }, "Content directory could not be read");
    return null;
  }

  const files: string[] = [];
  for (const entry of rootEntries) {
    if (entry.isFile()) {
      if (entry.name.toLowerCase().endsWith(".md")) files.push(entry.name);
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
      if (nestedEntry.isFile() && nestedEntry.name.toLowerCase().endsWith(".md")) {
        files.push(`${entry.name}/${nestedEntry.name}`);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function readDocument(dir: string, file: string): Promise<string | null> {
  try {
    return await readFile(path.join(dir, file), "utf8");
  } catch (error) {
    logger.warn({ error, context: { file } }, "Document could not be read");
    return null;
  }
}

// ── docs: a manifest gathered before the build ───────────────────────────────

function docsDir(): string {
  return path.resolve(env("IGNIS_WEB_DOCS_DIR", { default: "./.lectio" }));
}

function docsManifest(): string {
  return path.join(docsDir(), "manifest.json");
}

let built: Promise<LoadedCollection | null> | null = null;

function loadBuiltDocs(): Promise<LoadedCollection | null> {
  built ??= readManifest();
  return built;
}

async function readManifest(): Promise<LoadedCollection | null> {
  const dir = docsDir();
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return null;

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
    logger.debug({ context: { pages: manifest.pages.length } }, "Docs manifest loaded");
    return {
      source: createContentSource({
        manifest,
        loadBody: (page) => readFile(path.join(dir, page.file), "utf8"),
        defaultLocale: baseLocale,
      }),
      sourceUrl: manifest.sourceUrl ?? null,
    };
  } catch (error) {
    logger.warn({ error }, "Docs manifest could not be read");
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Test seam: drops cached sources so a test can change files on disk. */
export function resetCollectionCache(): void {
  mounted = null;
  built = null;
}
