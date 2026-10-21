/**
 * Two small markdown passes, applied site-wide:
 * - external links open in a new tab
 * - inline code that is an all-caps SQL keyword (`ON`, `LEFT JOIN`) gets class
 *   "sql-kw", which the SQL reference colours like keywords in its code blocks
 */
const KEYWORD = /^[A-Z]+(\s[A-Z]+)*$/;

function walk(node, parent, fn) {
  fn(node, parent);
  for (const child of node.children ?? []) walk(child, node, fn);
}

export default function rehypeLinksAndKeywords() {
  return (tree) => {
    walk(tree, null, (node, parent) => {
      if (node.type !== 'element') return;
      if (node.tagName === 'a' && /^https?:\/\//.test(String(node.properties?.href ?? ''))) {
        node.properties.target = '_blank';
        node.properties.rel = ['noopener', 'noreferrer'];
      }
      if (node.tagName === 'code' && parent?.tagName !== 'pre') {
        const text = (node.children ?? []).map((c) => c.value ?? '').join('');
        if (KEYWORD.test(text)) {
          const cls = node.properties.className ?? [];
          node.properties.className = [...(Array.isArray(cls) ? cls : [cls]), 'sql-kw'];
        }
      }
    });
  };
}
