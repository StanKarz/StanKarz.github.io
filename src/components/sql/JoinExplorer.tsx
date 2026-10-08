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
type View = 'rows' | 'venn';

const ON: Record<JoinOn, { sql: string; col: 'memid' | 'facid'; test: (m: Member, b: Booking) => boolean }> = {
  memid: { sql: 'bks.memid = mems.memid', col: 'memid', test: (m, b) => b.memid === m.memid },
  facid: { sql: 'bks.facid = mems.memid', col: 'facid', test: (m, b) => b.facid === m.memid },
};

const KEYWORD: Record<JoinType, string> = {
  inner: 'inner join',
  left: 'left join',
  right: 'right join',
  full: 'full join',
  cross: 'cross join',
};

const KEEPS_LEFT: Record<JoinType, boolean> = { inner: false, left: true, right: false, full: true, cross: true };
const KEEPS_RIGHT: Record<JoinType, boolean> = { inner: false, left: false, right: true, full: true, cross: true };

const RESULT_COLUMNS: Column[] = [
  { key: 'mmemid', label: 'mems.memid', align: 'right' },
  { key: 'name', label: 'name' },
  { key: 'bookid', label: 'bks.bookid', align: 'right' },
  { key: 'bmemid', label: 'bks.memid', align: 'right' },
  { key: 'facid', label: 'bks.facid', align: 'right' },
];

/** Which rows find a partner, computed once per join condition. */
function matching(on: JoinOn) {
  const pairs: [number, number][] = [];
  LEFT.forEach((m, i) => RIGHT.forEach((b, j) => ON[on].test(m, b) && pairs.push([i, j])));
  const fanLeft = LEFT.map((_, i) => pairs.filter(([l]) => l === i).length);
  const fanRight = RIGHT.map((_, j) => pairs.filter(([, r]) => r === j).length);
  return { pairs, fanLeft, fanRight };
}

