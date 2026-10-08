import { useState } from 'preact/hooks';
import { bookings, members } from '../../data/sql/countryclub';
import { groupBy, join, sum } from '../../lib/sql/engine';
import { ResultTable, SqlCode, shared, type Column, type Row } from './shared/primitives';

const joined = join(
  members.filter((m) => m.memid !== 0),
  bookings,
  'left',
  (m, b) => b.memid === m.memid,
  (m) => String(m.memid),
  (b) => String(b.bookid),
);
const totals = groupBy(joined, (r) => String(r.left!.memid)).map((g) => ({
  member: g.rows[0].left!,
  total: sum(g.rows.map((r) => r.right?.slots ?? null)),
}));

const COLUMNS: Column[] = [
  { key: 'memid', label: 'memid', align: 'right' },
  { key: 'firstname', label: 'firstname' },
  { key: 'surname', label: 'surname' },
  { key: 'total', label: 'total', align: 'right' },
];

export default function CoalesceToggle() {
  const [fill, setFill] = useState(false);
  const expr = fill ? 'coalesce(sum(bks.slots), 0)' : 'sum(bks.slots)';
  const rows: Row[] = totals.map(({ member, total }) => ({
    key: String(member.memid),
    cells: {
      memid: member.memid,
      firstname: member.firstname,
      surname: member.surname,
      total: total === null && fill ? 0 : total,
    },
    state: total === null ? 'highlight' : undefined,
  }));

  return (
    <figure class={shared.figure}>
      <div class={shared.toolbar}>
        <button type="button" class={shared.button} aria-pressed={fill} onClick={() => setFill((v) => !v)}>
          {fill ? 'remove coalesce' : 'wrap it in coalesce'}
        </button>
      </div>
      <SqlCode
        code={`select mems.memid, mems.firstname, mems.surname,
       ${expr} as total
from cd.members mems
left join cd.bookings bks on bks.memid = mems.memid
where mems.memid <> 0
group by mems.memid;`}
      />
      <ResultTable columns={COLUMNS} rows={rows} stagger={0} />
      <p class={shared.caption}>
        {fill ? (
          <>
            <code>coalesce(x, 0)</code> returns the first argument that isn't NULL, so the empty group reads 0.
          </>
        ) : (
          <>
            Darren 37 has no bookings. The LEFT JOIN gives him one row with NULL slots, and <code>sum</code> over nothing
            but NULLs is NULL, not 0.
          </>
        )}
      </p>
    </figure>
  );
}
