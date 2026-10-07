import { useState } from 'preact/hooks';
import { members, fullName, type Member } from '../../data/sql/countryclub';
import { notEquals, notIn, type Truth } from '../../lib/sql/engine';
import { RowCount, Segmented, SqlCode, cx, shared } from './shared/primitives';
import styles from './NotInTrap.module.css';

type Mode = 'not-in' | 'not-exists';

/** Distinct values of recommendedby. Duplicates don't change what NOT IN does. */
const RECOMMENDERS: (number | null)[] = [...new Set(members.map((m) => m.recommendedby))].sort(
  (a, b) => (a ?? Infinity) - (b ?? Infinity),
);

function sql(mode: Mode, dropNulls: boolean): string {
  if (mode === 'not-exists')
    return `-- who has never recommended anyone?
select firstname, surname
from cd.members m
where not exists (
    select 1 from cd.members r
    where r.recommendedby = m.memid
);`;
  return `-- who has never recommended anyone?
select firstname, surname
from cd.members
where memid not in (
    select recommendedby from cd.members${dropNulls ? '\n    where recommendedby is not null' : ''}
);`;
}

/** NOT EXISTS asks "is there a row where r.recommendedby = m.memid is TRUE?". UNKNOWN is not TRUE. */
function notExists(memid: number, list: (number | null)[]): Truth {
  return list.some((v) => v !== null && v === memid) ? 'FALSE' : 'TRUE';
}

export default function NotInTrap() {
  const [mode, setMode] = useState<Mode>('not-in');
  const [dropNulls, setDropNulls] = useState(false);
  const [selected, setSelected] = useState<number>(37);

  const list = mode === 'not-in' && dropNulls ? RECOMMENDERS.filter((v) => v !== null) : RECOMMENDERS;
  const hasNull = list.includes(null);
  const verdict = (m: Member) => (mode === 'not-in' ? notIn(m.memid, list) : notExists(m.memid, list));
  const kept = members.filter((m) => verdict(m) === 'TRUE');
  const chosen = members.find((m) => m.memid === selected)!;

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <Segmented
          label="Filter"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'not-in', label: 'NOT IN' },
            { value: 'not-exists', label: 'NOT EXISTS' },
          ]}
        />
        {mode === 'not-in' && (
          <button type="button" class={shared.button} aria-pressed={dropNulls} onClick={() => setDropNulls((v) => !v)}>
            {dropNulls ? 'let the NULLs back in' : 'filter NULLs out of the subquery'}
          </button>
        )}
      </div>

      <SqlCode code={sql(mode, dropNulls)} />

      <div>
        <span class={shared.label}>
          {mode === 'not-in' ? 'distinct values the subquery returns' : 'recommendedby values it searches'}
        </span>
        <div class={styles.chips}>
          {list.map((v, i) => (
            <span
              key={v ?? 'null'}
              class={cx(styles.chip, v === null && styles.chipNull)}
              style={{ animationDelay: `${i * 20}ms` }}
            >
              {v ?? 'NULL'}
            </span>
          ))}
        </div>
      </div>

      <div class={styles.members}>
        {members.map((m) => {
          const v = verdict(m);
          return (
            <button
              key={m.memid}
              type="button"
              class={cx(styles.member, selected === m.memid && styles.memberSelected, v !== 'TRUE' && styles.memberOut)}
              onClick={() => setSelected(m.memid)}
              onMouseEnter={() => setSelected(m.memid)}
            >
              <span class={styles.memberName}>
                {m.memid} · {fullName(m)}
              </span>
              <span key={`${mode}-${dropNulls}`} class={cx(styles.truth, styles[v])}>
                {v}
              </span>
            </button>
          );
        })}
      </div>

      <p class={shared.caption} aria-live="polite">
        {mode === 'not-in' ? (
          <Expansion member={chosen} list={list} />
        ) : (
          <>
            For <strong>{fullName(chosen)}</strong> ({chosen.memid}): is there a member whose{' '}
            <code>recommendedby = {chosen.memid}</code> is TRUE?{' '}
            {notExists(chosen.memid, list) === 'FALSE' ? (
              <>Yes, so NOT EXISTS is FALSE and the row goes.</>
            ) : (
              <>
                No
                {hasNull && (
                  <>
                    . The NULLs give <code>NULL = {chosen.memid}</code>, which is UNKNOWN, and UNKNOWN is not a match
                  </>
                )}
                , so NOT EXISTS is TRUE and the row stays.
              </>
            )}
          </>
        )}
      </p>

      <div class={shared.toolbar}>
        <span class={shared.label}>result</span>
        <RowCount n={kept.length} />
        <span class={styles.result}>{kept.length ? kept.map(fullName).join(', ') : 'nothing at all'}</span>
      </div>
    </figure>
  );
}

function Expansion({ member, list }: { member: Member; list: (number | null)[] }) {
  const parts = list.map((v) => ({ v, t: notEquals(member.memid, v) }));
  const result = notIn(member.memid, list);
  return (
    <>
      <code>{member.memid} not in (…)</code> expands to{' '}
      {parts.map(({ v, t }, i) => (
        <span key={i}>
          {i > 0 && <span class={styles.and}> and </span>}
          <span class={cx(styles.term, styles[t])} title={t}>
            {member.memid} &lt;&gt; {v ?? 'NULL'}
          </span>
        </span>
      ))}{' '}
      = <strong class={styles[result]}>{result}</strong>.{' '}
      {result === 'UNKNOWN'
        ? 'WHERE keeps only TRUE, so this row is dropped too. With a NULL in the list, no row can ever come out TRUE.'
        : result === 'FALSE'
          ? 'One comparison is FALSE, so the row goes. That part is working as intended.'
          : 'Every comparison is TRUE, so the row stays.'}
    </>
  );
}
