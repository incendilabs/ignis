/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { TreeNode } from "@eventuras/lectio-docs/content";
import { NavTree, type NavTreeItem } from "@eventuras/ratio-ui/core/NavTree";
import { useLocation } from "react-router";

import { NavLink } from "#app/components/ui/nav";
import { m } from "#app/i18n/paraglide/messages";
import { deLocalizeHref } from "#app/i18n/paraglide/runtime";

import { documentHref, type CollectionId } from "./collections.shared";

/**
 * A collection's tree, in the same rail the console navigation uses. Sections
 * without a page of their own get no `href` — `buildTree` marks them by
 * leaving off `slug` — so they read as a branch label rather than a link.
 */
export function DocumentNav({ collection, tree }: { collection: CollectionId; tree: TreeNode[]; }) {
  const { pathname } = useLocation();

  return (
    <NavTree
      items={toItems(collection, tree)}
      currentPath={deLocalizeHref(pathname)}
      defaultExpandedDepth={1}
      LinkComponent={NavLink}
      aria-label={m.docs_nav_label()}
    />
  );
}

function toItems(collection: CollectionId, nodes: TreeNode[]): NavTreeItem[] {
  return nodes.map((node) => ({
    title: node.title,
    href: node.slug === undefined ? undefined : documentHref(collection, node.slug),
    children: node.children.length > 0 ? toItems(collection, node.children) : undefined,
  }));
}
