#!/usr/bin/env python3
"""
FintekPro — Screener.in DB Enrichment Script
=============================================
Fetches financial ratios for all NSE stocks from Screener.in and
populates screener_financials table with:
  roe, roce, dividend_yield, book_value, revenue_growth, earnings_growth,
  debt_to_equity, revenue, net_income, total_debt, total_equity

Also computes Beta from NSE historical price data vs NIFTY 50.

Usage:
  python3 scripts/enrich_screener.py
  python3 scripts/enrich_screener.py --symbol RELIANCE   # single stock test
  python3 scripts/enrich_screener.py --limit 100          # first 100 only
  python3 scripts/enrich_screener.py --resume              # skip already enriched

Requirements: pip3 install requests psycopg2-binary python-dotenv
"""

import os
import re
import sys
import time
import random
import logging
import argparse
import traceback
from datetime import datetime, timedelta

import requests
import psycopg2
from psycopg2.extras import execute_values

# ─── Setup ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scripts/enrich_errors.log"),
    ]
)
log = logging.getLogger(__name__)

SCREENER_SEARCH = "https://www.screener.in/api/company/search/?q={symbol}"
SCREENER_BASE   = "https://www.screener.in"
NSE_HISTORY_URL = "https://www.nseindia.com/api/historical/cm/equity"
NSE_INDEX_URL   = "https://www.nseindia.com/api/historical/indicesHistory"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/json,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)

# ─── HTML Parsing Helpers ─────────────────────────────────────────────────────

def parse_num(text: str):
    clean = text.replace(",", "").strip()
    try:
        return float(clean)
    except ValueError:
        return None

def extract_top_metrics(html: str):
    """Parse the id='top' section for ROE, ROCE, Dividend Yield, Book Value."""
    top_start = html.find('id="top"')
    top_end   = html.find("</section>", top_start)
    if top_start < 0:
        return {}
    top_html = html[top_start: top_end if top_end > 0 else top_start + 8000]

    li_items = re.findall(r'<li[^>]*>(.*?)</li>', top_html, re.DOTALL)
    metrics = {}
    for li in li_items:
        text = re.sub(r'<[^>]+>', ' ', li).replace('&nbsp;', ' ').replace('&amp;', '&').strip()
        text = re.sub(r'\s+', ' ', text)
        lower = text.lower()

        num_match = re.search(r'([\d,\.]+)\s*%?\s*$', text)
        if not num_match:
            continue
        val = parse_num(num_match.group(1))

        if re.search(r'\broe\b', lower) and 'roe' not in metrics:
            if val is not None:
                metrics['roe'] = val / 100.0
        elif re.search(r'\broce\b', lower) and 'roce' not in metrics:
            if val is not None:
                metrics['roce'] = val / 100.0
        elif 'dividend yield' in lower and 'dividend_yield' not in metrics:
            if val is not None:
                metrics['dividend_yield'] = val / 100.0
        elif 'book value' in lower and 'book_value' not in metrics:
            bv_match = re.search(r'₹\s*([\d,\.]+)', text)
            bv = parse_num(bv_match.group(1)) if bv_match else val
            metrics['book_value'] = bv

    return metrics

def extract_table_column(html: str, section_id: str, row_label: str, col_index=-1):
    """
    Extract values from a data table section.
    Returns (second_to_last, last) values for the matching row.
    """
    sec_start = html.find(f'id="{section_id}"')
    if sec_start < 0:
        return None, None
    sec_end = html.find("</section>", sec_start)
    section = html[sec_start: sec_end if sec_end > 0 else sec_start + 40000]

    rows = re.split(r'<tr[^>]*>', section)
    for row in rows:
        name_match = re.search(r'class="text"[^>]*>(.*?)</td>', row, re.DOTALL)
        if not name_match:
            continue
        name = re.sub(r'<[^>]+>', '', name_match.group(1)).replace('&nbsp;', ' ').replace('+', '').strip()
        if row_label.lower() not in name.lower():
            continue
        cells = re.findall(r'<td[^>]*>\s*([\d,\.]+)\s*</td>', row)
        nums = [parse_num(c) for c in cells]
        if len(nums) >= 2:
            return nums[-2], nums[-1]
    return None, None

