"""
FintekPro Python Analytics — Return Forecasting + SIP Simulator
================================================================
Endpoints
---------
POST /api/forecasting/return-forecast
    Monte Carlo projections, stress testing, drawdown analysis, risk-adjusted ratios.
POST /api/forecasting/sip-simulate
    Vectorised SIP projections with inflation adjustment, step-up SIP, and XIRR.
"""
from fastapi import APIRouter, Depends, Body
from auth import verify_token, TokenPayload
import numpy as np
from scipy.optimize import brentq
from scipy import stats
from typing import Optional, Dict, Any, List
from datetime import date, timedelta

router = APIRouter(prefix="/api/forecasting", tags=["forecasting"])

RF_ANNUAL = 0.0715      # India 10Y G-Sec (Mar 2026)
TRADING_DAYS = 252


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _xirr(cashflows: List[Dict]) -> Optional[float]:
    """Compute XIRR from [{date, amount}] using Brent's method."""
    if len(cashflows) < 2:
        return None
    t0 = date.fromisoformat(str(cashflows[0]["date"]))
    try:
        years = [(date.fromisoformat(str(cf["date"])) - t0).days / 365.0 for cf in cashflows]
        amounts = [float(cf["amount"]) for cf in cashflows]

        def npv(r):
            return sum(a / (1 + r) ** t for a, t in zip(amounts, years))

        try:
            return round(brentq(npv, -0.999, 10.0, maxiter=500), 6)
        except ValueError:
            return None
    except Exception:
        return None


def _max_drawdown(nav_series: np.ndarray) -> float:
    """Maximum drawdown from a NAV/price array."""
    peak = np.maximum.accumulate(nav_series)
    drawdowns = (nav_series - peak) / peak
    return float(round(drawdowns.min() * 100, 4))


def _sharpe(annual_return: float, annual_vol: float, rf: float = RF_ANNUAL) -> Optional[float]:
    if annual_vol <= 0:
        return None
    return round((annual_return - rf) / annual_vol, 4)


def _sortino(annual_return: float, downside_dev: float, rf: float = RF_ANNUAL) -> Optional[float]:
    if downside_dev <= 0:
        return None
    return round((annual_return - rf) / downside_dev, 4)


def _calmar(annual_return: float, max_dd: float) -> Optional[float]:
    if max_dd == 0:
        return None
    return round(annual_return / abs(max_dd / 100), 4)


STRESS_SCENARIOS = {
    "market_crash":      {"label": "Market Crash (-40%)", "equity": -0.40, "debt": 0.05, "gold": 0.15, "real_estate": -0.20, "mutual_fund": -0.35, "bond": 0.04, "fd": 0.07, "etf": -0.38},
    "moderate_correction": {"label": "Moderate Correction (-20%)", "equity": -0.20, "debt": 0.03, "gold": 0.05, "real_estate": -0.08, "mutual_fund": -0.18, "bond": 0.03, "fd": 0.07, "etf": -0.19},
    "stagflation":       {"label": "Stagflation", "equity": -0.15, "debt": -0.08, "gold": 0.25, "real_estate": 0.05, "mutual_fund": -0.12, "bond": -0.06, "fd": 0.08, "etf": -0.14},
    "bull_market":       {"label": "Bull Market (+30%)", "equity": 0.30, "debt": 0.06, "gold": -0.05, "real_estate": 0.15, "mutual_fund": 0.28, "bond": 0.05, "fd": 0.07, "etf": 0.29},
    "rate_hike":         {"label": "Rate Hike (+200bps)", "equity": -0.10, "debt": -0.12, "gold": -0.03, "real_estate": -0.05, "mutual_fund": -0.09, "bond": -0.11, "fd": 0.08, "etf": -0.10},
}


# ---------------------------------------------------------------------------
# Return Forecast Endpoint
# ---------------------------------------------------------------------------

