// Which orders each median may use. Stacking skews the two legs of an order differently.

const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
const upperBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; };
const countOpen = (arr, a, b) => Math.max(0, lowerBound(arr, b) - upperBound(arr, a));

/** Flags a leg as clean when no other pickup or drop-off falls inside it. */
export function markCleanliness(orders) {
  const pickups = orders.map((o) => +o.pickup).sort((a, b) => a - b);
  const drops = orders.map((o) => +o.delivery).sort((a, b) => a - b);

  for (const o of orders) {
    const from = +o.created, pick = +o.pickup, drop = +o.delivery;

    o.cleanToPickup = !o.isScheduled && countOpen(pickups, from, pick) === 0;

    o.cleanLeg = countOpen(pickups, pick, drop) === 0 && countOpen(drops, pick, drop) === 0;

    o.isNearerDrop = o.isBatched && o.cleanLeg;
  }
  return orders;
}

/**
 * toPickup    no other pickup in between; scheduled orders excluded
 * leg         solo trips only
 * nearerDrop  the stacked order dropped first: biased nearer, so kept separate
 */
export const SAMPLES = {
  toPickup: (o) => o.cleanToPickup,
  leg: (o) => !o.isBatched,
  nearerDrop: (o) => o.isNearerDrop,
  all: () => true,
};
