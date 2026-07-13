/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Link as RouterLink, useFetcher, useLocation } from "react-router";
import { Avatar } from "@eventuras/ratio-ui/core/Avatar";
import { Menu } from "@eventuras/ratio-ui/core/Menu";
import { Navbar as RatioNavbar } from "@eventuras/ratio-ui/core/Navbar";

import { loginUrl } from "#app/features/auth/login-redirect";
import { LanguageSelect } from "#app/i18n/LanguageSelect";
import { m } from "#app/i18n/paraglide/messages";

import { ThemeToggle } from "./theme-toggle";

interface NavbarProps {
  features: {
    auth: boolean;
    admin: boolean;
  };
  user?: { name: string; email: string; } | null;
}

export function Navbar({ features, user }: NavbarProps) {
  const fetcher = useFetcher();
  const location = useLocation();
  const displayName = user ? user.name.trim().split(/\s+/)[0] || user.email : null;

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
        <LanguageSelect className="w-32" />
        <ThemeToggle />
        <Menu>
          <Menu.Trigger>
            {user ? (
              <>
                <Avatar name={user.name || user.email} size="sm" />
                {displayName}
              </>
            ) : (
              m.nav_menu()
            )}
            <Menu.Chevron />
          </Menu.Trigger>
          {user && (
            <Menu.Header>
              <Avatar name={user.name} size="lg" />
              <Menu.Header.Name>{user.name}</Menu.Header.Name>
              <Menu.Header.Email>{user.email}</Menu.Header.Email>
            </Menu.Header>
          )}
          <Menu.Link href="/resources">{m.resources_title()}</Menu.Link>
          {features.admin && <Menu.Link href="/admin">{m.admin_title()}</Menu.Link>}
          {features.auth &&
            (user ? (
              <Menu.Button
                id="logout"
                onClick={() => {
                  void fetcher.submit(null, { method: "post", action: "/auth/logout" });
                }}
              >
                {m.nav_logout()}
              </Menu.Button>
            ) : (
              <Menu.Link href={loginUrl(location.pathname + location.search)}>{m.nav_login()}</Menu.Link>
            ))}
        </Menu>
      </RatioNavbar.Content>
    </RatioNavbar>
  );
}
