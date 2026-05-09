import { db } from '../db';
import { mutualFunds, mutualFundAmcs } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

interface ParsedScheme {
  schemeCode: string;
  isin: string | null;
  isinReinvestment: string | null;
  schemeName: string;
  nav: string;
  navDate: string;
  fundHouse: string;
  planType: 'direct' | 'regular';
  option: string;
  category: string | null;
}

interface ImportResult {
  success: boolean;
  totalSchemes: number;
  importedSchemes: number;
  updatedSchemes: number;
  skippedSchemes: number;
  newAmcs: number;
  errors: string[];
  duration: number;
}

interface ImportProgress {
  status: 'idle' | 'fetching' | 'parsing' | 'importing' | 'completed' | 'error';
  currentStep: string;
  totalSchemes: number;
  processedSchemes: number;
  errors: string[];
  startedAt: Date | null;
}

let importProgress: ImportProgress = {
  status: 'idle',
  currentStep: '',
  totalSchemes: 0,
  processedSchemes: 0,
  errors: [],
  startedAt: null,
};

export function getImportProgress(): ImportProgress {
  return { ...importProgress };
}

function resetProgress(): void {
  importProgress = {
    status: 'idle',
    currentStep: '',
    totalSchemes: 0,
    processedSchemes: 0,
    errors: [],
    startedAt: null,
  };
}

function detectPlanType(schemeName: string): 'direct' | 'regular' {
  const nameLower = schemeName.toLowerCase();
  if (nameLower.includes('direct') || nameLower.includes('- direct')) {
    return 'direct';
  }
  return 'regular';
}

function detectOption(schemeName: string): string {
  const nameLower = schemeName.toLowerCase();
  if (nameLower.includes('growth')) return 'growth';
  if (nameLower.includes('idcw payout') || nameLower.includes('dividend payout') || nameLower.includes('payout')) return 'idcw-payout';
  if (nameLower.includes('idcw reinvestment') || nameLower.includes('dividend reinvestment') || nameLower.includes('reinvestment')) return 'idcw-reinvestment';
  if (nameLower.includes('idcw') || nameLower.includes('dividend')) return 'idcw';
  if (nameLower.includes('bonus')) return 'bonus';
  if (nameLower.includes('monthly') || nameLower.includes('quarterly') || nameLower.includes('annual')) return 'periodic';
  return 'other';
}

