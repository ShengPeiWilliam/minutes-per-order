# Rearview

**DoorDash built a great dashboard for restaurants. Rearview reads the export from the driver's seat.**

**[Open Rearview](https://rearview-driver.vercel.app)** · [Docs](https://rearview-driver.vercel.app/#docs)

[![Rearview dashboard](screenshot-dashboard.png)](https://rearview-driver.vercel.app)

## Why

DoorDash built a great dashboard for restaurants, [Brand Center](https://about.doordash.com/en-us/news/doordash-introduces-brand-center). It shows how much a marketplace gains when one side can see its own numbers. Drivers are the third side, and I wanted the same for them.

In July I started delivering to see the marketplace from the inside: how much a region earns, how many orders an hour a driver can absorb, how the platform handles the uncertainty. By month's end I was more curious about my own numbers, so I built the dashboard I wished I had.

## What my own file showed

465 deliveries over two months in Orange County.

| | Figure | Source |
|---|---|---|
| Order time (customer wait) | **30.9 min** median | From the file |
| Repeat stores | **39%** of orders | From the file |
| Second drop on a same-store stack | **21.6 min** vs 13.6 solo | Inferred, n = 37 |
| Fuel | **13%** of pay | Stride miles at 30 mpg, each week's average gas price |

Stacking saves me 1.6 minutes an order. When both orders come from one counter, the second customer waits 8.1 minutes longer than a solo drop.

## Three things that would mislead

- **Hourly rates from the export alone.** It records orders, not the gaps between them, so time comes out short and rates run high. They stay labeled Estimate until you calibrate with one real week from DoorDash.
- **A busy hour as demand.** It shows when I was out, not what the platform had to give.
- **Months by their totals.** The export starts and ends mid month, so changes are compared per day.

## Notes on the design

- **Every figure says where it comes from**: from your file, inferred by a rule, or estimated.
- **A shift is my rule, not DoorDash's**: a gap over an hour starts a new one.

Left open: the question I started with. Forecasting orders by area and hour, with the uncertainty attached.

## Using it

Your file is read in your browser and never uploaded. No export yet? Choose **Try with sample data**, which is made up.

Add a Stride mileage export to see fuel and what an hour paid after it. Only dates and miles are read, never the addresses.

The store map is optional and uses your own Google Maps API key, kept in your browser. Everything else works without one.

A number looks wrong? [Open an issue](https://github.com/ShengPeiWilliam/minutes-per-order/issues).

## Repository

The metric definitions. The interface is not included.

```
code/
  ├── data/         # reading the export: parsing, time zones, trips, shifts
  │   └── rules.js  # every threshold behind a figure, in one file
  └── metrics/      # the figures computed from data/
```

Each term is explained in the [Docs](https://rearview-driver.vercel.app/#docs-methods).

**Stack**: JavaScript with no framework, bundled into one page. Google Maps for store lookups.

---

© 2026 William Chen. Not affiliated with or endorsed by DoorDash or Stride.
