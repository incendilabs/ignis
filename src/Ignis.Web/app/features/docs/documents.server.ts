/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { TreeNode } from "@eventuras/lectio-docs/content";

import { baseLocale } from "#app/i18n/paraglide/runtime";

import { normalizeSlug } from "@eventuras/lectio-docs/content";

import { loadCollection } from "./collections.server";
import { documentHref, type CollectionId } from "./collections.shared";

export interface Document {
  title: string;
  slug: string;
  markdown: string;
  source: string;
  locale: string;
  multilingual: boolean;
  updated: string | null;
  editUrl: string | null;
  sourceUrl: string | null;
  pageBySource: Record<string, string>;
}

export async function getDocument(
  collection: CollectionId,
  slug: string,
  locale: string = baseLocale,
): Promise<Document | null> {
  const loaded = await loadCollection(collection);
  if (loaded === null) return null;

  const { source, sourceUrl } = loaded;
  const page = await source.getPage(normalizeSlug(slug), locale);
  if (page === null) return null;

  return {
    title: page.title,
    slug: page.slug,
    markdown: page.body,
    source: page.source,
    locale: page.locale ?? baseLocale,
    multilingual: source.getLocales().length > 1,
    updated: asString(page.frontmatter.updated),
    editUrl: page.editUrl ?? null,
    sourceUrl,
    pageBySource: Object.fromEntries(
      source
        .getPages(locale)
        .map((other) => [other.source, documentHref(collection, other.slug)]),
    ),
  };
}

export async function getDocumentTree(
  collection: CollectionId,
  locale: string = baseLocale,
): Promise<TreeNode[]> {
  return (await loadCollection(collection))?.source.getTree(locale) ?? [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