function categorizeScheme(schemeName: string, fundHouse: string): string | null {
  const nameLower = schemeName.toLowerCase();
  
  if (nameLower.includes('liquid') || nameLower.includes('overnight') || nameLower.includes('money market')) {
    return 'Liquid';
  }
  if (nameLower.includes('arbitrage')) {
    return 'Arbitrage';
  }
  if (nameLower.includes('index') && !nameLower.includes('debt')) {
    return 'Index Funds';
  }
  if (nameLower.includes('etf') || nameLower.includes('exchange traded')) {
    return 'ETF';
  }
  if (nameLower.includes('gilt') || nameLower.includes('government securities')) {
    return 'Gilt';
  }
  if (nameLower.includes('ultra short') || nameLower.includes('ultra-short')) {
    return 'Ultra Short Duration';
  }
  if (nameLower.includes('short duration') || nameLower.includes('short term')) {
    return 'Short Duration';
  }
  if (nameLower.includes('medium duration') || nameLower.includes('medium term')) {
    return 'Medium Duration';
  }
  if (nameLower.includes('long duration') || nameLower.includes('long term')) {
    return 'Long Duration';
  }
  if (nameLower.includes('corporate bond')) {
    return 'Corporate Bond';
  }
  if (nameLower.includes('banking') && nameLower.includes('psu')) {
    return 'Banking & PSU';
  }
  if (nameLower.includes('credit risk')) {
    return 'Credit Risk';
  }
  if (nameLower.includes('dynamic bond')) {
    return 'Dynamic Bond';
  }
  if (nameLower.includes('floater') || nameLower.includes('floating rate')) {
    return 'Floater';
  }
  if (nameLower.includes('large cap') || nameLower.includes('largecap')) {
    return 'Large Cap';
  }
  if (nameLower.includes('large & mid') || nameLower.includes('large and mid')) {
    return 'Large & Mid Cap';
  }
  if (nameLower.includes('flexi cap') || nameLower.includes('flexicap')) {
    return 'Flexi Cap';
  }
  if (nameLower.includes('multi cap') || nameLower.includes('multicap')) {
    return 'Multi Cap';
  }
  if (nameLower.includes('mid cap') || nameLower.includes('midcap')) {
    return 'Mid Cap';
  }
  if (nameLower.includes('small cap') || nameLower.includes('smallcap')) {
    return 'Small Cap';
  }
  if (nameLower.includes('focused') || nameLower.includes('focus')) {
    return 'Focused';
  }
  if (nameLower.includes('value') || nameLower.includes('contra')) {
    return 'Value/Contra';
  }
  if (nameLower.includes('elss') || nameLower.includes('tax saver') || nameLower.includes('tax saving')) {
    return 'ELSS';
  }
  if (nameLower.includes('dividend yield')) {
    return 'Dividend Yield';
  }
  if (nameLower.includes('sectoral') || nameLower.includes('thematic')) {
    return 'Sectoral/Thematic';
  }
  if (nameLower.includes('balanced advantage') || nameLower.includes('dynamic asset')) {
    return 'Balanced Advantage';
  }
  if (nameLower.includes('aggressive hybrid') || nameLower.includes('equity hybrid')) {
    return 'Aggressive Hybrid';
  }
  if (nameLower.includes('conservative hybrid') || nameLower.includes('debt hybrid')) {
    return 'Conservative Hybrid';
  }
  if (nameLower.includes('equity savings')) {
    return 'Equity Savings';
  }
  if (nameLower.includes('multi asset')) {
    return 'Multi Asset Allocation';
  }
  if (nameLower.includes('solution') || nameLower.includes('retirement') || nameLower.includes('children')) {
    return 'Solution Oriented';
  }
  if (nameLower.includes('fof') || nameLower.includes('fund of fund')) {
    return 'Fund of Funds';
  }
  if (nameLower.includes('international') || nameLower.includes('global') || nameLower.includes('us equity') || nameLower.includes('emerging market')) {
    return 'International';
  }
  
  if (nameLower.includes('debt') || nameLower.includes('bond') || nameLower.includes('income')) {
    return 'Debt';
  }
  if (nameLower.includes('equity') || nameLower.includes('growth')) {
    return 'Equity';
  }
  if (nameLower.includes('hybrid') || nameLower.includes('balanced')) {
    return 'Hybrid';
  }
  
  return null;
}

function parseAmfiData(rawData: string): ParsedScheme[] {
  const lines = rawData.split('\n');
  const schemes: ParsedScheme[] = [];
  let currentFundHouse = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    if (!trimmedLine.includes(';')) {
      if (trimmedLine.length > 3 && !trimmedLine.startsWith('Scheme') && !trimmedLine.startsWith('Open Ended')) {
        currentFundHouse = trimmedLine;
      }
      continue;
    }
    
    const parts = trimmedLine.split(';');
    
    if (parts.length < 5) continue;
    if (parts[0] === 'Scheme Code') continue;
    
    const schemeCode = parts[0]?.trim();
    const isin = parts[1]?.trim() || null;
    const isinReinvestment = parts[2]?.trim() || null;
    const schemeName = parts[3]?.trim();
    const nav = parts[4]?.trim();
    const navDate = parts[5]?.trim() || '';
    
    if (!schemeCode || !schemeName || !nav || nav === 'N.A.' || nav === 'N/A') continue;
    
    const navNum = parseFloat(nav);
    if (isNaN(navNum)) continue;
    
    const planType = detectPlanType(schemeName);
    const option = detectOption(schemeName);
    const category = categorizeScheme(schemeName, currentFundHouse);
    
    schemes.push({
      schemeCode,
      isin,
      isinReinvestment,
      schemeName,
      nav,
      navDate,
      fundHouse: currentFundHouse,
      planType,
      option,
      category,
    });
  }
  
  return schemes;
}

