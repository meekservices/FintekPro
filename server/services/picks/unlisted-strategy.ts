import { db } from "../../db";
import { unlistedCompanies, companyRatios, companyFinancials } from "@shared/schema";
import { eq, desc, and, ne, or, isNull } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory, ScoreBreakdown } from "../pick-of-the-day-service";

export class UnlistedStrategy extends BaseStrategy {
  category: PickCategory = 'unlisted';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Bug fix: exclude companies that have since listed on NSE/BSE.
      // `status='inactive'` or `listingStage='listed'` are set by the
      // UnlistedListingTracker when a company completes its IPO.
      const companies = await db
        .select()
        .from(unlistedCompanies)
        .where(
          and(
            eq(unlistedCompanies.status, 'active'),
            or(
              isNull(unlistedCompanies.listingStage),
              ne(unlistedCompanies.listingStage, 'listed')
            )
          )
        )
        .limit(50);

      if (companies.length === 0) return null;

      const freshCompanies = this.filterRecentPicks(companies, context.recentIds, c => c.id.toString());

      const scoredCompaniesRaw = await Promise.all(
        freshCompanies.map(async company => {
          const ratios = await db.select().from(companyRatios)
            .where(eq(companyRatios.companyId, company.id))
            .orderBy(desc(companyRatios.financialYear)).limit(1);
          const financials = await db.select().from(companyFinancials)
            .where(eq(companyFinancials.companyId, company.id))
            .orderBy(desc(companyFinancials.financialYear)).limit(1);

          return {
            company,
            scoringBreakdown: this.scoreUnlistedWithRatios(company, ratios[0], financials[0]),
          };
        })
      );

      const scoredCompanies = scoredCompaniesRaw.sort((a, b) => b.scoringBreakdown.totalScore - a.scoringBreakdown.totalScore);
      if (scoredCompanies.length === 0) return null;
      
      const top = scoredCompanies[0];
      const company = top.company;
      const breakdown = top.scoringBreakdown;

      const currentPrice = parseFloat(company.publishedBuyPrice || company.draftBuyPrice || "0");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('unlisted');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await context.service.generateRationale({
        category: 'unlisted',
        name: company.name,
        currentPrice,
        targetPrice,
        stoplossPrice,
        metrics: {
          listingStage: company.listingStage,
          sector: company.sector,
          score: breakdown.totalScore
        }
      });

      return {
        category: 'unlisted',
        instrumentId: company.id,
        instrumentName: company.name,
        isin: company.isin || undefined,
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale,
        riskLevel: breakdown.totalScore > 60 ? 'medium' : 'high',
        suitableFor: ['Aggressive'],
        timeHorizon: this.getTimeHorizon('unlisted'),
        confidenceScore: this.getConfidenceScore('unlisted', breakdown.totalScore, 80),
        sectorCategory: company.sector || undefined,
        scoringBreakdown: breakdown,
        keyMetrics: {
          listingStage: company.listingStage || undefined,
          sector: company.sector || undefined,
          identityConfidence: company.identityConfidence || undefined,
          complianceStatus: company.complianceStatus || undefined,
          score: breakdown.totalScore,
        },
      };
    } catch (error) {
      console.error("[UnlistedStrategy] Error:", error);
      return null;
    }
  }

  score(instrument: any): number {
    return 50; 
  }

  private scoreUnlistedWithRatios(company: any, ratios: any, financials: any): ScoreBreakdown {
    let listingStageScore = 0;
    if (company.listingStage === 'unlisted') listingStageScore = 10;
    else if (company.listingStage === 'pre_ipo') listingStageScore = 8;
    else listingStageScore = 5;

    let pricingScore = 0;
    if (company.publishedBuyPrice && parseFloat(company.publishedBuyPrice) > 0) pricingScore = 10;
    else if (company.draftBuyPrice && parseFloat(company.draftBuyPrice) > 0) pricingScore = 5;

    let sectorScore = 0;
    const sector = (company.sector || '').toLowerCase();
    if (sector.includes('tech') || sector.includes('fintech')) sectorScore = 12;
    else if (sector.includes('banking')) sectorScore = 8;
    else sectorScore = 5;

    let governanceScore = 0;
    if (parseFloat(company.identityConfidence || "0") >= 0.9) governanceScore += 8;
    if (company.complianceStatus === 'cleared') governanceScore += 5;

    let fundamentalsScore = 0;
    const roe = ratios?.roe != null ? parseFloat(ratios.roe) : null;
    if (roe != null && roe > 20) fundamentalsScore += 20;
    else if (roe != null && roe > 10) fundamentalsScore += 10;

    const totalScore = listingStageScore + pricingScore + sectorScore + governanceScore + fundamentalsScore;

    return {
      listingStageScore,
      pricingScore,
      sectorScore,
      governanceScore,
      riskAdjustment: 0,
      fundamentalsScore,
      totalScore,
      scoringVersion: "2.5",
      threshold: 40,
      riskBand: 'Moderate',
    };
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ publishedBuyPrice: unlistedCompanies.publishedBuyPrice })
      .from(unlistedCompanies).where(eq(unlistedCompanies.id, instrumentId)).limit(1);
    return row[0]?.publishedBuyPrice ? parseFloat(row[0].publishedBuyPrice) : null;
  }
}
