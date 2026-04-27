/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Select } from "@eventuras/ratio-ui/forms/Select";

import { getLocale, locales, setLocale } from "@/i18n/paraglide/runtime";

const localeLabels: Record<string, string> = {
  en: "English",
  nb: "Norsk",
};

export function LanguageSelect({ className }: { className?: string }) {
  return (
    <Select
      aria-label="Language"
      className={className}
      options={locales.map((l) => ({ value: l, label: localeLabels[l] ?? l }))}
      value={getLocale()}
      onSelectionChange={(value) => { void setLocale(value as (typeof locales)[number]); }}
    />
  );
}
