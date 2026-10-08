import { useState } from 'preact/hooks';
import { bookings, members } from '../../data/sql/countryclub';
import { setOp, type SetOp } from '../../lib/sql/demos';
import { RowCount, Segmented, SqlCode, cx, shared } from './shared/primitives';
import styles from './SetOps.module.css';

const LEFT = members.map((m) => m.memid);
const RIGHT = bookings.map((b) => b.memid);

const CAPTION: Record<SetOp, string> = {
  'union all': 'Every row from both, stacked: 8 + 12. Nothing is compared, so it is the cheap one.',
  union: 'Stacked, then duplicates removed. Each value appears once however many times it came in.',
  intersect: 'Values that appear on both sides, once each: every member who has a booking.',
  except: 'Values on the left that never appear on the right: members with no bookings. The anti-join again.',
};

export default function SetOps() {
  const [op, setOpState] = useState<SetOp>('union');
  const result = setOp(LEFT, RIGHT, op);
  const inRight = new Set(RIGHT);
  const inLeft = new Set(LEFT);
  const countIn = (v: number) => LEFT.filter((x) => x === v).length + RIGHT.filter((x) => x === v).length;

  // Which source chips make it into the result.
  const kept = (v: number, side: 'left' | 'right') => {
    if (op === 'union all' || op === 'union') return true;
    if (op === 'intersect') return side === 'left' ? inRight.has(v) : inLeft.has(v);
    return side === 'left' && !inRight.has(v);
  };

  const chips = (values: number[], side: 'left' | 'right') => (
    <div class={styles.chips}>
      {values.map((v, i) => (
        <span key={`${side}${i}`} class={cx(styles.chip, kept(v, side) ? styles.on : styles.off)}>
          {v}
        </span>
      ))}
    </div>
  );

  return (
    <figure class={shared.figure}>
      <Segmented
        label="Set operation"
        value={op}
        onChange={setOpState}
        options={(['union all', 'union', 'intersect', 'except'] as SetOp[]).map((o) => ({
          value: o,
          label: o.toUpperCase(),
        }))}
      />
      <SqlCode code={`select memid from cd.members\n${op}\nselect memid from cd.bookings\norder by 1;`} />

      <div class={styles.layout}>
        <div>
          <span class={shared.label}>members.memid · {LEFT.length}</span>
          {chips(LEFT, 'left')}
        </div>
        <div>
          <span class={shared.label}>bookings.memid · {RIGHT.length}</span>
          {chips(RIGHT, 'right')}
        </div>
        <div class={styles.result}>
          <span class={shared.label}>
            result <RowCount n={result.length} />
          </span>
          <div class={styles.stack} key={op}>
            {result.map((v, i) => (
              <span key={i} class={styles.out} style={{ animationDelay: `${i * 25}ms` }}>
                {v}
                {op === 'union' && countIn(v) > 1 && <span class={styles.merged}>×{countIn(v)} merged</span>}
              </span>
            ))}
            {result.length === 0 && <span class={styles.empty}>0 rows</span>}
          </div>
        </div>
      </div>

      <p class={shared.caption}>{CAPTION[op]}</p>
      <p class={shared.note}>
        Columns are matched by position, not by name, and the output takes its column names from the first SELECT. One
        ORDER BY at the end sorts the combined result.
      </p>
    </figure>
  );
}
