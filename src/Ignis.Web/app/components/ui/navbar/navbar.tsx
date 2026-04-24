/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Link as RouterLink } from "react-router";
import { Button } from "@eventuras/ratio-ui/core/Button";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Navbar as RatioNavbar } from "@eventuras/ratio-ui/core/Navbar";
import { useTheme } from "@/contexts/theme-provider";

interface NavbarProps {
  features: {
    auth: boolean;
  };
}

export function Navbar({ features }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <RatioNavbar sticky bgColor="bg-[#1F2244]" bgDark>
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
        {features.auth && (
          <Link href="/auth/login" variant="button-text" onDark>
            Login
          </Link>
        )}
        <Button
          variant="text"
          onDark
          onClick={toggleTheme}
          ariaLabel={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          )}
        </Button>
      </RatioNavbar.Content>
    </RatioNavbar>
  );
}
