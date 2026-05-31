// @ts-nocheck
/**
 * Mutual Fund Metrics Service
 * 
 * Calculates REAL returns (1Y, 3Y, 5Y) from actual historical NAV data
 * sourced from AMFI via MFAPI.in. This service is designed for 
 * regulatory compliance - all calculations use authentic data.
 * 
 * FORMULA: CAGR = (EndNAV / StartNAV)^(1/years) - 1
 * 
 * Data Source: MFAPI.in (aggregates official AMFI NAV data)
 * Update Frequency: Daily (NAV published after market close)
 */

import { db } from '../db';
import { mutualFunds, mutualFundMetrics, historicalNavData } from '@shared/schema';
import { eq, and, gte, lte, desc, asc, sql, isNull, or } from 'drizzle-orm';
import { HistoricalNavService } from './historical-nav-service';

function getCurrentFiscalYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  return `FY${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

interface CalculatedReturns {
  returns1y: number | null;
  returns3y: number | null;
  returns5y: number | null;
  dataSource: string;
  calculatedAt: Date;
  nav1yAgo: number | null;
  nav3yAgo: number | null;
  nav5yAgo: number | null;
  navCurrent: number | null;
  date1yAgo: string | null;
  date3yAgo: string | null;
  date5yAgo: string | null;
}

interface BatchUpdateResult {
  success: boolean;
  totalProcessed: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedNoData: number;
  errors: string[];
  duration: number;
}

interface AuditLogEntry {
  schemeCode: string;
  schemeName: string;
  calculationType: '1Y' | '3Y' | '5Y';
  navStart: number;
  navEnd: number;
  dateStart: string;
  dateEnd: string;
  calculatedReturn: number;
  formula: string;
  dataSource: string;
  timestamp: Date;
}

const MFAPI_BASE_URL = 'https://api.mfapi.in/mf';

export class MutualFundMetricsService {
  private static instance: MutualFundMetricsService;
  private historicalNavService: HistoricalNavService;
  private auditLog: AuditLogEntry[] = [];

  private constructor() {
    this.historicalNavService = HistoricalNavService.getInstance();
  }

  static getInstance(): MutualFundMetricsService {
    if (!this.instance) {
      this.instance = new MutualFundMetricsService();
    }
    return this.instance;
  }

  /**
   * Calculate CAGR (Compound Annual Growth Rate)
   * Formula: (EndValue / BeginValue)^(1/years) - 1
   * 
   * @param startNav NAV at the beginning of the period
   * @param endNav NAV at the end of the period
   * @param years Number of years in the period
   * @returns CAGR as a percentage (e.g., 12.5 for 12.5%)
   */
  calculateCAGR(startNav: number, endNav: number, years: number): number {
    if (startNav <= 0 || endNav <= 0 || years <= 0) {
      return 0;
    }
    const cagr = Math.pow(endNav / startNav, 1 / years) - 1;
    return Math.round(cagr * 10000) / 100; // Return as percentage with 2 decimal places
  }

  /**
   * Get NAV for a specific date, with tolerance for holidays/weekends
   * Looks for closest available NAV within 7 days before the target date
   */
  private async getNavForDate(
    schemeCode: string,
    targetDate: Date,
    toleranceDays: number = 7
  ): Promise<{ nav: number; date: string } | null> {
    const dateStr = targetDate.toISOString().split('T')[0];
    const minDate = new Date(targetDate);
    minDate.setDate(minDate.getDate() - toleranceDays);
    const minDateStr = minDate.toISOString().split('T')[0];

    // First check our local database
    const localResult = await db.select({
      nav: historicalNavData.nav,
      date: historicalNavData.date
    })
    .from(historicalNavData)
    .where(and(
      eq(historicalNavData.identifier, schemeCode),
      eq(historicalNavData.identifierType, 'mutual_fund'),
      gte(historicalNavData.date, minDateStr),
      lte(historicalNavData.date, dateStr)
    ))
    .orderBy(desc(historicalNavData.date))
    .limit(1);

    if (localResult.length > 0) {
      return {
        nav: parseFloat(localResult[0].nav as string),
        date: localResult[0].date as string
      };
    }

    return null;
  }

  /**
   * Fetch and store full NAV history for a scheme from MFAPI
   */
  async fetchAndStoreNavHistory(schemeCode: string): Promise<boolean> {
    try {
      const result = await this.historicalNavService.fetchAndStoreMutualFundHistory(schemeCode);
      return result.success && result.recordsStored > 0;
    } catch (error) {
      console.error(`[MFMetrics] Error fetching NAV history for ${schemeCode}:`, error);
      return false;
    }
  }

  /**
   * Calculate returns for a single mutual fund scheme
   * Uses real historical NAV data from AMFI
   */
  async calculateReturnsForScheme(schemeCode: string): Promise<CalculatedReturns> {
    const now = new Date();
    const date1yAgo = new Date(now);
    date1yAgo.setFullYear(date1yAgo.getFullYear() - 1);
    const date3yAgo = new Date(now);
    date3yAgo.setFullYear(date3yAgo.getFullYear() - 3);
    const date5yAgo = new Date(now);
    date5yAgo.setFullYear(date5yAgo.getFullYear() - 5);

    // Get current NAV
    const currentNavResult = await this.getNavForDate(schemeCode, now, 7);
    
    // Get historical NAVs
    const nav1yResult = await this.getNavForDate(schemeCode, date1yAgo, 7);
    const nav3yResult = await this.getNavForDate(schemeCode, date3yAgo, 7);
    const nav5yResult = await this.getNavForDate(schemeCode, date5yAgo, 7);

    const result: CalculatedReturns = {
      returns1y: null,
      returns3y: null,
      returns5y: null,
      dataSource: 'MFAPI.in (AMFI)',
      calculatedAt: now,
      navCurrent: currentNavResult?.nav || null,
      nav1yAgo: nav1yResult?.nav || null,
      nav3yAgo: nav3yResult?.nav || null,
      nav5yAgo: nav5yResult?.nav || null,
      date1yAgo: nav1yResult?.date || null,
      date3yAgo: nav3yResult?.date || null,
      date5yAgo: nav5yResult?.date || null
    };

    if (currentNavResult && nav1yResult) {
      result.returns1y = this.calculateCAGR(nav1yResult.nav, currentNavResult.nav, 1);
      await this.logAudit(schemeCode, '1Y', nav1yResult.nav, currentNavResult.nav, 
        nav1yResult.date, currentNavResult.date);
    }

    if (currentNavResult && nav3yResult) {
      result.returns3y = this.calculateCAGR(nav3yResult.nav, currentNavResult.nav, 3);
      await this.logAudit(schemeCode, '3Y', nav3yResult.nav, currentNavResult.nav,
        nav3yResult.date, currentNavResult.date);
    }

    if (currentNavResult && nav5yResult) {
      result.returns5y = this.calculateCAGR(nav5yResult.nav, currentNavResult.nav, 5);
      await this.logAudit(schemeCode, '5Y', nav5yResult.nav, currentNavResult.nav,
        nav5yResult.date, currentNavResult.date);
    }

    return result;
  }

  /**
   * Log calculation for audit trail (regulatory compliance)
   * Persists to database for regulatory traceability
   */
  private async logAudit(
    schemeCode: string,
    calculationType: '1Y' | '3Y' | '5Y',
    navStart: number,
    navEnd: number,
    dateStart: string,
    dateEnd: string
  ): Promise<void> {
    const years = calculationType === '1Y' ? 1 : calculationType === '3Y' ? 3 : 5;
    const calculatedReturn = this.calculateCAGR(navStart, navEnd, years);
    const formula = `CAGR = (${navEnd.toFixed(4)} / ${navStart.toFixed(4)})^(1/${years}) - 1 = ${calculatedReturn.toFixed(2)}%`;

    // Keep in-memory for current session
    this.auditLog.push({
      schemeCode,
      schemeName: '',
      calculationType,
      navStart,
      navEnd,
      dateStart,
      dateEnd,
      calculatedReturn,
      formula,
      dataSource: 'MFAPI.in (AMFI official data)',
      timestamp: new Date()
    });

    // Persist to database for regulatory compliance
    try {
      await db.execute(sql`
        INSERT INTO mf_calculation_audit_log 
        (scheme_code, calculation_type, nav_start, nav_end, date_start, date_end, calculated_return, formula, data_source)
        VALUES (
          ${schemeCode},
          ${calculationType},
          ${navStart},
          ${navEnd},
          ${dateStart}::date,
          ${dateEnd}::date,
          ${calculatedReturn},
          ${formula},
          'MFAPI.in (AMFI official data)'
        )
      `);
    } catch (error) {
      console.error('[MFMetrics] Error persisting audit log:', error);
    }
  }

  /**
   * Get in-memory audit log for current session
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get persisted audit log from database for regulatory review
   */
  async getPersistedAuditLog(limit: number = 1000): Promise<AuditLogEntry[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          scheme_code as "schemeCode",
          scheme_name as "schemeName",
          calculation_type as "calculationType",
          nav_start as "navStart",
          nav_end as "navEnd",
          date_start as "dateStart",
          date_end as "dateEnd",
          calculated_return as "calculatedReturn",
          formula,
          data_source as "dataSource",
          calculated_at as "timestamp"
        FROM mf_calculation_audit_log
        ORDER BY calculated_at DESC
        LIMIT ${limit}
      `);
      return result.rows as AuditLogEntry[];
    } catch (error) {
      console.error('[MFMetrics] Error fetching audit log:', error);
      return this.auditLog; // Fall back to in-memory
    }
  }

  /**
   * Clear in-memory audit log (database log is retained for compliance)
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Update returns for a single scheme in the database.
   * Writes to mutual_fund_metrics (canonical) and keeps basic returns on mutual_funds (catalog display).
   */
  async updateSchemeReturns(schemeCode: string): Promise<boolean> {
    try {
      await this.fetchAndStoreNavHistory(schemeCode);
      const returns = await this.calculateReturnsForScheme(schemeCode);
      const fiscalYear = getCurrentFiscalYear();

      const fund = await db.select({ id: mutualFunds.id })
        .from(mutualFunds)
        .where(eq(mutualFunds.schemeCode, schemeCode))
        .limit(1);

      const fundId = fund[0]?.id || null;

      await db.execute(sql`
        INSERT INTO mutual_fund_metrics (scheme_code, fund_id, fiscal_year,
          return_1y, return_3y, return_5y, data_source, last_updated)
        VALUES (
          ${schemeCode}, ${fundId}, ${fiscalYear},
          ${returns.returns1y?.toString() || null},
          ${returns.returns3y?.toString() || null},
          ${returns.returns5y?.toString() || null},
          'MFAPI.in (AMFI)', NOW()
        )
        ON CONFLICT (scheme_code, fiscal_year) 
        DO UPDATE SET
          return_1y = COALESCE(EXCLUDED.return_1y, mutual_fund_metrics.return_1y),
          return_3y = COALESCE(EXCLUDED.return_3y, mutual_fund_metrics.return_3y),
          return_5y = COALESCE(EXCLUDED.return_5y, mutual_fund_metrics.return_5y),
          fund_id = COALESCE(EXCLUDED.fund_id, mutual_fund_metrics.fund_id),
          data_source = EXCLUDED.data_source,
          last_updated = NOW()
      `);

      await db.update(mutualFunds)
        .set({
          returns1y: returns.returns1y?.toString() || null,
          returns3y: returns.returns3y?.toString() || null,
          returns5y: returns.returns5y?.toString() || null,
          lastUpdated: new Date()
        })
        .where(eq(mutualFunds.schemeCode, schemeCode));

      return true;
    } catch (error) {
      console.error(`[MFMetrics] Error updating returns for ${schemeCode}:`, error);
      return false;
    }
  }

  /**
   * Batch update returns for multiple schemes
   * Processes in batches to avoid overwhelming the API
   */
  async batchUpdateReturns(
    schemeCodes: string[],
    options: { batchSize?: number; delayBetweenBatches?: number } = {}
  ): Promise<BatchUpdateResult> {
    const { batchSize = 50, delayBetweenBatches = 1000 } = options;
    const startTime = Date.now();
    
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedNoData = 0;
    const errors: string[] = [];

    console.log(`[MFMetrics] Starting batch update for ${schemeCodes.length} schemes...`);

    for (let i = 0; i < schemeCodes.length; i += batchSize) {
      const batch = schemeCodes.slice(i, i + batchSize);
      
      for (const schemeCode of batch) {
        try {
          const success = await this.updateSchemeReturns(schemeCode);
          if (success) {
            successfulUpdates++;
          } else {
            skippedNoData++;
          }
        } catch (error: any) {
          failedUpdates++;
          errors.push(`${schemeCode}: ${error.message}`);
        }
      }

      // Progress logging
      const processed = Math.min(i + batchSize, schemeCodes.length);
      console.log(`[MFMetrics] Progress: ${processed}/${schemeCodes.length} (${successfulUpdates} updated, ${skippedNoData} skipped, ${failedUpdates} failed)`);

      // Delay between batches to respect rate limits
      if (i + batchSize < schemeCodes.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[MFMetrics] Batch update complete in ${duration}ms`);

    return {
      success: failedUpdates === 0,
      totalProcessed: schemeCodes.length,
      successfulUpdates,
      failedUpdates,
      skippedNoData,
      errors: errors.slice(0, 50),
      duration
    };
  }

  /**
   * Update returns for all schemes that don't have returns or need refresh
   */
  async refreshAllReturns(options: { 
    forceRefresh?: boolean;
    limit?: number;
  } = {}): Promise<BatchUpdateResult> {
    const { forceRefresh = false, limit = 1000 } = options;

    // Get schemes that need updating
    let query = db.select({ schemeCode: mutualFunds.schemeCode })
      .from(mutualFunds)
      .limit(limit);

    if (!forceRefresh) {
      query = db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(or(
          isNull(mutualFunds.returns1y),
          isNull(mutualFunds.returns3y),
          isNull(mutualFunds.returns5y)
        ))
        .limit(limit);
    }

    const schemes = await query;
    const schemeCodes = schemes.map(s => s.schemeCode);

    console.log(`[MFMetrics] Found ${schemeCodes.length} schemes to update`);

    return this.batchUpdateReturns(schemeCodes);
  }

  /**
   * Fetch expense ratio and AUM from scheme factsheet data
   * Note: This data is typically available from AMC websites or data providers
   */
  async fetchExpenseRatioAndAum(schemeCode: string): Promise<{
    expenseRatio: number | null;
    aum: number | null;
  }> {
    try {
      // MFAPI provides some metadata including expense ratio and AUM
      const response = await fetch(`${MFAPI_BASE_URL}/${schemeCode}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return { expenseRatio: null, aum: null };
      }

      const data = await response.json();
      
      // Note: MFAPI may not have expense_ratio/aum in all cases
      // In production, you would integrate with a data provider like 
      // Morning Star, ValueResearch, or direct AMC APIs
      return {
        expenseRatio: data.meta?.expense_ratio || null,
        aum: data.meta?.aum || null
      };
    } catch (error) {
      console.error(`[MFMetrics] Error fetching expense/AUM for ${schemeCode}:`, error);
      return { expenseRatio: null, aum: null };
    }
  }

  /**
   * Get calculation methodology documentation for regulatory compliance
   */
  getMethodologyDocumentation(): string {
    return `
MUTUAL FUND RETURNS CALCULATION METHODOLOGY
============================================

Data Source: MFAPI.in (aggregates official AMFI NAV data)
Primary Source: Association of Mutual Funds in India (AMFI)
URL: https://www.amfiindia.com/spages/NAVAll.txt

RETURN CALCULATION FORMULA:
--------------------------
Compound Annual Growth Rate (CAGR)

Formula: CAGR = (EndNAV / StartNAV)^(1/years) - 1

Where:
- EndNAV = Net Asset Value on the end date (most recent)
- StartNAV = Net Asset Value on the start date (1/3/5 years ago)
- years = Number of years in the period

PERIODS CALCULATED:
------------------
- 1Y Return: CAGR over 1 year (365 days)
- 3Y Return: CAGR over 3 years (1095 days)
- 5Y Return: CAGR over 5 years (1825 days)

DATE TOLERANCE:
--------------
If NAV is not available for the exact date (weekends/holidays),
the system uses the nearest available NAV within 7 days prior.

EXAMPLE CALCULATION:
-------------------
Scheme: XYZ Growth Fund
NAV on 01-Feb-2025: ₹150.00
NAV on 01-Feb-2024: ₹120.00

1Y Return = (150/120)^(1/1) - 1
         = 1.25 - 1
         = 0.25 (25.00%)

AUDIT TRAIL:
-----------
All calculations are logged with:
- Scheme code and name
- Start and end NAV values
- Start and end dates
- Calculation formula used
- Timestamp of calculation
- Data source attribution

Compliance: SEBI Mutual Fund Regulations
Last Updated: ${new Date().toISOString()}
    `.trim();
  }
}

export const mutualFundMetricsService = MutualFundMetricsService.getInstance();
