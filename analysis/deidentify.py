"""De-identify a DoorDash delivery export for publishing.

Three things, nothing else:

1. Keep only the four columns Rearview reads. Anything else in the export
   (item counts, subtotals, status, and any future column) is dropped.
2. Replace each store name with a code. The same store always gets the same
   code, so repeat visits are still countable; codes are assigned busiest
   store first, so they carry no trace of the names.
3. Shift every timestamp back by a whole number of weeks. The weekday and the
   time of day survive, so every metric comes out identical, but the calendar
   dates do not. The number of weeks is passed on the command line and is not
   stored anywhere in this repository.

   The shift is done in UTC, so it only keeps local time of day if both dates sit
   on the same side of a daylight-saving change: moved from July into January, a
   6 pm pickup would read as 5 pm. Any row where the local UTC offset changes
   stops the run instead of writing a file whose hours are quietly off.

Usage:
    python analysis/deidentify.py data/dasher_delivery_information.csv \
        sample/sample_delivery_information.csv --shift-weeks N
"""

import argparse
import csv
from collections import Counter
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

COLUMNS = ["ORDER_CREATED_TIME", "ACTUAL_PICKUP_TIME", "ACTUAL_DELIVERY_TIME", "STORE_NAME"]
TIME_COLUMNS = COLUMNS[:3]


def shift(stamp: str, delta: timedelta) -> str:
    """'2020-03-14 18:30:05.123000000' moved by `delta`, fractional part kept as written."""
    whole, _, frac = stamp.partition(".")
    moved = datetime.strptime(whole, "%Y-%m-%d %H:%M:%S") - delta
    return moved.strftime("%Y-%m-%d %H:%M:%S") + (f".{frac}" if frac else "")


def utc_offset(stamp: str, zone: ZoneInfo) -> timedelta:
    """The local offset from UTC at this moment, e.g. -7 h in a Los Angeles summer."""
    moment = datetime.strptime(stamp.partition(".")[0], "%Y-%m-%d %H:%M:%S")
    return moment.replace(tzinfo=timezone.utc).astimezone(zone).utcoffset()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("target")
    ap.add_argument("--shift-weeks", type=int, required=True,
                    help="whole weeks to move every timestamp back")
    ap.add_argument("--tz", default="America/Los_Angeles",
                    help="the dasher's time zone, used only to check daylight saving")
    args = ap.parse_args()
    zone = ZoneInfo(args.tz)

    with open(args.source, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    missing = [c for c in COLUMNS if c not in rows[0]]
    if missing:
        raise SystemExit(f"missing columns: {missing}")

    # Busiest store first, ties broken by name so the codes are stable run to run.
    counts = Counter(r["STORE_NAME"].strip() for r in rows)
    ranked = sorted(counts, key=lambda s: (-counts[s], s))
    width = len(str(len(ranked)))
    code = {s: f"Store {i + 1:0{width}d}" for i, s in enumerate(ranked)}

    delta = timedelta(weeks=args.shift_weeks)
    for i, r in enumerate(rows, start=2):
        for c in TIME_COLUMNS:
            stamp = r[c].strip()
            if utc_offset(stamp, zone) != utc_offset(shift(stamp, delta), zone):
                raise SystemExit(
                    f"line {i}, {c}: shifting {args.shift_weeks} weeks crosses a daylight-saving "
                    f"change in {args.tz}, so local times would move by an hour. "
                    "Pick a number of weeks that keeps every date in the same season.")
    with open(args.target, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(COLUMNS)
        for r in rows:
            w.writerow([shift(r[c].strip(), delta) for c in TIME_COLUMNS] + [code[r["STORE_NAME"].strip()]])

    print(f"{len(rows)} rows, {len(ranked)} stores -> {args.target}")


if __name__ == "__main__":
    main()
