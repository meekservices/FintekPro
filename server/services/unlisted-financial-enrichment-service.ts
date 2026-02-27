/**
 * Unlisted Financial Enrichment Service
 *
 * Orchestrates financial data enrichment for unlisted equity instruments
 * exclusively through the Probe42 vendor adapter.
 * MCA is NOT used for financial statements — only for company identity lookups.
 *
 * Flow:
 *  1. Fetch company profile from Probe42 (base-details)
 *  2. Fetch financial ratios (credit-ratings — always available)
 *  3. Attempt full financials (kyc endpoint — subscription-dependent, graceful fallback)
 *  4. Compute Financial Health Score (FHS) from available data
 *  5. Auto-flag compliance conditions (negative NW, PAT losses, status ≠ Active)
 *  6. Persist to company_financials / company_ratios tables (checksum dedup)
 *  7. Update unlisted_companies governance columns
 *  8. Write enrichment outcome to unlisted_audit_log
 */

import crypto from 'crypto';
import { db } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  unlistedCompanies,
  companyFinancials,
  companyRatios,
  unlistedAuditLog,
  type UnlistedCompany,
} from '@shared/schema';
import { probe42Adapter } from './vendor-adapters/probe42.adapter';
import type { FinancialStatement, FinancialRatios } from './vendor-adapters/probe42.adapter';

// ── FHS weights (doc: section 4) ────────────────────────────────────────────
const FHS_WEIGHTS = { roe: 0.35, revenueGrowth: 0.30, leverage: 0.35 };
const OVERVALUATION_PE_THRESHOLD = 2.0; // Flag if company PE > 2× sector average

export interface EnrichmentResult {
  companyId: string;
  companyName: string;
  cin: string;
  profile: 'fetched' | 'unavailable';
  financials: 'fetched' | 'subscription_blocked' | 'unavailable';
  ratios: 'fetched' | 'unavailable';
  financialYearsStored: number;
  ratioYearsStored: number;
  fhs: number | null;
  complianceFlags: string[];
  error?: string;
}

// ── Financial Health Score (FHS) ────────────────────────────────────────────

/**
 * Compute FHS ∈ [0,1] from ratio data.
 *
 * Formula (doc section 4):
 *   FHS = w1*(ROE_z) + w2*(RevGrowth_z) - w3*(Leverage_z)
 *   σ_unlisted = BaseSectorVol × (1 + (1 - FHS))
 *
 * Since z-scores require population data we don't have, we use normalized
 * anchor points instead (sufficient for relative ranking within our instruments).
 */
function computeFHS(ratios: FinancialRatios[]): number | null {
  if (!ratios.length) return null;

  const latest = ratios[0];
  const prev = ratios[1];

  const roe = latest.roe ?? 0;                  // %
  const leverage = latest.debtEquity ?? 0;       // D/E ratio
  const revGrowth = latest.revenueGrowth ?? (prev ? 0 : null);

  if (roe === 0 && leverage === 0 && revGrowth === null) return null;

  // Normalize to [0,1] using practical anchors
  // ROE: <0 → 0, 0–15% → linear to 0.5, 15–30% → linear to 1
  const roeNorm = roe <= 0 ? 0 : roe >= 30 ? 1 : roe < 15
    ? (roe / 15) * 0.5
    : 0.5 + ((roe - 15) / 15) * 0.5;

  // Revenue growth: < -10% → 0, -10–0% → 0.1–0.4, 0–20% → 0.4–0.8, >20% → 0.8–1
  const rg = revGrowth ?? 0;
  const revNorm = rg <= -10 ? 0 : rg < 0 ? 0.1 + (rg + 10) * 0.03
    : rg <= 20 ? 0.4 + (rg / 20) * 0.4
    : Math.min(1, 0.8 + (rg - 20) * 0.01);

  // Leverage (D/E): 0 → best (1.0), >3 → worst (0)
  const leverageNorm = leverage <= 0 ? 1 : leverage >= 3 ? 0 : 1 - (leverage / 3);

  const fhs = FHS_WEIGHTS.roe * roeNorm
    + FHS_WEIGHTS.revenueGrowth * revNorm
    - FHS_WEIGHTS.leverage * (1 - leverageNorm); // penalise high leverage

  return Math.max(0, Math.min(1, fhs));
}

// ── Compliance auto-flags ────────────────────────────────────────────────────

