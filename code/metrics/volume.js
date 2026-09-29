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

/** Repeat share: orders beyond the first at each store, over all orders. */
export const storeLoyalty = ({ orders }) => {
  const s = counter(orders, (o) => o.store);
  const once = [...s.values()].filter((n) => n === 1).length;
  return {
    distinct: s.size,
    once,
    repeatShare: pct(orders.length - s.size, orders.length),
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
