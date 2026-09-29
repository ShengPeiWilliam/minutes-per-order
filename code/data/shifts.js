// Shifts: trips joined until a gap of more than an hour.

import { minutesBetween } from './time.js';

export const SHIFT_GAP_MIN = 60;

/**
 * Built from pickup..delivery, never from order creation, so a scheduled order cannot
 * glue two shifts together. Undercounts time online: a floor, not a measurement.
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
