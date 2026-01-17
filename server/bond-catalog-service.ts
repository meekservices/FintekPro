/**
 * Bond Catalog Caching Service
 * 
 * Manages caching and synchronization of bond data from NSE NCB and BSE Bond APIs
 * to the database for faster access and offline availability.
 */

import { db } from './db';
import { governmentSecurities, corporateBonds, GovernmentSecurity, CorporateBond } from '@shared/schema';
import { nseNcbApi } from './nseNcbApi';
import { bseBondApi } from './bseBondApi';
import { eq } from 'drizzle-orm';

export interface BondRefreshResult {
  gsec: { count: number; error?: string };
  corporate: { count: number; error?: string };
  sgb: { count: number; error?: string };
  taxFree: { count: number; error?: string };
  infrastructure: { count: number; error?: string };
}

export interface BondCatalogStatus {
  isRefreshing: boolean;
  schedulerActive: boolean;
  lastRefreshTime: Date | null;
  lastRefreshResults: BondRefreshResult | null;
  refreshIntervalMs: number;
}

export class BondCatalogService {
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour
  
  private isRefreshing: boolean = false;
  private lastRefreshTime: Date | null = null;
  private lastRefreshResults: BondRefreshResult | null = null;
  
  /**
   * Get current status of the bond catalog service
   */
  getStatus(): BondCatalogStatus {
    return {
      isRefreshing: this.isRefreshing,
      schedulerActive: this.refreshInterval !== null,
      lastRefreshTime: this.lastRefreshTime,
      lastRefreshResults: this.lastRefreshResults,
      refreshIntervalMs: this.REFRESH_INTERVAL_MS
    };
  }
  
