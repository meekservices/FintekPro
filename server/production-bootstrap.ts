import { db } from './db';
import { sql } from 'drizzle-orm';
import {
  marketIndices,
  platformFeatureFlags,
  commodities,
  reits,
  invits,
  quantGovernancePolicy,
} from '@shared/schema';
import sebiCategoryEngine from './services/mf-sebi-category-engine';

const NSE_INDICES = [
  { indexCode: 'NIFTY50', indexName: 'NIFTY 50', provider: 'NSE', description: 'Top 50 companies by market cap on NSE' },
  { indexCode: 'NIFTY_NEXT50', indexName: 'NIFTY Next 50', provider: 'NSE', description: 'Next 50 companies after NIFTY 50' },
  { indexCode: 'NIFTY100', indexName: 'NIFTY 100', provider: 'NSE', description: 'Top 100 companies on NSE' },
  { indexCode: 'NIFTY200', indexName: 'NIFTY 200', provider: 'NSE', description: 'Top 200 companies on NSE' },
  { indexCode: 'NIFTY_MIDCAP_50', indexName: 'NIFTY Midcap 50', provider: 'NSE', description: 'Top 50 mid-cap companies on NSE' },
  { indexCode: 'NIFTY_MIDCAP_100', indexName: 'NIFTY Midcap 100', provider: 'NSE', description: 'Top 100 mid-cap companies on NSE' },
  { indexCode: 'NIFTY_MIDCAP_150', indexName: 'NIFTY Midcap 150', provider: 'NSE', description: 'Top 150 mid-cap companies on NSE' },
  { indexCode: 'NIFTY_SMALLCAP_50', indexName: 'NIFTY Smallcap 50', provider: 'NSE', description: 'Top 50 small-cap companies on NSE' },
  { indexCode: 'NIFTY_SMALLCAP_100', indexName: 'NIFTY Smallcap 100', provider: 'NSE', description: 'Top 100 small-cap companies on NSE' },
  { indexCode: 'NIFTY_SMALLCAP_250', indexName: 'NIFTY Smallcap 250', provider: 'NSE', description: 'Top 250 small-cap companies on NSE' },
  { indexCode: 'NIFTY500', indexName: 'NIFTY 500', provider: 'NSE', description: 'Top 500 companies on NSE' },
  { indexCode: 'NIFTY_BANK', indexName: 'NIFTY Bank', provider: 'NSE', description: 'Banking sector index' },
  { indexCode: 'NIFTY_IT', indexName: 'NIFTY IT', provider: 'NSE', description: 'IT sector index' },
  { indexCode: 'NIFTY_PHARMA', indexName: 'NIFTY Pharma', provider: 'NSE', description: 'Pharma sector index' },
  { indexCode: 'NIFTY_AUTO', indexName: 'NIFTY Auto', provider: 'NSE', description: 'Auto sector index' },
  { indexCode: 'NIFTY_FMCG', indexName: 'NIFTY FMCG', provider: 'NSE', description: 'FMCG sector index' },
  { indexCode: 'NIFTY_METAL', indexName: 'NIFTY Metal', provider: 'NSE', description: 'Metal sector index' },
  { indexCode: 'NIFTY_REALTY', indexName: 'NIFTY Realty', provider: 'NSE', description: 'Realty sector index' },
  { indexCode: 'NIFTY_ENERGY', indexName: 'NIFTY Energy', provider: 'NSE', description: 'Energy sector index' },
  { indexCode: 'NIFTY_INFRA', indexName: 'NIFTY Infrastructure', provider: 'NSE', description: 'Infrastructure sector index' },
  { indexCode: 'NIFTY_PSE', indexName: 'NIFTY PSE', provider: 'NSE', description: 'Public Sector Enterprises index' },
  { indexCode: 'NIFTY_MEDIA', indexName: 'NIFTY Media', provider: 'NSE', description: 'Media sector index' },
  { indexCode: 'NIFTY_PRIVATE_BANK', indexName: 'NIFTY Private Bank', provider: 'NSE', description: 'Private Banking sector index' },
  { indexCode: 'NIFTY_PSU_BANK', indexName: 'NIFTY PSU Bank', provider: 'NSE', description: 'PSU Banking sector index' },
  { indexCode: 'NIFTY_FIN_SERVICE', indexName: 'NIFTY Financial Services', provider: 'NSE', description: 'Financial Services sector index' },
  { indexCode: 'NIFTY_CONSUMPTION', indexName: 'NIFTY India Consumption', provider: 'NSE', description: 'India Consumption thematic index' },
  { indexCode: 'NIFTY_CPSE', indexName: 'NIFTY CPSE', provider: 'NSE', description: 'Central Public Sector Enterprises index' },
  { indexCode: 'NIFTY_GROWSECT15', indexName: 'NIFTY Growth Sectors 15', provider: 'NSE', description: 'Top 15 growth sector companies' },
  { indexCode: 'NIFTY_COMMODITIES', indexName: 'NIFTY Commodities', provider: 'NSE', description: 'Commodities thematic index' },
  { indexCode: 'NIFTY_MICROCAP250', indexName: 'NIFTY Microcap 250', provider: 'NSE', description: 'Top 250 micro-cap companies on NSE' },
  { indexCode: 'NIFTY_TOTAL_MKT', indexName: 'NIFTY Total Market', provider: 'NSE', description: 'Total market index covering all listed companies' },
  { indexCode: 'NIFTY_HEALTHCARE', indexName: 'NIFTY Healthcare', provider: 'NSE', description: 'Healthcare sector index' },
  { indexCode: 'NIFTY_ALPHA50', indexName: 'NIFTY Alpha 50', provider: 'NSE', description: 'Top 50 high-alpha stocks' },
  { indexCode: 'NIFTY_DIVIDEND_OPP50', indexName: 'NIFTY Dividend Opportunities 50', provider: 'NSE', description: 'Top 50 dividend-paying stocks' },
  { indexCode: 'NIFTY_MNC', indexName: 'NIFTY MNC', provider: 'NSE', description: 'Multinational Companies index' },
];

