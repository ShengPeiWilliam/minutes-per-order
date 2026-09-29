// Pay per hour, once the figures have been typed in, one month at a time.
//
// These deliberately ignore the hour and weekday filters. A period total cannot be
// attributed to a time of day: knowing you earned $996 across a week says nothing
// about what the dinner rush was worth. Slicing it would invent a number. Per-order
// pay would answer that; the statement cannot.

import { monthStart, monthEnd, formatMonth, formatDay } from '../data/time.js';

export const TIER = 'needs-input';

/** Total wall-clock minutes covered by these intervals, overlaps counted once. */
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

/**
 * Learn the ratio between what we can measure and what DoorDash reports, from the
 * weeks that have been filled in — this dasher's own ratio, not a constant lifted
 * from someone else. It encodes how long they take to accept an offer and how far
 * they drive, both of which differ by person and by market.
 *
 * One entered week is enough. Against four weeks of real statements, calibrating on
 * a single week and predicting the rest was out by 6.6% at worst; two weeks gave
 * 5.4% and three gave 5.1%, so holding the suggestion back for a second week buys
 * almost nothing and costs the dasher a whole week of not seeing it.
 *
 * @returns {number|null} multiplier, or null when there is nothing to learn from
 */
export function calibrate(rows, field, baseField) {
  const known = rows.filter((r) => r[field] != null && r[baseField] > 0 && !r.partial);
  if (!known.length) return null;
  return known.reduce((a, r) => a + r[field] / r[baseField], 0) / known.length;
}

/**
 * One row per period present in the export, whether or not it has been filled in.
 *
 * @param orders   every order, unfiltered
 * @param shifts   every shift, unfiltered
 * @param entries  { '2026-08-01': { pay, dashMin, activeMin } }
 */
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
  // Wall-clock time holding at least one order. Short of DoorDash's active time by
  // the drive out to the store, but proportional to it — see calibrate().
  for (const row of buckets.values()) row.activeBaseMin = unionMinutes(row.spans);
  for (const s of shifts) {
    const k = monthStart(s.local.date);
    if (buckets.has(k)) buckets.get(k).inferredMin += s.hours * 60;
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map((row) => {
    const periodEnd = monthEnd(row.period);

    // The export starting or ending mid-month costs this row some deliveries while
    // the pay typed against it is DoorDash's for the whole month. Only $ / delivery
    // is affected by that, and only upwards: the hourly rates are DoorDash's own two
    // numbers divided by each other, so nothing the file is missing can touch them.
    const partial = row.period < first || periodEnd > last;

    const e = entries[row.period] ?? {};
    const pay = e.pay ?? null, dashMin = e.dashMin ?? null, activeMin = e.activeMin ?? null;

    return {
      ...row,
      spans: undefined,
      periodEnd,
      label: formatMonth(row.period),
      partial,
      // The stretch of this month the export actually holds, for the coverage
      // bar on its card: day numbers, 1-based, inclusive.
      daysInMonth: Number(periodEnd.slice(8)),
      coverFrom: Number((row.period < first ? first : row.period).slice(8)),
      coverTo: Number((periodEnd > last ? last : periodEnd).slice(8)),
      // "part" on its own is a riddle. What the export actually holds of this
      // month answers it in three words.
      covered: partial
        ? [row.period < first ? `from ${formatDay(first)}` : '',
          periodEnd > last ? `to ${formatDay(last)}` : ''].filter(Boolean).join(' ')
        : '',
      pay, dashMin, activeMin,
      perDelivery: pay != null && row.deliveries ? pay / row.deliveries : null,
      perDashHour: pay != null && dashMin ? pay / (dashMin / 60) : null,
      perActiveHour: pay != null && activeMin ? pay / (activeMin / 60) : null,
      // DoorDash reports both halves, so this is measured rather than inferred.
      utilisation: dashMin && activeMin ? Math.round((100 * activeMin) / dashMin) : null,
    };
  });
}

/**
 * Fill each row's `estimate` with a suggestion for the boxes still empty. Runs
 * after the rows exist, because calibration reads the entered ones.
 *
 * Two tiers. Once a real month has been typed in, this dasher's own ratio
 * between the reconstructed figure and the reported one is the better guess —
 * that is `calibrate()`, unchanged. Before that, there is nothing to learn a
 * ratio from, so the box falls back to the reconstructed figure itself (ratio
 * 1): the shifts built from order gaps for dash time, the carrying-time union
 * for active time. Neither needs a real month typed in first, unlike the
 * calibrated guess.
 *
 * A plainer version of the dash-time floor was tried first: just the first
 * order of the day to the last one delivered, no shift-splitting at all. On a
 * real export one calendar day came out spanning 35 hours — a scheduled order
 * held from the evening before glued two unrelated sessions into one "day" —
 * which turned a floor meant to undercount into an overcount instead. The
 * shift reconstruction already exists to solve exactly that, so the floor
 * reuses it rather than re-deriving a weaker version of the same idea.
 */
export function withEstimates(rows) {
  const kDash = calibrate(rows, 'dashMin', 'inferredMin');
  const kActive = calibrate(rows, 'activeMin', 'activeBaseMin');
  const basedOn = (field) => rows.filter((r) => r[field] != null && !r.partial).length;
  return rows.map((r) => {
    const estimate = {
      dashMin: r.dashMin != null ? null : Math.round(kDash ? r.inferredMin * kDash : r.inferredMin),
      activeMin: r.activeMin != null ? null : Math.round(kActive ? r.activeBaseMin * kActive : r.activeBaseMin),
    };
    // The rate and Goal use the guess until a real figure replaces it — the same
    // promise the box beside it makes ("tab past it to keep the guess"). Left on
    // the real dash/active time alone, both sat blank for every dasher who had
    // not yet retyped a box that already looked filled in.
    const dashMinEff = r.dashMin ?? estimate.dashMin;
    const activeMinEff = r.activeMin ?? estimate.activeMin;
    return {
      ...r,
      estimate,
      // Which tier produced the estimate, so the UI can explain the right one
      // rather than crediting a floor to a calibration that has not happened yet.
      estimateBasis: { dashMin: kDash ? 'calibrated' : 'floor', activeMin: kActive ? 'calibrated' : 'floor' },
      basedOn: { dashMin: basedOn('dashMin'), activeMin: basedOn('activeMin') },
      perDashHour: r.pay != null && dashMinEff ? r.pay / (dashMinEff / 60) : null,
      perActiveHour: r.pay != null && activeMinEff ? r.pay / (activeMinEff / 60) : null,
      utilisation: dashMinEff && activeMinEff ? Math.round((100 * activeMinEff) / dashMinEff) : null,
    };
  });
}

/**
 * Totals across every month that has pay entered, partial ones included.
 *
 * They used to be excluded, which was safe and useless: an export that starts
 * mid-month has no complete month in it at all, so every figure came out blank.
 * A partial month costs the delivery count a few days and nothing else, so it is
 * counted and `partialPaid` names the months whose $ / delivery runs high.
 */
export function totals(rows) {
  const paid = rows.filter((r) => r.pay != null);
  if (!paid.length) return null;
  const sum = (f) => paid.reduce((a, r) => a + (f(r) ?? 0), 0);
  const pay = sum((r) => r.pay);
  // Same fallback as each row's own rate: a month with pay typed in but its
  // dash/active time still a guess should count here too, not sit at zero.
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
