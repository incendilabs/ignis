/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { resolveRelativePath } from "@eventuras/lectio-docs/content";
import { MarkdownContent, type MarkdownComponents } from "@eventuras/markdown";
import { Link } from "@eventuras/ratio-ui/core/Link";
import type { ComponentProps, ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import { isExternalHref, isSafeHref } from "#app/lib/href";

/** Adapts ratio-ui Link's href contract to react-router's Link. */
function InternalLink({ href, ...rest }: { href: string; } & Omit<ComponentProps<"a">, "href">) {
  return <RouterLink to={href} {...rest} />;
}

interface AnchorProps {
  href?: string;
  title?: string;
  children?: ReactNode;
}

/**
 * Renders a document's markdown. 
 */
export function DocumentBody({
  markdown,
  source,
  pageBySource,
  sourceUrl = null,
}: {
  markdown: string;
  source: string;
  pageBySource: Record<string, string | undefined>;
  sourceUrl?: string | null;
}) {
  const components: MarkdownComponents = {
    a: ({ href = "", title, children }: AnchorProps) => {
      const resolved = resolveDocumentHref(href, source, pageBySource, sourceUrl);

      // If no href, or a scheme the deployment doesn't want to allow, render as text
      if (resolved === "" || !isSafeHref(resolved)) return <span>{children}</span>;

      const external = isExternalHref(resolved);
      return (
        <Link
          href={resolved}
          component={external ? undefined : InternalLink}
          componentProps={
            external ? { title, target: "_blank", rel: "noopener noreferrer" } : { title }
          }
        >
          {children}
        </Link>
      );
    },
  };

  return <MarkdownContent markdown={markdown} customComponents={components} />;
}

/**
 * A relative `*.md` link, rewritten to the page it points at.
 */
function resolveDocumentHref(
  href: string,
  source: string,
  pageBySource: Record<string, string | undefined>,
  sourceUrl: string | null,
): string {
  if (href === "" || href.startsWith("#") || href.startsWith("/") || isExternalHref(href)) {
    return href;
  }

  const suffixAt = href.search(/[#?]/);
  const path = suffixAt === -1 ? href : href.slice(0, suffixAt);
  if (!/\.mdx?$/i.test(path)) return href;

  const suffix = suffixAt === -1 ? "" : href.slice(suffixAt);
  const resolved = resolveRelativePath(source, safeDecode(path));

  const page = pageBySource[resolved];
  if (page !== undefined) return page + suffix;
  // Not published here, but it exists in the repository — send the reader there
  // rather than to a dead end.
  return sourceUrl === null ? href : sourceUrl.replaceAll("{path}", resolved) + suffix;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
