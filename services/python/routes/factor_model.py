"""
Risk Factor Model — Fama-French 3-Factor + Carhart 4-Factor
py-factor-v1

Endpoints:
  POST /api/factor/fund-factors          — OLS regression for one fund vs FF3/Carhart4
  POST /api/factor/batch-fund-factors    — Batch regression for multiple funds
  POST /api/factor/construct-factors     — Build SMB/HML/MOM proxy factors from market_index_nav
  GET  /api/factor/market-factors        — Retrieve precomputed factor returns from DB
"""

from fastapi import APIRouter, Depends, Body, Query
from auth import verify_token, TokenPayload
from database import db_conn
import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Optional

router = APIRouter(prefix="/api/factor", tags=["factor-model"])

RF_DAILY = 0.0715 / 252   # India 10Y G-Sec, daily


# ── Factor Regression ─────────────────────────────────────────────────────────

def _ols_factor_regression(
    fund_returns: np.ndarray,
    factor_matrix: np.ndarray,
    factor_names: List[str],
    rf_daily: float = RF_DAILY,
) -> dict:
    """
    Run OLS regression of excess fund returns on factor returns.
    Returns alpha, factor loadings, t-stats, R², adjusted R², info ratio.
    """
    excess_fund = fund_returns - rf_daily
    n = len(excess_fund)
    k = factor_matrix.shape[1]

    X = np.column_stack([np.ones(n), factor_matrix])
    try:
        coeffs = np.linalg.lstsq(X, excess_fund, rcond=None)[0]
    except Exception:
        return {"error": "OLS solver failed"}

    alpha_daily = float(coeffs[0])
    betas = [float(c) for c in coeffs[1:]]

    residuals = excess_fund - X @ coeffs
    ss_res = float((residuals ** 2).sum())
    ss_tot = float(((excess_fund - excess_fund.mean()) ** 2).sum())
    r2 = 1 - ss_res / ss_tot if ss_tot > 1e-12 else 0.0
    adj_r2 = 1 - (1 - r2) * (n - 1) / (n - k - 1) if n > k + 1 else 0.0

    se2 = ss_res / max(n - k - 1, 1)
    XtX_inv = np.linalg.pinv(X.T @ X)
    se_vec = np.sqrt(np.maximum(np.diag(XtX_inv) * se2, 0))

    t_stats = coeffs / np.maximum(se_vec, 1e-12)
    p_values = [2 * (1 - stats.t.cdf(abs(t), df=max(n - k - 1, 1))) for t in t_stats]

    alpha_annual = (1 + alpha_daily) ** 252 - 1
    tracking_error = float(residuals.std(ddof=1) * np.sqrt(252))
    info_ratio = alpha_annual / tracking_error if tracking_error > 1e-8 else 0.0

    return {
        "alphaDaily": round(alpha_daily * 100, 6),
        "alphaAnnual": round(alpha_annual * 100, 4),
        "betas": {name: round(b, 6) for name, b in zip(factor_names, betas)},
        "tStats": {
            "alpha": round(float(t_stats[0]), 4),
            **{name: round(float(t_stats[i + 1]), 4) for i, name in enumerate(factor_names)},
        },
        "pValues": {
            "alpha": round(p_values[0], 4),
            **{name: round(p_values[i + 1], 4) for i, name in enumerate(factor_names)},
        },
        "r2": round(r2, 4),
        "adjustedR2": round(adj_r2, 4),
        "trackingError": round(tracking_error * 100, 4),
        "informationRatio": round(info_ratio, 4),
        "observations": n,
    }


def _build_proxy_factors(df_wide: pd.DataFrame) -> pd.DataFrame:
    """
    Build proxy Fama-French factors from available market index data.

    Market (Rm-Rf): NIFTY50 daily return minus Rf
    SMB proxy:      NIFTY_SMALLCAP250 - NIFTY100 (or NIFTY50 fallback)
    HML proxy:      (NIFTY_VALUE20 or NIFTYMIDCAP50) - (NIFTY_GROWTH or NIFTY50)
    MOM proxy:      12-1 month price momentum of NIFTY50 minus short-term reversal

    If index series are missing, returns only Market factor.
    """
    factors = pd.DataFrame(index=df_wide.index)
    rf = RF_DAILY

    if "NIFTY50" in df_wide.columns:
        factors["Rm_Rf"] = df_wide["NIFTY50"].pct_change() - rf
    elif len(df_wide.columns) > 0:
        factors["Rm_Rf"] = df_wide.iloc[:, 0].pct_change() - rf

    if "NIFTYSMALLCAP250" in df_wide.columns and "NIFTY100" in df_wide.columns:
        factors["SMB"] = df_wide["NIFTYSMALLCAP250"].pct_change() - df_wide["NIFTY100"].pct_change()
    elif "NIFTYMIDCAP150" in df_wide.columns and "NIFTY50" in df_wide.columns:
        mid = df_wide["NIFTYMIDCAP150"].pct_change()
        large = df_wide["NIFTY50"].pct_change()
        factors["SMB"] = mid - large

    if "NIFTYVALUE20" in df_wide.columns and "NIFTY50" in df_wide.columns:
        factors["HML"] = df_wide["NIFTYVALUE20"].pct_change() - df_wide["NIFTY50"].pct_change()
    elif "NIFTYMIDCAP50" in df_wide.columns and "NIFTY50" in df_wide.columns:
        factors["HML"] = df_wide["NIFTYMIDCAP50"].pct_change() - df_wide["NIFTY50"].pct_change()

    if "Rm_Rf" in factors.columns:
        market_col = factors["Rm_Rf"] + rf
        mom_12m = market_col.rolling(252).apply(lambda x: (1 + x).prod() - 1, raw=True)
        mom_1m = market_col.rolling(21).apply(lambda x: (1 + x).prod() - 1, raw=True)
        factors["MOM"] = mom_12m.shift(21) - mom_1m

    return factors.dropna()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/fund-factors")
