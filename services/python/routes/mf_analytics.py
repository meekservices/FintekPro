from fastapi import APIRouter, Depends, Query, Body
from auth import verify_token, TokenPayload
from database import db_conn
import pandas as pd
import numpy as np
from scipy.optimize import brentq
from typing import Optional, List, Dict, Any
from datetime import date, datetime

router = APIRouter(prefix="/api/mf", tags=["mf-analytics"])

RF_ANNUAL = 0.0715  # India 10Y G-Sec rate (Mar 2026)
TRADING_DAYS = 252


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_series(nav_history: List[Dict]) -> pd.Series:
    """Convert [{date, nav}] → pd.Series indexed by date."""
    df = pd.DataFrame(nav_history)
    df["date"] = pd.to_datetime(df["date"])
    df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
    df = df.dropna(subset=["nav"]).sort_values("date")
    return df.set_index("date")["nav"]


def _cagr(nav_series: pd.Series, years: float) -> Optional[float]:
    """CAGR over exactly `years` from the latest nav date."""
    if nav_series.empty or years <= 0:
        return None
    latest_date = nav_series.index[-1]
    target = latest_date - pd.DateOffset(days=int(years * 365))
    hist = nav_series[nav_series.index <= target]
    if hist.empty:
        return None
    past_nav = float(hist.iloc[-1])
    cur_nav = float(nav_series.iloc[-1])
    if past_nav <= 0:
        return None
    return round(((cur_nav / past_nav) ** (1.0 / years) - 1) * 100, 4)


def _simple_return(nav_series: pd.Series, days: int) -> Optional[float]:
    """Simple % return over last `days` calendar days."""
    if nav_series.empty:
        return None
    latest_date = nav_series.index[-1]
    target = latest_date - pd.Timedelta(days=days)
    hist = nav_series[nav_series.index <= target]
    if hist.empty:
        return None
    return round((float(nav_series.iloc[-1]) / float(hist.iloc[-1]) - 1) * 100, 4)


def _risk_metrics(nav_series: pd.Series) -> Dict:
    """Compute annualised volatility, Sharpe, Sortino, Max Drawdown, Calmar."""
    if len(nav_series) < 20:
        return {}
    daily_ret = nav_series.pct_change().dropna()
    if daily_ret.empty:
        return {}

    # Annualised return from full period
    n_days = (nav_series.index[-1] - nav_series.index[0]).days
    years = n_days / 365.0
    full_cagr = (float(nav_series.iloc[-1]) / float(nav_series.iloc[0])) ** (1.0 / max(years, 1.0 / 252)) - 1

    ann_vol = float(daily_ret.std(ddof=1) * np.sqrt(TRADING_DAYS))
    rf_daily = RF_ANNUAL / TRADING_DAYS

    # Sharpe (use 1Y CAGR if available, else full period)
    one_y = _cagr(nav_series, 1)
    sharpe_return = (one_y / 100) if one_y is not None else full_cagr
    sharpe = round((sharpe_return - RF_ANNUAL) / ann_vol, 4) if ann_vol > 1e-8 else None

    # Sortino — downside deviation using Rf as MAR
    below_rf = np.minimum(daily_ret.values - rf_daily, 0.0)
    downside_dev = float(np.sqrt(np.mean(below_rf ** 2)) * np.sqrt(TRADING_DAYS))
    sortino = round((sharpe_return - RF_ANNUAL) / downside_dev, 4) if downside_dev > 1e-8 else None

    # Max drawdown
    cum = (1 + daily_ret).cumprod()
    rolling_max = cum.cummax()
    drawdowns = (cum - rolling_max) / rolling_max
    max_dd = round(float(drawdowns.min()), 4)

    # Calmar
    calmar = round(sharpe_return / abs(max_dd), 4) if abs(max_dd) > 1e-8 else None

    return {
        "volatility": round(ann_vol * 100, 4),
        "sharpeRatio": sharpe,
        "sortinoRatio": sortino,
        "maxDrawdown": round(max_dd * 100, 4),
        "calmarRatio": calmar,
        "fullPeriodCagr": round(full_cagr * 100, 4),
    }


def _monthly_series(nav_series: pd.Series) -> List[Dict]:
    """Resample NAV to end-of-month, compute monthly % returns."""
    if len(nav_series) < 20:
        return []
    monthly = nav_series.resample("ME").last().dropna()
    monthly_ret = monthly.pct_change().dropna()
    result = []
    for dt, ret in monthly_ret.items():
        result.append({
            "monthYear": dt.strftime("%Y-%m"),
            "returnPct": round(float(ret) * 100, 4),
            "navEnd": round(float(monthly.loc[dt]), 4),
        })
    return result


