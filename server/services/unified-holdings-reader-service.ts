// @ts-nocheck
/**
 * Unified Holdings Reader Service
 * 
 * Single source of truth for portfolio holdings across all engines:
 * - AI Advisory
 * - Proposal Builder
 * - Reports
 * - Capital Gains
 * 
 * Storage Strategy:
 * - PROSPECTS: prospectClients.currentPortfolio JSON (imported before KYC)
 * - REGISTERED CLIENTS: comprehensiveHoldings table (after KYC + AA consent)
 * 
 * This ensures both Agent and Client Admin/Partner read from the same data.
 */

import { db } from '../db';
import { 
  prospectClients, 
  comprehensiveHoldings, 
  users,
  portfolios,
  portfolioHoldings,
  dataSourceConsents,
  aaConsentSessions,
  usBrokerAccounts,
  type ComprehensiveHolding
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { currencyExchangeService } from './currency-exchange-service';
import { alpacaBrokerService } from './alpaca-broker-service';

export interface UnifiedHolding {
  id: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: string;
  assetClass?: string;
  quantity: number;
  averageCost?: number;
  currentPrice?: number;
  currentValue: number;
  investedValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  folioNumber?: string;
  dematAccountNumber?: string;
  broker?: string;
  depository?: 'NSDL' | 'CDSL';
  purchaseDate?: string;
  lots?: HoldingLot[];
  source: 'manual' | 'csv' | 'excel' | 'cas' | 'aa_mf' | 'aa_demat' | 'api';
  dataProvider?: string;
  confidenceScore?: number;
  lastUpdated?: string;
}

export interface HoldingLot {
  id: string;
  purchaseDate: string;
  quantity: number;
  purchaseNav: number;
  investedValue: number;
  currentValue?: number;
  unrealizedGain?: number;
  holdingPeriodDays?: number;
  isLTCG?: boolean;
  grandfatheredValue?: number;
}

export interface HoldingTransaction {
  id: string;
  isin: string;
  transactionDate: string;
  transactionType: 'buy' | 'sell' | 'sip' | 'switch_in' | 'switch_out' | 'dividend' | 'bonus';
  quantity: number;
  price: number;
  amount: number;
  folioNumber?: string;
  source: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  holdingsCount: number;
  assetAllocation: {
    equity: number;
    debt: number;
    hybrid: number;
    gold: number;
    cash: number;
    other: number;
  };
  lastUpdated: string;
}

export interface ClientType {
  isProspect: boolean;
  isRegistered: boolean;
  hasKycCompleted: boolean;
  hasAAConsent: boolean;
  autoSyncEnabled: boolean;
}

class UnifiedHoldingsReaderService {
  
  /**
   * Determine client type (prospect vs registered) and their consent status
   */
  async getClientType(clientId: string): Promise<ClientType> {
    const [prospect] = await db
      .select({ id: prospectClients.id, kycStatus: (prospectClients as any).kycStatus })
      .from(prospectClients)
      .where(eq(prospectClients.id, clientId))
      .limit(1);

    const [user] = await db
      .select({ id: users.id, kycLevel: (users as any).kycLevel })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    const [aaConsent] = await db
      .select()
      .from(aaConsentSessions)
      .where(and(
        eq(aaConsentSessions.userId, clientId),
        eq(aaConsentSessions.status, 'active')
      ))
      .orderBy(desc(aaConsentSessions.createdAt))
      .limit(1);

    const [dataConsent] = await db
      .select()
      .from(dataSourceConsents)
      .where(and(
        eq(dataSourceConsents.userId, clientId as any),
        eq(dataSourceConsents.consentGiven, true)
      ))
      .limit(1);

    return {
      isProspect: !!prospect && !user,
      isRegistered: !!user,
      hasKycCompleted: user?.kycLevel === 'enhanced' || user?.kycLevel === 'full' || prospect?.kycStatus === 'completed',
      hasAAConsent: !!aaConsent,
      autoSyncEnabled: !!dataConsent?.consentGiven,
    };
  }

  /**
   * Get unified holdings for any client (prospect or registered).
   * For registered clients, also merges live Alpaca US positions (USD→INR).
   * This is the single entry point for all engines.
   */
  async getHoldings(clientId: string): Promise<UnifiedHolding[]> {
    const clientType = await this.getClientType(clientId);

    if (clientType.isProspect && !clientType.isRegistered) {
      return this.getProspectHoldings(clientId);
    }

    if (clientType.isRegistered) {
      const [domestic, alpaca] = await Promise.allSettled([
        this.getRegisteredClientHoldings(clientId),
        this.getAlpacaHoldings(clientId),
      ]);
      const domesticHoldings = domestic.status === 'fulfilled' ? domestic.value : [];
      const alpacaHoldings  = alpaca.status  === 'fulfilled' ? alpaca.value  : [];
      return [...domesticHoldings, ...alpacaHoldings];
    }

    return [];
  }

  /**
   * Fetch live Alpaca US equity / crypto positions for a user,
   * converting USD → INR at the current spot rate, and returning
   * them as UnifiedHolding objects tagged with broker='Alpaca'.
   */
  async getAlpacaHoldings(userId: string): Promise<UnifiedHolding[]> {
    try {
      const [brokerAccount] = await db
        .select({
          alpacaAccountId: usBrokerAccounts.alpacaAccountId,
          status: usBrokerAccounts.status,
          alpacaStatus: usBrokerAccounts.alpacaStatus,
        })
        .from(usBrokerAccounts)
        .where(eq(usBrokerAccounts.clientId, userId))
        .limit(1);

      if (!brokerAccount?.alpacaAccountId) return [];
      if (!['live', 'paper'].includes(brokerAccount.status ?? '')) return [];

      const [positions, usdInrRate] = await Promise.allSettled([
        alpacaBrokerService.getPositions(brokerAccount.alpacaAccountId),
        currencyExchangeService.fetchExchangeRates('USD').then(rates => rates['INR'] || 84),
      ]);
      if (positions.status === 'rejected') return [];
      const rate = usdInrRate.status === 'fulfilled' ? usdInrRate.value : 84;

      return positions.value.map((pos): UnifiedHolding => {
        const qty          = parseFloat(pos.qty ?? '0');
        const mktValueUsd  = parseFloat(pos.market_value ?? '0');
        const avgPriceUsd  = parseFloat(pos.avg_entry_price ?? '0');
        const plUsd        = parseFloat((pos as any).unrealized_pl ?? '0');
        const plPct        = parseFloat((pos as any).unrealized_plpc ?? '0');
        const isCrypto     = (pos as any).asset_class === 'crypto';

        return {
          id: `alpaca-${pos.symbol}-${userId}`,
          name: pos.symbol,
          symbol: pos.symbol,
          assetType: isCrypto ? 'crypto' : 'equity',
          assetClass: isCrypto ? 'Crypto (US)' : 'US Equity',
          quantity: qty,
          averageCost: avgPriceUsd * rate,
          currentPrice: (mktValueUsd / (qty || 1)) * rate,
          currentValue: mktValueUsd * rate,
          investedValue: avgPriceUsd * qty * rate,
          unrealizedGain: plUsd * rate,
          unrealizedGainPercent: plPct * 100,
          broker: 'Alpaca',
          source: 'api',
          dataProvider: 'alpaca',
          lastUpdated: new Date().toISOString(),
          confidenceScore: 100,
        };
      });
    } catch (err: any) {
      console.warn('[UnifiedHoldings] Alpaca fetch skipped:', err?.message);
      return [];
    }
  }

  /**
   * Get holdings for a prospect from currentPortfolio JSON
   */
  private async getProspectHoldings(prospectId: string): Promise<UnifiedHolding[]> {
    const [prospect] = await db
      .select({ currentPortfolio: prospectClients.currentPortfolio })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect?.currentPortfolio) {
      return [];
    }

    const holdings = prospect.currentPortfolio as any[];
    return holdings.map(h => this.normalizeToUnifiedFormat(h, 'prospect'));
  }

  /**
   * Get holdings for a registered client from comprehensiveHoldings table
   */
  private async getRegisteredClientHoldings(userId: string): Promise<UnifiedHolding[]> {
    const holdings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(eq(comprehensiveHoldings.userId, userId));

    if (holdings.length === 0) {
      const legacyHoldings = await this.getLegacyPortfolioHoldings(userId);
      return legacyHoldings;
    }

    return holdings.map(h => this.mapComprehensiveToUnified(h));
  }

  /**
   * Fallback: Get holdings from legacy portfolioHoldings table
   * Used during migration period for older registered clients
   */
  private async getLegacyPortfolioHoldings(userId: string): Promise<UnifiedHolding[]> {
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);

    if (!portfolio) return [];

    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolio.id));

    return holdings.map(h => ({
      id: h.id,
      name: h.name || h.symbol || 'Unknown',
      isin: h.isin || undefined,
      symbol: h.symbol || undefined,
      assetType: h.assetType || 'equity',
      quantity: Number(h.quantity) || 0,
      averageCost: (h as any).avgCostPerUnit ? Number((h as any).avgCostPerUnit) : undefined,
      currentPrice: (h as any).currentPrice ? Number((h as any).currentPrice) : undefined,
      currentValue: Number((h as any).currentValue) || 0,
      investedValue: Number((h as any).investedAmount || (h as any).investedValue) || undefined,
      unrealizedGain: (h as any).returns ? Number((h as any).returns) : undefined,
      unrealizedGainPercent: (h as any).returnsPercent ? Number((h as any).returnsPercent) : undefined,
      folioNumber: (h as any).folioNumber || undefined,
      broker: (h as any).broker || undefined,
      source: 'manual' as const,
      lastUpdated: (h as any).lastUpdated?.toISOString(),
    }));
  }

  /**
   * Map comprehensive holding to unified format
   */
  private mapComprehensiveToUnified(h: ComprehensiveHolding): UnifiedHolding {
    return {
      id: h.id,
      name: h.assetName,
      isin: h.isin || undefined,
      symbol: h.symbol,
      assetType: h.assetType,
      assetClass: h.assetClass || undefined,
      quantity: Number(h.quantity) || 0,
      averageCost: h.avgCostPerUnit ? Number(h.avgCostPerUnit) : undefined,
      currentPrice: h.currentPrice ? Number(h.currentPrice) : undefined,
      currentValue: Number(h.marketValue) || 0,
      investedValue: Number((h as any).costBasis) || undefined,
      unrealizedGain: h.unrealizedGainLoss ? Number(h.unrealizedGainLoss) : undefined,
      unrealizedGainPercent: h.unrealizedGainLossPercent ? Number(h.unrealizedGainLossPercent) : undefined,
      folioNumber: (h as any).folio || undefined,
      dematAccountNumber: (h as any).dematAccountNumber || undefined,
      depository: (h as any).depository as 'NSDL' | 'CDSL' | undefined,
      source: (h.dataSource as any) || 'api',
      dataProvider: h.dataSource || undefined,
      lastUpdated: h.lastUpdated?.toISOString(),
    };
  }

  /**
   * Normalize any holding format to unified format
   */
  private normalizeToUnifiedFormat(h: any, source: 'prospect' | 'registered'): UnifiedHolding {
    return {
      id: h.id || nanoid(),
      name: h.name || h.schemeName || h.assetName || h.symbol || 'Unknown',
      isin: h.isin || undefined,
      symbol: h.symbol || undefined,
      assetType: this.normalizeAssetType(h.assetType),
      assetClass: h.assetClass || h.category || undefined,
      quantity: Number(h.quantity || h.units) || 0,
      averageCost: h.averageCost || h.avgCostPerUnit || undefined,
      currentPrice: h.currentPrice || h.currentNav || h.nav || undefined,
      currentValue: Number(h.currentValue || h.marketValue) || 0,
      investedValue: Number(h.investedValue || h.costBasis) || undefined,
      unrealizedGain: h.unrealizedGain || h.gain || undefined,
      unrealizedGainPercent: h.unrealizedGainPercent || undefined,
      folioNumber: h.folioNumber || h.folio || undefined,
      dematAccountNumber: h.dematAccountNumber || undefined,
      broker: h.broker || undefined,
      purchaseDate: h.purchaseDate || undefined,
      lots: h.lots || undefined,
      source: h.source || 'manual',
      confidenceScore: h.confidenceScore || undefined,
      lastUpdated: h.lastUpdated || new Date().toISOString(),
    };
  }

  /**
   * Get portfolio summary for a client
   */
  async getPortfolioSummary(clientId: string): Promise<PortfolioSummary> {
    const holdings = await this.getHoldings(clientId);
    
    const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const totalInvested = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    const assetAllocation = {
      equity: 0,
      debt: 0,
      hybrid: 0,
      gold: 0,
      cash: 0,
      other: 0,
    };

    holdings.forEach(h => {
      const value = h.currentValue || 0;
      const type = h.assetType?.toLowerCase() || 'other';
      
      if (['equity', 'stock', 'etf', 'reit', 'invit'].includes(type)) {
        assetAllocation.equity += value;
      } else if (['debt', 'bond', 'ncd', 'gsec', 'fixed_deposit'].includes(type)) {
        assetAllocation.debt += value;
      } else if (['hybrid', 'balanced'].includes(type)) {
        assetAllocation.hybrid += value;
      } else if (['gold', 'sgb', 'commodity'].includes(type)) {
        assetAllocation.gold += value;
      } else if (['cash', 'liquid', 'money_market'].includes(type)) {
        assetAllocation.cash += value;
      } else {
        assetAllocation.other += value;
      }
    });

    return {
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      holdingsCount: holdings.length,
      assetAllocation,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Clear all holdings for a client (used before auto-sync refresh)
   */
  async clearAllHoldings(clientId: string, reason: string): Promise<{ cleared: number }> {
    const clientType = await this.getClientType(clientId);

    if (clientType.isProspect && !clientType.isRegistered) {
      await db.update(prospectClients)
        .set({ 
          currentPortfolio: [],
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, clientId));
      
      console.log(`[UnifiedHoldingsReader] Cleared prospect holdings for ${clientId}: ${reason}`);
      return { cleared: 1 };
    }

    if (clientType.isRegistered) {
      const deleted = await db.delete(comprehensiveHoldings)
        .where(eq(comprehensiveHoldings.userId, clientId))
        .returning();

      console.log(`[UnifiedHoldingsReader] Cleared ${deleted.length} holdings for registered client ${clientId}: ${reason}`);
      return { cleared: deleted.length };
    }

    return { cleared: 0 };
  }

  /**
   * Check if client has any holdings
   */
  async hasHoldings(clientId: string): Promise<boolean> {
    const holdings = await this.getHoldings(clientId);
    return holdings.length > 0;
  }

  /**
   * Get holdings with duplicate detection
   */
  async getHoldingsWithDuplicates(clientId: string): Promise<{
    holdings: UnifiedHolding[];
    duplicates: Array<{ isin: string; folioNumber?: string; count: number }>;
  }> {
    const holdings = await this.getHoldings(clientId);
    const seen = new Map<string, number>();
    const duplicates: Array<{ isin: string; folioNumber?: string; count: number }> = [];

    holdings.forEach(h => {
      const key = `${h.isin || ''}-${h.folioNumber || ''}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });

    seen.forEach((count, key) => {
      if (count > 1) {
        const [isin, folioNumber] = key.split('-');
        duplicates.push({ isin, folioNumber: folioNumber || undefined, count });
      }
    });

    return { holdings, duplicates };
  }

  private normalizeAssetType(type: string | undefined): string {
    if (!type) return 'equity';
    const lower = type.toLowerCase();
    if (['mutual_fund', 'mf', 'mutualfund'].includes(lower)) return 'mutual_fund';
    if (['equity', 'stock', 'stocks', 'us_equity', 'us equity'].includes(lower)) return 'equity';
    if (['debt', 'bond', 'bonds', 'ncd'].includes(lower)) return 'debt';
    if (['gold', 'sgb'].includes(lower)) return 'gold';
    if (['etf'].includes(lower)) return 'etf';
    if (['reit', 'invit'].includes(lower)) return 'reit';
    if (['crypto', 'cryptocurrency'].includes(lower)) return 'equity'; // crypto treated as equity for allocation
    return type;
  }
}

export const unifiedHoldingsReaderService = new UnifiedHoldingsReaderService();
