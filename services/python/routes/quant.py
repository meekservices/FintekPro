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
