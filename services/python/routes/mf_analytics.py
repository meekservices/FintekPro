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


# ---------------------------------------------------------------------------
# NAV Backfill Bridge  (historical_nav_data → mf_nav_history)
# ---------------------------------------------------------------------------

@router.post("/nav-backfill")
async def nav_backfill(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Copies NAV rows from historical_nav_data (identifier_type='mutual_fund')
    into mf_nav_history, bridging identifier → scheme_code and date → nav_date.
    Uses ON CONFLICT DO NOTHING so it is safe to re-run.
    Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        scheme_limit = int(payload.get("limit", 500))
        offset = int(payload.get("offset", 0))
        min_rows = int(payload.get("minRows", 10))

        async with db_conn() as conn:
            # Distinct scheme codes that have enough rows in historical_nav_data
            schemes = await conn.fetch(
                """
                SELECT identifier as scheme_code, COUNT(*) as cnt
                FROM historical_nav_data
                WHERE identifier_type = 'mutual_fund'
                  AND nav IS NOT NULL
                GROUP BY identifier
                HAVING COUNT(*) >= $1
                ORDER BY cnt DESC
                LIMIT $2 OFFSET $3
                """,
                min_rows, scheme_limit, offset,
            )

        if not schemes:
            return {"message": "No schemes found in historical_nav_data", "rowsInserted": 0}

        scheme_codes = [r["scheme_code"] for r in schemes]
        total_inserted = 0
        errors = []

        # Process in batches of 50 schemes
        batch_size = 50
        for i in range(0, len(scheme_codes), batch_size):
            batch = scheme_codes[i: i + batch_size]
            try:
                async with db_conn() as conn:
                    rows = await conn.fetch(
                        """
                        SELECT identifier AS scheme_code, date AS nav_date, nav
                        FROM historical_nav_data
                        WHERE identifier_type = 'mutual_fund'
                          AND identifier = ANY($1::text[])
                          AND nav IS NOT NULL
                        ORDER BY identifier, date
                        """,
                        batch,
                    )

                    if rows:
                        result = await conn.execute(
                            """
                            INSERT INTO mf_nav_history (scheme_code, nav_date, nav, created_at)
                            SELECT t.scheme_code, t.nav_date, t.nav, NOW()
                            FROM UNNEST($1::text[], $2::date[], $3::numeric[])
                                AS t(scheme_code, nav_date, nav)
                            ON CONFLICT (scheme_code, nav_date) DO NOTHING
                            """,
                            [r["scheme_code"] for r in rows],
                            [r["nav_date"] for r in rows],
                            [float(r["nav"]) for r in rows],
                        )
                        # result is like "INSERT 0 N"
                        try:
                            inserted = int(str(result).split()[-1])
                        except Exception:
                            inserted = len(rows)
                        total_inserted += inserted
            except Exception as e:
                errors.append(str(e))

        # Depth stats after backfill
        async with db_conn() as conn:
            stats = await conn.fetchrow(
                """
                SELECT
                  COUNT(DISTINCT scheme_code) as total_schemes,
                  ROUND(AVG(cnt)::numeric, 1) as avg_days,
                  MAX(cnt) as max_days,
                  SUM(CASE WHEN cnt >= 365 THEN 1 ELSE 0 END) as schemes_365plus,
                  SUM(CASE WHEN cnt >= 100 THEN 1 ELSE 0 END) as schemes_100plus
                FROM (
                  SELECT scheme_code, COUNT(*) as cnt
                  FROM mf_nav_history
                  GROUP BY scheme_code
                ) s
                """
            )

        return {
            "message": "NAV backfill complete",
            "schemesProcessed": len(scheme_codes),
            "rowsInserted": total_inserted,
            "errors": errors[:10],
            "depthAfter": {
                "totalSchemes": stats["total_schemes"],
                "avgDays": float(stats["avg_days"] or 0),
                "maxDays": stats["max_days"],
                "schemes365Plus": stats["schemes_365plus"],
                "schemes100Plus": stats["schemes_100plus"],
            },
            "modelVersion": "py-mf-nav-backfill-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# AMFI Enrichment  (5 null columns in mutual_funds)
# ---------------------------------------------------------------------------

@router.post("/amfi-enrich")
async def amfi_enrich(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Fetches AMFI NAVAll.txt and parses:
      - scheme_sub_category  (from section headers like "Large Cap Fund")
      - amc_name / amc_code  (from AMC section headers)
      - launch_date proxy    (MIN(nav_date) from mf_nav_history)
      - change / change_percent (latest 2 nav rows LAG calc from mf_nav_history)
    Updates mutual_funds table. Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    import re
    try:
        import httpx
    except ImportError:
        import subprocess
        subprocess.run(["pip", "install", "httpx"], capture_output=True)
        import httpx

    try:
        # Fetch AMFI data
        url = "https://www.amfiindia.com/spages/NAVAll.txt"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
        text = resp.text

        amc_map: Dict[str, Dict[str, str]] = {}  # scheme_code → {amc_name, sub_category}
        current_amc = ""
        current_subcat = ""
        current_open_close = ""

        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue

            # AMC header: "Aditya Birla Sun Life Mutual Fund"
            if line.endswith("Mutual Fund") or line.endswith("Asset Management"):
                current_amc = line
                continue

            # Category/sub-category header e.g. "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
            m = re.match(r"(Open|Close) Ended Schemes\((.+?)\)", line, re.IGNORECASE)
            if m:
                current_open_close = m.group(1).capitalize()
                category_part = m.group(2).strip()
                # e.g. "Equity Scheme - Large Cap Fund" → sub_category = "Large Cap Fund"
                if " - " in category_part:
                    current_subcat = category_part.split(" - ", 1)[1].strip()
                else:
                    current_subcat = category_part.strip()
                continue

            # Data line: SchemeCode;ISINDiv;ISINGrowth;SchemeName;NAV;...;Date
            parts = line.split(";")
            if len(parts) >= 5:
                scheme_code = parts[0].strip()
                if scheme_code.isdigit():
                    amc_map[scheme_code] = {
                        "amc_name": current_amc,
                        "scheme_sub_category": current_subcat,
                    }

        if not amc_map:
            return {"error": "Could not parse AMFI data", "linesChecked": len(text.splitlines())}

        # Get launch_date proxy from mf_nav_history (MIN nav_date per scheme)
        async with db_conn() as conn:
            launch_rows = await conn.fetch(
                """
                SELECT scheme_code, MIN(nav_date) as first_nav_date
                FROM mf_nav_history
                WHERE nav_date IS NOT NULL
                GROUP BY scheme_code
                """
            )
            # Get change_percent from latest 2 rows per scheme
            change_rows = await conn.fetch(
                """
                WITH ranked AS (
                  SELECT scheme_code, nav,
                         LAG(nav) OVER (PARTITION BY scheme_code ORDER BY nav_date) AS prev_nav,
                         ROW_NUMBER() OVER (PARTITION BY scheme_code ORDER BY nav_date DESC) AS rn
                  FROM mf_nav_history
                )
                SELECT scheme_code, nav, prev_nav
                FROM ranked WHERE rn = 1 AND prev_nav IS NOT NULL
                """
            )

        launch_map: Dict[str, Any] = {str(r["scheme_code"]): r["first_nav_date"] for r in launch_rows}
        change_map: Dict[str, Dict] = {}
        for r in change_rows:
            sc = str(r["scheme_code"])
            if r["nav"] and r["prev_nav"]:
                nav = float(r["nav"])
                prev = float(r["prev_nav"])
                chg = round(nav - prev, 4)
                chg_pct = round((chg / prev) * 100, 4) if prev != 0 else 0
                change_map[sc] = {"change": chg, "change_percent": chg_pct}

        # Build update list
        updates = []
        for scheme_code, meta in amc_map.items():
            upd: Dict[str, Any] = {"scheme_code": scheme_code}
            if meta.get("amc_name"):
                upd["amc_name"] = meta["amc_name"]
            if meta.get("scheme_sub_category"):
                upd["scheme_sub_category"] = meta["scheme_sub_category"]
            if scheme_code in launch_map and launch_map[scheme_code]:
                upd["launch_date"] = launch_map[scheme_code]
            if scheme_code in change_map:
                upd["change"] = change_map[scheme_code]["change"]
                upd["change_percent"] = change_map[scheme_code]["change_percent"]
            if len(upd) > 1:
                updates.append(upd)

        # Upsert in batches
        updated = 0
        skipped = 0
        async with db_conn() as conn:
            for upd in updates:
                try:
                    sc = upd["scheme_code"]
                    fields = {k: v for k, v in upd.items() if k != "scheme_code"}
                    if not fields:
                        skipped += 1
                        continue
                    set_parts = [f"{k} = ${i + 2}" for i, k in enumerate(fields.keys())]
                    vals = [sc] + list(fields.values())
                    res = await conn.execute(
                        f"UPDATE mutual_funds SET {', '.join(set_parts)}, last_updated = NOW() "
                        f"WHERE scheme_code = $1",
                        *vals,
                    )
                    if res == "UPDATE 1":
                        updated += 1
                    else:
                        skipped += 1
                except Exception:
                    skipped += 1

        return {
            "message": "AMFI enrichment complete",
            "amfiSchemesFound": len(amc_map),
            "updatesApplied": updated,
            "skipped": skipped,
            "withChangePercent": len(change_map),
            "withLaunchDate": len(launch_map),
            "modelVersion": "py-mf-amfi-enrich-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Monthly Return Generation Pipeline (chains: monthly-series → cross-sectional-rank → risk-from-monthly)
# ---------------------------------------------------------------------------

@router.post("/monthly-pipeline")
async def monthly_pipeline(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Full pipeline: generates mf_monthly_returns from mf_nav_history, then
    runs cross-sectional ranking, then risk-from-monthly for all eligible schemes.
    Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        fiscal_year = payload.get("fiscalYear", "FY25-26")
        min_days = int(payload.get("minDays", 30))
        min_months = int(payload.get("minMonths", 6))
        scheme_limit = int(payload.get("limit", 2000))

        step_results: Dict[str, Any] = {}

        # ── Step 1: Generate monthly returns from mf_nav_history ──────────
        async with db_conn() as conn:
            scheme_rows = await conn.fetch(
                """
                SELECT scheme_code, COUNT(*) as cnt
                FROM mf_nav_history
                WHERE nav IS NOT NULL
                GROUP BY scheme_code
                HAVING COUNT(*) >= $1
                ORDER BY cnt DESC
                LIMIT $2
                """,
                min_days, scheme_limit,
            )
            if not scheme_rows:
                return {"error": "No schemes with sufficient NAV data"}

            sc_list = [r["scheme_code"] for r in scheme_rows]

            nav_rows = await conn.fetch(
                """
                SELECT scheme_code, nav_date, nav
                FROM mf_nav_history
                WHERE scheme_code = ANY($1::text[])
                  AND nav IS NOT NULL
                ORDER BY scheme_code, nav_date
                """,
                sc_list,
            )

        df = pd.DataFrame([dict(r) for r in nav_rows])
        df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
        df["nav_date"] = pd.to_datetime(df["nav_date"])
        df = df.dropna(subset=["nav"])

        monthly_rows = []
        for sc, grp in df.groupby("scheme_code"):
            grp = grp.set_index("nav_date").sort_index()
            monthly = grp["nav"].resample("ME").last().dropna()
            monthly_ret = monthly.pct_change().dropna() * 100
            for dt, ret in monthly_ret.items():
                monthly_rows.append({
                    "scheme_code": str(sc),
                    "month_year": dt.date(),
                    "return_percent": round(float(ret), 4),
                })

        monthly_inserted = 0
        if monthly_rows:
            async with db_conn() as conn:
                result = await conn.execute(
                    """
                    INSERT INTO mf_monthly_returns (scheme_code, month_year, return_percent)
                    SELECT t.sc, t.my, t.rp
                    FROM UNNEST($1::text[], $2::date[], $3::numeric[])
                        AS t(sc, my, rp)
                    ON CONFLICT (scheme_code, month_year) DO UPDATE
                      SET return_percent = EXCLUDED.return_percent
                    """,
                    [r["scheme_code"] for r in monthly_rows],
                    [r["month_year"] for r in monthly_rows],
                    [r["return_percent"] for r in monthly_rows],
                )
                try:
                    monthly_inserted = int(str(result).split()[-1])
                except Exception:
                    monthly_inserted = len(monthly_rows)

        step_results["step1_monthly_series"] = {
            "schemesProcessed": len(sc_list),
            "monthlyRowsUpserted": monthly_inserted,
        }

        # ── Step 2: Cross-sectional ranking ──────────────────────────────
        async with db_conn() as conn:
            rank_rows = await conn.fetch(
                """
                SELECT mfm.scheme_code, mfm.return_1y, mf.category
                FROM mutual_fund_metrics mfm
                JOIN mutual_funds mf ON mf.scheme_code = mfm.scheme_code
                WHERE mfm.return_1y IS NOT NULL
                  AND mf.category IS NOT NULL
                  AND mfm.fiscal_year = $1
                """,
                fiscal_year,
            )

        rank_updated = 0
        if rank_rows:
            rdf = pd.DataFrame([dict(r) for r in rank_rows])
            rdf["return_1y"] = pd.to_numeric(rdf["return_1y"], errors="coerce")
            rdf = rdf.dropna(subset=["return_1y", "category"])
            rdf["category_size"] = rdf.groupby("category")["return_1y"].transform("count").astype(int)
            rdf["category_rank"] = rdf.groupby("category")["return_1y"].rank(ascending=False, method="min").astype(int)
            rdf["percentile_rank"] = (rdf.groupby("category")["return_1y"].rank(pct=True, ascending=True) * 100).round(2)

            async with db_conn() as conn:
                for _, row in rdf.iterrows():
                    try:
                        await conn.execute(
                            """
                            UPDATE mutual_fund_metrics
                            SET category_rank=$3, category_size=$4, percentile_rank=$5, last_updated=NOW()
                            WHERE scheme_code=$1 AND fiscal_year=$2
                            """,
                            row["scheme_code"], fiscal_year,
                            int(row["category_rank"]), int(row["category_size"]),
                            float(row["percentile_rank"]),
                        )
                        rank_updated += 1
                    except Exception:
                        pass

        step_results["step2_cross_sectional_rank"] = {
            "schemesRanked": rank_updated,
            "uniqueCategories": rdf["category"].nunique() if rank_rows else 0,
        }

        # ── Step 3: Risk from monthly returns ─────────────────────────────
        async with db_conn() as conn:
            mr_rows = await conn.fetch(
                """
                SELECT scheme_code, return_percent
                FROM mf_monthly_returns
                WHERE return_percent IS NOT NULL
                ORDER BY scheme_code, month_year
                """
            )

        risk_updated = 0
        if mr_rows:
            mdf = pd.DataFrame([dict(r) for r in mr_rows])
            mdf["return_percent"] = pd.to_numeric(mdf["return_percent"], errors="coerce")
            mdf = mdf.dropna(subset=["return_percent"])

            risk_updates = []
            for sc, grp in mdf.groupby("scheme_code"):
                rets = grp["return_percent"].values
                if len(rets) < min_months:
                    continue
                var_95 = round(float(np.percentile(rets, 5)), 4)
                threshold = np.percentile(rets, 5)
                cvar_95 = round(float(rets[rets <= threshold].mean()), 4) if (rets <= threshold).any() else var_95
                neg = rets[rets < 0] / 100.0
                semi_dev = round(float(np.std(neg, ddof=1) * np.sqrt(12) * 100), 4) if len(neg) > 1 else None
                consistency = int(round((rets > 0).sum() / len(rets) * 100))
                risk_updates.append({
                    "scheme_code": str(sc),
                    "var_95": var_95, "cvar_95": cvar_95,
                    "semi_deviation": semi_dev, "consistency_score": consistency,
                })

            async with db_conn() as conn:
                for m in risk_updates:
                    try:
                        await conn.execute(
                            """
                            UPDATE mutual_fund_metrics SET
                              var_95 = COALESCE($3, var_95),
                              cvar_95 = COALESCE($4, cvar_95),
                              semi_deviation = COALESCE($5, semi_deviation),
                              consistency_score = COALESCE($6::integer, consistency_score),
                              last_updated = NOW()
                            WHERE scheme_code = $1 AND fiscal_year = $2
                            """,
                            m["scheme_code"], fiscal_year,
                            m["var_95"], m["cvar_95"],
                            m.get("semi_deviation"), m["consistency_score"],
                        )
                        risk_updated += 1
                    except Exception:
                        pass

        step_results["step3_risk_metrics"] = {
            "schemesUpdated": risk_updated,
        }

        return {
            "message": "Monthly pipeline complete",
            "pipeline": step_results,
            "modelVersion": "py-mf-monthly-pipeline-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Cross-Sectional Ranking Engine
# ---------------------------------------------------------------------------

@router.post("/cross-sectional-rank")
async def cross_sectional_rank(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute category_rank, category_size, percentile_rank for all schemes
    that have return_1y populated. Uses pandas groupby + rank within each category.
    Upserts results back into mutual_fund_metrics. Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        fiscal_year = payload.get("fiscalYear", "FY25-26")

        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT mfm.scheme_code, mfm.return_1y, mf.category
                FROM mutual_fund_metrics mfm
                JOIN mutual_funds mf ON mf.scheme_code = mfm.scheme_code
                WHERE mfm.return_1y IS NOT NULL
                  AND mf.category IS NOT NULL
                  AND mfm.fiscal_year = $1
                """,
                fiscal_year,
            )

        if not rows:
            return {"message": "No rankable schemes found", "updated": 0}

        df = pd.DataFrame([dict(r) for r in rows])
        df["return_1y"] = pd.to_numeric(df["return_1y"], errors="coerce")
        df = df.dropna(subset=["return_1y", "category"])

        df["category_size"] = df.groupby("category")["return_1y"].transform("count").astype(int)
        df["category_rank"] = df.groupby("category")["return_1y"].rank(ascending=False, method="min").astype(int)
        df["percentile_rank"] = (
            df.groupby("category")["return_1y"].rank(pct=True, ascending=True) * 100
        ).round(2)

        updated = 0
        async with db_conn() as conn:
            for _, row in df.iterrows():
                try:
                    await conn.execute(
                        """
                        UPDATE mutual_fund_metrics
                        SET category_rank = $3,
                            category_size = $4,
                            percentile_rank = $5,
                            last_updated = NOW()
                        WHERE scheme_code = $1 AND fiscal_year = $2
                        """,
                        row["scheme_code"], fiscal_year,
                        int(row["category_rank"]),
                        int(row["category_size"]),
                        float(row["percentile_rank"]),
                    )
                    updated += 1
                except Exception:
                    pass

        cat_summary = (
            df.groupby("category")
            .agg(schemes=("category_size", "first"), avg_1y_return=("return_1y", "mean"))
            .round(2).reset_index()
            .sort_values("schemes", ascending=False)
            .to_dict(orient="records")
        )

        return {
            "message": "Cross-sectional ranking complete",
            "schemesRanked": updated,
            "uniqueCategories": df["category"].nunique(),
            "categorySummary": cat_summary[:20],
            "modelVersion": "py-mf-xrank-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Risk Metrics from Monthly Returns (VaR, CVaR, Semi-deviation, Capture Ratios)
# ---------------------------------------------------------------------------

@router.post("/risk-from-monthly")
async def risk_from_monthly(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute VaR 95%, CVaR 95%, semi-deviation, consistency_score, and
    upside/downside capture ratios from mf_monthly_returns.
    Upserts into mutual_fund_metrics. Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        fiscal_year = payload.get("fiscalYear", "FY25-26")
        min_months = int(payload.get("minMonths", 12))

        async with db_conn() as conn:
            mr_rows = await conn.fetch(
                """
                SELECT scheme_code, month_year, return_percent
                FROM mf_monthly_returns
                WHERE return_percent IS NOT NULL
                ORDER BY scheme_code, month_year
                """
            )
            bm_rows = await conn.fetch(
                """
                SELECT scheme_code,
                       to_char(month_year, 'YYYY-MM') as month_year,
                       benchmark_return
                FROM mf_monthwise_performance
                WHERE benchmark_return IS NOT NULL
                ORDER BY scheme_code, month_year
                """
            )

        if not mr_rows:
            return {"message": "No monthly return data found", "updated": 0}

        df = pd.DataFrame([dict(r) for r in mr_rows])
        df["return_percent"] = pd.to_numeric(df["return_percent"], errors="coerce")
        df = df.dropna(subset=["return_percent"])

        bm_df = pd.DataFrame([dict(r) for r in bm_rows]) if bm_rows else pd.DataFrame()
        if not bm_df.empty:
            bm_df["benchmark_return"] = pd.to_numeric(bm_df["benchmark_return"], errors="coerce")
            bm_df = bm_df.dropna(subset=["benchmark_return"])

        results = []

        for scheme_code, grp in df.groupby("scheme_code"):
            rets = grp["return_percent"].values
            if len(rets) < min_months:
                continue

            var_95 = round(float(np.percentile(rets, 5)), 4)
            threshold = np.percentile(rets, 5)
            cvar_95 = round(float(rets[rets <= threshold].mean()), 4) if (rets <= threshold).any() else var_95

            neg = rets[rets < 0] / 100.0
            semi_dev = round(float(np.std(neg, ddof=1) * np.sqrt(12) * 100), 4) if len(neg) > 1 else None

            consistency = round(float((rets > 0).sum()) / len(rets) * 100, 1)

            metric: Dict[str, Any] = {
                "scheme_code": str(scheme_code),
                "var_95": var_95,
                "cvar_95": cvar_95,
                "semi_deviation": semi_dev,
                "consistency_score": int(consistency),
            }

            if not bm_df.empty:
                bm_grp = bm_df[bm_df["scheme_code"] == str(scheme_code)]
                if not bm_grp.empty:
                    merged = grp.set_index("month_year").join(
                        bm_grp.set_index("month_year")[["benchmark_return"]], how="inner"
                    )
                    if len(merged) >= 6:
                        f_r = merged["return_percent"].values
                        b_r = merged["benchmark_return"].values
                        up = b_r > 0
                        dn = b_r < 0
                        if up.sum() >= 3 and b_r[up].mean() != 0:
                            metric["upside_capture_ratio"] = round(float(f_r[up].mean() / b_r[up].mean() * 100), 4)
                        if dn.sum() >= 3 and b_r[dn].mean() != 0:
                            metric["downside_capture_ratio"] = round(float(f_r[dn].mean() / b_r[dn].mean() * 100), 4)
                        uc = metric.get("upside_capture_ratio")
                        dc = metric.get("downside_capture_ratio")
                        if uc and dc and dc != 0:
                            metric["capture_ratio"] = round(uc / dc, 4)

            results.append(metric)

        updated = 0
        async with db_conn() as conn:
            for m in results:
                try:
                    await conn.execute(
                        """
                        UPDATE mutual_fund_metrics SET
                          var_95 = COALESCE($3, var_95),
                          cvar_95 = COALESCE($4, cvar_95),
                          semi_deviation = COALESCE($5, semi_deviation),
                          consistency_score = COALESCE($6::integer, consistency_score),
                          upside_capture_ratio = COALESCE($7, upside_capture_ratio),
                          downside_capture_ratio = COALESCE($8, downside_capture_ratio),
                          capture_ratio = COALESCE($9, capture_ratio),
                          last_updated = NOW()
                        WHERE scheme_code = $1 AND fiscal_year = $2
                        """,
                        m["scheme_code"], fiscal_year,
                        m.get("var_95"), m.get("cvar_95"),
                        m.get("semi_deviation"), m.get("consistency_score"),
                        m.get("upside_capture_ratio"), m.get("downside_capture_ratio"),
                        m.get("capture_ratio"),
                    )
                    updated += 1
                except Exception:
                    pass

        return {
            "message": "Risk metrics from monthly returns complete",
            "schemesProcessed": len(results),
            "metricsUpdated": updated,
            "withCapture": sum(1 for m in results if "upside_capture_ratio" in m),
            "modelVersion": "py-mf-risk-monthly-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Daily Change Percent Sync (mutual_funds.change_percent)
# ---------------------------------------------------------------------------

@router.post("/sync-change-pct")
async def sync_change_pct(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute change_percent and change for mutual_funds from the latest 2
    rows in mf_nav_history (using window function LAG). Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                WITH ranked AS (
                  SELECT scheme_code, nav_date, nav,
                         LAG(nav) OVER (PARTITION BY scheme_code ORDER BY nav_date) AS prev_nav,
                         ROW_NUMBER() OVER (PARTITION BY scheme_code ORDER BY nav_date DESC) AS rn
                  FROM mf_nav_history
                )
                SELECT scheme_code, nav, prev_nav
                FROM ranked
                WHERE rn = 1 AND prev_nav IS NOT NULL
                """
            )

        if not rows:
            return {"message": "No NAV data with prev_nav", "updated": 0}

        df = pd.DataFrame([dict(r) for r in rows])
        df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
        df["prev_nav"] = pd.to_numeric(df["prev_nav"], errors="coerce")
        df = df.dropna(subset=["nav", "prev_nav"])
        df["change"] = (df["nav"] - df["prev_nav"]).round(4)
        df["change_percent"] = ((df["change"] / df["prev_nav"]) * 100).round(4)

        updated = 0
        async with db_conn() as conn:
            for _, row in df.iterrows():
                try:
                    await conn.execute(
                        """
                        UPDATE mutual_funds
                        SET change = $2,
                            change_percent = $3,
                            last_updated = NOW()
                        WHERE scheme_code = $1
                        """,
                        str(row["scheme_code"]),
                        float(row["change"]),
                        float(row["change_percent"]),
                    )
                    updated += 1
                except Exception:
                    pass

        return {
            "message": "change_percent sync complete",
            "schemesWithData": len(df),
            "schemesUpdated": updated,
            "modelVersion": "py-mf-changepct-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Derived Metrics (Treynor ratio, Jensen alpha, vol↔stddev sync)
# ---------------------------------------------------------------------------

@router.post("/derived-metrics")
async def compute_derived_metrics(
    payload: dict = Body(default={}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Compute derived metrics from existing mutual_fund_metrics columns:
    - treynor_ratio = (return_1y/100 - Rf) / beta
    - jensen_alpha = return_1y/100 - [Rf + beta * (benchmark_return - Rf)]
    - Sync: volatility ↔ standard_deviation (if one is set, copy to the other)
    Admin/agent only.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Insufficient permissions"}

    try:
        fiscal_year = payload.get("fiscalYear", "FY25-26")
        rf = RF_ANNUAL
        default_market_return = float(payload.get("defaultMarketReturn", 0.12))  # 12% Nifty proxy

        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT mfm.scheme_code, mfm.return_1y, mfm.beta,
                       mfm.volatility, mfm.standard_deviation,
                       mf.benchmark_index_code
                FROM mutual_fund_metrics mfm
                LEFT JOIN mutual_funds mf ON mf.scheme_code = mfm.scheme_code
                WHERE mfm.fiscal_year = $1
                  AND (mfm.return_1y IS NOT NULL
                       OR mfm.volatility IS NOT NULL
                       OR mfm.standard_deviation IS NOT NULL)
                """,
                fiscal_year,
            )

            # Proxy benchmark returns (approx 1Y) from market_index_nav
            bm_rows = await conn.fetch(
                """
                SELECT index_id,
                  ROUND(
                    (LAST_VALUE(close_value) OVER (PARTITION BY index_id ORDER BY nav_date
                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
                    / FIRST_VALUE(close_value) OVER (PARTITION BY index_id ORDER BY nav_date
                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
                    - 1) * 100, 4
                  ) AS approx_1y_return
                FROM market_index_nav
                WHERE nav_date >= CURRENT_DATE - INTERVAL '370 days'
                GROUP BY index_id, close_value, nav_date
                HAVING COUNT(*) OVER (PARTITION BY index_id) >= 100
                LIMIT 500
                """
            )

        bm_map = {}
        for r in bm_rows:
            idx = str(r["index_id"])
            if idx not in bm_map and r["approx_1y_return"] is not None:
                bm_map[idx] = float(r["approx_1y_return"]) / 100.0

        df = pd.DataFrame([dict(r) for r in rows])
        for col in ["return_1y", "beta", "volatility", "standard_deviation"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        updates = []
        for _, row in df.iterrows():
            u: Dict[str, Any] = {"scheme_code": row["scheme_code"]}

            r1y_pct = row["return_1y"]
            beta = row["beta"]
            vol = row["volatility"]
            std = row["standard_deviation"]

            if pd.notna(r1y_pct) and pd.notna(beta) and abs(float(beta)) > 1e-6:
                r1y = float(r1y_pct) / 100.0
                u["treynor_ratio"] = round((r1y - rf) / float(beta), 4)

                bm_idx = str(row.get("benchmark_index_code") or "")
                bm_ret = bm_map.get(bm_idx, default_market_return)
                u["jensen_alpha"] = round(r1y - (rf + float(beta) * (bm_ret - rf)), 4)

            if pd.notna(vol) and pd.isna(std):
                u["standard_deviation"] = float(vol)
            elif pd.notna(std) and pd.isna(vol):
                u["volatility"] = float(std)

            if len(u) > 1:
                updates.append(u)

        updated = 0
        async with db_conn() as conn:
            for u in updates:
                try:
                    fields = {k: v for k, v in u.items() if k != "scheme_code"}
                    if not fields:
                        continue
                    set_parts = [f"{k} = ${i + 3}" for i, k in enumerate(fields.keys())]
                    vals = [u["scheme_code"], fiscal_year] + list(fields.values())
                    await conn.execute(
                        f"UPDATE mutual_fund_metrics SET {', '.join(set_parts)}, last_updated = NOW() "
                        f"WHERE scheme_code = $1 AND fiscal_year = $2",
                        *vals,
                    )
                    updated += 1
                except Exception:
                    pass

        return {
            "message": "Derived metrics computation complete",
            "candidateSchemes": len(df),
            "updatedSchemes": updated,
            "withTreynor": sum(1 for u in updates if "treynor_ratio" in u),
            "withJensen": sum(1 for u in updates if "jensen_alpha" in u),
            "withStdDevSync": sum(1 for u in updates if "standard_deviation" in u or "volatility" in u),
            "modelVersion": "py-mf-derived-v1",
        }

    except Exception as e:
        return {"error": str(e)}