function detectComplianceFlags(
  financials: FinancialStatement[],
  ratios: FinancialRatios[],
  profileStatus: string | null | undefined
): string[] {
  const flags: string[] = [];

  // 1. Company status ≠ Active
  if (profileStatus && profileStatus.toLowerCase() !== 'active') {
    flags.push(`COMPANY_STATUS_${profileStatus.toUpperCase().replace(/\s+/g, '_')}`);
  }

  // 2. Negative net worth
  const hasNegativeNW = financials.some(f => f.networth !== null && f.networth !== undefined && f.networth < 0);
  if (hasNegativeNW) flags.push('NEGATIVE_NET_WORTH');

  // 3. Continuous PAT losses — 2+ consecutive years
  const sorted = [...financials].sort((a, b) => b.financialYear.localeCompare(a.financialYear));
  let consecutiveLosses = 0;
  for (const f of sorted) {
    if (f.pat !== null && f.pat !== undefined && f.pat < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }
  if (consecutiveLosses >= 2) flags.push('CONSECUTIVE_PAT_LOSSES');

  // 4. Highly leveraged (D/E > 2.0 from latest ratio)
  if (ratios.length > 0 && ratios[0].debtEquity !== null && (ratios[0].debtEquity ?? 0) > 2) {
    flags.push('HIGH_LEVERAGE');
  }

  // 5. Low FHS
  const fhs = computeFHS(ratios);
  if (fhs !== null && fhs < 0.25) flags.push('WEAK_FINANCIAL_HEALTH');

  return flags;
}

// ── Checksum for dedup ───────────────────────────────────────────────────────

function checksumFinancials(f: FinancialStatement): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      fy: f.financialYear,
      rev: f.revenue,
      pat: f.pat,
      nw: f.networth,
      debt: f.totalDebt,
    }))
    .digest('hex')
    .slice(0, 16);
}

// ── Main service ─────────────────────────────────────────────────────────────

