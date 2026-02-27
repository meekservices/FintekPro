/**
 * Unlisted Equity Valuation Governance Service
 *
 * Enforces institutional-grade valuation rules for unlisted instruments:
 *  - Append-only valuation history (no updates, no deletes)
 *  - Staleness detection: >90 days → mark STALE + admin alert
 *  - Quarterly enforcement sweep
 *  - Compliance columns: risk_category=very_high, rebalance_eligible=false, liquidity_weight=0
 */

import { db } from '../db';
import { sql, eq, lt, isNull, or } from 'drizzle-orm';
import {
  unlistedCompanies,
  unlistedEquityValuationHistory,
  unlistedAuditLog,
  type InsertUnlistedEquityValuationHistory,
} from '@shared/schema';

const STALE_THRESHOLD_DAYS = 90;
const STRESS_HAIRCUT_PERCENT = 40;

export interface ValuationAddResult {
  id: string;
  companyId: string;
  companyName: string;
  price: number;
  valuationMethod: string;
  valuationDate: string;
  valuationStatus: 'current' | 'stale';
}

export interface StalenessReport {
  totalChecked: number;
  markedStale: number;
  alreadyStale: number;
  neverValued: number;
  details: Array<{
    companyId: string;
    companyName: string;
    lastValuationDate: string | null;
    daysSinceValuation: number | null;
    status: 'marked_stale' | 'already_stale' | 'never_valued';
  }>;
}

export interface UnlistedHealthReport {
  staleValuations: Array<{
    companyId: string;
    companyName: string;
    lastValuationDate: string | null;
    daysSinceValuation: number | null;
    valuationStatus: string;
  }>;
  complianceFlagged: Array<{
    companyId: string;
    companyName: string;
    complianceStatus: string;
    blockReasons: unknown;
  }>;
  enrichmentFailures: Array<{
    companyId: string;
    companyName: string;
    enrichmentFailedAt: string;
  }>;
  summary: {
    totalStale: number;
    totalComplianceFlagged: number;
    totalEnrichmentFailed: number;
    reportGeneratedAt: string;
  };
}

class UnlistedValuationGovernanceService {
  /**
   * Add a new valuation entry (APPEND-ONLY — never updates existing rows).
   * Updates the parent company's valuation_status and last_valuation_date.
   */
  async addValuation(
    companyId: string,
    data: {
      valuationMethod: string;
      price: number;
      valuationDate: string;
      supportingDocumentUrl?: string;
      notes?: string;
      addedBy?: string;
    }
  ): Promise<ValuationAddResult> {
    const company = await db.query.unlistedCompanies.findFirst({
      where: eq(unlistedCompanies.id, companyId),
    });

    if (!company) {
      throw new Error(`Unlisted company not found: ${companyId}`);
    }

    const valDate = new Date(data.valuationDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - valDate.getTime()) / (1000 * 60 * 60 * 24));
    const isStale = daysDiff > STALE_THRESHOLD_DAYS;

    const [inserted] = await db
      .insert(unlistedEquityValuationHistory)
      .values({
        companyId,
        valuationMethod: data.valuationMethod,
        price: String(data.price),
        valuationDate: data.valuationDate,
        supportingDocumentUrl: data.supportingDocumentUrl ?? null,
        notes: data.notes ?? null,
        addedBy: data.addedBy ?? null,
      } as InsertUnlistedEquityValuationHistory)
      .returning({ id: unlistedEquityValuationHistory.id });

    await db
      .update(unlistedCompanies)
      .set({
        lastValuationDate: data.valuationDate,
        valuationStatus: isStale ? 'stale' : 'current',
        updatedAt: new Date(),
      })
      .where(eq(unlistedCompanies.id, companyId));

