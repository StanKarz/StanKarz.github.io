import { useState } from 'preact/hooks';
import { bookings } from '../../data/sql/countryclub';
import { DATE_FILTERS, hoursOf, type DateFilter as Filter } from '../../lib/sql/demos';
import { RowCount, Segmented, SqlCode, cx, shared } from './shared/primitives';
import styles from './DateFilter.module.css';

/** Bookings from the evening of the 20th to midnight on the 22nd: enough to show both edges. */
const SHOWN = bookings
  .filter((b) => b.starttime >= '2012-09-20 12:00' && b.starttime <= '2012-09-22 00:00')
  .sort((a, b) => a.starttime.localeCompare(b.starttime));

const CAPTIONS: Record<Filter, string> = {
  equals:
    "starttime is a timestamp, so '2012-09-21' is read as 2012-09-21 00:00:00. That is one instant: only the midnight booking matches.",
  cast: 'Cast the timestamp to a date first, and compare dates with dates. The whole day matches.',
  range: 'Half-open: from midnight, up to but not including the next midnight. Same rows as the cast.',
  between: 'BETWEEN includes both ends, so the booking at exactly midnight on the 22nd sneaks in.',
};

export default function DateFilter() {
  const [filter, setFilter] = useState<Filter>('equals');
  const f = DATE_FILTERS[filter];
  const kept = SHOWN.filter((b) => f.keep(hoursOf(b.starttime))).length;

  return (
    <figure class={shared.figure}>
      <Segmented
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'equals', label: "= '2012-09-21'" },
          { value: 'cast', label: '::date =' },
          { value: 'range', label: '>= and <' },
          { value: 'between', label: 'between' },
        ]}
      />
      <SqlCode code={`select bookid, starttime from cd.bookings\n${f.sql};`} />

      <ul class={styles.list}>
        {SHOWN.map((b) => {
          const on = f.keep(hoursOf(b.starttime));
          const [date, time] = b.starttime.split(' ');
          return (
            <li key={b.bookid} class={cx(styles.item, on ? styles.on : styles.off)}>
              <span class={styles.id}>booking {b.bookid}</span>
              <span class={styles.ts}>
                {date} <span class={styles.time}>{time}:00</span>
              </span>
              <span class={styles.verdict}>{on ? 'matched' : '—'}</span>
            </li>
          );
        })}
      </ul>

      <div class={shared.toolbar}>
        <RowCount n={kept} />
        <span class={styles.caption}>{CAPTIONS[filter]}</span>
      </div>
    </figure>
  );
}
