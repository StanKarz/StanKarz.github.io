/**
 * Every common mistake on the page, in one place. Each section renders its own
 * slice with <Mistakes section="..." />, and the symptom index groups all of
 * them by what you actually see when it goes wrong.
 *
 * Error messages are verbatim from Postgres 18 (via PGlite) against the trimmed dataset.
 */

export type Symptom = 'error' | 'no-rows' | 'extra-rows' | 'wrong-rows' | 'wrong-numbers';

export interface SymptomInfo {
  title: string;
  hint: string;
}

export const SYMPTOMS: Record<Symptom, SymptomInfo> = {
  error: {
    title: 'Postgres threw an error',
    hint: 'Read the message literally. "does not exist" usually means the clause runs before the thing you named.',
  },
  'no-rows': {
    title: 'It returned nothing, or far too little',
    hint: 'Something filtered everything out, often a NULL comparison or a join that already dropped the rows you want.',
  },
  'extra-rows': {
    title: 'Too many rows, or duplicates',
    hint: 'Count the rows before and after each join. A one-to-many join multiplies them.',
  },
  'wrong-rows': {
    title: 'It ran, but returned the wrong rows',
    hint: 'No error is not the same as correct. Check the join columns and how wide each filter casts its net.',
  },
  'wrong-numbers': {
    title: 'The numbers are off',
    hint: 'Check units, integer division, NULLs inside aggregates, and what the GROUP BY key actually is.',
  },
};

export interface Mistake {
  id: string;
  section: string;
  symptom: Symptom;
  /** What the mistake looks like, short enough to scan in the index. */
  title: string;
  wrong: string;
  /** Exact Postgres error, when there is one. */
  error?: string;
  why: string;
  /** The corrected SQL... */
  fix?: string;
  /** ...or, when the fix is a decision rather than a snippet, a sentence. */
  fixText?: string;
}

