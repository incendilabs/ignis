/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

/**
 * Adapts NavTree's href contract to react-router's Link. Spread the rest:
 * NavTree passes style (depth indent), aria-current and rail semantics.
 */
export function NavLink({
  href,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-current"?: "page";
  "aria-label"?: string;
  title?: string;
}) {
  return <Link to={href} {...rest} />;
}
