# Rearview

A dashboard for delivery drivers. Three views of your deliveries, built from the export DoorDash lets you download, read in your browser and never uploaded.

**Quick start:** [Open Rearview with sample data](https://rearview-driver.vercel.app/#sample). No file needed. Have your export? [Drop it in](https://rearview-driver.vercel.app); the page shows where to get it.

## Why Rearview?

DoorDash built [a great dashboard for restaurants](https://about.doordash.com/en-us/news/doordash-introduces-brand-center). It shows how much a marketplace gains when one side can see its own numbers. Drivers are the third side.

The pay screen shows what you earned. It doesn't show what an hour paid after gas, how long your customers waited, or which stores you keep going back to. So I started delivering to see the marketplace from the inside, and built the dashboard I wished I had. What my own file showed is in [this post](https://www.linkedin.com/feed/update/urn:li:activity:7511199326451269632/).

Rearview adds:

- **Every figure is labeled** by where it comes from: your file, a rule, or an estimate. [See how each is worked out](https://rearview-driver.vercel.app/#docs-methods).
- **One real week corrects the estimates.**
- **Stride miles, matched to your DoorDash days.**

## What it answers

**Drive**, your choices
- **Earnings**: what a delivery pays, what an hour pays, and how much of it goes to gas.
- **Driving**: how far you drive for each order, and which days ran long.
- **Analytics**: when your orders come in, and which weekday has the longest wait between trips.
- **Goal**: the hours, or the rate, that would reach a monthly goal.
- **Report**: the whole file as one page you can save as a PDF.

**Platform**, what the platform decides
- How long customers wait, and what makes it longer.
- What carrying two orders costs the second customer.

**Stores**, where you pick up
- Which stores you keep going back to.
- Which towns your stores are in, and whether the kind of store you pick up from is changing.

Gas and driving need a Stride export, and pay figures need your monthly total.

This repository holds the metric definitions. The interface is not included.

---

Created by [William Chen](https://www.linkedin.com/in/shengpeichen). Not affiliated with or endorsed by DoorDash or Stride.
