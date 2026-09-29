// Row checks before anything is derived. Rejected rows are counted, never dropped silently.

import { parseUtc } from './time.js';

export const REQUIRED = [
  'ORDER_CREATED_TIME',
  'ACTUAL_PICKUP_TIME',
  'ACTUAL_DELIVERY_TIME',
  'STORE_NAME',
];

const REASONS = {
  unparseable: 'timestamp could not be read',
  negativeLeg: 'dropped off before it was picked up',
  negativePickup: 'picked up before it was dispatched',
  duplicate: 'identical to an earlier row',
};

export class MissingColumns extends Error {
  constructor(missing) {
    super(`This file is missing ${missing.join(', ')}. Is it the delivery export from your app?`);
    this.name = 'MissingColumns';
    this.missing = missing;
  }
}

export function validateRows(records, header) {
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw new MissingColumns(missing);

  const counts = {}, examples = {};
  const reject = (key, r) => {
    counts[key] = (counts[key] ?? 0) + 1;
    if (!examples[key]) examples[key] = `${r.STORE_NAME || '(no store)'} · ${r.ACTUAL_PICKUP_TIME || '(no time)'}`;
  };

  const seen = new Set();
  const kept = [];
  for (const r of records) {
    const c = parseUtc(r.ORDER_CREATED_TIME);
    const p = parseUtc(r.ACTUAL_PICKUP_TIME);
    const d = parseUtc(r.ACTUAL_DELIVERY_TIME);
    if (!c || !p || !d) { reject('unparseable', r); continue; }
    if (d < p) { reject('negativeLeg', r); continue; }
    if (p < c) { reject('negativePickup', r); continue; }

    // An exact repeat would overlap itself and read as a stacked trip.
    const key = `${r.ORDER_CREATED_TIME}|${r.ACTUAL_PICKUP_TIME}|${r.ACTUAL_DELIVERY_TIME}|${r.STORE_NAME}`;
    if (seen.has(key)) { reject('duplicate', r); continue; }
    seen.add(key);

    kept.push(r);
  }

  return {
    records: kept,
    report: {
      total: records.length,
      kept: kept.length,
      rejected: Object.entries(counts).map(([key, count]) => ({
        reason: REASONS[key], key, count, example: examples[key],
      })),
    },
  };
}
