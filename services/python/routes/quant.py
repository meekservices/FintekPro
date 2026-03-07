from fastapi import APIRouter, Depends, Body
from auth import verify_token, TokenPayload
from database import db_conn
import pandas as pd
import numpy as np
from scipy.optimize import brentq
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/api/quant", tags=["quant"])


def xirr(cashflows: List[tuple]) -> float:
    """
    Calculate XIRR given a list of (date, amount) tuples.
    Negative amounts = investments, positive amounts = redemptions/current value.
    """
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


@router.post("/xirr")
async def calculate_xirr(
    cashflows: List[dict] = Body(..., description='[{"date": "YYYY-MM-DD", "amount": -10000}, ...]'),
    token: TokenPayload = Depends(verify_token),
):
    try:
        parsed = [(pd.Timestamp(cf["date"]).to_pydatetime().date(), float(cf["amount"])) for cf in cashflows]
        rate = xirr(parsed)
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

    rate = xirr(cashflows)
    return {
        "user_id": target_id,
        "xirr_pct": rate,
        "cashflow_count": len(cashflows),
        "current_value": float(current["total_current"]) if current and current["total_current"] else 0,
    }


@router.get("/rolling-returns")
async def rolling_returns(
    isin: str,
    periods: str = "1Y,3Y,5Y",
    token: TokenPayload = Depends(verify_token),
):
    async with db_conn() as conn:
        navs = await conn.fetch(
            """
            SELECT nav_date, nav
            FROM mutual_fund_nav_history
            WHERE isin = $1
            ORDER BY nav_date DESC
            LIMIT 2000
            """,
            isin,
        )

    if not navs or len(navs) < 30:
        return {"isin": isin, "error": "Insufficient NAV history"}

    df = pd.DataFrame([dict(r) for r in navs])
    df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
    df["nav_date"] = pd.to_datetime(df["nav_date"])
    df = df.dropna().sort_values("nav_date").set_index("nav_date")

    latest_nav = float(df["nav"].iloc[-1])
    latest_date = df.index[-1]
    results = {}

    for period in periods.split(","):
        period = period.strip()
        years_map = {"1Y": 1, "3Y": 3, "5Y": 5, "10Y": 10}
        years = years_map.get(period.upper())
        if not years:
            continue
        target_date = latest_date - pd.DateOffset(years=years)
        past = df[df.index <= target_date]
        if past.empty:
            results[period] = None
            continue
        past_nav = float(past["nav"].iloc[-1])
        cagr = ((latest_nav / past_nav) ** (1 / years) - 1) * 100
        results[period] = round(cagr, 2)

    return {"isin": isin, "latest_nav": latest_nav, "returns": results}
