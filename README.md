# House Utility Splitter

A utility-bill calculator for shared homes. Split electricity, room air-conditioner usage, and water bills fairly between tenants.

[Open the live app](https://utilitycalculator.netlify.app/)

## What it does

- Calculates the electricity rate after applying the previous month's balance.
- Tracks each room's air-conditioner sub-meter and splits its cost only among that room's tenants.
- Splits unmetered common-area electricity and water costs across every tenant.
- Supports rounded-up, rounded, exact, and manual electricity rates.
- Saves the current bill and statement history in the browser with `localStorage`.
- Creates a copyable payment summary and a printable A4 statement.
- Rolls readings and any calculated balance forward for the next billing period.

## How the calculation works

1. The unit rate is calculated from `(electric bill - previous balance) / total grid kWh`.
2. Each room's AC usage is `current meter - previous meter`.
3. Remaining grid usage is treated as common-area electricity and divided among all tenants.
4. Water is divided equally among all tenants.
5. Each tenant pays their common electricity, room AC share, and water share.

## Project structure

```
public/                        Browser application, styles, and printable invoice
src_python/calculator.py       Shared calculation engine and interactive CLI
src_python/test_calculator.py  Unit test for the calculation rules
netlify/functions/calculate.py Netlify API handler using the Python engine
netlify.toml                   Netlify publish, function, and API routing settings
```

## Run locally

Preview the browser app:

```bash
python3 -m http.server 8000 --directory public
```

Then open <http://localhost:8000>.

Run the command-line calculator:

```bash
python3 src_python/main.py
```

Run the tests:

```bash
cd src_python
python3 test_calculator.py
```

## Deploy

The project is configured for Netlify: it publishes `public/` and serves Python functions from `netlify/functions/`.
