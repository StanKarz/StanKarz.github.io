import { useMemo, useState } from 'preact/hooks';
import { bookings, members, fullName, GUEST_MEMID } from '../../data/sql/countryclub';
import { groupBy, join, sum } from '../../lib/sql/engine';
import { Cell, RowCount, Segmented, SqlCode, cx, shared } from './shared/primitives';
import styles from './GroupByBuckets.module.css';

type Key = 'memid' | 'name';
type JoinKind = 'inner' | 'left';

function sql(key: Key, kind: JoinKind) {
  return `select mems.firstname, mems.surname,
       count(*), count(bks.bookid), sum(bks.slots)
from cd.members mems
${kind === 'inner' ? 'join' : 'left join'} cd.bookings bks on bks.memid = mems.memid
where mems.memid <> 0
group by ${key === 'memid' ? 'mems.memid' : 'mems.firstname, mems.surname'};`;
}

export default function GroupByBuckets() {
  const [key, setKey] = useState<Key>('memid');
  const [kind, setKind] = useState<JoinKind>('left');
  const [collapsed, setCollapsed] = useState(false);

  const groups = useMemo(() => {
    const rows = join(
      members.filter((m) => m.memid !== GUEST_MEMID),
      bookings,
      kind,
      (m, b) => b.memid === m.memid,
      (m) => String(m.memid),
      (b) => String(b.bookid),
    );
    return groupBy(rows, (r) => (key === 'memid' ? String(r.left!.memid) : fullName(r.left!))).map((g) => {
      const memids = [...new Set(g.rows.map((r) => r.left!.memid))];
      return {
        key: g.key,
        name: fullName(g.rows[0].left!),
        memids,
        rows: g.rows,
        countStar: g.rows.length,
        countBookings: g.rows.filter((r) => r.right !== null).length,
        slots: sum(g.rows.map((r) => r.right?.slots ?? null)),
      };
    });
  }, [key, kind]);

  const merged = groups.find((g) => g.memids.length > 1);
  const totalRows = groups.reduce((a, g) => a + g.rows.length, 0);

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <Segmented
          label="Group by"
          value={key}
          onChange={setKey}
          options={[
            { value: 'memid', label: 'group by memid' },
            { value: 'name', label: 'group by name' },
          ]}
        />
        <Segmented
          label="Join"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'left', label: 'LEFT JOIN' },
            { value: 'inner', label: 'INNER JOIN' },
          ]}
        />
      </div>

      <SqlCode code={sql(key, kind)} />

      <div class={shared.toolbar}>
        <button type="button" class={shared.button} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '← spread the rows back out' : 'collapse each group →'}
        </button>
        <span class={styles.spacer} />
        <RowCount n={collapsed ? groups.length : totalRows} label={collapsed ? 'result rows' : 'joined rows'} />
      </div>

      <div class={styles.buckets}>
        {groups.map((g) => (
          <div key={g.key} class={cx(styles.bucket, g.memids.length > 1 && styles.mergedBucket)}>
            <div class={styles.bucketHead}>
              <span>{g.name}</span>
              <span class={styles.memids}>memid {g.memids.join(' + ')}</span>
            </div>

            <div class={cx(styles.bucketBody, collapsed && styles.bucketBodyCollapsed)}>
              <div>
                <table class={styles.inner}>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.key}>
                        <td>m{r.left!.memid}</td>
                        <td>
                          bk <Cell value={r.right?.bookid ?? null} />
                        </td>
                        <td class={styles.right}>
                          <Cell value={r.right?.slots ?? null} /> slots
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div class={cx(styles.summary, collapsed && styles.summaryLive)}>
              <span title="count(*) counts rows">
                count(*) <b>{g.countStar}</b>
              </span>
              <span title="count(col) skips NULLs">
                count(bookid) <b>{g.countBookings}</b>
              </span>
              <span title="sum skips NULLs, and is NULL over nothing">
                sum{' '}
                <b>
                  <Cell value={g.slots} />
                </b>
              </span>
            </div>
          </div>
        ))}
      </div>

      <p class={shared.caption}>
        {key === 'name' && merged ? (
          <>
            <strong class={styles.warn}>
              Two different Darren Smiths ({merged.memids.join(' and ')}) share one bucket.
            </strong>{' '}
            Their bookings are added together and the output has no way of showing it was two people.
          </>
        ) : key === 'name' ? (
          <>
            Grouping by name looks harmless here only because the inner join already dropped Darren 37, who has no
            bookings. The day he books a court, his slots get added to the other Darren's.
          </>
        ) : kind === 'left' ? (
          <>
            Grouped by the key, the two Darrens stay apart. The LEFT JOIN keeps Darren 37, who never booked: one row, so{' '}
            <code>count(*)</code> is 1, but <code>count(bks.bookid)</code> is 0 and <code>sum</code> over nothing is
            NULL. Wrap it in <code>coalesce(sum(bks.slots), 0)</code> if the question wants 0, or use an inner join if
            it only wants members who booked.
          </>
        ) : (
          <>
            Grouped by the key with an inner join: one row per member who has booked, which is usually what the question
            wants.
          </>
        )}
      </p>
    </figure>
  );
}
