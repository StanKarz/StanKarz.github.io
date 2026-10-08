import { useState } from 'preact/hooks';
import { facilities } from '../../data/sql/countryclub';
import { likeRegex, tokenizeLike, type LikeOp as Op, type LikeToken as Token } from '../../lib/sql/demos';
import { RowCount, Segmented, cx, shared } from './shared/primitives';
import styles from './LikePlayground.module.css';

const PRESETS = ['%Tennis%', 'Tennis%', '%Court _', '%court%', 'Tennis Court 1'];

export default function LikePlayground() {
  const [pattern, setPattern] = useState('%Tennis%');
  const [op, setOp] = useState<Op>('like');
  const tokens = tokenizeLike(pattern);
  const re = likeRegex(tokens, op);
  const results = facilities.map((f) => ({ name: f.name, m: re.exec(f.name) as (RegExpExecArray & { indices: [number, number][] }) | null }));
  const hits = results.filter((r) => r.m).length;
  const hasWildcard = tokens.some((t) => t.kind !== 'text');

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <code class={styles.query}>
          where name{' '}
          <Segmented
            label="Operator"
            value={op}
            onChange={setOp}
            options={[
              { value: 'like', label: 'like' },
              { value: 'ilike', label: 'ilike' },
            ]}
          />{' '}
          '
          <input
            class={styles.input}
            value={pattern}
            onInput={(e) => setPattern((e.target as HTMLInputElement).value)}
            spellcheck={false}
            aria-label="LIKE pattern"
            size={Math.max(8, pattern.length + 1)}
          />
          '
        </code>
      </div>

      <div class={styles.tokens} aria-hidden="true">
        {tokens.map((t, i) => (
          <span key={i} class={cx(styles.token, styles[t.kind])}>
            {t.kind === 'any' ? '% any run, even empty' : t.kind === 'one' ? '_ exactly one' : t.text}
          </span>
        ))}
      </div>

      <ul class={styles.names}>
        {results.map(({ name, m }) => (
          <li key={name} class={cx(styles.name, m ? styles.hit : styles.miss)}>
            <span class={styles.mark}>{m ? '✓' : '·'}</span>
            <span>{m ? paint(name, tokens, m.indices) : name}</span>
          </li>
        ))}
      </ul>

      <div class={shared.toolbar}>
        <RowCount n={hits} label={`of ${facilities.length} facilities`} />
        <span class={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p} type="button" class={shared.button} onClick={() => setPattern(p)}>
              {p}
            </button>
          ))}
        </span>
      </div>

      <p class={shared.caption}>
        {!hasWildcard
          ? 'No % or _, so this is an exact match, the same as =. To match exact values, IN says so more plainly.'
          : op === 'like' && /[a-z]/.test(pattern) && hits === 0
            ? 'LIKE is case-sensitive. Try ilike.'
            : 'The whole name has to match the pattern, which is why a word in the middle needs % on both sides.'}
      </p>
    </figure>
  );
}

/** Colour each character by the token that matched it. */
function paint(name: string, tokens: Token[], indices: [number, number][]) {
  return tokens.map((t, i) => {
    const [start, end] = indices[i + 1] ?? [0, 0];
    const text = name.slice(start, end);
    if (!text) return null;
    return (
      <span key={i} class={styles[t.kind]}>
        {text}
      </span>
    );
  });
}
