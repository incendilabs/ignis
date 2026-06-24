/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ThemeToggle as RatioThemeToggle } from "@eventuras/ratio-ui/core/ThemeToggle";

import { useTheme } from "#app/contexts/theme-provider";

// Binds the app theme context to ratio-ui's ThemeToggle so the navbar
// stays free of theme wiring.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return <RatioThemeToggle theme={theme} onThemeChange={setTheme} />;
}
