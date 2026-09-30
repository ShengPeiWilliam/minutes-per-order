# Rearview

**DoorDash gives merchants a dashboard. Dashers get a pay summary. Rearview reads the export from the driver's seat.**

**[Open Rearview](https://rearview-driver.vercel.app)** · [Docs](https://rearview-driver.vercel.app/#docs)

[![Rearview dashboard](screenshot-dashboard.png)](https://rearview-driver.vercel.app)

## Why

I wanted to know how DoorDash forecasts: how much a region earns, how many orders an hour a dasher can absorb, and how it handles the uncertainty. So in July I started dashing. By month's end I was more curious about my own numbers, and started building a dashboard while I kept dashing. When DoorDash [introduced Brand Center](https://about.doordash.com/en-us/news/doordash-introduces-brand-center) for merchants, I knew dashers needed one too.

## What my own file showed

465 deliveries over two months in Orange County.

| | Figure | Source |
|---|---|---|
| Pay per delivery | **$11.34** | From the file |
| Pay per dash hour | $29.55 | Estimate, runs high |
| Order time (customer wait) | **30.9 min** median | From the file |
| Repeat stores | **39%** of orders | From the file |
| Second drop on a same-store stack | **21.6 min** vs 13.6 solo | Inferred, n = 37 |

Stacking from one counter saves me time and costs the second customer eight minutes.

## Three things that would mislead

- **Hourly rates from the export alone.** It records orders, not the gaps between them, so time comes out short and rates run high. They stay labeled Estimate until real time is typed in.
- **A busy hour as demand.** It shows when I was out, not what the platform had to give.
- **Months by their totals.** The export starts and ends mid month, so changes are compared per day.

## Notes on the design

- **Every figure says where it comes from**: from your file, inferred by a rule, or estimated.
- **A shift is my rule, not DoorDash's**: a gap over an hour starts a new one.

Left open: the question I started with. Forecasting orders by area and hour, with the uncertainty attached.

## Using it

Your file is read in your browser and never uploaded. No export yet? Choose **Try with sample data**, which is made up.

The store map is optional and uses your own Google Maps API key, kept in your browser. Everything else works without one.

A number looks wrong? [Open an issue](https://github.com/ShengPeiWilliam/minutes-per-order/issues).

## Repository

The metric definitions. The interface is not included.

```
code/
  ├── data/      # reading the export: parsing, time zones, trips, shifts
  └── metrics/   # the figures computed from data/
```

Each term in the [Docs](https://rearview-driver.vercel.app/#docs) lives in one place:

| Term | File |
|---|---|
| Trip | `code/data/groups.js` |
| Shift, waiting between trips | `code/data/shifts.js` |
| Dash time, active time | `code/metrics/earnings.js` |
| Order time, before pickup, pickup to door | `code/data/orders.js`, `code/metrics/timing.js` |

**Stack**: JavaScript with no framework, bundled into one page. Google Maps for store lookups.

---

© 2026 William Chen. Not affiliated with or endorsed by DoorDash.
