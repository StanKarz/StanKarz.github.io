import { useMemo, useState } from 'preact/hooks';
import { bookings, members, GUEST_MEMID, type Booking, type Member } from '../../data/sql/countryclub';
import { groupBy, join } from '../../lib/sql/engine';
import { ResultTable, RowCount, Segmented, SqlCode, cx, shared, type Column, type Row } from './shared/primitives';
import styles from './ExecutionOrder.module.css';

const QUERY = `select distinct mems.surname, sum(bks.slots) as total
from cd.members mems
join cd.bookings bks on bks.memid = mems.memid
where mems.memid <> 0
group by mems.memid
having sum(bks.slots) > 2
order by total desc, mems.surname
limit 2;`;

const HAVING_MIN = 2;
const LIMIT = 2;

interface Stage {
  name: string;
  /** Lines of QUERY this stage executes. Empty when the query doesn't use it. */
  lines: number[];
  caption: string;
}

const STAGES: Stage[] = [
  {
    name: 'FROM / JOIN',
    lines: [1, 2],
    caption:
      'Postgres starts with the tables. The join pairs each booking with its member: 12 bookings, so 12 rows. Nothing from the SELECT line exists yet.',
  },
  {
    name: 'WHERE',
    lines: [3],
    caption:
      'WHERE filters individual rows. The two guest bookings go. It cannot see `total`: that name is invented four steps later.',
  },
  {
    name: 'GROUP BY',
    lines: [4],
    caption:
      'Rows that share a memid collapse into one row per member. From here on, each row is a group, and only grouped columns or aggregates make sense.',
  },
  {
    name: 'HAVING',
    lines: [5],
    caption:
      'HAVING filters groups, so it can use aggregates. Gerald and Nancy booked 2 slots each, which is not more than 2.',
  },
  {
    name: 'SELECT',
    lines: [0],
    caption: 'Only now are the output columns computed and named. `total` exists from this point on.',
  },
  {
    name: 'DISTINCT',
    lines: [0],
    caption:
      'DISTINCT compares only the selected columns. Darren and Tracy are both Smith on 5, so two different people become one row.',
  },
  {
    name: 'ORDER BY',
    lines: [6],
    caption:
      'ORDER BY runs after SELECT, so it can use the alias `total`. With DISTINCT it can only sort by selected columns: `mems.firstname` here is an error.',
  },
  {
    name: 'LIMIT',
    lines: [7],
    caption: 'Keep the first 2 rows. Without the ORDER BY, which 2 you get would be up to the planner.',
  },
];

type Joined = { b: Booking; m: Member };

const ROW_COLUMNS: Column[] = [
  { key: 'bookid', label: 'bks.bookid', align: 'right' },
  { key: 'memid', label: 'mems.memid', align: 'right' },
  { key: 'firstname', label: 'firstname' },
  { key: 'surname', label: 'surname' },
  { key: 'slots', label: 'bks.slots', align: 'right' },
];

const GROUP_COLUMNS: Column[] = [
  { key: 'memid', label: 'mems.memid', align: 'right' },
  { key: 'firstname', label: 'firstname' },
  { key: 'surname', label: 'surname' },
  { key: 'bookids', label: 'rows in group' },
  { key: 'sum', label: 'sum(bks.slots)', align: 'right' },
];

const OUTPUT_COLUMNS: Column[] = [
  { key: 'surname', label: 'surname' },
  { key: 'total', label: 'total', align: 'right' },
];

