/**
 * Probe42 Advanced Analytics Service
 * 
 * Enhanced client scouting capabilities:
 * 1. Investable Surplus Detection - Identify companies with excess cash
 * 2. Smart Lead Scoring - Multi-factor scoring algorithm
 * 3. Director Network Mining - Relationship mapping
 * 4. Sector-Based Targeting - Industry benchmarks
 * 5. Geographic Analytics - Regional prospect density
 */

import { db } from '../db';
import { 
  prospectLeads, 
  clientIntelligence,
  companyFinancials,
  companyRatios,
  users
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte, ilike, or, isNotNull } from 'drizzle-orm';
// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface InvestableSurplusResult {
  companyId: string;
  companyName: string;
  cin: string;
  cashReserves: number;
  totalDebt: number;
  freeCashFlow: number;
  networth: number;
  debtToEquityRatio: number;
  investableSurplus: number;
  surplusCategory: 'high' | 'medium' | 'low' | 'none';
  investmentReadiness: number; // 0-100 score
  recommendations: string[];
}

export interface SmartLeadScore {
  companyId: string;
  companyName: string;
  cin: string;
  
  // Component Scores (0-100)
  financialHealthScore: number;
  growthScore: number;
  profitabilityScore: number;
  liquidityScore: number;
  governanceScore: number;
  sectorPremiumScore: number;
  
  // Final Score
  totalScore: number;
  leadGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  priority: 'hot' | 'warm' | 'cold';
  
  // Insights
  strengths: string[];
  concerns: string[];
  outreachStrategy: string;
}

export interface DirectorNetwork {
  directorName: string;
  din: string;
  companies: Array<{
    companyId: string;
    companyName: string;
    cin: string;
    designation: string;
    isExistingClient: boolean;
    leadScore?: number;
  }>;
  networkValue: number;
  referralPotential: 'high' | 'medium' | 'low';
  connectionPath?: string[];
}

export interface SectorBenchmark {
  sector: string;
  industry: string;
  companyCount: number;
  
  // Averages
  avgRevenue: number;
  avgProfit: number;
  avgMargin: number;
  avgROE: number;
  avgDebtEquity: number;
  
  // Top performers
  topPerformers: Array<{
    companyId: string;
    companyName: string;
    cin: string;
    revenue: number;
    leadScore: number;
  }>;
  
  // Market leaders
  marketLeaders: string[];
}

export interface GeographicHeatMap {
  regions: Array<{
    state: string;
    city?: string;
    prospectCount: number;
    totalRevenue: number;
    avgLeadScore: number;
    hotLeadsCount: number;
    penetrationRate: number;
    growthPotential: 'high' | 'medium' | 'low';
  }>;
  
  // National summary
  totalProspects: number;
  topStates: string[];
  underservedRegions: string[];
}

export interface ProspectingAlert {
  id: string;
  type: 'new_filing' | 'threshold_crossed' | 'growth_spike' | 'new_company' | 'director_move';
  companyId?: string;
  companyName?: string;
  cin?: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  data: any;
  createdAt: Date;
  acknowledged: boolean;
}

// ===================================================================
// SECTOR CONFIGURATION
// ===================================================================

const SECTOR_PREMIUMS: Record<string, number> = {
  'Information Technology': 15,
  'Software': 15,
  'Pharmaceuticals': 12,
  'Healthcare': 12,
  'Financial Services': 10,
  'Banking': 10,
  'FMCG': 8,
  'Consumer Goods': 8,
  'Manufacturing': 6,
  'Automobile': 6,
  'Infrastructure': 5,
  'Real Estate': 4,
  'Textiles': 3,
  'Agriculture': 2,
};

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat',
  'Telangana', 'West Bengal', 'Uttar Pradesh', 'Rajasthan', 'Kerala',
  'Madhya Pradesh', 'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar',
  'Odisha', 'Jharkhand', 'Assam', 'Chhattisgarh', 'Uttarakhand',
  'Himachal Pradesh', 'Goa', 'Tripura', 'Meghalaya', 'Manipur',
  'Nagaland', 'Arunachal Pradesh', 'Mizoram', 'Sikkim'
];