@router.post("/return-forecast")
async def return_forecast(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Comprehensive return analysis and forward projections.

    Input:
      assetType     : equity | mutual_fund | bond | fd | gold | real_estate | etf
      currentValue  : current portfolio value (₹)
      purchaseValue : original investment amount (₹)
      purchaseDate  : YYYY-MM-DD
      annualReturn  : expected annual return % (e.g. 12.5)
      annualVolatility : annualised std dev % (e.g. 18.0) — optional
      benchmarkReturn  : benchmark annual return % (e.g. 11.0) — optional
      navHistory    : [{date, nav}] — optional, improves accuracy
      horizons      : [1, 3, 5, 10] — projection years (default [1,3,5,10])
      simulations   : Monte Carlo paths (default 5000)
    """
    try:
        asset_type   = str(payload.get("assetType", "equity")).lower()
        current_val  = float(payload.get("currentValue", 0))
        purchase_val = float(payload.get("purchaseValue", current_val))
        purchase_date_str = str(payload.get("purchaseDate", str(date.today())))
        annual_return_pct = float(payload.get("annualReturn", 12.0))
        annual_vol_pct    = float(payload.get("annualVolatility", 18.0 if asset_type in ("equity","mutual_fund","etf") else 8.0))
        benchmark_pct     = float(payload.get("benchmarkReturn", 11.0))
        horizons          = [int(h) for h in payload.get("horizons", [1, 3, 5, 10])]
        n_sim             = int(payload.get("simulations", 5000))
        nav_history       = payload.get("navHistory", [])

        purchase_date = date.fromisoformat(purchase_date_str)
        today = date.today()
        holding_years = max((today - purchase_date).days / 365.0, 1/365)

        mu = annual_return_pct / 100.0
        sigma = annual_vol_pct / 100.0
        bm_mu = benchmark_pct / 100.0

        # ── Historical metrics from nav_history ─────────────────────────
        nav_metrics: Dict[str, Any] = {}
        if len(nav_history) >= 10:
            navs = np.array([float(n["nav"]) for n in sorted(nav_history, key=lambda x: x["date"])])
            daily_rets = np.diff(navs) / navs[:-1]
            actual_vol = float(np.std(daily_rets, ddof=1)) * np.sqrt(TRADING_DAYS)
            sigma = actual_vol  # override with actual
            nav_metrics["actualVolatility"] = round(actual_vol * 100, 4)
            nav_metrics["maxDrawdown"] = _max_drawdown(navs)
            neg_rets = daily_rets[daily_rets < RF_ANNUAL / TRADING_DAYS]
            downside_dev = float(np.std(neg_rets, ddof=1)) * np.sqrt(TRADING_DAYS) if len(neg_rets) > 1 else sigma
            nav_metrics["downsideDeviation"] = round(downside_dev * 100, 4)
        else:
            nav_metrics["actualVolatility"] = annual_vol_pct
            nav_metrics["maxDrawdown"] = None
            neg_sigma = sigma * 0.7
            downside_dev = neg_sigma

        # ── Current performance ──────────────────────────────────────────
        abs_return = round((current_val - purchase_val) / purchase_val * 100, 4) if purchase_val else 0
        cagr = round(((current_val / purchase_val) ** (1 / holding_years) - 1) * 100, 4) if purchase_val and holding_years > 0 else 0
        alpha = round(cagr / 100 - bm_mu, 4)
        sharpe = _sharpe(mu, sigma)
        sortino = _sortino(mu, downside_dev)
        max_dd = nav_metrics.get("maxDrawdown")
        calmar = _calmar(mu, max_dd) if max_dd is not None else None
        info_ratio = round((mu - bm_mu) / (sigma * 0.5 + 1e-9), 4) if sigma > 0 else None

        # ── Forward projections (Monte Carlo) ────────────────────────────
        rng = np.random.default_rng(42)
        projections = []
        for h in horizons:
            annual_steps = h * 12  # monthly steps
            mu_monthly = mu / 12
            sigma_monthly = sigma / np.sqrt(12)
            # Monte Carlo: log-normal paths
            paths = rng.normal(mu_monthly - 0.5 * sigma_monthly**2, sigma_monthly, (n_sim, annual_steps))
            corpus = current_val * np.exp(paths.cumsum(axis=1)[:, -1])
            mean_val = float(np.mean(corpus))
            p5  = float(np.percentile(corpus, 5))
            p25 = float(np.percentile(corpus, 25))
            p75 = float(np.percentile(corpus, 75))
            p95 = float(np.percentile(corpus, 95))
            prob_loss = float((corpus < purchase_val).mean() * 100)
            # Normal distribution CI for annotation
            expected_val = current_val * (1 + mu) ** h
            projections.append({
                "years": h,
                "expectedValue": round(expected_val, 2),
                "monteCarloMean": round(mean_val, 2),
                "p5": round(p5, 2),
                "p25": round(p25, 2),
                "p75": round(p75, 2),
                "p95": round(p95, 2),
                "probabilityOfLoss": round(prob_loss, 2),
                "expectedReturn": round((expected_val / current_val - 1) * 100, 2) if current_val else 0,
            })

        # ── Stress scenarios ─────────────────────────────────────────────
        stress = []
        for sc_key, sc in STRESS_SCENARIOS.items():
            impact_pct = sc.get(asset_type, sc.get("equity", -0.20))
            stressed_val = round(current_val * (1 + impact_pct), 2)
            stress.append({
                "scenario": sc_key,
                "label": sc["label"],
                "impactPct": round(impact_pct * 100, 2),
                "stressedValue": stressed_val,
                "loss": round(current_val - stressed_val, 2),
            })

        return {
            "assetType": asset_type,
            "currentPerformance": {
                "absoluteReturn": abs_return,
                "cagr": cagr,
                "holdingYears": round(holding_years, 2),
                "alpha": round(alpha * 100, 4),
            },
            "riskAdjustedMetrics": {
                "sharpeRatio": sharpe,
                "sortinoRatio": sortino,
                "calmarRatio": calmar,
                "informationRatio": info_ratio,
                "annualVolatility": round(sigma * 100, 4),
                "downsideDeviation": round(downside_dev * 100, 4),
                **nav_metrics,
            },
            "forwardProjections": projections,
            "stressScenarios": stress,
            "parameters": {
                "expectedAnnualReturn": annual_return_pct,
                "annualVolatility": round(sigma * 100, 4),
                "riskFreeRate": round(RF_ANNUAL * 100, 4),
                "monteCarloSimulations": n_sim,
            },
            "modelVersion": "py-return-forecast-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# SIP Simulator Endpoint
# ---------------------------------------------------------------------------

@router.post("/sip-simulate")
async def sip_simulate(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Vectorised SIP projection engine.

    Input:
      sipAmount       : monthly SIP amount (₹)
      horizonMonths   : investment horizon in months
      expectedReturn  : expected annual return % (e.g. 12.0)
      inflationRate   : annual inflation % (e.g. 6.0) — optional, default 6.0
      stepUpPct       : annual SIP step-up % (e.g. 10 for 10% increase each year) — optional
      existingCorpus  : starting corpus (₹) — optional, default 0
      targetCorpus    : goal amount (₹) — optional, returns months-to-goal
      benchmarkReturn : benchmark annual return % — for comparison
    """
    try:
        sip_amount     = float(payload.get("sipAmount", 5000))
        horizon        = int(payload.get("horizonMonths", 120))
        annual_return  = float(payload.get("expectedReturn", 12.0))
        inflation_rate = float(payload.get("inflationRate", 6.0))
        step_up_pct    = float(payload.get("stepUpPct", 0.0))
        corpus0        = float(payload.get("existingCorpus", 0.0))
        target_corpus  = payload.get("targetCorpus")
        bm_return      = float(payload.get("benchmarkReturn", 11.0))

        monthly_rate = (1 + annual_return / 100) ** (1 / 12) - 1
        monthly_inf  = (1 + inflation_rate / 100) ** (1 / 12) - 1
        monthly_bm   = (1 + bm_return / 100) ** (1 / 12) - 1

        # Vectorised month-by-month computation
        months = np.arange(1, horizon + 1)

        # SIP amount for each month (with optional annual step-up)
        year_idx = (months - 1) // 12
        sip_amounts = sip_amount * (1 + step_up_pct / 100) ** year_idx

        # Portfolio value = existing_corpus * (1+r)^n + SIP future value
        corpus_growth = corpus0 * (1 + monthly_rate) ** months

        # SIP future value: each payment grows for remaining months
        # Vectorised: sip_i × (1+r)^(n−i+1)  for i=1..n
        month_idx = np.arange(horizon)
        remaining = horizon - month_idx  # months each SIP grows
        sip_fv_each = sip_amounts * (1 + monthly_rate) ** remaining
        cumulative_sip_fv = np.cumsum(sip_fv_each)

        # Benchmark comparison
        sip_fv_bm_each = sip_amounts * (1 + monthly_bm) ** remaining
        cumulative_bm_fv = np.cumsum(sip_fv_bm_each)

        corpus_total = corpus_growth + cumulative_sip_fv
        corpus_bm    = corpus0 * (1 + monthly_bm) ** months + cumulative_bm_fv

        total_invested = corpus0 + np.cumsum(sip_amounts)
        real_value     = corpus_total / (1 + monthly_inf) ** months

        # Monthly snapshots (every 6 months to keep payload small)
        step = max(1, horizon // 60)
        snapshot_idx = np.concatenate([np.arange(0, horizon, step), [horizon - 1]])
        snapshot_idx = np.unique(snapshot_idx.astype(int))

        snapshots = [
            {
                "month": int(months[i]),
                "year": round(float(months[i]) / 12, 1),
                "invested": round(float(total_invested[i]), 2),
                "corpus": round(float(corpus_total[i]), 2),
                "benchmarkCorpus": round(float(corpus_bm[i]), 2),
                "realValue": round(float(real_value[i]), 2),
                "totalReturn": round(float(corpus_total[i] - total_invested[i]), 2),
                "returnPct": round((float(corpus_total[i]) / float(total_invested[i]) - 1) * 100, 2) if total_invested[i] > 0 else 0,
                "monthlySip": round(float(sip_amounts[i]), 2),
            }
            for i in snapshot_idx
        ]

        final_corpus   = float(corpus_total[-1])
        final_invested = float(total_invested[-1])
        final_real     = float(real_value[-1])
        wealth_gained  = final_corpus - final_invested

        # XIRR approximation (internal rate of return on cashflows)
        xirr_cfs = [{"date": str(date.today() - timedelta(days=horizon * 30)), "amount": -corpus0}]
        cumulative_m = 0
        for i in range(horizon):
            cf_date = date.today() - timedelta(days=(horizon - i - 1) * 30)
            xirr_cfs.append({"date": str(cf_date), "amount": -float(sip_amounts[i])})
        xirr_cfs.append({"date": str(date.today()), "amount": final_corpus})
        xirr_val = _xirr(xirr_cfs)

        # Months to target
        months_to_goal = None
        if target_corpus:
            tc = float(target_corpus)
            idx = np.searchsorted(corpus_total, tc)
            months_to_goal = int(months[idx]) if idx < horizon else None

        return {
            "summary": {
                "totalInvested": round(final_invested, 2),
                "finalCorpus": round(final_corpus, 2),
                "wealthGained": round(wealth_gained, 2),
                "inflationAdjustedCorpus": round(final_real, 2),
                "totalReturnPct": round(wealth_gained / final_invested * 100, 2) if final_invested > 0 else 0,
                "xirr": round(xirr_val * 100, 4) if xirr_val else None,
                "benchmarkFinalCorpus": round(float(corpus_bm[-1]), 2),
                "alphaVsBenchmark": round(final_corpus - float(corpus_bm[-1]), 2),
                "monthsToGoal": months_to_goal,
            },
            "monthlySnapshots": snapshots,
            "parameters": {
                "sipAmount": sip_amount,
                "horizonMonths": horizon,
                "expectedAnnualReturn": annual_return,
                "inflationRate": inflation_rate,
                "stepUpPct": step_up_pct,
                "existingCorpus": corpus0,
                "finalMonthlySip": round(float(sip_amounts[-1]), 2),
            },
            "modelVersion": "py-sip-v1",
        }

    except Exception as e:
        return {"error": str(e)}
