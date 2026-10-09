import { useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { isRunnable, tryQuery } from '../../../lib/sql/try';
import styles from './shared.module.css';

export type Value = string | number | null;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- SQL code */

const KEYWORDS = new Set(
  `select from where join inner left right full outer cross on group by having order limit offset
   as and or not in is null distinct case when then else end union all exists between like ilike
   insert into values update set delete with asc desc using intersect except over partition`
    .split(/\s+/)
    .filter(Boolean),
);
const FUNCTIONS = new Set(
  'sum count avg min max coalesce rank dense_rank row_number round concat extract date_trunc date_part'.split(' '),
);

const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g;

function highlight(line: string) {
  const out: ComponentChildren[] = [];
  for (const m of line.matchAll(TOKEN)) {
    const [text, comment, str, num, word] = m;
    const lower = word?.toLowerCase();
    const cls = comment
      ? styles.comment
      : str
        ? styles.str
        : num
          ? styles.num
          : lower && KEYWORDS.has(lower)
            ? styles.kw
            : lower && FUNCTIONS.has(lower)
              ? styles.fn
              : null;
    out.push(cls ? <span class={cls}>{text}</span> : text);
  }
  return out;
}

interface SqlCodeProps {
  code: string;
  /** Extra class per line, e.g. to light up the clause being executed. */
  lineClass?: (index: number) => string | undefined;
  /** Content placed after a line, e.g. a step badge. */
  lineSuffix?: (index: number) => ComponentChildren;
  onLineClick?: (index: number) => void;
}

/** A small SQL highlighter. Enough for keywords, strings, numbers and comments. */
export function SqlCode({ code, lineClass, lineSuffix, onLineClick }: SqlCodeProps) {
  return (
    <div class={styles.codeWrap}>
      {isRunnable(code) && (
        <button type="button" class={styles.tryIt} onClick={() => tryQuery(code)}>
          try it ▸
        </button>
      )}
      <pre class={styles.code}>
        <code>
          {code.split('\n').map((line, i) => (
            <span
              key={i}
              class={cx(styles.line, lineClass?.(i))}
              onClick={onLineClick ? () => onLineClick(i) : undefined}
              style={onLineClick ? { cursor: 'pointer' } : undefined}
            >
              {highlight(line)}
              {lineSuffix?.(i)}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------ result table */

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface Row {
  key: string;
  cells: Record<string, Value>;
  state?: 'highlight' | 'dim' | 'removed';
  /** Draws a rule above the row: used to show where one group ends. */
  groupStart?: boolean;
  tint?: boolean;
  /** Where an outer join's row came from: only the left table, or only the right. */
  tone?: 'left' | 'right';
}

interface ResultTableProps {
  columns: Column[];
  rows: Row[];
  emptyText?: string;
  onRowHover?: (key: string | null) => void;
  /** Stagger new rows so a changed result visibly arrives. */
  stagger?: number;
}

export function Cell({ value }: { value: Value }) {
  return value === null ? <span class={styles.null}>NULL</span> : <>{value}</>;
}

export function ResultTable({ columns, rows, emptyText = '0 rows', onRowHover, stagger = 30 }: ResultTableProps) {
  return (
    <div class={styles.tableWrap}>
      <table class={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} class={c.align === 'right' ? styles.right : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} class={styles.empty}>
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr
              key={r.key}
              class={cx(
                styles.row,
                r.state === 'highlight' && styles.rowHighlight,
                r.state === 'dim' && styles.rowDim,
                r.state === 'removed' && styles.rowRemoved,
                r.groupStart && i > 0 && styles.groupStart,
                r.tint && styles.groupTint,
                r.tone === 'left' && styles.toneLeft,
                r.tone === 'right' && styles.toneRight,
              )}
              style={{ animationDelay: `${Math.min(i * stagger, 400)}ms` }}
              onMouseEnter={onRowHover ? () => onRowHover(r.key) : undefined}
              onMouseLeave={onRowHover ? () => onRowHover(null) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} class={c.align === 'right' ? styles.right : undefined}>
                  <Cell value={r.cells[c.key] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- row count */

/**
 * A live row count that ticks when it changes and shows the change. By default
 * the change is from the last value shown; pass `delta` when a fixed baseline
 * means more, such as the previous stage of a stepper.
 */
export function RowCount({ n, label = 'rows', delta: fixed }: { n: number; label?: string; delta?: number }) {
  const prev = useRef(n);
  const last = useRef(n);
  if (last.current !== n) {
    prev.current = last.current;
    last.current = n;
  }
  const delta = fixed ?? n - prev.current;
  return (
    <span class={styles.count} aria-live="polite">
      <span key={n} class={styles.countValue}>
        {n}
      </span>
      {label === 'rows' && n === 1 ? 'row' : label}
      {delta !== 0 && (
        <span class={cx(styles.countDelta, delta > 0 && styles.up)}>
          ({delta > 0 ? '+' : '−'}
          {Math.abs(delta)})
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- truth pill */

export type Truth = 'TRUE' | 'FALSE' | 'UNKNOWN';

/** TRUE filled, FALSE hollow, UNKNOWN hatched like NULL. `pop` replays a small animation on change. */
export function TruthPill({ value, pop }: { value: Truth; pop?: boolean }) {
  return <span class={cx(styles.truth, styles[`truth${value}`], pop && styles.truthPop)}>{value}</span>;
}

/* ------------------------------------------------------- segmented control */

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <span class={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          class={styles.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export { styles as shared };