    await db.insert(unlistedAuditLog).values({
      companyId,
      actionType: 'valuation_added',
      actionBy: data.addedBy ?? 'system',
      previousValue: {
        valuationStatus: company.valuationStatus,
        lastValuationDate: company.lastValuationDate,
      },
      newValue: {
        valuationMethod: data.valuationMethod,
        price: data.price,
        valuationDate: data.valuationDate,
        newStatus: isStale ? 'stale' : 'current',
      },
      notes: `Valuation added via governance service. Method: ${data.valuationMethod}`,
    } as any);

    return {
      id: inserted.id,
      companyId,
      companyName: company.name,
      price: data.price,
      valuationMethod: data.valuationMethod,
      valuationDate: data.valuationDate,
      valuationStatus: isStale ? 'stale' : 'current',
    };
  }

  /**
   * Get full valuation history for a company (newest first).
   */
  async getValuationHistory(companyId: string) {
    const rows = await db
      .select()
      .from(unlistedEquityValuationHistory)
      .where(eq(unlistedEquityValuationHistory.companyId, companyId))
      .orderBy(sql`valuation_date DESC, created_at DESC`);

    return rows;
  }

  /**
   * Get the latest valuation for a company plus staleness metadata.
   */
  async getLatestValuation(companyId: string) {
    const [latest] = await db
      .select()
      .from(unlistedEquityValuationHistory)
      .where(eq(unlistedEquityValuationHistory.companyId, companyId))
      .orderBy(sql`valuation_date DESC`)
      .limit(1);

    if (!latest) return null;

    const today = new Date();
    const valDate = new Date(latest.valuationDate);
    const daysSince = Math.floor((today.getTime() - valDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...latest,
      daysSinceValuation: daysSince,
      isStale: daysSince > STALE_THRESHOLD_DAYS,
      stressedPrice: Number(latest.price) * (1 - STRESS_HAIRCUT_PERCENT / 100),
      stressHaircutPercent: STRESS_HAIRCUT_PERCENT,
    };
  }

  /**
   * Staleness sweep — runs on the quarterly cron.
   * Any company whose last_valuation_date is >90 days ago gets marked STALE.
   * Companies with no valuation at all are also flagged.
   */
  async runStalenessSweep(): Promise<StalenessReport> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const all = await db
      .select({
        id: unlistedCompanies.id,
        name: unlistedCompanies.name,
        lastValuationDate: unlistedCompanies.lastValuationDate,
        valuationStatus: unlistedCompanies.valuationStatus,
      })
      .from(unlistedCompanies)
      .where(
        or(
          isNull(unlistedCompanies.lastValuationDate),
          lt(unlistedCompanies.lastValuationDate, cutoffStr)
        )
      );

    const details: StalenessReport['details'] = [];
    let markedStale = 0;
    let alreadyStale = 0;
    let neverValued = 0;

    for (const company of all) {
      const lastDate = company.lastValuationDate ? new Date(company.lastValuationDate) : null;
      const daysSince = lastDate
        ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (!lastDate) {
        neverValued++;
        details.push({
          companyId: company.id,
          companyName: company.name,
          lastValuationDate: null,
          daysSinceValuation: null,
          status: 'never_valued',
        });
        if (company.valuationStatus !== 'stale') {
          await db
            .update(unlistedCompanies)
            .set({ valuationStatus: 'stale', updatedAt: new Date() })
            .where(eq(unlistedCompanies.id, company.id));
        }
      } else if (company.valuationStatus === 'stale') {
        alreadyStale++;
        details.push({
          companyId: company.id,
          companyName: company.name,
          lastValuationDate: company.lastValuationDate,
          daysSinceValuation: daysSince,
          status: 'already_stale',
        });
      } else {
        markedStale++;
        details.push({
          companyId: company.id,
          companyName: company.name,
          lastValuationDate: company.lastValuationDate,
          daysSinceValuation: daysSince,
          status: 'marked_stale',
        });
        await db
          .update(unlistedCompanies)
          .set({ valuationStatus: 'stale', updatedAt: new Date() })
          .where(eq(unlistedCompanies.id, company.id));

        await db.insert(unlistedAuditLog).values({
          companyId: company.id,
          actionType: 'valuation_staleness_flagged',
          actionBy: 'system_cron',
          previousValue: { valuationStatus: company.valuationStatus },
          newValue: { valuationStatus: 'stale', daysSinceValuation: daysSince },
          notes: `Valuation stale: ${daysSince} days since last entry (threshold: ${STALE_THRESHOLD_DAYS})`,
        } as any);
      }
    }

    console.log(`[UnlistedValuationGovernance] Staleness sweep: ${markedStale} newly stale, ${alreadyStale} already stale, ${neverValued} never valued`);

    return {
      totalChecked: all.length,
      markedStale,
      alreadyStale,
      neverValued,
      details,
    };
  }

  /**
   * Admin health report: stale valuations, compliance flagged, enrichment failures.
   */
  async getHealthReport(): Promise<UnlistedHealthReport> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const staleRows = await db
      .select({
        id: unlistedCompanies.id,
        name: unlistedCompanies.name,
        lastValuationDate: unlistedCompanies.lastValuationDate,
        valuationStatus: unlistedCompanies.valuationStatus,
      })
      .from(unlistedCompanies)
      .where(
        or(
          sql`valuation_status = 'stale'`,
          isNull(unlistedCompanies.lastValuationDate),
          lt(unlistedCompanies.lastValuationDate, cutoffStr)
        )
      );

    const complianceRows = await db
      .select({
        id: unlistedCompanies.id,
        name: unlistedCompanies.name,
        complianceStatus: unlistedCompanies.complianceStatus,
        complianceBlockReasons: unlistedCompanies.complianceBlockReasons,
      })
      .from(unlistedCompanies)
      .where(sql`compliance_status IN ('blocked', 'pending')`);

    const enrichmentRows = await db
      .select({
        id: unlistedCompanies.id,
        name: unlistedCompanies.name,
        enrichmentFailedAt: unlistedCompanies.enrichmentFailedAt,
      })
      .from(unlistedCompanies)
      .where(sql`enrichment_failed_at IS NOT NULL`);

    const today = new Date();

    return {
      staleValuations: staleRows.map((r) => {
        const lastDate = r.lastValuationDate ? new Date(r.lastValuationDate) : null;
        const daysSince = lastDate
          ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return {
          companyId: r.id,
          companyName: r.name,
          lastValuationDate: r.lastValuationDate,
          daysSinceValuation: daysSince,
          valuationStatus: r.valuationStatus ?? 'pending',
        };
      }),
      complianceFlagged: complianceRows.map((r) => ({
        companyId: r.id,
        companyName: r.name,
        complianceStatus: r.complianceStatus ?? 'pending',
        blockReasons: r.complianceBlockReasons,
      })),
      enrichmentFailures: enrichmentRows.map((r) => ({
        companyId: r.id,
        companyName: r.name,
        enrichmentFailedAt: r.enrichmentFailedAt
          ? r.enrichmentFailedAt.toISOString()
          : '',
      })),
      summary: {
        totalStale: staleRows.length,
        totalComplianceFlagged: complianceRows.length,
        totalEnrichmentFailed: enrichmentRows.length,
        reportGeneratedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Proposal engine helper: get unlisted-specific portfolio modifiers for an asset.
   * Always returns: liquidity_weight=0, rebalance_eligible=false, stress_haircut=40%
   */
  getProposalModifiers(companyId: string) {
    return {
      liquidityWeight: 0,
      rebalanceEligible: false,
      excludeFromAutoSell: true,
      includeInNetWorth: true,
      includeInAssetAllocationExposure: true,
      stressHaircutPercent: STRESS_HAIRCUT_PERCENT,
      riskCategory: 'very_high',
    };
  }
}

export const unlistedValuationGovernanceService = new UnlistedValuationGovernanceService();
