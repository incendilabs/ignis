/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Footer } from "@eventuras/ratio-ui/core/Footer";
import type { ComponentProps } from "react";
import { Link as RouterLink } from "react-router";

import type { ConfiguredLink } from "#app/lib/link-list";

/**
 * Adapts Footer.Link's anchor contract to react-router's Link. `href` is
 * required: every link here has one, and defaulting a missing one to "/" would
 * turn a bug into a quiet trip to the front page.
 */
function InternalLink({ href, ...rest }: { href: string; } & Omit<ComponentProps<"a">, "href">) {
  return <RouterLink to={href} {...rest} />;
}

export function SiteFooter({ links }: { links: ConfiguredLink[]; }) {
  if (links.length === 0) return null;

  return (
    <Footer>
      <Footer.BottomBar divider={false}>
        {links.map((link) => (
          <Footer.Link
            key={`${link.label}:${link.href}`}
            href={link.href}
            external={link.external}
            as={link.external ? undefined : InternalLink}
          >
            {link.label}
          </Footer.Link>
        ))}
      </Footer.BottomBar>
    </Footer>
  );
}
