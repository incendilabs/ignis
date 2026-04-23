/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export interface EnvOptions {
  default?: string;
}

export function env(name: string, opts?: EnvOptions): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    if (opts?.default !== undefined) return opts.default;
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export interface EnvBoolOptions {
  default?: boolean;
}

export function envBool(name: string, opts?: EnvBoolOptions): boolean {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    if (opts?.default !== undefined) return opts.default;
    throw new Error(`Missing required env var: ${name}`);
  }
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`Invalid boolean env var ${name}. Expected one of: "true", "false", "1", "0".`);
}
