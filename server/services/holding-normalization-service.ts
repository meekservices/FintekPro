/**
 * Holding Normalization Service
 * 
 * Centralizes all holding data normalization logic including:
 * - Asset type classification
 * - Allocation calculation
 * - Name standardization
 * - AMFI lookup for canonical fund names
 * - Summary computation
 */

import type { 
  UnifiedHolding, 
  AssetType, 
  AllocationBreakdown, 
  UnifiedPortfolioSummary,
  RegistrarBreakdown
} from './unified-portfolio-types';
import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { eq, ilike, or, sql } from 'drizzle-orm';

interface AmfiLookupResult {
  schemeCode: string;
  schemeName: string;
  isin?: string;
  amcName?: string;
  category?: string;
  confidence: number;
}

const amfiLookupCache = new Map<string, { result: AmfiLookupResult | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

class HoldingNormalizationService {
  
  normalizeAssetType(type: string | undefined | null): AssetType {
    if (!type) return 'equity';
    
    const normalized = type.toLowerCase().trim();
    
    if (normalized.includes('equity') || normalized.includes('stock')) return 'equity';
    if (normalized.includes('mutual') || normalized.includes('fund') || normalized.includes('mf')) return 'mutual_fund';
    if (normalized.includes('etf')) return 'etf';
    if (normalized.includes('debt') || normalized.includes('bond') || normalized.includes('fixed') || normalized.includes('ncd')) return 'debt';
    if (normalized.includes('gold') || normalized.includes('sgb') || normalized.includes('sovereign')) return 'gold';
    if (normalized.includes('cash') || normalized.includes('liquid') || normalized.includes('money') || normalized.includes('overnight')) return 'cash';
    if (normalized.includes('hybrid') || normalized.includes('balanced') || normalized.includes('allocation')) return 'hybrid';
    if (normalized.includes('fd') || normalized.includes('deposit')) return 'fd';
    if (normalized.includes('pms')) return 'pms';
    if (normalized.includes('aif') || normalized.includes('alternative')) return 'aif';
    if (normalized.includes('reit')) return 'reit';
    if (normalized.includes('invit') || normalized.includes('infrastructure')) return 'invit';
    if (normalized.includes('unlisted') || normalized.includes('pre-ipo')) return 'unlisted';
    
    return 'other';
  }

  normalizeAssetTypeFromMFCategory(category: string | undefined): AssetType {
    if (!category) return 'mutual_fund';
    
    const cat = category.toLowerCase();
    
    if (cat.includes('equity') || cat.includes('large cap') || cat.includes('mid cap') || 
        cat.includes('small cap') || cat.includes('flexi') || cat.includes('multi cap') ||
        cat.includes('focused') || cat.includes('thematic') || cat.includes('sectoral') ||
        cat.includes('dividend yield') || cat.includes('contra') || cat.includes('value')) {
      return 'equity';
    }
    
    if (cat.includes('debt') || cat.includes('gilt') || cat.includes('corporate bond') ||
        cat.includes('banking') || cat.includes('credit risk') || cat.includes('dynamic bond') ||
        cat.includes('floater') || cat.includes('short duration') || cat.includes('medium duration') ||
        cat.includes('long duration') || cat.includes('ultra short') || cat.includes('low duration')) {
      return 'debt';
    }
    
    if (cat.includes('liquid') || cat.includes('overnight') || cat.includes('money market')) {
      return 'cash';
    }
    
    if (cat.includes('hybrid') || cat.includes('balanced') || cat.includes('aggressive') ||
        cat.includes('conservative') || cat.includes('arbitrage') || cat.includes('multi asset') ||
        cat.includes('dynamic asset')) {
      return 'hybrid';
    }
    
    if (cat.includes('gold') || cat.includes('silver') || cat.includes('commodity')) {
      return 'gold';
    }
    
    if (cat.includes('etf')) return 'etf';
    if (cat.includes('fund of funds') || cat.includes('fof')) return 'mutual_fund';
    
    return 'mutual_fund';
  }

  deriveAllocationFromHoldings(holdings: UnifiedHolding[]): AllocationBreakdown {
    const allocation: AllocationBreakdown = {
      equity: 0,
      debt: 0,
      gold: 0,
      cash: 0,
      hybrid: 0,
      alternatives: 0,
      others: 0
    };
    
    const total = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    if (total === 0) return allocation;
    
    holdings.forEach(h => {
      const value = h.currentValue || 0;
      const percent = (value / total) * 100;
      
      switch (h.assetType) {
        case 'equity':
        case 'etf':
          allocation.equity += percent;
          break;
        case 'debt':
        case 'bond':
        case 'fd':
          allocation.debt += percent;
          break;
        case 'gold':
          allocation.gold += percent;
          break;
        case 'cash':
          allocation.cash += percent;
          break;
        case 'hybrid':
          allocation.hybrid += percent;
          break;
        case 'pms':
        case 'aif':
        case 'reit':
        case 'invit':
        case 'unlisted':
          allocation.alternatives += percent;
          break;
        default:
          allocation.others += percent;
      }
    });
    
    Object.keys(allocation).forEach(key => {
      allocation[key as keyof AllocationBreakdown] = Math.round(allocation[key as keyof AllocationBreakdown] * 100) / 100;
    });
    
    return allocation;
  }

  deriveRegistrarBreakdown(holdings: UnifiedHolding[]): RegistrarBreakdown {
    const breakdown: RegistrarBreakdown = {
      cams: { count: 0, value: 0 },
      kfintech: { count: 0, value: 0 },
      franklin: { count: 0, value: 0 },
      other: { count: 0, value: 0 }
    };
    
    holdings.forEach(h => {
      const value = h.currentValue || 0;
      switch (h.registrar) {
        case 'CAMS':
          breakdown.cams.count++;
          breakdown.cams.value += value;
          break;
        case 'KFINTECH':
          breakdown.kfintech.count++;
          breakdown.kfintech.value += value;
          break;
        case 'FRANKLIN':
          breakdown.franklin.count++;
          breakdown.franklin.value += value;
          break;
        default:
          breakdown.other.count++;
          breakdown.other.value += value;
      }
    });
    
    return breakdown;
  }

  computeSummary(holdings: UnifiedHolding[]): UnifiedPortfolioSummary {
    const totalHoldings = holdings.length;
    
    let totalInvestedValue = 0;
    let totalCurrentValue = 0;
    
    holdings.forEach(h => {
      totalInvestedValue += h.investedValue || (h.avgCostPerUnit || 0) * h.quantity;
      totalCurrentValue += h.currentValue || 0;
    });
    
    const totalUnrealizedGain = totalCurrentValue - totalInvestedValue;
    const totalUnrealizedGainPercent = totalInvestedValue > 0 
      ? (totalUnrealizedGain / totalInvestedValue) * 100 
      : 0;
    
    return {
      totalHoldings,
      totalInvestedValue: Math.round(totalInvestedValue * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalUnrealizedGain: Math.round(totalUnrealizedGain * 100) / 100,
      totalUnrealizedGainPercent: Math.round(totalUnrealizedGainPercent * 100) / 100,
      allocation: this.deriveAllocationFromHoldings(holdings),
      registrarBreakdown: this.deriveRegistrarBreakdown(holdings)
    };
  }

  private static readonly PRESERVE_UPPERCASE = new Set([
    'IDCW', 'SIP', 'ETF', 'FOF', 'NAV', 'AMC', 'NFO', 'AIF', 'PMS', 'REIT', 'INVIT',
    'HDFC', 'ICICI', 'SBI', 'AXIS', 'UTI', 'DSP', 'TATA', 'HSBC', 'PGIM', 'PPFAS',
    'LIC', 'ABSL', 'BSE', 'NSE', 'NCD', 'NCDs', 'IPO', 'FD', 'FDs', 'SGB', 'GOI',
    'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'USA', 'UK', 'US', 'NIFTY', 'SENSEX', 'ESG', 'PSU', 'IT', 'FMCG', 'MNC', 'ELSS'
  ]);

  toTitleCase(text: string): string {
    if (!text) return '';
    
    const isAllCaps = text === text.toUpperCase() && text.length > 5;
    if (!isAllCaps) return text;
    
    return text
      .toLowerCase()
      .split(/(\s+|-|\/|\(|\))/)
      .map(word => {
        const upperWord = word.toUpperCase();
        if (HoldingNormalizationService.PRESERVE_UPPERCASE.has(upperWord)) {
          return upperWord;
        }
        if (word.length <= 1) return word;
        if (/^\d/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join('');
  }

  extractIsinFromName(name: string): { cleanName: string; isin?: string } {
    const isinPatterns = [
      /\(?ISIN[:\s]*([A-Z]{2}[A-Z0-9]{10})\)?/i,
      /\(([A-Z]{2}[A-Z0-9]{10})\)/,
      /\s([A-Z]{2}[A-Z0-9]{10})$/,
    ];
    
    for (const pattern of isinPatterns) {
      const match = name.match(pattern);
      if (match) {
        const isin = match[1].toUpperCase();
        if (this.isValidIsin(isin)) {
          return {
            cleanName: name.replace(match[0], '').replace(/\s+/g, ' ').trim(),
            isin
          };
        }
      }
    }
    return { cleanName: name };
  }

  private isValidIsin(isin: string): boolean {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let digits = '';
    for (const char of isin) {
      if (/[A-Z]/.test(char)) {
        digits += (chars.indexOf(char) + 10).toString();
      } else {
        digits += char;
      }
    }
    let sum = 0;
    let isSecond = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i]);
      if (isSecond) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      isSecond = !isSecond;
    }
    return sum % 10 === 0;
  }

  normalizeHoldingName(name: string): string {
    if (!name) return '';
    
    let normalized = name
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
    
    normalized = this.toTitleCase(normalized);
    
    return normalized;
  }

  extractFolioFromName(name: string): { cleanName: string; folio?: string } {
    const folioMatch = name.match(/\(?Folio[:\s]*([A-Z0-9\/]+)\)?/i);
    if (folioMatch) {
      return {
        cleanName: name.replace(folioMatch[0], '').trim(),
        folio: folioMatch[1]
      };
    }
    return { cleanName: name };
  }

  normalizeAndExtract(name: string): { 
    normalizedName: string; 
    isin?: string; 
    folio?: string;
    planType?: 'Regular' | 'Direct';
    optionType?: 'Growth' | 'IDCW' | 'Dividend';
  } {
    let workingName = name;
    
    const { cleanName: afterIsin, isin } = this.extractIsinFromName(workingName);
    workingName = afterIsin;
    
    const { cleanName: afterFolio, folio } = this.extractFolioFromName(workingName);
    workingName = afterFolio;
    
    const planType = this.detectPlanType(workingName);
    const optionType = this.detectOptionType(workingName);
    
    const normalizedName = this.normalizeHoldingName(workingName);
    
    return { normalizedName, isin, folio, planType, optionType };
  }

  detectPlanType(name: string): 'Regular' | 'Direct' | undefined {
    const upperName = name.toUpperCase();
    if (upperName.includes('DIRECT') || upperName.includes('-DIR') || upperName.includes(' DIR ')) {
      return 'Direct';
    }
    if (upperName.includes('REGULAR') || upperName.includes('-REG') || upperName.includes(' REG ')) {
      return 'Regular';
    }
    return undefined;
  }

  detectOptionType(name: string): 'Growth' | 'IDCW' | 'Dividend' | undefined {
    const upperName = name.toUpperCase();
    if (upperName.includes('GROWTH') || upperName.includes('-G') || upperName.includes(' G ')) {
      return 'Growth';
    }
    if (upperName.includes('IDCW') || upperName.includes('DIV') || upperName.includes('DIVIDEND')) {
      return upperName.includes('IDCW') ? 'IDCW' : 'Dividend';
    }
    return undefined;
  }

  enrichHolding(holding: Partial<UnifiedHolding>): UnifiedHolding {
    const name = holding.name || '';
    const { cleanName, folio } = this.extractFolioFromName(name);
    
    return {
      id: holding.id,
      name: this.normalizeHoldingName(cleanName),
      isin: holding.isin,
      symbol: holding.symbol,
      schemeCode: holding.schemeCode,
      folioNumber: holding.folioNumber || folio,
      assetType: holding.assetType || this.normalizeAssetType(undefined),
      quantity: holding.quantity || 0,
      avgCostPerUnit: holding.avgCostPerUnit,
      investedValue: holding.investedValue,
      currentNav: holding.currentNav,
      currentValue: holding.currentValue || 0,
      unrealizedGain: holding.unrealizedGain,
      unrealizedGainPercent: holding.unrealizedGainPercent,
      broker: holding.broker,
      registrar: holding.registrar,
      amcName: holding.amcName,
      planType: holding.planType || this.detectPlanType(name),
      optionType: holding.optionType || this.detectOptionType(name),
      isDemat: holding.isDemat,
      navDate: holding.navDate,
      purchaseDate: holding.purchaseDate,
      lastTransactionDate: holding.lastTransactionDate,
      confidenceScore: holding.confidenceScore,
      instrumentType: holding.instrumentType,
      regulator: holding.regulator,
      isEdgeCase: holding.isEdgeCase
    };
  }

  calculateGains(holding: UnifiedHolding): UnifiedHolding {
    const investedValue = holding.investedValue || (holding.avgCostPerUnit || 0) * holding.quantity;
    const currentValue = holding.currentValue || 0;
    
    const unrealizedGain = currentValue - investedValue;
    const unrealizedGainPercent = investedValue > 0 
      ? (unrealizedGain / investedValue) * 100 
      : 0;
    
    return {
      ...holding,
      investedValue: Math.round(investedValue * 100) / 100,
      unrealizedGain: Math.round(unrealizedGain * 100) / 100,
      unrealizedGainPercent: Math.round(unrealizedGainPercent * 100) / 100
    };
  }

  async lookupAmfiScheme(query: { isin?: string; name?: string }): Promise<AmfiLookupResult | null> {
    const cacheKey = query.isin || query.name || '';
    const cached = amfiLookupCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    try {
      let result: AmfiLookupResult | null = null;

      if (query.isin) {
        const byIsin = await db
          .select({
            schemeCode: mutualFunds.schemeCode,
            schemeName: mutualFunds.schemeName,
            fundHouse: mutualFunds.fundHouse,
            category: mutualFunds.category,
            extendedData: mutualFunds.extendedData
          })
          .from(mutualFunds)
          .where(
            or(
              eq(mutualFunds.isin, query.isin),
              sql`${mutualFunds.extendedData}->>'isin' = ${query.isin}`,
              sql`${mutualFunds.extendedData}->>'isinReinvestment' = ${query.isin}`
            )
          )
          .limit(1);

        if (byIsin.length > 0) {
          const fund = byIsin[0];
          result = {
            schemeCode: fund.schemeCode,
            schemeName: fund.schemeName,
            isin: query.isin,
            amcName: fund.fundHouse || undefined,
            category: fund.category || undefined,
            confidence: 100
          };
        }
      }

      if (!result && query.name) {
        const cleanName = query.name
          .replace(/\s*(direct|regular)\s*(plan|growth|idcw|dividend)?/gi, '')
          .replace(/\s*-\s*(growth|idcw|dividend|payout|reinvestment)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanName.length >= 5) {
          const searchPattern = `%${cleanName}%`;
          const byName = await db
            .select({
              schemeCode: mutualFunds.schemeCode,
              schemeName: mutualFunds.schemeName,
              fundHouse: mutualFunds.fundHouse,
              category: mutualFunds.category,
              isin: mutualFunds.isin
            })
            .from(mutualFunds)
            .where(ilike(mutualFunds.schemeName, searchPattern))
            .limit(5);

          if (byName.length > 0) {
            const bestMatch = byName[0];
            const similarity = this.calculateNameSimilarity(cleanName, bestMatch.schemeName);
            
            if (similarity >= 0.6) {
              result = {
                schemeCode: bestMatch.schemeCode,
                schemeName: bestMatch.schemeName,
                isin: bestMatch.isin || undefined,
                amcName: bestMatch.fundHouse || undefined,
                category: bestMatch.category || undefined,
                confidence: Math.round(similarity * 100)
              };
            }
          }
        }
      }

      amfiLookupCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.warn('[HoldingNormalization] AMFI lookup failed:', error);
      return null;
    }
  }

  private calculateNameSimilarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s1 = normalize(a);
    const s2 = normalize(b);
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    const words1 = new Set(a.toLowerCase().split(/\s+/));
    const words2 = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return union > 0 ? intersection / union : 0;
  }

  async enrichWithAmfi(holding: Partial<UnifiedHolding>): Promise<UnifiedHolding> {
    const enriched = this.enrichHolding(holding);
    
    if (enriched.isin || enriched.name) {
      const amfiResult = await this.lookupAmfiScheme({
        isin: enriched.isin,
        name: enriched.name
      });
      
      if (amfiResult && amfiResult.confidence >= 80) {
        return {
          ...enriched,
          name: amfiResult.schemeName,
          schemeCode: amfiResult.schemeCode,
          isin: enriched.isin || amfiResult.isin,
          amcName: enriched.amcName || amfiResult.amcName,
          confidenceScore: Math.max(enriched.confidenceScore || 0, amfiResult.confidence)
        };
      }
    }
    
    return enriched;
  }
}

export const holdingNormalizationService = new HoldingNormalizationService();
export type { AmfiLookupResult };
