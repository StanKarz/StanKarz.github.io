/**
 * The handful of relational operations the SQL interactives animate, written
 * as plain functions so they can be checked against real Postgres (see the
 * verify script in the sql-cheat-sheet project) rather than trusted.
 */

export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross';

export interface JoinedRow<L, R> {
  /** Stable identity for animation: which left and right rows produced this. */
  key: string;
  left: L | null;
  right: R | null;
}

/**
 * Nested-loop join. Output order: left rows in order with their matches, then
 * (for RIGHT and FULL) right rows that matched nothing. Postgres promises no
 * order without ORDER BY; this one is just easy to follow.
 */
export function join<L, R>(
  left: L[],
  right: R[],
  type: JoinType,
  on: (l: L, r: R) => boolean,
  leftKey: (l: L) => string,
  rightKey: (r: R) => string,
): JoinedRow<L, R>[] {
  const out: JoinedRow<L, R>[] = [];
  const rightMatched = new Set<number>();

  for (const l of left) {
    let matched = false;
    right.forEach((r, j) => {
      if (type === 'cross' || on(l, r)) {
        matched = true;
        rightMatched.add(j);
        out.push({ key: `${leftKey(l)}|${rightKey(r)}`, left: l, right: r });
      }
    });
    if (!matched && (type === 'left' || type === 'full')) {
      out.push({ key: `${leftKey(l)}|-`, left: l, right: null });
    }
  }

  if (type === 'right' || type === 'full') {
    right.forEach((r, j) => {
      if (!rightMatched.has(j)) out.push({ key: `-|${rightKey(r)}`, left: null, right: r });
    });
  }
  return out;
}

export interface Group<T> {
  key: string;
  rows: T[];
}

/** GROUP BY: one bucket per distinct key, in order of first appearance. */
export function groupBy<T>(rows: T[], key: (row: T) => string): Group<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = groups.get(k);
    if (bucket) bucket.push(row);
    else groups.set(k, [row]);
  }
  return [...groups].map(([k, rs]) => ({ key: k, rows: rs }));
}

/** SUM skips NULLs, and over zero non-null values it is NULL, not 0. */
export function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export interface Ranked {
  rank: number;
  denseRank: number;
  rowNumber: number;
}

/**
 * rank / dense_rank / row_number for values already sorted the way the
 * window's ORDER BY sorts them. Only the ordering value decides ties.
 */
export function rankSorted(sortedValues: number[]): Ranked[] {
  const out: Ranked[] = [];
  let dense = 0;
  sortedValues.forEach((v, i) => {
    const tiedWithPrevious = i > 0 && v === sortedValues[i - 1];
    if (!tiedWithPrevious) dense += 1;
    out.push({
      rank: tiedWithPrevious ? out[i - 1].rank : i + 1,
      denseRank: dense,
      rowNumber: i + 1,
    });
  });
  return out;
}

/* ---------------------------------------------------- three-valued logic */

export type Truth = 'TRUE' | 'FALSE' | 'UNKNOWN';

export function notEquals(a: number | null, b: number | null): Truth {
  if (a === null || b === null) return 'UNKNOWN';
  return a !== b ? 'TRUE' : 'FALSE';
}

export function and(values: Truth[]): Truth {
  if (values.includes('FALSE')) return 'FALSE';
  if (values.includes('UNKNOWN')) return 'UNKNOWN';
  return 'TRUE';
}

/** x NOT IN (list) is x <> a AND x <> b AND ... */
export function notIn(x: number | null, list: (number | null)[]): Truth {
  return and(list.map((v) => notEquals(x, v)));
}
