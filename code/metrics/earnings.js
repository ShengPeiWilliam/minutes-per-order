// Pay per delivery and per hour, from monthly totals typed in by the driver.

import { monthStart, monthEnd, formatMonth, formatDay } from '../data/time.js';

export const TIER = 'needs-input';

/** Average ratio of reported to reconstructed time, over the months entered. */
export function calibrate(rows, field, baseField) {
  const known = rows.filter((r) => r[field] != null && r[baseField] > 0 && !r.partial);
  if (!known.length) return null;
  return known.reduce((a, r) => a + r[field] / r[baseField], 0) / known.length;
}

/** One row per month in the export, with deliveries and reconstructed dash time. */
export function periodRows(orders, shifts, entries) {
  if (!orders.length) return [];
  const dates = orders.map((o) => o.local.date).sort();
  const first = dates[0], last = dates.at(-1);

  const buckets = new Map();
  for (const o of orders) {
    const k = monthStart(o.local.date);
    if (!buckets.has(k)) buckets.set(k, { period: k, deliveries: 0, inferredMin: 0 });
    buckets.get(k).deliveries++;
  }
  for (const s of shifts) {
    const k = monthStart(s.local.date);
    if (buckets.has(k)) buckets.get(k).inferredMin += s.hours * 60;
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map((row) => {
    const periodEnd = monthEnd(row.period);

    const partial = row.period < first || periodEnd > last;

    const e = entries[row.period] ?? {};
    const pay = e.pay ?? null, dashMin = e.dashMin ?? null;

    return {
      ...row,
      periodEnd,
      label: formatMonth(row.period),
      partial,
      daysInMonth: Number(periodEnd.slice(8)),
      coverFrom: Number((row.period < first ? first : row.period).slice(8)),
      coverTo: Number((periodEnd > last ? last : periodEnd).slice(8)),
      covered: partial
        ? [row.period < first ? `from ${formatDay(first)}` : '',
          periodEnd > last ? `to ${formatDay(last)}` : ''].filter(Boolean).join(' ')
        : '',
      pay, dashMin,
      perDelivery: pay != null && row.deliveries ? pay / row.deliveries : null,
      perDashHour: pay != null && dashMin ? pay / (dashMin / 60) : null,
    };
  });
}

/** Fills empty dash time: calibrated once a month is entered, the raw floor before that. */
export function withEstimates(rows) {
  const kDash = calibrate(rows, 'dashMin', 'inferredMin');
  const basedOn = (field) => rows.filter((r) => r[field] != null && !r.partial).length;
  return rows.map((r) => {
    const estimate = {
      dashMin: r.dashMin != null ? null : Math.round(kDash ? r.inferredMin * kDash : r.inferredMin),
    };
    const dashMinEff = r.dashMin ?? estimate.dashMin;
    return {
      ...r,
      estimate,
      estimateBasis: { dashMin: kDash ? 'calibrated' : 'floor' },
      basedOn: { dashMin: basedOn('dashMin') },
      perDashHour: r.pay != null && dashMinEff ? r.pay / (dashMinEff / 60) : null,
    };
  });
}

/** Totals across months with pay entered. Partial months count; their $/delivery runs high. */
export function totals(rows) {
  const paid = rows.filter((r) => r.pay != null);
  if (!paid.length) return null;
  const sum = (f) => paid.reduce((a, r) => a + (f(r) ?? 0), 0);
  const pay = sum((r) => r.pay);
  const dashMin = sum((r) => r.dashMin ?? r.estimate?.dashMin);
  const deliveries = sum((r) => r.deliveries);
  return {
    periods: paid.length,
    partial: paid.filter((r) => r.partial).length,
    pay, dashMin, deliveries,
    perDelivery: deliveries ? pay / deliveries : null,
    perDashHour: dashMin ? pay / (dashMin / 60) : null,
  };
}
