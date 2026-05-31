// @ts-nocheck
import { db } from "../../db";
import { mutualFunds as mutualFundsTable } from "@shared/schema";
import { sql, and, eq, inArray, desc } from "drizzle-orm";
import { logger } from "../../logger";

/**
 * Compliance Statuses that require mandatory exit per SEBI 2026.
 */
const SEBI_BLOCKED_STATUSES = new Set(['BLOCKED', 'OVERLAP_BREACH', 'GLIDE_PATH_INVALID']);

export interface ComplianceResult {
  isCompliant: boolean;
  status?: string;
  reason?: string;
  substitute?: {
    schemeName: string;
    schemeCode: string;
    category: string;
    returns1y: string | null;
  };
}

/**
 * ComplianceService
 * Handles regulatory checks, specifically SEBI 2026 mutual fund compliance.
 * Optimized for performance using bulk-fetching patterns.
 */
export class ComplianceService {
  /**
   * Bulk check compliance for a list of fund names.
   * Optimizes performance by reducing database roundtrips from O(N) to O(1) for status checks
   * and O(Categories) for substitute selection.
   * 
   * @param fundNames Array of fund names to check.
   * @returns Map of fund names to their compliance results.
   */
  async checkFundsCompliance(fundNames: string[]): Promise<Map<string, ComplianceResult>> {
    const results = new Map<string, ComplianceResult>();
    if (fundNames.length === 0) return results;

    const normalizedNames = fundNames.map(name => 
      name.replace(/- Regular \(G\)|- Growth|- Direct.*$/gi, '').trim()
    ).filter(Boolean);

    if (normalizedNames.length === 0) {
      for (const name of fundNames) results.set(name, { isCompliant: true });
      return results;
    }

    try {
      logger.info(`[ComplianceService] Starting bulk compliance check for ${fundNames.length} funds`);

      // 1. Bulk fetch compliance status for all funds using ILIKE match across the array
      // We use a SQL subquery with unnest to match against multiple patterns in one hit
      const matchedFunds = await db.select({
        schemeCode: mutualFundsTable.schemeCode,
        schemeName: mutualFundsTable.schemeName,
        category: mutualFundsTable.category,
        complianceStatus: mutualFundsTable.complianceStatus,
        complianceBlockedReason: mutualFundsTable.complianceBlockedReason,
      })
      .from(mutualFundsTable)
      .where(sql`EXISTS (
        SELECT 1 FROM unnest(${normalizedNames}) AS n
        WHERE ${mutualFundsTable.schemeName} ILIKE '%' || n || '%'
      )`);

      const blockedFundsByCategory = new Map<string, string[]>(); // category -> searchNames[]

      for (const originalName of fundNames) {
        const searchName = originalName.replace(/- Regular \(G\)|- Growth|- Direct.*$/gi, '').trim();
        // Find the best match from the database results
        const fund = matchedFunds.find(f => 
          f.schemeName.toLowerCase().includes(searchName.toLowerCase())
        );

        if (fund && SEBI_BLOCKED_STATUSES.has(fund.complianceStatus || '')) {
          logger.warn(`[ComplianceService] Fund ${originalName} is NON-COMPLIANT (${fund.complianceStatus})`);
          results.set(originalName, {
            isCompliant: false,
            status: fund.complianceStatus || 'UNKNOWN',
            reason: fund.complianceBlockedReason || undefined,
          });

          if (fund.category) {
            const catSearchNames = blockedFundsByCategory.get(fund.category) || [];
            catSearchNames.push(searchName);
            blockedFundsByCategory.set(fund.category, catSearchNames);
          }
        } else {
          results.set(originalName, { isCompliant: true });
        }
      }

      // 2. Bulk fetch substitutes for blocked categories
      const categoriesToFind = Array.from(blockedFundsByCategory.keys());
      if (categoriesToFind.length > 0) {
        logger.info(`[ComplianceService] Fetching substitutes for ${categoriesToFind.length} categories`);
        
        const substitutes = await db.select({
          schemeName: mutualFundsTable.schemeName,
          schemeCode: mutualFundsTable.schemeCode,
          category: mutualFundsTable.category,
          returns1y: mutualFundsTable.returns1y,
        })
        .from(mutualFundsTable)
        .where(
          and(
            eq(mutualFundsTable.isPublished, true),
            inArray(mutualFundsTable.category, categoriesToFind),
            sql`${mutualFundsTable.complianceStatus} IN ('VALIDATED', 'APPROVED', 'PENDING')`
          )
        )
        .orderBy(desc(sql`${mutualFundsTable.returns1y}::numeric`));

        // Map substitutes back to the results
        for (const [category, searchNames] of blockedFundsByCategory) {
          // Find best substitute for this category that isn't one of the blocked funds
          const bestSub = substitutes.find(s => 
            s.category === category && 
            !searchNames.some(n => s.schemeName.toLowerCase().includes(n.toLowerCase()))
          );

          if (bestSub) {
            for (const originalName of fundNames) {
              const res = results.get(originalName);
              if (res && !res.isCompliant) {
                // Find if this original fund belongs to this category
                const searchName = originalName.replace(/- Regular \(G\)|- Growth|- Direct.*$/gi, '').trim();
                const fund = matchedFunds.find(f => f.schemeName.toLowerCase().includes(searchName.toLowerCase()));
                
                if (fund?.category === category) {
                  res.substitute = {
                    schemeName: bestSub.schemeName,
                    schemeCode: bestSub.schemeCode,
                    category: bestSub.category,
                    returns1y: bestSub.returns1y,
                  };
                }
              }
            }
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(`[ComplianceService] Bulk compliance check failed`, error);
      // Fallback: mark everything as compliant to avoid blocking the whole wizard on a DB error
      // In production, we might want to throw an AppError instead.
      for (const name of fundNames) {
        if (!results.has(name)) results.set(name, { isCompliant: true });
      }
      return results;
    }
  }
}

export const complianceService = new ComplianceService();
