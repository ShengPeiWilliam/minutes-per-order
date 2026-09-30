// Counting: when you work and where you go.

import { counter, pct } from './stats.js';

export const TIER = 'solid';

export const byHour = ({ orders }) =>
  Array.from({ length: 24 }, (_, h) => ({
    key: h, label: h, value: orders.filter((o) => o.local.hour === h).length,
  }));

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const stores = ({ orders }) => counter(orders, (o) => o.store);

/**
 * Repeat share: orders from a store already picked up from earlier in the whole
 * file, over the orders in view. `all` is the whole file, so a single day or hour
 * still counts a store first visited outside it; with nothing filtered this is
 * orders beyond the first at each store.
 */
export const storeLoyalty = ({ orders }, all = orders) => {
  const s = counter(orders, (o) => o.store);
  const once = [...s.values()].filter((n) => n === 1).length;
  const first = new Map();
  for (const o of [...all].sort((a, b) => a.pickup - b.pickup)) if (!first.has(o.store)) first.set(o.store, o.id);
  const repeats = orders.filter((o) => first.get(o.store) !== o.id).length;
  return {
    distinct: s.size,
    once,
    repeatShare: pct(repeats, orders.length),
    n: orders.length,
  };
};

export const peakShare = ({ orders }) => ({
  value: pct(orders.filter((o) =>
    (o.local.hour >= 11 && o.local.hour <= 13) || (o.local.hour >= 18 && o.local.hour <= 21)).length,
    orders.length),
  n: orders.length,
  unit: '%',
});
