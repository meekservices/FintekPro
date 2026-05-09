/**
 * MCA Enrichment Service
 *
 * Enriches unlisted companies with financial and corporate data via Credhive.
 * Stores results in companyFinancials and updates the unlistedCompanies record.
 */

import { credhiveService } from './credhive-service';

export async function enrichUnlistedCompanyWithMCAData(
  companyId: string,
  cin: string
): Promise<{
  success: boolean;
  enrichedData?: {
    financials: any[];
    charges: any;
    creditRatings: any;
    legalCases: any;
    directors: any[];
  };
  financialsStored?: number;
  message: string;
}> {
  try {
    console.log(`🔄 Enriching unlisted company ${companyId} (CIN: ${cin}) with Credhive data...`);

    const enrichment = await credhiveService.getFullEnrichment(cin);

    if (!enrichment.baseDetails) {
      return {
        success: false,
        message: 'Failed to fetch company data from Credhive',
      };
    }

    const directors = enrichment.directors || [];
    const financials = enrichment.financials || [];

    const { db } = await import('../db');
    const { companyFinancials, unlistedCompanies } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    let financialsStored = 0;

    for (const fin of financials) {
      const financialYear = fin.financial_year || 'Unknown';

      const [existing] = await db
        .select()
        .from(companyFinancials)
        .where(eq(companyFinancials.companyId, companyId))
        .limit(1);

      const financialData = {
        companyId,
        financialYear,
        revenue: fin.revenue?.toString() || null,
        ebitda: fin.ebitda?.toString() || null,
        pat: (fin.pat ?? fin.net_profit)?.toString() || null,
        netProfit: (fin.net_profit ?? fin.pat)?.toString() || null,
        pbt: fin.pbt?.toString() || null,
        totalAssets: fin.total_assets?.toString() || null,
        totalLiabilities: fin.total_liabilities?.toString() || null,
        networth: fin.networth?.toString() || null,
        totalDebt: fin.total_debt?.toString() || null,
        longTermDebt: fin.long_term_debt?.toString() || null,
        shortTermDebt: fin.short_term_debt?.toString() || null,
        shareCapital: fin.share_capital?.toString() || null,
        reserves: fin.reserves?.toString() || null,
        dataSource: 'credhive',
        verified: true,
        confidenceScore: '0.90',
        aiAllowed: true,
        executionAllowed: true,
      };

      if (existing) {
        await db
          .update(companyFinancials)
          .set({ ...financialData, updatedAt: new Date() })
          .where(eq(companyFinancials.id, existing.id));
      } else {
        await db.insert(companyFinancials).values(financialData);
      }
      financialsStored++;
    }

    await db
      .update(unlistedCompanies)
      .set({
        lastSyncedAt: new Date(),
        directors,
        identityConfidence: '0.90',
        identityStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(unlistedCompanies.id, companyId));

    console.log(`✅ Credhive enrichment complete for ${companyId}: ${financialsStored} financial records`);

    return {
      success: true,
      enrichedData: {
        financials,
        charges: enrichment.compliance?.charges_count ?? null,
        creditRatings: null,
        legalCases: null,
        directors,
      },
      financialsStored,
      message: `Successfully enriched with ${financialsStored} financial records`,
    };
  } catch (error: any) {
    console.error(`❌ Failed to enrich unlisted company ${companyId}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to enrich company data',
    };
  }
}
