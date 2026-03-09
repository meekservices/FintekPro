import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Creates or updates the security_master VIEW which unifies:
 * - listed_stocks (equities)
 * - mutual_funds (MFs)
 * - corporate_bonds (Bonds)
 * - unlisted_companies (Unlisted equities)
 * 
 * This VIEW is read-only and provides a unified interface for ISIN lookup and search.
 */
export async function initializeSecurityMaster() {
  try {
    console.log("🔄 [SecurityMaster] Initializing view...");
    
    await db.execute(sql`
      CREATE OR REPLACE VIEW security_master AS
      SELECT
        isin,
        company_name AS instrument_name,
        'equity'::varchar AS asset_class,
        'NSE'::varchar AS exchange,
        symbol,
        sector,
        'ACTIVE'::varchar AS status,
        current_price::numeric AS current_price,
        'INR'::varchar AS currency,
        last_updated AS updated_at
      FROM listed_stocks
      WHERE isin IS NOT NULL
      
      UNION ALL
      
      SELECT
        isin,
        scheme_name AS instrument_name,
        'mutual_fund'::varchar AS asset_class,
        'AMFI'::varchar AS exchange,
        scheme_code::varchar AS symbol,
        category AS sector,
        COALESCE(scheme_status, 'active')::varchar AS status,
        nav::numeric AS current_price,
        'INR'::varchar AS currency,
        NULL::timestamp AS updated_at
      FROM mutual_funds
      WHERE isin IS NOT NULL
      
      UNION ALL
      
      SELECT
        isin,
        bond_name AS instrument_name,
        'bond'::varchar AS asset_class,
        'BSE'::varchar AS exchange,
        security_code::varchar AS symbol,
        bond_type AS sector,
        instrument_status::varchar AS status,
        last_traded_price::numeric AS current_price,
        'INR'::varchar AS currency,
        NULL::timestamp AS updated_at
      FROM corporate_bonds
      WHERE isin IS NOT NULL
      
      UNION ALL
      
      SELECT
        isin,
        name AS instrument_name,
        'unlisted_equity'::varchar AS asset_class,
        'UNLISTED'::varchar AS exchange,
        NULL::varchar AS symbol,
        sector,
        status::varchar AS status,
        COALESCE(published_buy_price, draft_buy_price)::numeric AS current_price,
        'INR'::varchar AS currency,
        updated_at AS updated_at
      FROM unlisted_companies
      WHERE isin IS NOT NULL;
    `);

    console.log("✅ [SecurityMaster] View created successfully");
  } catch (error: any) {
    console.error("❌ [SecurityMaster] Failed to initialize view:", error.message);
    // We don't throw here to avoid blocking server boot if one table is missing,
    // but the task requirements say it's blocked by T001 which should ensure tables exist.
    throw error;
  }
}