const BSE_INDICES = [
  { indexCode: 'SENSEX', indexName: 'S&P BSE Sensex', provider: 'BSE', description: 'Top 30 companies on BSE' },
  { indexCode: 'BSE100', indexName: 'S&P BSE 100', provider: 'BSE', description: 'Top 100 companies on BSE' },
  { indexCode: 'BSE200', indexName: 'S&P BSE 200', provider: 'BSE', description: 'Top 200 companies on BSE' },
  { indexCode: 'BSE500', indexName: 'S&P BSE 500', provider: 'BSE', description: 'Top 500 companies on BSE' },
  { indexCode: 'BSE_MIDCAP', indexName: 'S&P BSE MidCap', provider: 'BSE', description: 'Mid-cap companies on BSE' },
  { indexCode: 'BSE_SMALLCAP', indexName: 'S&P BSE SmallCap', provider: 'BSE', description: 'Small-cap companies on BSE' },
  { indexCode: 'BSE_LARGEMID', indexName: 'S&P BSE LargeMidCap', provider: 'BSE', description: 'Large and mid-cap companies on BSE' },
  { indexCode: 'BSE_BANKEX', indexName: 'S&P BSE BANKEX', provider: 'BSE', description: 'Banking sector index on BSE' },
  { indexCode: 'BSE_IT', indexName: 'S&P BSE IT', provider: 'BSE', description: 'IT sector index on BSE' },
  { indexCode: 'BSE_HEALTHCARE', indexName: 'S&P BSE Healthcare', provider: 'BSE', description: 'Healthcare sector index on BSE' },
  { indexCode: 'BSE_AUTO', indexName: 'S&P BSE Auto', provider: 'BSE', description: 'Auto sector index on BSE' },
  { indexCode: 'BSE_FMCG', indexName: 'S&P BSE FMCG', provider: 'BSE', description: 'FMCG sector index on BSE' },
  { indexCode: 'BSE_METAL', indexName: 'S&P BSE Metal', provider: 'BSE', description: 'Metal sector index on BSE' },
  { indexCode: 'BSE_REALTY', indexName: 'S&P BSE Realty', provider: 'BSE', description: 'Realty sector index on BSE' },
  { indexCode: 'BSE_ENERGY', indexName: 'S&P BSE Energy', provider: 'BSE', description: 'Energy sector index on BSE' },
  { indexCode: 'BSE_POWER', indexName: 'S&P BSE Power', provider: 'BSE', description: 'Power sector index on BSE' },
  { indexCode: 'BSE_CAPITAL_GOODS', indexName: 'S&P BSE Capital Goods', provider: 'BSE', description: 'Capital Goods sector index on BSE' },
  { indexCode: 'BSE_CONSUMER_DURABLES', indexName: 'S&P BSE Consumer Durables', provider: 'BSE', description: 'Consumer Durables sector index on BSE' },
  { indexCode: 'BSE_OIL_GAS', indexName: 'S&P BSE Oil & Gas', provider: 'BSE', description: 'Oil & Gas sector index on BSE' },
  { indexCode: 'BSE_TELECOM', indexName: 'S&P BSE Telecom', provider: 'BSE', description: 'Telecom sector index on BSE' },
  { indexCode: 'BSE_PSU', indexName: 'S&P BSE PSU', provider: 'BSE', description: 'PSU sector index on BSE' },
  { indexCode: 'BSE_INFRA', indexName: 'S&P BSE Infrastructure', provider: 'BSE', description: 'Infrastructure sector index on BSE' },
];