def _sip_xirr(nav_series: pd.Series, years: int) -> Optional[float]:
    """
    Simulate equal monthly SIP of 10,000 over `years` years, compute XIRR.
    Uses NAV on or just after each SIP date to determine units allotted.
    """
    if nav_series.empty:
        return None
    latest_date = nav_series.index[-1]
    start_date = latest_date - pd.DateOffset(years=years)
    relevant = nav_series[nav_series.index >= start_date]
    if len(relevant) < 6:
        return None

    sip_amount = 10000.0
    total_units = 0.0
    cashflows = []

    # Monthly SIP dates
    sip_dates = pd.date_range(start=start_date, end=latest_date, freq="MS")
    for sip_dt in sip_dates:
        # Find NAV on or after the SIP date
        future = relevant[relevant.index >= sip_dt]
        if future.empty:
            continue
        nav_on_date = float(future.iloc[0])
        units = sip_amount / nav_on_date
        total_units += units
        cashflows.append((sip_dt.date(), -sip_amount))

    if not cashflows or total_units <= 0:
        return None

    # Redemption: current value
    current_value = total_units * float(nav_series.iloc[-1])
    cashflows.append((latest_date.date(), current_value))

    # XIRR
    base = cashflows[0][0]
    amounts = [cf[1] for cf in cashflows]
    dates_days = [(cf[0] - base).days / 365.0 for cf in cashflows]

    def npv(r):
        return sum(a / (1 + r) ** t for a, t in zip(amounts, dates_days))

    try:
        rate = brentq(npv, -0.999, 100.0, maxiter=500, xtol=1e-8)
        return round(rate * 100, 4)
    except Exception:
        return None


def _benchmark_metrics(fund_series: pd.Series, bench_series: pd.Series) -> Dict:
    """
    Compute beta, alpha, tracking error, information ratio vs benchmark.
    Both series are NAV-indexed daily time series.
    """
    if bench_series.empty or len(fund_series) < 20:
        return {}

    # Align on common dates
    common = fund_series.index.intersection(bench_series.index)
    if len(common) < 20:
        # Reindex with forward-fill if dates don't align
        merged = pd.concat([fund_series, bench_series], axis=1, join="inner")
        merged.columns = ["fund", "bench"]
        merged = merged.dropna()
        if len(merged) < 20:
            return {}
        f_ret = merged["fund"].pct_change().dropna()
        b_ret = merged["bench"].pct_change().dropna()
    else:
        f_ret = fund_series.loc[common].pct_change().dropna()
        b_ret = bench_series.loc[common].pct_change().dropna()

    # Align lengths
    min_len = min(len(f_ret), len(b_ret))
    if min_len < 20:
        return {}
    f_ret = f_ret.iloc[-min_len:]
    b_ret = b_ret.iloc[-min_len:]

    cov_matrix = np.cov(f_ret.values, b_ret.values)
    bench_var = cov_matrix[1, 1]
    beta = round(float(cov_matrix[0, 1] / bench_var), 4) if bench_var > 1e-12 else None

    # Annualized returns
    fund_ann = float((1 + f_ret).prod() ** (TRADING_DAYS / len(f_ret)) - 1)
    bench_ann = float((1 + b_ret).prod() ** (TRADING_DAYS / len(b_ret)) - 1)

    alpha = round((fund_ann - (RF_ANNUAL + (beta or 0) * (bench_ann - RF_ANNUAL))) * 100, 4)

    # Tracking error
    active_returns = f_ret.values - b_ret.values
    tracking_error = round(float(np.std(active_returns, ddof=1) * np.sqrt(TRADING_DAYS)) * 100, 4)

    # Information ratio
    active_ann = round((fund_ann - bench_ann) * 100, 4)
    info_ratio = round(active_ann / tracking_error, 4) if tracking_error > 1e-8 else None

    return {
        "beta": beta,
        "alpha": alpha,
        "trackingError": tracking_error,
        "informationRatio": info_ratio,
        "benchmarkAnnReturn": round(bench_ann * 100, 4),
        "fundAnnReturn": round(fund_ann * 100, 4),
    }