export default function JoinExplorer() {
  const [type, setType] = useState<JoinType>('left');
  const [on, setOn] = useState<JoinOn>('memid');
  const [view, setView] = useState<View>('rows');
  const [hover, setHover] = useState<string | null>(null);

  const match = useMemo(() => matching(on), [on]);
  const result = useMemo(
    () => join(LEFT, RIGHT, type, ON[on].test, (m) => String(m.memid), (b) => String(b.bookid)),
    [type, on],
  );
  const correctCount = useMemo(() => join(LEFT, RIGHT, type, ON.memid.test, String, String).length, [type]);

  const orphansLeft = match.fanLeft.filter((n) => n === 0).length;
  const orphansRight = match.fanRight.filter((n) => n === 0).length;

  const isLit = (l: Member | null, r: Booking | null, key: string) =>
    hover !== null && (hover === key || (l !== null && hover === `l${l.memid}`) || (r !== null && hover === `r${r.bookid}`));

  const resultRows: Row[] = result.map((r) => ({
    key: r.key,
    cells: {
      mmemid: r.left?.memid ?? null,
      name: r.left ? fullName(r.left) : null,
      bookid: r.right?.bookid ?? null,
      bmemid: r.right?.memid ?? null,
      facid: r.right?.facid ?? null,
    },
    tone: r.right === null ? 'left' : r.left === null ? 'right' : undefined,
    state: isLit(r.left, r.right, r.key) ? 'highlight' : undefined,
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
            label="Picture"
            value={view}
            onChange={setView}
            options={[
              { value: 'rows', label: 'rows' },
              { value: 'venn', label: 'venn' },
            ]}
          />
        )}
      </div>

      <SqlCode code={sql} />

      {type === 'cross' ? (
        <CrossGrid />
      ) : (
        <>
          {view === 'venn' ? (
            <Venn type={type} match={match} />
          ) : (
            <Wiring type={type} on={on} match={match} hover={hover} setHover={setHover} />
          )}
          <Legend type={type} orphansLeft={orphansLeft} orphansRight={orphansRight} />
          <div class={shared.toolbar}>
            <span class={shared.label}>join on</span>
            <Segmented
              label="Join condition"
              value={on}
              onChange={setOn}
              options={[
                { value: 'memid', label: 'bks.memid' },
                { value: 'facid', label: 'bks.facid (wrong)' },
              ]}
            />
          </div>
          {on === 'facid' && (
            <p class={shared.caption}>
              <strong class={styles.warn}>
                {result.length} rows instead of {correctCount}, and no error.
              </strong>{' '}
              Both columns are integers, so member 1 is paired with every booking at facility 1.
            </p>
          )}
        </>
      )}

      <div class={styles.resultHead}>
        <span class={shared.label}>result</span>
        <span class={styles.flow}>
          <RowCount n={LEFT.length} label="members" />
          <span aria-hidden="true">+</span>
          <RowCount n={RIGHT.length} label="bookings" />
          <span aria-hidden="true">→</span>
          <RowCount n={result.length} />
        </span>
      </div>
      {type === 'cross' ? (
        <p class={shared.note}>
          {LEFT.length} × {RIGHT.length} = {LEFT.length * RIGHT.length} rows, too many to list. An inner join is this
          grid filtered down to the filled cells.
        </p>
      ) : (
        <div onMouseLeave={() => setHover(null)}>
          <ResultTable columns={RESULT_COLUMNS} rows={resultRows} onRowHover={setHover} />
        </div>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ rows */

const ROW_H = 36;

type Match = ReturnType<typeof matching>;

interface WiringProps {
  type: JoinType;
  on: JoinOn;
  match: Match;
  hover: string | null;
  setHover: (k: string | null) => void;
}

/**
 * Both tables as columns of cards, with a line for every pair that satisfies ON.
 * Rows without a line are the whole story of outer joins: kept with NULLs, or dropped.
 */
function Wiring({ type, on, match, hover, setHover }: WiringProps) {
  const height = Math.max(LEFT.length, RIGHT.length) * ROW_H;
  const y = (i: number) => (i + 0.5) * ROW_H;

  const pairLit = (i: number, j: number) =>
    hover !== null &&
    (hover === `l${LEFT[i].memid}` || hover === `r${RIGHT[j].bookid}` || hover === `${LEFT[i].memid}|${RIGHT[j].bookid}`);

  const state = (fan: number, keeps: boolean) => (fan > 0 ? 'match' : keeps ? 'kept' : 'dropped');

  return (
    <div class={styles.wiring} onMouseLeave={() => setHover(null)}>
      <div class={styles.columnHead}>
        <span class={shared.label}>cd.members mems</span>
      </div>
      <span />
      <div class={styles.columnHead}>
        <span class={shared.label}>cd.bookings bks</span>
      </div>

      <ol class={styles.column} style={{ height: `${height}px` }}>
        {LEFT.map((m, i) => {
          const s = state(match.fanLeft[i], KEEPS_LEFT[type]);
          return (
            <li
              key={m.memid}
              class={cx(styles.card, styles[s], styles.sideLeft, hover === `l${m.memid}` && styles.lit)}
              style={{ height: `${ROW_H}px` }}
              onMouseEnter={() => setHover(`l${m.memid}`)}
            >
              <span class={styles.id}>{m.memid}</span>
              <span class={styles.text}>{fullName(m)}</span>
              <span class={styles.tag}>{s === 'match' ? `×${match.fanLeft[i]}` : s === 'kept' ? '+NULL' : 'gone'}</span>
            </li>
          );
        })}
      </ol>

      <svg
        class={styles.wires}
        style={{ height: `${height}px` }}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {match.pairs.map(([i, j]) => (
          <path
            key={`${on}-${i}-${j}`}
            d={`M0,${y(i)} C55,${y(i)} 45,${y(j)} 100,${y(j)}`}
            class={cx(styles.wire, pairLit(i, j) && styles.wireLit)}
            pathLength={1}
            vector-effect="non-scaling-stroke"
          />
        ))}
      </svg>

      <ol class={styles.column} style={{ height: `${height}px` }}>
        {RIGHT.map((b, j) => {
          const s = state(match.fanRight[j], KEEPS_RIGHT[type]);
          return (
            <li
              key={b.bookid}
              class={cx(styles.card, styles[s], styles.sideRight, hover === `r${b.bookid}` && styles.lit)}
              style={{ height: `${ROW_H}px` }}
              onMouseEnter={() => setHover(`r${b.bookid}`)}
            >
              <span class={styles.text}>bk {b.bookid}</span>
              <span class={styles.key}>
                {ON[on].col}={b[ON[on].col]}
              </span>
              <span class={styles.tag}>{s === 'match' ? '' : s === 'kept' ? '+NULL' : 'gone'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Legend({ type, orphansLeft, orphansRight }: { type: JoinType; orphansLeft: number; orphansRight: number }) {
  return (
    <ul class={styles.legend}>
      <li>
        <span class={cx(styles.swatch, styles.swatchMatch)} />
        matched: one output row per line
      </li>
      <li>
        <span class={cx(styles.swatch, styles.swatchLeft)} />
        {orphansLeft} member{orphansLeft === 1 ? '' : 's'} with no booking:{' '}
        <strong>{KEEPS_LEFT[type] ? 'kept, booking columns NULL' : 'dropped'}</strong>
      </li>
      <li>
        <span class={cx(styles.swatch, styles.swatchRight)} />
        {orphansRight} booking{orphansRight === 1 ? '' : 's'} with no member here:{' '}
        <strong>{KEEPS_RIGHT[type] ? 'kept, member columns NULL' : 'dropped'}</strong>
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ venn */

/**
 * The usual picture, with real counts in each region. The note underneath is
 * the point: the middle holds pairs, so it can hold the same member twice.
 */
function Venn({ type, match }: { type: JoinType; match: Match }) {
  const leftOnly = match.fanLeft.filter((n) => n === 0).length;
  const rightOnly = match.fanRight.filter((n) => n === 0).length;
  const pairs = match.pairs.length;
  const matchedMembers = match.fanLeft.filter((n) => n > 0).length;
  const repeats = LEFT.filter((_, i) => match.fanLeft[i] > 1);

  return (
    <div class={styles.venn}>
      <svg viewBox="0 0 400 220" role="img" aria-label={`Venn diagram for a ${type} join`}>
        <defs>
          <mask id="sql-venn-left-only">
            <rect width="400" height="220" fill="black" />
            <circle cx="160" cy="118" r="88" fill="white" />
            <circle cx="240" cy="118" r="88" fill="black" />
          </mask>
          <mask id="sql-venn-right-only">
            <rect width="400" height="220" fill="black" />
            <circle cx="240" cy="118" r="88" fill="white" />
            <circle cx="160" cy="118" r="88" fill="black" />
          </mask>
          <clipPath id="sql-venn-left-clip">
            <circle cx="160" cy="118" r="88" />
          </clipPath>
        </defs>
        <rect
          width="400"
          height="220"
          mask="url(#sql-venn-left-only)"
          class={cx(styles.region, styles.regionLeft, KEEPS_LEFT[type] && styles.regionOn)}
        />
        <rect
          width="400"
          height="220"
          mask="url(#sql-venn-right-only)"
          class={cx(styles.region, styles.regionRight, KEEPS_RIGHT[type] && styles.regionOn)}
        />
        <circle
          cx="240"
          cy="118"
          r="88"
          clip-path="url(#sql-venn-left-clip)"
          class={cx(styles.region, styles.regionMatch, styles.regionOn)}
        />
        <circle cx="160" cy="118" r="88" class={styles.outline} />
        <circle cx="240" cy="118" r="88" class={styles.outline} />

        <text x="118" y="114" class={styles.vennCount}>{leftOnly}</text>
        <text x="118" y="134" class={styles.vennSub}>{KEEPS_LEFT[type] ? '+NULL' : 'dropped'}</text>
        <text x="200" y="114" class={styles.vennCount}>{pairs}</text>
        <text x="200" y="134" class={styles.vennSub}>pairs</text>
        <text x="282" y="114" class={styles.vennCount}>{rightOnly}</text>
        <text x="282" y="134" class={styles.vennSub}>{KEEPS_RIGHT[type] ? '+NULL' : 'dropped'}</text>

        <text x="110" y="16" class={styles.vennLabel}>mems: {LEFT.length}</text>
        <text x="290" y="16" class={styles.vennLabel}>bks: {RIGHT.length}</text>
      </svg>
      <p class={shared.note}>
        Where the picture stops being accurate: the middle holds {pairs} output rows but only {matchedMembers}{' '}
        members.{' '}
        {repeats.length > 0 && (
          <>
            {repeats.map((m) => m.firstname).join(' and ')} {repeats.length === 1 ? 'has' : 'each have'} more than one
            booking, so {repeats.length === 1 ? 'appears' : 'appear'} more than once.{' '}
          </>
        )}
        Circles hold things; a join outputs pairs of things. The rows view shows them.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- cross */

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
                const hit = ON.memid.test(m, b);
                return (
                  <td key={b.bookid}>
                    <span
                      class={cx(styles.dot, hit && styles.dotMatch)}
                      style={{ animationDelay: `${(i * RIGHT.length + j) * 12}ms` }}
                      title={hit ? 'kept by an inner join on memid' : 'only exists in the cross join'}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