const FEATURE_FLAGS = [
  { flagKey: 'GLOBAL_ADVISORY_MODE', flagName: 'Global Advisory Mode', isEnabled: true, category: 'global_advisory', description: 'Master switch for global advisory engine' },
  { flagKey: 'GLOBAL_ADVISORY_AI_ALLOCATION', flagName: 'AI Global Asset Allocation', isEnabled: true, category: 'global_advisory', description: 'AI-powered global asset allocation recommendations' },
  { flagKey: 'GLOBAL_ADVISORY_MODEL_PORTFOLIOS', flagName: 'Global Model Portfolios', isEnabled: true, category: 'global_advisory', description: 'Pre-built model portfolio templates' },
  { flagKey: 'GLOBAL_ADVISORY_KILL_SWITCH', flagName: 'Global Advisory Emergency Kill Switch', isEnabled: true, category: 'global_advisory', description: 'Emergency disable for all advisory features' },
  { flagKey: 'ai_recommendations_v2', flagName: 'AI Recommendations v2', isEnabled: true, category: 'ai', description: 'AI-powered investment recommendation engine' },
  { flagKey: 'ai_stock_analysis', flagName: 'AI Stock Analysis', isEnabled: true, category: 'ai', description: 'AI-powered fundamental and technical stock analysis' },
  { flagKey: 'ai_portfolio_rebalance', flagName: 'AI Portfolio Rebalancing', isEnabled: true, category: 'ai', description: 'AI-powered portfolio rebalancing suggestions' },
  { flagKey: 'ai_market_brief', flagName: 'AI Daily Market Brief', isEnabled: true, category: 'ai', description: 'Gemini-powered daily market intelligence brief' },
  { flagKey: 'dark_mode', flagName: 'Dark Mode', isEnabled: true, category: 'ui', description: 'Dark mode theme toggle' },
  { flagKey: 'pwa_offline', flagName: 'PWA Offline Mode', isEnabled: true, category: 'ui', description: 'Progressive Web App offline capabilities' },
  { flagKey: 'unlisted_market', flagName: 'Unlisted Marketplace', isEnabled: true, category: 'trading', description: 'SEBI/RBI-compliant unlisted securities marketplace' },
  { flagKey: 'us_trading', flagName: 'US Stock Trading', isEnabled: true, category: 'trading', description: 'US stock market trading with FEMA compliance' },
  { flagKey: 'bond_trading', flagName: 'Bond Trading', isEnabled: true, category: 'trading', description: 'NSE NCB and BSE Bond trading platform' },
  { flagKey: 'agent_knowledge_hub', flagName: 'Agent Knowledge Hub', isEnabled: true, category: 'agent', description: 'Market intelligence dashboard for agents' },
  { flagKey: 'agent_prospect_wizard', flagName: 'Agent Prospect Wizard', isEnabled: true, category: 'agent', description: 'AI-powered prospect onboarding wizard' },
  { flagKey: 'pick_of_the_day', flagName: 'Pick of the Day', isEnabled: true, category: 'agent', description: 'Daily curated investment picks for agents' },
  { flagKey: 'mca_data_platform', flagName: 'MCA Company Data Platform', isEnabled: true, category: 'compliance', description: 'Ministry of Corporate Affairs company data integration' },
  { flagKey: 'kyc_v2', flagName: 'KYC Wizard v2', isEnabled: true, category: 'compliance', description: 'Advanced KYC with video, maker-checker, encryption' },
  { flagKey: 'ckyc_integration', flagName: 'CKYC Integration', isEnabled: true, category: 'compliance', description: 'Central KYC Registry integration' },
  { flagKey: 'lead_leakage_prevention', flagName: 'Lead Leakage Prevention', isEnabled: true, category: 'compliance', description: 'Anti-bypass lead registry and tracking system' },
  { flagKey: 'portfolio_v3', flagName: 'New Portfolio View', isEnabled: true, category: 'experimental', description: 'Unified portfolio view with CAS import' },
  { flagKey: 'screener_v2', flagName: 'Stock Screener v2', isEnabled: true, category: 'experimental', description: 'FMP-enriched stock screener with 4-tier data' },
  { flagKey: 'developer_finance', flagName: 'Developer Finance Module', isEnabled: true, category: 'lending', description: 'Builder funding and project finance module' },
  { flagKey: 'dsa_loan_routing', flagName: 'DSA Loan Routing', isEnabled: true, category: 'lending', description: 'Multi-financier loan routing with RBI compliance' },
  { flagKey: 'insurance_platform', flagName: 'Insurance Platform', isEnabled: true, category: 'trading', description: 'Turtlefin insurance integration' },
  { flagKey: 'partner_hierarchy', flagName: 'Partner Hierarchy System', isEnabled: true, category: 'partner', description: 'Multi-level partner onboarding and commission waterfall' },
  { flagKey: 'partner_payouts', flagName: 'Partner Payout System', isEnabled: true, category: 'partner', description: 'Transaction-level auditable payout statements' },
  { flagKey: 'payment_gateway', flagName: 'Payment Gateway', isEnabled: true, category: 'payments', description: 'Cashfree and PhonePe payment gateway integration' },
  { flagKey: 'zoho_ecosystem', flagName: 'Zoho Ecosystem', isEnabled: true, category: 'integrations', description: 'Zoho CRM, Books, Campaigns, Meeting, Sign integration' },
  { flagKey: 'activity_centre', flagName: 'Activity Centre', isEnabled: true, category: 'monitoring', description: 'Real-time production monitoring with AI insights' },
];

