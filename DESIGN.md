# Design notes

## Why I built it

DoorDash already lets any driver request their delivery data. The file is free, but it's a spreadsheet of timestamps. On its own, it doesn't tell you anything.

I deliver, and I study data science. Rearview is what I could do from both sides: take the file drivers already have, and turn it into answers they can feel. Which stores you keep going back to. Whether your hours are getting better or worse. Where an hour of yours actually goes.

## What it is, and isn't

Driver apps already track miles, suggest busy hours, and count tax deductions, often across every app a driver works for. Those are built for all drivers at once.

Rearview is narrower on purpose. It's a close look at the one file your platform gives you, so every answer is about you, not drivers in general.

## What I left out, and why

- **Full car cost.** Wear and depreciation vary too much between cars. A national average would be wrong for most drivers, so Rearview counts fuel only.
- **Typing in monthly miles.** Most drivers don't know them. A guessed number would look as exact as a real one.
- **Reading your inbox for the file.** It would save a step, but it asks for access to every email to fetch one file.
- **A rate for time on an order.** It made hourly pay look far better than an hour of your day really is.
- **Requiring every month's dash time.** DoorDash shows it by the week, so adding up a month is a chore. One real week is enough to correct the rest; a month can still be entered if you have it.

## If I keep going

- Forecasting orders by area and hour, with the uncertainty attached. The question I started with.
- Reading other platforms' exports.
- Opening the file straight from your phone's share button, so there's no file to pick at all.