// ===================================================================
// PROBE42 ANALYTICS SERVICE CLASS
// ===================================================================

class Probe42AnalyticsService {
  private alerts: ProspectingAlert[] = [];

  constructor() {
    console.log('🔍 Credhive Analytics Service initialized');
  }

  // ===================================================================
  // 1. INVESTABLE SURPLUS DETECTION
  // ===================================================================

  /**
   * Calculate investable surplus for a company based on database financial data
   * Uses prospectLeads table which stores financial metrics
   */
  async calculateInvestableSurplus(cin: string): Promise<InvestableSurplusResult | null> {
    try {
      // Get company from database
      const [lead] = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.cin, cin))
        .limit(1);

      if (!lead) {
        console.log(`[Probe42 Analytics] Lead not found in database for CIN: ${cin}`);
        return null;
      }

      // Extract financial metrics from database
      const annualRevenue = parseFloat(String(lead.annualRevenue || '0'));
      const netProfit = parseFloat(String(lead.netProfit || '0'));
      const ebitda = parseFloat(String(lead.ebitda || '0'));
      const totalAssets = parseFloat(String(lead.totalAssets || '0'));
      const paidUpCapital = parseFloat(String(lead.paidUpCapital || '0'));
      const debtToEquityRatio = parseFloat(String(lead.debtToEquityRatio || '0'));
      const currentRatio = parseFloat(String(lead.currentRatio || '1'));
      const roe = parseFloat(String(lead.roe || '0'));
      const existingSurplus = parseFloat(String(lead.investableSurplus || '0'));

      // Calculate networth approximation (Total Assets / 2 as proxy)
      const networth = totalAssets > 0 ? totalAssets * 0.6 : paidUpCapital * 2;
      
      // Estimate cash reserves (EBITDA margin implies cash generation)
      const cashReserves = annualRevenue > 0 
        ? Math.max(0, netProfit * 1.5) // 1.5x net profit as cash proxy
        : paidUpCapital * 0.3;

      // Estimate free cash flow from EBITDA and profit
      const freeCashFlow = ebitda > 0 ? ebitda * 0.7 : netProfit * 0.8;

      // Calculate total debt from D/E ratio
      const totalDebt = debtToEquityRatio > 0 ? networth * debtToEquityRatio : 0;

      // Calculate investable surplus
      // Formula: Cash Reserves + FCF - Buffer (20% of revenue)
      const buffer = annualRevenue * 0.2;
      const investableSurplus = existingSurplus > 0 
        ? existingSurplus 
        : Math.max(0, cashReserves + freeCashFlow - buffer);

      // Categorize surplus
      let surplusCategory: 'high' | 'medium' | 'low' | 'none';
      if (investableSurplus > 100000000) surplusCategory = 'high'; // > 10 Cr
      else if (investableSurplus > 25000000) surplusCategory = 'medium'; // > 2.5 Cr
      else if (investableSurplus > 5000000) surplusCategory = 'low'; // > 50 Lakh
      else surplusCategory = 'none';

      // Calculate investment readiness score (0-100)
      let investmentReadiness = 0;
      
      // Low debt = more ready (25 points)
      if (debtToEquityRatio < 0.3) investmentReadiness += 25;
      else if (debtToEquityRatio < 0.5) investmentReadiness += 20;
      else if (debtToEquityRatio < 1) investmentReadiness += 10;

      // Positive profit = more ready (25 points)
      if (netProfit > 50000000) investmentReadiness += 25;
      else if (netProfit > 10000000) investmentReadiness += 20;
      else if (netProfit > 0) investmentReadiness += 10;

      // High surplus = more ready (25 points)
      if (surplusCategory === 'high') investmentReadiness += 25;
      else if (surplusCategory === 'medium') investmentReadiness += 15;
      else if (surplusCategory === 'low') investmentReadiness += 5;

      // Good ROE = more ready (25 points)
      if (roe > 20) investmentReadiness += 25;
      else if (roe > 15) investmentReadiness += 20;
      else if (roe > 10) investmentReadiness += 10;

