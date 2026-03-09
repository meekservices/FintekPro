from __future__ import annotations
import logging
import asyncio
from datetime import date, datetime
import pandas as pd
import io
import httpx
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from auth import verify_token, TokenPayload
from database import db_conn, get_pool

logger = logging.getLogger("corporate_actions")
router = APIRouter(prefix="/api/corporate-actions", tags=["corporate-actions"])

NSE_CA_URL = "https://archives.nseindia.com/content/equities/CA.csv"

class CorporateActionSyncResponse(BaseModel):
    status: str
    synced_count: int
    errors: List[str]

def parse_ratio(ratio_str: str) -> Optional[float]:
    """Parse ratio like '2:1' or '1:1' and return adjustment factor."""
    if not ratio_str or ":" not in ratio_str:
        return None
    try:
        parts = ratio_str.split(":")
        new_shares = float(parts[0])
        old_shares = float(parts[1])
        if new_shares == 0:
            return None
        # For SPLIT 2:1 (1 old becomes 2 new), price becomes 1/2 = 0.5
        # For BONUS 1:1 (1 old becomes 2 new), price becomes 1/2 = 0.5
        # For BONUS 1:2 (2 old become 3 new), price becomes 2/3 = 0.667
        # The ratio in NSE CA.csv for BONUS is usually "Bonus 1:1" meaning 1 new for 1 old.
        # So total shares = old + new.
        # Wait, SPLIT ratio 10:1 usually means face value 10 becomes 1.
        # Let's be careful with ratio interpretation.
        return old_shares / new_shares
    except Exception:
        return None

def compute_adjustment_factor(purpose: str) -> Optional[float]:
    """Extract ratio and compute adjustment factor from purpose string."""
    purpose_upper = purpose.upper()
    import re
    
    if "SPLIT" in purpose_upper:
        # Look for "FROM RS 10/- TO RS 2/-" or "RS 10 TO RS 2" or "10:2"
        match = re.search(r"RS\s*(\d+)\s*TO\s*RS\s*(\d+)", purpose_upper)
        if match:
            old_fv = float(match.group(1))
            new_fv = float(match.group(2))
            return new_fv / old_fv
        match = re.search(r"(\d+):(\d+)", purpose_upper)
        if match:
            return parse_ratio(match.group(0))
            
    if "BONUS" in purpose_upper:
        # Look for "BONUS 1:1"
        match = re.search(r"(\d+):(\d+)", purpose_upper)
        if match:
            new_shares = float(match.group(1))
            old_shares = float(match.group(2))
            # 1:1 bonus means 1 new for 1 old, so 2 total for 1 old.
            # Factor = 1 / 2 = 0.5
            return old_shares / (old_shares + new_shares)
            
    return None

def map_action_type(purpose: str) -> str:
    purpose_upper = purpose.upper()
    if "SPLIT" in purpose_upper: return "SPLIT"
    if "BONUS" in purpose_upper: return "BONUS"
    if "DIVIDEND" in purpose_upper: return "DIVIDEND"
    if "RIGHTS" in purpose_upper: return "RIGHTS"
    if "MERGER" in purpose_upper: return "MERGER"
    if "DEMERGER" in purpose_upper: return "DEMERGER"
    if "BUYBACK" in purpose_upper: return "BUYBACK"
    return "OTHER"