def scrape_screener(symbol: str):
    """Fetch and parse all financial ratios for a symbol from Screener.in."""
    result = {}

    # Step 1: Get company URL
    try:
        r = session.get(SCREENER_SEARCH.format(symbol=symbol), timeout=10)
        r.raise_for_status()
        companies = r.json()
    except Exception as e:
        log.warning(f"  Search failed for {symbol}: {e}")
        return None

    if not companies:
        log.info(f"  {symbol}: not found on Screener.in")
        return None

    # Prefer consolidated view
    company = next((c for c in companies if 'consolidated' in c.get('url', '')), companies[0])
    url = SCREENER_BASE + company['url']

    # Step 2: Fetch company page
    try:
        time.sleep(random.uniform(0.8, 1.5))
        r = session.get(url, timeout=15, headers={"Referer": SCREENER_BASE})
        r.raise_for_status()
        html = r.text
    except Exception as e:
        log.warning(f"  Page fetch failed for {symbol} ({url}): {e}")
        return None

    # Step 3: Top section metrics
    top = extract_top_metrics(html)
    result.update(top)

    # Step 4: P&L — Revenue and Net Profit (last 2 years)
    rev_prev, rev_latest = extract_table_column(html, "profit-loss", "Sales")
    pat_prev, pat_latest = extract_table_column(html, "profit-loss", "Net Profit")

    result['revenue']      = rev_latest
    result['net_income']   = pat_latest

    if rev_prev and rev_latest and rev_prev > 0:
        result['revenue_growth'] = (rev_latest - rev_prev) / rev_prev
    if pat_prev and pat_latest and abs(pat_prev) > 0:
        result['earnings_growth'] = (pat_latest - pat_prev) / abs(pat_prev)

    # Step 5: Balance sheet — D/E ratio
    _, eq_capital = extract_table_column(html, "balance-sheet", "Equity Capital")
    _, reserves   = extract_table_column(html, "balance-sheet", "Reserves")
    _, borrowings = extract_table_column(html, "balance-sheet", "Borrowings")

    result['total_equity'] = (eq_capital or 0) + (reserves or 0)
    result['total_debt']   = borrowings

    if borrowings is not None and result['total_equity'] > 0:
        result['debt_to_equity'] = round(borrowings / result['total_equity'], 4)

    return result

# ─── Beta Computation from NSE Historical Data ───────────────────────────────

_nse_cookies = ""
_nse_cookie_expiry = 0.0

def refresh_nse_cookies():
    global _nse_cookies, _nse_cookie_expiry
    if time.time() < _nse_cookie_expiry:
        return
    try:
        r = session.get("https://www.nseindia.com", timeout=10)
        _nse_cookies = "; ".join(
            f"{k}={v}" for k, v in r.cookies.items()
        )
        _nse_cookie_expiry = time.time() + 300
    except Exception as e:
        log.warning(f"NSE cookie refresh failed: {e}")

def fetch_nse_prices(symbol: str, from_date: str, to_date: str, is_index=False):
    """Fetch daily close prices from NSE. Returns list of floats."""
    refresh_nse_cookies()
    headers = {**HEADERS, "Cookie": _nse_cookies, "Referer": "https://www.nseindia.com"}

    if is_index:
        url = f"{NSE_INDEX_URL}?indexType={requests.utils.quote(symbol)}&from={from_date}&to={to_date}"
    else:
        url = f"{NSE_HISTORY_URL}?symbol={requests.utils.quote(symbol)}&series=EQ&from={from_date}&to={to_date}"

    try:
        time.sleep(random.uniform(0.5, 1.0))
        r = session.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        data = r.json()

        if is_index:
            records = data.get("data", [])
            return [float(rec.get("CLOSE", rec.get("close", 0))) for rec in records if rec.get("CLOSE") or rec.get("close")]
        else:
            records = data.get("data", [])
            return [float(rec.get("CH_CLOSING_PRICE", 0)) for rec in records if rec.get("CH_CLOSING_PRICE")]
    except Exception as e:
        log.warning(f"NSE price fetch failed for {symbol}: {e}")
        return []

def compute_beta(stock_prices: list, index_prices: list) -> float | None:
    """Compute beta = Cov(stock, index) / Var(index) using daily log returns."""
    if len(stock_prices) < 20 or len(index_prices) < 20:
        return None
    # Align lengths
    n = min(len(stock_prices), len(index_prices))
    stock_prices = stock_prices[-n:]
    index_prices = index_prices[-n:]

    stock_returns = [(stock_prices[i] - stock_prices[i-1]) / stock_prices[i-1]
                     for i in range(1, n) if stock_prices[i-1] > 0]
    index_returns = [(index_prices[i] - index_prices[i-1]) / index_prices[i-1]
                     for i in range(1, n) if index_prices[i-1] > 0]

    m = min(len(stock_returns), len(index_returns))
    if m < 10:
        return None

    stock_returns = stock_returns[-m:]
    index_returns = index_returns[-m:]

    mean_s = sum(stock_returns) / m
    mean_i = sum(index_returns) / m

    cov = sum((stock_returns[j] - mean_s) * (index_returns[j] - mean_i) for j in range(m)) / m
    var_i = sum((index_returns[j] - mean_i) ** 2 for j in range(m)) / m

    if var_i == 0:
        return None
    beta = round(cov / var_i, 3)
    return beta if -5 < beta < 10 else None  # sanity check