def _compute_all_metrics(nav_series: pd.Series, bench_series: Optional[pd.Series] = None) -> Dict:
    """Master function: compute every metric from a NAV time series."""
    if nav_series.empty:
        return {"error": "Empty NAV series"}

    result: Dict[str, Any] = {
        "latestNav": round(float(nav_series.iloc[-1]), 4),
        "latestDate": nav_series.index[-1].strftime("%Y-%m-%d"),
        "inceptionDate": nav_series.index[0].strftime("%Y-%m-%d"),
        "dataPoints": len(nav_series),
    }

    # Return periods
    result["return1W"] = _simple_return(nav_series, 7)
    result["return1M"] = _simple_return(nav_series, 30)
    result["return3M"] = _simple_return(nav_series, 91)
    result["return6M"] = _simple_return(nav_series, 182)
    result["return1Y"] = _cagr(nav_series, 1)
    result["return3Y"] = _cagr(nav_series, 3)
    result["return5Y"] = _cagr(nav_series, 5)
    result["return10Y"] = _cagr(nav_series, 10)

    # Since inception (CAGR)
    n_days = (nav_series.index[-1] - nav_series.index[0]).days
    if n_days >= 30:
        years = n_days / 365.0
        try:
            inception_cagr = round(
                ((float(nav_series.iloc[-1]) / float(nav_series.iloc[0])) ** (1 / years) - 1) * 100, 4
            )
            result["returnSinceInception"] = inception_cagr
        except Exception:
            result["returnSinceInception"] = None

    # Risk metrics
    risk = _risk_metrics(nav_series)
    result.update(risk)

    # Monthly series
    result["monthlySeries"] = _monthly_series(nav_series)

    # SIP returns
    result["sipReturn1Y"] = _sip_xirr(nav_series, 1)
    result["sipReturn3Y"] = _sip_xirr(nav_series, 3)
    result["sipReturn5Y"] = _sip_xirr(nav_series, 5)

    # Benchmark metrics
    if bench_series is not None and not bench_series.empty:
        bench_m = _benchmark_metrics(nav_series, bench_series)
        result.update(bench_m)

    result["modelVersion"] = "py-mf-analytics-v1"
    result["computedAt"] = datetime.utcnow().isoformat() + "Z"
    return result


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/compute-metrics")
async def compute_metrics(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute full MF analytics from provided NAV history arrays.

    Input:
      schemeCode: str
      navHistory: [{date: "YYYY-MM-DD", nav: float}]   (required, sorted asc)
      benchmarkHistory: [{date: "YYYY-MM-DD", nav: float}]  (optional)

    Output: full analytics dict with CAGR periods, risk ratios, monthly series, SIP XIRR
    """
    try:
        scheme_code = payload.get("schemeCode", "")
        nav_raw = payload.get("navHistory", [])
        bench_raw = payload.get("benchmarkHistory")

        if not nav_raw:
            return {"error": "navHistory is required"}

        nav_series = _to_series(nav_raw)
        bench_series = _to_series(bench_raw) if bench_raw else None

        result = _compute_all_metrics(nav_series, bench_series)
        result["schemeCode"] = scheme_code
        return result

    except Exception as e:
        return {"error": str(e)}


@router.get("/scheme-analytics")
async def scheme_analytics(
    scheme_code: str = Query(..., description="AMFI scheme code"),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute full analytics for a scheme directly from DB.
    Reads mf_nav_history + mf_benchmark_map + market_index_nav.
    """
    try:
        async with db_conn() as conn:
            # Fetch NAV history
            navs = await conn.fetch(
                """
                SELECT nav_date AS date, nav
                FROM mf_nav_history
                WHERE scheme_code = $1
                ORDER BY nav_date ASC
                """,
                scheme_code,
            )

            if not navs:
                return {"schemeCode": scheme_code, "error": "No NAV history found for this scheme code"}

            # Fetch benchmark mapping
            bench_map = await conn.fetchrow(
                """
                SELECT b.index_code
                FROM mf_benchmark_map b
                JOIN mutual_funds mf ON mf.scheme_code = b.mf_scheme_code
                WHERE b.mf_scheme_code = $1
                LIMIT 1
                """,
                scheme_code,
            )

            bench_navs = []
            if bench_map:
                index_id = bench_map["index_code"]
                bench_rows = await conn.fetch(
                    """
                    SELECT nav_date AS date, close_value AS nav
                    FROM market_index_nav
                    WHERE index_id = $1
                    ORDER BY nav_date ASC
                    """,
                    index_id,
                )
                bench_navs = [dict(r) for r in bench_rows]

        nav_raw = [{"date": str(r["date"]), "nav": float(r["nav"])} for r in navs]
        nav_series = _to_series(nav_raw)

        bench_series = None
        if bench_navs:
            bench_series = _to_series([{"date": str(r["date"]), "nav": float(r["nav"])} for r in bench_navs])

        result = _compute_all_metrics(nav_series, bench_series)
        result["schemeCode"] = scheme_code
        result["hasBenchmark"] = bench_series is not None and not bench_series.empty
        result["navDataPoints"] = len(navs)

        return result

    except Exception as e:
        return {"error": str(e), "schemeCode": scheme_code}


@router.post("/monthly-series")
async def compute_monthly_series(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute monthly return series from NAV history.
    Returns list suitable for bulk-upsert into mf_monthly_returns or mf_monthwise_performance.

    Input:
      schemes: [{schemeCode, navHistory: [{date, nav}]}]
    Output:
      results: [{schemeCode, months: [{monthYear, navStart, navEnd, returnPct}]}]
    """
    try:
        schemes = payload.get("schemes", [])
        if not schemes:
            return {"error": "schemes array is required"}

        results = []
        for item in schemes:
            sc = item.get("schemeCode", "")
            nav_raw = item.get("navHistory", [])
            if not nav_raw or len(nav_raw) < 2:
                results.append({"schemeCode": sc, "months": [], "error": "Insufficient data"})
                continue

            nav_series = _to_series(nav_raw)
            if len(nav_series) < 2:
                results.append({"schemeCode": sc, "months": [], "error": "Insufficient data"})
                continue

            monthly = nav_series.resample("ME").agg(["first", "last"]).dropna()
            monthly.columns = ["nav_start", "nav_end"]
            monthly["return_pct"] = (monthly["nav_end"] / monthly["nav_start"] - 1) * 100

            months = []
            for dt, row in monthly.iterrows():
                months.append({
                    "monthYear": dt.strftime("%Y-%m"),
                    "navStart": round(float(row["nav_start"]), 4),
                    "navEnd": round(float(row["nav_end"]), 4),
                    "returnPct": round(float(row["return_pct"]), 4),
                })
            results.append({"schemeCode": sc, "months": months})

        return {"results": results, "processedSchemes": len(results)}

    except Exception as e:
        return {"error": str(e)}


@router.post("/bulk-compute-db")
async def bulk_compute_db(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Bulk compute metrics for all schemes in mf_nav_history with sufficient data.
    Computes metrics and upserts into mutual_fund_metrics + mf_monthly_returns.
    Requires admin/agent role.
    Returns summary of schemes processed.
    Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        limit = int(payload.get("limit", 200))
        min_days = int(payload.get("minDays", 30))
        fiscal_year = payload.get("fiscalYear", "FY25-26")

        async with db_conn() as conn:
            # Get schemes with enough NAV data
            scheme_rows = await conn.fetch(
                """
                SELECT scheme_code, COUNT(*) as nav_count
                FROM mf_nav_history
                GROUP BY scheme_code
                HAVING COUNT(*) >= $1
                ORDER BY nav_count DESC
                LIMIT $2
                """,
                min_days,
                limit,
            )

            if not scheme_rows:
                return {"message": "No schemes with sufficient NAV data", "processed": 0}

            scheme_codes = [r["scheme_code"] for r in scheme_rows]

            # Fetch all NAV data for these schemes in one query
            all_navs = await conn.fetch(
                """
                SELECT scheme_code, nav_date, nav
                FROM mf_nav_history
                WHERE scheme_code = ANY($1::text[])
                ORDER BY scheme_code, nav_date ASC
                """,
                scheme_codes,
            )

            # Group by scheme
            from collections import defaultdict
            nav_by_scheme = defaultdict(list)
            for row in all_navs:
                nav_by_scheme[row["scheme_code"]].append({
                    "date": str(row["nav_date"]),
                    "nav": float(row["nav"]),
                })

            # Compute metrics per scheme
            metrics_upserts = []
            monthly_upserts = []
            errors = []

            for sc in scheme_codes:
                nav_raw = nav_by_scheme.get(sc, [])
                if len(nav_raw) < min_days:
                    continue
                try:
                    nav_series = _to_series(nav_raw)
                    result = _compute_all_metrics(nav_series)

                    # Prepare metrics upsert
                    metrics_upserts.append({
                        "scheme_code": sc,
                        "fiscal_year": fiscal_year,
                        "return_1m": result.get("return1M"),
                        "return_3m": result.get("return3M"),
                        "return_6m": result.get("return6M"),
                        "return_1y": result.get("return1Y"),
                        "return_3y": result.get("return3Y"),
                        "return_5y": result.get("return5Y"),
                        "return_10y": result.get("return10Y"),
                        "return_since_inception": result.get("returnSinceInception"),
                        "cagr_3y": result.get("return3Y"),
                        "cagr_5y": result.get("return5Y"),
                        "cagr_10y": result.get("return10Y"),
                        "sharpe_ratio": result.get("sharpeRatio"),
                        "sortino_ratio": result.get("sortinoRatio"),
                        "max_drawdown": result.get("maxDrawdown"),
                        "sip_return_1y": result.get("sipReturn1Y"),
                        "sip_return_3y": result.get("sipReturn3Y"),
                        "sip_return_5y": result.get("sipReturn5Y"),
                        "volatility": result.get("volatility"),
                        "calmar_ratio": result.get("calmarRatio"),
                        "alpha": result.get("alpha"),
                        "beta": result.get("beta"),
                        "tracking_error": result.get("trackingError"),
                        "information_ratio": result.get("informationRatio"),
                    })

                    # Monthly series for upsert — build nav_start from previous month nav_end
                    monthly_list = result.get("monthlySeries", [])
                    for i, m in enumerate(monthly_list):
                        nav_start = monthly_list[i - 1]["navEnd"] if i > 0 else None
                        monthly_upserts.append({
                            "scheme_code": sc,
                            "month_year": m["monthYear"],
                            "return_percent": m["returnPct"],
                            "nav_start": nav_start,
                            "nav_end": m["navEnd"],
                        })
                except Exception as e:
                    errors.append({"schemeCode": sc, "error": str(e)})

            # Bulk upsert metrics
            updated_count = 0
            for m in metrics_upserts:
                try:
                    await conn.execute(
                        """
                        UPDATE mutual_fund_metrics SET
                          return_1m = COALESCE($3, return_1m),
                          return_3m = COALESCE($4, return_3m),
                          return_6m = COALESCE($5, return_6m),
                          return_1y = COALESCE($6, return_1y),
                          return_3y = COALESCE($7, return_3y),
                          return_5y = COALESCE($8, return_5y),
                          return_10y = COALESCE($9, return_10y),
                          return_since_inception = COALESCE($10, return_since_inception),
                          cagr_3y = COALESCE($11, cagr_3y),
                          cagr_5y = COALESCE($12, cagr_5y),
                          cagr_10y = COALESCE($13, cagr_10y),
                          sharpe_ratio = COALESCE($14, sharpe_ratio),
                          sortino_ratio = COALESCE($15, sortino_ratio),
                          max_drawdown = COALESCE($16, max_drawdown),
                          sip_return_1y = COALESCE($17, sip_return_1y),
                          sip_return_3y = COALESCE($18, sip_return_3y),
                          sip_return_5y = COALESCE($19, sip_return_5y),
                          volatility = COALESCE($20, volatility),
                          calmar_ratio = COALESCE($21, calmar_ratio),
                          alpha = COALESCE($22, alpha),
                          beta = COALESCE($23, beta),
                          tracking_error = COALESCE($24, tracking_error),
                          information_ratio = COALESCE($25, information_ratio),
                          last_updated = NOW()
                        WHERE scheme_code = $1 AND fiscal_year = $2
                        """,
                        m["scheme_code"], m["fiscal_year"],
                        m["return_1m"], m["return_3m"], m["return_6m"],
                        m["return_1y"], m["return_3y"], m["return_5y"], m["return_10y"],
                        m["return_since_inception"],
                        m["cagr_3y"], m["cagr_5y"], m["cagr_10y"],
                        m["sharpe_ratio"], m["sortino_ratio"], m["max_drawdown"],
                        m["sip_return_1y"], m["sip_return_3y"], m["sip_return_5y"],
                        m["volatility"], m["calmar_ratio"],
                        m.get("alpha"), m.get("beta"), m.get("tracking_error"), m.get("information_ratio"),
                    )
                    updated_count += 1
                except Exception as e:
                    errors.append({"schemeCode": m["scheme_code"], "error": str(e)})

            # Bulk upsert monthly returns
            monthly_count = 0
            for mr in monthly_upserts:
                try:
                    await conn.execute(
                        """
                        INSERT INTO mf_monthly_returns (scheme_code, month_year, return_percent, nav_start, nav_end)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (scheme_code, month_year)
                        DO UPDATE SET return_percent = EXCLUDED.return_percent,
                                      nav_start = COALESCE(EXCLUDED.nav_start, mf_monthly_returns.nav_start),
                                      nav_end = EXCLUDED.nav_end,
                                      updated_at = NOW()
                        """,
                        mr["scheme_code"], mr["month_year"],
                        mr["return_percent"], mr.get("nav_start"), mr["nav_end"],
                    )
                    monthly_count += 1
                except Exception:
                    pass

        return {
            "message": "Bulk compute complete",
            "schemesProcessed": len(metrics_upserts),
            "metricsUpdated": updated_count,
            "monthlyRowsUpserted": monthly_count,
            "errors": errors[:20],
            "modelVersion": "py-mf-analytics-v1",
        }

    except Exception as e:
        return {"error": str(e)}
