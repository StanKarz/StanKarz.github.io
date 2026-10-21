/**
 * A trimmed copy of the pgexercises country club schema (https://pgexercises.com/).
 *
 * Rows are cut down and a few values changed so that every edge case the
 * reference relies on exists on purpose:
 *
 * - member 37 is a second Darren Smith with no bookings (LEFT JOIN padding,
 *   anti-joins, grouping by name vs by key)
 * - several members have no recommender (NULL `recommendedby`)
 * - "Table Tennis" contains "Tennis" as a substring
 * - members 1 and 2 tie on total slots, as do 5 and 7 (ranking)
 * - bookings at exactly 00:00 on 2012-09-21 and 2012-09-22 (timestamp filters)
 *
 * Address, zipcode and telephone are left out: no section uses them.
 */

export interface Member {
  memid: number;
  surname: string;
  firstname: string;
  recommendedby: number | null;
  joindate: string;
}

export interface Facility {
  facid: number;
  name: string;
  membercost: number;
  guestcost: number;
  initialoutlay: number;
  monthlymaintenance: number;
}

export interface Booking {
  bookid: number;
  facid: number;
  memid: number;
  /** `YYYY-MM-DD HH:MM`, no time zone, as in pgexercises. */
  starttime: string;
  /** Half-hour blocks: 3 slots is 1.5 hours. */
  slots: number;
}

export const GUEST_MEMID = 0;

export const members: Member[] = [
  { memid: 0, surname: 'GUEST', firstname: 'GUEST', recommendedby: null, joindate: '2012-07-01 00:00' },
  { memid: 1, surname: 'Smith', firstname: 'Darren', recommendedby: null, joindate: '2012-07-02 12:02' },
  { memid: 2, surname: 'Smith', firstname: 'Tracy', recommendedby: null, joindate: '2012-07-02 12:08' },
  { memid: 3, surname: 'Rownam', firstname: 'Tim', recommendedby: null, joindate: '2012-07-03 09:32' },
  { memid: 4, surname: 'Joplette', firstname: 'Janice', recommendedby: 1, joindate: '2012-07-03 10:25' },
  { memid: 5, surname: 'Butters', firstname: 'Gerald', recommendedby: 1, joindate: '2012-07-09 10:44' },
  { memid: 7, surname: 'Dare', firstname: 'Nancy', recommendedby: 4, joindate: '2012-07-25 08:59' },
  { memid: 37, surname: 'Smith', firstname: 'Darren', recommendedby: null, joindate: '2012-09-26 18:08' },
];

export const facilities: Facility[] = [
  { facid: 0, name: 'Tennis Court 1', membercost: 5, guestcost: 25, initialoutlay: 10000, monthlymaintenance: 200 },
  { facid: 1, name: 'Tennis Court 2', membercost: 5, guestcost: 25, initialoutlay: 8000, monthlymaintenance: 200 },
  { facid: 2, name: 'Badminton Court', membercost: 0, guestcost: 15.5, initialoutlay: 4000, monthlymaintenance: 50 },
  { facid: 3, name: 'Table Tennis', membercost: 0, guestcost: 5, initialoutlay: 320, monthlymaintenance: 10 },
  { facid: 4, name: 'Massage Room 1', membercost: 35, guestcost: 80, initialoutlay: 4000, monthlymaintenance: 3000 },
];

export const bookings: Booking[] = [
  { bookid: 0, facid: 0, memid: 1, starttime: '2012-09-21 00:00', slots: 2 },
  { bookid: 1, facid: 0, memid: 0, starttime: '2012-09-21 09:00', slots: 3 },
  { bookid: 2, facid: 1, memid: 2, starttime: '2012-09-21 10:30', slots: 2 },
  { bookid: 3, facid: 2, memid: 1, starttime: '2012-09-21 13:00', slots: 3 },
  { bookid: 4, facid: 3, memid: 4, starttime: '2012-09-21 15:00', slots: 2 },
  { bookid: 5, facid: 4, memid: 0, starttime: '2012-09-21 17:30', slots: 2 },
  { bookid: 6, facid: 1, memid: 3, starttime: '2012-09-22 00:00', slots: 2 },
  { bookid: 7, facid: 0, memid: 5, starttime: '2012-09-20 18:00', slots: 2 },
  { bookid: 8, facid: 4, memid: 7, starttime: '2012-09-14 11:00', slots: 2 },
  { bookid: 9, facid: 0, memid: 2, starttime: '2012-09-14 08:00', slots: 3 },
  { bookid: 10, facid: 2, memid: 4, starttime: '2012-09-14 12:00', slots: 1 },
  { bookid: 11, facid: 3, memid: 3, starttime: '2012-08-30 19:00', slots: 2 },
];

export const memberById = new Map(members.map((m) => [m.memid, m]));
export const facilityById = new Map(facilities.map((f) => [f.facid, f]));

export function fullName(m: Pick<Member, 'firstname' | 'surname'>): string {
  return `${m.firstname} ${m.surname}`;
}
