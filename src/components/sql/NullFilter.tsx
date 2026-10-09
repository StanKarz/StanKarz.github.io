import { useState } from 'preact/hooks';
import { members, fullName } from '../../data/sql/countryclub';
import { NULL_CONDITIONS } from '../../lib/sql/demos';
import { Cell, RowCount, SqlCode, TruthPill, cx, shared } from './shared/primitives';
import styles from './NullFilter.module.css';

const CAPTIONS = [
  'Two members were recommended by 1. The five with no recommender give UNKNOWN, not FALSE, but WHERE drops them all the same.',
  'Only Nancy. The flip side of = 1 should be everyone else, yet the five NULLs are still UNKNOWN and still dropped.',
  'Reads like it must be every row: equal to 1, or not equal to 1. For a NULL both sides are UNKNOWN, and UNKNOWN OR UNKNOWN is UNKNOWN.',
  'NOT doesn’t rescue it either. NOT UNKNOWN is still UNKNOWN.',
  'IS NULL is the one test that answers TRUE or FALSE for a NULL, never UNKNOWN. That is why you use it instead of = NULL.',
];

export default function NullFilter() {
  const [index, setIndex] = useState(2);
  const cond = NULL_CONDITIONS[index];

  const rows = members.map((m) => {
    const parts = cond.parts.map((p) => p.test(m.recommendedby));
    return { m, parts, result: cond.combine(parts) };
  });
  const kept = rows.filter((r) => r.result === 'TRUE').length;
  const showParts = cond.parts.length > 1 || cond.sql.startsWith('not');

  return (
    <figure class={shared.figure}>
      <div class={styles.picker} role="radiogroup" aria-label="WHERE condition">
        {NULL_CONDITIONS.map((c, i) => (
          <button
            key={c.sql}
            type="button"
            role="radio"
            aria-checked={i === index}
            class={cx(styles.option, i === index && styles.optionOn)}
            onClick={() => setIndex(i)}
          >
            {c.sql}
          </button>
        ))}
      </div>

      <SqlCode code={`select firstname, surname, recommendedby\nfrom cd.members\nwhere ${cond.sql};`} />

      <table class={cx(shared.table, styles.grid)}>
        <thead>
          <tr>
            <th>member</th>
            <th class={shared.right}>recommendedby</th>
            {showParts && cond.parts.map((p) => <th key={p.sql}>{p.sql}</th>)}
            <th>WHERE sees</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, parts, result }) => (
            <tr key={m.memid} class={cx(result !== 'TRUE' && styles.dropped)}>
              <td>{fullName(m)}</td>
              <td class={shared.right}>
                <Cell value={m.recommendedby} />
              </td>
              {showParts &&
                parts.map((t, i) => (
                  <td key={i}>
                    <TruthPill value={t} />
                  </td>
                ))}
              <td>
                <TruthPill key={index} value={result} pop />
              </td>
              <td class={styles.verdict}>{result === 'TRUE' ? 'kept' : 'dropped'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div class={shared.toolbar}>
        <RowCount n={kept} label={`of ${members.length} kept`} />
        <span class={styles.caption}>{CAPTIONS[index]}</span>
      </div>
    </figure>
  );
}
