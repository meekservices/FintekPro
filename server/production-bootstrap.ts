import { db } from './db';
import { sql, eq } from 'drizzle-orm';
import {
  marketIndices,
  platformFeatureFlags,
  commodities,
  reits,
  invits,
} from '@shared/schema';

const NSE_INDICES = [
  { indexCode: 'NIFTY50', indexName: 'NIFTY 50', provider: 'NSE', description: 'Top 50 companies by market cap on NSE' },
  { indexCode: 'NIFTY_NEXT50', indexName: 'NIFTY Next 50', provider: 'NSE', description: 'Next 50 companies after NIFTY 50' },
  { indexCode: 'NIFTY100', indexName: 'NIFTY 100', provider: 'NSE', description: 'Top 100 companies on NSE' },
  { indexCode: 'NIFTY_MIDCAP_150', indexName: 'NIFTY Midcap 150', provider: 'NSE', description: 'Top 150 mid-cap companies on NSE' },
  { indexCode: 'NIFTY_SMALLCAP_250', indexName: 'NIFTY Smallcap 250', provider: 'NSE', description: 'Top 250 small-cap companies on NSE' },
  { indexCode: 'NIFTY500', indexName: 'NIFTY 500', provider: 'NSE', description: 'Top 500 companies on NSE' },
  { indexCode: 'NIFTY_BANK', indexName: 'NIFTY Bank', provider: 'NSE', description: 'Banking sector index' },
  { indexCode: 'NIFTY_IT', indexName: 'NIFTY IT', provider: 'NSE', description: 'IT sector index' },
  { indexCode: 'NIFTY_PHARMA', indexName: 'NIFTY Pharma', provider: 'NSE', description: 'Pharma sector index' },
  { indexCode: 'NIFTY_AUTO', indexName: 'NIFTY Auto', provider: 'NSE', description: 'Auto sector index' },
  { indexCode: 'NIFTY_FMCG', indexName: 'NIFTY FMCG', provider: 'NSE', description: 'FMCG sector index' },
];

const FEATURE_FLAGS = [
  { flagKey: 'GLOBAL_ADVISORY_MODE', flagName: 'Global Advisory Mode', isEnabled: true, category: 'global_advisory' },
  { flagKey: 'ai_recommendations_v2', flagName: 'AI Recommendations', isEnabled: true, category: 'ai' },
  { flagKey: 'dark_mode', flagName: 'Dark Mode', isEnabled: true, category: 'ui' },
  { flagKey: 'unlisted_market', flagName: 'Unlisted Marketplace', isEnabled: true, category: 'trading' },
  { flagKey: 'agent_knowledge_hub', flagName: 'Agent Knowledge Hub', isEnabled: true, category: 'agent' },
  { flagKey: 'mca_data_platform', flagName: 'MCA Company Data Platform', isEnabled: true, category: 'compliance' },
  { flagKey: 'portfolio_v3', flagName: 'New Portfolio View', isEnabled: true, category: 'experimental' },
  { flagKey: 'GLOBAL_ADVISORY_AI_ALLOCATION', flagName: 'AI Global Asset Allocation', isEnabled: true, category: 'global_advisory' },
  { flagKey: 'GLOBAL_ADVISORY_MODEL_PORTFOLIOS', flagName: 'Global Model Portfolios', isEnabled: true, category: 'global_advisory' },
  { flagKey: 'GLOBAL_ADVISORY_KILL_SWITCH', flagName: 'Global Advisory Emergency Kill Switch', isEnabled: true, category: 'global_advisory' },
];

