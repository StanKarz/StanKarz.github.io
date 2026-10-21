import { useMemo, useState } from 'preact/hooks';
import { bookings, members, GUEST_MEMID } from '../../data/sql/countryclub';
import { groupBy, rankSorted } from '../../lib/sql/engine';
import { SqlCode, cx, shared } from './shared/primitives';
import styles from './RankTies.module.css';

const SQL = `select mems.firstname, sum(bks.slots) as total,
       rank()       over (order by sum(bks.slots) desc),
       dense_rank() over (order by sum(bks.slots) desc),
       row_number() over (order by sum(bks.slots) desc)
from cd.members mems
join cd.bookings bks on bks.memid = mems.memid
where mems.memid <> 0
group by mems.memid;`;

const ROW_HEIGHT_REM = 2.25;

interface Person {
  memid: number;
  name: string;
}

const PEOPLE: Person[] = members
  .filter((m) => m.memid !== GUEST_MEMID && bookings.some((b) => b.memid === m.memid))
  .map((m) => ({ memid: m.memid, name: m.firstname }));

const INITIAL_TOTALS: Record<number, number> = Object.fromEntries(
  groupBy(
    bookings.filter((b) => b.memid !== GUEST_MEMID),
    (b) => String(b.memid),
  ).map((g) => [Number(g.key), g.rows.reduce((a, b) => a + b.slots, 0)]),
);

/** Order within a tie. Each "run it again" flips it, standing in for the planner's freedom. */
function tieBreak(memid: number, run: number): number {
  return run % 2 === 0 ? memid : -memid;
}

export default function RankTies() {
  const [totals, setTotals] = useState(INITIAL_TOTALS);
  const [seed, setSeed] = useState(0);

  const sorted = useMemo(
    () =>
      [...PEOPLE].sort(
        (a, b) => totals[b.memid] - totals[a.memid] || tieBreak(a.memid, seed) - tieBreak(b.memid, seed),
      ),
    [totals, seed],
  );
  const ranks = rankSorted(sorted.map((p) => totals[p.memid]));
  const position = new Map(sorted.map((p, i) => [p.memid, i]));
  const isTied = (i: number) =>
    (i > 0 && totals[sorted[i].memid] === totals[sorted[i - 1].memid]) ||
    (i < sorted.length - 1 && totals[sorted[i].memid] === totals[sorted[i + 1].memid]);
  const hasTies = sorted.some((_, i) => isTied(i));

  const bump = (memid: number, by: number) =>
    setTotals((t) => ({
      ...t,
      [memid]: Math.max(0, Math.min(20, t[memid] + by)),
    }));

  return (
    <figure class={shared.figure}>
      <SqlCode code={SQL} />

      <div class={styles.scroll}>
        <div class={styles.scrollInner}>
          <div class={styles.header} aria-hidden="true">
            <span>firstname</span>
            <span class={styles.num}>total</span>
            <span class={styles.num}>rank</span>
            <span class={styles.num}>dense_rank</span>
            <span class={styles.num}>row_number</span>
          </div>

          {/* Rows are absolutely positioned by their sorted index, so a change in
          total slides them to their new place instead of jumping. */}
          <div class={styles.board} style={{ height: `${PEOPLE.length * ROW_HEIGHT_REM}rem` }} role="table">
            {PEOPLE.map((p) => {
              const i = position.get(p.memid)!;
              const r = ranks[i];
              const tied = isTied(i);
              return (
                <div
                  key={p.memid}
                  role="row"
                  class={cx(styles.row, tied && styles.tied)}
                  style={{
                    transform: `translateY(${i * ROW_HEIGHT_REM}rem)`,
                    height: `${ROW_HEIGHT_REM}rem`,
                  }}
                >
                  <span role="cell" class={styles.name}>
                    {p.name}
                  </span>
                  <span role="cell" class={cx(styles.num, styles.stepper)}>
                    <button type="button" aria-label={`fewer slots for ${p.name}`} onClick={() => bump(p.memid, -1)}>
                      −
                    </button>
                    <b>{totals[p.memid]}</b>
                    <button type="button" aria-label={`more slots for ${p.name}`} onClick={() => bump(p.memid, 1)}>
                      +
                    </button>
                  </span>
                  <span role="cell" class={cx(styles.num, styles.rank)} key={`r${r.rank}`}>
                    {r.rank}
                  </span>
                  <span role="cell" class={cx(styles.num, styles.rank)} key={`d${r.denseRank}`}>
                    {r.denseRank}
                  </span>
                  <span
                    role="cell"
                    class={cx(styles.num, styles.rank, tied && styles.arbitrary)}
                    key={`n${r.rowNumber}`}
                  >
                    {r.rowNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div class={shared.toolbar}>
        <button type="button" class={shared.button} onClick={() => setSeed((s) => s + 1)} disabled={!hasTies}>
          run it again
        </button>
        <button type="button" class={shared.button} onClick={() => setTotals(INITIAL_TOTALS)}>
          reset totals
        </button>
      </div>

      <p class={shared.caption}>
        {hasTies ? (
          <>
            Tied rows share a <code>rank</code>, and the next rank skips ahead (1, 1, 3). <code>dense_rank</code> never
            skips (1, 1, 2). <code>row_number</code> numbers every row, so within a tie it picks an order, and nothing
            in the query says which. Run it again: the underlined numbers can swap.
          </>
        ) : (
          <>No ties left, so all three columns agree. Use the − and + buttons to make two totals equal.</>
        )}
      </p>
    </figure>
  );
}
