/**
 * Valuation Service - Pre-IPO Valuations and Funding Data
 * 
 * Data sources (priority order):
 * 1. Crunchbase API (requires CRUNCHBASE_API_KEY - paid)
 * 2. FintekPro Own Data (stored valuations/deals)
 * 
 * This service is designed for SEBI-compliant unlisted stock marketplace.
 * Returns empty/unavailable when no real data is found (NO mock data).
 */

import { storage } from '../storage';
import type { UnlistedCompany } from '@shared/schema';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

export interface FundingRound {
  roundType: string; // seed, series_a, series_b, etc.
  amount: number;
  currency: string;
  date: string;
  leadInvestor?: string;
  investors?: string[];
  valuation?: number;
  valuationType?: 'pre_money' | 'post_money';
}

export interface ValuationData {
  currentValuation?: number;
  valuationCurrency: string;
  valuationDate?: string;
  valuationMethod?: string;
  fundingRounds: FundingRound[];
  totalFundingRaised?: number;
  lastFundingRound?: FundingRound;
  estimatedMarketCap?: number;
  source: 'crunchbase' | 'fintekpro' | 'mca' | 'calculated' | 'unavailable';
  confidence: 'high' | 'medium' | 'low' | 'none';
  lastUpdated?: string;
}

export interface CompanyValuationResult {
  companyId?: string;
  companyName: string;
  cin?: string;
  valuation: ValuationData;
  errors?: string[];
}

class ValuationService {
  private crunchbaseApiKey: string | undefined;
  private crunchbaseBaseUrl = 'https://api.crunchbase.com/api/v4';
  
  constructor() {
    this.crunchbaseApiKey = process.env.CRUNCHBASE_API_KEY;
  }
  
  /**
   * Check if Crunchbase API is available
   */
  isCrunchbaseAvailable(): boolean {
    return !!this.crunchbaseApiKey;
  }
  
