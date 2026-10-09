import { useState } from 'preact/hooks';
import { bookings, members, type Booking, type Member } from '../../data/sql/countryclub';
import { join, type JoinType, type JoinedRow } from '../../lib/sql/engine';
import { ResultTable, cx, shared, type Column, type Row } from './shared/primitives';
import styles from './JoinQuiz.module.css';

const TYPES: JoinType[] = ['inner', 'left', 'right', 'full', 'cross'];

/** Pools to draw small tables from. Leaving member 5 out of the members pool lets booking 7 be an orphan. */
const MEMBER_POOL = members.filter((m) => [1, 2, 3, 4, 37].includes(m.memid));
const BOOKING_POOL = bookings.filter((b) => b.memid !== 0);

interface Question {
  left: Member[];
  right: Booking[];
  answer: JoinType;
  result: JoinedRow<Member, Booking>[];
}

const run = (left: Member[], right: Booking[], type: JoinType) =>
  join(
    left,
    right,
    type,
    (m, b) => b.memid === m.memid,
    (m) => String(m.memid),
    (b) => String(b.bookid),
  );

const signature = (rows: JoinedRow<Member, Booking>[]) =>
  rows
    .map((r) => r.key)
    .sort()
    .join(',');

/** Only ask questions with exactly one right answer. */
function isFair(left: Member[], right: Booking[], answer: JoinType) {
  const target = signature(run(left, right, answer));
  return TYPES.every((t) => t === answer || signature(run(left, right, t)) !== target);
}

// A small deterministic generator, so the first question is the same on the server and in the browser.
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}

function pick<T>(pool: T[], n: number, rand: () => number): T[] {
  const copy = [...pool];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

function makeQuestion(seed: number, previous?: JoinType): Question {
  const rand = rng(seed);
  for (;;) {
    const answer = TYPES[Math.floor(rand() * TYPES.length)];
    if (answer === previous) continue;
    const left = pick(MEMBER_POOL, 3, rand).sort((a, b) => a.memid - b.memid);
    const right = pick(BOOKING_POOL, 3, rand).sort((a, b) => a.bookid - b.bookid);
    if (!isFair(left, right, answer)) continue;
    return { left, right, answer, result: run(left, right, answer) };
  }
}

const RESULT_COLUMNS: Column[] = [
  { key: 'mmemid', label: 'mems.memid', align: 'right' },
  { key: 'firstname', label: 'firstname' },
  { key: 'bookid', label: 'bks.bookid', align: 'right' },
  { key: 'bmemid', label: 'bks.memid', align: 'right' },
];

/** Reads the answer off the result, the way you would by eye. */
function explain(q: Question): string {
  const nullRight = q.result.some((r) => r.right === null);
  const nullLeft = q.result.some((r) => r.left === null);
  const n = q.result.length;
  switch (q.answer) {
    case 'cross':
      return `${q.left.length} × ${q.right.length} = ${n} rows, including pairs whose memids don't match. Only a cross join pairs everything.`;
    case 'full':
      return 'NULLs on both sides: a member with no booking and a booking with no member here both survived. That is FULL.';
    case 'left':
      return `A member with NULL booking columns survived${nullLeft ? '' : ', and no booking without a member did'}. LEFT keeps every left row.`;
    case 'right':
      return `A booking with NULL member columns survived${nullRight ? '' : ', and no member without a booking did'}. RIGHT keeps every right row.`;
    default:
      return 'No NULLs anywhere and every row is a matching pair. Unmatched rows on both sides were dropped: INNER.';
  }
}

export default function JoinQuiz() {
  const [seed, setSeed] = useState(7);
  const [q, setQ] = useState(() => makeQuestion(7));
  const [guess, setGuess] = useState<JoinType | null>(null);
  const [score, setScore] = useState({ right: 0, asked: 0 });

  const answer = (t: JoinType) => {
    if (guess) return;
    setGuess(t);
    setScore((s) => ({ right: s.right + (t === q.answer ? 1 : 0), asked: s.asked + 1 }));
  };

  const next = () => {
    const nextSeed = seed * 31 + 17 + score.asked;
    setSeed(nextSeed);
    setQ(makeQuestion(nextSeed, q.answer));
    setGuess(null);
  };

  const rows: Row[] = q.result.map((r) => ({
    key: r.key,
    cells: {
      mmemid: r.left?.memid ?? null,
      firstname: r.left?.firstname ?? null,
      bookid: r.right?.bookid ?? null,
      bmemid: r.right?.memid ?? null,
    },
    // Tint only once answered: the colours would give the answer away.
    tone:
      guess && q.answer !== 'cross' ? (r.right === null ? 'left' : r.left === null ? 'right' : undefined) : undefined,
  }));

  return (
    <figure class={shared.figure}>
      <div class={styles.head}>
        <span class={shared.label}>Which join produced this?</span>
        <span class={styles.score}>
          {score.right}/{score.asked}
        </span>
      </div>

      <div class={styles.board}>
        <div>
          <div class={styles.sources}>
            <MiniTable name="mems" columns={['memid', 'firstname']} rows={q.left.map((m) => [m.memid, m.firstname])} />
            <MiniTable name="bks" columns={['bookid', 'memid']} rows={q.right.map((b) => [b.bookid, b.memid])} />
          </div>
          <p class={styles.on}>
            <code>… join bks on bks.memid = mems.memid</code>
          </p>
        </div>
        <span class={styles.arrow} aria-hidden="true">
          →
        </span>
        <div>
          <span class={shared.label}>result</span>
          <ResultTable key={signature(q.result)} columns={RESULT_COLUMNS} rows={rows} stagger={40} />
        </div>
      </div>

      <div class={styles.choices} role="group" aria-label="Join type">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            class={cx(
              styles.choice,
              guess && t === q.answer && styles.correct,
              guess === t && t !== q.answer && styles.wrong,
            )}
            onClick={() => answer(t)}
            disabled={guess !== null && t !== guess && t !== q.answer}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <p class={shared.caption} aria-live="polite">
        {guess === null ? (
          <span class={styles.hint}>Look for NULLs, and on which side they are.</span>
        ) : (
          <>
            <strong class={guess === q.answer ? styles.yes : styles.no}>
              {guess === q.answer ? 'Right.' : `It was ${q.answer.toUpperCase()}.`}
            </strong>{' '}
            {explain(q)}
          </>
        )}
      </p>

      {guess && (
        <button type="button" class={shared.button} onClick={next}>
          another one →
        </button>
      )}
    </figure>
  );
}

function MiniTable({ name, columns, rows }: { name: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div>
      <span class={shared.label}>{name}</span>
      <table class={cx(shared.table, styles.mini)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])}>
              {r.map((v, i) => (
                <td key={i} class={typeof v === 'number' ? shared.right : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
