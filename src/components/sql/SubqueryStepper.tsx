import { useState } from 'preact/hooks';
import { members, memberById, fullName } from '../../data/sql/countryclub';
import { costedOn } from '../../lib/sql/demos';
import { ResultTable, RowCount, Segmented, SqlCode, cx, shared, type Column, type Row } from './shared/primitives';
import styles from './SubqueryStepper.module.css';

type Mode = 'correlated' | 'derived';

/* ------------------------------------------------------------- correlated */

const CORRELATED_SQL = `select mems.firstname, mems.surname,
       (select rec.firstname
        from cd.members rec
        where rec.memid = mems.recommendedby) as recommender
from cd.members mems;`;

const OUTER = members;

/* ---------------------------------------------------------------- derived */

const DAY = '2012-09-21';

const DERIVED_SQL = `select member, facility, cost
from (
    select mems.firstname as member, facs.name as facility,
           case when mems.memid = 0 then bks.slots * facs.guestcost
                else bks.slots * facs.membercost end as cost
    from cd.members mems
    join cd.bookings bks on bks.memid = mems.memid
    join cd.facilities facs on facs.facid = bks.facid
    where bks.starttime::date = '${DAY}'
) as costed
where cost > 30;`;

const COSTED = costedOn(DAY);

const DERIVED_COLUMNS: Column[] = [
  { key: 'member', label: 'member' },
  { key: 'facility', label: 'facility' },
  { key: 'cost', label: 'cost', align: 'right' },
];

export default function SubqueryStepper() {
  const [mode, setMode] = useState<Mode>('correlated');
  return (
    <figure class={shared.figure}>
      <Segmented
        label="Kind of subquery"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'correlated', label: 'correlated, in SELECT' },
          { value: 'derived', label: 'derived table, in FROM' },
        ]}
      />
      {mode === 'correlated' ? <Correlated /> : <Derived />}
    </figure>
  );
}

function Correlated() {
  const [step, setStep] = useState(4);
  const outer = OUTER[step];
  const found = outer.recommendedby === null ? null : memberById.get(outer.recommendedby)!;

  const done: Row[] = OUTER.slice(0, step + 1).map((m, i) => ({
    key: String(m.memid),
    cells: {
      name: fullName(m),
      recommender: m.recommendedby === null ? null : memberById.get(m.recommendedby)!.firstname,
    },
    state: i === step ? 'highlight' : undefined,
  }));

  return (
    <>
      <SqlCode code={CORRELATED_SQL} lineClass={(i) => (i >= 1 && i <= 3 ? styles.inner : undefined)} />
      <div class={shared.toolbar}>
        <button type="button" class={shared.button} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ← back
        </button>
        <button
          type="button"
          class={shared.button}
          onClick={() => setStep((s) => Math.min(OUTER.length - 1, s + 1))}
          disabled={step === OUTER.length - 1}
        >
          next outer row →
        </button>
        <span class={shared.note}>
          outer row {step + 1} of {OUTER.length}
        </span>
      </div>

      <div class={styles.panes}>
        <div>
          <span class={shared.label}>inner query, for mems.memid {outer.memid}</span>
          <p class={styles.probe}>
            <code>where rec.memid = {outer.recommendedby ?? 'NULL'}</code>
          </p>
          <ul class={styles.scan}>
            {members.map((m) => (
              <li key={m.memid} class={cx(styles.scanRow, found === m && styles.scanHit)}>
                <span class={styles.scanId}>{m.memid}</span> {m.firstname}
              </li>
            ))}
          </ul>
          <p class={shared.caption} key={step}>
            {found ? (
              <>
                One row matches, so the subquery returns <strong>{found.firstname}</strong>.
              </>
            ) : (
              <>
                <code>memid = NULL</code> is never true, so no row matches and the subquery returns <strong>NULL</strong>.
                No error, no special handling.
              </>
            )}
          </p>
        </div>
        <div>
          <span class={shared.label}>output so far</span>
          <ResultTable
            columns={[
              { key: 'name', label: 'member' },
              { key: 'recommender', label: 'recommender' },
            ]}
            rows={done}
            stagger={0}
          />
        </div>
      </div>
      <p class={shared.note}>
        It refers to <code>mems</code> from the outer query, so it runs once per outer row. If it ever found two rows
        it would fail: a subquery in SELECT must return one value.
      </p>
    </>
  );
}

function Derived() {
  const [outerRan, setOuterRan] = useState(false);
  const rows: Row[] = COSTED.map((c) => ({
    key: String(c.bookid),
    cells: { member: c.member, facility: c.facility, cost: c.cost },
    state: outerRan && c.cost <= 30 ? 'removed' : undefined,
  }));
  const kept = COSTED.filter((c) => c.cost > 30).length;

  return (
    <>
      <SqlCode
        code={DERIVED_SQL}
        lineClass={(i) => (i >= 2 && i <= 8 ? (outerRan ? styles.innerDone : styles.inner) : outerRan ? styles.outerOn : undefined)}
      />
      <div class={shared.toolbar}>
        <Segmented
          label="Step"
          value={outerRan ? 'outer' : 'inner'}
          onChange={(v) => setOuterRan(v === 'outer')}
          options={[
            { value: 'inner', label: '1. inner query runs' },
            { value: 'outer', label: '2. outer query reads it' },
          ]}
        />
        <RowCount n={outerRan ? kept : COSTED.length} />
      </div>
      <div class={cx(styles.box, outerRan && styles.boxRead)}>
        <span class={styles.boxLabel}>costed</span>
        <ResultTable columns={DERIVED_COLUMNS} rows={rows} stagger={outerRan ? 0 : 40} />
      </div>
      <p class={shared.caption}>
        {outerRan ? (
          <>
            The outer query treats <code>costed</code> as an ordinary table, so <code>cost</code> is just a column and{' '}
            <code>where cost &gt; 30</code> works. Both survivors are guest bookings, which pay guestcost.
          </>
        ) : (
          <>
            The inner query finishes first and its result is a table with a name. Inside it, <code>cost</code> is an
            alias, and an alias can't be filtered in the same query's WHERE.
          </>
        )}
      </p>
    </>
  );
}
