/**
 * The trimmed country club as SQL: schema plus inserts. One source for the
 * in-browser query box and the verify script, so both run on the same data.
 */
import { bookings, facilities, members } from '../../data/sql/countryclub';

const SCHEMA = `
create schema cd;
create table cd.members (
  memid integer primary key, surname varchar(200) not null, firstname varchar(200) not null,
  recommendedby integer references cd.members(memid), joindate timestamp not null);
create table cd.facilities (
  facid integer primary key, name varchar(100) not null, membercost numeric not null,
  guestcost numeric not null, initialoutlay numeric not null, monthlymaintenance numeric not null);
create table cd.bookings (
  bookid integer primary key, facid integer not null references cd.facilities(facid),
  memid integer not null references cd.members(memid), starttime timestamp not null, slots integer not null);
`;

const literal = (v: unknown) => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${v}'`);

const inserts = (table: string, rows: object[]) =>
  rows
    .map((r) => `insert into ${table} (${Object.keys(r).join(', ')}) values (${Object.values(r).map(literal).join(', ')});`)
    .join('\n');

export const SEED_SQL = [
  SCHEMA,
  inserts('cd.members', members),
  inserts('cd.facilities', facilities),
  inserts('cd.bookings', bookings),
].join('\n');