function determineRiskLevel(category: string | null): string {
  if (!category) return 'Moderate';
  
  const categoryLower = category.toLowerCase();
  
  if (['liquid', 'overnight', 'ultra short duration', 'money market'].some(c => categoryLower.includes(c))) {
    return 'Low';
  }
  if (['gilt', 'short duration', 'banking & psu', 'corporate bond', 'floater'].some(c => categoryLower.includes(c))) {
    return 'Low to Moderate';
  }
  if (['medium duration', 'long duration', 'credit risk', 'dynamic bond', 'conservative hybrid'].some(c => categoryLower.includes(c))) {
    return 'Moderate';
  }
  if (['balanced advantage', 'equity savings', 'aggressive hybrid', 'arbitrage', 'multi asset'].some(c => categoryLower.includes(c))) {
    return 'Moderate to High';
  }
  if (['large cap', 'large & mid', 'index', 'focused', 'flexi cap', 'multi cap'].some(c => categoryLower.includes(c))) {
    return 'High';
  }
  if (['mid cap', 'small cap', 'sectoral', 'thematic', 'international', 'value', 'dividend yield', 'elss'].some(c => categoryLower.includes(c))) {
    return 'Very High';
  }
  
  return 'Moderate';
}

export async function importAmfiData(): Promise<ImportResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let importedSchemes = 0;
  let updatedSchemes = 0;
  let skippedSchemes = 0;
  let newAmcs = 0;
  
  try {
    resetProgress();
    importProgress.status = 'fetching';
    importProgress.currentStep = 'Fetching AMFI NAV data...';
    importProgress.startedAt = new Date();
    
    console.log('[AMFI Import] Fetching NAV data from AMFI...');
    const response = await fetchWithTimeout(AMFI_NAV_URL, { timeoutMs: 60_000 });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch AMFI data: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.text();
    console.log(`[AMFI Import] Received ${rawData.length} bytes of data`);
    
    importProgress.status = 'parsing';
    importProgress.currentStep = 'Parsing scheme data...';
    
    const schemes = parseAmfiData(rawData);
    console.log(`[AMFI Import] Parsed ${schemes.length} schemes`);
    
    importProgress.totalSchemes = schemes.length;
    importProgress.status = 'importing';
    
    const existingAmcs = new Set<string>();
    const amcList = await db.select().from(mutualFundAmcs);
    amcList.forEach((amc: any) => existingAmcs.add(amc.name.toLowerCase()));
    
    const fundHouseMap = new Map<string, string>();
    
    const batchSize = 100;
    for (let i = 0; i < schemes.length; i += batchSize) {
      const batch = schemes.slice(i, i + batchSize);
      
      for (const scheme of batch) {
        try {
          importProgress.currentStep = `Importing scheme ${i + 1} of ${schemes.length}: ${scheme.schemeName.substring(0, 50)}...`;
          
          if (!existingAmcs.has(scheme.fundHouse.toLowerCase())) {
            try {
              await db.insert(mutualFundAmcs).values({
                name: scheme.fundHouse,
                displayName: scheme.fundHouse,
                regularPlansEnabled: false,
                directPlansEnabled: false,
                totalSchemes: 0,
                publishedRegularSchemes: 0,
                publishedDirectSchemes: 0,
              });
              existingAmcs.add(scheme.fundHouse.toLowerCase());
              fundHouseMap.set(scheme.fundHouse.toLowerCase(), scheme.fundHouse);
              newAmcs++;
              console.log(`[AMFI Import] Created new AMC: ${scheme.fundHouse}`);
            } catch (amcError: any) {
              if (!amcError.message?.includes('duplicate')) {
                console.error(`[AMFI Import] Error creating AMC ${scheme.fundHouse}:`, amcError);
              }
            }
          }
          
          const [existingScheme] = await db.select()
            .from(mutualFunds)
            .where(eq(mutualFunds.schemeCode, scheme.schemeCode))
            .limit(1);
          const riskLevel = determineRiskLevel(scheme.category);
          
          if (existingScheme) {
            await db.update(mutualFunds)
              .set({
                nav: scheme.nav,
                fundHouse: scheme.fundHouse,
                category: scheme.category || existingScheme.category,
                riskLevel: riskLevel,
                planType: scheme.planType,
                lastUpdated: new Date(),
              })
              .where(eq(mutualFunds.schemeCode, scheme.schemeCode));
            updatedSchemes++;
          } else {
            await db.insert(mutualFunds).values({
              schemeCode: scheme.schemeCode,
              schemeName: scheme.schemeName,
              nav: scheme.nav,
              fundHouse: scheme.fundHouse,
              category: scheme.category,
              riskLevel: riskLevel,
              planType: scheme.planType,
              isPublished: false,
              extendedData: {
                isin: scheme.isin,
                isinReinvestment: scheme.isinReinvestment,
                navDate: scheme.navDate,
                option: scheme.option,
              },
            });
            importedSchemes++;
          }
          
          importProgress.processedSchemes++;
        } catch (schemeError: any) {
          if (schemeError.message?.includes('duplicate')) {
            skippedSchemes++;
          } else {
            errors.push(`Scheme ${scheme.schemeCode}: ${schemeError.message}`);
            if (errors.length <= 10) {
              console.error(`[AMFI Import] Error importing scheme ${scheme.schemeCode}:`, schemeError);
            }
          }
        }
      }
      
      if (i % 500 === 0) {
        console.log(`[AMFI Import] Progress: ${i + batch.length}/${schemes.length} schemes processed`);
      }
    }
    
    await syncAmcSchemeCounts();
    
    importProgress.status = 'completed';
    importProgress.currentStep = 'Import completed successfully';
    
    const duration = Date.now() - startTime;
    console.log(`[AMFI Import] Completed in ${duration}ms: ${importedSchemes} new, ${updatedSchemes} updated, ${skippedSchemes} skipped, ${newAmcs} new AMCs`);
    
    return {
      success: true,
      totalSchemes: schemes.length,
      importedSchemes,
      updatedSchemes,
      skippedSchemes,
      newAmcs,
      errors: errors.slice(0, 50),
      duration,
    };
    
  } catch (error: any) {
    importProgress.status = 'error';
    importProgress.currentStep = `Error: ${error.message}`;
    importProgress.errors.push(error.message);
    
    console.error('[AMFI Import] Fatal error:', error);
    
    return {
      success: false,
      totalSchemes: 0,
      importedSchemes,
      updatedSchemes,
      skippedSchemes,
      newAmcs,
      errors: [error.message, ...errors.slice(0, 49)],
      duration: Date.now() - startTime,
    };
  }
}

