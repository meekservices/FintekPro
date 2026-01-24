/**
 * Exit Load Seed Service
 * Seeds mf_scheme_exit_loads table with actual fund-wise exit load data
 * Data sourced from major AMC factsheets and SEBI disclosures
 */

import { db } from "../db";
import { mfSchemeExitLoads, mutualFunds } from "@shared/schema";
import { eq, sql, inArray } from "drizzle-orm";

interface ExitLoadSeedData {
  schemeCode: string;
  isin?: string;
  tiers: Array<{
    tier: number;
    minDays: number;
    maxDays: number | null;
    exitLoadPercent: number;
    description: string;
  }>;
  sourceUrl?: string;
}

// Exit load data for popular funds from major AMCs
// Data as per AMC factsheets (January 2024)
const POPULAR_FUND_EXIT_LOADS: ExitLoadSeedData[] = [
  // HDFC AMC
  { schemeCode: "119551", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.hdfcfund.com" },
  { schemeCode: "119552", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  { schemeCode: "118989", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // ICICI Prudential AMC
  { schemeCode: "120503", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.icicipruamc.com" },
  { schemeCode: "120505", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // SBI AMC
  { schemeCode: "119598", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.sbimf.com" },
  { schemeCode: "119601", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Axis AMC
  { schemeCode: "120465", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.axismf.com" },
  { schemeCode: "120480", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  { schemeCode: "120716", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Kotak AMC
  { schemeCode: "120587", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.kotakmf.com" },
  { schemeCode: "120193", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Nippon India AMC (formerly Reliance)
  { schemeCode: "118778", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.nipponindiamf.com" },
  { schemeCode: "118834", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Aditya Birla Sun Life AMC
  { schemeCode: "119566", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.adityabirlacapital.com" },
  { schemeCode: "119569", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // DSP AMC
  { schemeCode: "119230", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.dspim.com" },
  { schemeCode: "119242", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Mirae Asset AMC
  { schemeCode: "118825", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.miraeassetmf.co.in" },
  { schemeCode: "145552", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Parag Parikh (PPFAS) - Unique 2-tier exit load
  { schemeCode: "122639", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 2.0, description: "2% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: 730, exitLoadPercent: 1.0, description: "1% if redeemed between 1-2 years" },
    { tier: 3, minDays: 731, maxDays: null, exitLoadPercent: 0, description: "Nil after 2 years" }
  ], sourceUrl: "https://www.amc.ppfas.com" },
  { schemeCode: "122640", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 2.0, description: "2% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: 730, exitLoadPercent: 1.0, description: "1% if redeemed between 1-2 years" },
    { tier: 3, minDays: 731, maxDays: null, exitLoadPercent: 0, description: "Nil after 2 years" }
  ] },
  
  // Quant AMC
  { schemeCode: "120828", tiers: [
    { tier: 1, minDays: 0, maxDays: 15, exitLoadPercent: 0.5, description: "0.5% if redeemed within 15 days" },
    { tier: 2, minDays: 16, maxDays: null, exitLoadPercent: 0, description: "Nil after 15 days" }
  ], sourceUrl: "https://www.quantmutual.com" },
  { schemeCode: "120829", tiers: [
    { tier: 1, minDays: 0, maxDays: 15, exitLoadPercent: 0.5, description: "0.5% if redeemed within 15 days" },
    { tier: 2, minDays: 16, maxDays: null, exitLoadPercent: 0, description: "Nil after 15 days" }
  ] },
  
  // Motilal Oswal AMC
  { schemeCode: "127042", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.motilaloswalmf.com" },
  
  // Canara Robeco AMC
  { schemeCode: "118607", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.canararobeco.com" },
  
  // Tata AMC
  { schemeCode: "118998", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.tatamutualfund.com" },
  
  // UTI AMC
  { schemeCode: "120689", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.utimf.com" },
  
  // Franklin Templeton AMC
  { schemeCode: "100033", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ], sourceUrl: "https://www.franklintempletonindia.com" },
  { schemeCode: "102885", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  { schemeCode: "101306", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // ELSS Funds - No exit load but 3-year lock-in
  { schemeCode: "120847", tiers: [
    { tier: 1, minDays: 0, maxDays: 1095, exitLoadPercent: 0, description: "Lock-in period: Cannot redeem for 3 years" },
    { tier: 2, minDays: 1096, maxDays: null, exitLoadPercent: 0, description: "Nil after 3 years" }
  ] },
  { schemeCode: "120848", tiers: [
    { tier: 1, minDays: 0, maxDays: 1095, exitLoadPercent: 0, description: "Lock-in period: Cannot redeem for 3 years" },
    { tier: 2, minDays: 1096, maxDays: null, exitLoadPercent: 0, description: "Nil after 3 years" }
  ] },
  
  // Liquid Funds - Graded exit load
  { schemeCode: "119062", tiers: [
    { tier: 1, minDays: 0, maxDays: 1, exitLoadPercent: 0.0070, description: "0.0070% for Day 1" },
    { tier: 2, minDays: 2, maxDays: 2, exitLoadPercent: 0.0065, description: "0.0065% for Day 2" },
    { tier: 3, minDays: 3, maxDays: 3, exitLoadPercent: 0.0060, description: "0.0060% for Day 3" },
    { tier: 4, minDays: 4, maxDays: 4, exitLoadPercent: 0.0055, description: "0.0055% for Day 4" },
    { tier: 5, minDays: 5, maxDays: 5, exitLoadPercent: 0.0050, description: "0.0050% for Day 5" },
    { tier: 6, minDays: 6, maxDays: 6, exitLoadPercent: 0.0045, description: "0.0045% for Day 6" },
    { tier: 7, minDays: 7, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ] },
  { schemeCode: "119063", tiers: [
    { tier: 1, minDays: 0, maxDays: 1, exitLoadPercent: 0.0070, description: "0.0070% for Day 1" },
    { tier: 2, minDays: 2, maxDays: 2, exitLoadPercent: 0.0065, description: "0.0065% for Day 2" },
    { tier: 3, minDays: 3, maxDays: 3, exitLoadPercent: 0.0060, description: "0.0060% for Day 3" },
    { tier: 4, minDays: 4, maxDays: 4, exitLoadPercent: 0.0055, description: "0.0055% for Day 4" },
    { tier: 5, minDays: 5, maxDays: 5, exitLoadPercent: 0.0050, description: "0.0050% for Day 5" },
    { tier: 6, minDays: 6, maxDays: 6, exitLoadPercent: 0.0045, description: "0.0045% for Day 6" },
    { tier: 7, minDays: 7, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ] },
  
  // Overnight Funds - No exit load
  { schemeCode: "145808", tiers: [
    { tier: 1, minDays: 0, maxDays: null, exitLoadPercent: 0, description: "Nil exit load" }
  ] },
  { schemeCode: "145809", tiers: [
    { tier: 1, minDays: 0, maxDays: null, exitLoadPercent: 0, description: "Nil exit load" }
  ] },
  
  // Index Funds - Lower exit load
  { schemeCode: "120684", tiers: [
    { tier: 1, minDays: 0, maxDays: 7, exitLoadPercent: 0.25, description: "0.25% if redeemed within 7 days" },
    { tier: 2, minDays: 8, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ] },
  { schemeCode: "135803", tiers: [
    { tier: 1, minDays: 0, maxDays: 7, exitLoadPercent: 0.25, description: "0.25% if redeemed within 7 days" },
    { tier: 2, minDays: 8, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ] },
  
  // Small Cap Funds
  { schemeCode: "125307", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  { schemeCode: "125497", tiers: [
    { tier: 1, minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { tier: 2, minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ] },
  
  // Banking & PSU Funds - Lower exit load
  { schemeCode: "119533", tiers: [
    { tier: 1, minDays: 0, maxDays: 30, exitLoadPercent: 0.25, description: "0.25% if redeemed within 30 days" },
    { tier: 2, minDays: 31, maxDays: null, exitLoadPercent: 0, description: "Nil after 30 days" }
  ] },
  { schemeCode: "119534", tiers: [
    { tier: 1, minDays: 0, maxDays: 30, exitLoadPercent: 0.25, description: "0.25% if redeemed within 30 days" },
    { tier: 2, minDays: 31, maxDays: null, exitLoadPercent: 0, description: "Nil after 30 days" }
  ] },
];

class ExitLoadSeedService {
  /**
   * Seed exit load data for popular funds
   */
  async seedExitLoadData(): Promise<{ seeded: number; skipped: number; errors: number }> {
    let seeded = 0;
    let skipped = 0;
    let errors = 0;

    console.log('[ExitLoadSeed] Starting to seed exit load data...');

    for (const fund of POPULAR_FUND_EXIT_LOADS) {
      try {
        // Check if already exists
        const existing = await db.select({ count: sql<number>`count(*)` })
          .from(mfSchemeExitLoads)
          .where(eq(mfSchemeExitLoads.schemeCode, fund.schemeCode));

        if (Number(existing[0]?.count) > 0) {
          skipped++;
          continue;
        }

        // Use ISIN from seed data if provided (mutualFunds table doesn't have ISIN)
        const isin = fund.isin || undefined;

        // Insert all tiers
        for (const tier of fund.tiers) {
          await db.insert(mfSchemeExitLoads).values({
            schemeCode: fund.schemeCode,
            isin: isin,
            tier: tier.tier,
            minDays: tier.minDays,
            maxDays: tier.maxDays,
            exitLoadPercent: tier.exitLoadPercent.toString(),
            description: tier.description,
            sourceUrl: fund.sourceUrl,
            lastVerified: new Date()
          });
        }

        seeded++;
      } catch (error) {
        console.error(`[ExitLoadSeed] Error seeding fund ${fund.schemeCode}:`, error);
        errors++;
      }
    }

    console.log(`[ExitLoadSeed] Completed: ${seeded} seeded, ${skipped} skipped, ${errors} errors`);
    return { seeded, skipped, errors };
  }

  /**
   * Update exit load data for a specific fund
   */
  async updateFundExitLoad(schemeCode: string, tiers: ExitLoadSeedData['tiers']): Promise<boolean> {
    try {
      // Delete existing tiers
      await db.delete(mfSchemeExitLoads)
        .where(eq(mfSchemeExitLoads.schemeCode, schemeCode));

      // Get ISIN
      const [mf] = await db.select({ isin: mutualFunds.isin })
        .from(mutualFunds)
        .where(eq(mutualFunds.schemeCode, schemeCode))
        .limit(1);

      // Insert new tiers
      for (const tier of tiers) {
        await db.insert(mfSchemeExitLoads).values({
          schemeCode,
          isin: mf?.isin,
          tier: tier.tier,
          minDays: tier.minDays,
          maxDays: tier.maxDays,
          exitLoadPercent: tier.exitLoadPercent.toString(),
          description: tier.description,
          lastVerified: new Date()
        });
      }

      return true;
    } catch (error) {
      console.error(`[ExitLoadSeed] Error updating fund ${schemeCode}:`, error);
      return false;
    }
  }

  /**
   * Bulk update exit loads from external source
   */
  async bulkUpdateFromSource(updates: Array<{
    schemeCode: string;
    exitLoadPercent: number;
    exitLoadDays: number;
    description?: string;
  }>): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    for (const update of updates) {
      try {
        const tiers = [
          { tier: 1, minDays: 0, maxDays: update.exitLoadDays, exitLoadPercent: update.exitLoadPercent, description: update.description || `${update.exitLoadPercent}% if redeemed within ${update.exitLoadDays} days` },
          { tier: 2, minDays: update.exitLoadDays + 1, maxDays: null, exitLoadPercent: 0, description: `Nil after ${update.exitLoadDays} days` }
        ];
        
        const success = await this.updateFundExitLoad(update.schemeCode, tiers);
        if (success) updated++;
        else errors++;
      } catch (error) {
        errors++;
      }
    }

    return { updated, errors };
  }

  /**
   * Get list of funds without exit load data
   */
  async getFundsWithoutExitLoadData(limit: number = 100): Promise<string[]> {
    const fundsWithExitLoad = db.select({ schemeCode: mfSchemeExitLoads.schemeCode })
      .from(mfSchemeExitLoads);

    const fundsWithoutExitLoad = await db.select({ schemeCode: mutualFunds.schemeCode })
      .from(mutualFunds)
      .where(sql`${mutualFunds.schemeCode} NOT IN (SELECT scheme_code FROM mf_scheme_exit_loads)`)
      .limit(limit);

    return fundsWithoutExitLoad.map(f => f.schemeCode);
  }

  /**
   * Get seeding statistics
   */
  async getStats(): Promise<{
    totalFunds: number;
    fundsWithExitLoad: number;
    coveragePercent: number;
    totalTiers: number;
  }> {
    const [fundStats] = await db.select({ count: sql<number>`count(*)` }).from(mutualFunds);
    const [exitLoadStats] = await db.select({
      uniqueFunds: sql<number>`count(distinct scheme_code)`,
      totalTiers: sql<number>`count(*)`
    }).from(mfSchemeExitLoads);

    const totalFunds = Number(fundStats?.count || 0);
    const fundsWithExitLoad = Number(exitLoadStats?.uniqueFunds || 0);

    return {
      totalFunds,
      fundsWithExitLoad,
      coveragePercent: totalFunds > 0 ? Math.round((fundsWithExitLoad / totalFunds) * 100 * 100) / 100 : 0,
      totalTiers: Number(exitLoadStats?.totalTiers || 0)
    };
  }
}

export const exitLoadSeedService = new ExitLoadSeedService();
