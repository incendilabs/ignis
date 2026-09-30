/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { TreeNode } from "@eventuras/lectio-docs/content";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Box } from "@eventuras/ratio-ui/layout/Box";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";

import { m } from "#app/i18n/paraglide/messages";

import type { CollectionId } from "./collections.shared";
import { DocumentNav } from "./DocumentNav";
import { DocumentBody } from "./DocumentBody";
import type { Document } from "./documents.server";

export function DocumentPage({
  collection,
  document,
  tree,
  locale,
}: {
  collection: CollectionId;
  /** Null for a collection with no document at its root — the tree is the page. */
  document: Document | null;
  tree: TreeNode[];
  locale: string;
}) {
  const untranslated = document !== null && document.multilingual && document.locale !== locale;

  return (
    <Container as="main">
      <Stack direction="horizontal" gap="lg" align="start" wrap>
        {tree.length > 1 && (
          // The rail's own width, so the article keeps a readable measure and
          // the nav drops above it when the viewport can't hold both.
          <Box style={{ width: "16rem", flexShrink: 0 }}>
            <DocumentNav collection={collection} tree={tree} />
          </Box>
        )}

        {/* A measure the rail can't squeeze: below its width the Stack wraps
            and the article takes the full column. */}
        <Box style={{ flex: 1, minWidth: "24rem" }}>
          <Stack direction="vertical" gap="md">
            <Stack direction="vertical" gap="xs">
              <Heading as="h1">{document?.title ?? m.docs_title()}</Heading>
              {document?.updated != null && (
                <Text size="sm" variant="muted">
                  {m.content_updated({ date: formatDate(document.updated, locale) })}
                </Text>
              )}
            </Stack>

            {untranslated && (
              <Panel variant="callout" status="info">
                <Text>{m.content_untranslated()}</Text>
              </Panel>
            )}

            {document !== null && (
              <DocumentBody
                markdown={document.markdown}
                source={document.source}
                pageBySource={document.pageBySource}
                sourceUrl={document.sourceUrl}
              />
            )}

            {document?.editUrl != null && (
              <Link
                href={document.editUrl}
                componentProps={{ target: "_blank", rel: "noopener noreferrer" }}
              >
                {m.docs_edit_page()}
              </Link>
            )}
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}

/**
 * Formats an authored `updated` date. Pinned to UTC so the server and the
 * browser agree.
 */
function formatDate(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
