"""
Point-to-Point Price Return Calculator
=======================================
Reads the `golden_prices` time-series table, computes returns for all
standard periods using Pandas, and writes results to `instrument_returns`.

Periods supported:
  1D · 1W · 1M · 3M · 6M · YTD · 1Y · 3Y(CAGR) · 5Y(CAGR)

Endpoints
---------
POST /api/price-returns/compute          → compute one ISIN (writes back)
POST /api/price-returns/batch            → compute many ISINs (writes back)
GET  /api/price-returns/{isin}           → read pre-computed returns
GET  /api/price-returns/{isin}/history   → full return history
POST /api/price-returns/daily-run        → compute all ISINs (background)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from auth import verify_token, TokenPayload
from database import db_conn, get_pool

logger = logging.getLogger("price_returns")

router = APIRouter(prefix="/api/price-returns", tags=["price-returns"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _simple_return(series: pd.Series, days: int) -> Optional[float]:
    """(P_now - P_past) / P_past for simple periods < 1 year."""
    if series.empty:
        return None
    latest_date = series.index[-1]
    target = latest_date - pd.Timedelta(days=days)
    past = series[series.index <= target]
    if past.empty:
        return None
    p_past = float(past.iloc[-1])
    p_now  = float(series.iloc[-1])
    if p_past <= 0:
        return None
    return round((p_now - p_past) / p_past, 8)


def _cagr(series: pd.Series, years: float) -> Optional[float]:
    """CAGR = (P_now / P_past) ^ (1/years) - 1  for periods ≥ 1 year."""
    if series.empty or years <= 0:
        return None
    latest_date = series.index[-1]
    target = latest_date - pd.Timedelta(days=int(years * 365.25))
    past = series[series.index <= target]
    if past.empty:
        return None
    p_past = float(past.iloc[-1])
    p_now  = float(series.iloc[-1])
    if p_past <= 0:
        return None
    return round((p_now / p_past) ** (1.0 / years) - 1, 8)


def _ytd_return(series: pd.Series) -> Optional[float]:
    today = series.index[-1] if not series.empty else pd.Timestamp.today()
    jan1 = pd.Timestamp(today.year, 1, 1)
    past = series[series.index <= jan1]
    if past.empty:
        return None
    p_past = float(past.iloc[-1])
    p_now  = float(series.iloc[-1])
    if p_past <= 0:
        return None
    return round((p_now - p_past) / p_past, 8)


def _price_n_days_ago(series: pd.Series, days: int) -> Optional[float]:
    if series.empty:
        return None
    target = series.index[-1] - pd.Timedelta(days=days)
    past = series[series.index <= target]
    return float(past.iloc[-1]) if not past.empty else None


def compute_returns(series: pd.Series) -> Dict[str, Any]:
    """Return dict of all period returns for a price series."""
    if series.empty:
        return {}

    cur = float(series.iloc[-1])
    p1d  = _price_n_days_ago(series, 1)
    p1w  = _price_n_days_ago(series, 7)
    p1m  = _price_n_days_ago(series, 30)
    p3m  = _price_n_days_ago(series, 91)
    p6m  = _price_n_days_ago(series, 182)
    p1y  = _price_n_days_ago(series, 365)

    return {
        "current_price":  cur,
        "return_1d":  round((cur - p1d) / p1d, 8) if p1d and p1d > 0 else None,
        "return_1w":  round((cur - p1w) / p1w, 8) if p1w and p1w > 0 else None,
        "return_1m":  _simple_return(series, 30),
        "return_3m":  _simple_return(series, 91),
        "return_6m":  _simple_return(series, 182),
        "return_ytd": _ytd_return(series),
        "return_1y":  _cagr(series, 1.0),
        "return_3y":  _cagr(series, 3.0),
        "return_5y":  _cagr(series, 5.0),
        "price_1d_ago": p1d,
        "price_1w_ago": p1w,
        "price_1m_ago": p1m,
        "price_3m_ago": p3m,
        "price_6m_ago": p6m,
        "price_1y_ago": p1y,
        "abs_change_1d": round(cur - p1d, 6) if p1d else None,
    }


async def resolve_isin(isin: Optional[str], symbol: Optional[str], conn) -> Optional[str]:
    """Return a valid ISIN, resolving from symbol via listed_stocks if needed."""
    if isin:
        return isin
    if not symbol:
        return None
    row = await conn.fetchrow(
        "SELECT isin FROM listed_stocks WHERE UPPER(symbol) = UPPER($1) LIMIT 1",
        symbol,
    )
    if row and row["isin"]:
        return row["isin"]
    # Fallback: query golden_prices by symbol
    row2 = await conn.fetchrow(
        "SELECT isin FROM golden_prices WHERE UPPER(symbol) = UPPER($1) LIMIT 1",
        symbol,
    )
    return row2["isin"] if row2 else None


async def load_price_series(isin: str, conn) -> pd.Series:
    """Fetch full golden_prices history for an ISIN → Pandas Series."""
    rows = await conn.fetch(
        """
        SELECT price_date, price::float AS price
        FROM golden_prices
        WHERE isin = $1 AND price > 0
        ORDER BY price_date ASC
        """,
        isin,
    )
    if not rows:
        return pd.Series(dtype=float)
    df = pd.DataFrame(rows, columns=["price_date", "price"])
    df["price_date"] = pd.to_datetime(df["price_date"])
    return df.set_index("price_date")["price"]


async def upsert_instrument_returns(isin: str, symbol: Optional[str],
                                     as_of_date: date, asset_class: str,
                                     ret: Dict[str, Any], conn) -> None:
    """Write computed returns to instrument_returns table."""
    await conn.execute(
        """
        INSERT INTO instrument_returns (
            isin, symbol, as_of_date, asset_class,
            current_price, return_1d, return_1w, return_1m, return_3m,
            return_6m, return_ytd, return_1y, return_3y, return_5y,
            price_1d_ago, price_1w_ago, price_1m_ago, price_3m_ago,
            price_6m_ago, price_1y_ago, abs_change_1d, computed_at
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            $15, $16, $17, $18,
            $19, $20, $21, NOW()
        )
        ON CONFLICT (isin, as_of_date) DO UPDATE SET
            symbol        = EXCLUDED.symbol,
            asset_class   = EXCLUDED.asset_class,
            current_price = EXCLUDED.current_price,
            return_1d     = EXCLUDED.return_1d,
            return_1w     = EXCLUDED.return_1w,
            return_1m     = EXCLUDED.return_1m,
            return_3m     = EXCLUDED.return_3m,
            return_6m     = EXCLUDED.return_6m,
            return_ytd    = EXCLUDED.return_ytd,
            return_1y     = EXCLUDED.return_1y,
            return_3y     = EXCLUDED.return_3y,
            return_5y     = EXCLUDED.return_5y,
            price_1d_ago  = EXCLUDED.price_1d_ago,
            price_1w_ago  = EXCLUDED.price_1w_ago,
            price_1m_ago  = EXCLUDED.price_1m_ago,
            price_3m_ago  = EXCLUDED.price_3m_ago,
            price_6m_ago  = EXCLUDED.price_6m_ago,
            price_1y_ago  = EXCLUDED.price_1y_ago,
            abs_change_1d = EXCLUDED.abs_change_1d,
            computed_at   = NOW()
        """,
        isin, symbol, as_of_date, asset_class,
        ret.get("current_price"), ret.get("return_1d"), ret.get("return_1w"),
        ret.get("return_1m"), ret.get("return_3m"), ret.get("return_6m"),
        ret.get("return_ytd"), ret.get("return_1y"), ret.get("return_3y"),
        ret.get("return_5y"),
        ret.get("price_1d_ago"), ret.get("price_1w_ago"), ret.get("price_1m_ago"),
        ret.get("price_3m_ago"), ret.get("price_6m_ago"), ret.get("price_1y_ago"),
        ret.get("abs_change_1d"),
    )


async def sync_to_listed_stocks(isin: str, ret: Dict[str, Any], conn) -> None:
    """Write-back 1M/6M/1Y to listed_stocks so existing code still works."""
    await conn.execute(
        """
        UPDATE listed_stocks SET
            returns_1m = $2,
            returns_6m = $3,
            returns_1y = $4
        WHERE isin = $1
        """,
        isin,
        ret.get("return_1m"),
        ret.get("return_6m"),
        ret.get("return_1y"),
    )


# ─── Request/Response models ──────────────────────────────────────────────────

class ComputeRequest(BaseModel):
    isin: Optional[str] = None       # preferred; falls back to symbol lookup
    symbol: Optional[str] = None     # NSE symbol — used when isin not supplied
    asset_class: str = "equity"
    write_back: bool = True          # also update listed_stocks
    as_of_date: Optional[str] = None # default: today


class BatchRequest(BaseModel):
    instruments: List[Dict[str, str]]  # [{isin, symbol?, asset_class?}]
    write_back: bool = True
    as_of_date: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/compute")
async def compute_single(
    body: ComputeRequest,
    _: TokenPayload = Depends(verify_token),
):
    """Compute all period returns for one ISIN from golden_prices history.
    Accepts either isin or symbol; resolves the other from listed_stocks/golden_prices."""
    as_of = date.fromisoformat(body.as_of_date) if body.as_of_date else date.today()

    async with db_conn() as conn:
        isin = await resolve_isin(body.isin, body.symbol, conn)
        if not isin:
            return {
                "isin": None,
                "symbol": body.symbol,
                "status": "isin_not_found",
                "returns": {},
            }

        series = await load_price_series(isin, conn)

        if series.empty:
            return {
                "isin": isin,
                "symbol": body.symbol,
                "status": "no_price_history",
                "returns": {},
            }

        ret = compute_returns(series)

        if body.write_back:
            await upsert_instrument_returns(
                isin, body.symbol, as_of, body.asset_class, ret, conn
            )
            if body.asset_class == "equity":
                await sync_to_listed_stocks(isin, ret, conn)

    # Format for display (multiply by 100 → percentage)
    formatted = {
        k: round(v * 100, 4) if v is not None and k.startswith("return_") else v
        for k, v in ret.items()
    }

    return {
        "isin": isin,
        "symbol": body.symbol,
        "as_of_date": as_of.isoformat(),
        "asset_class": body.asset_class,
        "status": "computed",
        "returns": formatted,
        "raw": ret,  # decimal fractions for programmatic use
    }


@router.post("/batch")
async def compute_batch(
    body: BatchRequest,
    _: TokenPayload = Depends(verify_token),
):
    """Compute returns for a list of instruments in one DB round-trip per ISIN."""
    as_of = date.fromisoformat(body.as_of_date) if body.as_of_date else date.today()
    results = {}
    failed = []

    pool = await get_pool()
    async with pool.acquire() as conn:
        for inst in body.instruments:
            isin = inst.get("isin", "")
            symbol = inst.get("symbol")
            asset_class = inst.get("asset_class", "equity")
            if not isin:
                continue
            try:
                series = await load_price_series(isin, conn)
                if series.empty:
                    results[isin] = {"status": "no_price_history"}
                    continue
                ret = compute_returns(series)
                if body.write_back:
                    await upsert_instrument_returns(isin, symbol, as_of, asset_class, ret, conn)
                    if asset_class == "equity":
                        await sync_to_listed_stocks(isin, ret, conn)
                results[isin] = {
                    "status": "computed",
                    "return_1d": ret.get("return_1d"),
                    "return_1m": ret.get("return_1m"),
                    "return_3m": ret.get("return_3m"),
                    "return_6m": ret.get("return_6m"),
                    "return_1y": ret.get("return_1y"),
                    "return_3y": ret.get("return_3y"),
                    "return_5y": ret.get("return_5y"),
                    "current_price": ret.get("current_price"),
                }
            except Exception as e:
                logger.error(f"Batch compute failed for {isin}: {e}")
                failed.append({"isin": isin, "error": str(e)})

    return {
        "as_of_date": as_of.isoformat(),
        "processed": len(results),
        "failed": len(failed),
        "results": results,
        "errors": failed,
    }


@router.get("/{isin}")
async def get_returns(
    isin: str,
    as_of_date: Optional[str] = Query(None),
    _: TokenPayload = Depends(verify_token),
):
    """Fetch pre-computed returns from instrument_returns table."""
    async with db_conn() as conn:
        if as_of_date:
            row = await conn.fetchrow(
                "SELECT * FROM instrument_returns WHERE isin = $1 AND as_of_date = $2",
                isin, date.fromisoformat(as_of_date),
            )
        else:
            row = await conn.fetchrow(
                "SELECT * FROM instrument_returns WHERE isin = $1 ORDER BY as_of_date DESC LIMIT 1",
                isin,
            )

    if not row:
        return {"isin": isin, "status": "not_found", "returns": None}

    return {
        "isin": isin,
        "as_of_date": str(row["as_of_date"]),
        "asset_class": row["asset_class"],
        "status": "found",
        "returns": {
            "current_price":  row["current_price"],
            "return_1d":  row["return_1d"],
            "return_1w":  row["return_1w"],
            "return_1m":  row["return_1m"],
            "return_3m":  row["return_3m"],
            "return_6m":  row["return_6m"],
            "return_ytd": row["return_ytd"],
            "return_1y":  row["return_1y"],
            "return_3y":  row["return_3y"],
            "return_5y":  row["return_5y"],
            "price_1d_ago": row["price_1d_ago"],
            "price_1m_ago": row["price_1m_ago"],
            "price_6m_ago": row["price_6m_ago"],
            "price_1y_ago": row["price_1y_ago"],
            "abs_change_1d": row["abs_change_1d"],
        },
        "computed_at": str(row["computed_at"]),
    }


@router.get("/{isin}/history")
async def get_return_history(
    isin: str,
    limit: int = Query(90, le=365),
    _: TokenPayload = Depends(verify_token),
):
    """Return full computed-return history for an ISIN."""
    async with db_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT as_of_date, return_1d, return_1m, return_3m, return_6m,
                   return_1y, return_3y, current_price, abs_change_1d, computed_at
            FROM instrument_returns WHERE isin = $1
            ORDER BY as_of_date DESC LIMIT $2
            """,
            isin, limit,
        )
    return {
        "isin": isin,
        "count": len(rows),
        "history": [dict(r) for r in rows],
    }