async def fund_factor_regression(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Fama-French 3-Factor + Carhart 4-Factor regression for a single fund.

    Input:
      schemeCode:     str             (reads mf_nav_history)
      model:          str             ('ff3'|'carhart4'|'capm', default 'carhart4')
      lookbackDays:   int             (default 756 = ~3 years)
      fundReturns:    [float, ...]    (optional — provide daily returns directly)
      factorReturns:  {Rm_Rf, SMB, HML, MOM: [float, ...]}   (optional override)
    """
    try:
        scheme_code = payload.get("schemeCode")
        model = payload.get("model", "carhart4").lower()
        lookback = int(payload.get("lookbackDays", 756))

        fund_returns_input = payload.get("fundReturns")
        factor_returns_input = payload.get("factorReturns")

        if fund_returns_input:
            fund_ret = np.array(fund_returns_input, dtype=float)
        elif scheme_code:
            async with db_conn() as conn:
                rows = await conn.fetch(
                    """
                    SELECT nav_date, nav
                    FROM mf_nav_history
                    WHERE scheme_code = $1
                    ORDER BY nav_date DESC
                    LIMIT $2
                    """,
                    scheme_code, lookback + 1,
                )
            if not rows or len(rows) < 30:
                return {"error": f"Insufficient NAV history for {scheme_code}"}

            df = pd.DataFrame([dict(r) for r in rows]).sort_values("nav_date")
            df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
            fund_ret = df["nav"].pct_change().dropna().values
        else:
            return {"error": "Provide schemeCode or fundReturns"}

        if factor_returns_input:
            factor_df = pd.DataFrame(factor_returns_input)
            min_len = min(len(fund_ret), len(factor_df))
            fund_ret = fund_ret[-min_len:]
            factor_df = factor_df.iloc[-min_len:]

            if model == "capm":
                factors = factor_df[["Rm_Rf"]].values if "Rm_Rf" in factor_df.columns else factor_df.iloc[:, :1].values
                names = ["Rm_Rf"]
            elif model == "ff3":
                cols = [c for c in ["Rm_Rf", "SMB", "HML"] if c in factor_df.columns]
                factors = factor_df[cols].values
                names = cols
            else:
                cols = [c for c in ["Rm_Rf", "SMB", "HML", "MOM"] if c in factor_df.columns]
                factors = factor_df[cols].values
                names = cols
        else:
            async with db_conn() as conn:
                index_rows = await conn.fetch(
                    """
                    SELECT index_code, nav_date, nav
                    FROM market_index_nav
                    WHERE nav_date >= (CURRENT_DATE - INTERVAL '$1 days')
                    ORDER BY nav_date
                    """,
                    lookback + 60,
                )

            if not index_rows:
                market_ret = np.zeros(len(fund_ret)) + RF_DAILY
                factors = market_ret[:, np.newaxis]
                names = ["Rm_Rf"]
            else:
                idx_df = pd.DataFrame([dict(r) for r in index_rows])
                idx_df["nav"] = pd.to_numeric(idx_df["nav"], errors="coerce")
                idx_df["nav_date"] = pd.to_datetime(idx_df["nav_date"])
                pivot = idx_df.pivot(index="nav_date", columns="index_code", values="nav").sort_index()
                proxy_factors = _build_proxy_factors(pivot)

                min_len = min(len(fund_ret), len(proxy_factors))
                fund_ret = fund_ret[-min_len:]
                proxy_factors = proxy_factors.iloc[-min_len:]

                if model == "capm":
                    cols = ["Rm_Rf"] if "Rm_Rf" in proxy_factors.columns else list(proxy_factors.columns[:1])
                elif model == "ff3":
                    cols = [c for c in ["Rm_Rf", "SMB", "HML"] if c in proxy_factors.columns]
                else:
                    cols = [c for c in ["Rm_Rf", "SMB", "HML", "MOM"] if c in proxy_factors.columns]

                factors = proxy_factors[cols].values
                names = cols

        regression = _ols_factor_regression(fund_ret, factors, names)
        regression["model"] = model
        regression["schemeCode"] = scheme_code
        regression["modelVersion"] = "py-factor-v1"

        return regression

    except Exception as e:
        return {"error": str(e)}


@router.post("/batch-fund-factors")
async def batch_fund_factors(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Run Fama-French / Carhart regression for multiple funds in one call.

    Input:
      schemeCodes:   [str, ...]
      model:         str   ('ff3'|'carhart4'|'capm', default 'carhart4')
      lookbackDays:  int   (default 756)
    """
    try:
        scheme_codes = payload.get("schemeCodes", [])
        model = payload.get("model", "carhart4").lower()
        lookback = int(payload.get("lookbackDays", 756))

        if not scheme_codes:
            return {"error": "Provide schemeCodes list"}

        async with db_conn() as conn:
            nav_rows = await conn.fetch(
                """
                SELECT scheme_code, nav_date, nav
                FROM mf_nav_history
                WHERE scheme_code = ANY($1::text[])
                  AND nav_date >= (CURRENT_DATE - ($2 || ' days')::INTERVAL)
                ORDER BY scheme_code, nav_date
                """,
                scheme_codes, str(lookback + 30),
            )
            index_rows = await conn.fetch(
                """
                SELECT index_code, nav_date, nav
                FROM market_index_nav
                WHERE nav_date >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
                ORDER BY nav_date
                """,
                str(lookback + 60),
            )

        idx_df = pd.DataFrame([dict(r) for r in index_rows])
        proxy_factors = pd.DataFrame()
        if not idx_df.empty:
            idx_df["nav"] = pd.to_numeric(idx_df["nav"], errors="coerce")
            idx_df["nav_date"] = pd.to_datetime(idx_df["nav_date"])
            pivot = idx_df.pivot(index="nav_date", columns="index_code", values="nav").sort_index()
            proxy_factors = _build_proxy_factors(pivot)

        nav_df = pd.DataFrame([dict(r) for r in nav_rows])
        nav_df["nav"] = pd.to_numeric(nav_df["nav"], errors="coerce")
        nav_df["nav_date"] = pd.to_datetime(nav_df["nav_date"])

        results = []
        for sc in scheme_codes:
            fund_df = nav_df[nav_df["scheme_code"] == sc].sort_values("nav_date")
            if len(fund_df) < 30:
                results.append({"schemeCode": sc, "error": "Insufficient NAV data"})
                continue

            fund_ret = fund_df["nav"].pct_change().dropna().values

            if proxy_factors.empty:
                factors = np.zeros((len(fund_ret), 1))
                names = ["Rm_Rf"]
            else:
                if model == "capm":
                    cols = [c for c in ["Rm_Rf"] if c in proxy_factors.columns]
                elif model == "ff3":
                    cols = [c for c in ["Rm_Rf", "SMB", "HML"] if c in proxy_factors.columns]
                else:
                    cols = [c for c in ["Rm_Rf", "SMB", "HML", "MOM"] if c in proxy_factors.columns]

                names = cols or ["Rm_Rf"]
                min_len = min(len(fund_ret), len(proxy_factors))
                fund_ret = fund_ret[-min_len:]
                factors = proxy_factors[names].iloc[-min_len:].values

            reg = _ols_factor_regression(fund_ret, factors, names)
            reg["schemeCode"] = sc
            reg["model"] = model
            results.append(reg)

        return {
            "model": model,
            "fundsProcessed": len(results),
            "modelVersion": "py-factor-v1",
            "results": results,
        }

    except Exception as e:
        return {"error": str(e)}


@router.get("/market-factors")
async def get_market_factors(
    days: int = Query(252, description="Lookback days"),
    token: TokenPayload = Depends(verify_token),
):
    """
    Retrieve available market factor proxy series from market_index_nav.
    Returns time-series of Rm_Rf, SMB, HML, MOM proxies.
    """
    try:
        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT index_code, nav_date, nav
                FROM market_index_nav
                WHERE nav_date >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
                ORDER BY nav_date
                """,
                str(days + 60),
            )

        if not rows:
            return {"error": "No market index data available"}

        idx_df = pd.DataFrame([dict(r) for r in rows])
        idx_df["nav"] = pd.to_numeric(idx_df["nav"], errors="coerce")
        idx_df["nav_date"] = pd.to_datetime(idx_df["nav_date"])
        pivot = idx_df.pivot(index="nav_date", columns="index_code", values="nav").sort_index()
        proxy_factors = _build_proxy_factors(pivot)

        available_factors = list(proxy_factors.columns)
        series = {
            col: [
                {"date": str(d.date()), "value": round(float(v), 6)}
                for d, v in zip(proxy_factors.index, proxy_factors[col])
                if not np.isnan(v)
            ]
            for col in available_factors
        }

        return {
            "availableFactors": available_factors,
            "observations": len(proxy_factors),
            "availableIndices": list(pivot.columns),
            "series": series,
            "modelVersion": "py-factor-v1",
        }

    except Exception as e:
        return {"error": str(e)}
