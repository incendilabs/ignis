/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { m } from "#app/i18n/paraglide/messages";
import { getLocale } from "#app/i18n/paraglide/runtime";

import type { Route } from "./+types/docs.$";
import { DocumentPage } from "../DocumentPage";
import { getDocument, getDocumentTree } from "../documents.server";

const COLLECTION = "docs";

export async function loader({ params }: Route.LoaderArgs) {
  const locale = getLocale();
  const slug = `/${params["*"]}`.replace(/\/$/, "") || "/";

  const [document, tree] = await Promise.all([
    getDocument(COLLECTION, slug, locale),
    getDocumentTree(COLLECTION, locale),
  ]);

  if (document === null && (slug !== "/" || tree.length === 0)) {
    throw new Response("Not Found", { status: 404 });
  }

  return { document, tree, locale };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData.document?.title ?? m.docs_title()} — ${m.app_name()}` }];
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  return <DocumentPage collection={COLLECTION} {...loaderData} />;
}
