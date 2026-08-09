/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { TreeNode } from "@eventuras/lectio-docs/content";
import { List } from "@eventuras/ratio-ui/core/List";
import { Link as RouterLink, useLocation } from "react-router";

import { m } from "#app/i18n/paraglide/messages";

import { documentHref, type CollectionId } from "./collections.shared";

/**
 * A collection's tree. Sections without a page of their own render as a
 * heading rather than a link — `buildTree` marks them by leaving off `slug`.
 */
export function DocumentNav({ collection, tree }: { collection: CollectionId; tree: TreeNode[]; }) {
  const { pathname } = useLocation();

  const render = (nodes: TreeNode[]) => (
    <List as="ul" variant="unstyled">
      {nodes.map((node) => {
        const href = node.slug === undefined ? null : documentHref(collection, node.slug);
        return (
          <List.Item key={node.title + (node.slug ?? "")}>
            {href === null ? (
              node.title
            ) : (
              <RouterLink to={href} aria-current={pathname.endsWith(href) ? "page" : undefined}>
                {node.title}
              </RouterLink>
            )}
            {node.children.length > 0 && render(node.children)}
          </List.Item>
        );
      })}
    </List>
  );

  return <nav aria-label={m.docs_nav_label()}>{render(tree)}</nav>;
}
