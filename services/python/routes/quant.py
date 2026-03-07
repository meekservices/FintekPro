from fastapi import APIRouter, Depends, Body
from auth import verify_token, TokenPayload
from database import db_conn
import pandas as pd
import numpy as np
from scipy.optimize import brentq, minimize
from scipy import stats
from sklearn.covariance import LedoitWolf
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/api/quant", tags=["quant"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _xirr(cashflows: List[tuple]) -> float:
    """XIRR: list of (date, amount) tuples. Negative = outflow, positive = inflow."""
    if not cashflows or len(cashflows) < 2:
        return 0.0
    dates = [cf[0] for cf in cashflows]
    amounts = [cf[1] for cf in cashflows]
    base_date = dates[0]

    def npv(rate: float) -> float:
        return sum(
            amt / (1 + rate) ** ((d - base_date).days / 365.0)
            for d, amt in zip(dates, amounts)
        )

    try:
        result = brentq(npv, -0.999, 100.0, maxiter=1000, xtol=1e-8)
        return round(result * 100, 2)
    except (ValueError, RuntimeError):
        return 0.0


def _ewma_returns_and_cov(
    returns_matrix: np.ndarray,
    ewma_span: int = 60,
    shrinkage: float = 0.1,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute EWMA expected returns and Ledoit-Wolf shrunk covariance matrix.
    returns_matrix: shape (n_assets, T_observations) — daily returns
    Returns: (mu_annual, cov_annual_shrunk)
    """
    n, T = returns_matrix.shape
    lam = 2.0 / (ewma_span + 1)

    # Exponential weights (most recent observation gets highest weight)
    time_weights = np.array([(1 - lam) ** i for i in range(T - 1, -1, -1)])
    time_weights /= time_weights.sum()

    # EWMA mean (daily)
    mu_daily = returns_matrix @ time_weights

    # Annualise
    mu_annual = mu_daily * 252

    # EWMA sample covariance (daily)
    R_c = returns_matrix - mu_daily[:, np.newaxis]
    cov_daily_ewma = (R_c * time_weights) @ R_c.T

    # Ledoit-Wolf on raw (unweighted) sample for structured shrinkage target
    lw = LedoitWolf(assume_centered=False)
    lw.fit(returns_matrix.T)  # expects (T, n)
    cov_daily_shrunk = (1 - shrinkage) * cov_daily_ewma + shrinkage * lw.covariance_

    cov_annual = cov_daily_shrunk * 252
    return mu_annual, cov_annual, cov_daily_shrunk


def _mvo_slsqp(
    mu: np.ndarray,
    sigma: np.ndarray,
    current_weights: np.ndarray,
    risk_aversion: float = 3.0,
    gamma: float = 5.0,
    max_pos: float = 0.40,
    min_pos: float = 0.01,
    turnover_cap: float = 0.40,
    max_iter: int = 500,
    tol: float = 1e-9,
) -> np.ndarray:
    """
    Solve the transition-aware MVO problem via scipy SLSQP (proper QP solver).

    Objective: max E[r] - (lambda/2)*w'*Σ*w - gamma*||w - w0||_1
    Equivalent to: min -mu'w + (lambda/2)*w'*Σ*w + gamma*sum(t_i)
    with t_i >= |w_i - w0_i|.

    Variables: x = [w (n), t (n)]
    """
    n = len(mu)

    def obj(x):
        w = x[:n]
        t = x[n:]
        return float(-mu @ w + (risk_aversion / 2) * (w @ sigma @ w) + gamma * t.sum())

    def obj_grad(x):
        w = x[:n]
        t = x[n:]  # noqa: F841 (unused, needed for signature)
        gw = -mu + risk_aversion * sigma @ w
        gt = np.full(n, gamma)
        return np.concatenate([gw, gt])

    constraints = [
        {"type": "eq", "fun": lambda x: x[:n].sum() - 1.0, "jac": lambda x: np.concatenate([np.ones(n), np.zeros(n)])},
    ]
    for i in range(n):
        w0_i = current_weights[i]
        constraints.append({"type": "ineq", "fun": lambda x, i=i, w0=w0_i: x[n + i] - x[i] + w0})
        constraints.append({"type": "ineq", "fun": lambda x, i=i, w0=w0_i: x[n + i] + x[i] - w0})

    # Turnover cap: sum(t) <= turnover_cap * 2 (sum|w-w0| = 2 * one-sided turnover)
    if turnover_cap < 1.0:
        constraints.append({"type": "ineq", "fun": lambda x: turnover_cap * 2 - x[n:].sum()})

    x0 = np.concatenate([current_weights, np.zeros(n)])
    bounds = [(min_pos, max_pos)] * n + [(0.0, max_pos)] * n

    res = minimize(obj, x0, jac=obj_grad, method="SLSQP", bounds=bounds,
                   constraints=constraints, options={"maxiter": max_iter, "ftol": tol})

    opt_w = np.clip(res.x[:n], min_pos, max_pos)
    opt_w /= opt_w.sum()
    return opt_w, res


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/xirr")
async def calculate_xirr(
    cashflows: List[dict] = Body(..., description='[{"date": "YYYY-MM-DD", "amount": -10000}, ...]'),
    token: TokenPayload = Depends(verify_token),
):
    try:
        parsed = [
            (pd.Timestamp(cf["date"]).to_pydatetime().date(), float(cf["amount"]))
            for cf in cashflows
        ]
        rate = _xirr(parsed)
        return {"xirr_pct": rate, "cashflow_count": len(parsed)}
    except Exception as e:
        return {"error": str(e), "xirr_pct": None}


@router.get("/portfolio-xirr")
async def portfolio_xirr(
    user_id: Optional[int] = None,
    token: TokenPayload = Depends(verify_token),
):
    target_id = user_id if (user_id and token.role in ("agent", "admin")) else token.user_id

    async with db_conn() as conn:
        txns = await conn.fetch(
            """
            SELECT transaction_date, amount, transaction_type
            FROM mf_transactions
            WHERE user_id = $1
            ORDER BY transaction_date
            """,
            target_id,
        )
        current = await conn.fetchrow(
            """
            SELECT SUM(current_value) as total_current
            FROM comprehensive_holdings
            WHERE user_id = $1
              AND holding_date = (SELECT MAX(holding_date) FROM comprehensive_holdings WHERE user_id = $1)
            """,
            target_id,
        )

    if not txns:
        return {"user_id": target_id, "xirr_pct": None, "message": "No transactions found"}

    cashflows = []
    for row in txns:
        txn_type = str(row["transaction_type"]).upper()
        amount = float(row["amount"] or 0)
        if txn_type in ("PURCHASE", "BUY", "SIP", "SWITCH_IN"):
            cashflows.append((row["transaction_date"].date(), -abs(amount)))
        elif txn_type in ("REDEMPTION", "SELL", "SWITCH_OUT"):
            cashflows.append((row["transaction_date"].date(), abs(amount)))

    if current and current["total_current"]:
        cashflows.append((date.today(), float(current["total_current"])))

    rate = _xirr(cashflows)
    return {
        "user_id": target_id,
        "xirr_pct": rate,
        "cashflow_count": len(cashflows),
        "current_value": float(current["total_current"]) if current and current["total_current"] else 0,
    }


@router.get("/rolling-returns")
async def rolling_returns(
    isin: str,
    scheme_code: Optional[str] = None,
    periods: str = "1Y,3Y,5Y",
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute CAGR rolling returns for a mutual fund.
    Accepts `scheme_code` (preferred) or legacy `isin` param (treated as scheme_code for backward compat).
    Reads from mf_nav_history (scheme_code, nav_date, nav).
    """
    lookup_code = scheme_code or isin

    async with db_conn() as conn:
        navs = await conn.fetch(
            """
            SELECT nav_date, nav
            FROM mf_nav_history
            WHERE scheme_code = $1
            ORDER BY nav_date ASC
            LIMIT 5000
            """,
            lookup_code,
        )

    if not navs or len(navs) < 10:
        return {"schemeCode": lookup_code, "error": "Insufficient NAV history", "returns": {}}

    df = pd.DataFrame([dict(r) for r in navs])
    df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
    df["nav_date"] = pd.to_datetime(df["nav_date"])
    df = df.dropna().sort_values("nav_date").set_index("nav_date")

    latest_nav = float(df["nav"].iloc[-1])
    latest_date = df.index[-1]
    results = {}

    period_map = {"1W": 7/365, "1M": 30/365, "3M": 91/365, "6M": 182/365,
                  "1Y": 1, "3Y": 3, "5Y": 5, "10Y": 10}

    for period in periods.split(","):
        period = period.strip().upper()
        years = period_map.get(period)
        if years is None:
            continue
        target_date = latest_date - pd.Timedelta(days=int(years * 365))
        past = df[df.index <= target_date]
        if past.empty:
            results[period] = None
            continue
        past_nav = float(past["nav"].iloc[-1])
        if past_nav <= 0:
            results[period] = None
            continue
        if years >= 1:
            cagr = ((latest_nav / past_nav) ** (1 / years) - 1) * 100
        else:
            cagr = (latest_nav / past_nav - 1) * 100
        results[period] = round(cagr, 4)

    return {
        "schemeCode": lookup_code,
        "latestNav": latest_nav,
        "latestDate": latest_date.strftime("%Y-%m-%d"),
        "dataPoints": len(df),
        "returns": results,
        "modelVersion": "py-rolling-v2",
    }


@router.post("/mvo")
async def mvo_optimize(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Mean-Variance Optimization using scipy SLSQP — proper QP solver with L1 turnover penalty.

    Input:
      assets: [{category, returns: [daily_return, ...], currentWeight}]
      config: {riskAversion, ewmaSpan, shrinkageIntensity, maxAssetWeight, minAssetWeight,
               solverMaxIterations, solverTolerance, covarianceLookbackDays}
      transition: {gamma, maxPosition, turnoverCap}
    """
    try:
        assets = payload["assets"]
        config = payload.get("config", {})
        transition = payload.get("transition", {})

        categories = [a["category"] for a in assets]
        n = len(categories)

        if n < 2:
            return {"error": "Need at least 2 assets for MVO"}

        # Build aligned return matrix (n × T)
        all_returns = [np.array(a["returns"], dtype=float) for a in assets]
        lookback = int(config.get("covarianceLookbackDays", 252))
        all_returns = [r[-lookback:] for r in all_returns]
        min_len = min(len(r) for r in all_returns)
        if min_len < 20:
            return {"error": f"Insufficient return history: {min_len} observations"}
        R = np.array([r[-min_len:] for r in all_returns])  # (n, T)

        # EWMA returns + Ledoit-Wolf shrunk covariance
        ewma_span = int(config.get("ewmaSpan", 60))
        shrinkage = float(config.get("shrinkageIntensity", 0.1))
        mu_annual, cov_annual, cov_daily = _ewma_returns_and_cov(R, ewma_span, shrinkage)

        # Current weights (strategic)
        current_weights = np.array([float(a.get("currentWeight", 1.0 / n)) for a in assets])
        if current_weights.sum() < 1e-8:
            current_weights = np.ones(n) / n
        else:
            current_weights /= current_weights.sum()

        # Constraints / bounds
        risk_aversion = float(config.get("riskAversion", 3.0))
        gamma = float(transition.get("gamma", 5.0))
        max_pos = float(min(
            transition.get("maxPosition", config.get("maxAssetWeight", 0.40)),
            config.get("maxAssetWeight", 0.40),
        ))
        min_pos = float(config.get("minAssetWeight", 0.01))
        turnover_cap = float(transition.get("turnoverCap", 0.40))
        max_iter = int(config.get("solverMaxIterations", 500))
        tol = float(config.get("solverTolerance", 1e-9))

        opt_weights, res = _mvo_slsqp(
            mu_annual, cov_annual, current_weights,
            risk_aversion=risk_aversion, gamma=gamma,
            max_pos=max_pos, min_pos=min_pos,
            turnover_cap=turnover_cap, max_iter=max_iter, tol=tol,
        )

        # Portfolio metrics (annualised)
        port_return = float(mu_annual @ opt_weights)
        port_variance = float(opt_weights @ cov_annual @ opt_weights)
        port_vol = float(np.sqrt(port_variance))
        rf = 0.0715
        sharpe = (port_return - rf) / port_vol if port_vol > 1e-8 else 0.0
        turnover = float(np.abs(opt_weights - current_weights).sum() / 2)

        weights_dict = {cat: round(float(w), 6) for cat, w in zip(categories, opt_weights)}
        expected_returns_list = [round(float(r), 6) for r in mu_annual]

        return {
            "categories": categories,
            "weights": weights_dict,
            "expectedReturns": expected_returns_list,
            "expectedReturn": round(port_return, 6),
            "portfolioVolatility": round(port_vol, 6),
            "sharpeRatio": round(sharpe, 4),
            "covarianceMatrix": cov_daily.tolist(),
            "annualizedCovarianceMatrix": cov_annual.tolist(),
            "transitionMetrics": {
                "turnover": round(turnover, 4),
                "gammaUsed": gamma,
                "optimizerStatus": res.message if hasattr(res, "message") else "ok",
                "converged": bool(res.success),
            },
            "modelVersion": "py-mvo-slsqp-v1",
            "solver": "scipy-SLSQP",
        }

    except Exception as e:
        return {"error": str(e)}


@router.post("/black-litterman")
async def bl_optimize(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Black-Litterman posterior returns and weights.

    Input:
      mvoResult: {categories, weights, annualizedCovarianceMatrix (or covarianceMatrix)}
      views: [{category, direction ('BULLISH'|'BEARISH'), magnitude (annual decimal), confidence (0-1)}]
      config: {riskAversion, tau, tacticalBudget}
    """
    try:
        mvo = payload["mvoResult"]
        views = payload.get("views", [])
        config = payload.get("config", {})

        categories = mvo["categories"]
        n = len(categories)
        weights_map = mvo["weights"]
        strategic_weights = np.array([weights_map.get(c, 1.0 / n) for c in categories])
        if strategic_weights.sum() < 1e-8:
            strategic_weights = np.ones(n) / n
        else:
            strategic_weights /= strategic_weights.sum()

        # Prefer annualised covariance for correct scale
        cov_data = mvo.get("annualizedCovarianceMatrix") or mvo.get("covarianceMatrix")
        sigma = np.array(cov_data, dtype=float)

        risk_aversion = float(config.get("riskAversion", 3.0))
        tau = float(config.get("tau", 0.05))
        tactical_budget = float(config.get("tacticalBudget", 0.15))

        # Implied equilibrium returns: pi = lambda * Sigma * w
        pi = risk_aversion * sigma @ strategic_weights

        # Map categories to indices
        cat_idx = {c: i for i, c in enumerate(categories)}
        valid_views = [v for v in views if v.get("category") in cat_idx]

        if not valid_views:
            return {
                "posteriorWeights": weights_map,
                "posteriorReturns": {c: round(float(r), 6) for c, r in zip(categories, pi)},
                "tacticalTilts": {c: 0.0 for c in categories},
                "modelVersion": "py-bl-v1",
                "viewsApplied": 0,
            }

        k = len(valid_views)
        P = np.zeros((k, n))
        Q = np.zeros(k)
        confidences = np.zeros(k)

        for i, v in enumerate(valid_views):
            idx = cat_idx[v["category"]]
            P[i, idx] = 1.0
            mag = float(v.get("magnitude", 0.15))
            direction = str(v.get("direction", "BULLISH")).upper()
            Q[i] = mag if direction == "BULLISH" else -mag
            confidences[i] = float(v.get("confidence", 0.5))

        # Omega: uncertainty matrix; scales inversely with confidence
        # Using He & Litterman (1999) standard: Omega_ii = (1-conf) * P_i * (tau*Sigma) * P_i'
        tau_sigma = tau * sigma
        P_tau_sigma_Pt = P @ tau_sigma @ P.T
        omega_diag = np.diag(P_tau_sigma_Pt) * np.clip(1.0 - confidences, 0.01, 0.99)
        Omega = np.diag(np.maximum(omega_diag, 1e-10))

        # BL posterior: mu* = [(tau*Sigma)^-1 + P'*Omega^-1*P]^-1 * [(tau*Sigma)^-1*pi + P'*Omega^-1*Q]
        reg = np.eye(n) * 1e-8
        tau_sigma_inv = np.linalg.inv(tau_sigma + reg)
        omega_inv = np.diag(1.0 / np.diag(Omega))

        A = tau_sigma_inv + P.T @ omega_inv @ P
        b_vec = tau_sigma_inv @ pi + P.T @ omega_inv @ Q

        try:
            posterior_returns = np.linalg.solve(A + reg, b_vec)
        except np.linalg.LinAlgError:
            posterior_returns = np.linalg.lstsq(A, b_vec, rcond=None)[0]

        # Reconstruct portfolio weights from posterior: w* = (1/lambda) * Sigma^-1 * mu*
        try:
            sigma_inv = np.linalg.inv(sigma + reg)
            raw_weights = (sigma_inv @ posterior_returns) / risk_aversion
            raw_weights = np.clip(raw_weights, 0.0, 1.0)
            w_sum = raw_weights.sum()
            if w_sum > 1e-8:
                raw_weights /= w_sum
            else:
                raw_weights = strategic_weights.copy()
        except Exception:
            raw_weights = strategic_weights.copy()

        # Apply tactical budget: cap maximum deviation from strategic
        diff = raw_weights - strategic_weights
        max_abs_diff = np.max(np.abs(diff))
        if max_abs_diff > tactical_budget and max_abs_diff > 1e-8:
            raw_weights = strategic_weights + diff * (tactical_budget / max_abs_diff)

        raw_weights = np.clip(raw_weights, 0.0, 1.0)
        raw_weights /= raw_weights.sum()

        tilt = raw_weights - strategic_weights

        return {
            "posteriorWeights": {c: round(float(w), 6) for c, w in zip(categories, raw_weights)},
            "posteriorReturns": {c: round(float(r), 6) for c, r in zip(categories, posterior_returns)},
            "impliedReturns": {c: round(float(r), 6) for c, r in zip(categories, pi)},
            "tacticalTilts": {c: round(float(t), 6) for c, t in zip(categories, tilt)},
            "modelVersion": "py-bl-v1",
            "viewsApplied": k,
        }

    except Exception as e:
        return {"error": str(e)}


@router.post("/backtest")
async def compute_backtest_metrics(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute annualised portfolio backtest metrics using numpy.

    Input:
      weights: {category: weight}
      monthlyReturns: {category: [r1, r2, ...]}   (monthly decimal returns)
      benchmarkWeights: {category: weight}          (optional)
    """
    try:
        weights = payload["weights"]
        monthly_returns = payload["monthlyReturns"]
        benchmark_weights = payload.get("benchmarkWeights", {})
        rf_annual = 0.0715
        rf_monthly = rf_annual / 12

        categories = [c for c in weights if c in monthly_returns]
        if not categories:
            return {"error": "No overlapping categories between weights and monthlyReturns"}

        w = np.array([weights[c] for c in categories], dtype=float)
        w /= w.sum()

        T = min(len(monthly_returns[c]) for c in categories)
        if T < 6:
            return {"error": f"Insufficient monthly return history: {T} months (need ≥ 6)"}

        ret_matrix = np.array([monthly_returns[c][-T:] for c in categories], dtype=float)
        port_returns = w @ ret_matrix  # shape (T,)

        # Annualised return (geometric)
        ann_return = float((1 + port_returns).prod() ** (12.0 / T) - 1)
        ann_vol = float(port_returns.std(ddof=1) * np.sqrt(12))

        # Sharpe (annualised)
        sharpe = (ann_return - rf_annual) / ann_vol if ann_vol > 1e-8 else 0.0

        # Sortino: downside deviation below MAR = Rf/12 across ALL periods
        below_mar = np.minimum(port_returns - rf_monthly, 0.0)
        downside_dev = float(np.sqrt(np.mean(below_mar ** 2)) * np.sqrt(12))
        sortino = (ann_return - rf_annual) / downside_dev if downside_dev > 1e-8 else 0.0

        # Max drawdown
        cum = (1 + port_returns).cumprod()
        rolling_max = np.maximum.accumulate(cum)
        drawdowns = (cum - rolling_max) / rolling_max
        max_drawdown = float(drawdowns.min())

        # Calmar
        calmar = ann_return / abs(max_drawdown) if abs(max_drawdown) > 1e-8 else 0.0

        result = {
            "annualizedReturn": round(ann_return, 4),
            "portfolioVolatility": round(ann_vol, 4),
            "sharpeRatio": round(sharpe, 4),
            "sortinoRatio": round(sortino, 4),
            "calmarRatio": round(calmar, 4),
            "maxDrawdown": round(max_drawdown, 4),
            "monthsAnalyzed": T,
        }

        # Optional benchmark comparison
        if benchmark_weights:
            bw_cats = [c for c in benchmark_weights if c in monthly_returns]
            if bw_cats:
                bw = np.array([benchmark_weights[c] for c in bw_cats], dtype=float)
                bw /= bw.sum()
                bw_ret_matrix = np.array([monthly_returns[c][-T:] for c in bw_cats], dtype=float)
                bw_returns = bw @ bw_ret_matrix
                bw_ann_return = float((1 + bw_returns).prod() ** (12.0 / T) - 1)
                bw_ann_vol = float(bw_returns.std(ddof=1) * np.sqrt(12))
                bw_sharpe = (bw_ann_return - rf_annual) / bw_ann_vol if bw_ann_vol > 1e-8 else 0.0
                result["benchmarkReturn"] = round(bw_ann_return, 4)
                result["benchmarkVol"] = round(bw_ann_vol, 4)
                result["benchmarkSharpe"] = round(bw_sharpe, 4)
                result["alpha"] = round(ann_return - bw_ann_return, 4)

        return result

    except Exception as e:
        return {"error": str(e)}


@router.post("/drift-predict")
async def drift_predict(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Predict portfolio drift breach probability using scipy.stats linear regression.

    Input:
      driftMetrics: [{category, currentPercent, targetPercent, drift, driftHistory: [...]}]
      toleranceBandPct: float (default 5.0)
    """
    try:
        drift_metrics = payload["driftMetrics"]
        tolerance_band = float(payload.get("toleranceBandPct", 5.0))

        results = []
        for dm in drift_metrics:
            category = dm["category"]
            current_drift = float(dm.get("drift", 0))
            history = [float(d) for d in dm.get("driftHistory", [])]

            if len(history) < 5:
                # Simple rule-based estimate when history is thin
                breach_prob = min(abs(current_drift) / max(tolerance_band, 1e-8), 1.0)
                results.append({
                    "category": category,
                    "breachProbability": round(breach_prob, 3),
                    "daysToBreachMean": None,
                    "driftVelocity": 0.0,
                    "rSquared": None,
                    "recommendation": "MONITOR" if breach_prob < 0.5 else "REBALANCE",
                })
                continue

            x = np.arange(len(history), dtype=float)
            y = np.array(history, dtype=float)
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

            # Fitted current drift
            fitted_now = slope * (len(history) - 1) + intercept
            remaining = tolerance_band - abs(fitted_now)

            # Days to breach (linear extrapolation)
            if slope != 0 and remaining > 0:
                days_to_breach = remaining / abs(slope)
            else:
                days_to_breach = None

            # Breach probability via normal distribution of residuals
            drift_vol = float(np.std(np.diff(history), ddof=1)) if len(history) > 2 else 0.01
            drift_vol = max(drift_vol, 1e-4)
            # Days-ahead horizon for probability: 30 trading days
            horizon = 30
            future_vol = drift_vol * np.sqrt(horizon)
            projected_drift = fitted_now + slope * horizon
            z_breach = (tolerance_band - abs(projected_drift)) / future_vol
            breach_prob = float(1.0 - stats.norm.cdf(z_breach))
            breach_prob = max(0.0, min(1.0, breach_prob))

            recommendation = (
                "REBALANCE" if breach_prob > 0.70
                else "WATCH" if breach_prob > 0.40
                else "MONITOR"
            )

            results.append({
                "category": category,
                "breachProbability": round(breach_prob, 3),
                "daysToBreachMean": round(float(days_to_breach), 0) if days_to_breach is not None else None,
                "driftVelocity": round(float(slope), 4),
                "rSquared": round(float(r_value ** 2), 3),
                "recommendation": recommendation,
            })

        return {"predictions": results, "toleranceBand": tolerance_band}

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Asset Allocation Optimizer (py-mvo-v2)
# Indian market MPT — 10 asset classes, SEBI-compliant constraints
# ---------------------------------------------------------------------------

_ASSET_CLASSES = [
    {"type": "large_cap_equity",   "name": "Large Cap Equity",           "er": 12.0, "vol": 16.0, "max": 60},
    {"type": "mid_cap_equity",     "name": "Mid Cap Equity",             "er": 14.0, "vol": 22.0, "max": 40},
    {"type": "small_cap_equity",   "name": "Small Cap Equity",           "er": 16.0, "vol": 28.0, "max": 30},
    {"type": "international_equity","name": "International Equity",      "er": 10.0, "vol": 18.0, "max": 25},
    {"type": "government_bonds",   "name": "Government Bonds",           "er":  7.0, "vol":  4.0, "max": 50},
    {"type": "corporate_bonds",    "name": "Corporate Bonds",            "er":  8.5, "vol":  6.0, "max": 40},
    {"type": "money_market",       "name": "Money Market/Liquid Funds",  "er":  5.5, "vol":  1.0, "max": 30},
    {"type": "gold",               "name": "Gold/Precious Metals",       "er":  6.0, "vol": 12.0, "max": 15},
    {"type": "real_estate",        "name": "Real Estate/REITs",          "er":  9.0, "vol": 14.0, "max": 20},
    {"type": "alternatives",       "name": "Alternatives (PE/VC/AIF)",   "er": 18.0, "vol": 30.0, "max": 25},
]

_TYPES = [a["type"] for a in _ASSET_CLASSES]
_ER = np.array([a["er"] / 100 for a in _ASSET_CLASSES])
_VOL = np.array([a["vol"] / 100 for a in _ASSET_CLASSES])
_MAX = np.array([a["max"] / 100 for a in _ASSET_CLASSES])
_N = len(_ASSET_CLASSES)

_EQUITY_IDX = [0, 1, 2, 3]
_DEBT_IDX = [4, 5, 6]
_ALT_IDX = [9]
_LIQUID_IDX = [6, 4]

_CORR = np.array([
    [1.00, 0.85, 0.80, 0.70,-0.20, 0.10, 0.05, 0.05, 0.50, 0.60],
    [0.85, 1.00, 0.90, 0.65,-0.15, 0.15, 0.05, 0.10, 0.55, 0.65],
    [0.80, 0.90, 1.00, 0.60,-0.10, 0.20, 0.05, 0.15, 0.45, 0.70],
    [0.70, 0.65, 0.60, 1.00,-0.10, 0.15, 0.05, 0.20, 0.40, 0.50],
    [-0.20,-0.15,-0.10,-0.10, 1.00, 0.80, 0.60, 0.30, 0.10,-0.10],
    [0.10, 0.15, 0.20, 0.15, 0.80, 1.00, 0.50, 0.20, 0.25, 0.10],
    [0.05, 0.05, 0.05, 0.05, 0.60, 0.50, 1.00, 0.10, 0.05, 0.00],
    [0.05, 0.10, 0.15, 0.20, 0.30, 0.20, 0.10, 1.00, 0.15, 0.10],
    [0.50, 0.55, 0.45, 0.40, 0.10, 0.25, 0.05, 0.15, 1.00, 0.40],
    [0.60, 0.65, 0.70, 0.50,-0.10, 0.10, 0.00, 0.10, 0.40, 1.00],
])
_COV = _CORR * np.outer(_VOL, _VOL)

# Risk profile constraints (min/max equity, min/max debt, max alternatives)
_PROFILE_CONSTRAINTS = {
    "very_conservative": {"min_eq": 0.10, "max_eq": 0.25, "min_debt": 0.60, "max_debt": 0.80, "max_alt": 0.00, "min_liq": 0.15},
    "conservative":      {"min_eq": 0.20, "max_eq": 0.40, "min_debt": 0.45, "max_debt": 0.65, "max_alt": 0.05, "min_liq": 0.10},
    "moderate":          {"min_eq": 0.35, "max_eq": 0.55, "min_debt": 0.30, "max_debt": 0.50, "max_alt": 0.10, "min_liq": 0.05},
    "moderately_aggressive": {"min_eq": 0.50, "max_eq": 0.70, "min_debt": 0.15, "max_debt": 0.35, "max_alt": 0.15, "min_liq": 0.03},
    "aggressive":        {"min_eq": 0.65, "max_eq": 0.85, "min_debt": 0.05, "max_debt": 0.25, "max_alt": 0.20, "min_liq": 0.02},
    "very_aggressive":   {"min_eq": 0.75, "max_eq": 0.95, "min_debt": 0.00, "max_debt": 0.15, "max_alt": 0.25, "min_liq": 0.00},
}

RF_ANNUAL = 0.0715


def _get_risk_profile(risk_score: int) -> str:
    if risk_score <= 25: return "very_conservative"
    if risk_score <= 40: return "conservative"
    if risk_score <= 55: return "moderate"
    if risk_score <= 70: return "moderately_aggressive"
    if risk_score <= 85: return "aggressive"
    return "very_aggressive"


def _build_constraints_and_bounds(profile: str, segment: str, max_single: float):
    pc = _PROFILE_CONSTRAINTS[profile].copy()

    if segment in ("bhni", "shni"):
        pc["max_alt"] = min(pc["max_alt"] + 0.10, 0.35)
    elif segment == "retail":
        pc["max_alt"] = 0.00
        pc["min_liq"] = max(pc["min_liq"], 0.05)
    elif segment == "corporate":
        pc["min_liq"] = max(pc["min_liq"] + 0.10, 0.15)
        pc["max_eq"] = max(pc["max_eq"] - 0.15, pc["min_eq"])

    n = _N
    bounds = []
    for i, a in enumerate(_ASSET_CLASSES):
        lo = 0.0
        hi = min(a["max"] / 100, max_single)
        if a["type"] == "alternatives":
            hi = min(hi, pc["max_alt"])
        if segment == "retail" and a["type"] == "real_estate":
            hi = min(hi, 0.05)
        bounds.append((lo, hi))

    constraints = [
        {"type": "eq", "fun": lambda w: w.sum() - 1.0},
        {"type": "ineq", "fun": lambda w: w[_EQUITY_IDX].sum() - pc["min_eq"]},
        {"type": "ineq", "fun": lambda w: pc["max_eq"] - w[_EQUITY_IDX].sum()},
        {"type": "ineq", "fun": lambda w: w[_DEBT_IDX].sum() - pc["min_debt"]},
        {"type": "ineq", "fun": lambda w: pc["max_debt"] - w[_DEBT_IDX].sum()},
        {"type": "ineq", "fun": lambda w: pc["max_alt"] - w[_ALT_IDX].sum()},
        {"type": "ineq", "fun": lambda w: w[_LIQUID_IDX].sum() - pc["min_liq"]},
    ]
    return bounds, constraints, pc


def _portfolio_stats(w: np.ndarray) -> tuple:
    pret = float(w @ _ER)
    pvar = float(w @ _COV @ w)
    pvol = float(np.sqrt(max(pvar, 0)))
    sharpe = (pret - RF_ANNUAL) / pvol if pvol > 1e-8 else 0.0
    return pret, pvol, sharpe


def _run_mvo(bounds, constraints, risk_aversion: float = 3.0) -> np.ndarray:
    w0 = np.array([1 / _N] * _N)

    def obj(w):
        return -(w @ _ER) + (risk_aversion / 2) * (w @ _COV @ w)

    res = minimize(obj, w0, method="SLSQP", bounds=bounds, constraints=constraints,
                   options={"maxiter": 1000, "ftol": 1e-10})
    w_opt = np.clip(res.x, 0, 1)
    s = w_opt.sum()
    return w_opt / s if s > 1e-8 else w0


def _efficient_frontier(bounds, constraints, n_points: int = 10) -> list:
    """Sweep target return to get efficient frontier."""
    min_ret = float(_ER.min())
    max_ret = float(_ER.max())

    target_returns = np.linspace(min_ret * 1.05, max_ret * 0.90, n_points)
    frontier = []

    for target in target_returns:
        consts = constraints + [{"type": "ineq", "fun": lambda w, t=target: w @ _ER - t}]

        def obj_min_vol(w):
            return w @ _COV @ w

        res = minimize(obj_min_vol, np.array([1 / _N] * _N), method="SLSQP",
                       bounds=bounds, constraints=consts,
                       options={"maxiter": 500, "ftol": 1e-9})
        if res.success:
            w = np.clip(res.x, 0, 1)
            w /= max(w.sum(), 1e-8)
            pret, pvol, sharpe = _portfolio_stats(w)
            frontier.append({
                "expectedReturn": round(pret * 100, 3),
                "volatility": round(pvol * 100, 3),
                "sharpeRatio": round(sharpe, 3),
                "allocations": {_TYPES[i]: round(float(w[i]) * 100, 2) for i in range(_N) if w[i] > 0.005},
            })

    return frontier


@router.post("/asset-allocation")
async def asset_allocation_optimize(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Indian-market MPT Asset Allocation Optimizer.
    Replicates server/services/asset-allocation-optimizer.ts in Python (scipy SLSQP).

    Input:
      riskScore:          int    (1–100, mapped to 6 risk profiles)
      segment:            str    ('retail'|'hni'|'shni'|'bhni'|'corporate')
      investableAmount:   float  (optional — used to compute ₹ amounts)
      investmentHorizon:  int    (years, used for rationale)
      goalType:           str    ('growth'|'income'|'preservation'|'balanced')
      liquidityNeeds:     str    ('low'|'medium'|'high')
      taxBracket:         str    ('low'|'medium'|'high')
      existingAllocations dict   (optional — {assetType: pct} current holdings)

    Returns:
      allocations, portfolioMetrics, efficientFrontier (10 pts), riskProfile,
      segment, constraints, optimizationMethod, rationale
    """
    try:
        risk_score = int(payload.get("riskScore", 50))
        segment = payload.get("segment", "retail")
        investable = float(payload.get("investableAmount", 0))
        horizon = int(payload.get("investmentHorizon", 5))
        goal_type = payload.get("goalType", "balanced")
        liquidity = payload.get("liquidityNeeds", "medium")
        tax_bracket = payload.get("taxBracket", "medium")

        profile = _get_risk_profile(risk_score)
        max_single = 0.55 if segment in ("bhni", "shni") else 0.50 if segment in ("hni",) else 0.40

        # Adjust risk aversion: lower score → more risk averse
        risk_aversion = 10.0 - (risk_score / 100) * 7.0   # range 3–10

        # Goal-based tilt on risk aversion
        if goal_type == "preservation":
            risk_aversion *= 1.4
        elif goal_type == "growth":
            risk_aversion *= 0.7
        elif goal_type == "income":
            risk_aversion *= 1.1

        bounds, constraints, pc = _build_constraints_and_bounds(profile, segment, max_single)
        w_opt = _run_mvo(bounds, constraints, risk_aversion)
        pret, pvol, sharpe = _portfolio_stats(w_opt)

        # Diversification ratio: weighted-avg individual vol / portfolio vol
        div_ratio = float((w_opt @ _VOL) / pvol) if pvol > 1e-8 else 1.0
        max_dd_est = -pvol * 2.33 * np.sqrt(1 / 12)  # approx 1-month 99% VaR as DD proxy

        allocations = []
        for i, a in enumerate(_ASSET_CLASSES):
            w = float(w_opt[i])
            if w < 0.001:
                continue
            port_var = float(w_opt @ _COV @ w_opt)
            marginal_risk = float((_COV @ w_opt)[i] * w) / max(port_var, 1e-10)
            allocations.append({
                "assetType": a["type"],
                "assetName": a["name"],
                "allocation": round(w * 100, 2),
                "expectedReturn": round(a["er"], 2),
                "contributionToRisk": round(marginal_risk * 100, 2),
                "amount": round(investable * w, 2) if investable > 0 else None,
            })

        allocations.sort(key=lambda x: x["allocation"], reverse=True)

        frontier = _efficient_frontier(bounds, constraints)

        rationale = [
            f"Risk score {risk_score}/100 → {profile.replace('_', ' ').title()} profile",
            f"Equity: {pc['min_eq']*100:.0f}–{pc['max_eq']*100:.0f}% | Debt: {pc['min_debt']*100:.0f}–{pc['max_debt']*100:.0f}%",
            f"Segment: {segment.upper()} — alternatives cap: {pc['max_alt']*100:.0f}%",
            f"Goal: {goal_type} | Horizon: {horizon}Y | Liquidity need: {liquidity}",
            f"Expected return: {pret*100:.2f}% | Volatility: {pvol*100:.2f}% | Sharpe: {sharpe:.3f}",
            f"Diversification ratio: {div_ratio:.2f} | Max drawdown estimate: {max_dd_est*100:.2f}%",
        ]

        return {
            "allocations": allocations,
            "portfolioMetrics": {
                "expectedReturn": round(pret * 100, 4),
                "volatility": round(pvol * 100, 4),
                "sharpeRatio": round(sharpe, 4),
                "diversificationRatio": round(div_ratio, 4),
                "maxDrawdownEstimate": round(max_dd_est * 100, 4),
            },
            "efficientFrontier": frontier,
            "riskProfile": profile,
            "segment": segment,
            "goalType": goal_type,
            "constraints": {
                "minEquity": round(pc["min_eq"] * 100, 1),
                "maxEquity": round(pc["max_eq"] * 100, 1),
                "minDebt": round(pc["min_debt"] * 100, 1),
                "maxDebt": round(pc["max_debt"] * 100, 1),
                "minAlternatives": 0,
                "maxAlternatives": round(pc["max_alt"] * 100, 1),
                "minLiquidity": round(pc["min_liq"] * 100, 1),
                "maxSingleAsset": round(max_single * 100, 1),
            },
            "optimizationMethod": "SLSQP-MVO-Indian-Market",
            "rationale": rationale,
            "riskAversion": round(risk_aversion, 3),
            "modelVersion": "py-mvo-v2",
        }

    except Exception as e:
        return {"error": str(e)}
