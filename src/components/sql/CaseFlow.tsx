import { useState } from 'preact/hooks';
import { facilities } from '../../data/sql/countryclub';
import { PRICE_BRANCHES, PRICE_ELSE, caseSql, evaluateCase } from '../../lib/sql/demos';
import { Cell, SqlCode, cx, shared } from './shared/primitives';
import styles from './CaseFlow.module.css';

const STEP_MS = 280;

export default function CaseFlow() {
  const [withElse, setWithElse] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(1);

  const branches = swapped ? [PRICE_BRANCHES[1], PRICE_BRANCHES[0], PRICE_BRANCHES[2]] : PRICE_BRANCHES;
  const elseLabel = withElse ? PRICE_ELSE : null;
  const row = facilities[current];
  const run = evaluateCase(row.membercost, branches, elseLabel);

  const pick = (i: number) => {
    setCurrent(i);
    setDone((d) => Math.max(d, i + 1));
  };
  // Changing the CASE restarts the walk so the effect shows row by row.
  const restart = (fn: () => void) => {
    fn();
    setCurrent(0);
    setDone(1);
  };

  const stateOf = (i: number) => (i >= run.tested ? 'skipped' : i === run.hit ? 'true' : 'false');
  // Animation identity: replay whenever the row or the CASE changes.
  const k = `${current}-${withElse}-${swapped}`;

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <button
          type="button"
          class={shared.button}
          aria-pressed={withElse}
          onClick={() => restart(() => setWithElse((v) => !v))}
        >
          {withElse ? 'remove the else' : `add else '${PRICE_ELSE}'`}
        </button>
        <button
          type="button"
          class={shared.button}
          aria-pressed={swapped}
          onClick={() => restart(() => setSwapped((v) => !v))}
        >
          {swapped ? 'put the WHENs back' : 'swap the first two WHENs'}
        </button>
      </div>

      <SqlCode code={caseSql(branches, elseLabel)} />

      <div class={styles.flow}>
        <div class={styles.output}>
          <span class={shared.label}>cd.facilities · membercost</span>
          <ol class={styles.rows} aria-label="cd.facilities">
            {facilities.map((f, i) => (
              <li key={f.facid}>
                <button
                  type="button"
                  class={cx(
                    styles.row,
                    i === current && styles.rowCurrent,
                    i < done && i !== current && styles.rowDone,
                  )}
                  onClick={() => pick(i)}
                >
                  <span>{f.name}</span>
                  <span class={styles.cost}>{f.membercost}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div class={styles.output}>
          <span class={shared.label}>case, for {row.name}</span>
          <ol class={styles.gates} key={k}>
            {branches.map((b, i) => {
              const s = stateOf(i);
              return (
                <li key={b.label} class={cx(styles.gate, styles[s])} style={{ animationDelay: `${i * STEP_MS}ms` }}>
                  <code>when {b.sql.replace('membercost', String(row.membercost))}</code>
                  <span class={styles.verdict}>
                    {s === 'true' ? `TRUE → '${b.label}'` : s === 'false' ? 'false' : 'not checked'}
                  </span>
                </li>
              );
            })}
            <li
              class={cx(styles.gate, run.hit === null ? styles.true : styles.skipped)}
              style={{ animationDelay: `${branches.length * STEP_MS}ms` }}
            >
              <code>{elseLabel ? `else '${elseLabel}'` : 'no else'}</code>
              <span class={styles.verdict}>
                {run.hit !== null ? 'not reached' : elseLabel ? `→ '${elseLabel}'` : '→ NULL'}
              </span>
            </li>
          </ol>
        </div>

        <div class={styles.output}>
          <span class={shared.label}>price_band</span>
          <ul class={styles.results}>
            {facilities.slice(0, done).map((f, i) => {
              const v = evaluateCase(f.membercost, branches, elseLabel).value;
              return (
                <li
                  key={`${f.facid}-${withElse}-${swapped}`}
                  class={cx(styles.result, i === current && styles.resultCurrent)}
                  style={i === current ? { animationDelay: `${run.tested * STEP_MS}ms` } : undefined}
                >
                  <Cell value={v} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div class={shared.toolbar}>
        <button
          type="button"
          class={shared.button}
          onClick={() => pick(Math.min(current + 1, facilities.length - 1))}
          disabled={current === facilities.length - 1}
        >
          next row →
        </button>
        <button type="button" class={shared.button} onClick={() => pick(facilities.length - 1)}>
          run every row
        </button>
      </div>

      <p class={shared.caption}>
        {run.hit !== null && run.hit > 0
          ? `${row.name}: ${run.hit} branch${run.hit === 1 ? '' : 'es'} came out false before one matched. Branches run top to bottom and the first TRUE wins.`
          : run.hit === 0
            ? swapped && row.membercost === 0
              ? `${row.name} costs 0, which is also < 10. The cheap branch now comes first, so free facilities are never labelled free.`
              : `${row.name} matched the first branch; the rest are never checked.`
            : elseLabel
              ? `Nothing matched ${row.name}, so ELSE supplies the value.`
              : `Nothing matched ${row.name} and there is no ELSE, so the value is NULL. No error.`}
      </p>
    </figure>
  );
}
