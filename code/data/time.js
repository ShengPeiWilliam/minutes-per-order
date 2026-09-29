// Time handling. Everything the export gives us is UTC without a marker; every
// calendar question has to be answered in the dasher's own zone instead.
//
// The zone is not a detail. Read as local time the pickup histogram peaks at 1-3am
// with three orders at lunch; converted, it peaks at lunch and dinner. Get the zone
// wrong and every date, weekday and hour in the app shifts with it.

const FALLBACK_TZ = 'America/Los_Angeles';

/** Whatever the browser is set to — right for a dasher working where they live. */
export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch { return FALLBACK_TZ; }
}

let zone = detectTimeZone();
export const getTimeZone = () => zone;

/** Changing this changes every derived date, so callers must re-run the analysis. */
export function setTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });   // throws on a bad zone
    zone = tz;
    formatters.clear();
    return true;
  } catch { return false; }
}

/** Every IANA zone the browser knows, for the picker. */
export function timeZoneList() {
  try {
    const all = Intl.supportedValuesOf?.('timeZone');
    if (all?.length) return all;
  } catch { /* fall through */ }
  return [FALLBACK_TZ, 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'];
}

const MIN = 60000;
export const minutesBetween = (a, b) => (b - a) / MIN;

/** Export timestamps carry no zone but are UTC — converted, the pickup histogram
 *  lands on a lunch (11-13) and dinner (18-21) peak, which UTC does not produce. */
export function parseUtc(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
}

// Built per zone and cached: constructing a DateTimeFormat for every timestamp in
// a multi-thousand-order file is the slowest thing in the pipeline by far.
const formatters = new Map();
function partsFormatter() {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    }));
  }
  return formatters.get(zone);
}
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local calendar fields. An order crossing midnight in UTC would otherwise be
 *  filed under the wrong date and the wrong weekday. */
export function localParts(date) {
  const p = {};
  for (const { type, value } of partsFormatter().formatToParts(date)) p[type] = value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,          // Intl reports midnight as 24
    minute: Number(p.minute),
    weekday: p.weekday,
    weekdayIndex: WEEKDAY_INDEX[p.weekday],
  };
}

/** Monday of the week a YYYY-MM-DD belongs to. Held in UTC end to end, anchored
 *  at noon, so no zone or DST shift can move it across a day boundary.
 *  DoorDash weeks run Monday to Sunday; a statement week matched this exactly. */
