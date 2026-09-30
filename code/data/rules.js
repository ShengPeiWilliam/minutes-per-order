// Every threshold Rearview's numbers depend on, in one place.
//
// The code reads these names, and Docs, Methods builds its "Numbers Rearview
// uses" table from RULES below, so the explanation and the arithmetic cannot
// drift apart. Change a number here and both change together.

/** Over this many minutes between one trip's last drop-off and the next pickup starts a new shift. */
export const SHIFT_GAP_MIN = 60;
/** Created to pickup beyond this many minutes: a scheduled order, left out of order time. */
export const SCHEDULED_MIN = 60;
/** Where one door ends and two begin is learned from the file, between these minutes apart. */
export const DOOR_GAP_MIN = 0.5;
export const DOOR_GAP_MAX = 3;
/** Used when the file has too few stacked drop-offs to learn that boundary. */
export const SAME_SPOT_MIN = 1;

/** Lunch and dinner, by pickup hour: the first hour counted and the first hour not. */
export const LUNCH = [11, 14];
export const DINNER = [17, 20];
/** A time of day is coloured once it is this many minutes off the overall median. */
export const TIME_OF_DAY_MARGIN_MIN = 3;
/** A category with fewer orders than this is drawn faded. */
export const THIN_ORDERS = 10;
/** A recent order is marked slow past this share of your own orders. */
export const SLOW_QUANTILE = 0.75;

/** Store mix compares two halves only when each has at least this many typed orders. */
export const MIX_MIN_PER_HALF = 30;
/** A shift in store mix is bold past this many standard errors. */
export const MIX_STANDARD_ERRORS = 2;

/** A Stride day looks short under this share of the typical miles per order... */
export const SHORT_DAY_SHARE = 0.4;
/** ...on a day with at least this many orders. */
export const SHORT_DAY_MIN_ORDERS = 3;
/** Tightest day and longest haul look only at days with at least this many orders. */
export const BUSY_DAY_ORDERS = 8;
/** The miles-per-order chart marks a day at this many times the typical day or more. */
export const HEAVY_DAY_TIMES = 1.5;
/** The miles-per-order chart's axis stops at this many times the typical day. */
export const DAY_CHART_CAP_TIMES = 3;

/** Goal turns a month into weeks at this many weeks a month. */
export const WEEKS_A_MONTH = 365 / 12 / 7;
/** A store lookup is trusted only this close to the rest of your stores. */
export const LOOKUP_MAX_KM = 150;
/** One lookup run stops after this many stores, so a mistake cannot run up a bill. */
export const LOOKUP_RUN_MAX = 500;

/** A row past this many hours from pickup to drop-off is set aside, counted. */
export const MAX_TRIP_HOURS = 6;
/** A Stride day past this many miles is set aside, counted. */
export const STRIDE_MAX_DAY_MILES = 1000;
/** A file larger than this is refused before it is read. */
export const MAX_FILE_MB = 50;

const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const last = (h) => `${String(h - 1).padStart(2, '0')}:59`;

/**
 * The table in Docs, Methods: what each number is, written with "to" and with
 * edges exactly as the code tests them. `term` links a row to its card.
 * `drawn` marks a rule that changes only how a figure is drawn or fetched,
 * never the figure itself; those sit apart, folded under the rest.
 */
export const RULES = [
  { rule: 'New shift', value: `Over ${SHIFT_GAP_MIN} minutes from one drop-off to the next pickup`, term: 'shift' },
  { rule: 'Scheduled order, left out of order time', value: `Over ${SCHEDULED_MIN} minutes from order to pickup`, term: 'ordertime' },
  { rule: 'Lunch', value: `Pickups from ${hh(LUNCH[0])} to ${last(LUNCH[1])}` },
  { rule: 'Dinner', value: `Pickups from ${hh(DINNER[0])} to ${last(DINNER[1])}` },
  { drawn: true, rule: 'Time of day coloured', value: `${TIME_OF_DAY_MARGIN_MIN} minutes or more off your median order time` },
  { drawn: true, rule: 'Faded category', value: `Fewer than ${THIN_ORDERS} orders` },
  { drawn: true, rule: 'Slow recent order', value: `Slower than ${Math.round(SLOW_QUANTILE * 4)} in 4 of your own orders, pickup to drop-off` },
  { rule: 'Two doors on one trip', value: `Learned from your file, somewhere from ${DOOR_GAP_MIN} to ${DOOR_GAP_MAX} minutes between drop-offs; ${SAME_SPOT_MIN} minute when it cannot tell`, term: 'trip' },
  { drawn: true, rule: 'Store mix compared', value: `At least ${MIX_MIN_PER_HALF} typed orders in each half`, term: 'mix' },
  { drawn: true, rule: 'Store mix shift in bold', value: `${MIX_STANDARD_ERRORS} standard errors or more`, term: 'mix' },
  { rule: 'A Stride day filled in', value: 'Its orders times your median miles per order', term: 'miles' },
  { drawn: true, rule: 'A Stride day that looks short', value: `Under ${SHORT_DAY_SHARE} times your median miles per order, on a day with ${SHORT_DAY_MIN_ORDERS} or more orders`, term: 'miles' },
  { rule: 'Tightest day and longest haul', value: `Days with ${BUSY_DAY_ORDERS} or more orders, Stride fully recorded` },
  { drawn: true, rule: 'Heavy day on the miles chart', value: `${HEAVY_DAY_TIMES} times your median miles per order or more` },
  { drawn: true, rule: 'Miles chart axis', value: `Stops at ${DAY_CHART_CAP_TIMES} times your median; taller bars are cut and marked` },
  { rule: 'Weeks in a month, for Goal', value: `${WEEKS_A_MONTH.toFixed(3)} (365 ÷ 12 ÷ 7)` },
  { drawn: true, rule: 'Store lookup trusted', value: `Within ${LOOKUP_MAX_KM} km of your other stores` },
  { drawn: true, rule: 'Stores looked up in one run', value: `Up to ${LOOKUP_RUN_MAX}; run it again for the rest` },
  { rule: 'Order set aside', value: `Over ${MAX_TRIP_HOURS} hours from pickup to drop-off, or dated in the future` },
  { rule: 'Stride day set aside', value: `Over ${STRIDE_MAX_DAY_MILES.toLocaleString('en-US')} miles` },
  { drawn: true, rule: 'Largest file read', value: `${MAX_FILE_MB} MB` },
];
