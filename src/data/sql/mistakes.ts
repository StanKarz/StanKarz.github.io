/**
 * The common mistakes, at most two per section. Each section renders its own
 * slice with <Mistakes section="..." />. Mistakes an interactive already shows
 * (NOT IN with NULLs, LIKE matching Table Tennis, grouping by name, joining on
 * the wrong column) are left to the interactive.
 *
 * Error messages are verbatim from Postgres 18 (via PGlite) against the trimmed dataset.
 */

export interface Mistake {
  id: string;
  section: string;
  /** What the mistake looks like, in a few words. */
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
    id: 'inner-join-then-null',
    section: 'joins',
    title: 'INNER JOIN, then looking for the NULLs',
    wrong: `select distinct mems.memid
from cd.members mems
inner join cd.bookings bks
  on bks.memid = mems.memid
where bks.slots is null;`,
    why: 'The inner join already threw away members with no bookings, so there are no NULL rows left to find.',
    fix: `select mems.memid
from cd.members mems
left join cd.bookings bks
  on bks.memid = mems.memid
where bks.memid is null;`,
  },
  {
    id: 'fan-out-sum',
    section: 'joins',
    title: 'Summing a column after a one-to-many join',
    wrong: `select sum(facs.monthlymaintenance)
from cd.facilities facs
join cd.bookings bks
  on bks.facid = facs.facid;`,
    why: 'Each facility appears once per booking, so its maintenance cost is counted once per booking.',
    fixText: 'Aggregate before joining, or sum from the table that has one row per thing you are adding up.',
  },

  // --- NULL ---
  {
    id: 'equals-null',
    section: 'null',
    title: 'Comparing with = NULL',
    wrong: `select firstname from cd.members
where recommendedby = null;`,
    why: 'Anything compared with NULL is unknown, and WHERE only keeps rows that are true.',
    fix: `where recommendedby is null`,
  },
  {
    id: 'pipe-concat-null',
    section: 'null',
    title: 'Building a name with || when a piece can be NULL',
    wrong: `select firstname || ' ' || surname from cd.members;`,
    why: '|| returns NULL if any piece is NULL, so the whole name disappears.',
    fix: `select concat(firstname, ' ', surname) from cd.members;  -- NULL becomes ''`,
  },

  // --- filtering ---
  {
    id: 'quotes-in',
    section: 'filtering',
    title: 'Double quotes and IN for a substring search',
    wrong: `where "Tennis" in name`,
    error: 'syntax error at or near "name"',
    why: 'Double quotes make an identifier (a column called Tennis), and IN wants a parenthesised list of exact values. It never searches inside a string.',
    fix: `where name like '%Tennis%'`,
  },

  // --- dates ---
  {
    id: 'between-timestamps',
    section: 'dates',
    title: 'BETWEEN two dates for a whole day',
    wrong: `where starttime between '2012-09-21' and '2012-09-22'`,
    why: 'BETWEEN includes both ends, so a booking at midnight on the 22nd sneaks in.',
    fix: `where starttime >= '2012-09-21' and starttime < '2012-09-22'`,
  },

  // --- CASE ---
  {
    id: 'if-then',
    section: 'case',
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

  // --- GROUP BY ---
  {
    id: 'not-in-group-by',
    section: 'group-by',
    title: 'Selecting a column that is neither grouped nor aggregated',
    wrong: `select m.firstname, sum(b.slots)
from ... group by m.surname;`,
    error: 'column "m.firstname" must appear in the GROUP BY clause or be used in an aggregate function',
    why: 'One surname group holds several first names. Postgres will not pick one for you.',
    fixText: 'Group by the primary key (m.memid). Every other members column is then allowed.',
  },
  {
    id: 'integer-division',
    section: 'group-by',
    title: 'Dividing two integers',
    wrong: `sum(slots) / 2`,
    why: 'Integer division truncates: 7 / 2 is 3.',
    fix: `sum(slots) / 2.0`,
  },

  // --- window functions ---
  {
    id: 'window-in-where',
    section: 'window-functions',
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
    title: 'A scalar subquery that finds several rows',
    wrong: `select firstname,
       (select bookid from cd.bookings b where b.memid = m.memid)
from cd.members m;`,
    error: 'more than one row returned by a subquery used as an expression',
    why: 'A subquery in the SELECT list must return one value per outer row. Darren has two bookings.',
    fixText: 'Aggregate inside it (max, count, ...), or turn it into a join.',
  },

];

export function mistakesFor(section: string): Mistake[] {
  return mistakes.filter((m) => m.section === section);
}
