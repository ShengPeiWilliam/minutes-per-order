// Per-order fields and flags, derived straight from one row.

import { parseUtc, localParts, minutesBetween } from './time.js';

// Dispatch -> pickup beyond this is a scheduled order: accepted in advance, so
// the span holds waiting that has nothing to do with how you work.
export const SCHEDULED_MIN = 60;

export function buildOrders(records) {
  return records
    .map((r, i) => {
      const created = parseUtc(r.ORDER_CREATED_TIME);
      const pickup = parseUtc(r.ACTUAL_PICKUP_TIME);
      const delivery = parseUtc(r.ACTUAL_DELIVERY_TIME);

      const subtotal = Number(r.SUBTOTAL_IN_CENTS || 0) / 100;
      const toPickup = minutesBetween(created, pickup);

      return {
        id: i,
        store: (r.STORE_NAME || '').trim(),
        status: r.ORDER_STATUS,
        itemCount: Number(r.TOTAL_ITEM_COUNT || 0),
        subtotal,
        created, pickup, delivery,
        toPickup,                                    // dispatch -> pickup
        leg: minutesBetween(pickup, delivery),       // pickup -> drop off
        total: minutesBetween(created, delivery),
        local: localParts(pickup),
        isScheduled: toPickup > SCHEDULED_MIN,
        isRetail: subtotal === 0,                    // retail / grocery, no subtotal shown
        // filled in once the orders are grouped
        groupId: null, groupSize: 1, pickupOrder: 0, isBatched: false, isDoubled: false,
      };
    })
    .sort((a, b) => a.pickup - b.pickup);
}
