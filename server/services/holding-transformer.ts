/**
 * AUTHORITATIVE FIX: Holding Transformer
 * 
 * Golden Rule: Holdings are DERIVED from lots — never the other way around.
 * 
 * This service provides the ONLY valid way to aggregate lots into holdings.
 * Any code that merges holdings without lot awareness is WRONG.
 */

import { PortfolioLot } from '../models/portfolioLot';

export interface TransformedHolding {
  isin: string;
  schemeName: string;
  amc: string;
  folio: string;
  lots: PortfolioLot[];
  
  // Derived from lots (not CAS text)
  totalUnits: number;
  totalAmount: number;
  avgCostPerUnit: number;
  lotCount: number;
  lotSummary: string;
  
  // First lot date (for display only, NOT for tax)
  firstPurchaseDate: string | null;
}

/**
 * DIFF 3 (CORE FIX): Derive holdings FROM LOTS (NOT vice-versa)
 * 
 * This is the ONLY valid way to aggregate holdings.
 * Do NOT add purchaseDate to the holding directly.
 * Tax calculations MUST use individual lot.transactionDate values.
 */
export function deriveHoldingsFromLots(lots: PortfolioLot[]): TransformedHolding[] {
  const map = new Map<string, TransformedHolding>();

  for (const lot of lots) {
    // Use ISIN+Folio as unique key (prevents incorrect merging)
    const key = `${lot.isin}::${lot.folio}`;

    if (!map.has(key)) {
      map.set(key, {
        isin: lot.isin,
        schemeName: lot.schemeName,
        amc: lot.amc,
        folio: lot.folio,
        lots: [],
        totalUnits: 0,
        totalAmount: 0,
        avgCostPerUnit: 0,
        lotCount: 0,
        lotSummary: '',
        firstPurchaseDate: null
      });
    }

    map.get(key)!.lots.push(lot);
  }

  return Array.from(map.values()).map(h => {
    // Sort lots by date (FIFO order)
    h.lots.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    
    // Derive values from lots
    h.totalUnits = h.lots.reduce((s, l) => s + l.units, 0);
    h.totalAmount = h.lots.reduce((s, l) => s + l.amount, 0);
    h.avgCostPerUnit = h.totalUnits > 0 ? h.totalAmount / h.totalUnits : 0;
    h.lotCount = h.lots.length;
    
    // Generate lot summary
    const sipLots = h.lots.filter(l => l.transactionType === 'SIP').length;
    const purchaseLots = h.lots.filter(l => l.transactionType === 'PURCHASE').length;
    
    if (sipLots > 0 && purchaseLots === 0) {
      h.lotSummary = `${sipLots} SIP lot${sipLots > 1 ? 's' : ''}`;
    } else if (purchaseLots > 0 && sipLots === 0) {
      h.lotSummary = `${purchaseLots} purchase lot${purchaseLots > 1 ? 's' : ''}`;
    } else if (h.lots.length > 0) {
      h.lotSummary = `${h.lots.length} lot${h.lots.length > 1 ? 's' : ''}`;
      if (sipLots > 0) h.lotSummary += ` (${sipLots} SIP)`;
    } else {
      h.lotSummary = 'No lots';
    }
    
    // Set first purchase date (for display reference only)
    if (h.lots.length > 0) {
      h.firstPurchaseDate = h.lots[0].transactionDate.toISOString().split('T')[0];
    }
    
    return h;
  });
}

/**
 * Validate that lots have not been dropped during processing
 * This is a critical assertion that prevents silent data loss
 */
export function assertLotsNotDropped(holdings: { lots?: any[]; holdingTier?: string }[]): void {
  const fullTierWithNoLots = holdings.filter(h => {
    const tier = h.holdingTier || 'FULL';
    return tier === 'FULL' && (!h.lots || h.lots.length === 0);
  });
  
  if (fullTierWithNoLots.length > 0) {
    console.error(`[CRITICAL] CAS_LOTS_DROPPED: ${fullTierWithNoLots.length} FULL tier holdings have no lots`);
    throw new Error(`CAS_LOTS_DROPPED: Transaction rows found in CAS but lost during processing (${fullTierWithNoLots.length} holdings affected)`);
  }
}
