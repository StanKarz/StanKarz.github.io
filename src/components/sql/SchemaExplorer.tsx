import { useState } from 'preact/hooks';
import { bookings, facilities, members, memberById, facilityById, fullName } from '../../data/sql/countryclub';
import { Cell, cx, shared, type Value } from './shared/primitives';
import styles from './SchemaExplorer.module.css';

type TableName = 'members' | 'facilities' | 'bookings';
interface Pick {
  table: TableName;
  id: number;
}

interface ColumnDef {
  key: string;
  label: string;
  /** PK, or the table an FK points at. */
  role?: 'pk' | TableName;
  align?: 'right';
}

const COLUMNS: Record<TableName, ColumnDef[]> = {
  members: [
    { key: 'memid', label: 'memid', role: 'pk', align: 'right' },
    { key: 'firstname', label: 'firstname' },
    { key: 'surname', label: 'surname' },
    { key: 'recommendedby', label: 'recommendedby', role: 'members', align: 'right' },
  ],
  facilities: [
    { key: 'facid', label: 'facid', role: 'pk', align: 'right' },
    { key: 'name', label: 'name' },
    { key: 'membercost', label: 'membercost', align: 'right' },
    { key: 'guestcost', label: 'guestcost', align: 'right' },
  ],
  bookings: [
    { key: 'bookid', label: 'bookid', role: 'pk', align: 'right' },
    { key: 'memid', label: 'memid', role: 'members', align: 'right' },
    { key: 'facid', label: 'facid', role: 'facilities', align: 'right' },
    { key: 'starttime', label: 'starttime' },
    { key: 'slots', label: 'slots', align: 'right' },
  ],
};

const ROWS: Record<TableName, { id: number; cells: Record<string, Value> }[]> = {
  members: members.map((m) => ({ id: m.memid, cells: { ...m } })),
  facilities: facilities.map((f) => ({ id: f.facid, cells: { ...f } })),
  bookings: bookings.map((b) => ({ id: b.bookid, cells: { ...b } })),
};

const NOTES: Record<TableName, string> = {
  members: 'memid 0 is the guest account',
  facilities: 'costs are per half-hour slot',
  bookings: 'slots are half-hours',
};

/** Everything connected to the picked row, as (table, id) keys, plus the FK cells that do the connecting. */
function related(p: Pick) {
  const rows = new Set<string>();
  const cells = new Set<string>();
  const add = (t: TableName, id: number) => rows.add(`${t}:${id}`);
  if (p.table === 'bookings') {
    const b = bookings.find((x) => x.bookid === p.id)!;
    add('members', b.memid);
    add('facilities', b.facid);
    cells.add(`bookings:${b.bookid}:memid`).add(`bookings:${b.bookid}:facid`);
    cells.add(`members:${b.memid}:memid`).add(`facilities:${b.facid}:facid`);
  } else if (p.table === 'members') {
    const m = memberById.get(p.id)!;
    bookings.filter((b) => b.memid === m.memid).forEach((b) => {
      add('bookings', b.bookid);
      cells.add(`bookings:${b.bookid}:memid`);
    });
    cells.add(`members:${m.memid}:memid`);
    if (m.recommendedby !== null) {
      add('members', m.recommendedby);
      cells.add(`members:${m.memid}:recommendedby`).add(`members:${m.recommendedby}:memid`);
    }
  } else {
    bookings.filter((b) => b.facid === p.id).forEach((b) => {
      add('bookings', b.bookid);
      cells.add(`bookings:${b.bookid}:facid`);
    });
    cells.add(`facilities:${p.id}:facid`);
  }
  return { rows, cells };
}

function describe(p: Pick) {
  if (p.table === 'bookings') {
    const b = bookings.find((x) => x.bookid === p.id)!;
    return (
      <>
        Booking {b.bookid}: <code>memid {b.memid}</code> → {fullName(memberById.get(b.memid)!)},{' '}
        <code>facid {b.facid}</code> → {facilityById.get(b.facid)!.name}. Each booking has exactly one of each.
      </>
    );
  }
  if (p.table === 'members') {
    const m = memberById.get(p.id)!;
    const n = bookings.filter((b) => b.memid === m.memid).length;
    const namesake = members.find((o) => o !== m && fullName(o) === fullName(m));
    const rec = m.recommendedby === null ? null : memberById.get(m.recommendedby)!;
    return (
      <>
        {fullName(m)} ({m.memid}) has {n} booking{n === 1 ? '' : 's'}: one member, many bookings.{' '}
        {rec ? (
          <>
            <code>recommendedby {rec.memid}</code> points back into members, at {fullName(rec)}.
          </>
        ) : (
          <>
            <code>recommendedby</code> is NULL: nobody recommended them.
          </>
        )}
        {namesake && (
          <>
            {' '}
            There is another {fullName(m)}, memid {namesake.memid}. Only the key tells them apart.
          </>
        )}
      </>
    );
  }
  const f = facilityById.get(p.id)!;
  const n = bookings.filter((b) => b.facid === f.facid).length;
  return (
    <>
      {f.name} ({f.facid}) appears in {n} booking{n === 1 ? '' : 's'}. Members and facilities never point at each
      other: bookings links them, which is how a many-to-many relationship is stored.
    </>
  );
}

export default function SchemaExplorer() {
  const [picked, setPicked] = useState<Pick>({ table: 'bookings', id: 3 });
  const [hover, setHover] = useState<Pick | null>(null);
  const active = hover ?? picked;
  const rel = related(active);

  const table = (name: TableName) => (
    <div class={cx(styles.block, styles[name])}>
      <div class={styles.head}>
        <span class={shared.label}>cd.{name}</span>
        <span class={styles.note}>{NOTES[name]}</span>
      </div>
      <div class={shared.tableWrap}>
        <table class={cx(shared.table, styles.table)}>
          <thead>
            <tr>
              {COLUMNS[name].map((c) => (
                <th key={c.key} class={c.align === 'right' ? shared.right : undefined}>
                  {c.label}
                  {c.role && (
                    <span
                      class={cx(styles.role, c.role === 'pk' ? styles.pk : styles.fk)}
                      title={c.role === 'pk' ? 'primary key' : `foreign key to ${c.role}`}
                    >
                      {c.role === 'pk' ? 'PK' : 'FK'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS[name].map((r) => {
              const isPicked = active.table === name && active.id === r.id;
              const isRelated = rel.rows.has(`${name}:${r.id}`);
              return (
                <tr
                  key={r.id}
                  class={cx(styles.row, isPicked && styles.picked, isRelated && styles.related)}
                  onMouseEnter={() => setHover({ table: name, id: r.id })}
                  onClick={() => setPicked({ table: name, id: r.id })}
                >
                  {COLUMNS[name].map((c) => (
                    <td
                      key={c.key}
                      class={cx(
                        c.align === 'right' && shared.right,
                        rel.cells.has(`${name}:${r.id}:${c.key}`) && styles.link,
                      )}
                    >
                      <Cell value={r.cells[c.key]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <figure class={shared.figure}>
      <div class={styles.layout} onMouseLeave={() => setHover(null)}>
        {table('members')}
        {table('bookings')}
        {table('facilities')}
      </div>
      <p class={shared.caption} aria-live="polite">
        {describe(active)}
      </p>
      <p class={shared.note}>Hover or tap any row. Highlighted cells are the keys that connect it.</p>
    </figure>
  );
}