function computeStages() {
  const joined = join(
    members,
    bookings,
    'inner',
    (m, b) => b.memid === m.memid,
    (m) => String(m.memid),
    (b) => String(b.bookid),
  )
    .map((r) => ({ m: r.left!, b: r.right! }))
    .sort((x, y) => x.b.bookid - y.b.bookid);

  const rowOf = (j: Joined, state?: Row['state']): Row => ({
    key: `b${j.b.bookid}`,
    cells: { bookid: j.b.bookid, memid: j.m.memid, firstname: j.m.firstname, surname: j.m.surname, slots: j.b.slots },
    state,
  });

  const filtered = joined.filter((j) => j.m.memid !== GUEST_MEMID);
  const groups = groupBy(filtered, (j) => String(j.m.memid)).map((g) => ({
    member: g.rows[0].m,
    bookids: g.rows.map((j) => j.b.bookid),
    total: g.rows.reduce((a, j) => a + j.b.slots, 0),
  }));
  type G = (typeof groups)[number];

  const groupRow = (g: G, state?: Row['state']): Row => ({
    key: `g${g.member.memid}`,
    cells: {
      memid: g.member.memid,
      firstname: g.member.firstname,
      surname: g.member.surname,
      bookids: g.bookids.join(', '),
      sum: g.total,
    },
    state,
  });
  const outRow = (g: G, state?: Row['state']): Row => ({
    key: `g${g.member.memid}`,
    cells: { surname: g.member.surname, total: g.total },
    state,
  });

  const kept = groups.filter((g) => g.total > HAVING_MIN);
  // DISTINCT on (surname, total): the first of each identical pair survives.
  const seen = new Set<string>();
  const isDuplicate = new Map(
    kept.map((g) => {
      const k = `${g.member.surname}|${g.total}`;
      const dup = seen.has(k);
      seen.add(k);
      return [g, dup];
    }),
  );
  const unique = kept.filter((g) => !isDuplicate.get(g));
  const sorted = [...unique].sort((a, b) => b.total - a.total || a.member.surname.localeCompare(b.member.surname));

  // Within GROUP BY, show rows clustered by group with a rule between groups.
  const clustered: Row[] = [];
  groupBy(filtered, (j) => String(j.m.memid)).forEach((g, gi) =>
    g.rows.forEach((j, i) => clustered.push({ ...rowOf(j), groupStart: i === 0, tint: gi % 2 === 1 })),
  );

  return [
    { columns: ROW_COLUMNS, rows: joined.map((j) => rowOf(j)), count: joined.length, unit: 'rows' },
    {
      columns: ROW_COLUMNS,
      rows: joined.map((j) => rowOf(j, j.m.memid === GUEST_MEMID ? 'removed' : undefined)),
      count: filtered.length,
      unit: 'rows',
    },
    {
      columns: GROUP_COLUMNS,
      rows: groups.map((g) => groupRow(g)),
      count: groups.length,
      unit: 'groups',
      before: clustered,
    },
    {
      columns: GROUP_COLUMNS,
      rows: groups.map((g) => groupRow(g, g.total > HAVING_MIN ? undefined : 'removed')),
      count: kept.length,
      unit: 'groups',
    },
    { columns: OUTPUT_COLUMNS, rows: kept.map((g) => outRow(g)), count: kept.length, unit: 'rows' },
    {
      columns: OUTPUT_COLUMNS,
      rows: kept.map((g) => outRow(g, isDuplicate.get(g) ? 'removed' : undefined)),
      count: unique.length,
      unit: 'rows',
    },
    { columns: OUTPUT_COLUMNS, rows: sorted.map((g) => outRow(g)), count: sorted.length, unit: 'rows' },
    {
      columns: OUTPUT_COLUMNS,
      rows: sorted.map((g, i) => outRow(g, i < LIMIT ? undefined : 'removed')),
      count: Math.min(LIMIT, sorted.length),
      unit: 'rows',
    },
  ];
}

const ALIAS_DEFINED_LINE = 0;
const ALIAS_VISIBLE_LINES = new Set([6]);