def fetch_beta(symbol: str) -> float | None:
    """Compute 1-year rolling beta vs NIFTY 50."""
    to_date   = datetime.now().strftime("%d-%m-%Y")
    from_date = (datetime.now() - timedelta(days=365)).strftime("%d-%m-%Y")

    stock_prices = fetch_nse_prices(symbol, from_date, to_date, is_index=False)
    nifty_prices = fetch_nse_prices("NIFTY 50", from_date, to_date, is_index=True)

    return compute_beta(stock_prices, nifty_prices)

# ─── DB Operations ────────────────────────────────────────────────────────────

def get_symbols(conn, resume=False, limit=None):
    """Fetch symbols to enrich from screener_financials."""
    with conn.cursor() as cur:
        if resume:
            if limit is not None:
                cur.execute("""
                    SELECT DISTINCT symbol FROM screener_financials
                    WHERE roe IS NULL
                    ORDER BY symbol
                    LIMIT %s
                """, (limit,))
            else:
                cur.execute("""
                    SELECT DISTINCT symbol FROM screener_financials
                    WHERE roe IS NULL
                    ORDER BY symbol
                """)
        else:
            if limit is not None:
                cur.execute("""
                    SELECT DISTINCT symbol FROM screener_financials
                    ORDER BY symbol
                    LIMIT %s
                """, (limit,))
            else:
                cur.execute("""
                    SELECT DISTINCT symbol FROM screener_financials
                    ORDER BY symbol
                """)
        return [row[0] for row in cur.fetchall()]

def update_symbol(conn, symbol: str, data: dict, beta: float | None):
    """Update screener_financials for the most recent fiscal year of a symbol."""
    if not data:
        return

    fields = {
        'roe':            data.get('roe'),
        'roce':           data.get('roce'),
        'dividend_yield': data.get('dividend_yield'),
        'book_value':     data.get('book_value'),
        'revenue_growth': data.get('revenue_growth'),
        'earnings_growth':data.get('earnings_growth'),
        'debt_to_equity': data.get('debt_to_equity'),
        'revenue':        data.get('revenue'),
        'net_income':     data.get('net_income'),
        'total_debt':     data.get('total_debt'),
        'total_equity':   data.get('total_equity'),
    }

    # Build SET clause — only update non-null fields
    set_parts = []
    values = []
    for col, val in fields.items():
        if val is not None:
            set_parts.append(f"{col} = COALESCE(%s, {col})")
            values.append(val)

    if not set_parts:
        return

    set_parts.append("last_updated = now()")
    values.append(symbol)

    sql = f"""
        UPDATE screener_financials
        SET {', '.join(set_parts)}
        WHERE symbol = %s
          AND fiscal_year = (
            SELECT MAX(fiscal_year) FROM screener_financials WHERE symbol = %s
          )
    """
    values.append(symbol)  # for the subquery

    with conn.cursor() as cur:
        cur.execute(sql, values)
    conn.commit()

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Enrich FintekPro DB from Screener.in")
    parser.add_argument("--symbol",  help="Enrich a single symbol (for testing)")
    parser.add_argument("--limit",   type=int, help="Max number of symbols to process")
    parser.add_argument("--resume",  action="store_true", help="Skip already-enriched symbols")
    parser.add_argument("--no-beta", action="store_true", help="Skip beta computation (faster)")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL environment variable not set")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    log.info("Connected to database")

    if args.symbol:
        symbols = [args.symbol.upper()]
    else:
        symbols = get_symbols(conn, resume=args.resume, limit=args.limit)

    log.info(f"Processing {len(symbols)} symbols")

    success = 0
    failed  = 0
    skipped = 0

    for i, symbol in enumerate(symbols, 1):
        prefix = f"[{i}/{len(symbols)}] {symbol}"
        try:
            log.info(f"{prefix} — scraping Screener.in...")
            data = scrape_screener(symbol)

            if data is None:
                log.info(f"{prefix} — no data, skipping")
                skipped += 1
                continue

            beta = None
            if not args.no_beta:
                log.info(f"{prefix} — computing beta...")
                beta = fetch_beta(symbol)
                if beta is not None:
                    data['beta'] = beta

            update_symbol(conn, symbol, data, beta)

            log.info(
                f"{prefix} ✓ ROE:{data.get('roe', 'N/A')!r} "
                f"D/E:{data.get('debt_to_equity', 'N/A')!r} "
                f"DivYield:{data.get('dividend_yield', 'N/A')!r} "
                f"RevG:{data.get('revenue_growth', 'N/A')!r} "
                f"Beta:{beta!r}"
            )
            success += 1

        except KeyboardInterrupt:
            log.info("Interrupted by user")
            break
        except Exception as e:
            log.error(f"{prefix} ERROR: {e}")
            log.debug(traceback.format_exc())
            failed += 1

        # Throttle: 1–2 seconds between requests
        time.sleep(random.uniform(1.0, 2.0))

    conn.close()
    log.info(f"\n{'='*50}")
    log.info(f"Done. Success: {success} | Skipped: {skipped} | Failed: {failed}")
    log.info(f"{'='*50}")

if __name__ == "__main__":
    main()