const COMMODITIES_DATA = [
  { symbol: 'GOLD', name: 'Gold', commodityType: 'precious_metal', subType: 'gold', unit: 'troy_oz', currency: 'INR', hasEtf: true, hasSgb: true, hasPhysical: true, hasFutures: true, isPublished: true, safeHaven: true, inflationHedge: true },
  { symbol: 'SILVER', name: 'Silver', commodityType: 'precious_metal', subType: 'silver', unit: 'troy_oz', currency: 'INR', hasEtf: true, hasSgb: false, hasPhysical: true, hasFutures: true, isPublished: true, safeHaven: true, inflationHedge: true },
  { symbol: 'PLATINUM', name: 'Platinum', commodityType: 'precious_metal', subType: 'platinum', unit: 'troy_oz', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: true, hasFutures: false, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'PALLADIUM', name: 'Palladium', commodityType: 'precious_metal', subType: 'palladium', unit: 'troy_oz', currency: 'USD', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: false, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'CRUDE_OIL', name: 'Crude Oil', commodityType: 'energy', subType: 'crude_oil', unit: 'barrel', currency: 'USD', hasEtf: true, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'NATURAL_GAS', name: 'Natural Gas', commodityType: 'energy', subType: 'natural_gas', unit: 'mmbtu', currency: 'USD', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'BRENT_CRUDE', name: 'Brent Crude Oil', commodityType: 'energy', subType: 'brent_crude', unit: 'barrel', currency: 'USD', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'COPPER', name: 'Copper', commodityType: 'industrial_metal', subType: 'copper', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'ALUMINUM', name: 'Aluminum', commodityType: 'industrial_metal', subType: 'aluminum', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'ZINC', name: 'Zinc', commodityType: 'industrial_metal', subType: 'zinc', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'NICKEL', name: 'Nickel', commodityType: 'industrial_metal', subType: 'nickel', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'LEAD', name: 'Lead', commodityType: 'industrial_metal', subType: 'lead', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'TIN', name: 'Tin', commodityType: 'industrial_metal', subType: 'tin', unit: 'kg', currency: 'USD', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: false, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'COTTON', name: 'Cotton', commodityType: 'agricultural', subType: 'cotton', unit: 'bale', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'WHEAT', name: 'Wheat', commodityType: 'agricultural', subType: 'wheat', unit: 'quintal', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: false, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'SOYBEAN', name: 'Soybean', commodityType: 'agricultural', subType: 'soybean', unit: 'quintal', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'MENTHA_OIL', name: 'Mentha Oil', commodityType: 'agricultural', subType: 'mentha_oil', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'CASTOR_SEED', name: 'Castor Seed', commodityType: 'agricultural', subType: 'castor_seed', unit: 'quintal', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
];

const REITS_DATA = [
  { symbol: 'EMBASSY', name: 'Embassy Office Parks REIT', sponsor: 'Blackstone Group & Embassy Group', isinCode: 'INE0LYH01012', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 300, isActive: true },
  { symbol: 'MINDSPACE', name: 'Mindspace Business Parks REIT', sponsor: 'K Raheja Corp & Blackstone', isinCode: 'INE0CCU01017', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 275, isActive: true },
  { symbol: 'BROOKFIELD', name: 'Brookfield India Real Estate Trust', sponsor: 'Brookfield Asset Management', isinCode: 'INE0JGT01014', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 275, isActive: true },
  { symbol: 'NEXUSSELECT', name: 'Nexus Select Trust', sponsor: 'Blackstone Group', isinCode: 'INE0MII01018', sector: 'retail', propertyType: 'retail_mall', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 100, isActive: true },
];

const INVITS_DATA = [
  { symbol: 'INDIGRID', name: 'India Grid Trust', sector: 'power', infrastructureType: 'power_transmission', exchange: 'NSE', riskLevel: 'low', isActive: true, sponsor: 'Sterlite Power', isinCode: 'INE219X14019' },
  { symbol: 'IRB', name: 'IRB InvIT Fund', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true, sponsor: 'IRB Infrastructure', isinCode: 'INE949L14014' },
  { symbol: 'POWERGRID', name: 'PowerGrid Infrastructure Investment Trust', sector: 'power', infrastructureType: 'power_transmission', exchange: 'NSE', riskLevel: 'low', isActive: true, sponsor: 'Power Grid Corporation of India', isinCode: 'INE0DGB14017' },
  { symbol: 'NHIT', name: 'National Highways Infra Trust', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true, sponsor: 'NHAI', isinCode: 'INE0KXZ14017' },
  { symbol: 'ORIENTGREEN', name: 'Oriental Green InvIT', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true },
  { symbol: 'JIOINVIT', name: 'Data Infrastructure Trust (Jio Digital Fibre)', sector: 'telecom', infrastructureType: 'telecom_towers', exchange: 'NSE', riskLevel: 'moderate', isActive: true, sponsor: 'Reliance Industries' },
];

interface BootstrapResult {
  category: string;
  existing: number;
  seeded: number;
  total: number;
  error?: string;
}

export async function runProductionBootstrap(): Promise<BootstrapResult[]> {
  console.log('[ProductionBootstrap] Starting comprehensive data seeding...');
  const results: BootstrapResult[] = [];

  results.push(await seedMarketIndices());
  results.push(await seedFeatureFlags());
  results.push(await seedCommodities());
  results.push(await seedReits());
  results.push(await seedInvits());
  results.push(await seedScreenerStocks());
  results.push(await triggerBondCatalogRefresh());
  results.push(await seedAifFunds());
  results.push(await seedSEBI2026Taxonomy());
  results.push(await seedQuantGovernancePolicies());

  const summary = results.map(r => `${r.category}: ${r.seeded} new (${r.total} total)`).join(', ');
  console.log(`[ProductionBootstrap] Complete: ${summary}`);
  return results;
}

// ── SEBI 2026 Taxonomy Seeding ───────────────────────────────────────────────
async function seedSEBI2026Taxonomy(): Promise<BootstrapResult> {
  try {
    // Check if already seeded
    const existingResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM mf_taxonomy_versions WHERE version = 'SEBI_2026'
    `);
    const existingCount = parseInt(String((existingResult.rows[0] as any)?.cnt || '0'));

    if (existingCount === 0) {
      console.log('[ProductionBootstrap] SEBI 2026: Seeding taxonomy (first run)...');
      await sebiCategoryEngine.seedSEBI2026Taxonomy();
    } else {
      console.log('[ProductionBootstrap] SEBI 2026: Taxonomy already seeded — ensuring subcategories are current...');
      await sebiCategoryEngine.seedSEBI2026Taxonomy();
    }

    // Solution-Oriented backfill: flag these for REQUIRES_REVIEW under SEBI 2026
    const backfillResult = await db.execute(sql`
      UPDATE mutual_funds
      SET
        taxonomy_version = 'SEBI_2017',
        compliance_status = 'REQUIRES_REVIEW'
      WHERE
        (category ILIKE '%solution%' OR category ILIKE '%retirement%' OR category ILIKE '%children%')
        AND (taxonomy_version IS NULL OR taxonomy_version = 'SEBI_2017')
        AND (compliance_status IS NULL OR compliance_status = 'PENDING')
    `);

    const backfilledRows = (backfillResult as any).rowCount || 0;

    if (backfilledRows > 0) {
      console.log(`[ProductionBootstrap] SEBI 2026: Flagged ${backfilledRows} solution-oriented schemes as REQUIRES_REVIEW`);

      // Audit log the migration
      await db.execute(sql`
        INSERT INTO mf_categorization_audit_log (
          scheme_code, old_category, new_category, old_subcategory, new_subcategory,
          triggered_by, taxonomy_version
        )
        SELECT
          scheme_code, category, category, scheme_sub_category, scheme_sub_category,
          'SEBI_2026_MIGRATION', 'SEBI_2017'
        FROM mutual_funds
        WHERE (category ILIKE '%solution%' OR category ILIKE '%retirement%' OR category ILIKE '%children%')
          AND compliance_status = 'REQUIRES_REVIEW'
        ON CONFLICT DO NOTHING
      `);
    }

    const subcatCountResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM mf_subcategory_master WHERE taxonomy_version = 'SEBI_2026'
    `);
    const subcatCount = parseInt(String((subcatCountResult.rows[0] as any)?.cnt || '0'));

    return {
      category: 'sebi_2026_taxonomy',
      existing: existingCount > 0 ? subcatCount : 0,
      seeded: existingCount === 0 ? subcatCount : 0,
      total: subcatCount,
    };
  } catch (error: any) {
    console.error('[ProductionBootstrap] SEBI 2026 taxonomy seeding failed:', error.message);
    return { category: 'sebi_2026_taxonomy', existing: 0, seeded: 0, total: 0, error: error.message };
  }
}