export default function ExecutionOrder() {
  const stages = useMemo(computeStages, []);
  const [step, setStep] = useState(0);
  const [showGroupRows, setShowGroupRows] = useState(false);
  const [aliasMode, setAliasMode] = useState(false);

  const stage = STAGES[step];
  const data = stages[step];
  const stepOfLine = (line: number) => STAGES.findIndex((s) => s.lines.includes(line));

  const go = (next: number) => {
    setStep(Math.max(0, Math.min(STAGES.length - 1, next)));
    setShowGroupRows(false);
  };

  const selectStep = stepOfLine(ALIAS_DEFINED_LINE);
  const isFirstLineOfStage = (i: number) => {
    const at = stepOfLine(i);
    return at >= 0 && STAGES[at].lines[0] === i;
  };
  // SELECT and DISTINCT share line 0, so a line can carry more than one badge.
  const stagesStartingAt = (i: number) => STAGES.flatMap((s, at) => (s.lines[0] === i ? [at] : []));

  const lineClass = (i: number) => {
    if (aliasMode) {
      if (i === ALIAS_DEFINED_LINE) return styles.aliasDefined;
      if (ALIAS_VISIBLE_LINES.has(i)) return styles.aliasVisible;
      return stepOfLine(i) < selectStep ? styles.aliasBlind : undefined;
    }
    if (stage.lines.includes(i)) return styles.current;
    return stepOfLine(i) > step ? styles.future : styles.done;
  };

  const lineSuffix = (i: number) => {
    const at = stepOfLine(i);
    if (aliasMode) {
      if (i === ALIAS_DEFINED_LINE) return <span class={styles.aliasTag}>defines total</span>;
      if (ALIAS_VISIBLE_LINES.has(i)) return <span class={styles.aliasTag}>can use total</span>;
      if (at < selectStep && isFirstLineOfStage(i))
        return <span class={styles.aliasTagMuted}>runs before it exists</span>;
      return null;
    }
    return stagesStartingAt(i).map((n) => (
      <span key={n} class={cx(styles.badge, n === step && styles.badgeCurrent)}>
        {n + 1}
      </span>
    ));
  };

  const rows = step === 2 && showGroupRows && data.before ? data.before : data.rows;
  const columns = step === 2 && showGroupRows ? ROW_COLUMNS : data.columns;

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <Segmented
          label="View"
          value={aliasMode ? 'alias' : 'order'}
          onChange={(v) => setAliasMode(v === 'alias')}
          options={[
            { value: 'order', label: 'step through it' },
            { value: 'alias', label: 'where can I use total?' },
          ]}
        />
        <span class={shared.note}>written top to bottom; the badges are the order it runs in</span>
      </div>

      <SqlCode
        code={QUERY}
        lineClass={lineClass}
        lineSuffix={lineSuffix}
        onLineClick={(i) => !aliasMode && stepOfLine(i) >= 0 && go(stepOfLine(i))}
      />

      {aliasMode ? (
        <p class={shared.caption}>
          An alias is born in SELECT. Everything that runs earlier (FROM, WHERE, GROUP BY, HAVING) has never heard of
          it, so referencing <code>total</code> there fails with <code>column "total" does not exist</code>. ORDER BY
          runs later and can use it. Postgres also lets GROUP BY name an output column as a convenience, but you can't
          group by an aggregate anyway.
        </p>
      ) : (
        <>
          <ol class={styles.stages} aria-label="Logical execution order">
            {STAGES.map((s, i) => (
              <li key={s.name}>
                <button
                  type="button"
                  class={cx(
                    styles.stage,
                    i === step && styles.stageCurrent,
                    i < step && styles.stageDone,
                    s.lines.length === 0 && styles.stageUnused,
                  )}
                  onClick={() => go(i)}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <span class={styles.stageNum}>{i + 1}</span>
                  {s.name}
                </button>
              </li>
            ))}
          </ol>

          <p class={shared.caption} key={step}>
            {renderCaption(stage.caption)}
          </p>

          <div class={shared.toolbar}>
            <button type="button" class={shared.button} onClick={() => go(step - 1)} disabled={step === 0}>
              ← back
            </button>
            <button
              type="button"
              class={shared.button}
              onClick={() => go(step + 1)}
              disabled={step === STAGES.length - 1}
            >
              next →
            </button>
            {step === 2 && (
              <button
                type="button"
                class={shared.button}
                aria-pressed={showGroupRows}
                onClick={() => setShowGroupRows((v) => !v)}
              >
                {showGroupRows ? 'collapse into groups' : 'show the rows inside each group'}
              </button>
            )}
            <span class={styles.spacer} />
            <RowCount n={showGroupRows ? rows.length : data.count} label={showGroupRows ? 'rows' : data.unit} />
          </div>

          <ResultTable columns={columns} rows={rows} />
        </>
      )}
    </figure>
  );
}

/** Captions use `backticks` for inline code, like the prose around them. */
function renderCaption(text: string) {
  return text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}
