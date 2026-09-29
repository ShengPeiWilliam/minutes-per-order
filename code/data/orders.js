// Per-order times and flags, from one row each.

import { parseUtc, localParts, minutesBetween } from './time.js';

// Created -> pickup beyond this is a scheduled order, placed in advance.
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
        groupId: null, groupSize: 1, pickupOrder: 0, isBatched: false, isDoubled: false,
      };
    })
    .sort((a, b) => a.pickup - b.pickup);
}