async function seedAifFunds(): Promise<BootstrapResult> {
  try {
    const aifCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM aif_master`);
    const aifCount = parseInt(String((aifCheck.rows[0] as any)?.cnt || '0'));

    if (aifCount > 0) {
      console.log(`[ProductionBootstrap] AIF master records: ${aifCount} already exist`);
      return { category: 'aif_master', existing: aifCount, seeded: 0, total: aifCount };
    }

    console.log('[ProductionBootstrap] AIF master: empty - seeding comprehensive AIF data...');

    const { generateComprehensiveAifSeedData } = await import('./services/sebi-aif-scraper');
    const { aifMaster } = await import('@shared/schema');
    const seedData = generateComprehensiveAifSeedData();

    let seeded = 0;
    const batchSize = 50;

    for (let i = 0; i < seedData.length; i += batchSize) {
      const batch = seedData.slice(i, i + batchSize);
      try {
        const toInsert = batch.map(listing => ({
          name: listing.name,
          registrationNo: listing.registrationNo,
          category: listing.category,
          subcategory: listing.subcategory,
          fundHouseName: listing.fundHouseName,
          sponsor: listing.sponsor,
          inceptionDate: listing.inceptionDate,
          minInvestment: listing.minInvestment,
          lockIn: listing.lockIn,
          benchmark: listing.benchmark,
          style: listing.style,
          fundStatus: listing.fundStatus,
          aum: listing.aum,
          latestNav: listing.latestNav,
          return1M: listing.return1M,
          return3M: listing.return3M,
          return6M: listing.return6M,
          return1Y: listing.return1Y,
          return3Y: listing.return3Y,
          return5Y: listing.return5Y,
          returnSinceInception: listing.returnSinceInception,
          riskScore: listing.riskScore,
          volatility: listing.volatility,
          maxDrawdown: listing.maxDrawdown,
          sharpeRatio: listing.sharpeRatio,
          liquidityFrequency: listing.liquidityFrequency,
          navFrequency: listing.navFrequency,
          description: listing.description,
          investmentObjective: listing.investmentObjective,
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await db.insert(aifMaster).values(toInsert).onConflictDoNothing();
        seeded += batch.length;
      } catch (batchError: any) {
        console.error(`[ProductionBootstrap] AIF batch error:`, batchError.message);
      }
    }

    const finalCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM aif_master`);
    const finalCount = parseInt(String((finalCheck.rows[0] as any)?.cnt || '0'));
    console.log(`[ProductionBootstrap] AIF master records: seeded ${finalCount} funds`);
    return { category: 'aif_master', existing: 0, seeded: finalCount, total: finalCount };
  } catch (error: any) {
    console.error('[ProductionBootstrap] AIF master seeding failed:', error.message);
    return { category: 'aif_master', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedMarketIndices(): Promise<BootstrapResult> {
  const allIndices = [...NSE_INDICES, ...BSE_INDICES];
  try {
    const existing = await db.select({ code: marketIndices.indexCode }).from(marketIndices);
    const existingCodes = new Set(existing.map(e => e.code));

    const toInsert = allIndices.filter(idx => !existingCodes.has(idx.indexCode));
    if (toInsert.length === 0) {
      console.log(`[ProductionBootstrap] Market indices: all ${allIndices.length} already exist`);
      return { category: 'market_indices', existing: existing.length, seeded: 0, total: existing.length };
    }

    for (const idx of toInsert) {
      await db.insert(marketIndices).values({
        indexCode: idx.indexCode,
        indexName: idx.indexName,
        provider: idx.provider,
        description: idx.description,
        isActive: true,
      }).onConflictDoNothing();
    }
    const newTotal = existing.length + toInsert.length;
    console.log(`[ProductionBootstrap] Market indices: seeded ${toInsert.length} new (${newTotal} total)`);
    return { category: 'market_indices', existing: existing.length, seeded: toInsert.length, total: newTotal };
  } catch (error: any) {
    console.error('[ProductionBootstrap] Market indices seeding failed:', error.message);
    return { category: 'market_indices', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedFeatureFlags(): Promise<BootstrapResult> {
  try {
    const existing = await db.select({ key: platformFeatureFlags.flagKey }).from(platformFeatureFlags);
    const existingKeys = new Set(existing.map(e => e.key));

    const toInsert = FEATURE_FLAGS.filter(f => !existingKeys.has(f.flagKey));
    if (toInsert.length === 0) {
      console.log(`[ProductionBootstrap] Feature flags: all ${FEATURE_FLAGS.length} already exist`);
      return { category: 'feature_flags', existing: existing.length, seeded: 0, total: existing.length };
    }

    for (const flag of toInsert) {
      await db.insert(platformFeatureFlags).values({
        flagKey: flag.flagKey,
        flagName: flag.flagName,
        description: flag.description,
        isEnabled: flag.isEnabled,
        category: flag.category,
        enabledEnvironments: ['development', 'production'],
      }).onConflictDoNothing();
    }
    const newTotal = existing.length + toInsert.length;
    console.log(`[ProductionBootstrap] Feature flags: seeded ${toInsert.length} new (${newTotal} total)`);
    return { category: 'feature_flags', existing: existing.length, seeded: toInsert.length, total: newTotal };
  } catch (error: any) {
    console.error('[ProductionBootstrap] Feature flags seeding failed:', error.message);
    return { category: 'feature_flags', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedCommodities(): Promise<BootstrapResult> {
  try {
    const existing = await db.select({ sym: commodities.symbol }).from(commodities);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = COMMODITIES_DATA.filter(c => !existingSymbols.has(c.symbol));
    if (toInsert.length === 0) {
      console.log(`[ProductionBootstrap] Commodities: all ${COMMODITIES_DATA.length} already exist`);
      return { category: 'commodities', existing: existing.length, seeded: 0, total: existing.length };
    }

    for (const commodity of toInsert) {
      await db.insert(commodities).values(commodity as any).onConflictDoNothing();
    }
    const newTotal = existing.length + toInsert.length;
    console.log(`[ProductionBootstrap] Commodities: seeded ${toInsert.length} new (${newTotal} total)`);
    return { category: 'commodities', existing: existing.length, seeded: toInsert.length, total: newTotal };
  } catch (error: any) {
    console.error('[ProductionBootstrap] Commodities seeding failed:', error.message);
    return { category: 'commodities', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedReits(): Promise<BootstrapResult> {
  try {
    const existing = await db.select({ sym: reits.symbol }).from(reits);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = REITS_DATA.filter(r => !existingSymbols.has(r.symbol));
    if (toInsert.length === 0) {
      console.log(`[ProductionBootstrap] REITs: all ${REITS_DATA.length} already exist`);
      return { category: 'reits', existing: existing.length, seeded: 0, total: existing.length };
    }

    for (const reit of toInsert) {
      await db.insert(reits).values(reit as any).onConflictDoNothing();
    }
    const newTotal = existing.length + toInsert.length;
    console.log(`[ProductionBootstrap] REITs: seeded ${toInsert.length} new (${newTotal} total)`);
    return { category: 'reits', existing: existing.length, seeded: toInsert.length, total: newTotal };
  } catch (error: any) {
    console.error('[ProductionBootstrap] REITs seeding failed:', error.message);
    return { category: 'reits', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedInvits(): Promise<BootstrapResult> {
  try {
    const existing = await db.select({ sym: invits.symbol }).from(invits);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = INVITS_DATA.filter(i => !existingSymbols.has(i.symbol));
    if (toInsert.length === 0) {
      console.log(`[ProductionBootstrap] InvITs: all ${INVITS_DATA.length} already exist`);
      return { category: 'invits', existing: existing.length, seeded: 0, total: existing.length };
    }

    for (const invit of toInsert) {
      await db.insert(invits).values(invit as any).onConflictDoNothing();
    }
    const newTotal = existing.length + toInsert.length;
    console.log(`[ProductionBootstrap] InvITs: seeded ${toInsert.length} new (${newTotal} total)`);
    return { category: 'invits', existing: existing.length, seeded: toInsert.length, total: newTotal };
  } catch (error: any) {
    console.error('[ProductionBootstrap] InvITs seeding failed:', error.message);
    return { category: 'invits', existing: 0, seeded: 0, total: 0 };
  }
}

async function seedScreenerStocks(): Promise<BootstrapResult> {
  try {
    const screenerCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM screener_stocks`);
    const screenerCount = parseInt(String((screenerCheck.rows[0] as any)?.cnt || '0'));

    const listedCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM listed_stocks`);
    const listedCount = parseInt(String((listedCheck.rows[0] as any)?.cnt || '0'));

    if (listedCount === 0) {
      console.log('[ProductionBootstrap] Screener stocks: no listed_stocks source data');
      return { category: 'screener_stocks', existing: screenerCount, seeded: 0, total: screenerCount };
    }

    const gapCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM listed_stocks ls 
      LEFT JOIN screener_stocks ss ON ls.symbol = ss.symbol 
      WHERE ss.symbol IS NULL AND ls.symbol IS NOT NULL AND ls.symbol != ''
    `);
    const gapCount = parseInt(String((gapCheck.rows[0] as any)?.cnt || '0'));

    if (gapCount === 0) {
      console.log(`[ProductionBootstrap] Screener stocks: all ${screenerCount} synced (${listedCount} listed)`);
      return { category: 'screener_stocks', existing: screenerCount, seeded: 0, total: screenerCount };
    }

    console.log(`[ProductionBootstrap] Screener stocks: filling ${gapCount} gap from listed_stocks...`);

    // Use NOT EXISTS instead of ON CONFLICT to avoid dependency on a specific
    // unique constraint name — ON CONFLICT (symbol) fails when the DB index
    // was created as a non-unique index before the schema added .unique().
    await db.execute(sql`
      INSERT INTO screener_stocks (symbol, company_name, isin, exchange, sector, industry, is_active, data_source)
      SELECT ls.symbol, ls.company_name, ls.isin, 'NSE', ls.sector, ls.industry, true, 'listed_stocks'
      FROM listed_stocks ls
      WHERE ls.symbol IS NOT NULL AND ls.symbol != ''
        AND NOT EXISTS (
          SELECT 1 FROM screener_stocks ss WHERE ss.symbol = ls.symbol
        )
    `);

    const newCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM screener_stocks`);
    const newCount = parseInt(String((newCheck.rows[0] as any)?.cnt || '0'));
    const seeded = newCount - screenerCount;
    console.log(`[ProductionBootstrap] Screener stocks: seeded ${seeded} new (${newCount} total)`);
    return { category: 'screener_stocks', existing: screenerCount, seeded, total: newCount };
  } catch (error: any) {
    console.error('[ProductionBootstrap] Screener stocks seeding failed:', error.message);
    return { category: 'screener_stocks', existing: 0, seeded: 0, total: 0 };
  }
}

async function triggerBondCatalogRefresh(): Promise<BootstrapResult> {
  try {
    const bondCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM bond_catalog`);
    const bondCount = parseInt(String((bondCheck.rows[0] as any)?.cnt || '0'));

    if (bondCount >= 100) {
      console.log(`[ProductionBootstrap] Bond catalog: ${bondCount} bonds present (auto-refresh active)`);
      return { category: 'bond_catalog', existing: bondCount, seeded: 0, total: bondCount };
    }

    console.log(`[ProductionBootstrap] Bond catalog: only ${bondCount} bonds - triggering refresh...`);
    try {
      const { bondCatalogService } = await import('./bond-catalog-service');
      const refreshResult = await bondCatalogService.refreshAllBonds();
      const newCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM bond_catalog`);
      const newCount = parseInt(String((newCheck.rows[0] as any)?.cnt || '0'));
      const seeded = newCount - bondCount;
      console.log(`[ProductionBootstrap] Bond catalog: refreshed, ${seeded} new bonds (${newCount} total)`);
      return { category: 'bond_catalog', existing: bondCount, seeded, total: newCount };
    } catch (err: any) {
      console.error('[ProductionBootstrap] Bond catalog refresh failed:', err.message);
      return { category: 'bond_catalog', existing: bondCount, seeded: 0, total: bondCount };
    }
  } catch (error: any) {
    console.error('[ProductionBootstrap] Bond catalog check failed:', error.message);
    return { category: 'bond_catalog', existing: 0, seeded: 0, total: 0 };
  }
}

// ── Quant Governance Policy Seeding ──────────────────────────────────────────
async function seedQuantGovernancePolicies(): Promise<BootstrapResult> {
  try {
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM quant_governance_policy`);
    const existingCount = parseInt(String((existing.rows[0] as any)?.cnt || '0'));

    await db.execute(sql`
      INSERT INTO quant_governance_policy
        (risk_profile, use_mvo, use_black_litterman, use_ai_drift_prediction, risk_aversion, tau, tactical_budget,
         drift_probability_trigger, max_asset_weight, min_asset_weight, covariance_lookback_days, ewma_span,
         shrinkage_intensity, solver_max_iterations, solver_tolerance)
      VALUES
        ('conservative',    false, false, true,  3.5, 0.03, 0.05, 0.75, 0.30, 0.00, 250, 80, 0.6, 1000, 1e-8),
        ('moderate',        true,  false, true,  2.5, 0.05, 0.10, 0.70, 0.40, 0.00, 250, 60, 0.5, 1000, 1e-8),
        ('balanced',        true,  false, true,  2.5, 0.05, 0.10, 0.70, 0.40, 0.00, 250, 60, 0.5, 1000, 1e-8),
        ('aggressive',      true,  true,  true,  2.0, 0.05, 0.15, 0.65, 0.45, 0.00, 250, 60, 0.4, 1000, 1e-8),
        ('very_aggressive', true,  true,  true,  1.5, 0.07, 0.20, 0.60, 0.50, 0.00, 250, 40, 0.3, 1000, 1e-8)
      ON CONFLICT (risk_profile) DO NOTHING
    `);

    const final = await db.execute(sql`SELECT COUNT(*) as cnt FROM quant_governance_policy`);
    const finalCount = parseInt(String((final.rows[0] as any)?.cnt || '0'));
    const seeded = finalCount - existingCount;

    if (seeded > 0) {
      console.log(`[ProductionBootstrap] Quant governance: seeded ${seeded} risk profile policies (${finalCount} total)`);
    } else {
      console.log(`[ProductionBootstrap] Quant governance: all ${finalCount} policies already present`);
    }

    return { category: 'quant_governance', existing: existingCount, seeded, total: finalCount };
  } catch (error: any) {
    console.error('[ProductionBootstrap] Quant governance seeding failed:', error.message);
    return { category: 'quant_governance', existing: 0, seeded: 0, total: 0 };
  }
}
