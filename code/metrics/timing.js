// Where the minutes of an order go.
//
// Each figure names the sample it is allowed to use; see data/samples.js for why
// those rules are not the same on both legs.

import { median, quantile } from './stats.js';
import { SAMPLES } from '../data/samples.js';

export const TIER = 'solid';

/** Pickup -> dropped. Solo runs only. */
export const leg = ({ orders }) => {
  const v = orders.filter(SAMPLES.leg).map((o) => o.leg);
  return { value: median(v), p75: quantile(v, 0.75), n: v.length, unit: 'min' };
};

/** The stacked order that was dropped first — the nearer of the two. Biased by
 *  construction, so it stays a separate series and never joins `leg`. */
export const nearerDrop = ({ orders }) => {
  const v = orders.filter(SAMPLES.nearerDrop).map((o) => o.leg);
  return { value: median(v), n: v.length, unit: 'min' };
};

/** Whole cost of an order, first pickup to dropped, shared across the run. Never
 *  ORDER_CREATED_TIME — for a solo run this is exactly `leg`; for a stacked run
 *  it is the whole trip's span split evenly across the orders sharing it. */
export const costPerOrder = ({ groups }) => {
  const v = groups.map((g) => g.minutesPerOrder);
  return { value: median(v), n: v.length, unit: 'min' };
};

/**
 * Order created to delivered, bucketed by an arbitrary key (store kind, meal
 * period, whatever the caller asks). This is the one figure in the app that
 * does read ORDER_CREATED_TIME — standing in for when the system took the
 * order, not the moment a dasher saw or accepted it, which this file never
 * records. A scheduled order's gap to pickup is a booked wait rather than the
 * kitchen's clock starting, so those are dropped before bucketing.
 */
export function orderTimeBy(orders, keyOf) {
  const buckets = new Map();
  for (const o of orders) {
    if (o.isScheduled) continue;
    const k = keyOf(o);
    if (k == null) continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o.total);
  }
  return buckets;
}
