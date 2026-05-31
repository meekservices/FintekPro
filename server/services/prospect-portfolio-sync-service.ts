// @ts-nocheck
import { db } from "../db";
import { portfolios, portfolioHoldings, prospectClients } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// Individual purchase lot for SIP/multiple transaction tracking
export interface HoldingLot {
  id: string;
  purchaseDate: string;
  quantity: number;
  purchaseNav: number;
  folioNumber?: string;
  transactionType?: 'SIP' | 'LUMPSUM' | 'SWITCH_IN' | 'BONUS' | 'DIVIDEND_REINVEST' | 'TRANSFER_IN';
  investedValue: number;
  currentValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  holdingPeriodDays?: number;
  isLTCG?: boolean;
  exitLoadApplicable?: boolean;
  grandfatheredValue?: number; // For LTCG grandfathering (Jan 31, 2018)
}

export interface NormalizedHolding {
  id: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: string;
  productType?: string;
  
  // Aggregated totals (computed from lots)
  quantity: number;
  averageCost?: number;
  currentValue: number;
  currentNav?: number;
  investedValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  
  // Instrument metadata
  category?: string;
  subCategory?: string;
  fundHouse?: string;
  sector?: string;
  riskLevel?: string;
  returns1y?: number;
  
  // Primary folio/broker (for display)
  folioNumber?: string;
  broker?: string;
  
  // Individual purchase lots for FIFO/LTCG tracking
  lots?: HoldingLot[];
  
  // Legacy single purchase date (for backwards compatibility)
  purchaseDate?: string;
  
  // Confidence and source tracking
  confidenceScore?: number;
  source?: 'manual' | 'csv' | 'excel' | 'cas' | 'api';
  lastUpdated?: string;
}

