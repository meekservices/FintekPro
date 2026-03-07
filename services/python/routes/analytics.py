from fastapi import APIRouter, Depends, Query, Body
from auth import verify_token, TokenPayload
from database import db_conn
import pandas as pd
import numpy as np
from typing import Optional, List
from decimal import Decimal

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/portfolio-summary")
async def portfolio_summary(
    user_id: Optional[int] = Query(None, description="Target user ID (agent use). Defaults to caller."),
    token: TokenPayload = Depends(verify_token),
):
    target_id = user_id if (user_id and token.role in ("agent", "admin")) else token.user_id

    async with db_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT
                scheme_name,
                isin,
                asset_class,
                sub_category,
                amc_name,
                current_value,
                invested_value,
                units,
                nav,
                holding_date
            FROM comprehensive_holdings
            WHERE user_id = $1
              AND holding_date = (
                  SELECT MAX(holding_date) FROM comprehensive_holdings WHERE user_id = $1
              )
            """,
            target_id,
        )

    if not rows:
        return {"user_id": target_id, "total_holdings": 0, "summary": {}, "amc_breakdown": [], "asset_allocation": {}}

    df = pd.DataFrame([dict(r) for r in rows])

    for col in ["current_value", "invested_value", "units", "nav"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    total_current = float(df["current_value"].sum())
    total_invested = float(df["invested_value"].sum())
    total_gain = total_current - total_invested
    gain_pct = (total_gain / total_invested * 100) if total_invested > 0 else 0

    asset_alloc = (
        df.groupby("asset_class")["current_value"]
        .sum()
        .apply(lambda v: round(float(v) / total_current * 100, 2) if total_current > 0 else 0)
        .to_dict()
    )

    amc_breakdown = (
        df.groupby("amc_name")
        .agg(
            aum=("current_value", "sum"),
            schemes=("scheme_name", "count"),
            invested=("invested_value", "sum"),
        )
        .reset_index()
        .sort_values("aum", ascending=False)
        .head(15)
        .assign(
            gain_pct=lambda x: ((x["aum"] - x["invested"]) / x["invested"].replace(0, np.nan) * 100).round(2),
            weight_pct=lambda x: (x["aum"] / total_current * 100).round(2) if total_current > 0 else 0,
        )
        .rename(columns={"amc_name": "amc"})
        .to_dict(orient="records")
    )

    for amc in amc_breakdown:
        for k, v in amc.items():
            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                amc[k] = None
            elif isinstance(v, (np.integer, np.floating)):
                amc[k] = float(v)

    return {
        "user_id": target_id,
        "total_holdings": len(df),
        "summary": {
            "total_current_value": round(total_current, 2),
            "total_invested_value": round(total_invested, 2),
            "total_gain": round(total_gain, 2),
            "gain_pct": round(gain_pct, 2),
            "holding_date": str(df["holding_date"].max()),
        },
        "asset_allocation": asset_alloc,
        "amc_breakdown": amc_breakdown,
    }


@router.get("/capital-gains")
async def capital_gains(
    user_id: Optional[int] = Query(None),
    financial_year: str = Query("2025-26", description="e.g. 2025-26"),
    token: TokenPayload = Depends(verify_token),
):
    target_id = user_id if (user_id and token.role in ("agent", "admin")) else token.user_id

    fy_parts = financial_year.split("-")
    fy_start_year = int(fy_parts[0])
    fy_start = pd.Timestamp(f"{fy_start_year}-04-01")
    fy_end = pd.Timestamp(f"{fy_start_year + 1}-03-31")

    async with db_conn() as conn:
        txns = await conn.fetch(
            """
            SELECT
                t.isin,
                t.scheme_name,
                t.transaction_type,
                t.units,
                t.nav,
                t.amount,
                t.transaction_date,
                h.asset_class,
                h.amc_name
            FROM mf_transactions t
            LEFT JOIN (
                SELECT DISTINCT isin, asset_class, amc_name
                FROM comprehensive_holdings
                WHERE user_id = $1
            ) h ON h.isin = t.isin
            WHERE t.user_id = $1
              AND t.transaction_date <= $3
            ORDER BY t.isin, t.transaction_date
            """,
            target_id, fy_start, fy_end,
        )

    if not txns:
        return {
            "user_id": target_id,
            "financial_year": financial_year,
            "stcg_equity": 0, "ltcg_equity": 0,
            "stcg_debt": 0, "ltcg_debt": 0,
            "total_gains": 0,
            "details": [],
        }

    df = pd.DataFrame([dict(r) for r in txns])
    df["units"] = pd.to_numeric(df["units"], errors="coerce").fillna(0)
    df["nav"] = pd.to_numeric(df["nav"], errors="coerce").fillna(0)
    df["transaction_date"] = pd.to_datetime(df["transaction_date"])

    results = []
    stcg_equity = ltcg_equity = stcg_debt = ltcg_debt = 0.0

    for isin, group in df.groupby("isin"):
        buys = group[group["transaction_type"].str.upper().isin(["PURCHASE", "BUY", "SIP", "SWITCH_IN", "REINVESTMENT"])].copy()
        sells = group[group["transaction_type"].str.upper().isin(["REDEMPTION", "SELL", "SWITCH_OUT"])].copy()
        sells = sells[(sells["transaction_date"] >= fy_start) & (sells["transaction_date"] <= fy_end)]

        if sells.empty:
            continue

        buy_lots = list(buys[["transaction_date", "units", "nav"]].itertuples(index=False))
        buy_queue = [[row.transaction_date, float(row.units), float(row.nav)] for row in buy_lots]
        asset_class = group["asset_class"].iloc[0] or "EQUITY"
        amc = group["amc_name"].iloc[0]
        scheme = group["scheme_name"].iloc[0]
        is_equity = "EQUITY" in str(asset_class).upper()
        # Finance Act 2024: Equity LTCG > 365 days; Debt/Gold/International LTCG > 730 days (24 months)
        stcg_hold_days = 365 if is_equity else 730

        for sell_row in sells.itertuples():
            units_to_sell = float(sell_row.units)
            sell_nav = float(sell_row.nav)
            sell_date = sell_row.transaction_date

            while units_to_sell > 0.001 and buy_queue:
                buy_date, buy_units, buy_nav = buy_queue[0]
                matched = min(units_to_sell, buy_units)
                hold_days = (sell_date - buy_date).days
                is_ltcg = hold_days > stcg_hold_days
                gain = matched * (sell_nav - buy_nav)

                if is_equity:
                    if is_ltcg:
                        ltcg_equity += gain
                    else:
                        stcg_equity += gain
                else:
                    if is_ltcg:
                        ltcg_debt += gain
                    else:
                        stcg_debt += gain

                results.append({
                    "isin": isin,
                    "scheme": scheme,
                    "amc": amc,
                    "asset_class": asset_class,
                    "buy_date": str(buy_date.date()),
                    "sell_date": str(sell_date.date()),
                    "units": round(matched, 4),
                    "buy_nav": round(buy_nav, 4),
                    "sell_nav": round(sell_nav, 4),
                    "gain": round(gain, 2),
                    "hold_days": hold_days,
                    "gain_type": "LTCG" if is_ltcg else "STCG",
                })

                if buy_units - matched < 0.001:
                    buy_queue.pop(0)
                else:
                    buy_queue[0][1] -= matched
                units_to_sell -= matched

    return {
        "user_id": target_id,
        "financial_year": financial_year,
        "stcg_equity": round(stcg_equity, 2),
        "ltcg_equity": round(ltcg_equity, 2),
        "stcg_debt": round(stcg_debt, 2),
        "ltcg_debt": round(ltcg_debt, 2),
        "total_gains": round(stcg_equity + ltcg_equity + stcg_debt + ltcg_debt, 2),
        "tax_estimate": {
            "stcg_equity_tax": round(stcg_equity * 0.20, 2),
            "ltcg_equity_tax": round(max(0, ltcg_equity - 125000) * 0.125, 2),
            "stcg_debt_tax": round(stcg_debt * 0.30, 2),
            "ltcg_debt_tax": round(ltcg_debt * 0.125, 2),
        },
        "details": sorted(results, key=lambda x: x["sell_date"], reverse=True),
    }


@router.get("/amc-breakdown")
async def amc_breakdown(
    agent_id: Optional[int] = Query(None),
    token: TokenPayload = Depends(verify_token),
):
    if token.role not in ("agent", "admin"):
        return {"error": "Agent or admin role required"}

    target_agent = agent_id or token.user_id

    async with db_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT
                ch.amc_name,
                ch.asset_class,
                SUM(ch.current_value) as total_aum,
                SUM(ch.invested_value) as total_invested,
                COUNT(DISTINCT ch.user_id) as client_count,
                COUNT(DISTINCT ch.isin) as scheme_count
            FROM comprehensive_holdings ch
            INNER JOIN portfolios p ON p.user_id = ch.user_id
            INNER JOIN users u ON u.id = ch.user_id
            WHERE u.assigned_agent_id = $1
              AND ch.holding_date = (
                  SELECT MAX(h2.holding_date) FROM comprehensive_holdings h2 WHERE h2.user_id = ch.user_id
              )
            GROUP BY ch.amc_name, ch.asset_class
            ORDER BY total_aum DESC
            LIMIT 50
            """,
            target_agent,
        )

    if not rows:
        return {"agent_id": target_agent, "total_aum": 0, "amc_breakdown": []}

    df = pd.DataFrame([dict(r) for r in rows])
    df["total_aum"] = pd.to_numeric(df["total_aum"], errors="coerce").fillna(0)
    df["total_invested"] = pd.to_numeric(df["total_invested"], errors="coerce").fillna(0)

    total_aum = float(df["total_aum"].sum())

    amc_summary = (
        df.groupby("amc_name")
        .agg(
            aum=("total_aum", "sum"),
            invested=("total_invested", "sum"),
            clients=("client_count", "max"),
            schemes=("scheme_count", "sum"),
        )
        .reset_index()
        .sort_values("aum", ascending=False)
        .assign(
            weight_pct=lambda x: (x["aum"] / total_aum * 100).round(2) if total_aum > 0 else 0,
            trail_estimate_monthly=lambda x: (
                x.apply(lambda r: r["aum"] * 0.008 / 12, axis=1)
            ).round(2),
        )
        .rename(columns={"amc_name": "amc"})
    )

    records = []
    for _, row in amc_summary.iterrows():
        rec = row.to_dict()
        for k, v in rec.items():
            if isinstance(v, (np.integer,)):
                rec[k] = int(v)
            elif isinstance(v, (np.floating,)) or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
                rec[k] = None if (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else float(v)
        records.append(rec)

    return {
        "agent_id": target_agent,
        "total_aum": round(total_aum, 2),
        "amc_breakdown": records,
    }


@router.post("/batch-metrics")
async def batch_financial_metrics(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Vectorized computation of 40+ financial ratios for a batch of stocks/instruments.
    Replaces the TypeScript FinancialMetricsCalculator in bulk mode.

    py-metrics-v1

    Input:
      instruments: [
        {
          id:                str,
          price:             float,
          eps:               float,    // EPS (trailing 12M)
          bookValue:         float,
          revenue:           float,
          netIncome:         float,
          ebitda:            float,
          totalDebt:         float,
          totalEquity:       float,
          cashAndEquivalents:float,
          operatingCashFlow: float,
          freeCashFlow:      float,
          dividendsPerShare: float,
          epsGrowth:         float,    // yoy %
          revenueGrowth:     float,
          sharesOutstanding: float,
          totalAssets:       float,
          currentAssets:     float,
          currentLiabilities:float,
          inventory:         float,
          grossProfit:       float,
          operatingIncome:   float,
          interestExpense:   float,
          beta:              float,
          weekHigh52:        float,
          weekLow52:         float,
        }
      ]

    Returns: [{id, ratios: {...40+ metrics}}]
    """
    try:
        instruments = payload.get("instruments", [])
        if not instruments:
            return {"error": "Provide instruments list"}

        df = pd.DataFrame(instruments)
        for col in df.columns:
            if col != "id":
                df[col] = pd.to_numeric(df[col], errors="coerce")

        def safe_div(num, denom, scale=1.0):
            result = np.where(denom.abs() > 1e-8, num / denom * scale, np.nan)
            return pd.Series(result, index=df.index)

        def col(name, default=np.nan):
            return df[name] if name in df.columns else pd.Series(default, index=df.index)

        price = col("price")
        eps = col("eps")
        bv = col("bookValue")
        rev = col("revenue")
        ni = col("netIncome")
        ebitda = col("ebitda")
        total_debt = col("totalDebt")
        equity = col("totalEquity")
        cash = col("cashAndEquivalents")
        ocf = col("operatingCashFlow")
        fcf = col("freeCashFlow")
        dps = col("dividendsPerShare")
        eps_growth = col("epsGrowth")
        rev_growth = col("revenueGrowth")
        shares = col("sharesOutstanding")
        total_assets = col("totalAssets")
        curr_assets = col("currentAssets")
        curr_liab = col("currentLiabilities")
        inventory = col("inventory")
        gross_profit = col("grossProfit")
        op_income = col("operatingIncome")
        interest = col("interestExpense")
        beta = col("beta")
        high52 = col("weekHigh52")
        low52 = col("weekLow52")

        mkt_cap = price * shares

        # Valuation
        pe = safe_div(price, eps)
        pb = safe_div(price, bv)
        ps = safe_div(mkt_cap, rev)
        peg = safe_div(pe, eps_growth * 100)
        ev = mkt_cap + total_debt - cash
        ev_ebitda = safe_div(ev, ebitda)
        ev_rev = safe_div(ev, rev)
        pcf = safe_div(price, ocf / shares.replace(0, np.nan))
        pfcf = safe_div(price, fcf / shares.replace(0, np.nan))
        dividend_yield = safe_div(dps, price, scale=100)
        graham_number = np.sqrt(np.maximum(22.5 * eps.abs() * bv.abs(), 0))

        # Profitability
        gross_margin = safe_div(gross_profit, rev, scale=100)
        operating_margin = safe_div(op_income, rev, scale=100)
        net_margin = safe_div(ni, rev, scale=100)
        roe = safe_div(ni, equity, scale=100)
        roa = safe_div(ni, total_assets, scale=100)
        roce = safe_div(op_income, (total_assets - curr_liab).replace(0, np.nan), scale=100)
        roic = safe_div(op_income * (1 - 0.25), (equity + total_debt).replace(0, np.nan), scale=100)
        ebitda_margin = safe_div(ebitda, rev, scale=100)

        # Leverage & Coverage
        debt_to_equity = safe_div(total_debt, equity)
        debt_to_ebitda = safe_div(total_debt, ebitda)
        interest_coverage = safe_div(ebitda, interest)
        net_debt = total_debt - cash
        net_debt_ebitda = safe_div(net_debt, ebitda)
        equity_multiplier = safe_div(total_assets, equity)

        # Liquidity
        current_ratio = safe_div(curr_assets, curr_liab)
        quick_ratio = safe_div((curr_assets - inventory), curr_liab)

        # Efficiency
        asset_turnover = safe_div(rev, total_assets)
        inventory_turnover = safe_div(rev, inventory)
        receivables_turnover = safe_div(rev, (curr_assets - inventory - cash).clip(1))

        # Cash Flow
        ocf_to_ni = safe_div(ocf, ni)
        fcf_yield = safe_div(fcf, mkt_cap, scale=100)
        fcf_margin = safe_div(fcf, rev, scale=100)

        # Growth
        peg_ratio = peg
        earnings_quality = safe_div(ocf, ni)

        # Momentum / Price
        dist_from_high52 = safe_div((price - high52), high52, scale=100)
        dist_from_low52 = safe_div((price - low52), low52, scale=100)
        price_range_pct = safe_div((price - low52), (high52 - low52), scale=100)

        results = []
        for i, row in df.iterrows():
            def _f(series):
                v = series.iloc[i] if hasattr(series, 'iloc') else float(series)
                return None if (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else round(float(v), 4)

            results.append({
                "id": row.get("id", str(i)),
                "ratios": {
                    # Valuation
                    "pe": _f(pe), "pb": _f(pb), "ps": _f(ps), "peg": _f(peg),
                    "evEbitda": _f(ev_ebitda), "evRevenue": _f(ev_rev),
                    "priceToCashFlow": _f(pcf), "priceToFreeCashFlow": _f(pfcf),
                    "dividendYield": _f(dividend_yield),
                    "grahamNumber": _f(graham_number),
                    "marketCap": _f(mkt_cap), "enterpriseValue": _f(ev),
                    # Profitability
                    "grossMargin": _f(gross_margin), "operatingMargin": _f(operating_margin),
                    "netMargin": _f(net_margin), "ebitdaMargin": _f(ebitda_margin),
                    "roe": _f(roe), "roa": _f(roa), "roce": _f(roce), "roic": _f(roic),
                    # Leverage
                    "debtToEquity": _f(debt_to_equity), "debtToEbitda": _f(debt_to_ebitda),
                    "interestCoverage": _f(interest_coverage),
                    "netDebtToEbitda": _f(net_debt_ebitda),
                    "equityMultiplier": _f(equity_multiplier),
                    "netDebt": _f(net_debt),
                    # Liquidity
                    "currentRatio": _f(current_ratio), "quickRatio": _f(quick_ratio),
                    # Efficiency
                    "assetTurnover": _f(asset_turnover),
                    "inventoryTurnover": _f(inventory_turnover),
                    "receivablesTurnover": _f(receivables_turnover),
                    # Cash Flow
                    "ocfToNetIncome": _f(ocf_to_ni), "fcfYield": _f(fcf_yield),
                    "fcfMargin": _f(fcf_margin),
                    # Growth
                    "revenueGrowth": _f(rev_growth), "epsGrowth": _f(eps_growth),
                    "earningsQuality": _f(earnings_quality),
                    # Price Action
                    "beta": _f(beta),
                    "pctFromHigh52": _f(dist_from_high52),
                    "pctFromLow52": _f(dist_from_low52),
                    "priceRangePct": _f(price_range_pct),
                },
            })

        return {
            "processed": len(results),
            "modelVersion": "py-metrics-v1",
            "results": results,
        }

    except Exception as e:
        return {"error": str(e)}
