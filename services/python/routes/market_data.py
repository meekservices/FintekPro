"""
FintekPro Python Market Data Routes — powered by yfinance

Endpoints:
  POST /market/quotes          — batch price quotes for global stocks & ETFs
  POST /market/fundamentals    — Indian/global stock fundamentals (Screener.in fallback)
  GET  /market/movers/indian   — NIFTY50 top gainers & losers
  GET  /market/health          — provider health check
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import TokenPayload, verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market-data"])

_executor = ThreadPoolExecutor(max_workers=6)

NIFTY50_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "NESTLEIND.NS",
    "WIPRO.NS", "ULTRACEMCO.NS", "HCLTECH.NS", "POWERGRID.NS", "NTPC.NS",
    "TITAN.NS", "SUNPHARMA.NS", "ONGC.NS", "GRASIM.NS", "JSWSTEEL.NS",
    "TATAMOTORS.NS", "INDUSINDBK.NS", "TECHM.NS", "CIPLA.NS", "ADANIENT.NS",
    "ADANIPORTS.NS", "COALINDIA.NS", "DIVISLAB.NS", "DRREDDY.NS", "EICHERMOT.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "M&M.NS", "NESTLEIND.NS", "SHREECEM.NS",
    "TATACONSUM.NS", "TATASTEEL.NS", "UPL.NS", "VEDL.NS", "BAJAJFINSV.NS",
    "BPCL.NS", "BRITANNIA.NS", "DABUR.NS", "GODREJCP.NS", "PIDILITIND.NS",
]


class QuotesRequest(BaseModel):
    symbols: List[str]


class FundamentalsRequest(BaseModel):
    symbol: str


def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def _fetch_quotes_sync(symbols: List[str]) -> dict:
    """Batch fetch live price quotes via yfinance fast_info."""
    try:
        import yfinance as yf
    except ImportError:
        logger.error("[yfinance] yfinance not installed")
        return {}

    results = {}
    if not symbols:
        return results

    try:
        joined = " ".join(symbols)
        tickers = yf.Tickers(joined)
        for sym in symbols:
            try:
                t = tickers.tickers.get(sym)
                if not t:
                    continue
                fi = t.fast_info
                price = _safe_float(getattr(fi, "last_price", None))
                prev_close = _safe_float(getattr(fi, "previous_close", None))
                change = round(price - prev_close, 4) if price is not None and prev_close is not None else None
                change_pct = round((change / prev_close) * 100, 4) if change is not None and prev_close else None
                results[sym] = {
                    "symbol": sym,
                    "price": price,
                    "previousClose": prev_close,
                    "change": change,
                    "changePercent": change_pct,
                    "dayHigh": _safe_float(getattr(fi, "day_high", None)),
                    "dayLow": _safe_float(getattr(fi, "day_low", None)),
                    "volume": _safe_float(getattr(fi, "three_month_average_volume", None)),
                    "marketCap": _safe_float(getattr(fi, "market_cap", None)),
                    "currency": getattr(fi, "currency", None),
                    "exchange": getattr(fi, "exchange", None),
                    "source": "yfinance",
                }
            except Exception as e:
                logger.debug(f"[yfinance] Quote skip {sym}: {e}")
    except Exception as e:
        logger.error(f"[yfinance] Batch quotes error: {e}")

    return results


def _fetch_fundamentals_sync(symbol: str) -> dict:
    """Fetch full fundamentals for an Indian/global stock via yfinance .info."""
    try:
        import yfinance as yf
    except ImportError:
        return {"error": "yfinance not installed", "source": "yfinance"}

    ns_symbol = symbol
    if not (symbol.endswith(".NS") or symbol.endswith(".BO") or
            "." in symbol.split("/")[-1]):
        ns_symbol = f"{symbol}.NS"

    try:
        t = yf.Ticker(ns_symbol)
        info = t.info

        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            if ns_symbol.endswith(".NS"):
                ns_symbol = symbol.replace(".NS", ".BO")
                t = yf.Ticker(ns_symbol)
                info = t.info

        def to_crore(v):
            return round(v / 1e7, 2) if v else None

        revenue_raw = info.get("totalRevenue")
        net_income_raw = info.get("netIncomeToCommon")
        fcf_raw = info.get("freeCashflow")
        cfo_raw = info.get("operatingCashflow")

        roe_raw = _safe_float(info.get("returnOnEquity"))
        de_raw = _safe_float(info.get("debtToEquity"))

        return {
            "roe": roe_raw,
            "roce": None,
            "pe": _safe_float(info.get("trailingPE")) or _safe_float(info.get("forwardPE")),
            "pb": _safe_float(info.get("priceToBook")),
            "dividendYield": _safe_float(info.get("dividendYield")),
            "debtToEquity": round(de_raw / 100, 4) if de_raw is not None else None,
            "revenue": to_crore(revenue_raw),
            "netIncome": to_crore(net_income_raw),
            "operatingMargin": _safe_float(info.get("operatingMargins")),
            "freeCashFlow": to_crore(fcf_raw),
            "operatingCashFlow": to_crore(cfo_raw),
            "bookValue": _safe_float(info.get("bookValue")),
            "earningsGrowth": _safe_float(info.get("earningsGrowth")),
            "revenueGrowth": _safe_float(info.get("revenueGrowth")),
            "beta": _safe_float(info.get("beta")),
            "eps": _safe_float(info.get("trailingEps")),
            "price": _safe_float(info.get("currentPrice")) or _safe_float(info.get("regularMarketPrice")),
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "symbol": ns_symbol,
            "source": "yfinance",
        }
    except Exception as e:
        logger.warning(f"[yfinance] Fundamentals error for {ns_symbol}: {e}")
        return {"error": str(e), "source": "yfinance"}


def _fetch_movers_sync() -> dict:
    """Fetch NIFTY50 gainers/losers using yfinance batch download."""
    try:
        import yfinance as yf
        import pandas as pd
    except ImportError:
        return {"gainers": [], "losers": [], "source": "yfinance", "error": "yfinance not installed"}

    stocks = []
    try:
        symbols = list(dict.fromkeys(NIFTY50_SYMBOLS))
        data = yf.download(
            symbols,
            period="2d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
            timeout=30,
        )

        for sym in symbols:
            try:
                if isinstance(data.columns, pd.MultiIndex):
                    if sym not in data.columns.get_level_values(0):
                        continue
                    sym_data = data[sym]
                else:
                    sym_data = data

                closes = sym_data["Close"].dropna()
                if len(closes) < 2:
                    continue

                today_close = float(closes.iloc[-1])
                prev_close = float(closes.iloc[-2])

                if today_close <= 0 or prev_close <= 0:
                    continue

                change = today_close - prev_close
                change_pct = (change / prev_close) * 100
                display_sym = sym.replace(".NS", "").replace(".BO", "")

                stocks.append({
                    "symbol": display_sym,
                    "name": display_sym,
                    "price": round(today_close, 2),
                    "change": round(change, 2),
                    "changePercent": round(change_pct, 4),
                    "previousClose": round(prev_close, 2),
                })
            except Exception:
                pass

    except Exception as e:
        logger.error(f"[yfinance] Market movers download error: {e}")

    stocks.sort(key=lambda x: x["changePercent"], reverse=True)
    gainers = [s for s in stocks if s["changePercent"] > 0][:5]
    losers = sorted([s for s in stocks if s["changePercent"] < 0], key=lambda x: x["changePercent"])[:5]

    return {
        "gainers": gainers,
        "losers": losers,
        "total": len(stocks),
        "source": "yfinance",
    }


@router.post("/quotes")
async def batch_quotes(
    payload: QuotesRequest,
    _: TokenPayload = Depends(verify_token),
):
    """Batch price quotes for global stocks and ETFs via yfinance."""
    symbols = payload.symbols
    if not symbols:
        raise HTTPException(status_code=400, detail="symbols list required")
    if len(symbols) > 150:
        raise HTTPException(status_code=400, detail="Max 150 symbols per request")

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(_executor, _fetch_quotes_sync, symbols)
    return {"results": results, "count": len(results), "source": "yfinance"}


@router.post("/fundamentals")
async def stock_fundamentals(
    payload: FundamentalsRequest,
    _: TokenPayload = Depends(verify_token),
):
    """Fetch Indian stock fundamentals via yfinance (Screener.in fallback)."""
    symbol = payload.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol required")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_fundamentals_sync, symbol)
    return result


@router.get("/movers/indian")
async def indian_market_movers(_: TokenPayload = Depends(verify_token)):
    """NIFTY50 top gainers and losers via yfinance batch download."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_movers_sync)
    return result


@router.get("/health")
async def market_data_health():
    """Check yfinance availability."""
    try:
        import yfinance as yf
        version = getattr(yf, "__version__", "unknown")
        return {"status": "ok", "provider": "yfinance", "version": version}
    except ImportError:
        return {"status": "unavailable", "error": "yfinance not installed"}
