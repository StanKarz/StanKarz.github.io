import { useMemo, useState } from 'preact/hooks';
import { bookings, members, fullName, type Booking, type Member } from '../../data/sql/countryclub';
import { join, type JoinType } from '../../lib/sql/engine';
import { ResultTable, RowCount, Segmented, SqlCode, cx, shared, type Column, type Row } from './shared/primitives';
import styles from './JoinExplorer.module.css';

/** Trimmed so the whole thing fits on screen, and so each join type has something to show. */
const LEFT_IDS = [1, 2, 3, 4, 37];
const RIGHT_IDS = [0, 2, 3, 4, 6, 7, 9];

const LEFT: Member[] = members.filter((m) => LEFT_IDS.includes(m.memid));
const RIGHT: Booking[] = bookings.filter((b) => RIGHT_IDS.includes(b.bookid));

type JoinOn = 'memid' | 'facid';

const ON: Record<JoinOn, { sql: string; test: (m: Member, b: Booking) => boolean }> = {
  memid: { sql: 'bks.memid = mems.memid', test: (m, b) => b.memid === m.memid },
  facid: { sql: 'bks.facid = mems.memid', test: (m, b) => b.facid === m.memid },
};

const KEYWORD: Record<JoinType, string> = {
  inner: 'inner join',
  left: 'left join',
  right: 'right join',
  full: 'full join',
  cross: 'cross join',
};

const CAPTION: Record<JoinType, string> = {
  inner:
    'Only pairs that satisfy ON survive. The second Darren Smith (37) has no bookings, and booking 7 belongs to Gerald, who is not in this trimmed members table. Both vanish without a trace.',
  left: 'Every member survives. Darren 37 has nothing to pair with, so every bookings column is padded with NULL.',
  right:
    "Every booking survives. Booking 7's member is not in the left table here, so the member columns are NULL. With the full tables and a foreign key every booking has a member, so this RIGHT JOIN would match the INNER one.",
  full: 'Both sides survive: NULLs on whichever side is missing.',
  cross:
    'No ON at all: every member paired with every booking. An inner join is this grid filtered down to the cells where ON is true.',
};

const LEFT_COLUMNS: Column[] = [
  { key: 'memid', label: 'memid', align: 'right' },
  { key: 'name', label: 'name' },
  { key: 'fan', label: '→ rows out', align: 'right' },
];

const RIGHT_COLUMNS: Column[] = [
  { key: 'bookid', label: 'bookid', align: 'right' },
  { key: 'memid', label: 'memid', align: 'right' },
  { key: 'facid', label: 'facid', align: 'right' },
  { key: 'slots', label: 'slots', align: 'right' },
  { key: 'fan', label: '→ rows out', align: 'right' },
];

const RESULT_COLUMNS: Column[] = [
  { key: 'mmemid', label: 'mems.memid', align: 'right' },
  { key: 'name', label: 'name' },
  { key: 'bookid', label: 'bks.bookid', align: 'right' },
  { key: 'bmemid', label: 'bks.memid', align: 'right' },
  { key: 'facid', label: 'bks.facid', align: 'right' },
  { key: 'slots', label: 'bks.slots', align: 'right' },
];

/** What the pointer is over: a source row on either side, or a result row. */
type Hover = { side: 'left' | 'right' | 'result'; key: string } | null;

