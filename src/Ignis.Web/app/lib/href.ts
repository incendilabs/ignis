/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

// `scheme:` or protocol-relative `//host` — anything that leaves this origin.
const ABSOLUTE_HREF_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** Whether an href points off-site (including `mailto:` and `tel:`). */
export function isExternalHref(href: string): boolean {
  return ABSOLUTE_HREF_PATTERN.test(href);
}

// An allow-list, not a block-list: `javascript:` has too many spellings to
// exclude reliably, and links a deployment configures need no scheme beyond
// these. A relative href carries no scheme and is always fine.
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * Whether an href is safe to put in the DOM. Protocol-relative `//host` is
 * rejected along with unknown schemes — it is an absolute URL wearing a
 * relative disguise, and nothing we render needs it.
 */
export function isSafeHref(href: string): boolean {
  if (href.startsWith("//")) return false;
  if (!isExternalHref(href)) return true;

  return SAFE_SCHEMES.includes(href.slice(0, href.indexOf(":") + 1).toLowerCase());
}
