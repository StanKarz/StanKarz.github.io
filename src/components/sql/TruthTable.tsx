import { useState } from 'preact/hooks';
import { and, type Truth } from '../../lib/sql/engine';
import { cx, shared } from './shared/primitives';
import styles from './TruthTable.module.css';

const VALUES: Truth[] = ['TRUE', 'FALSE', 'UNKNOWN'];

function or(values: Truth[]): Truth {
  if (values.includes('TRUE')) return 'TRUE';
  if (values.includes('UNKNOWN')) return 'UNKNOWN';
  return 'FALSE';
}

function not(v: Truth): Truth {
  return v === 'UNKNOWN' ? 'UNKNOWN' : v === 'TRUE' ? 'FALSE' : 'TRUE';
}

const OPS = {
  AND: (a: Truth, b: Truth) => and([a, b]),
  OR: (a: Truth, b: Truth) => or([a, b]),
};

/** An expression that produces each value, so the grid stays tied to real columns. */
const EXAMPLE: Record<Truth, string> = {
  TRUE: '1 = 1',
  FALSE: '1 = 2',
  UNKNOWN: 'recommendedby = 1', // for a member whose recommendedby is NULL
};

export default function TruthTable() {
  const [a, setA] = useState<Truth>('UNKNOWN');
  const [b, setB] = useState<Truth>('FALSE');

  const grid = (op: keyof typeof OPS) => (
    <table class={styles.grid}>
      <caption class={shared.label}>{op}</caption>
      <thead>
        <tr>
          <th />
          {VALUES.map((v) => (
            <th key={v} scope="col" class={cx(v === b && styles.axisOn)}>
              {short(v)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VALUES.map((row) => (
          <tr key={row}>
            <th scope="row" class={cx(row === a && styles.axisOn)}>
              {short(row)}
            </th>
            {VALUES.map((col) => {
              const v = OPS[op](row, col);
              return (
                <td key={col}>
                  <button
                    type="button"
                    class={cx(styles.cell, styles[v], row === a && col === b && styles.on)}
                    onClick={() => {
                      setA(row);
                      setB(col);
                    }}
                    aria-label={`${row} ${op} ${col} is ${v}`}
                  >
                    {short(v)}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const andV = OPS.AND(a, b);
  const orV = OPS.OR(a, b);

  return (
    <figure class={shared.figure}>
      <div class={styles.grids}>
        {grid('AND')}
        {grid('OR')}
        <div class={styles.readout}>
          <Line expr={`a AND b`} v={andV} />
          <Line expr={`a OR b`} v={orV} />
          <Line expr={`NOT a`} v={not(a)} />
          <p class={styles.where}>
            WHERE keeps the row only when the whole condition is <strong>TRUE</strong>.
          </p>
        </div>
      </div>
      <p class={shared.caption}>
        <span class={styles.operand}>a</span> = <code>{EXAMPLE[a]}</code>
        {a === 'UNKNOWN' && ' for a member with no recommender'}, which is {a}.{' '}
        <span class={styles.operand}>b</span> = <code>{EXAMPLE[b]}</code>
        {b === 'UNKNOWN' && ' for a member with no recommender'}, which is {b}.
      </p>
      <p class={shared.note}>
        Click any cell to pick a and b. Rows are a, columns are b. UNKNOWN only disappears when the other side settles it
        on its own: FALSE AND anything is FALSE, TRUE OR anything is TRUE.
      </p>
    </figure>
  );
}

function Line({ expr, v }: { expr: string; v: Truth }) {
  return (
    <p class={styles.line}>
      <code>{expr}</code>
      <span key={v} class={cx(styles.pill, styles[v])}>
        {v}
      </span>
    </p>
  );
}

const short = (v: Truth) => (v === 'UNKNOWN' ? 'UNK' : v === 'TRUE' ? 'T' : 'F');