export const mistakes: Mistake[] = [
  // --- execution order ---
  {
    id: 'alias-in-where',
    section: 'execution-order',
    symptom: 'error',
    title: 'Filtering on a SELECT alias in WHERE',
    wrong: `select ..., case when bks.memid = 0 then bks.slots * facs.guestcost
                 else bks.slots * facs.membercost end as cost
from ...
where cost > 30;`,
    error: 'column "cost" does not exist',
    why: 'WHERE runs before SELECT, so the alias has not been created yet.',
    fix: `-- compute it once in a derived table, filter outside
select * from (
    select ..., case ... end as cost
    from ...
) as b
where cost > 30;`,
  },
  {
    id: 'aggregate-in-where',
    section: 'execution-order',
    symptom: 'error',
    title: 'Putting an aggregate in WHERE',
    wrong: `select memid from cd.bookings
where sum(slots) > 4
group by memid;`,
    error: 'aggregate functions are not allowed in WHERE',
    why: 'WHERE filters rows before they are grouped, so there is nothing to sum yet.',
    fix: `select memid from cd.bookings
group by memid
having sum(slots) > 4;`,
  },

  // --- joins ---
  {
    id: 'wrong-join-columns',
    section: 'joins',
    symptom: 'wrong-rows',
    title: 'Joining on two unrelated ID columns',
    wrong: `from cd.members mems
join cd.bookings bks on mems.memid = bks.facid`,
    why: 'Both columns are integers, so Postgres happily matches member 1 to facility 1. No error, just nonsense.',
    fix: `join cd.bookings bks on bks.memid = mems.memid`,
  },
  {
    id: 'inner-join-then-null',
    section: 'joins',
    symptom: 'no-rows',
    title: 'INNER JOIN, then looking for the NULLs',
    wrong: `select distinct mems.memid
from cd.members mems
inner join cd.bookings bks on bks.memid = mems.memid
where bks.slots is null;`,
    why: 'The inner join already threw away members with no bookings, so there are no NULL rows left to find.',
    fix: `select mems.memid
from cd.members mems
left join cd.bookings bks on bks.memid = mems.memid
where bks.memid is null;`,
  },
  {
    id: 'left-join-extra-row',
    section: 'joins',
    symptom: 'extra-rows',
    title: 'LEFT JOIN when the output only wants matches',
    wrong: `select mems.firstname, mems.surname,
       coalesce(sum(bks.slots), 0) as slots
from cd.members mems
left join cd.bookings bks on bks.memid = mems.memid
group by mems.memid;`,
    why: 'The second Darren Smith (memid 37) has never booked, so he comes through as a 0-slot row the question never asked for.',
    fixText:
      'Pick the join from what the output should contain. Only members with bookings: INNER JOIN, and the COALESCE goes too.',
  },
  {
    id: 'fan-out-sum',
    section: 'joins',
    symptom: 'wrong-numbers',
    title: 'Summing a column after a one-to-many join',
    wrong: `select sum(facs.monthlymaintenance)
from cd.facilities facs
join cd.bookings bks on bks.facid = facs.facid;`,
    why: 'Each facility appears once per booking, so its maintenance cost is counted once per booking.',
    fixText: 'Aggregate before joining, or sum from the table that has one row per thing you are adding up.',
  },

  // --- NULL ---
  {
    id: 'equals-null',
    section: 'null',
    symptom: 'no-rows',
    title: 'Comparing with = NULL',
    wrong: `select firstname from cd.members
where recommendedby = null;`,
    why: 'Anything compared with NULL is unknown, and WHERE only keeps rows that are true.',
    fix: `where recommendedby is null`,
  },
  {
    id: 'not-in-null',
    section: 'null',
    symptom: 'no-rows',
    title: 'NOT IN against a list that contains a NULL',
    wrong: `where memid not in (select memid from ...)  -- one NULL in here`,
    why: 'x NOT IN (1, 2, NULL) expands to x <> 1 AND x <> 2 AND x <> NULL. The last part is unknown, so no row can ever pass.',
    fix: `where not exists (
    select 1 from ... b where b.memid = m.memid
)`,
  },
  {
    id: 'pipe-concat-null',
    section: 'null',
    symptom: 'wrong-rows',
    title: 'Building a name with || when a piece can be NULL',
    wrong: `select firstname || ' ' || surname from cd.members;`,
    why: '|| returns NULL if any piece is NULL, so the whole name disappears.',
    fix: `select concat(firstname, ' ', surname) from cd.members;  -- NULL becomes ''`,
  },

  // --- filtering ---
  {
    id: 'quotes-in',
    section: 'filtering',
    symptom: 'error',
    title: 'Double quotes and IN for a substring search',
    wrong: `where "Tennis" in name`,
    error: 'syntax error at or near "name"',
    why: 'Double quotes make an identifier (a column called Tennis), and IN wants a parenthesised list of exact values. It never searches inside a string.',
    fix: `where name like '%Tennis%'`,
  },
  {
    id: 'like-too-wide',
    section: 'filtering',
    symptom: 'wrong-rows',
    title: "LIKE '%Tennis%' also matching Table Tennis",
    wrong: `where facs.name like '%Tennis%'`,
    why: 'The pattern matches any name containing Tennis, including the table tennis table.',
    fix: `where facs.name in ('Tennis Court 1', 'Tennis Court 2')`,
  },

  // --- dates ---
  {
    id: 'timestamp-equals-date',
    section: 'dates',
    symptom: 'no-rows',
    title: 'Comparing a timestamp to a bare date',
    wrong: `where starttime = '2012-09-21'`,
    why: 'The date literal means midnight, so only a booking at exactly 00:00 matches.',
    fix: `where starttime >= '2012-09-21' and starttime < '2012-09-22'`,
  },
  {
    id: 'single-colon-cast',
    section: 'dates',
    symptom: 'error',
    title: 'Casting with one colon',
    wrong: `where facs.starttime:date = '2012-09-21'`,
    error: 'syntax error at or near ":"',
    why: 'The Postgres cast is two colons. Fixing that reveals a second error: starttime lives on bookings, not facilities.',
    fix: `where bks.starttime::date = '2012-09-21'`,
  },
  {
    id: 'between-timestamps',
    section: 'dates',
    symptom: 'wrong-rows',
    title: 'BETWEEN two dates for a whole day',
    wrong: `where starttime between '2012-09-21' and '2012-09-22'`,
    why: 'BETWEEN includes both ends, so a booking at midnight on the 22nd sneaks in.',
    fix: `where starttime >= '2012-09-21' and starttime < '2012-09-22'`,
  },
  {
    id: 'greater-than-for-on',
    section: 'dates',
    symptom: 'wrong-rows',
    title: 'Using > when the question says "on that day"',
    wrong: `where starttime > '2012-09-14'`,
    why: 'That is every booking after midnight on the 14th, forever.',
    fix: `where starttime::date = '2012-09-14'`,
  },

  // --- CASE ---
  {
    id: 'if-then',
    section: 'case',
    symptom: 'error',
    title: 'Writing IF ... THEN in a query',
    wrong: `select name from cd.facilities
if monthlymaintenance > 100 then cost = 'expensive' else 'cheap'`,
    error: 'syntax error at or near "monthlymaintenance"',
    why: 'Queries have no IF statement. A conditional value is a CASE expression, and it goes in the SELECT list as a column.',
    fix: `select name,
       case when monthlymaintenance > 100 then 'expensive'
            else 'cheap' end as cost
from cd.facilities;`,
  },

  // --- UNION ---
  {
    id: 'comma-to-stack',
    section: 'union',
    symptom: 'extra-rows',
    title: 'Listing two tables in FROM to combine two lists',
    wrong: `select surname, name
from cd.members, cd.facilities;`,
    why: 'A comma in FROM is a cross join: every surname paired with every facility, 8 × 5 = 40 rows.',
    fix: `select surname from cd.members
union
select name from cd.facilities;`,
  },

  // --- GROUP BY ---
  {
    id: 'not-in-group-by',
    section: 'group-by',
    symptom: 'error',
    title: 'Selecting a column that is neither grouped nor aggregated',
    wrong: `select m.firstname, sum(b.slots)
from ... group by m.surname;`,
    error: 'column "m.firstname" must appear in the GROUP BY clause or be used in an aggregate function',
    why: 'One surname group holds several first names. Postgres will not pick one for you.',
    fixText: 'Group by the primary key (m.memid). Every other members column is then allowed.',
  },
  {
    id: 'group-by-name',
    section: 'group-by',
    symptom: 'wrong-numbers',
    title: 'Grouping by display name instead of the key',
    wrong: `group by mems.firstname, mems.surname`,
    why: 'Two different Darren Smiths collapse into one row with their totals added together.',
    fix: `group by mems.memid`,
  },
  {
    id: 'rounding-slots',
    section: 'group-by',
    symptom: 'wrong-numbers',
    title: 'Rounding slots when the question asks about hours',
    wrong: `round(sum(slots), -1)`,
    why: 'That rounds the number of half-hour slots. Convert to hours first.',
    fix: `round(sum(slots) / 2.0, -1)`,
  },
  {
    id: 'integer-division',
    section: 'group-by',
    symptom: 'wrong-numbers',
    title: 'Dividing two integers',
    wrong: `sum(slots) / 2`,
    why: 'Integer division truncates: 7 / 2 is 3.',
    fix: `sum(slots) / 2.0`,
  },

  // --- window functions ---
  {
    id: 'over-paren',
    section: 'window-functions',
    symptom: 'error',
    title: 'Leaving the OVER clause unclosed',
    wrong: `rank() over (order by sum(slots) desc as rank`,
    error: 'syntax error at or near "as"',
    why: 'The alias has to come after the closing parenthesis of OVER.',
    fix: `rank() over (order by sum(slots) desc) as rank`,
  },
  {
    id: 'window-in-where',
    section: 'window-functions',
    symptom: 'error',
    title: 'Filtering on a rank in WHERE',
    wrong: `where rank() over (order by slots desc) = 1`,
    error: 'window functions are not allowed in WHERE',
    why: 'Window functions are computed in the SELECT step, after WHERE has finished.',
    fix: `select * from (
    select ..., rank() over (order by ...) as rnk from ...
) as ranked
where rnk = 1;`,
  },

  // --- subqueries ---
  {
    id: 'scalar-many-rows',
    section: 'subqueries',
    symptom: 'error',
    title: 'A scalar subquery that finds several rows',
    wrong: `select firstname,
       (select bookid from cd.bookings b where b.memid = m.memid)
from cd.members m;`,
    error: 'more than one row returned by a subquery used as an expression',
    why: 'A subquery in the SELECT list must return one value per outer row. Darren has two bookings.',
    fixText: 'Aggregate inside it (max, count, ...), or turn it into a join.',
  },
  {
    id: 'values-subquery',
    section: 'subqueries',
    symptom: 'error',
    title: 'A bare SELECT inside VALUES',
    wrong: `values (select max(cd.facilities.facid) + 1, 'Spa', 20, 30, 100000, 800)`,
    error: 'syntax error at or near "select"',
    why: 'A subquery is one item in the VALUES list, so it needs its own parentheses and its own FROM.',
    fix: `values ((select max(facid) + 1 from cd.facilities), 'Spa', 20, 30, 100000, 800)`,
  },
  {
    id: 'ids-not-names',
    section: 'subqueries',
    symptom: 'wrong-rows',
    title: 'Showing recommendedby as a number when the question wants a name',
    wrong: `select firstname, surname, recommendedby from cd.members`,
    why: 'recommendedby is a foreign key into the same table. Turning it into a name means reading members a second time.',
    fix: `select mems.firstname, mems.surname,
       (select concat(rec.firstname, ' ', rec.surname)
        from cd.members rec
        where rec.memid = mems.recommendedby) as recommender
from cd.members mems;`,
  },

  // --- changing data ---
  {
    id: 'compound-assignment',
    section: 'changing-data',
    symptom: 'error',
    title: 'Writing *= in an UPDATE',
    wrong: `update cd.facilities
set membercost = membercost *= 0.1
where facid = 1;`,
    error: 'operator does not exist: numeric *= numeric',
    why: 'SQL has no compound assignment. And "10% more" is × 1.1; × 0.1 leaves a tenth of the price.',
    fix: `set membercost = membercost * 1.1`,
  },
  {
    id: 'update-from-self',
    section: 'changing-data',
    symptom: 'wrong-numbers',
    title: "Updating a row from its own value instead of another row's",
    wrong: `update cd.facilities
set membercost = membercost * 1.1
where name = 'Tennis Court 2';`,
    why: 'The question asked for 10% more than Tennis Court 1. It only looks right while the two courts happen to cost the same.',
    fix: `update cd.facilities f2
set membercost = f1.membercost * 1.1
from cd.facilities f1
where f1.name = 'Tennis Court 1'
  and f2.name = 'Tennis Court 2';`,
  },
  {
    id: 'forgot-where',
    section: 'changing-data',
    symptom: 'wrong-rows',
    title: 'Forgetting the WHERE on UPDATE or DELETE',
    wrong: `delete from cd.bookings;`,
    why: 'No WHERE means every row. There is no undo outside a transaction.',
    fixText: 'Write the SELECT with the same WHERE first, check its rows, then swap SELECT for DELETE.',
  },
];

export function mistakesFor(section: string): Mistake[] {
  return mistakes.filter((m) => m.section === section);
}