class UnlistedFinancialEnrichmentService {
  /**
   * Enrich a single unlisted company with Probe42 financial data.
   * Safe to call repeatedly — checksum deduplication prevents duplicate FY rows.
   */
  async enrichCompany(companyId: string): Promise<EnrichmentResult> {
    const [company] = await db
      .select()
      .from(unlistedCompanies)
      .where(eq(unlistedCompanies.id, companyId))
      .limit(1);

    if (!company) throw new Error(`Company not found: ${companyId}`);
    if (!company.cin) {
      return {
        companyId, companyName: company.name, cin: '',
        profile: 'unavailable', financials: 'unavailable', ratios: 'unavailable',
        financialYearsStored: 0, ratioYearsStored: 0, fhs: null, complianceFlags: [],
        error: 'CIN not set — cannot enrich via Probe42',
      };
    }

    const result: EnrichmentResult = {
      companyId, companyName: company.name, cin: company.cin,
      profile: 'unavailable', financials: 'unavailable', ratios: 'unavailable',
      financialYearsStored: 0, ratioYearsStored: 0, fhs: null, complianceFlags: [],
    };

    // 1. Company profile
    let profileStatus: string | null = null;
    try {
      const profile = await probe42Adapter.fetchCompanyProfile(company.cin);
      if (profile) {
        result.profile = 'fetched';
        profileStatus = profile.status ?? null;
        // Update company status if changed
        if (profile.status && profile.status !== company.status) {
          await db.update(unlistedCompanies)
            .set({ status: profile.status, updatedAt: new Date() })
            .where(eq(unlistedCompanies.id, companyId));
        }
        // Update directors if present
        if (profile.directors?.length) {
          await db.update(unlistedCompanies)
            .set({ directors: profile.directors as any, updatedAt: new Date() })
            .where(eq(unlistedCompanies.id, companyId));
        }
      }
    } catch { /* non-critical */ }

    // 2. Financial ratios (credit-ratings endpoint — always available)
    let ratioRows: FinancialRatios[] = [];
    try {
      ratioRows = await probe42Adapter.fetchRatios(company.cin);
      result.ratios = ratioRows.length > 0 ? 'fetched' : 'unavailable';

      for (const ratio of ratioRows) {
        if (!ratio.financialYear) continue;
        const existing = await db.select({ id: companyRatios.id })
          .from(companyRatios)
          .where(and(
            eq(companyRatios.companyId, companyId),
            eq(companyRatios.financialYear, ratio.financialYear)
          ))
          .limit(1);

        const ratioRecord = {
          companyId,
          financialYear: ratio.financialYear,
          roe: ratio.roe?.toString() ?? null,
          roce: ratio.roce?.toString() ?? null,
          debtEquity: ratio.debtEquity?.toString() ?? null,
          currentRatio: ratio.currentRatio?.toString() ?? null,
          revenueGrowth: ratio.revenueGrowth?.toString() ?? null,
          profitGrowth: ratio.profitGrowth?.toString() ?? null,
          marginEbitda: ratio.marginEbitda?.toString() ?? null,
          marginPat: ratio.marginPat?.toString() ?? null,
          peRatio: ratio.peRatio?.toString() ?? null,
          dataSource: 'probe42',
        };

        if (existing.length === 0) {
          await db.insert(companyRatios).values(ratioRecord as any);
          result.ratioYearsStored++;
        } else {
          await db.update(companyRatios)
            .set({ ...ratioRecord, updatedAt: new Date() } as any)
            .where(and(
              eq(companyRatios.companyId, companyId),
              eq(companyRatios.financialYear, ratio.financialYear)
            ));
        }
      }
    } catch (err: any) {
      console.warn(`[UnlistedEnrichment] Ratios fetch failed for ${company.cin}:`, err.message);
    }

    // 3. Full financial statements (/kyc endpoint — subscription-dependent)
    let financialRows: FinancialStatement[] = [];
    try {
      financialRows = await probe42Adapter.fetchFinancials(company.cin);
      if (financialRows.length > 0) {
        result.financials = 'fetched';
        for (const fin of financialRows) {
          if (!fin.financialYear) continue;
          const checksum = checksumFinancials(fin);
          const existing = await db.select({ id: companyFinancials.id })
            .from(companyFinancials)
            .where(and(
              eq(companyFinancials.companyId, companyId),
              eq(companyFinancials.financialYear, fin.financialYear)
            ))
            .limit(1);

          const finRecord = {
            companyId,
            financialYear: fin.financialYear,
            revenue: fin.revenue?.toString() ?? null,
            ebitda: fin.ebitda?.toString() ?? null,
            ebit: fin.ebit?.toString() ?? null,
            pat: fin.pat?.toString() ?? null,
            netProfit: fin.netProfit?.toString() ?? null,
            totalAssets: fin.totalAssets?.toString() ?? null,
            totalLiabilities: fin.totalLiabilities?.toString() ?? null,
            networth: fin.networth?.toString() ?? null,
            totalDebt: fin.totalDebt?.toString() ?? null,
            operatingCashFlow: fin.operatingCashFlow?.toString() ?? null,
            dataSource: 'probe42',
            confidenceScore: '0.75',
          };

          if (existing.length === 0) {
            await db.insert(companyFinancials).values(finRecord as any);
            result.financialYearsStored++;
          }
        }
      } else {
        result.financials = 'subscription_blocked';
      }
    } catch {
      result.financials = 'subscription_blocked';
    }

    // 4. FHS computation
    const fhs = computeFHS(ratioRows);
    result.fhs = fhs;

    // 5. Compliance auto-flagging
    const complianceFlags = detectComplianceFlags(financialRows, ratioRows, profileStatus);
    result.complianceFlags = complianceFlags;

    // 6. Update unlisted_companies governance columns
    const updatedCompliance = complianceFlags.length > 0 ? 'blocked' : company.complianceStatus ?? 'pending';
    const updatedBlockReasons = complianceFlags.length > 0
      ? [...(Array.isArray(company.complianceBlockReasons) ? company.complianceBlockReasons : []), ...complianceFlags]
      : company.complianceBlockReasons;

    await db.update(unlistedCompanies)
      .set({
        lastSyncedAt: new Date(),
        enrichmentFailedAt: null,
        complianceStatus: updatedCompliance,
        complianceBlockReasons: updatedBlockReasons as any,
        updatedAt: new Date(),
      })
      .where(eq(unlistedCompanies.id, companyId));

    // 7. Audit log
    await db.insert(unlistedAuditLog).values({
      companyId,
      actionType: 'financial_enrichment',
      actionBy: 'system_probe42',
      previousValue: { lastSyncedAt: company.lastSyncedAt },
      newValue: {
        profile: result.profile,
        financials: result.financials,
        ratios: result.ratios,
        fhs,
        complianceFlags,
        financialYearsStored: result.financialYearsStored,
        ratioYearsStored: result.ratioYearsStored,
      },
      notes: `Probe42 enrichment complete. FHS: ${fhs?.toFixed(3) ?? 'N/A'}. Flags: ${complianceFlags.join(', ') || 'none'}`,
    } as any);

    console.log(`[UnlistedEnrichment] ${company.name} (${company.cin}): profile=${result.profile}, financials=${result.financials}, ratios=${result.ratios}, fhs=${fhs?.toFixed(3)}, flags=${complianceFlags.join(',') || 'none'}`);
    return result;
  }

