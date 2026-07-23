# Price intelligence — breaking the middleman's information advantage

The data-science component aimed squarely at the app's stated purpose: a farmer
who knows this month's world reference price for their crop can judge the offer
made at their gate. One who doesn't, can't. That asymmetry *is* the middleman's
margin.

**Data.** World Bank Commodity Price Data ("Pink Sheet"): monthly since 1960,
free, CC BY 4.0 — including the literal **Tea, Colombo** series (Ceylon tea's
own auction), coffee (arabica + robusta), rubber RSS3, cocoa, and coconut oil.

**Method.** Walk-forward backtest (60 monthly origins, horizons 1–3) of five
forecasters — naive, seasonal naive, drift, damped ETS, gradient boosting on
lags — scored by MAPE per commodity. The measured winner ships; if that is the
naive model, the naive model ships and is labelled as such. Forecast bands are
the 10th–90th percentile of *real* backtest errors, not theoretical intervals.

**What the farmer sees** (sell flow, results screen, Sinhala/Tamil/English):
current reference price per kg, a 24-month sparkline, "higher than X% of the
last 5 years", what *their* stated harvest quantity is worth at that reference,
and next month's honest range. Cinnamon/pepper/cardamom have no world series,
and the app says so instead of inventing one.

## Files

| File | What |
|---|---|
| `PlotProof_Price_Intelligence.ipynb` | Download → parse → EDA → backtest → model selection → `prices.json`. Upload to Colab, Runtime → Run all (~5–10 min, CPU). |

## Workflow

1. Run the notebook in Colab; it downloads `prices.json`.
2. Commit it to `public/models/prices.json` and deploy. Until the file exists
   the sell flow shows no price section at all — an honest absence.
3. Re-run monthly (the Pink Sheet updates at the start of each month).

## Honesty contract

- Reference prices are auction/FOB world prices, not farm-gate offers — stated
  on screen, in three languages.
- The model card in the JSON carries the chosen model's backtest MAPE *next to
  the naive baseline's*, so a random walk can never be dressed up as AI.
- Products without a real series get an explicit "no series exists" message.