async function syncAmcSchemeCounts(): Promise<void> {
  try {
    const fundHouses = await db.select({
      fundHouse: mutualFunds.fundHouse,
      planType: mutualFunds.planType,
    }).from(mutualFunds);
    
    const counts = new Map<string, { total: number; regular: number; direct: number }>();
    
    for (const fund of fundHouses) {
      if (!fund.fundHouse) continue;
      
      if (!counts.has(fund.fundHouse)) {
        counts.set(fund.fundHouse, { total: 0, regular: 0, direct: 0 });
      }
      
      const count = counts.get(fund.fundHouse)!;
      count.total++;
      if (fund.planType === 'direct') {
        count.direct++;
      } else {
        count.regular++;
      }
    }
    
    const entries = Array.from(counts.entries());
    for (const [fundHouse, count] of entries) {
      await db.update(mutualFundAmcs)
        .set({
          totalSchemes: count.total,
          updatedAt: new Date(),
        })
        .where(eq(mutualFundAmcs.name, fundHouse));
    }
    
    console.log(`[AMFI Import] Synced scheme counts for ${counts.size} AMCs`);
  } catch (error: any) {
    console.error('[AMFI Import] Error syncing AMC scheme counts:', error);
  }
}

export const amfiImportService = {
  importAmfiData,
  getImportProgress,
};
