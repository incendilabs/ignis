/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * The document collections this app serves.
 */
export type CollectionId = "pages" | "docs";

export const COLLECTION_BASE_PATH: Record<CollectionId, string> = {
  pages: "/pages",
  docs: "/docs",
};

/** The page URL for a slug from a collection's manifest. */
export function documentHref(collection: CollectionId, slug: string): string {
  const base = COLLECTION_BASE_PATH[collection];
  const path = slug.startsWith("/") ? slug : `/${slug}`;
  return path === "/" ? base : `${base}${path}`;
}