  /**
   * Batch enrich companies whose enrichment is stale (>90 days).
   * Rate-controlled — processes up to `limit` companies per call.
   */
  async enrichStaleBatch(limit: number = 50): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: EnrichmentResult[];
  }> {
    const staleRows = await db.execute(sql`
      SELECT id, name, cin FROM unlisted_companies
      WHERE cin IS NOT NULL
        AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '90 days')
        AND status = 'active'
      ORDER BY last_synced_at ASC NULLS FIRST
      LIMIT ${limit}
    `);

    const results: EnrichmentResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const row of staleRows.rows as any[]) {
      try {
        const r = await this.enrichCompany(row.id);
        results.push(r);
        succeeded++;
      } catch (err: any) {
        failed++;
        // Mark enrichment failure
        await db.update(unlistedCompanies)
          .set({ enrichmentFailedAt: new Date() })
          .where(eq(unlistedCompanies.id, row.id));
        results.push({
          companyId: row.id, companyName: row.name, cin: row.cin,
          profile: 'unavailable', financials: 'unavailable', ratios: 'unavailable',
          financialYearsStored: 0, ratioYearsStored: 0, fhs: null, complianceFlags: [],
          error: err.message,
        });
      }
      // Brief pause between API calls (rate governance)
      await new Promise(r => setTimeout(r, 200));
    }

    return { processed: staleRows.rows.length, succeeded, failed, results };
  }

  /**
   * Compute Financial Health Score for a company from DB-stored ratio data.
   * Exposed for the admin financial health dashboard and proposal engine.
   */
  async computeFHSFromDb(companyId: string): Promise<{
    fhs: number | null;
    volatilityProxy: number | null;
    riskLabel: 'very_high' | 'high' | 'moderate';
    ratioYear: string | null;
  }> {
    const rows = await db
      .select()
      .from(companyRatios)
      .where(eq(companyRatios.companyId, companyId))
      .orderBy(desc(companyRatios.financialYear))
      .limit(3);

    if (!rows.length) return { fhs: null, volatilityProxy: null, riskLabel: 'very_high', ratioYear: null };

    const mapped: FinancialRatios[] = rows.map(r => ({
      financialYear: r.financialYear,
      roe: r.roe ? Number(r.roe) : null,
      roce: r.roce ? Number(r.roce) : null,
      debtEquity: r.debtEquity ? Number(r.debtEquity) : null,
      currentRatio: r.currentRatio ? Number(r.currentRatio) : null,
      revenueGrowth: r.revenueGrowth ? Number(r.revenueGrowth) : null,
      profitGrowth: r.profitGrowth ? Number(r.profitGrowth) : null,
      marginEbitda: r.marginEbitda ? Number(r.marginEbitda) : null,
      marginPat: r.marginPat ? Number(r.marginPat) : null,
      peRatio: r.peRatio ? Number(r.peRatio) : null,
      source: r.dataSource ?? 'probe42',
    }));

    const fhs = computeFHS(mapped);
    const BASE_SECTOR_VOL = 0.45; // 45% base vol for unlisted equity
    const volatilityProxy = fhs !== null ? BASE_SECTOR_VOL * (1 + (1 - fhs)) : null;

    const riskLabel: 'very_high' | 'high' | 'moderate' =
      fhs === null || fhs < 0.35 ? 'very_high'
      : fhs < 0.6 ? 'high'
      : 'moderate';

    return { fhs, volatilityProxy, riskLabel, ratioYear: rows[0].financialYear };
  }

  /**
   * Admin health report: financial weak spots across all unlisted companies.
   */
  async getFinancialHealthReport() {
    const negativeNW = await db.execute(sql`
      SELECT uc.id, uc.name, uc.cin, cf.financial_year, cf.networth, cf.pat
      FROM company_financials cf
      JOIN unlisted_companies uc ON uc.id = cf.company_id
      WHERE cf.networth IS NOT NULL AND cf.networth < 0
      ORDER BY cf.networth ASC
      LIMIT 20
    `);

    const highLeverage = await db.execute(sql`
      SELECT uc.id, uc.name, uc.cin, cr.financial_year, cr.debt_equity, cr.roe
      FROM company_ratios cr
      JOIN unlisted_companies uc ON uc.id = cr.company_id
      WHERE cr.debt_equity IS NOT NULL AND cr.debt_equity > 2
      ORDER BY cr.debt_equity DESC
      LIMIT 20
    `);

    const noFinancials = await db.execute(sql`
      SELECT uc.id, uc.name, uc.cin
      FROM unlisted_companies uc
      WHERE NOT EXISTS (
        SELECT 1 FROM company_financials cf WHERE cf.company_id = uc.id
      )
      AND uc.cin IS NOT NULL
      LIMIT 30
    `);

    const consecutiveLosses = await db.execute(sql`
      SELECT uc.id, uc.name, uc.cin,
             COUNT(*) as loss_years,
             MIN(cf.financial_year) as earliest_loss_year
      FROM company_financials cf
      JOIN unlisted_companies uc ON uc.id = cf.company_id
      WHERE cf.pat IS NOT NULL AND cf.pat < 0
      GROUP BY uc.id, uc.name, uc.cin
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    return {
      negativeNetWorth: negativeNW.rows,
      highLeverage: highLeverage.rows,
      noFinancialData: noFinancials.rows,
      consecutiveLossCompanies: consecutiveLosses.rows,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const unlistedFinancialEnrichmentService = new UnlistedFinancialEnrichmentService();