  /**
   * Start automatic bond catalog refresh
   */
  startAutoRefresh(intervalMs: number = this.REFRESH_INTERVAL_MS) {
    if (this.refreshInterval) {
      console.log('⚠️ Bond catalog auto-refresh already running');
      return;
    }
    
    console.log('🔄 Starting bond catalog auto-refresh...');
    
    // Initial refresh
    this.refreshAllBonds().catch(err => 
      console.error('Error in initial bond catalog refresh:', err)
    );
    
    // Schedule periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshAllBonds().catch(err => 
        console.error('Error in bond catalog refresh:', err)
      );
    }, intervalMs);
  }
  
  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ Stopped bond catalog auto-refresh');
    }
  }
  
  /**
   * Refresh all bonds from all sources
   */
  async refreshAllBonds(): Promise<BondRefreshResult> {
    if (this.isRefreshing) {
      console.log('⚠️ Bond refresh already in progress');
      return this.lastRefreshResults || {
        gsec: { count: 0 }, corporate: { count: 0 }, sgb: { count: 0 },
        taxFree: { count: 0 }, infrastructure: { count: 0 }
      };
    }
    
    this.isRefreshing = true;
    console.log('🔄 Refreshing bond catalog from NSE and BSE...');
    
    const results: BondRefreshResult = {
      gsec: { count: 0 },
      corporate: { count: 0 },
      sgb: { count: 0 },
      taxFree: { count: 0 },
      infrastructure: { count: 0 }
    };
    
    try {
      const [gsec, corporate, sgb, taxFree, infra] = await Promise.allSettled([
        this.refreshGovernmentSecurities(),
        this.refreshCorporateBonds(),
        this.refreshSovereignGoldBonds(),
        this.refreshTaxFreeBonds(),
        this.refreshInfrastructureBonds()
      ]);
      
      results.gsec = gsec.status === 'fulfilled' ? { count: gsec.value } : { count: 0, error: (gsec as PromiseRejectedResult).reason?.message };
      results.corporate = corporate.status === 'fulfilled' ? { count: corporate.value } : { count: 0, error: (corporate as PromiseRejectedResult).reason?.message };
      results.sgb = sgb.status === 'fulfilled' ? { count: sgb.value } : { count: 0, error: (sgb as PromiseRejectedResult).reason?.message };
      results.taxFree = taxFree.status === 'fulfilled' ? { count: taxFree.value } : { count: 0, error: (taxFree as PromiseRejectedResult).reason?.message };
      results.infrastructure = infra.status === 'fulfilled' ? { count: infra.value } : { count: 0, error: (infra as PromiseRejectedResult).reason?.message };
      
      this.lastRefreshTime = new Date();
      this.lastRefreshResults = results;
      
      console.log('✅ Bond catalog refresh completed successfully');
      return results;
    } catch (error) {
      console.error('❌ Error refreshing bond catalog:', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Refresh government securities (G-Secs, T-Bills, SDLs)
   * Throws on error so caller can handle and track failures
   */
  async refreshGovernmentSecurities(): Promise<number> {
    const auctions = await nseNcbApi.getUpcomingAuctions();
    const yieldCurve = await nseNcbApi.getYieldCurve();
    
    for (const auction of auctions) {
      const existing = await db
        .select()
        .from(governmentSecurities)
        .where(eq(governmentSecurities.isin, auction.isin))
        .limit(1);
      
      const securityData = {
        isin: auction.isin,
        securityName: auction.securityName,
        securityType: auction.securityType,
        issuer: auction.issuer,
        issueDate: auction.auctionDate,
        maturityDate: auction.maturityDate,
        faceValue: '100',
        couponRate: auction.couponRate?.toString() || '0',
        couponFrequency: auction.couponRate ? 'semi_annual' : 'zero_coupon',
        currentPrice: auction.cutOffPrice?.toString() || '100',
        yieldToMaturity: auction.cutOffYield?.toString() || '0',
        creditRating: 'AAA',
        ratingAgency: 'Government of India',
        minimumInvestment: auction.minimumBid?.toString() || '10000',
        tradingStatus: auction.status === 'ongoing' ? 'active' : 'upcoming',
        lastUpdated: new Date()
      };
      
      if (existing.length > 0) {
        await db
          .update(governmentSecurities)
          .set(securityData)
          .where(eq(governmentSecurities.isin, auction.isin));
      } else {
        await db
          .insert(governmentSecurities)
          .values(securityData);
      }
    }
    
    console.log(`✅ Refreshed ${auctions.length} government securities`);
    return auctions.length;
  }
  
  /**
   * Refresh corporate bonds from BSE
   * Throws on error so caller can handle and track failures
   */
  async refreshCorporateBonds(): Promise<number> {
    const bonds = await bseBondApi.getTradableBonds();
    
    for (const bond of bonds) {
      const existing = await db
        .select()
        .from(corporateBonds)
        .where(eq(corporateBonds.isin, bond.isin))
        .limit(1);
      
      const bondData = {
        isin: bond.isin,
        securityCode: bond.securityCode,
        bondName: bond.bondName,
        issuer: bond.issuer,
        bondType: bond.bondType,
        issueDate: new Date().toISOString().split('T')[0],
        maturityDate: bond.maturityDate,
        faceValue: bond.faceValue.toString(),
        couponType: bond.couponType,
        couponRate: bond.couponRate.toString(),
        couponFrequency: bond.couponFrequency,
        currentPrice: bond.currentPrice.toString(),
        yieldToMaturity: bond.yieldToMaturity.toString(),
        creditRating: bond.creditRating,
        ratingAgency: bond.ratingAgency,
        minimumLotSize: bond.minimumLotSize.toString(),
        tradingStatus: bond.tradingStatus,
        lastTradedPrice: bond.lastTradedPrice.toString(),
        volume: bond.volume.toString(),
        lastUpdated: new Date()
      };
      
      if (existing.length > 0) {
        await db
          .update(corporateBonds)
          .set(bondData)
          .where(eq(corporateBonds.isin, bond.isin));
      } else {
        await db
          .insert(corporateBonds)
          .values(bondData);
      }
    }
    
    console.log(`✅ Refreshed ${bonds.length} corporate bonds`);
    return bonds.length;
  }
  
  /**
   * Refresh Sovereign Gold Bonds
   * Throws on error so caller can handle and track failures
   */
  async refreshSovereignGoldBonds(): Promise<number> {
    const sgbs = await nseNcbApi.getSGBData();
    
    for (const sgb of sgbs) {
      const existing = await db
        .select()
        .from(governmentSecurities)
        .where(eq(governmentSecurities.isin, sgb.isin))
        .limit(1);
      
      const sgbData = {
        isin: sgb.isin,
        securityName: sgb.securityName,
        securityType: sgb.securityType,
        issuer: sgb.issuer,
        issueDate: sgb.subscriptionStartDate,
        maturityDate: sgb.maturityDate,
        faceValue: sgb.goldWeight.toString(),
        couponRate: sgb.couponRate.toString(),
        couponFrequency: 'semi_annual',
        currentPrice: sgb.issuePrice.toString(),
        yieldToMaturity: sgb.yieldToMaturity?.toString() || sgb.couponRate.toString(),
        creditRating: sgb.creditRating,
        ratingAgency: sgb.ratingAgency,
        minimumInvestment: sgb.minimumInvestment.toString(),
        tradingStatus: sgb.tradingStatus,
        sgbGoldPrice: sgb.goldReferencePrice.toString(),
        sgbRedemptionValue: (sgb.goldReferencePrice * sgb.goldWeight).toString(),
        sgbEarlyRedemption: sgb.earlyRedemptionAllowed.toString(),
        lastUpdated: new Date()
      };
      
      if (existing.length > 0) {
        await db
          .update(governmentSecurities)
          .set(sgbData)
          .where(eq(governmentSecurities.isin, sgb.isin));
      } else {
        await db
          .insert(governmentSecurities)
          .values(sgbData);
      }
    }
    
    console.log(`✅ Refreshed ${sgbs.length} Sovereign Gold Bonds`);
    return sgbs.length;
  }
  
  /**
   * Refresh tax-free bonds
   * Throws on error so caller can handle and track failures
   */
  async refreshTaxFreeBonds(): Promise<number> {
    const taxFreeBonds = await bseBondApi.getTaxFreeBonds();
    
    for (const bond of taxFreeBonds) {
      const existing = await db
        .select()
        .from(corporateBonds)
        .where(eq(corporateBonds.isin, bond.isin))
        .limit(1);
      
      const bondData = {
        isin: bond.isin,
        securityCode: bond.securityCode,
        bondName: bond.bondName,
        issuer: bond.issuer,
        bondType: bond.bondType,
        issueDate: new Date().toISOString().split('T')[0],
        maturityDate: bond.maturityDate,
        faceValue: bond.faceValue.toString(),
        couponType: bond.couponType,
        couponRate: bond.couponRate.toString(),
        couponFrequency: bond.couponFrequency,
        currentPrice: bond.currentPrice.toString(),
        yieldToMaturity: bond.yieldToMaturity.toString(),
        creditRating: bond.creditRating,
        ratingAgency: bond.ratingAgency,
        minimumLotSize: bond.minimumLotSize.toString(),
        tradingStatus: bond.tradingStatus,
        lastTradedPrice: bond.lastTradedPrice.toString(),
        volume: bond.volume.toString(),
        taxBenefit: bond.taxBenefit,
        lastUpdated: new Date()
      };
      
      if (existing.length > 0) {
        await db
          .update(corporateBonds)
          .set(bondData)
          .where(eq(corporateBonds.isin, bond.isin));
      } else {
        await db
          .insert(corporateBonds)
          .values(bondData);
      }
    }
    
    console.log(`✅ Refreshed ${taxFreeBonds.length} tax-free bonds`);
    return taxFreeBonds.length;
  }
  
  /**
   * Refresh infrastructure bonds
   * Throws on error so caller can handle and track failures
   */
  async refreshInfrastructureBonds(): Promise<number> {
    const infraBonds = await bseBondApi.getInfrastructureBonds();
    
    for (const bond of infraBonds) {
      const existing = await db
        .select()
        .from(corporateBonds)
        .where(eq(corporateBonds.isin, bond.isin))
        .limit(1);
      
      const bondData = {
        isin: bond.isin,
        securityCode: bond.securityCode,
        bondName: bond.bondName,
        issuer: bond.issuer,
        bondType: bond.bondType,
        issueDate: new Date().toISOString().split('T')[0],
        maturityDate: bond.maturityDate,
        faceValue: bond.faceValue.toString(),
        couponType: bond.couponType,
        couponRate: bond.couponRate.toString(),
        couponFrequency: bond.couponFrequency,
        currentPrice: bond.currentPrice.toString(),
        yieldToMaturity: bond.yieldToMaturity.toString(),
        creditRating: bond.creditRating,
        ratingAgency: bond.ratingAgency,
        minimumLotSize: bond.minimumLotSize.toString(),
        tradingStatus: bond.tradingStatus,
        lastTradedPrice: bond.lastTradedPrice.toString(),
        volume: bond.volume.toString(),
        infraSector: bond.sector,
        infraProjectType: bond.projectType,
        lastUpdated: new Date()
      };
      
      if (existing.length > 0) {
        await db
          .update(corporateBonds)
          .set(bondData)
          .where(eq(corporateBonds.isin, bond.isin));
      } else {
        await db
          .insert(corporateBonds)
          .values(bondData);
      }
    }
    
    console.log(`✅ Refreshed ${infraBonds.length} infrastructure bonds`);
    return infraBonds.length;
  }
  
  /**
   * Get cached government securities
   */
  async getCachedGovernmentSecurities(filters?: {
    securityType?: string;
    minYield?: number;
    maxYield?: number;
  }) {
    let query = db.select().from(governmentSecurities);
    
    const results = await query;
    
    return results.filter((sec: GovernmentSecurity) => {
      if (filters?.securityType && sec.securityType !== filters.securityType) {
        return false;
      }
      
      const ytm = parseFloat(sec.yieldToMaturity || '0');
      if (filters?.minYield && ytm < filters.minYield) {
        return false;
      }
      if (filters?.maxYield && ytm > filters.maxYield) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get cached corporate bonds
   */
  async getCachedCorporateBonds(filters?: {
    bondType?: string;
    minRating?: string;
    minYield?: number;
    maxYield?: number;
  }) {
    let query = db.select().from(corporateBonds);
    
    const results = await query;
    
    return results.filter((bond: CorporateBond) => {
      if (filters?.bondType && bond.bondType !== filters.bondType) {
        return false;
      }
      
      if (filters?.minRating) {
        // Simple rating comparison (AAA > AA+ > AA > ...)
        const ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-'];
        const bondRatingIndex = ratings.indexOf(bond.creditRating || '');
        const minRatingIndex = ratings.indexOf(filters.minRating);
        
        if (bondRatingIndex === -1 || bondRatingIndex > minRatingIndex) {
          return false;
        }
      }
      
      const ytm = parseFloat(bond.yieldToMaturity || '0');
      if (filters?.minYield && ytm < filters.minYield) {
        return false;
      }
      if (filters?.maxYield && ytm > filters.maxYield) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Force refresh of specific bond by ISIN
   */
  async refreshBondByISIN(isin: string) {
    try {
      // Try to get from NSE first
      const gsecDetails = await nseNcbApi.getGSecDetails(isin);
      
      if (gsecDetails) {
        const existing = await db
          .select()
          .from(governmentSecurities)
          .where(eq(governmentSecurities.isin, isin))
          .limit(1);
        
        const securityData = {
          isin: gsecDetails.isin,
          securityName: gsecDetails.securityName,
          securityType: gsecDetails.securityType,
          issuer: gsecDetails.issuer,
          issueDate: gsecDetails.auctionDate,
          maturityDate: gsecDetails.maturityDate,
          faceValue: gsecDetails.faceValue?.toString() || '100',
          couponRate: gsecDetails.couponRate?.toString() || '0',
          couponFrequency: gsecDetails.frequency || 'semi_annual',
          currentPrice: gsecDetails.currentPrice?.toString() || '100',
          yieldToMaturity: gsecDetails.cutOffYield?.toString() || '0',
          creditRating: 'AAA',
          ratingAgency: 'Government of India',
          minimumInvestment: gsecDetails.minimumBid?.toString() || '10000',
          tradingStatus: 'active',
          lastUpdated: new Date()
        };
        
        if (existing.length > 0) {
          await db
            .update(governmentSecurities)
            .set(securityData)
            .where(eq(governmentSecurities.isin, isin));
        } else {
          await db
            .insert(governmentSecurities)
            .values(securityData);
        }
        
        console.log(`✅ Refreshed government security ${isin}`);
        return;
      }
      
      // Try BSE corporate bond
      const bondDetails = await bseBondApi.getBondDetails(isin);
      
      if (bondDetails) {
        const existing = await db
          .select()
          .from(corporateBonds)
          .where(eq(corporateBonds.isin, isin))
          .limit(1);
        
        const bondData = {
          isin: bondDetails.isin,
          securityCode: bondDetails.securityCode,
          bondName: bondDetails.bondName,
          issuer: bondDetails.issuer,
          bondType: bondDetails.bondType,
          issueDate: new Date().toISOString().split('T')[0],
          maturityDate: bondDetails.maturityDate,
          faceValue: bondDetails.faceValue.toString(),
          couponType: bondDetails.couponType,
          couponRate: bondDetails.couponRate.toString(),
          couponFrequency: bondDetails.couponFrequency,
          currentPrice: bondDetails.currentPrice.toString(),
          yieldToMaturity: bondDetails.yieldToMaturity.toString(),
          creditRating: bondDetails.creditRating,
          ratingAgency: bondDetails.ratingAgency,
          minimumLotSize: bondDetails.minimumLotSize.toString(),
          tradingStatus: bondDetails.tradingStatus,
          lastTradedPrice: bondDetails.lastTradedPrice.toString(),
          volume: bondDetails.volume.toString(),
          lastUpdated: new Date()
        };
        
        if (existing.length > 0) {
          await db
            .update(corporateBonds)
            .set(bondData)
            .where(eq(corporateBonds.isin, isin));
        } else {
          await db
            .insert(corporateBonds)
            .values(bondData);
        }
        
        console.log(`✅ Refreshed corporate bond ${isin}`);
      }
    } catch (error) {
      console.error(`Error refreshing bond ${isin}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const bondCatalogService = new BondCatalogService();
