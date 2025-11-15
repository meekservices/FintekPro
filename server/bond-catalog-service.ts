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

export class BondCatalogService {
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour
  
  /**
   * Start automatic bond catalog refresh
   */
  startAutoRefresh(intervalMs: number = this.REFRESH_INTERVAL_MS) {
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
  async refreshAllBonds() {
    console.log('🔄 Refreshing bond catalog from NSE and BSE...');
    
    try {
      await Promise.all([
        this.refreshGovernmentSecurities(),
        this.refreshCorporateBonds(),
        this.refreshSovereignGoldBonds(),
        this.refreshTaxFreeBonds(),
        this.refreshInfrastructureBonds()
      ]);
      
      console.log('✅ Bond catalog refresh completed successfully');
    } catch (error) {
      console.error('❌ Error refreshing bond catalog:', error);
      throw error;
    }
  }
  
  /**
   * Refresh government securities (G-Secs, T-Bills, SDLs)
   */
  async refreshGovernmentSecurities() {
    try {
      // Fetch upcoming auctions from NSE NCB
      const auctions = await nseNcbApi.getUpcomingAuctions();
      
      // Fetch yield curve for current market pricing
      const yieldCurve = await nseNcbApi.getYieldCurve();
      
      for (const auction of auctions) {
        // Check if security already exists
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
          // Update existing security
          await db
            .update(governmentSecurities)
            .set(securityData)
            .where(eq(governmentSecurities.isin, auction.isin));
        } else {
          // Insert new security
          await db
            .insert(governmentSecurities)
            .values(securityData);
        }
      }
      
      console.log(`✅ Refreshed ${auctions.length} government securities`);
    } catch (error) {
      console.error('Error refreshing government securities:', error);
    }
  }
  
  /**
   * Refresh corporate bonds from BSE
   */
  async refreshCorporateBonds() {
    try {
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
    } catch (error) {
      console.error('Error refreshing corporate bonds:', error);
    }
  }
  
  /**
   * Refresh Sovereign Gold Bonds
   */
  async refreshSovereignGoldBonds() {
    try {
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
    } catch (error) {
      console.error('Error refreshing SGBs:', error);
    }
  }
  
  /**
   * Refresh tax-free bonds
   */
  async refreshTaxFreeBonds() {
    try {
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
    } catch (error) {
      console.error('Error refreshing tax-free bonds:', error);
    }
  }
  
  /**
   * Refresh infrastructure bonds
   */
  async refreshInfrastructureBonds() {
    try {
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
    } catch (error) {
      console.error('Error refreshing infrastructure bonds:', error);
    }
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