@router.post("/daily-run")
async def daily_returns_run(
    _: TokenPayload = Depends(verify_token),
):
    """
    Compute returns for ALL ISINs that have golden_prices entries.
    Called automatically after the daily golden pricing run.
    Runs async in the background — returns immediately.
    """
    async def _run():
        pool = await get_pool()
        today = date.today()
        processed = succeeded = failed = 0

        async with pool.acquire() as conn:
            isins = await conn.fetch(
                """
                SELECT DISTINCT gp.isin, gp.symbol, gp.asset_class
                FROM golden_prices gp
                WHERE gp.price_date >= CURRENT_DATE - INTERVAL '30 days'
                """
            )

            for row in isins:
                isin = row["isin"]
                symbol = row["symbol"]
                asset_class = row["asset_class"] or "equity"
                processed += 1
                try:
                    series = await load_price_series(isin, conn)
                    if series.empty:
                        continue
                    ret = compute_returns(series)
                    await upsert_instrument_returns(isin, symbol, today, asset_class, ret, conn)
                    if asset_class == "equity":
                        await sync_to_listed_stocks(isin, ret, conn)
                    succeeded += 1
                except Exception as e:
                    logger.error(f"Daily returns run error for {isin}: {e}")
                    failed += 1

        logger.info(f"[PriceReturns] Daily run complete: {succeeded}/{processed} succeeded, {failed} failed")

    asyncio.create_task(_run())
    return {"status": "started", "message": "Daily returns computation running in background"}