const COMMODITIES_DATA = [
  { symbol: 'GOLD', name: 'Gold', commodityType: 'precious_metal', subType: 'gold', unit: 'troy_oz', currency: 'INR', hasEtf: true, hasSgb: true, hasPhysical: true, hasFutures: true, isPublished: true, safeHaven: true, inflationHedge: true },
  { symbol: 'SILVER', name: 'Silver', commodityType: 'precious_metal', subType: 'silver', unit: 'troy_oz', currency: 'INR', hasEtf: true, hasSgb: false, hasPhysical: true, hasFutures: true, isPublished: true, safeHaven: true, inflationHedge: true },
  { symbol: 'PLATINUM', name: 'Platinum', commodityType: 'precious_metal', subType: 'platinum', unit: 'troy_oz', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: true, hasFutures: false, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'CRUDE_OIL', name: 'Crude Oil', commodityType: 'energy', subType: 'crude_oil', unit: 'barrel', currency: 'USD', hasEtf: true, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'NATURAL_GAS', name: 'Natural Gas', commodityType: 'energy', subType: 'natural_gas', unit: 'mmbtu', currency: 'USD', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
  { symbol: 'COPPER', name: 'Copper', commodityType: 'industrial_metal', subType: 'copper', unit: 'kg', currency: 'INR', hasEtf: false, hasSgb: false, hasPhysical: false, hasFutures: true, isPublished: true, safeHaven: false, inflationHedge: false },
];

const REITS_DATA = [
  { symbol: 'EMBASSY', name: 'Embassy Office Parks REIT', sponsor: 'Blackstone Group & Embassy Group', isinCode: 'INE0LYH01012', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 300, isActive: true },
  { symbol: 'MINDSPACE', name: 'Mindspace Business Parks REIT', sponsor: 'K Raheja Corp & Blackstone', isinCode: 'INE0CCU01017', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 275, isActive: true },
  { symbol: 'BROOKFIELD', name: 'Brookfield India Real Estate Trust', sponsor: 'Brookfield Asset Management', isinCode: 'INE0JGT01014', sector: 'office', propertyType: 'commercial', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 275, isActive: true },
  { symbol: 'NEXUSSELECT', name: 'Nexus Select Trust', sponsor: 'Blackstone Group', isinCode: 'INE0MII01018', sector: 'retail', propertyType: 'retail_mall', exchange: 'NSE', riskLevel: 'moderate', minimumInvestment: 10000, lotSize: 1, faceValue: 100, isActive: true },
];

const INVITS_DATA = [
  { symbol: 'ORIENTGREEN', name: 'Oriental Green InvIT', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true },
  { symbol: 'JIOINVIT', name: 'Data Infrastructure Trust (Jio Digital Fibre)', sector: 'telecom', infrastructureType: 'telecom_towers', exchange: 'NSE', riskLevel: 'moderate', isActive: true },
  { symbol: 'POWERGRID', name: 'PowerGrid Infrastructure Investment Trust', sector: 'power', infrastructureType: 'power_transmission', exchange: 'NSE', riskLevel: 'low', isActive: true },
  { symbol: 'NHIT', name: 'National Highways Infra Trust', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true },
  { symbol: 'IRB', name: 'IRB InvIT Fund', sector: 'roads', infrastructureType: 'toll_roads', exchange: 'NSE', riskLevel: 'moderate', isActive: true },
  { symbol: 'INDIGRID', name: 'India Grid Trust', sector: 'power', infrastructureType: 'power_transmission', exchange: 'NSE', riskLevel: 'low', isActive: true },
];

export async function runProductionBootstrap(): Promise<void> {
  console.log('[ProductionBootstrap] Starting comprehensive data seeding...');

  await seedNseIndices();
  await seedFeatureFlags();
  await seedCommodities();
  await seedReits();
  await seedInvits();
  await seedScreenerStocks();

  console.log('[ProductionBootstrap] Comprehensive data seeding completed');
}

async function seedNseIndices(): Promise<void> {
  try {
    const existing = await db.select({ code: marketIndices.indexCode }).from(marketIndices);
    const existingCodes = new Set(existing.map(e => e.code));

    const toInsert = NSE_INDICES.filter(idx => !existingCodes.has(idx.indexCode));
    if (toInsert.length === 0) {
      console.log('[ProductionBootstrap] NSE indices: all 11 already exist');
      return;
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
    console.log(`[ProductionBootstrap] NSE indices: seeded ${toInsert.length} new indices`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] NSE indices seeding failed:', error.message);
  }
}

async function seedFeatureFlags(): Promise<void> {
  try {
    const existing = await db.select({ key: platformFeatureFlags.flagKey }).from(platformFeatureFlags);
    const existingKeys = new Set(existing.map(e => e.key));

    const toInsert = FEATURE_FLAGS.filter(f => !existingKeys.has(f.flagKey));
    if (toInsert.length === 0) {
      console.log('[ProductionBootstrap] Feature flags: all 10 already exist');
      return;
    }

    for (const flag of toInsert) {
      await db.insert(platformFeatureFlags).values({
        flagKey: flag.flagKey,
        flagName: flag.flagName,
        isEnabled: flag.isEnabled,
        category: flag.category,
        enabledEnvironments: ['development', 'production'],
      }).onConflictDoNothing();
    }
    console.log(`[ProductionBootstrap] Feature flags: seeded ${toInsert.length} new flags`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] Feature flags seeding failed:', error.message);
  }
}

async function seedCommodities(): Promise<void> {
  try {
    const existing = await db.select({ sym: commodities.symbol }).from(commodities);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = COMMODITIES_DATA.filter(c => !existingSymbols.has(c.symbol));
    if (toInsert.length === 0) {
      console.log('[ProductionBootstrap] Commodities: all 6 already exist');
      return;
    }

    for (const commodity of toInsert) {
      await db.insert(commodities).values(commodity as any).onConflictDoNothing();
    }
    console.log(`[ProductionBootstrap] Commodities: seeded ${toInsert.length} new commodities`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] Commodities seeding failed:', error.message);
  }
}

async function seedReits(): Promise<void> {
  try {
    const existing = await db.select({ sym: reits.symbol }).from(reits);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = REITS_DATA.filter(r => !existingSymbols.has(r.symbol));
    if (toInsert.length === 0) {
      console.log('[ProductionBootstrap] REITs: all 4 already exist');
      return;
    }

    for (const reit of toInsert) {
      await db.insert(reits).values(reit as any).onConflictDoNothing();
    }
    console.log(`[ProductionBootstrap] REITs: seeded ${toInsert.length} new REITs`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] REITs seeding failed:', error.message);
  }
}

async function seedInvits(): Promise<void> {
  try {
    const existing = await db.select({ sym: invits.symbol }).from(invits);
    const existingSymbols = new Set(existing.map(e => e.sym));

    const toInsert = INVITS_DATA.filter(i => !existingSymbols.has(i.symbol));
    if (toInsert.length === 0) {
      console.log('[ProductionBootstrap] InvITs: all 6 already exist');
      return;
    }

    for (const invit of toInsert) {
      await db.insert(invits).values(invit as any).onConflictDoNothing();
    }
    console.log(`[ProductionBootstrap] InvITs: seeded ${toInsert.length} new InvITs`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] InvITs seeding failed:', error.message);
  }
}

async function seedScreenerStocks(): Promise<void> {
  try {
    const screenerCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM screener_stocks`);
    const screenerCount = parseInt(String((screenerCheck.rows[0] as any)?.cnt || '0'));

    if (screenerCount > 0) {
      console.log(`[ProductionBootstrap] Screener stocks: ${screenerCount} already exist`);
      return;
    }

    const listedCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM listed_stocks`);
    const listedCount = parseInt(String((listedCheck.rows[0] as any)?.cnt || '0'));

    if (listedCount === 0) {
      console.log('[ProductionBootstrap] Screener stocks: no listed_stocks to seed from');
      return;
    }

    console.log(`[ProductionBootstrap] Seeding screener_stocks from ${listedCount} listed_stocks...`);

    const result = await db.execute(sql`
      INSERT INTO screener_stocks (symbol, company_name, isin, exchange, sector, industry, is_active, data_source)
      SELECT 
        symbol, 
        company_name, 
        isin, 
        'NSE',
        sector,
        industry,
        true,
        'listed_stocks'
      FROM listed_stocks
      WHERE symbol IS NOT NULL AND symbol != ''
      ON CONFLICT (symbol) DO NOTHING
    `);

    const newCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM screener_stocks`);
    const newCount = parseInt(String((newCheck.rows[0] as any)?.cnt || '0'));
    console.log(`[ProductionBootstrap] Screener stocks: seeded ${newCount} stocks from listed_stocks`);
  } catch (error: any) {
    console.error('[ProductionBootstrap] Screener stocks seeding failed:', error.message);
  }
}
