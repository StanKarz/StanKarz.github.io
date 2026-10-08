import { useEffect, useRef, useState } from 'preact/hooks';
import type { PGlite } from '@electric-sql/pglite';
import { TRY_EVENT } from '../../lib/sql/try';
import { ResultTable, cx, shared, type Column, type Row, type Value } from './shared/primitives';
import styles from './QueryDrawer.module.css';

type Status = 'idle' | 'loading' | 'ready' | 'running';

type Outcome =
  | { kind: 'rows'; columns: Column[]; rows: Row[]; total: number; ms: number }
  | { kind: 'done'; message: string; ms: number }
  | { kind: 'error'; message: string };

const ROW_LIMIT = 200;
const STARTER = `select firstname, surname
from cd.members
order by memid;`;

// Timestamps and dates come back as the text Postgres prints, not as JS Dates in the viewer's time zone.
const AS_TEXT = (s: string) => s;
const TEXT_TYPES = { 1082: AS_TEXT, 1114: AS_TEXT, 1184: AS_TEXT };

/**
 * Postgres in the browser (PGlite), seeded with the same country club data as
 * the rest of the page. Nothing is downloaded until the first query: the wasm
 * build is about 5 MB gzipped, so the page itself stays light.
 */
async function createDb(): Promise<PGlite> {
  const [{ PGlite }, { SEED_SQL }] = await Promise.all([import('@electric-sql/pglite'), import('../../lib/sql/seed')]);
  const db = new PGlite({ parsers: TEXT_TYPES });
  await db.exec(SEED_SQL);
  return db;
}

const display = (v: unknown): Value =>
  v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'string' ? v : JSON.stringify(v);

export default function QueryDrawer() {
  const [open, setOpen] = useState(false);
  const [sql, setSql] = useState(STARTER);
  const [status, setStatus] = useState<Status>('idle');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const db = useRef<Promise<PGlite> | null>(null);
  const started = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  const getDb = () => {
    if (!db.current) {
      setStatus('loading');
      db.current = createDb();
      db.current.then(() => (started.current = true));
      db.current.then(
        () => setStatus('ready'),
        (e) => {
          db.current = null;
          setStatus('idle');
          setOutcome({
            kind: 'error',
            message: `Couldn't start Postgres: ${(e as Error).message}`,
          });
        },
      );
    }
    return db.current;
  };

  const run = async (text: string) => {
    const started = performance.now();
    try {
      const pg = await getDb();
      setStatus('running');
      // Arrays, not objects: `select *` over a join has two columns called memid.
      const results = await pg.exec(text, { rowMode: 'array' });
      const last = results[results.length - 1];
      const ms = Math.round(performance.now() - started);
      if (!last || last.fields.length === 0) {
        setOutcome({
          kind: 'done',
          message: last?.affectedRows !== undefined ? `${last.affectedRows} row(s) affected` : 'done',
          ms,
        });
      } else {
        const columns: Column[] = last.fields.map((f, i) => ({
          key: String(i),
          label: f.name,
        }));
        const rows: Row[] = last.rows.slice(0, ROW_LIMIT).map((r, n) => ({
          key: String(n),
          cells: Object.fromEntries((r as unknown[]).map((v, i) => [String(i), display(v)])),
        }));
        setOutcome({
          kind: 'rows',
          columns,
          rows,
          total: last.rows.length,
          ms,
        });
      }
    } catch (e) {
      setOutcome({ kind: 'error', message: (e as Error).message });
    } finally {
      if (db.current) setStatus('ready');
    }
  };

  const reset = async () => {
    const old = db.current;
    db.current = null;
    setOutcome(null);
    (await old)?.close();
    await getDb();
  };

  useEffect(() => {
    const onTry = (e: Event) => {
      const text = (e as CustomEvent<string>).detail ?? STARTER;
      setSql(text);
      setOpen(true);
      void run(text);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener(TRY_EVENT, onTry);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(TRY_EVENT, onTry);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (open) editor.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  return (
    <aside class={styles.drawer} aria-label="Query box">
      <div class={styles.inner}>
        <div class={styles.head}>
          <span class={shared.label}>query box</span>
          <span class={styles.status}>
            {status === 'loading'
              ? started.current
                ? 'restarting Postgres with fresh data…'
                : 'starting Postgres (the first run downloads about 5 MB)…'
              : status === 'running'
                ? 'running…'
                : status === 'ready'
                  ? 'Postgres 18 in your browser, same data as the page'
                  : ''}
          </span>
          <button type="button" class={styles.close} onClick={() => setOpen(false)} aria-label="Close query box">
            ×
          </button>
        </div>

        <textarea
          ref={editor}
          class={styles.editor}
          value={sql}
          onInput={(e) => setSql((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run(sql);
            }
          }}
          spellcheck={false}
          rows={Math.min(10, Math.max(3, sql.split('\n').length))}
          aria-label="SQL"
        />

        <div class={shared.toolbar}>
          <button
            type="button"
            class={cx(shared.button, styles.run)}
            onClick={() => run(sql)}
            disabled={status === 'loading' || status === 'running'}
          >
            run ⌘↵
          </button>
          <button type="button" class={shared.button} onClick={reset} disabled={status === 'loading'}>
            reset data
          </button>
          {outcome && outcome.kind !== 'error' && (
            <span class={styles.meta}>
              {outcome.kind === 'rows'
                ? `${outcome.total} row${outcome.total === 1 ? '' : 's'}${outcome.total > ROW_LIMIT ? `, first ${ROW_LIMIT} shown` : ''}`
                : outcome.message}{' '}
              · {outcome.ms} ms
            </span>
          )}
        </div>

        <div class={styles.output}>
          {outcome?.kind === 'error' && <p class={styles.error}>{outcome.message}</p>}
          {outcome?.kind === 'rows' && <ResultTable columns={outcome.columns} rows={outcome.rows} stagger={10} />}
        </div>
      </div>
    </aside>
  );
}
