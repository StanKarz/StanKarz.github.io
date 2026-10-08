import { useState } from 'preact/hooks';
import { memberById } from '../../data/sql/countryclub';
import { windowSums } from '../../lib/sql/demos';
import { cx, shared, SqlCode } from './shared/primitives';
import styles from './PartitionExplorer.module.css';

export default function PartitionExplorer() {
  const [partition, setPartition] = useState(true);
  const [ordered, setOrdered] = useState(true);
  const [current, setCurrent] = useState(3);
  const out = windowSums(partition, ordered);
  const cur = out[Math.min(current, out.length - 1)];

  const over = [partition && 'partition by memid', ordered && 'order by starttime'].filter(Boolean).join(' ');
  let band = 0;

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <button type="button" class={shared.button} aria-pressed={partition} onClick={() => setPartition((v) => !v)}>
          partition by memid
        </button>
        <button type="button" class={shared.button} aria-pressed={ordered} onClick={() => setOrdered((v) => !v)}>
          order by starttime
        </button>
      </div>
      <SqlCode
        code={`select memid, starttime, slots,
       sum(slots) over (${over}) as running
from cd.bookings
where memid <> 0;`}
      />

      <div class={styles.tableWrap}>
        <table class={cx(shared.table, styles.table)}>
          <thead>
            <tr>
              <th class={shared.right}>memid</th>
              <th>name</th>
              <th>starttime</th>
              <th class={shared.right}>slots</th>
              <th class={shared.right}>running</th>
            </tr>
          </thead>
          <tbody>
            {out.map((o) => {
              if (o.partStart && o.index > 0) band += 1;
              const inFrame = cur.frame.has(o.row.bookid);
              const isCur = o === cur;
              return (
                <tr
                  key={o.row.bookid}
                  class={cx(
                    styles.row,
                    partition && band % 2 === 1 && styles.bandAlt,
                    o.partStart && o.index > 0 && partition && styles.partStart,
                    inFrame && styles.inFrame,
                    isCur && styles.current,
                  )}
                  onMouseEnter={() => setCurrent(o.index)}
                  onClick={() => setCurrent(o.index)}
                >
                  <td class={shared.right}>{o.row.memid}</td>
                  <td>{memberById.get(o.row.memid)!.firstname}</td>
                  <td>{o.row.starttime}</td>
                  <td class={cx(shared.right, inFrame && styles.summed)}>{o.row.slots}</td>
                  <td class={cx(shared.right, styles.value)}>
                    <span key={`${partition}${ordered}`} class={styles.tick}>
                      {o.value}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p class={shared.caption} aria-live="polite">
        Row for {memberById.get(cur.row.memid)!.firstname} at {cur.row.starttime.slice(5)}: summing the {cur.frame.size}{' '}
        highlighted row{cur.frame.size === 1 ? '' : 's'} gives <strong>{cur.value}</strong>.{' '}
        {!ordered
          ? `No ORDER BY, so the frame is the whole ${partition ? 'partition' : 'table'}: every row gets the same total.`
          : partition
            ? 'The frame starts at the top of this member’s partition and stops at the current row.'
            : 'No partition, so the running total runs across every member.'}
      </p>
      <p class={shared.note}>
        Every input row is still here, which is the difference from GROUP BY. Hover a row to see its frame.
      </p>
    </figure>
  );
}
