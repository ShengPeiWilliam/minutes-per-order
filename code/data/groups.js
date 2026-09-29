// Grouping orders that were in the car at the same time.

import { minutesBetween } from './time.js';

// Fallback only. The real boundary is read off each dasher's own drop gaps by
// findDropBoundary below; this is what gets used when there is too little to read.
export const SAME_SPOT_MIN = 1;

// The boundary measures how long confirming two orders at one door takes — app
// taps and a photo upload — so it is close to the same for everybody, and only
// drifts with phone speed, signal and how far into a building the doors are.
// The search is bounded to that plausible range instead of hunting the whole
// distribution, where a small file can turn any quiet stretch into a "boundary".
const BOUNDARY_MIN = 0.5;   // minutes — below this, two separate doors cannot fit
const BOUNDARY_MAX = 3;     // minutes — beyond this you have driven somewhere else

/**
 * Where one customer ends and two begin, taken from the data rather than guessed.
 *
 * Confirming two orders at one door leaves a tight cluster — often the same
 * millisecond, when the app closes both at once — and there is a visible jump
 * before the gaps that mean driving somewhere else. The largest jump inside the
 * first ten minutes is that boundary. On a real file it fell at 63 seconds, where
 * a hand-picked two minutes had been wrong by one pair.
 *
 * It cannot be exact: a slow photo upload can push a genuine same-door pair past
 * the line, and neighbours in one building can fall under it.
 */
export function findDropBoundary(gaps) {
  const sorted = gaps.slice().sort((a, b) => a - b);
  const near = sorted.filter((g) => g <= BOUNDARY_MAX);
  if (near.length < 6) return { minutes: SAME_SPOT_MIN, learned: false, why: 'too few pairs' };

  // The split has to land inside the plausible window, so only jumps that would
  // put it there are candidates.
  const candidates = [];
  for (let i = 1; i < near.length; i++) {
    const mid = (near[i - 1] + near[i]) / 2;
    if (mid < BOUNDARY_MIN || mid > BOUNDARY_MAX) continue;
    candidates.push({ jump: near[i] - near[i - 1], mid });
  }
  candidates.sort((a, b) => b.jump - a.jump);
  const [best, runnerUp] = candidates;

  // One gap has to stand out. Two jumps of the same size mean the data is not
  // pointing anywhere, and picking between them lands on whichever floating-point
  // rounding happened to make fractionally larger — which is how this first went
  // wrong. DOMINANCE, not a hair's breadth.
  if (!best || best.jump < 0.25) return { minutes: SAME_SPOT_MIN, learned: false, why: 'no clear gap' };
  if (runnerUp && best.jump < runnerUp.jump * 1.5) {
    return { minutes: SAME_SPOT_MIN, learned: false, why: 'no gap stands out' };
  }

  const minutes = best.mid;
  return {
    minutes,
    learned: true,
    below: sorted.filter((g) => g < minutes).length,
    above: sorted.filter((g) => g >= minutes).length,
    jump: best.jump,
    runnerUp: runnerUp?.jump ?? 0,
    range: [BOUNDARY_MIN, BOUNDARY_MAX],
  };
}

/**
 * Group orders transitively on overlapping pickup..delivery intervals: another
 * order was picked up before this one was dropped off.
 *
 * Store name cannot stand in for this test, and the data says so both ways — 72
 * of 109 stacked pairs came from two different stores, and 4 same-store pairs
 * were separate trips back to the same place later in the shift.
 *
 * Transitive, so group size is not the same question as "how many were in the
 * car at once": a relay of overlapping pairs (drop one, pick up the next
 * before the one before it clears) chains into one large group even though
 * nothing was ever carried three- or four-deep. One 465-order file produced a
 * "5-order" group whose actual peak was 3 at once. `isDoubled` and everything
 * built on it only fire on a clean 2-member group, so a relay like that one is
 * simply left out of every doubled-up figure rather than miscounted — an
 * undercount, not a wrong number, and rare enough (1 group here) that fixing
 * it would mean rebuilding the doubling story around "peak concurrent" rather
 * than group size for a case this file barely has any of.
 */
export function buildGroups(orders) {
  const parent = orders.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };

  for (let i = 0; i < orders.length; i++) {
    for (let j = i + 1; j < orders.length; j++) {
      if (orders[j].pickup >= orders[i].delivery) break;  // sorted by pickup: nothing later can overlap
      parent[find(i)] = find(j);
    }
  }

  const buckets = new Map();
  orders.forEach((o, i) => {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(o);
  });

  return [...buckets.values()]
    .map((members) => members.slice().sort((a, b) => a.pickup - b.pickup))
    .sort((a, b) => a[0].pickup - b[0].pickup)
    .map((members, gid) => {
      members.forEach((o, idx) => {
        o.groupId = gid;
        o.groupSize = members.length;
        o.pickupOrder = idx;           // 0 = picked up first
        o.isBatched = members.length > 1;
        // "Doubled up" means exactly two — a third or more is rare enough
        // (1 run in 465 orders on the first fixture this ran against) that
        // folding it into the same bucket just complicates the arithmetic
        // ("divided by how many, again?") for a case nobody is asking about.
        o.isDoubled = members.length === 2;
      });

      const first = members[0];
      const lastDrop = members.reduce((a, b) => (a.delivery > b.delivery ? a : b)).delivery;

      const group = {
        id: gid,
        orders: members,
        size: members.length,
        start: first.pickup,
        end: lastDrop,
        local: first.local,
        stores: [...new Set(members.map((o) => o.store))],
        // Working span, measured from the first pickup — never from
        // ORDER_CREATED_TIME, whose exact meaning this file cannot confirm.
        span: minutesBetween(first.pickup, lastDrop),
      };
      group.minutesPerOrder = group.span / members.length;

      if (members.length === 2) {
        const [a, b] = members;
        group.pair = {
          pickupGap: Math.abs(minutesBetween(a.pickup, b.pickup)),
          dropGap: Math.abs(minutesBetween(a.delivery, b.delivery)),
          sameStore: a.store === b.store,
          nearerFirst: b.delivery < a.delivery,                   // second pickup dropped first
        };
      }
      return group;
    });
}

/**
 * Second pass: the boundary can only be found once every pair exists, so shape is
 * assigned after grouping rather than during it.
 */
export function markDropShapes(groups) {
  const pairs = groups.filter((g) => g.pair);
  const boundary = findDropBoundary(pairs.map((g) => g.pair.dropGap));
  for (const g of pairs) {
    g.pair.sameSpot = g.pair.dropGap < boundary.minutes;
    g.pair.shape = g.pair.sameStore
      ? (g.pair.sameSpot ? 'same-store-same-spot' : 'one-store-two-drops')
      : (g.pair.sameSpot ? 'two-stores-one-drop' : 'two-stores-two-drops');
  }
  return boundary;
}