class ProspectPortfolioSyncService {
  /**
   * Migrate holdings from portfolioHoldings table to currentPortfolio JSON for a prospect
   * This ensures all engines read from the same source
   */
  async migrateToCurrentPortfolio(prospectId: string): Promise<{ migrated: number; holdings: NormalizedHolding[] }> {
    // Find portfolio for this prospect
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.prospectId, prospectId))
      .limit(1);

    if (!portfolio) {
      return { migrated: 0, holdings: [] };
    }

    // Get holdings from portfolioHoldings table
    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolio.id));

    if (holdings.length === 0) {
      return { migrated: 0, holdings: [] };
    }

    // Get existing currentPortfolio data
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    const existingHoldings = (prospect?.currentPortfolio as NormalizedHolding[]) || [];

    // Normalize and sanitize holdings from table
    const normalizedHoldings: NormalizedHolding[] = holdings.map(h => this.sanitizeHolding({
      id: h.id || nanoid(),
      name: h.name || h.symbol || 'Unknown',
      isin: h.isin || undefined,
      symbol: h.symbol || undefined,
      assetType: this.normalizeAssetType(h.assetType),
      productType: h.productType || undefined,
      quantity: parseFloat(h.quantity) || 0,
      averageCost: h.avgPrice ? parseFloat(h.avgPrice) : undefined,
      currentValue: h.currentValue ? parseFloat(h.currentValue) : 0,
      investedValue: h.investedValue ? parseFloat(h.investedValue) : undefined,
      folioNumber: h.folioNumber || undefined,
      broker: h.broker || undefined,
      confidenceScore: h.confidenceScore || undefined,
      purchaseDate: h.purchaseDate ? h.purchaseDate.toISOString().split('T')[0] : undefined,
    }));

    // Merge with existing holdings (deduplicate by ISIN or name+assetType)
    const mergedHoldings = this.mergeHoldings(existingHoldings, normalizedHoldings);

    // Update currentPortfolio JSON
    await db.update(prospectClients)
      .set({ 
        currentPortfolio: mergedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return { migrated: normalizedHoldings.length, holdings: mergedHoldings };
  }

  /**
   * Add a holding to currentPortfolio for a prospect
   * This is the unified write method for all engines
   */
  async addHolding(prospectId: string, holding: Partial<NormalizedHolding>): Promise<NormalizedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    const existingHoldings = (prospect.currentPortfolio as NormalizedHolding[]) || [];
    
    const newHolding = this.sanitizeHolding({
      id: nanoid(),
      name: holding.name || holding.symbol || 'Unknown',
      isin: holding.isin,
      symbol: holding.symbol,
      assetType: this.normalizeAssetType(holding.assetType || 'equity'),
      productType: holding.productType,
      quantity: holding.quantity || 0,
      averageCost: holding.averageCost,
      currentValue: holding.currentValue || 0,
      investedValue: holding.investedValue,
      folioNumber: holding.folioNumber,
      broker: holding.broker,
      confidenceScore: holding.confidenceScore,
      purchaseDate: holding.purchaseDate,
    });

    const updatedHoldings = [...existingHoldings, newHolding];

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: updatedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return updatedHoldings;
  }

  /**
   * Add multiple holdings to currentPortfolio for a prospect (batch operation)
   * This is more efficient than calling addHolding multiple times
   */
  async addHoldings(prospectId: string, holdings: Partial<NormalizedHolding>[]): Promise<NormalizedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    const existingHoldings = (prospect.currentPortfolio as NormalizedHolding[]) || [];
    
    const newHoldings = holdings.map(holding => this.sanitizeHolding({
      id: nanoid(),
      name: holding.name || holding.symbol || 'Unknown',
      isin: holding.isin,
      symbol: holding.symbol,
      assetType: this.normalizeAssetType(holding.assetType || 'equity'),
      productType: holding.productType,
      quantity: holding.quantity || 0,
      averageCost: holding.averageCost,
      currentValue: holding.currentValue || 0,
      investedValue: holding.investedValue,
      folioNumber: holding.folioNumber,
      broker: holding.broker,
      confidenceScore: holding.confidenceScore,
      purchaseDate: holding.purchaseDate,
    }));

    const updatedHoldings = [...existingHoldings, ...newHoldings];

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: updatedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return updatedHoldings;
  }

  /**
   * Get holdings from currentPortfolio for a prospect
   * This is the unified read method for all engines
   */
  async getHoldings(prospectId: string): Promise<NormalizedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    return (prospect?.currentPortfolio as NormalizedHolding[]) || [];
  }

  /**
   * Replace all holdings in currentPortfolio (used for CAS auto-fetch refresh)
   */
  async replaceAllHoldings(prospectId: string, holdings: Partial<NormalizedHolding>[]): Promise<NormalizedHolding[]> {
    const normalizedHoldings = holdings.map(h => this.sanitizeHolding({
      id: h.id || nanoid(),
      name: h.name || h.symbol || 'Unknown',
      isin: h.isin,
      symbol: h.symbol,
      assetType: this.normalizeAssetType(h.assetType || 'equity'),
      productType: h.productType,
      quantity: h.quantity || 0,
      averageCost: h.averageCost,
      currentValue: h.currentValue || 0,
      investedValue: h.investedValue,
      folioNumber: h.folioNumber,
      broker: h.broker,
      confidenceScore: h.confidenceScore,
      purchaseDate: h.purchaseDate,
    }));

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: normalizedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return normalizedHoldings;
  }

  /**
   * Update a specific holding by ID
   */
  async updateHolding(prospectId: string, holdingId: string, updates: Partial<NormalizedHolding>): Promise<NormalizedHolding[]> {
    const holdings = await this.getHoldings(prospectId);
    const index = holdings.findIndex(h => h.id === holdingId);
    
    if (index === -1) {
      throw new Error("Holding not found");
    }

    holdings[index] = this.sanitizeHolding({ ...holdings[index], ...updates });

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: holdings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return holdings;
  }

  /**
   * Delete a holding by ID
   */
  async deleteHolding(prospectId: string, holdingId: string): Promise<NormalizedHolding[]> {
    const holdings = await this.getHoldings(prospectId);
    const updatedHoldings = holdings.filter(h => h.id !== holdingId);

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: updatedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return updatedHoldings;
  }

  /**
   * Migrate all prospects with portfolioHoldings data to currentPortfolio
   */
  async migrateAllProspects(): Promise<{ total: number; migrated: number; errors: string[] }> {
    const prospectsWithPortfolios = await db
      .select({ 
        prospectId: portfolios.prospectId 
      })
      .from(portfolios)
      .where(and(
        eq(portfolios.prospectId, portfolios.prospectId) // Has prospectId
      ));

    const uniqueProspectIds = [...new Set(prospectsWithPortfolios.map(p => p.prospectId).filter(Boolean))];
    
    let migrated = 0;
    const errors: string[] = [];

    for (const prospectId of uniqueProspectIds) {
      if (!prospectId) continue;
      try {
        const result = await this.migrateToCurrentPortfolio(prospectId);
        if (result.migrated > 0) {
          migrated++;
          console.log(`[PortfolioSync] Migrated ${result.migrated} holdings for prospect ${prospectId}`);
        }
      } catch (error: any) {
        errors.push(`${prospectId}: ${error.message}`);
      }
    }

    return { total: uniqueProspectIds.length, migrated, errors };
  }

  // Helper: Normalize asset type to consistent format
  private normalizeAssetType(assetType?: string): string {
    if (!assetType) return 'equity';
    
    const normalized = assetType.toLowerCase().trim();
    
    const mapping: Record<string, string> = {
      'equity': 'equity',
      'stock': 'equity',
      'stocks': 'equity',
      'mutual_fund': 'mutual_fund',
      'mutualfund': 'mutual_fund',
      'mf': 'mutual_fund',
      'etf': 'etf',
      'bond': 'bond',
      'bonds': 'bond',
      'debt': 'bond',
      'gold': 'gold',
      'silver': 'silver',
      'fd': 'fd',
      'fixed_deposit': 'fd',
      'pms': 'pms',
      'aif': 'aif',
      'insurance': 'insurance',
      'ulip': 'insurance',
      'other': 'other',
    };

    return mapping[normalized] || normalized;
  }

  // Helper: Sanitize holding data
  private sanitizeHolding(holding: Partial<NormalizedHolding>): NormalizedHolding {
    const sanitized: NormalizedHolding = {
      id: holding.id || nanoid(),
      name: (holding.name || 'Unknown').trim().substring(0, 200),
      isin: holding.isin?.trim().toUpperCase() || undefined,
      symbol: holding.symbol?.trim().toUpperCase() || undefined,
      assetType: this.normalizeAssetType(holding.assetType),
      productType: holding.productType?.trim() || undefined,
      quantity: Math.max(0, Number(holding.quantity) || 0),
      averageCost: holding.averageCost ? Math.max(0, Number(holding.averageCost)) : undefined,
      currentValue: Math.max(0, Number(holding.currentValue) || 0),
      currentNav: holding.currentNav ? Math.max(0, Number(holding.currentNav)) : undefined,
      investedValue: holding.investedValue ? Math.max(0, Number(holding.investedValue)) : undefined,
      unrealizedGain: holding.unrealizedGain !== undefined ? Number(holding.unrealizedGain) : undefined,
      unrealizedGainPercent: holding.unrealizedGainPercent !== undefined ? Number(holding.unrealizedGainPercent) : undefined,
      folioNumber: holding.folioNumber?.trim() || undefined,
      broker: holding.broker?.trim() || undefined,
      confidenceScore: holding.confidenceScore ? Math.min(100, Math.max(0, Number(holding.confidenceScore))) : undefined,
      purchaseDate: holding.purchaseDate || undefined,
      category: holding.category?.trim() || undefined,
      subCategory: holding.subCategory?.trim() || undefined,
      fundHouse: holding.fundHouse?.trim() || undefined,
      sector: holding.sector?.trim() || undefined,
      riskLevel: holding.riskLevel?.trim() || undefined,
      returns1y: holding.returns1y !== undefined ? Number(holding.returns1y) : undefined,
      lots: holding.lots || undefined,
      source: holding.source || 'manual',
      lastUpdated: new Date().toISOString(),
    };
    return sanitized;
  }

  // Helper: Create a lot from purchase data
  private createLot(data: {
    purchaseDate: string;
    quantity: number;
    purchaseNav: number;
    folioNumber?: string;
    transactionType?: HoldingLot['transactionType'];
  }): HoldingLot {
    const investedValue = data.quantity * data.purchaseNav;
    const purchaseDate = new Date(data.purchaseDate);
    const today = new Date();
    const holdingPeriodDays = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // LTCG threshold: 365 days for equity/mutual funds
    const isLTCG = holdingPeriodDays >= 365;
    
    // Exit load typically applies within 1 year
    const exitLoadApplicable = holdingPeriodDays < 365;

    return {
      id: nanoid(),
      purchaseDate: data.purchaseDate,
      quantity: data.quantity,
      purchaseNav: data.purchaseNav,
      folioNumber: data.folioNumber,
      transactionType: data.transactionType || 'LUMPSUM',
      investedValue,
      holdingPeriodDays,
      isLTCG,
      exitLoadApplicable,
    };
  }

  // Add a lot to an existing holding (for SIP transactions)
  async addLotToHolding(
    prospectId: string, 
    holdingId: string, 
    lotData: {
      purchaseDate: string;
      quantity: number;
      purchaseNav: number;
      folioNumber?: string;
      transactionType?: HoldingLot['transactionType'];
    }
  ): Promise<NormalizedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    const holdings = (prospect.currentPortfolio as NormalizedHolding[]) || [];
    const holdingIndex = holdings.findIndex(h => h.id === holdingId);
    
    if (holdingIndex === -1) {
      throw new Error("Holding not found");
    }

    const holding = holdings[holdingIndex];
    const newLot = this.createLot(lotData);
    
    // Add lot to holding
    holding.lots = [...(holding.lots || []), newLot];
    
    // Recalculate aggregated values
    this.recalculateHoldingFromLots(holding);
    
    holdings[holdingIndex] = holding;

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: holdings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return holdings;
  }

  // Recalculate holding totals from lots
  private recalculateHoldingFromLots(holding: NormalizedHolding): void {
    if (!holding.lots || holding.lots.length === 0) return;

    let totalQuantity = 0;
    let totalInvestedValue = 0;
    const folioNumbers = new Set<string>();

    for (const lot of holding.lots) {
      totalQuantity += lot.quantity;
      totalInvestedValue += lot.investedValue;
      if (lot.folioNumber) folioNumbers.add(lot.folioNumber);
    }

    holding.quantity = totalQuantity;
    holding.investedValue = totalInvestedValue;
    holding.averageCost = totalQuantity > 0 ? totalInvestedValue / totalQuantity : undefined;
    
    // Primary folio (first one found)
    if (folioNumbers.size > 0) {
      holding.folioNumber = Array.from(folioNumbers)[0];
    }

    // Calculate current value if we have current NAV
    if (holding.currentNav && holding.currentNav > 0) {
      holding.currentValue = totalQuantity * holding.currentNav;
      holding.unrealizedGain = holding.currentValue - totalInvestedValue;
      holding.unrealizedGainPercent = totalInvestedValue > 0 
        ? ((holding.currentValue - totalInvestedValue) / totalInvestedValue) * 100 
        : 0;

      // Update each lot's current value
      for (const lot of holding.lots) {
        lot.currentValue = lot.quantity * holding.currentNav;
        lot.unrealizedGain = lot.currentValue - lot.investedValue;
        lot.unrealizedGainPercent = lot.investedValue > 0 
          ? ((lot.currentValue - lot.investedValue) / lot.investedValue) * 100 
          : 0;
      }
    }
  }

  // Add holding with lots support
  async addHoldingWithLots(
    prospectId: string, 
    holdingData: Partial<NormalizedHolding>,
    lots?: Array<{
      purchaseDate: string;
      quantity: number;
      purchaseNav: number;
      folioNumber?: string;
      transactionType?: HoldingLot['transactionType'];
    }>
  ): Promise<NormalizedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    const existingHoldings = (prospect.currentPortfolio as NormalizedHolding[]) || [];
    
    // Create lots if provided
    const holdingLots: HoldingLot[] = lots?.map(l => this.createLot(l)) || [];
    
    // If no lots provided but we have purchaseDate and quantity, create single lot
    if (holdingLots.length === 0 && holdingData.purchaseDate && holdingData.quantity && holdingData.averageCost) {
      holdingLots.push(this.createLot({
        purchaseDate: holdingData.purchaseDate,
        quantity: holdingData.quantity,
        purchaseNav: holdingData.averageCost,
        folioNumber: holdingData.folioNumber,
        transactionType: 'LUMPSUM',
      }));
    }
    
    const newHolding = this.sanitizeHolding({
      ...holdingData,
      lots: holdingLots.length > 0 ? holdingLots : undefined,
    });

    // Recalculate from lots if present
    if (newHolding.lots && newHolding.lots.length > 0) {
      this.recalculateHoldingFromLots(newHolding);
    }

    // Check for duplicate by ISIN
    const existingIndex = existingHoldings.findIndex(h => {
      if (h.isin && newHolding.isin) {
        return h.isin === newHolding.isin;
      }
      return h.name.toLowerCase() === newHolding.name.toLowerCase() && 
             h.assetType === newHolding.assetType;
    });

    let updatedHoldings: NormalizedHolding[];
    
    if (existingIndex >= 0) {
      // Merge lots into existing holding
      const existing = existingHoldings[existingIndex];
      existing.lots = [...(existing.lots || []), ...(newHolding.lots || [])];
      this.recalculateHoldingFromLots(existing);
      existing.lastUpdated = new Date().toISOString();
      updatedHoldings = existingHoldings;
    } else {
      updatedHoldings = [...existingHoldings, newHolding];
    }

    await db.update(prospectClients)
      .set({ 
        currentPortfolio: updatedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    return updatedHoldings;
  }

  /**
   * STEP 3 (FIX SPEC): Merge holdings using ISIN + Folio Number as key
   * DO NOT group by ISIN alone - same ISIN across different folios must remain separate
   * DSP Healthcare must survive as: 1 holding, 2 lots
   */
  private mergeHoldings(existing: NormalizedHolding[], incoming: NormalizedHolding[]): NormalizedHolding[] {
    const merged = [...existing];
    
    for (const newHolding of incoming) {
      const existingIndex = merged.findIndex(h => {
        // CAS Fix: Match by ISIN + FolioNumber for CAS imports
        if (h.isin && newHolding.isin) {
          // If both have folioNumber, use ISIN+Folio as unique key
          if (h.folioNumber && newHolding.folioNumber) {
            return h.isin === newHolding.isin && h.folioNumber === newHolding.folioNumber;
          }
          // Fallback to ISIN-only if no folio (non-CAS imports)
          return h.isin === newHolding.isin;
        }
        // Otherwise match by name + assetType + folioNumber
        const nameMatch = h.name.toLowerCase() === newHolding.name.toLowerCase() && 
               h.assetType === newHolding.assetType;
        if (nameMatch && h.folioNumber && newHolding.folioNumber) {
          return h.folioNumber === newHolding.folioNumber;
        }
        return nameMatch;
      });

      if (existingIndex >= 0) {
        // Update existing holding with newer data
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...newHolding,
          id: merged[existingIndex].id, // Keep original ID
        };
      } else {
        merged.push(newHolding);
      }
    }

    return merged;
  }
}

export const prospectPortfolioSyncService = new ProspectPortfolioSyncService();
