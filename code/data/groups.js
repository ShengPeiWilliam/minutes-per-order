// Trips: orders that were in the car at the same time.

import { minutesBetween } from './time.js';

// Fallback when the file has too few pairs to learn the boundary from.
export const SAME_SPOT_MIN = 1;

const BOUNDARY_MIN = 0.5;   // minutes — below this, two separate doors cannot fit
const BOUNDARY_MAX = 3;     // minutes — beyond this you have driven somewhere else

/** Where one door ends and two begin: the largest jump in drop gaps between 0.5 and 3 min. */
export function findDropBoundary(gaps) {
  const sorted = gaps.slice().sort((a, b) => a - b);
  const near = sorted.filter((g) => g <= BOUNDARY_MAX);
  if (near.length < 6) return { minutes: SAME_SPOT_MIN, learned: false, why: 'too few pairs' };

  const candidates = [];
  for (let i = 1; i < near.length; i++) {
    const mid = (near[i - 1] + near[i]) / 2;
    if (mid < BOUNDARY_MIN || mid > BOUNDARY_MAX) continue;
    candidates.push({ jump: near[i] - near[i - 1], mid });
  }
  candidates.sort((a, b) => b.jump - a.jump);
  const [best, runnerUp] = candidates;

  // One jump has to stand out: at least 1.5x the runner-up.
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
 * Union-find over pickup..delivery overlaps: an order joins another if it was picked up
 * before the other was dropped off (strict <). Transitive, so a relay forms one trip.
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

/** Labels each two-order trip: same store or two, one door or two. */
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
