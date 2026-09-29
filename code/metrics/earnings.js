// Pay per delivery and per hour, from monthly totals typed in by the dasher.

import { monthStart, monthEnd, formatMonth, formatDay } from '../data/time.js';

export const TIER = 'needs-input';

/** Minutes covered by these intervals, overlaps counted once. */
function unionMinutes(intervals) {
  const s = intervals.slice().sort((a, b) => a[0] - b[0]);
  let total = 0, from = null, to = null;
  for (const [a, b] of s) {
    if (from === null) { from = a; to = b; }
    else if (a <= to) { if (b > to) to = b; }
    else { total += to - from; from = a; to = b; }
  }
  if (from !== null) total += to - from;
  return total / 60000;
}

/** Average ratio of reported to reconstructed time, over the months entered. */
export function calibrate(rows, field, baseField) {
  const known = rows.filter((r) => r[field] != null && r[baseField] > 0 && !r.partial);
  if (!known.length) return null;
  return known.reduce((a, r) => a + r[field] / r[baseField], 0) / known.length;
}

/** One row per month in the export, with deliveries and reconstructed dash and active time. */
export function periodRows(orders, shifts, entries) {
  if (!orders.length) return [];
  const dates = orders.map((o) => o.local.date).sort();
  const first = dates[0], last = dates.at(-1);

  const buckets = new Map();
  for (const o of orders) {
    const k = monthStart(o.local.date);
    if (!buckets.has(k)) buckets.set(k, { period: k, deliveries: 0, inferredMin: 0, spans: [] });
    buckets.get(k).deliveries++;
    buckets.get(k).spans.push([+o.pickup, +o.delivery]);
  }
  for (const row of buckets.values()) row.activeBaseMin = unionMinutes(row.spans);
  for (const s of shifts) {
    const k = monthStart(s.local.date);
    if (buckets.has(k)) buckets.get(k).inferredMin += s.hours * 60;
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map((row) => {
    const periodEnd = monthEnd(row.period);

    const partial = row.period < first || periodEnd > last;

    const e = entries[row.period] ?? {};
    const pay = e.pay ?? null, dashMin = e.dashMin ?? null, activeMin = e.activeMin ?? null;

    return {
      ...row,
      spans: undefined,
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
      pay, dashMin, activeMin,
      perDelivery: pay != null && row.deliveries ? pay / row.deliveries : null,
      perDashHour: pay != null && dashMin ? pay / (dashMin / 60) : null,
      perActiveHour: pay != null && activeMin ? pay / (activeMin / 60) : null,
      utilisation: dashMin && activeMin ? Math.round((100 * activeMin) / dashMin) : null,
    };
  });
}

/** Fills empty dash and active time: calibrated once a month is entered, the raw floor before that. */
export function withEstimates(rows) {
  const kDash = calibrate(rows, 'dashMin', 'inferredMin');
  const kActive = calibrate(rows, 'activeMin', 'activeBaseMin');
  const basedOn = (field) => rows.filter((r) => r[field] != null && !r.partial).length;
  return rows.map((r) => {
    const estimate = {
      dashMin: r.dashMin != null ? null : Math.round(kDash ? r.inferredMin * kDash : r.inferredMin),
      activeMin: r.activeMin != null ? null : Math.round(kActive ? r.activeBaseMin * kActive : r.activeBaseMin),
    };
    const dashMinEff = r.dashMin ?? estimate.dashMin;
    const activeMinEff = r.activeMin ?? estimate.activeMin;
    return {
      ...r,
      estimate,
      estimateBasis: { dashMin: kDash ? 'calibrated' : 'floor', activeMin: kActive ? 'calibrated' : 'floor' },
      basedOn: { dashMin: basedOn('dashMin'), activeMin: basedOn('activeMin') },
      perDashHour: r.pay != null && dashMinEff ? r.pay / (dashMinEff / 60) : null,
      perActiveHour: r.pay != null && activeMinEff ? r.pay / (activeMinEff / 60) : null,
      utilisation: dashMinEff && activeMinEff ? Math.round((100 * activeMinEff) / dashMinEff) : null,
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
  const activeMin = sum((r) => r.activeMin ?? r.estimate?.activeMin);
  const deliveries = sum((r) => r.deliveries);
  return {
    periods: paid.length,
    partial: paid.filter((r) => r.partial).length,
    pay, dashMin, activeMin, deliveries,
    perDelivery: deliveries ? pay / deliveries : null,
    perDashHour: dashMin ? pay / (dashMin / 60) : null,
    perActiveHour: activeMin ? pay / (activeMin / 60) : null,
    utilisation: dashMin && activeMin ? Math.round((100 * activeMin) / dashMin) : null,
  };
}
