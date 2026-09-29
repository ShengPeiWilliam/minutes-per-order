// Time handling. Export timestamps are UTC; every date and hour is read in the dasher's zone.

const FALLBACK_TZ = 'America/Los_Angeles';

export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch { return FALLBACK_TZ; }
}

let zone = detectTimeZone();
export const getTimeZone = () => zone;

export function setTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });   // throws on a bad zone
    zone = tz;
    formatters.clear();
    return true;
  } catch { return false; }
}

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

/** Parses an export timestamp as UTC. Fractional seconds are ignored. */
export function parseUtc(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
}

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

/** Date, hour and weekday in the current zone. */
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

/** Monday of the week, as YYYY-MM-DD. */
export function weekStart(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthStart = (dateStr) => `${dateStr.slice(0, 7)}-01`;

export function monthEnd(monthStartDate) {
  const d = new Date(`${monthStartDate}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function formatMonth(monthStartDate) {
  const d = new Date(`${monthStartDate}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Delivery work clusters around meals; a zone that puts pickups at night is the wrong zone.
const MEAL_HOURS = (h) => (h >= 10 && h <= 14) || (h >= 17 && h <= 21);

export const MARKET_ZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago',
  'America/New_York', 'America/Detroit', 'America/Boise', 'America/Anchorage',
  'Pacific/Honolulu', 'America/Indiana/Indianapolis', 'America/Kentucky/Louisville',
  'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg',
  'America/Halifax', 'America/Regina', 'America/St_Johns',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart', 'Pacific/Auckland',
];

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

/** The zone that puts the most pickups at mealtimes. */
export function inferTimeZone(times) {
  if (times.length < 20) return null;

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

/** Flags the current zone when another fits the mealtime pattern clearly better. */
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

export const formatDay = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

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

export function formatSpan(min) {
  if (min == null || Number.isNaN(min)) return '—';
  const total = Math.round(min);
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function parseMoney(text) {
  const s = String(text).replace(/[$,\s]/g, '');
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
