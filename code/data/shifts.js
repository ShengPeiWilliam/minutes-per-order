// Splitting the day into shifts, and the waiting inside them.

import { minutesBetween } from './time.js';

// A gap this long between runs reads as going offline rather than waiting.
export const SHIFT_GAP_MIN = 60;

/**
 * Shifts are inferred from pickup..delivery, never from dispatch: a scheduled
 * order dispatched the previous evening would otherwise glue two shifts together.
 *
 * The result undercounts by design — time online before the first offer and after
 * the last drop is not in this file at all. Against one DoorDash statement week it
 * recovered 30h30m of a reported 33h29m, so treat it as a floor, not a measurement.
 */
export function buildShifts(groups) {
  const runs = [];
  let current = null;
  for (const g of groups) {
    if (current && minutesBetween(current.end, g.start) <= SHIFT_GAP_MIN) {
      current.groups.push(g);
      current.end = new Date(Math.max(current.end, g.end));
    } else {
      current = { groups: [g], start: g.start, end: g.end, local: g.local };
      runs.push(current);
    }
  }
  return runs.map((s, i) => {
    const orders = s.groups.flatMap((g) => g.orders);
    const hours = minutesBetween(s.start, s.end) / 60;
    // Waiting between finishing one run and picking up the next.
    const idle = s.groups.slice(1)
      .map((g, k) => minutesBetween(s.groups[k].end, g.start))
      .filter((m) => m >= 0);
    return {
      id: i, start: s.start, end: s.end, local: s.local,
      groups: s.groups, orders, orderCount: orders.length, hours, idle,
      ordersPerHour: hours > 0 ? orders.length / hours : null,
    };
  });
}
