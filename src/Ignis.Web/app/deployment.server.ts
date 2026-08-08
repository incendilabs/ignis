/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { env } from "#app/env.server";
import { baseLocale } from "#app/i18n/paraglide/runtime";
import { type ConfiguredLink, parseLinkList } from "#app/lib/link-list";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "deployment" });

export function getFooterLinks(locale: string): ConfiguredLink[] {
  const spec = env("IGNIS_WEB_FOOTER_LINKS", { default: "" });
  try {
    return parseLinkList(spec, locale, baseLocale);
  } catch (error) {
    logger.warn({ error }, "IGNIS_WEB_FOOTER_LINKS is not valid JSON; no footer links rendered");
    return [];
  }
}