      // Generate recommendations
      const recommendations: string[] = [];
      if (surplusCategory === 'high') {
        recommendations.push('High-value prospect for treasury management services');
        recommendations.push('Suitable for structured investment products');
      }
      if (debtToEquityRatio < 0.5) {
        recommendations.push('Low leverage - good candidate for wealth management');
      }
      if (netProfit > 0) {
        recommendations.push('Profitable company - explore SIP/mutual fund options');
      }
      if (currentRatio > 1.5) {
        recommendations.push('Strong liquidity - suitable for bond investments');
      }

      return {
        companyId: lead.id,
        companyName: lead.companyName,
        cin,
        cashReserves,
        totalDebt,
        freeCashFlow,
        networth,
        debtToEquityRatio,
        investableSurplus,
        surplusCategory,
        investmentReadiness,
        recommendations,
      };
    } catch (error) {
      console.error(`[Probe42 Analytics] Error calculating surplus for ${cin}:`, error);
      return null;
    }
  }

  /**
   * Find all companies with significant investable surplus
   */
  async findHighSurplusCompanies(
    minSurplus: number = 10000000, // 1 Cr default
    limit: number = 50
  ): Promise<InvestableSurplusResult[]> {
    try {
      // Get leads from database with financial data
      const leads = await db
        .select()
        .from(prospectLeads)
        .where(isNotNull(prospectLeads.cin))
        .limit(limit * 2); // Get extra to filter

      const results: InvestableSurplusResult[] = [];

      for (const lead of leads) {
        if (lead.cin) {
          const surplus = await this.calculateInvestableSurplus(lead.cin);
          if (surplus && surplus.investableSurplus >= minSurplus) {
            results.push(surplus);
          }
        }
        if (results.length >= limit) break;
      }

      // Sort by investable surplus descending
      return results.sort((a, b) => b.investableSurplus - a.investableSurplus);
    } catch (error) {
      console.error('[Probe42 Analytics] Error finding high surplus companies:', error);
      return [];
    }
  }

  // ===================================================================
  // 2. SMART LEAD SCORING ALGORITHM
  // ===================================================================

  /**
   * Calculate comprehensive lead score using database data
   */
  async calculateSmartLeadScore(cin: string): Promise<SmartLeadScore | null> {
    try {
      // Get company from database
      const [lead] = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.cin, cin))
        .limit(1);

      if (!lead) {
        console.log(`[Probe42 Analytics] Lead not found for scoring: ${cin}`);
        return null;
      }

      // Extract metrics from database
      const annualRevenue = parseFloat(String(lead.annualRevenue || '0'));
      const netProfit = parseFloat(String(lead.netProfit || '0'));
      const ebitda = parseFloat(String(lead.ebitda || '0'));
      const totalAssets = parseFloat(String(lead.totalAssets || '0'));
      const debtEquity = parseFloat(String(lead.debtToEquityRatio || '0'));
      const currentRatio = parseFloat(String(lead.currentRatio || '1'));
      const roe = parseFloat(String(lead.roe || '0'));
      const directors = (lead.directors as any[]) || [];
      const sector = lead.industrySegment || '';

      // 1. Financial Health Score (0-100)
      let financialHealthScore = 50;
      if (debtEquity < 0.3) financialHealthScore += 25;
      else if (debtEquity < 0.5) financialHealthScore += 15;
      else if (debtEquity < 1) financialHealthScore += 5;
      else if (debtEquity > 2) financialHealthScore -= 20;

      if (currentRatio > 2) financialHealthScore += 15;
      else if (currentRatio > 1.5) financialHealthScore += 10;
      else if (currentRatio < 1) financialHealthScore -= 15;

      financialHealthScore = Math.max(0, Math.min(100, financialHealthScore));

      // 2. Growth Score (0-100) - based on revenue size as proxy
      let growthScore = 50;
      if (annualRevenue > 500000000) growthScore += 30; // > 50 Cr
      else if (annualRevenue > 100000000) growthScore += 20; // > 10 Cr
      else if (annualRevenue > 10000000) growthScore += 10; // > 1 Cr
      else if (annualRevenue < 1000000) growthScore -= 15;

      // EBITDA positive is growth indicator
      if (ebitda > 0) growthScore += 15;
      else if (ebitda < 0) growthScore -= 10;

      growthScore = Math.max(0, Math.min(100, growthScore));

      // 3. Profitability Score (0-100)
      let profitabilityScore = 50;
      if (roe > 20) profitabilityScore += 25;
      else if (roe > 15) profitabilityScore += 15;
      else if (roe > 10) profitabilityScore += 5;
      else if (roe < 0) profitabilityScore -= 20;

      // Net profit margin calculation
      const patMargin = annualRevenue > 0 ? (netProfit / annualRevenue) * 100 : 0;
      if (patMargin > 15) profitabilityScore += 25;
      else if (patMargin > 10) profitabilityScore += 15;
      else if (patMargin > 5) profitabilityScore += 5;
      else if (patMargin < 0) profitabilityScore -= 20;

      profitabilityScore = Math.max(0, Math.min(100, profitabilityScore));

      // 4. Liquidity Score (0-100)
      let liquidityScore = 50;
      // Use EBITDA as proxy for cash flow
      if (ebitda > 50000000) liquidityScore += 30;
      else if (ebitda > 10000000) liquidityScore += 20;
      else if (ebitda > 0) liquidityScore += 10;
      else if (ebitda < -10000000) liquidityScore -= 20;

      // Current ratio as liquidity measure
      if (currentRatio > 1.5) liquidityScore += 20;
      else if (currentRatio > 1) liquidityScore += 10;
      else if (currentRatio < 0.5) liquidityScore -= 15;

      liquidityScore = Math.max(0, Math.min(100, liquidityScore));

      // 5. Governance Score (0-100)
      let governanceScore = 60;
      const directorCount = directors.length;
      if (directorCount >= 5) governanceScore += 20;
      else if (directorCount >= 3) governanceScore += 10;
      else if (directorCount < 2) governanceScore -= 20;

      // Active status bonus
      if (lead.status !== 'rejected' && lead.status !== 'on_hold') governanceScore += 20;

      governanceScore = Math.max(0, Math.min(100, governanceScore));

      // 6. Sector Premium Score (0-100)
      let sectorPremiumScore = 50;
      for (const [sectorName, premium] of Object.entries(SECTOR_PREMIUMS)) {
        if (sector.toLowerCase().includes(sectorName.toLowerCase())) {
          sectorPremiumScore += premium * 2;
          break;
        }
      }
      sectorPremiumScore = Math.max(0, Math.min(100, sectorPremiumScore));

      // Calculate Total Score (weighted average)
      const weights = {
        financialHealth: 0.20,
        growth: 0.20,
        profitability: 0.25,
        liquidity: 0.15,
        governance: 0.10,
        sectorPremium: 0.10,
      };

      const totalScore = Math.round(
        financialHealthScore * weights.financialHealth +
        growthScore * weights.growth +
        profitabilityScore * weights.profitability +
        liquidityScore * weights.liquidity +
        governanceScore * weights.governance +
        sectorPremiumScore * weights.sectorPremium
      );

      // Determine Grade
      let leadGrade: SmartLeadScore['leadGrade'];
      if (totalScore >= 85) leadGrade = 'A+';
      else if (totalScore >= 75) leadGrade = 'A';
      else if (totalScore >= 65) leadGrade = 'B+';
      else if (totalScore >= 55) leadGrade = 'B';
      else if (totalScore >= 40) leadGrade = 'C';
      else leadGrade = 'D';

      // Determine Priority
      let priority: SmartLeadScore['priority'];
      if (totalScore >= 70) priority = 'hot';
      else if (totalScore >= 50) priority = 'warm';
      else priority = 'cold';

      // Generate Insights
      const strengths: string[] = [];
      const concerns: string[] = [];

      if (financialHealthScore >= 70) strengths.push('Strong financial health');
      else if (financialHealthScore < 40) concerns.push('Weak financial position');

      if (growthScore >= 70) strengths.push('High growth trajectory');
      else if (growthScore < 40) concerns.push('Stagnant or declining growth');

      if (profitabilityScore >= 70) strengths.push('Excellent profitability');
      else if (profitabilityScore < 40) concerns.push('Low profitability margins');

      if (liquidityScore >= 70) strengths.push('Strong liquidity position');
      else if (liquidityScore < 40) concerns.push('Liquidity constraints');

      if (governanceScore >= 70) strengths.push('Good corporate governance');

      // Outreach Strategy
      let outreachStrategy = '';
      if (priority === 'hot') {
        outreachStrategy = 'Immediate outreach recommended. Schedule meeting within 48 hours.';
      } else if (priority === 'warm') {
        outreachStrategy = 'Add to nurture campaign. Follow up within 1 week.';
      } else {
        outreachStrategy = 'Low priority. Add to long-term prospecting list.';
      }

      return {
        companyId: lead.id,
        companyName: lead.companyName,
        cin,
        financialHealthScore,
        growthScore,
        profitabilityScore,
        liquidityScore,
        governanceScore,
        sectorPremiumScore,
        totalScore,
        leadGrade,
        priority,
        strengths,
        concerns,
        outreachStrategy,
      };
    } catch (error) {
      console.error(`[Probe42 Analytics] Error scoring lead ${cin}:`, error);
      return null;
    }
  }

  /**
   * Bulk score leads and return sorted by priority
   */
  async scoreLeadsBulk(cins: string[]): Promise<SmartLeadScore[]> {
    const scores: SmartLeadScore[] = [];
    
    for (const cin of cins) {
      const score = await this.calculateSmartLeadScore(cin);
      if (score) scores.push(score);
    }

    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  // ===================================================================
  // 3. DIRECTOR NETWORK MINING
  // ===================================================================

  /**
   * Build director network for relationship mapping
   */
  async buildDirectorNetwork(din: string): Promise<DirectorNetwork | null> {
    try {
      // Search for companies where this director is present
      // This would require iterating through known companies or using Probe42's director search
      
      const networkCompanies: DirectorNetwork['companies'] = [];
      
      // Get leads from database
      const leads = await db
        .select()
        .from(prospectLeads)
        .where(isNotNull(prospectLeads.directors));

      for (const lead of leads) {
        if (lead.directors) {
          const directors = typeof lead.directors === 'string' 
            ? JSON.parse(lead.directors) 
            : lead.directors;
          
          for (const director of directors) {
            if (director.din === din) {
              // Check if this company is an existing client
              const [existingClient] = await db
                .select()
                .from(users)
                .where(ilike(users.companyName, `%${lead.companyName}%`))
                .limit(1);

              networkCompanies.push({
                companyId: lead.id,
                companyName: lead.companyName,
                cin: lead.cin || '',
                designation: director.designation || 'Director',
                isExistingClient: !!existingClient,
                leadScore: lead.leadScore || undefined,
              });
            }
          }
        }
      }

      if (networkCompanies.length === 0) return null;

      // Find director name from first company
      const firstCompany = networkCompanies[0];
      let directorName = 'Unknown';
      
      const [lead] = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.id, firstCompany.companyId));
      
      if (lead?.directors) {
        const directors = typeof lead.directors === 'string' 
          ? JSON.parse(lead.directors) 
          : lead.directors;
        const director = directors.find((d: any) => d.din === din);
        if (director) directorName = director.name;
      }

      // Calculate network value
      const hasExistingClient = networkCompanies.some(c => c.isExistingClient);
      const avgLeadScore = networkCompanies.reduce((sum, c) => sum + (c.leadScore || 50), 0) / networkCompanies.length;
      
      let networkValue = networkCompanies.length * 10 + avgLeadScore;
      if (hasExistingClient) networkValue += 50;

      // Determine referral potential
      let referralPotential: DirectorNetwork['referralPotential'];
      if (hasExistingClient && networkCompanies.length > 2) referralPotential = 'high';
      else if (hasExistingClient || networkCompanies.length > 3) referralPotential = 'medium';
      else referralPotential = 'low';

      return {
        directorName,
        din,
        companies: networkCompanies,
        networkValue,
        referralPotential,
      };
    } catch (error) {
      console.error(`[Probe42 Analytics] Error building director network for ${din}:`, error);
      return null;
    }
  }

  /**
   * Find all directors with connections to existing clients
   */
  async findConnectedDirectors(): Promise<DirectorNetwork[]> {
    try {
      // Get all leads with directors
      const leads = await db
        .select()
        .from(prospectLeads)
        .where(isNotNull(prospectLeads.directors));

      const dinSet = new Set<string>();

      // Collect all unique DIns
      for (const lead of leads) {
        if (lead.directors) {
          const directors = typeof lead.directors === 'string' 
            ? JSON.parse(lead.directors) 
            : lead.directors;
          for (const director of directors) {
            if (director.din) dinSet.add(director.din);
          }
        }
      }

      // Build networks for each director
      const networks: DirectorNetwork[] = [];
      for (const din of dinSet) {
        const network = await this.buildDirectorNetwork(din);
        if (network && network.companies.length > 1) {
          networks.push(network);
        }
      }

      // Sort by network value
      return networks.sort((a, b) => b.networkValue - a.networkValue);
    } catch (error) {
      console.error('[Probe42 Analytics] Error finding connected directors:', error);
      return [];
    }
  }

  // ===================================================================
  // 4. SECTOR-BASED TARGETING
  // ===================================================================

  /**
   * Get sector benchmarks and top performers
   */
  async getSectorBenchmarks(sector: string): Promise<SectorBenchmark | null> {
    try {
      // Get all leads in this sector
      const leads = await db
        .select()
        .from(prospectLeads)
        .where(ilike(prospectLeads.industrySegment, `%${sector}%`));

      if (leads.length === 0) return null;

      // Calculate averages
      let totalRevenue = 0, totalProfit = 0, totalMargin = 0, totalROE = 0, totalDebtEquity = 0;
      let validRevenueCount = 0, validProfitCount = 0, validMarginCount = 0;
      let validROECount = 0, validDebtEquityCount = 0;

      const topPerformers: SectorBenchmark['topPerformers'] = [];

      for (const lead of leads) {
        const revenue = parseFloat(String(lead.annualRevenue || '0'));
        const profit = parseFloat(String(lead.netProfit || '0'));
        const roe = parseFloat(String(lead.roe || '0'));
        const debtEquity = parseFloat(String(lead.debtToEquityRatio || '0'));
        
        if (revenue > 0) {
          totalRevenue += revenue;
          validRevenueCount++;
          
          const margin = profit / revenue * 100;
          if (!isNaN(margin)) {
            totalMargin += margin;
            validMarginCount++;
          }
        }
        if (profit > 0) {
          totalProfit += profit;
          validProfitCount++;
        }
        if (roe > 0) {
          totalROE += roe;
          validROECount++;
        }
        if (debtEquity > 0) {
          totalDebtEquity += debtEquity;
          validDebtEquityCount++;
        }

        topPerformers.push({
          companyId: lead.id,
          companyName: lead.companyName,
          cin: lead.cin || '',
          revenue,
          leadScore: lead.leadScore || 50,
        });
      }

      // Sort and get top 10
      topPerformers.sort((a, b) => b.revenue - a.revenue);
      const top10 = topPerformers.slice(0, 10);

      // Market leaders (top 3 by revenue)
      const marketLeaders = top10.slice(0, 3).map(p => p.companyName);

      return {
        sector,
        industry: sector,
        companyCount: leads.length,
        avgRevenue: validRevenueCount > 0 ? totalRevenue / validRevenueCount : 0,
        avgProfit: validProfitCount > 0 ? totalProfit / validProfitCount : 0,
        avgMargin: validMarginCount > 0 ? totalMargin / validMarginCount : 0,
        avgROE: validROECount > 0 ? totalROE / validROECount : 0,
        avgDebtEquity: validDebtEquityCount > 0 ? totalDebtEquity / validDebtEquityCount : 0,
        topPerformers: top10,
        marketLeaders,
      };
    } catch (error) {
      console.error(`[Probe42 Analytics] Error getting sector benchmarks for ${sector}:`, error);
      return null;
    }
  }

  /**
   * Get all available sectors with prospect counts
   */
  async getAvailableSectors(): Promise<Array<{ sector: string; count: number; avgLeadScore: number }>> {
    try {
      const result = await db
        .select({
          sector: prospectLeads.industrySegment,
          count: sql<number>`count(*)::int`,
          avgLeadScore: sql<number>`avg(${prospectLeads.leadScore})::int`,
        })
        .from(prospectLeads)
        .where(isNotNull(prospectLeads.industrySegment))
        .groupBy(prospectLeads.industrySegment)
        .orderBy(desc(sql`count(*)`));

      return result.filter(r => r.sector).map(r => ({
        sector: r.sector || 'Unknown',
        count: r.count,
        avgLeadScore: r.avgLeadScore || 50,
      }));
    } catch (error) {
      console.error('[Probe42 Analytics] Error getting available sectors:', error);
      return [];
    }
  }

  // ===================================================================
  // 5. GEOGRAPHIC HEAT MAPS
  // ===================================================================

  /**
   * Generate geographic heat map data
   */
  async getGeographicHeatMap(): Promise<GeographicHeatMap> {
    try {
      // Get all leads grouped by state
      const stateData = await db
        .select({
          state: prospectLeads.state,
          prospectCount: sql<number>`count(*)::int`,
          totalRevenue: sql<number>`sum(cast(${prospectLeads.annualRevenue} as numeric))::numeric`,
          avgLeadScore: sql<number>`avg(${prospectLeads.leadScore})::int`,
          hotLeadsCount: sql<number>`count(*) filter (where ${prospectLeads.leadScore} >= 70)::int`,
        })
        .from(prospectLeads)
        .where(isNotNull(prospectLeads.state))
        .groupBy(prospectLeads.state)
        .orderBy(desc(sql`count(*)`));

      // Calculate penetration and growth potential
      const regions = stateData.map(s => {
        const avgScore = s.avgLeadScore || 50;
        const hotRatio = s.prospectCount > 0 ? (s.hotLeadsCount / s.prospectCount) : 0;
        
        let growthPotential: 'high' | 'medium' | 'low';
        if (s.prospectCount < 10 && avgScore > 60) growthPotential = 'high';
        else if (s.prospectCount < 50) growthPotential = 'medium';
        else growthPotential = 'low';

        return {
          state: s.state || 'Unknown',
          prospectCount: s.prospectCount,
          totalRevenue: Number(s.totalRevenue) || 0,
          avgLeadScore: avgScore,
          hotLeadsCount: s.hotLeadsCount,
          penetrationRate: hotRatio * 100,
          growthPotential,
        };
      });

      const totalProspects = regions.reduce((sum, r) => sum + r.prospectCount, 0);
      const topStates = regions.slice(0, 5).map(r => r.state);
      
      // Find underserved regions (low prospect count but potential)
      const underservedRegions = regions
        .filter(r => r.growthPotential === 'high')
        .slice(0, 5)
        .map(r => r.state);

      return {
        regions,
        totalProspects,
        topStates,
        underservedRegions,
      };
    } catch (error) {
      console.error('[Probe42 Analytics] Error generating heat map:', error);
      return {
        regions: [],
        totalProspects: 0,
        topStates: [],
        underservedRegions: [],
      };
    }
  }

  /**
   * Get prospects by city within a state
   */
  async getProspectsByCity(state: string): Promise<Array<{ city: string; count: number; avgScore: number }>> {
    try {
      const result = await db
        .select({
          city: prospectLeads.city,
          count: sql<number>`count(*)::int`,
          avgScore: sql<number>`avg(${prospectLeads.leadScore})::int`,
        })
        .from(prospectLeads)
        .where(and(
          ilike(prospectLeads.state, `%${state}%`),
          isNotNull(prospectLeads.city)
        ))
        .groupBy(prospectLeads.city)
        .orderBy(desc(sql`count(*)`));

      return result.map(r => ({
        city: r.city || 'Unknown',
        count: r.count,
        avgScore: r.avgScore || 50,
      }));
    } catch (error) {
      console.error(`[Probe42 Analytics] Error getting prospects by city for ${state}:`, error);
      return [];
    }
  }

  // ===================================================================
  // 6. AUTOMATED PROSPECTING ALERTS
  // ===================================================================

  /**
   * Check for new companies meeting threshold criteria
   */
  async checkProspectingThresholds(
    thresholds: {
      minRevenue?: number;
      minProfit?: number;
      minLeadScore?: number;
      sectors?: string[];
    }
  ): Promise<ProspectingAlert[]> {
    const alerts: ProspectingAlert[] = [];

    try {
      // Build conditions
      const conditions: any[] = [];
      
      if (thresholds.minRevenue) {
        conditions.push(gte(sql`cast(${prospectLeads.annualRevenue} as numeric)`, thresholds.minRevenue));
      }
      if (thresholds.minProfit) {
        conditions.push(gte(sql`cast(${prospectLeads.netProfit} as numeric)`, thresholds.minProfit));
      }
      if (thresholds.minLeadScore) {
        conditions.push(gte(prospectLeads.leadScore, thresholds.minLeadScore));
      }

      const matchingLeads = await db
        .select()
        .from(prospectLeads)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(prospectLeads.leadScore))
        .limit(20);

      for (const lead of matchingLeads) {
        alerts.push({
          id: `alert-${lead.id}-${Date.now()}`,
          type: 'threshold_crossed',
          companyId: lead.id,
          companyName: lead.companyName,
          cin: lead.cin || undefined,
          message: `${lead.companyName} matches prospecting criteria`,
          priority: (lead.leadScore || 0) >= 80 ? 'high' : (lead.leadScore || 0) >= 60 ? 'medium' : 'low',
          data: {
            revenue: lead.annualRevenue,
            profit: lead.netProfit,
            leadScore: lead.leadScore,
          },
          createdAt: new Date(),
          acknowledged: false,
        });
      }

      return alerts;
    } catch (error) {
      console.error('[Probe42 Analytics] Error checking thresholds:', error);
      return [];
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): ProspectingAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  // ===================================================================
  // ANALYTICS DASHBOARD SUMMARY
  // ===================================================================

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(): Promise<{
    totalProspects: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    avgLeadScore: number;
    topSectors: Array<{ sector: string; count: number }>;
    topStates: Array<{ state: string; count: number }>;
    recentAlerts: ProspectingAlert[];
    surplusCompaniesCount: number;
  }> {
    try {
      // Get lead counts
      const leadCounts = await db
        .select({
          total: sql<number>`count(*)::int`,
          hot: sql<number>`count(*) filter (where ${prospectLeads.leadScore} >= 70)::int`,
          warm: sql<number>`count(*) filter (where ${prospectLeads.leadScore} >= 50 and ${prospectLeads.leadScore} < 70)::int`,
          cold: sql<number>`count(*) filter (where ${prospectLeads.leadScore} < 50)::int`,
          avgScore: sql<number>`avg(${prospectLeads.leadScore})::int`,
        })
        .from(prospectLeads);

      const counts = leadCounts[0] || { total: 0, hot: 0, warm: 0, cold: 0, avgScore: 0 };

      // Get top sectors
      const topSectors = await this.getAvailableSectors();

      // Get heat map for top states
      const heatMap = await this.getGeographicHeatMap();

      return {
        totalProspects: counts.total,
        hotLeads: counts.hot,
        warmLeads: counts.warm,
        coldLeads: counts.cold,
        avgLeadScore: counts.avgScore || 50,
        topSectors: topSectors.slice(0, 5).map(s => ({ sector: s.sector, count: s.count })),
        topStates: heatMap.regions.slice(0, 5).map(r => ({ state: r.state, count: r.prospectCount })),
        recentAlerts: this.getActiveAlerts().slice(0, 10),
        surplusCompaniesCount: 0, // Would require calculation
      };
    } catch (error) {
      console.error('[Probe42 Analytics] Error getting analytics summary:', error);
      return {
        totalProspects: 0,
        hotLeads: 0,
        warmLeads: 0,
        coldLeads: 0,
        avgLeadScore: 0,
        topSectors: [],
        topStates: [],
        recentAlerts: [],
        surplusCompaniesCount: 0,
      };
    }
  }
}

// ===================================================================
// SINGLETON EXPORT
// ===================================================================

let analyticsServiceInstance: Probe42AnalyticsService | null = null;

export function getProbe42AnalyticsService(): Probe42AnalyticsService {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = new Probe42AnalyticsService();
  }
  return analyticsServiceInstance;
}

/** @alias getProbe42AnalyticsService */
export const getCredhiveAnalyticsService = getProbe42AnalyticsService;

export { Probe42AnalyticsService };
export type CredhiveAnalyticsService = Probe42AnalyticsService;