  /**
   * Get valuation data from all available sources
   */
  async getValuationData(
    companyIdentifier: { cin?: string; name?: string; isin?: string; companyId?: string }
  ): Promise<CompanyValuationResult> {
    const errors: string[] = [];
    let company: UnlistedCompany | undefined;
    
    // Try to find company in our database
    if (companyIdentifier.companyId) {
      company = await storage.getUnlistedCompanyById(companyIdentifier.companyId) || undefined;
    } else if (companyIdentifier.cin) {
      company = await storage.getUnlistedCompanyByCIN(companyIdentifier.cin) || undefined;
    }
    
    const companyName = companyIdentifier.name || company?.name || 'Unknown';
    const cin = companyIdentifier.cin || company?.cin;
    
    // 1. Try Crunchbase (if available)
    if (this.isCrunchbaseAvailable() && companyName !== 'Unknown') {
      try {
        const crunchbaseData = await this.fetchFromCrunchbase(companyName);
        if (crunchbaseData) {
          return {
            companyId: company?.id,
            companyName,
            cin: cin || undefined,
            valuation: crunchbaseData,
          };
        }
      } catch (error) {
        errors.push(`Crunchbase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 2. Try FintekPro own data (stored deals and valuations)
    if (company?.id) {
      try {
        const fintekproData = await this.getFromFintekProData(company.id);
        if (fintekproData && fintekproData.source !== 'unavailable') {
          return {
            companyId: company.id,
            companyName,
            cin: cin || undefined,
            valuation: fintekproData,
          };
        }
      } catch (error) {
        errors.push(`FintekPro: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 3. Calculate estimated valuation from financials if available
    if (company?.id) {
      try {
        const calculatedData = await this.calculateFromFinancials(company.id);
        if (calculatedData && calculatedData.source !== 'unavailable') {
          return {
            companyId: company.id,
            companyName,
            cin: cin || undefined,
            valuation: calculatedData,
          };
        }
      } catch (error) {
        errors.push(`Calculation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // No valuation data available
    return {
      companyId: company?.id,
      companyName,
      cin: cin || undefined,
      valuation: {
        valuationCurrency: 'INR',
        fundingRounds: [],
        source: 'unavailable',
        confidence: 'none',
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  /**
   * Fetch valuation from Crunchbase API
   */
  private async fetchFromCrunchbase(companyName: string): Promise<ValuationData | null> {
    if (!this.crunchbaseApiKey) {
      return null;
    }
    
    try {
      // Search for organization
      const searchResponse = await fetchWithTimeout(
        `${this.crunchbaseBaseUrl}/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations&limit=3`,
        {
          headers: {
            'X-cb-user-key': this.crunchbaseApiKey,
            'Content-Type': 'application/json',
          },
          timeoutMs: 15_000,
        }
      );
      
      if (!searchResponse.ok) {
        console.error('[Valuation] Crunchbase search failed:', searchResponse.status);
        return null;
      }
      
      const searchData = await searchResponse.json();
      const entities = searchData.entities || [];
      
      if (entities.length === 0) {
        return null;
      }
      
      // Get the best match
      const orgPermalink = entities[0].identifier?.permalink;
      if (!orgPermalink) {
        return null;
      }
      
      // Fetch organization details
      const orgResponse = await fetchWithTimeout(
        `${this.crunchbaseBaseUrl}/entities/organizations/${orgPermalink}?field_ids=short_description,funding_rounds,funding_total,last_funding_at,last_funding_type,num_funding_rounds,equity_funding_total`,
        {
          headers: {
            'X-cb-user-key': this.crunchbaseApiKey,
            'Content-Type': 'application/json',
          },
          timeoutMs: 15_000,
        }
      );
      
      if (!orgResponse.ok) {
        console.error('[Valuation] Crunchbase org fetch failed:', orgResponse.status);
        return null;
      }
      
      const orgData = await orgResponse.json();
      const properties = orgData.properties || {};
      
      // Parse funding rounds
      const fundingRounds: FundingRound[] = [];
      const fundingTotal = properties.equity_funding_total?.value_usd || properties.funding_total?.value_usd;
      
      return {
        currentValuation: undefined, // Crunchbase requires higher tier for valuations
        valuationCurrency: 'USD',
        totalFundingRaised: fundingTotal,
        fundingRounds,
        source: 'crunchbase',
        confidence: fundingTotal ? 'high' : 'low',
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Valuation] Crunchbase error:', error);
      return null;
    }
  }
  
  /**
   * Get valuation from FintekPro stored data (deals, listings)
   */
  private async getFromFintekProData(companyId: string): Promise<ValuationData | null> {
    try {
      // Get recent deals for this company
      const deals = await storage.getUnlistedDealsByCompany(companyId);
      
      if (deals.length === 0) {
        return null;
      }
      
      // Calculate implied valuation from recent deals
      // Deal uses agreedPrice (total agreed price per share) and quantity
      const recentDeals = deals
        .filter(d => d.status === 'completed' && d.agreedPrice && d.quantity)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      if (recentDeals.length === 0) {
        return null;
      }
      
      const mostRecentDeal = recentDeals[0];
      const company = await storage.getUnlistedCompanyById(companyId);
      
      let estimatedMarketCap: number | undefined;
      // agreedPrice is price per share, calculate implied market cap
      if (company?.totalShares && mostRecentDeal.agreedPrice) {
        const totalShares = Number(company.totalShares);
        const pricePerShare = parseFloat(mostRecentDeal.agreedPrice);
        estimatedMarketCap = totalShares * pricePerShare;
      }
      
      return {
        currentValuation: estimatedMarketCap,
        valuationCurrency: 'INR',
        valuationDate: mostRecentDeal.createdAt?.toISOString(),
        valuationMethod: 'Recent transaction price',
        fundingRounds: [],
        estimatedMarketCap,
        source: 'fintekpro',
        confidence: recentDeals.length > 3 ? 'high' : recentDeals.length > 1 ? 'medium' : 'low',
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Valuation] FintekPro data error:', error);
      return null;
    }
  }
  
  /**
   * Calculate estimated valuation from financial data
   */
  private async calculateFromFinancials(companyId: string): Promise<ValuationData | null> {
    try {
      // Get latest financials
      const financials = await storage.getCompanyFinancials(companyId);
      const company = await storage.getUnlistedCompanyById(companyId);
      
      if (!financials || financials.length === 0) {
        return null;
      }
      
      // Sort by year, get most recent
      const sortedFinancials = [...financials].sort((a, b) => {
        const yearA = parseInt(a.financialYear.split('-')[0]) || 0;
        const yearB = parseInt(b.financialYear.split('-')[0]) || 0;
        return yearB - yearA;
      });
      
      const latest = sortedFinancials[0];
      
      // Calculate book value based valuation
      const networth = latest.networth ? parseFloat(latest.networth) : null;
      const pat = latest.pat ? parseFloat(latest.pat) : null;
      
      if (networth && networth > 0) {
        // Simple P/B based estimate (conservative 1.5x for unlisted)
        const estimatedValue = networth * 1.5;
        
        return {
          currentValuation: estimatedValue,
          valuationCurrency: 'INR',
          valuationDate: new Date().toISOString(),
          valuationMethod: 'Book value multiple (1.5x P/B)',
          fundingRounds: [],
          estimatedMarketCap: estimatedValue,
          source: 'calculated',
          confidence: 'low',
          lastUpdated: new Date().toISOString(),
        };
      }
      
      // Earnings based valuation
      if (pat && pat > 0) {
        // Conservative P/E of 15x for unlisted
        const estimatedValue = pat * 15;
        
        return {
          currentValuation: estimatedValue,
          valuationCurrency: 'INR',
          valuationDate: new Date().toISOString(),
          valuationMethod: 'Earnings multiple (15x P/E)',
          fundingRounds: [],
          estimatedMarketCap: estimatedValue,
          source: 'calculated',
          confidence: 'low',
          lastUpdated: new Date().toISOString(),
        };
      }
      
      return null;
    } catch (error) {
      console.error('[Valuation] Calculation error:', error);
      return null;
    }
  }
  
  /**
   * Get valuation status summary
   */
  getServiceStatus(): {
    crunchbaseAvailable: boolean;
    message: string;
  } {
    return {
      crunchbaseAvailable: this.isCrunchbaseAvailable(),
      message: this.isCrunchbaseAvailable()
        ? 'Crunchbase API configured'
        : 'Crunchbase API not configured - using FintekPro data and calculations only',
    };
  }
}

export const valuationService = new ValuationService();
