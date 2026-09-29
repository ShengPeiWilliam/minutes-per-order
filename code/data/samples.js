// Which orders may be counted for which metric.
//
// This is the file to read before trusting any number in the app. Stacking taints
// the two legs of an order in opposite directions, and the correction is not the
// same on both sides.

/**
 * Flag whether either leg was interrupted by another order's events.
 *
 * Both questions are "did any event land inside this window", so they run against
 * two sorted event lists and a binary search. Scanning every order for every order
 * gives the same answer but is quadratic: a 10k-order export took 24s that way and
 * takes 71ms this way.
 */
const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
const upperBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; };
/** How many values sit strictly inside (a, b). An order's own endpoints never qualify. */
const countOpen = (arr, a, b) => Math.max(0, lowerBound(arr, b) - upperBound(arr, a));

export function markCleanliness(orders) {
  const pickups = orders.map((o) => +o.pickup).sort((a, b) => a - b);
  const drops = orders.map((o) => +o.delivery).sort((a, b) => a - b);

  for (const o of orders) {
    const from = +o.created, pick = +o.pickup, drop = +o.delivery;

    // Dispatch -> pickup: picking something else up on the way means this span
    // also holds a detour and another drop-off.
    o.cleanToPickup = !o.isScheduled && countOpen(pickups, from, pick) === 0;

    // Pickup -> drop off: any other pickup or drop-off inside the window taints it.
    o.cleanLeg = countOpen(pickups, pick, drop) === 0 && countOpen(drops, pick, drop) === 0;

    // Event-clean, but selected for distance: this is the order you chose to drop
    // first, which is the nearer of the two. Its own series, never pooled.
    o.isNearerDrop = o.isBatched && o.cleanLeg;
  }
  return orders;
}

/**
 * toPickup   n=316, median 14.4 min. Clean as long as nothing else was picked up
 *            in between. Catches cross-group contamination too: an offer can land
 *            while the previous run is still being finished.
 *
 * leg        n=242, median 13.7 min. Solo runs only. The 52 stacked orders that
 *            are event-clean are all the one chosen to drop first, i.e. the nearer
 *            one; pooling them pulls the median to a false 12.6.
 *
 * nearerDrop n=52, median 9.7 min. Kept visible as its own series precisely because
 *            it is biased — it answers "how close is the closer of the two", which
 *            is a real question, just not the same one.
 */
export const SAMPLES = {
  toPickup: (o) => o.cleanToPickup,
  leg: (o) => !o.isBatched,
  nearerDrop: (o) => o.isNearerDrop,
  all: () => true,
};
