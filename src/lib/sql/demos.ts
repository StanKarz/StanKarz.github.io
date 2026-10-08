/**
 * Pure logic behind the newer interactives, kept out of the components so the
 * verify script can check it against real Postgres.
 */
import { bookings, facilityById, memberById, GUEST_MEMID, type Booking } from '../../data/sql/countryclub';

/* ------------------------------------------------------------------ LIKE */

export type LikeOp = 'like' | 'ilike';
export type LikeToken = { kind: 'text' | 'any' | 'one'; text: string };

/** Split a LIKE pattern into literal runs, % and _. No escapes: none of the examples need them. */
export function tokenizeLike(pattern: string): LikeToken[] {
  const out: LikeToken[] = [];
  for (const ch of pattern) {
    const kind = ch === '%' ? 'any' : ch === '_' ? 'one' : 'text';
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += ch;
    else out.push({ kind, text: ch });
  }
  return out;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** LIKE as an anchored regex with one group per token, so each character can be traced to the token that matched it. */
export function likeRegex(tokens: LikeToken[], op: LikeOp): RegExp {
  const body = tokens
    .map((t) => (t.kind === 'any' ? '(.*?)' : t.kind === 'one' ? '(.)' : `(${escapeRegex(t.text)})`))
    .join('');
  return new RegExp(`^${body}$`, op === 'ilike' ? 'ids' : 'ds');
}

/* ------------------------------------------------------------------ dates */

/** Hours since 2012-09-20 00:00, where the timeline's axis is anchored. */
export function hoursOf(ts: string): number {
  const ms = Date.parse(`${ts.replace(' ', 'T')}:00Z`) - Date.parse('2012-09-20T00:00:00Z');
  return ms / 3_600_000;
}

export const DAY_START = 24; // 21 Sept, 00:00
export const DAY_END = 48; // 22 Sept, 00:00

export type DateFilter = 'equals' | 'cast' | 'range' | 'between';

export const DATE_FILTERS: Record<DateFilter, { sql: string; keep: (h: number) => boolean }> = {
  equals: { sql: `where starttime = '2012-09-21'`, keep: (h) => h === DAY_START },
  cast: { sql: `where starttime::date = '2012-09-21'`, keep: (h) => h >= DAY_START && h < DAY_END },
  range: {
    sql: `where starttime >= '2012-09-21'\n  and starttime <  '2012-09-22'`,
    keep: (h) => h >= DAY_START && h < DAY_END,
  },
  between: {
    sql: `where starttime between '2012-09-21' and '2012-09-22'`,
    keep: (h) => h >= DAY_START && h <= DAY_END,
  },
};

/* ---------------------------------------------------------------- windows */

/**
 * sum(slots) over (...) for every non-guest booking, with the frame each value
 * was summed over. With ORDER BY the default frame runs from the start of the
 * partition to the current row and its ties (there are none here). Without it,
 * the frame is the whole partition.
 */
export function windowSums(partition: boolean, ordered: boolean) {
  const rows = bookings.filter((b) => b.memid !== GUEST_MEMID);
  const sorted = [...rows].sort(
    (a, b) => (partition ? a.memid - b.memid : 0) || a.starttime.localeCompare(b.starttime) || a.bookid - b.bookid,
  );
  return sorted.map((row: Booking, i) => {
    const part = sorted.filter((r) => !partition || r.memid === row.memid);
    const frame = ordered ? part.filter((r) => r.starttime <= row.starttime) : part;
    return {
      row,
      index: i,
      partStart: i === 0 || (partition && sorted[i - 1].memid !== row.memid),
      frame: new Set(frame.map((r) => r.bookid)),
      value: frame.reduce((a, r) => a + r.slots, 0),
    };
  });
}

/* ------------------------------------------------------------- subqueries */

/** The derived table in the subquery stepper: each booking on one day with its cost. */
export function costedOn(day: string) {
  return bookings
    .filter((b) => b.starttime.startsWith(day))
    .map((b) => {
      const f = facilityById.get(b.facid)!;
      return {
        bookid: b.bookid,
        member: memberById.get(b.memid)!.firstname,
        facility: f.name,
        cost: b.slots * (b.memid === GUEST_MEMID ? f.guestcost : f.membercost),
      };
    });
}

/* ------------------------------------------------------------------- CASE */

export interface CaseBranch {
  sql: string;
  label: string;
  test: (membercost: number) => boolean;
}

export const PRICE_BRANCHES: CaseBranch[] = [
  { sql: 'membercost = 0', label: 'free', test: (c) => c === 0 },
  { sql: 'membercost < 10', label: 'cheap', test: (c) => c < 10 },
  { sql: 'membercost < 30', label: 'mid', test: (c) => c < 30 },
];

export const PRICE_ELSE = 'pricey';

/**
 * Walk one value through CASE the way Postgres does: branches in order, stop
 * at the first TRUE. Returns how many branches were tested and the result.
 */
export function evaluateCase(membercost: number, branches: CaseBranch[], elseLabel: string | null) {
  for (let i = 0; i < branches.length; i++) {
    if (branches[i].test(membercost)) return { tested: i + 1, hit: i as number | null, value: branches[i].label };
  }
  return { tested: branches.length, hit: null, value: elseLabel };
}

export function caseSql(branches: CaseBranch[], elseLabel: string | null): string {
  const whens = branches.map((b) => `when ${b.sql} then '${b.label}'`).join('\n            ');
  return `select name, membercost,
       case ${whens}${elseLabel ? `\n            else '${elseLabel}'` : ''}
       end as price_band
from cd.facilities;`;
}

/* ---------------------------------------------------------------- set ops */

export type SetOp = 'union' | 'union all' | 'intersect' | 'except';

/** Set operations over two lists of values, sorted the way `order by 1` sorts them. */
export function setOp(left: number[], right: number[], op: SetOp): number[] {
  const asc = (a: number, b: number) => a - b;
  const l = new Set(left);
  const r = new Set(right);
  if (op === 'union all') return [...left, ...right].sort(asc);
  if (op === 'union') return [...new Set([...left, ...right])].sort(asc);
  if (op === 'intersect') return [...l].filter((v) => r.has(v)).sort(asc);
  return [...l].filter((v) => !r.has(v)).sort(asc);
}
