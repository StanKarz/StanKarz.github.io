import { useState } from 'preact/hooks';
import { members, fullName } from '../../data/sql/countryclub';
import { notEquals, notIn, type Truth } from '../../lib/sql/engine';
import { RowCount, Segmented, SqlCode, TruthPill, cx, shared } from './shared/primitives';
import styles from './NotInTrap.module.css';

type Mode = 'not-in' | 'filtered' | 'not-exists';

/** Distinct values of recommendedby: 1, 4 and NULL. Duplicates don't change what NOT IN does. */
const RECOMMENDERS: (number | null)[] = [...new Set(members.map((m) => m.recommendedby))].sort(
  (a, b) => (a ?? Infinity) - (b ?? Infinity),
);

const SQL: Record<Mode, string> = {
  'not-in': `select firstname, surname
from cd.members
where memid not in (select recommendedby from cd.members);`,
  filtered: `select firstname, surname
from cd.members
where memid not in (
    select recommendedby from cd.members
    where recommendedby is not null
);`,
  'not-exists': `select firstname, surname
from cd.members m
where not exists (
    select 1 from cd.members r where r.recommendedby = m.memid
);`,
};

const CAPTION: Record<Mode, string> = {
  'not-in':
    'NOT IN (1, 4, NULL) means <> 1 AND <> 4 AND <> NULL. The last column is UNKNOWN for everyone, so no row can come out TRUE: the answer should be six people and is nobody.',
  filtered:
    'Take the NULL out of the list and the third column goes. Now the six who recommended nobody come out TRUE.',
  'not-exists':
    'NOT EXISTS asks a yes/no question per member: is there any row that recommends them? A NULL never matches, so it can’t poison the answer. Use this one.',
};

export default function NotInTrap() {
  const [mode, setMode] = useState<Mode>('not-in');
  const list = mode === 'filtered' ? RECOMMENDERS.filter((v) => v !== null) : RECOMMENDERS;

  const rows = members.map((m) => {
    if (mode === 'not-exists') {
      const recommended = members.filter((r) => r.recommendedby === m.memid);
      return { m, parts: [] as Truth[], recommended, result: (recommended.length ? 'FALSE' : 'TRUE') as Truth };
    }
    return { m, parts: list.map((v) => notEquals(m.memid, v)), recommended: [], result: notIn(m.memid, list) };
  });
  const kept = rows.filter((r) => r.result === 'TRUE').length;

  return (
    <figure class={shared.figure}>
      <p class={styles.question}>Who has never recommended anyone?</p>
      <Segmented
        label="Query"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'not-in', label: 'NOT IN' },
          { value: 'filtered', label: 'NOT IN, NULLs removed' },
          { value: 'not-exists', label: 'NOT EXISTS' },
        ]}
      />
      <SqlCode code={SQL[mode]} />

      <table class={cx(shared.table, styles.grid)}>
        <thead>
          <tr>
            <th>member</th>
            {mode === 'not-exists' ? (
              <th>recommended</th>
            ) : (
              list.map((v) => (
                <th key={String(v)} class={cx(v === null && styles.nullHead)}>
                  memid &lt;&gt; {v ?? 'NULL'}
                </th>
              ))
            )}
            <th>{mode === 'not-exists' ? 'not exists' : 'all ANDed'}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, parts, recommended, result }) => (
            <tr key={m.memid} class={cx(result !== 'TRUE' && styles.dropped)}>
              <td>
                <span class={styles.id}>{m.memid}</span> {fullName(m)}
              </td>
              {mode === 'not-exists' ? (
                <td class={styles.who}>
                  {recommended.length ? recommended.map((r) => r.firstname).join(', ') : 'nobody'}
                </td>
              ) : (
                parts.map((t, i) => (
                  <td key={i}>
                    <TruthPill value={t} />
                  </td>
                ))
              )}
              <td>
                <TruthPill key={mode} value={result} pop />
              </td>
              <td class={styles.verdict}>{result === 'TRUE' ? 'kept' : 'dropped'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div class={shared.toolbar}>
        <RowCount n={kept} label={`of ${members.length} kept`} />
        <span class={styles.caption}>{CAPTION[mode]}</span>
      </div>
    </figure>
  );
}
