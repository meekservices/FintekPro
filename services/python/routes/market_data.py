"""
FintekPro Python Market Data Routes — powered by yfinance

Endpoints:
  POST /market/quotes          — batch price quotes for global stocks & ETFs
  POST /market/fundamentals    — Indian/global stock fundamentals + derived ratios + historical tables
  GET  /market/movers/indian   — NIFTY50 top gainers & losers
  GET  /market/health          — provider health check

Ratios derivable from yfinance (reducing Screener.in load):
  Point-in-time : ROE, ROCE, P/E, P/B, D/E, Div Yield, Book Value,
                  Operating Margin, Revenue, Net Income, OCF, FCF,
                  Revenue Growth, Earnings Growth, EPS, Beta
  Historical    : P&L history (4yr), Balance Sheet history (4yr),
                  Cash Flow history (4yr), Quarterly history (4 qtrs)
  Derived ratios: Debtor Days, Inventory Days, Days Payable, CCC,
                  Working Capital Days, ROCE %
  CAGR          : Sales CAGR 3Y, Profit CAGR 3Y
  Description   : Company description (longBusinessSummary)

NOT derivable through Python (only Screener.in has):
  - Pros / Cons (Screener's machine-generated analysis)
  - Sales / Profit CAGR 5Y (yfinance has max 4 years)
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


# ─── helpers ──────────────────────────────────────────────────────────────────

def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return f if f == f else None  # NaN guard
    except (TypeError, ValueError):
        return None


def _to_crore(v) -> Optional[float]:
    """Convert raw INR value (as reported by yfinance) to ₹ Crores."""
    if v is None:
        return None
    try:
        f = float(v)
        if f != f:
            return None
        return round(f / 1e7, 2)
    except (TypeError, ValueError):
        return None


def _fmt_date(ts) -> str:
    """Format a pandas Timestamp as 'Mar 2024'."""
    try:
        return ts.strftime("%b %Y")
    except Exception:
        return str(ts)[:7]


def _df_val(df, row_names, col):
    """
    Safely read a cell from a yfinance DataFrame.
    row_names can be a list of candidate names (tries each in order).
    Returns float or None.
    """
    if df is None or df.empty:
        return None
    names = [row_names] if isinstance(row_names, str) else row_names
    for name in names:
        if name in df.index:
            try:
                import pandas as pd
                v = df.loc[name, col]
                if pd.isna(v):
                    return None
                return float(v)
            except Exception:
                continue
    return None


def _build_history(df, mappings, in_crore=True, max_cols=6, pct_scale=False):
    """
    Build a HistoricalTable dict from a yfinance DataFrame.

    df       : yfinance financials/balance_sheet/cashflow (cols=dates, rows=items)
    mappings : list of (screener_label, yf_row_name_or_list, optional_transform)
               transform(raw_float) → display_value
    in_crore : divide raw values by 1e7 when True
    max_cols : keep last N fiscal periods
    pct_scale: if True, multiply by 100 (for percentage rows already in decimal)
    """
    if df is None or df.empty:
        return None
    try:
        import pandas as pd
        import numpy as np

        cols = sorted(df.columns)  # chronological (oldest → newest)
        if len(cols) > max_cols:
            cols = cols[-max_cols:]

        headers = [_fmt_date(c) for c in cols]
        rows = []

        for item in mappings:
            transform = None
            if len(item) == 3:
                label, yf_name, transform = item
            else:
                label, yf_name = item

            names = [yf_name] if isinstance(yf_name, str) else yf_name
            found = None
            for name in names:
                if name in df.index:
                    found = name
                    break

            vals = []
            for c in cols:
                raw = _df_val(df, names, c)
                if raw is None:
                    vals.append(None)
                elif transform:
                    try:
                        vals.append(transform(raw))
                    except Exception:
                        vals.append(None)
                elif in_crore:
                    vals.append(_to_crore(raw))
                else:
                    vals.append(round(raw * 100, 2) if pct_scale else round(raw, 4))
            rows.append({"label": label, "values": vals})

        non_null_rows = [r for r in rows if any(v is not None for v in r["values"])]
        if not non_null_rows:
            return None
        return {"headers": headers, "rows": rows}
    except Exception as e:
        logger.warning(f"[yfinance] _build_history error: {e}")
        return None


def _cagr(values: list, years: int) -> Optional[float]:
    """Compute CAGR from a list of values (oldest→newest). Returns decimal fraction."""
    if len(values) < years + 1:
        return None
    end = values[-1]
    start = values[-(years + 1)]
    if end is None or start is None or start <= 0:
        return None
    return round((end / start) ** (1 / years) - 1, 4)


# ─── core fundamentals fetch ──────────────────────────────────────────────────

def _fetch_fundamentals_sync(symbol: str) -> dict:
    """
    Fetch full fundamentals for an Indian/global stock via yfinance.
    Returns point-in-time ratios + historical tables + derived ratios.
    All values that were previously only available from Screener.in are now
    derived here, reducing external scrape calls to Screener for pros/cons only.
    """
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
        info = t.info or {}

        # Try .BO if .NS info is empty
        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            if ns_symbol.endswith(".NS"):
                bo_sym = ns_symbol.replace(".NS", ".BO")
                t_bo = yf.Ticker(bo_sym)
                bo_info = t_bo.info or {}
                if bo_info.get("currentPrice") or bo_info.get("regularMarketPrice"):
                    ns_symbol = bo_sym
                    t = t_bo
                    info = bo_info

        roe_raw = _safe_float(info.get("returnOnEquity"))
        de_raw = _safe_float(info.get("debtToEquity"))
        revenue_raw = info.get("totalRevenue")
        net_income_raw = info.get("netIncomeToCommon")
        fcf_raw = info.get("freeCashflow")
        cfo_raw = info.get("operatingCashflow")

        # ── Point-in-time fundamentals ────────────────────────────────────────
        base = {
            "roe": roe_raw,
            "roce": None,           # computed below from financial statements
            "pe": _safe_float(info.get("trailingPE")) or _safe_float(info.get("forwardPE")),
            "pb": _safe_float(info.get("priceToBook")),
            "dividendYield": _safe_float(info.get("dividendYield")),
            "debtToEquity": round(de_raw / 100, 4) if de_raw is not None else None,
            "revenue": _to_crore(revenue_raw),
            "netIncome": _to_crore(net_income_raw),
            "operatingMargin": _safe_float(info.get("operatingMargins")),
            "freeCashFlow": _to_crore(fcf_raw),
            "operatingCashFlow": _to_crore(cfo_raw),
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
            # History tables — populated below
            "plHistory": None,
            "bsHistory": None,
            "cfHistory": None,
            "ratiosHistory": None,
            "quarterlyHistory": None,
            "companyDescription": None,
            "salesCagr3Y": None,
            "salesCagr5Y": None,    # yfinance gives max 4 years; computed if data available
            "profitCagr3Y": None,
            "profitCagr5Y": None,
        }

        # ── Company description ───────────────────────────────────────────────
        desc = info.get("longBusinessSummary")
        if desc and isinstance(desc, str) and len(desc) > 20:
            base["companyDescription"] = desc[:1200]  # cap at 1200 chars

        # ── Fetch annual statements ───────────────────────────────────────────
        try:
            fin = t.financials          # Annual P&L (cols=dates, rows=items)
        except Exception:
            fin = None
        try:
            bs = t.balance_sheet
        except Exception:
            bs = None
        try:
            cf = t.cashflow
        except Exception:
            cf = None
        try:
            qfin = t.quarterly_financials
        except Exception:
            qfin = None
        try:
            qbs = t.quarterly_balance_sheet
        except Exception:
            qbs = None

        # ── P&L History ───────────────────────────────────────────────────────
        if fin is not None and not fin.empty:
            def opm_pct(raw):
                return None  # placeholder; computed per-column below

            # OPM % needs Revenue and Operating Income together — build specially
            pl_rows = []
            fin_cols = sorted(fin.columns)[-6:]  # last 6 years max
            headers = [_fmt_date(c) for c in fin_cols]

            label_map = [
                ("Sales",           ["Total Revenue"]),
                ("Operating Profit",["Operating Income", "EBIT"]),
                ("Other Income",    ["Other Non Operating Income", "Non Operating Income Other"]),
                ("Interest",        ["Interest Expense", "Net Interest Income"]),
                ("Depreciation",    ["Reconciled Depreciation", "Depreciation And Amortization"]),
                ("Net Profit",      ["Net Income", "Net Income Common Stockholders"]),
                ("EPS in Rs",       ["Basic EPS", "Diluted EPS"]),
            ]

            for label, names in label_map:
                vals = []
                for c in fin_cols:
                    raw = _df_val(fin, names, c)
                    if raw is None:
                        vals.append(None)
                    elif label == "EPS in Rs":
                        vals.append(round(float(raw), 2))          # already in ₹ per share
                    elif label == "Interest":
                        vals.append(_to_crore(abs(raw)))            # interest expense can be negative
                    else:
                        vals.append(_to_crore(raw))
                pl_rows.append({"label": label, "values": vals})

            # OPM % = Operating Income / Revenue (as %)
            opm_vals = []
            for c in fin_cols:
                rev = _df_val(fin, ["Total Revenue"], c)
                op  = _df_val(fin, ["Operating Income", "EBIT"], c)
                if rev and op and rev > 0:
                    opm_vals.append(round(op / rev * 100, 2))
                else:
                    opm_vals.append(None)
            # Insert OPM % after Operating Profit
            op_idx = next((i for i, r in enumerate(pl_rows) if r["label"] == "Operating Profit"), None)
            if op_idx is not None:
                pl_rows.insert(op_idx + 1, {"label": "OPM %", "values": opm_vals})

            if any(any(v is not None for v in r["values"]) for r in pl_rows):
                base["plHistory"] = {"headers": headers, "rows": pl_rows}

            # ── CAGR from P&L ─────────────────────────────────────────────────
            rev_series = [_to_crore(_df_val(fin, ["Total Revenue"], c)) for c in fin_cols]
            pat_series = [_to_crore(_df_val(fin, ["Net Income", "Net Income Common Stockholders"], c)) for c in fin_cols]

            base["salesCagr3Y"]  = _cagr(rev_series, 3)
            base["salesCagr5Y"]  = _cagr(rev_series, 5)
            base["profitCagr3Y"] = _cagr(pat_series, 3)
            base["profitCagr5Y"] = _cagr(pat_series, 5)

        # ── Balance Sheet History ─────────────────────────────────────────────
        if bs is not None and not bs.empty:
            bs_cols = sorted(bs.columns)[-6:]
            bs_headers = [_fmt_date(c) for c in bs_cols]
            bs_rows = []

            bs_map = [
                ("Equity Capital",  ["Common Stock", "Share Capital"]),
                ("Reserves",        ["Retained Earnings", "Additional Paid In Capital"]),
                ("Borrowings",      ["Long Term Debt", "Short Long Term Debt"]),
                ("Fixed Assets",    ["Net PPE", "Property Plant Equipment Net"]),
                ("Total Assets",    ["Total Assets"]),
            ]

            for label, names in bs_map:
                vals = []
                for c in bs_cols:
                    raw = _df_val(bs, names, c)
                    vals.append(_to_crore(raw) if raw is not None else None)
                bs_rows.append({"label": label, "values": vals})

            if any(any(v is not None for v in r["values"]) for r in bs_rows):
                base["bsHistory"] = {"headers": bs_headers, "rows": bs_rows}

            # ── ROCE from most-recent year ────────────────────────────────────
            if fin is not None and not fin.empty and bs_cols:
                latest_bs = bs_cols[-1]
                # Match P&L col nearest to BS date
                fin_cols_all = sorted(fin.columns)
                latest_fin = fin_cols_all[-1] if fin_cols_all else None

                if latest_fin is not None:
                    ebit = _df_val(fin, ["Operating Income", "EBIT"], latest_fin)
                    total_assets = _df_val(bs, ["Total Assets"], latest_bs)
                    curr_liab = _df_val(bs, ["Current Liabilities"], latest_bs)
                    if ebit and total_assets:
                        cap_employed = total_assets - (curr_liab or 0)
                        if cap_employed > 0:
                            base["roce"] = round(ebit / cap_employed, 4)  # decimal fraction

        # ── Cash Flow History ─────────────────────────────────────────────────
        if cf is not None and not cf.empty:
            cf_cols = sorted(cf.columns)[-6:]
            cf_headers = [_fmt_date(c) for c in cf_cols]
            cf_rows = []

            cf_map = [
                ("Cash from Operating",  ["Operating Cash Flow"]),
                ("Cash from Investing",  ["Investing Cash Flow"]),
                ("Cash from Financing",  ["Financing Cash Flow"]),
            ]

            row_series = {}
            for label, names in cf_map:
                vals = []
                for c in cf_cols:
                    raw = _df_val(cf, names, c)
                    vals.append(_to_crore(raw) if raw is not None else None)
                cf_rows.append({"label": label, "values": vals})
                row_series[label] = vals

            # Net Cash Flow = sum of the three
            net_vals = []
            for i in range(len(cf_cols)):
                parts = [
                    row_series.get("Cash from Operating", [None]*len(cf_cols))[i],
                    row_series.get("Cash from Investing",  [None]*len(cf_cols))[i],
                    row_series.get("Cash from Financing",  [None]*len(cf_cols))[i],
                ]
                net = sum(p for p in parts if p is not None) if any(p is not None for p in parts) else None
                net_vals.append(round(net, 2) if net is not None else None)
            cf_rows.append({"label": "Net Cash Flow", "values": net_vals})

            if any(any(v is not None for v in r["values"]) for r in cf_rows):
                base["cfHistory"] = {"headers": cf_headers, "rows": cf_rows}

        # ── Quarterly History ─────────────────────────────────────────────────
        if qfin is not None and not qfin.empty:
            q_cols = sorted(qfin.columns)[-5:]    # last 5 quarters
            q_headers = [_fmt_date(c) for c in q_cols]
            q_rows = []

            q_map = [
                ("Sales",            ["Total Revenue"]),
                ("Operating Profit", ["Operating Income", "EBIT"]),
                ("Net Profit",       ["Net Income", "Net Income Common Stockholders"]),
                ("EPS in Rs",        ["Basic EPS", "Diluted EPS"]),
            ]

            for label, names in q_map:
                vals = []
                for c in q_cols:
                    raw = _df_val(qfin, names, c)
                    if raw is None:
                        vals.append(None)
                    elif label == "EPS in Rs":
                        vals.append(round(float(raw), 2))
                    else:
                        vals.append(_to_crore(raw))
                q_rows.append({"label": label, "values": vals})

            # Quarterly OPM %
            q_opm = []
            for c in q_cols:
                rev = _df_val(qfin, ["Total Revenue"], c)
                op  = _df_val(qfin, ["Operating Income", "EBIT"], c)
                q_opm.append(round(op / rev * 100, 2) if rev and op and rev > 0 else None)
            op_i = next((i for i, r in enumerate(q_rows) if r["label"] == "Operating Profit"), None)
            if op_i is not None:
                q_rows.insert(op_i + 1, {"label": "OPM %", "values": q_opm})

            if any(any(v is not None for v in r["values"]) for r in q_rows):
                base["quarterlyHistory"] = {"headers": q_headers, "rows": q_rows}

        # ── Working Capital Ratios (ratiosHistory) ────────────────────────────
        # Derived from balance sheet + income statement
        if bs is not None and not bs.empty and fin is not None and not fin.empty:
            try:
                # Use the years that appear in BOTH statements
                common_years = sorted(set(bs.columns) & set(fin.columns))[-6:]
                if common_years:
                    r_headers = [_fmt_date(c) for c in common_years]
                    ratio_rows = []

                    def _ratio_row(label, values):
                        ratio_rows.append({"label": label, "values": values})

                    # Debtor Days = (Accounts Receivable / Revenue) * 365
                    deb_vals = []
                    inv_vals = []
                    pay_vals = []
                    ccc_vals = []
                    wc_vals  = []
                    roce_vals = []

                    for c in common_years:
                        rev  = _df_val(fin, ["Total Revenue"], c)
                        cogs_raw = None
                        gp = _df_val(fin, ["Gross Profit"], c)
                        if rev and gp:
                            cogs_raw = rev - gp
                        ar   = _df_val(bs, ["Accounts Receivable", "Net Receivables"], c)
                        inv  = _df_val(bs, ["Inventory"], c)
                        ap   = _df_val(bs, ["Accounts Payable"], c)
                        ca   = _df_val(bs, ["Current Assets"], c)
                        cl   = _df_val(bs, ["Current Liabilities"], c)
                        ta   = _df_val(bs, ["Total Assets"], c)
                        ebit = _df_val(fin, ["Operating Income", "EBIT"], c)

                        dd = round(ar / rev * 365, 1) if ar and rev and rev > 0 else None
                        id_ = round(inv / cogs_raw * 365, 1) if inv and cogs_raw and cogs_raw > 0 else None
                        dp  = round(ap / cogs_raw * 365, 1) if ap and cogs_raw and cogs_raw > 0 else None
                        ccc = round(dd + id_ - dp, 1) if dd is not None and id_ is not None and dp is not None else None
                        wc  = round(((ca or 0) - (cl or 0)) / rev * 365, 1) if ca and rev and rev > 0 else None
                        cap_emp = ta - (cl or 0) if ta else None
                        roce_yr = round(ebit / cap_emp * 100, 2) if ebit and cap_emp and cap_emp > 0 else None

                        deb_vals.append(dd)
                        inv_vals.append(id_)
                        pay_vals.append(dp)
                        ccc_vals.append(ccc)
                        wc_vals.append(wc)
                        roce_vals.append(roce_yr)

                    _ratio_row("Debtor Days", deb_vals)
                    _ratio_row("Inventory Days", inv_vals)
                    _ratio_row("Days Payable", pay_vals)
                    _ratio_row("Cash Conversion Cycle", ccc_vals)
                    _ratio_row("Working Capital Days", wc_vals)
                    _ratio_row("ROCE %", roce_vals)

                    if any(any(v is not None for v in r["values"]) for r in ratio_rows):
                        base["ratiosHistory"] = {"headers": r_headers, "rows": ratio_rows}
            except Exception as e:
                logger.debug(f"[yfinance] ratiosHistory error: {e}")

        return base

    except Exception as e:
        logger.warning(f"[yfinance] Fundamentals error for {ns_symbol}: {e}")
        return {"error": str(e), "source": "yfinance"}


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


# ─── routes ───────────────────────────────────────────────────────────────────

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
    """
    Fetch Indian stock fundamentals via yfinance.
    Returns point-in-time ratios + 4-year historical tables + derived working-capital ratios.
    This reduces dependency on Screener.in to pros/cons analysis only.
    """
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
