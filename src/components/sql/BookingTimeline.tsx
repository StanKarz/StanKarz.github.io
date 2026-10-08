import { useState } from 'preact/hooks';
import { bookings, facilityById, type Booking } from '../../data/sql/countryclub';
import { DATE_FILTERS, DAY_END, DAY_START, hoursOf, type DateFilter as Filter } from '../../lib/sql/demos';
import { RowCount, Segmented, SqlCode, cx, shared } from './shared/primitives';
import styles from './BookingTimeline.module.css';

const START = 12; // 20 Sept, 12:00
const END = 54; // 22 Sept, 06:00

const W = 720;
const PAD = 14;
const x = (h: number) => PAD + ((h - START) / (END - START)) * (W - 2 * PAD);

const SHOWN = bookings.filter((b) => {
  const h = hoursOf(b.starttime);
  return h >= START && h < END;
});

const CAPTIONS: Record<Filter, string> = {
  equals:
    "A bare date compared with a timestamp is read as midnight. This is one instant, so only the 00:00 booking matches.",
  cast:
    'Cast the timestamp down to a date and compare dates. Reads plainly; it does hide the column from an index.',
  range:
    'Half-open: includes the start, excludes the end. Same rows, and the column is left alone.',
  between:
    'BETWEEN includes both ends, so the booking at midnight on the 22nd gets in as well.',
};

/** What each date function returns for the picked booking, worked out from the string. */
function parts(b: Booking) {
  const [date, time] = b.starttime.split(' ');
  return [
    ['starttime::date', date],
    ['extract(hour from starttime)', String(Number(time.slice(0, 2)))],
    ["date_part('dow', starttime)", String(new Date(`${date}T00:00:00Z`).getUTCDay())],
    ["date_trunc('day', starttime)", `${date} 00:00:00`],
    ["date_trunc('month', starttime)", `${date.slice(0, 8)}01 00:00:00`],
  ];
}

export default function BookingTimeline() {
  const [filter, setFilter] = useState<Filter>('equals');
  const [picked, setPicked] = useState(5);
  const f = DATE_FILTERS[filter];
  const kept = SHOWN.filter((b) => f.keep(hoursOf(b.starttime)));
  const pickedBooking = SHOWN.find((b) => b.bookid === picked) ?? SHOWN[0];

  const ticks = [12, 18, 24, 30, 36, 42, 48, 54];
  const tickLabel = (h: number) => (h % 24 === 0 ? `${20 + h / 24} Sept` : `${String(h % 24).padStart(2, '0')}:00`);

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

      <svg class={styles.chart} viewBox={`0 0 ${W} 120`} role="img" aria-label="Bookings around 21 September">
        {/* what the filter covers */}
        {filter === 'equals' ? (
          <line x1={x(DAY_START)} x2={x(DAY_START)} y1={18} y2={92} class={styles.instant} />
        ) : (
          <rect x={x(DAY_START)} y={18} width={x(DAY_END) - x(DAY_START)} height={74} class={styles.band} />
        )}
        {filter === 'between' && <line x1={x(DAY_END)} x2={x(DAY_END)} y1={18} y2={92} class={styles.instant} />}
        {(filter === 'cast' || filter === 'range') && (
          <line x1={x(DAY_END)} x2={x(DAY_END)} y1={18} y2={92} class={styles.openEnd} />
        )}

        {SHOWN.map((b) => {
          const h = hoursOf(b.starttime);
          const on = f.keep(h);
          return (
            <g
              key={b.bookid}
              class={cx(styles.booking, on && styles.on, b.bookid === pickedBooking.bookid && styles.picked)}
              onClick={() => setPicked(b.bookid)}
              onMouseEnter={() => setPicked(b.bookid)}
            >
              <rect x={x(h)} y={44} width={Math.max(4, x(h + b.slots / 2) - x(h))} height={22} rx={2} />
              <text x={x(h) + 2} y={38}>
                {b.bookid}
              </text>
            </g>
          );
        })}

        <line x1={PAD} x2={W - PAD} y1={92} y2={92} class={styles.axis} />
        {ticks.map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1={92} y2={97} class={styles.axis} />
            <text x={x(h)} y={111} class={cx(styles.tick, h % 24 === 0 && styles.tickDay)}>
              {tickLabel(h)}
            </text>
          </g>
        ))}
      </svg>

      <div class={shared.toolbar}>
        <RowCount n={kept.length} />
        <span class={styles.caption}>{CAPTIONS[filter]}</span>
      </div>

      <div class={styles.parts}>
        <span class={shared.label}>
          booking {pickedBooking.bookid}: {pickedBooking.starttime}, {facilityById.get(pickedBooking.facid)!.name}
        </span>
        <table class={cx(shared.table, styles.partsTable)}>
          <tbody>
            {parts(pickedBooking).map(([expr, value]) => (
              <tr key={expr}>
                <td>
                  <code>{expr}</code>
                </td>
                <td class={shared.right}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class={shared.note}>Hover a booking to take it apart. dow is day of week, 0 = Sunday.</p>
      </div>
    </figure>
  );
}
