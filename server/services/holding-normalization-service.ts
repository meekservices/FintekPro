/**
 * Holding Normalization Service
 * 
 * Centralizes all holding data normalization logic including:
 * - Asset type classification
 * - Allocation calculation
 * - Name standardization
 * - Summary computation
 */

import type { 
  UnifiedHolding, 
  AssetType, 
  AllocationBreakdown, 
  UnifiedPortfolioSummary,
  RegistrarBreakdown
} from './unified-portfolio-types';

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

  normalizeHoldingName(name: string): string {
    if (!name) return '';
    
    return name
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, ' - ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
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
}

export const holdingNormalizationService = new HoldingNormalizationService();