export default function JoinExplorer() {
  const [type, setType] = useState<JoinType>('inner');
  const [on, setOn] = useState<JoinOn>('memid');
  const [hover, setHover] = useState<Hover>(null);

  const result = useMemo(
    () =>
      join(
        LEFT,
        RIGHT,
        type,
        ON[on].test,
        (m) => String(m.memid),
        (b) => String(b.bookid),
      ),
    [type, on],
  );
  const correctCount = useMemo(
    () =>
      join(
        LEFT,
        RIGHT,
        type,
        ON.memid.test,
        (m) => String(m.memid),
        (b) => String(b.bookid),
      ).length,
    [type],
  );

  const fanLeft = (m: Member) => result.filter((r) => r.left === m).length;
  const fanRight = (b: Booking) => result.filter((r) => r.right === b).length;

  // Which result keys light up for the current hover, and which source rows feed them.
  const litResults = new Set(
    result
      .filter((r) => {
        if (!hover) return false;
        if (hover.side === 'result') return r.key === hover.key;
        if (hover.side === 'left') return r.left !== null && String(r.left.memid) === hover.key;
        return r.right !== null && String(r.right.bookid) === hover.key;
      })
      .map((r) => r.key),
  );
  const litLeft = new Set(result.filter((r) => litResults.has(r.key) && r.left).map((r) => String(r.left!.memid)));
  const litRight = new Set(result.filter((r) => litResults.has(r.key) && r.right).map((r) => String(r.right!.bookid)));
  if (hover?.side === 'left') litLeft.add(hover.key);
  if (hover?.side === 'right') litRight.add(hover.key);

  const leftRows: Row[] = LEFT.map((m) => ({
    key: String(m.memid),
    cells: { memid: m.memid, name: fullName(m), fan: `× ${fanLeft(m)}` },
    state: litLeft.has(String(m.memid)) ? 'highlight' : fanLeft(m) === 0 ? 'dim' : undefined,
  }));
  const rightRows: Row[] = RIGHT.map((b) => ({
    key: String(b.bookid),
    cells: { bookid: b.bookid, memid: b.memid, facid: b.facid, slots: b.slots, fan: `× ${fanRight(b)}` },
    state: litRight.has(String(b.bookid)) ? 'highlight' : fanRight(b) === 0 ? 'dim' : undefined,
  }));
  const resultRows: Row[] = result.map((r) => ({
    key: r.key,
    cells: {
      mmemid: r.left?.memid ?? null,
      name: r.left ? fullName(r.left) : null,
      bookid: r.right?.bookid ?? null,
      bmemid: r.right?.memid ?? null,
      facid: r.right?.facid ?? null,
      slots: r.right?.slots ?? null,
    },
    state: litResults.has(r.key) ? 'highlight' : undefined,
  }));

  const sql =
    type === 'cross'
      ? `select *\nfrom cd.members mems\ncross join cd.bookings bks;`
      : `select *\nfrom cd.members mems\n${KEYWORD[type]} cd.bookings bks\n  on ${ON[on].sql};`;

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <Segmented
          label="Join type"
          value={type}
          onChange={setType}
          options={(['inner', 'left', 'right', 'full', 'cross'] as JoinType[]).map((t) => ({
            value: t,
            label: t.toUpperCase(),
          }))}
        />
        {type !== 'cross' && (
          <Segmented
            label="Join condition"
            value={on}
            onChange={setOn}
            options={[
              { value: 'memid', label: 'on bks.memid' },
              { value: 'facid', label: 'on bks.facid (bug)' },
            ]}
          />
        )}
      </div>

      <SqlCode code={sql} />

      <div class={styles.sources}>
        <div onMouseLeave={() => setHover(null)}>
          <div class={styles.tableHead}>
            <span class={shared.label}>cd.members mems</span>
            <RowCount n={LEFT.length} />
          </div>
          <ResultTable
            columns={LEFT_COLUMNS}
            rows={leftRows}
            onRowHover={(k) => setHover(k === null ? null : { side: 'left', key: k })}
          />
        </div>
        <div onMouseLeave={() => setHover(null)}>
          <div class={styles.tableHead}>
            <span class={shared.label}>cd.bookings bks</span>
            <RowCount n={RIGHT.length} />
          </div>
          <ResultTable
            columns={RIGHT_COLUMNS}
            rows={rightRows}
            onRowHover={(k) => setHover(k === null ? null : { side: 'right', key: k })}
          />
        </div>
      </div>

      <p class={shared.caption}>
        {CAPTION[type]}
        {type !== 'cross' && on === 'facid' && (
          <>
            {' '}
            <strong class={styles.warn}>
              Joined on the wrong column: {result.length} rows instead of {correctCount}, and no error.
            </strong>{' '}
            Both are integers, so member 1 is matched to every booking at facility 1.
          </>
        )}
      </p>

      <div class={styles.tableHead}>
        <span class={shared.label}>result</span>
        <RowCount n={result.length} />
      </div>

      {type === 'cross' ? (
        <CrossGrid />
      ) : (
        <div onMouseLeave={() => setHover(null)}>
          <ResultTable
            columns={RESULT_COLUMNS}
            rows={resultRows}
            onRowHover={(k) => setHover(k === null ? null : { side: 'result', key: k })}
          />
        </div>
      )}

      <p class={shared.note}>
        Hover any row to see where it came from or where it went. The → rows out column is the one to watch: a member
        with two bookings comes out twice.
      </p>
    </figure>
  );
}

/** Every pairing as a cell; the ones an inner join on memid would keep are filled. */
function CrossGrid() {
  return (
    <div class={styles.gridWrap}>
      <table class={styles.grid}>
        <thead>
          <tr>
            <th />
            {RIGHT.map((b) => (
              <th key={b.bookid} scope="col">
                bk {b.bookid}
                <span class={styles.gridSub}>m{b.memid}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEFT.map((m, i) => (
            <tr key={m.memid}>
              <th scope="row">
                {m.memid} {m.firstname}
              </th>
              {RIGHT.map((b, j) => {
                const match = ON.memid.test(m, b);
                return (
                  <td key={b.bookid}>
                    <span
                      class={cx(styles.dot, match && styles.dotMatch)}
                      style={{ animationDelay: `${(i * RIGHT.length + j) * 12}ms` }}
                      title={match ? 'kept by an inner join on memid' : 'only exists in the cross join'}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p class={shared.note}>
        {LEFT.length} × {RIGHT.length} = {LEFT.length * RIGHT.length} rows. Filled cells are the{' '}
        {RIGHT.filter((b) => LEFT.some((m) => ON.memid.test(m, b))).length} pairs where{' '}
        <code>bks.memid = mems.memid</code>.
      </p>
    </div>
  );
}