@router.post("/sync")
async def sync_corporate_actions(_: TokenPayload = Depends(verify_token)):
    """Fetch from NSE corporate actions CSV and upsert into DB."""
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(NSE_CA_URL)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Failed to fetch NSE CA archive: {response.status_code}")
            content = response.text
        
        df = pd.read_csv(io.StringIO(content))
        # Columns: SYMBOL, SERIES, FACE VALUE, PURPOSE, EX DATE, RECORD DT, BC STDT, BC ENDDT
        df.columns = [c.strip() for c in df.columns]
        
        synced = 0
        errors = []
        
        async with db_conn() as conn:
            for _, row in df.iterrows():
                symbol = str(row['SYMBOL']).strip()
                purpose = str(row['PURPOSE']).strip()
                ex_date_str = str(row['EX DATE']).strip()
                
                try:
                    ex_date = datetime.strptime(ex_date_str, "%d-%b-%Y").date()
                except:
                    continue # Skip invalid dates
                
                action_type = map_action_type(purpose)
                adj_factor = compute_adjustment_factor(purpose)
                
                # Derive ISIN
                stock = await conn.fetchrow("SELECT isin FROM listed_stocks WHERE symbol = $1 LIMIT 1", symbol)
                if not stock or not stock['isin']:
                    continue # Cannot map to ISIN, skip
                
                isin = stock['isin']
                
                # Dividend amount extraction
                dividend_amount = None
                if action_type == "DIVIDEND":
                    import re
                    match = re.search(r"RS\s*(\d+\.?\d*)", purpose.upper())
                    if match:
                        dividend_amount = float(match.group(1))

                await conn.execute("""
                    INSERT INTO corporate_actions (
                        isin, symbol, action_type, ex_date, record_date, 
                        purpose, adjustment_factor, dividend_amount, source, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NSE', NOW())
                    ON CONFLICT (isin, ex_date, action_type) DO UPDATE SET
                        symbol = EXCLUDED.symbol,
                        purpose = EXCLUDED.purpose,
                        adjustment_factor = EXCLUDED.adjustment_factor,
                        dividend_amount = EXCLUDED.dividend_amount,
                        updated_at = NOW()
                """, isin, symbol, action_type, ex_date, 
                   datetime.strptime(str(row['RECORD DT']).strip(), "%d-%b-%Y").date() if str(row['RECORD DT']).strip() != 'NaN' and str(row['RECORD DT']).strip() != '' else None,
                   purpose, adj_factor, dividend_amount)
                synced += 1
                
        return {"status": "success", "synced_count": synced, "errors": errors}
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending")
async def get_pending_actions(_: TokenPayload = Depends(verify_token)):
    async with db_conn() as conn:
        rows = await conn.fetch("""
            SELECT * FROM corporate_actions 
            WHERE is_applied_to_golden_prices = false 
            AND ex_date <= CURRENT_DATE
            AND action_type IN ('SPLIT', 'BONUS')
        """)
        return [dict(r) for r in rows]

@router.post("/apply-adjustments")
async def apply_adjustments(_: TokenPayload = Depends(verify_token)):
    async with db_conn() as conn:
        pending = await conn.fetch("""
            SELECT * FROM corporate_actions 
            WHERE is_applied_to_golden_prices = false 
            AND ex_date <= CURRENT_DATE
            AND action_type IN ('SPLIT', 'BONUS')
            AND adjustment_factor IS NOT NULL
        """)
        
        applied_count = 0
        for ca in pending:
            ca_id = ca['id']
            isin = ca['isin']
            ex_date = ca['ex_date']
            factor = float(ca['adjustment_factor'])
            
            # Update golden_prices
            # We need to log adjustments too. 
            # First, fetch rows to be adjusted for the audit log
            prices_to_adjust = await conn.fetch("""
                SELECT price_date, price, open_price, high_price, low_price
                FROM golden_prices
                WHERE isin = $1 AND price_date < $2
            """, isin, ex_date)
            
            if prices_to_adjust:
                for p in prices_to_adjust:
                    await conn.execute("""
                        INSERT INTO price_adjustments (
                            corporate_action_id, isin, price_date, original_price, adjusted_price, adjustment_factor
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    """, ca_id, isin, p['price_date'], p['price'], float(p['price']) * factor, factor)
                
                await conn.execute("""
                    UPDATE golden_prices SET
                        price = price * $3,
                        open_price = open_price * $3,
                        high_price = high_price * $3,
                        low_price = low_price * $3
                    WHERE isin = $1 AND price_date < $2
                """, isin, ex_date, factor)
            
            await conn.execute("""
                UPDATE corporate_actions SET
                    is_applied_to_golden_prices = true,
                    applied_at = NOW()
                WHERE id = $1
            """, ca_id)
            applied_count += 1
            
        if applied_count > 0:
            # Trigger daily returns run to recompute with new prices
            # In a real environment we might call the endpoint or use an internal function.
            # Here we try to trigger the existing endpoint logic.
            from routes.price_returns import daily_returns_run
            await daily_returns_run(_)
            
        return {"status": "success", "applied_count": applied_count}

@router.get("/list")
async def list_corporate_actions(
    isin: Optional[str] = None,
    action_type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    _: TokenPayload = Depends(verify_token)
):
    query = "SELECT * FROM corporate_actions WHERE 1=1"
    params = []
    if isin:
        params.append(isin)
        query += f" AND isin = ${len(params)}"
    if action_type:
        params.append(action_type)
        query += f" AND action_type = ${len(params)}"
    if from_date:
        params.append(from_date)
        query += f" AND ex_date >= ${len(params)}"
    if to_date:
        params.append(to_date)
        query += f" AND ex_date <= ${len(params)}"
    
    query += " ORDER BY ex_date DESC"
    
    async with db_conn() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]

@router.get("/history/{isin}")
async def get_history(isin: str, _: TokenPayload = Depends(verify_token)):
    async with db_conn() as conn:
        rows = await conn.fetch("SELECT * FROM corporate_actions WHERE isin = $1 ORDER BY ex_date DESC", isin)
        return [dict(r) for r in rows]
