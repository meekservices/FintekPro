import { db } from "../db";
import { portfolios, portfolioHoldings, prospectClients } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

interface NormalizedHolding {
  id: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: string;
  productType?: string;
  quantity: number;
  averageCost?: number;
  currentValue: number;
  currentNav?: number;
  investedValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  folioNumber?: string;
  broker?: string;
  confidenceScore?: number;
  purchaseDate?: string;
  category?: string;
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
    return {
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
      category: (holding as any).category?.trim() || undefined,
    };
  }

  // Helper: Merge holdings, deduplicating by ISIN or name+assetType
  private mergeHoldings(existing: NormalizedHolding[], incoming: NormalizedHolding[]): NormalizedHolding[] {
    const merged = [...existing];
    
    for (const newHolding of incoming) {
      const existingIndex = merged.findIndex(h => {
        // Match by ISIN if available
        if (h.isin && newHolding.isin) {
          return h.isin === newHolding.isin;
        }
        // Otherwise match by name + assetType
        return h.name.toLowerCase() === newHolding.name.toLowerCase() && 
               h.assetType === newHolding.assetType;
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
