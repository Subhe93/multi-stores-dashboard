// M6.7: a collection's canonical storefront URL carries its ancestry:
// `/collections/<root>/<child>/<grandchild>` (root collections keep
// `/collections/<root>`). These helpers derive that path from the nested
// creator tree (`GET /creator-categories`) for places that have the tree but
// not a node's `path`. INTERNAL rows are never linkable; callers skip them.

export interface CollectionTreeNode {
  id: string;
  slug: string;
  children?: CollectionTreeNode[] | null;
}

/** Slugs root → self for `id` (empty when the id is not in the tree). */
export function collectionPathFromTree(tree: CollectionTreeNode[], id: string): string[] {
  const walk = (nodes: CollectionTreeNode[], ancestors: string[]): string[] | null => {
    for (const node of nodes) {
      const own = [...ancestors, node.slug];
      if (node.id === id) return own;
      if (node.children?.length) {
        const found = walk(node.children, own);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree, []) ?? [];
}

/** `/collections/<root>/<child>/<grandchild>` for `id`; `/collections/` when the id is unknown. */
export function collectionUrl(tree: CollectionTreeNode[], id: string): string {
  return `/collections/${collectionPathFromTree(tree, id).join('/')}`;
}
