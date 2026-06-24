/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Link as RouterLink } from "react-router";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Navbar as RatioNavbar } from "@eventuras/ratio-ui/core/Navbar";

import { LanguageSelect } from "#app/i18n/LanguageSelect";
import { m } from "#app/i18n/paraglide/messages";

import { ThemeToggle } from "./theme-toggle";

interface NavbarProps {
  features: {
    auth: boolean;
    admin: boolean;
  };
}

export function Navbar({ features }: NavbarProps) {
  return (
    <RatioNavbar sticky>
      <RatioNavbar.Brand>
        <RouterLink
          to="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity no-underline"
        >
          <img src="/images/ignis-logo.png" alt="Ignis" className="h-8 w-8" />
          <span className="text-xl">Ignis</span>
        </RouterLink>
      </RatioNavbar.Brand>
      <RatioNavbar.Content className="justify-end">
        {features.admin && (
          <Link href="/admin" variant="button-text">
            Admin
          </Link>
        )}
        {features.auth && (
          <Link href="/auth/login" variant="button-text">
            {m.nav_login()}
          </Link>
        )}
        <LanguageSelect className="w-32" />
        <ThemeToggle />
      </RatioNavbar.Content>
    </RatioNavbar>
  );
}
