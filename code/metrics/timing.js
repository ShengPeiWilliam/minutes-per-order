// Where an order's minutes go. Each figure uses the sample named in data/samples.js.

import { median, quantile } from './stats.js';
import { SAMPLES } from '../data/samples.js';

export const TIER = 'solid';

/** Pickup -> drop-off, solo trips only. */
export const leg = ({ orders }) => {
  const v = orders.filter(SAMPLES.leg).map((o) => o.leg);
  return { value: median(v), p75: quantile(v, 0.75), n: v.length, unit: 'min' };
};

/** The stacked order dropped first. Biased nearer, so never pooled with leg. */
export const nearerDrop = ({ orders }) => {
  const v = orders.filter(SAMPLES.nearerDrop).map((o) => o.leg);
  return { value: median(v), n: v.length, unit: 'min' };
};

/** Trip span from first pickup to last drop, split evenly across its orders. */
export const costPerOrder = ({ groups }) => {
  const v = groups.map((g) => g.minutesPerOrder);
  return { value: median(v), n: v.length, unit: 'min' };
};

/** Created -> delivered, grouped by any key. Scheduled orders excluded. */
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
