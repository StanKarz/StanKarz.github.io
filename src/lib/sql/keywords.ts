/**
 * Caption text on the SQL page mentions keywords in plain capitals ("WHERE drops
 * them"). These helpers split such text so keywords and `backticked` code can
 * be drawn as code, the same way in Preact captions and in Astro markup.
 */

const KEYWORDS = [
  'GROUP BY',
  'ORDER BY',
  'PARTITION BY',
  'UNION ALL',
  'NOT EXISTS',
  'NOT IN',
  'IS NOT NULL',
  'IS NULL',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'SELECT',
  'FROM',
  'WHERE',
  'HAVING',
  'LIMIT',
  'DISTINCT',
  'JOIN',
  'ON',
  'LEFT',
  'RIGHT',
  'INNER',
  'FULL',
  'CROSS',
  'EXISTS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'ILIKE',
  'LIKE',
  'BETWEEN',
  'OVER',
  'COALESCE',
  'AND',
  'OR',
  'NOT',
  'IN',
];

// Longest first so "GROUP BY" wins over "BY"-less matches, and "NOT IN" over "NOT".
const KEYWORD_RE = new RegExp(
  `\\b(${[...KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(' ', '\\s'))
    .join('|')})\\b`,
  'g',
);

export type Segment = { kind: 'text' | 'code' | 'keyword'; value: string };

/** `code` stays code; capitalised SQL keywords in the remaining text become keywords. */
export function splitSql(text: string): Segment[] {
  const out: Segment[] = [];
  text.split(/`([^`]+)`/).forEach((part, i) => {
    if (i % 2 === 1) {
      out.push({ kind: /^[A-Z][A-Z\s]*$/.test(part) ? 'keyword' : 'code', value: part });
      return;
    }
    let last = 0;
    for (const m of part.matchAll(KEYWORD_RE)) {
      if (m.index! > last) out.push({ kind: 'text', value: part.slice(last, m.index) });
      out.push({ kind: 'keyword', value: m[0] });
      last = m.index! + m[0].length;
    }
    if (last < part.length) out.push({ kind: 'text', value: part.slice(last) });
  });
  return out;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The same split as HTML, for Astro's set:html. */
export function sqlHtml(text: string, keywordClass: string): string {
  return splitSql(text)
    .map((s) =>
      s.kind === 'text'
        ? escapeHtml(s.value)
        : `<code${s.kind === 'keyword' ? ` class="${keywordClass}"` : ''}>${escapeHtml(s.value)}</code>`,
    )
    .join('');
}