export function weekStart(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The month a YYYY-MM-DD belongs to, and its last day.
 *
 * The month is the unit DoorDash will export for you rather than only display —
 * tax season needs it — so it is the one a dasher can fill in without copying a
 * screen by hand. Held as UTC at noon, like weekStart, so no zone can shift it.
 */
export const monthStart = (dateStr) => `${dateStr.slice(0, 7)}-01`;

export function monthEnd(monthStartDate) {
  const d = new Date(`${monthStartDate}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** "Aug 2026". Long enough to be unambiguous across a multi-year export. */
export function formatMonth(monthStartDate) {
  const d = new Date(`${monthStartDate}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Delivery work happens around meals. A zone that scatters pickups across the
// small hours is the wrong zone, and the gap is not subtle: on a real file the
// right zone scored 93% here and the machine's own (wrong) zone scored 39%.
const MEAL_HOURS = (h) => (h >= 10 && h <= 14) || (h >= 17 && h <= 21);

/**
 * Zones a DoorDash export can plausibly have come from — the US, Canada, Australia
 * and New Zealand — ordered so the populous ones come first.
 *
 * This is a shortlist, not a gate. Which countries DoorDash serves changes over
 * time and the Wolt side of the business covers more of Europe, so the full IANA
 * list stays available underneath rather than being filtered away.
 */
export const MARKET_ZONES = [
  // United States
  'America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago',
  'America/New_York', 'America/Detroit', 'America/Boise', 'America/Anchorage',
  'Pacific/Honolulu', 'America/Indiana/Indianapolis', 'America/Kentucky/Louisville',
  // Canada
  'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg',
  'America/Halifax', 'America/Regina', 'America/St_Johns',
  // Australia and New Zealand
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart', 'Pacific/Auckland',
];

/**
 * Which country a market zone sits in.
 *
 * A town read off a store name — "Irvine" — matches towns of that name worldwide,
 * so the search needs a country. The file already says which one: the zone was
 * worked out from the pickup times. Anything outside the list returns nothing
 * rather than a guess, and the dasher types their own — a wrong country would aim
 * every lookup at the wrong continent, which is worse than an empty box.
 */
const ZONE_COUNTRY = [
  [/^(America\/(Los_Angeles|Denver|Phoenix|Chicago|New_York|Detroit|Boise|Anchorage|Indiana|Kentucky)|Pacific\/Honolulu)/, 'USA'],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/, 'Canada'],
  [/^Australia\//, 'Australia'],
  [/^Pacific\/Auckland/, 'New Zealand'],
];
export function zoneCountry(tz = getTimeZone()) {
  for (const [pattern, name] of ZONE_COUNTRY) if (pattern.test(tz)) return name;
  return '';
}

const COMMON_ZONES = MARKET_ZONES;

/**
 * "America/Los Angeles (UTC−8 / −7)" — the offset is how most people know their
 * zone, but the name is what gets stored, because only a named zone knows which
 * offset applies on a given date. Both offsets are shown where they differ.
 */
const labelCache = new Map();
export function zoneLabel(tz) {
  if (labelCache.has(tz)) return labelCache.get(tz);
  const pretty = tz.replace(/_/g, ' ');
  let label = pretty;
  try {
    const at = (month) => {
      const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
      const raw = f.formatToParts(new Date(Date.UTC(2026, month, 15, 12)))
        .find((p) => p.type === 'timeZoneName').value;              // "GMT-08:00"
      return raw.replace('GMT', '').replace('−', '-') || '+00:00';
    };
    const trim = (o) => (o === '' ? '+0' : o.replace(/:00$/, '').replace(/^([+-])0(\d)/, '$1$2'));
    const minutes = (o) => {
      const m = o.match(/^([+-])(\d+)(?::(\d+))?/);
      return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
    };
    // Ascending, so the pair reads the same way in both hemispheres — January
    // first would print Adelaide as "+10:30 / +9:30".
    const pair = [trim(at(0)), trim(at(6))].sort((a, b) => minutes(a) - minutes(b));
    const offsets = pair[0] === pair[1] ? pair[0] : `${pair[0]} / ${pair[1]}`;
    label = `${pretty} (UTC${offsets})`.replace(/-/g, '\u2212');    // proper minus sign
  } catch { /* keep the plain name */ }
  labelCache.set(tz, label);
  return label;
}
const byFamiliarity = (a, b) => {
  const rank = (z) => { const i = COMMON_ZONES.indexOf(z); return i === -1 ? COMMON_ZONES.length : i; };
  return rank(a) - rank(b) || a.localeCompare(b);
};
const WRONG_BY = 0.2;   // 20 points worse than the best fit is not a night-shift habit

const hourIn = (tz) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit' });
  return (d) => Number(f.format(d)) % 24;
};

function mealShare(times, tz) {
  const hour = hourIn(tz);
  let hit = 0;
  for (const t of times) if (MEAL_HOURS(hour(t))) hit++;
  return times.length ? hit / times.length : 0;
}

/**
 * Read the zone off the data instead of asking for it.
 *
 * Every market zone is scored over the whole file, not at one offset: a file that
 * crosses a daylight-saving change scores worse under a zone that does not observe
 * one, which is what separates Los Angeles from Phoenix. When the span cannot tell
 * two zones apart they read the file identically anyway, so the tie is harmless and
 * is broken toward the more populous one.
 *
 * @returns {{ zone, share, runnerUp, decisive, weak }}
 */
export function inferTimeZone(times) {
  if (times.length < 20) return null;

  // Scoring is a formatter call per order per zone; a long history does not need
  // all of it to establish a daily rhythm.
  const sample = times.length > 2000
    ? times.filter((_, i) => i % Math.ceil(times.length / 2000) === 0)
    : times;

  const scored = MARKET_ZONES
    .map((tz) => ({ tz, share: mealShare(sample, tz) }))
    .sort((a, b) => b.share - a.share || byFamiliarity(a.tz, b.tz));

  const [best, second] = scored;
  return {
    zone: best.tz,
    share: best.share,
    runnerUp: second?.tz ?? null,
    weak: best.share < 0.6,   // no zone makes this file look like delivery work
  };
}

/** Does the active zone still make sense? Kept for the manual-override case. */
export function checkTimeZone(times) {
  const inferred = inferTimeZone(times);
  if (!inferred) return { currentShare: null, bestShare: null, looksWrong: false, suggestions: [] };
  const currentShare = mealShare(times, zone);
  return {
    currentShare,
    bestShare: inferred.share,
    looksWrong: inferred.share - currentShare > WRONG_BY,
    suggestions: [inferred.zone, inferred.runnerUp].filter((z) => z && z !== zone),
  };
}

/** "Aug 30" from a YYYY-MM-DD, for headings rather than tables. */
export const formatDay = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/** Accepts what DoorDash shows ("33h 29m"), plus "33:29", "33.5h", "2009m", "2009". */
export function parseDuration(text) {
  const s = String(text).trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+(?:\.\d+)?)\s*m)?/);
  if (m) return Math.round(Number(m[1]) * 60 + Number(m[2] ?? 0));
  m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?/);
  if (m) return Math.round(Number(m[1]));
  m = s.match(/^\d+(?:\.\d+)?$/);
  if (m) return Math.round(Number(s));
  return null;
}

export const formatDuration = (min) =>
  min == null ? '—' : `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

/**
 * A span for reading rather than entry. Always whole units, never a decimal — "4h"
 * hides whether it is 4.0 or 4.4, and "23.8 min" is precision nobody acts on.
 * Under an hour it drops the leading "0h" instead of padding it.
 */
export function formatSpan(min) {
  if (min == null || Number.isNaN(min)) return '—';
  const total = Math.round(min);
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** "$996.43", "996,43" style noise stripped. */
export function parseMoney(text) {
  const s = String(text).replace(/[$,\s]/g, '');
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
