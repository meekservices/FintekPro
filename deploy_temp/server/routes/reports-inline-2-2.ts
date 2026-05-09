import { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { portfolioHoldings, mutualFunds, mutualFundAmcs, insertWatchlistSchema } from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, count, inArray, ilike } from 'drizzle-orm';
import { MultiSourceMFService } from '../services/multisource-mf-service';

const multiSourceMFService = new MultiSourceMFService(storage);

export function registerReportsInline22Routes(app: Express): void {
  app.get("/api/sebi/mutual-funds", async (req, res) => {
    try {
      // Return published mutual funds or redirect to public API
      const pageNum = parseInt(req.query.page as string || '1');
      const limitNum = parseInt(req.query.limit as string || '50');
      const offset = (pageNum - 1) * limitNum;
      
      const funds = await db.select()
        .from(mutualFunds)
        .where(eq(mutualFunds.isPublished, true))
        .limit(limitNum)
        .offset(offset);
      
      res.json({
        success: true,
        data: funds,
        source: 'sebi_registry'
      });
    } catch (error: any) {
      console.error("[SEBI MF API] Error:", error);
      res.json({ success: true, data: [], source: 'sebi_registry' });
    }
  });

  // Get AMCs with their published scheme counts for public display
  app.get("/api/public/mutual-funds/amcs", async (req, res) => {
    try {
      const amcs = await db.select()
        .from(mutualFundAmcs)
        .where(
          or(
            eq(mutualFundAmcs.regularPlansEnabled, true),
            eq(mutualFundAmcs.directPlansEnabled, true)
          )
        )
        .orderBy(asc(mutualFundAmcs.name));
      
      res.json({
        success: true,
        amcs: amcs.map(amc => ({
          id: amc.id,
          name: amc.name,
          displayName: amc.displayName || amc.name,
          logoUrl: amc.logoUrl,
          regularPlansEnabled: amc.regularPlansEnabled,
          directPlansEnabled: amc.directPlansEnabled,
          totalSchemes: amc.totalSchemes,
          publishedRegularSchemes: amc.publishedRegularSchemes,
          publishedDirectSchemes: amc.publishedDirectSchemes
        }))
      });
    } catch (error: any) {
      console.error("[Public MF API] Error fetching AMCs:", error);
      res.status(500).json({ success: false, error: error.message, amcs: [] });
    }
  });

  app.get("/api/mutual-funds", async (req, res) => {
    try {
      const { 
        category, 
        fundHouse, 
        nav_min, 
        nav_max, 
        sortBy = 'returns1Y', 
        sortOrder = 'desc',
        page = '1',
        limit = '50',
        query 
      } = req.query;
      
      console.log('📊 Fetching mutual funds with MultiSource MF service...');
      
      // Prepare search parameters
      const searchParams = {
        query: query as string,
        category: category as string,
        fundHouse: fundHouse as string,
        sortBy: sortBy as 'name' | 'nav' | 'returns1Y' | 'returns3Y' | 'returns5Y' | 'aum',
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await multiSourceMFService.listFunds(searchParams);
      
      // Transform MultiSource data to camelCase format for frontend compatibility
      const formattedFunds = result.funds.map((fund) => ({
        id: `mf-${fund.schemeCode}`,
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse,
        category: fund.category,
        subCategory: fund.subCategory || fund.category,
        nav: String(parseFloat(fund.currentNav || '0')),
        change: fund.change || '0',
        changePercent: fund.changePercent || '0',
        navDate: fund.navDate,
        aum: fund.aum || "N/A",
        expenseRatio: fund.expenseRatio || "N/A",
        minInvestment: 5000,
        fundManager: fund.manager || "N/A",
        benchmark: fund.benchmark || "N/A",
        launchDate: "N/A",
        returns: {
          "1D": null,
          "1W": null,
          "1M": fund.returns['1M'] || 0,
          "3M": null,
          "6M": fund.returns['6M'] || 0,
          "1Y": fund.returns['1Y'] || 0,
          "2Y": null,
          "3Y": fund.returns['3Y'] || 0,
          "5Y": fund.returns['5Y'] || 0,
          "since_inception": null
        },
        returnStrings: fund.returnStrings,
        riskLevel: fund.riskLevel,
        rating: 4,
        exitLoad: "1% if redeemed within 365 days",
        returns1y: fund.returns?.['1Y'],
        returns3y: fund.returns?.['3Y'],
        returns5y: fund.returns?.['5Y'],
        provenance: fund.provenance
      }));
      
      // Apply legacy filters if provided for backward compatibility
      let filteredFunds = formattedFunds;
      
      if (nav_min) {
        filteredFunds = filteredFunds.filter(fund => parseFloat(fund.nav) >= parseFloat(nav_min as string));
      }
      
      if (nav_max) {
        filteredFunds = filteredFunds.filter(fund => parseFloat(fund.nav) <= parseFloat(nav_max as string));
      }
      
      return res.json({
        success: true,
        data: filteredFunds,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
        source: 'MultiSource',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error in mutual funds endpoint:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch mutual funds",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/mutual-funds/popular", async (req, res) => {
    try {
      console.log("📈 Fetching best performing mutual funds with MultiSource service...");
      
      // Use MultiSource service for popular funds
      const popularFunds = await multiSourceMFService.getPopularFunds();
      
      if (popularFunds && popularFunds.length > 0) {
        console.log(`✅ MultiSource service found ${popularFunds.length} popular funds`);
        
        // Return top 30 funds for better variety (was 6, increased for comprehensive coverage)
        const topFunds = popularFunds.slice(0, 30);
        
        // Transform to camelCase format for frontend compatibility
        const formattedFunds = topFunds.map(fund => ({
          id: `multisource-${fund.schemeCode}`,
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse,
          category: fund.category,
          nav: String(parseFloat(fund.currentNav || fund.nav || '0')),
          change: fund.change || '0',
          changePercent: fund.changePercent || '0',
          navDate: fund.navDate || new Date().toISOString().split('T')[0],
          returns: fund.returns || {},
          returnStrings: fund.returnStrings || {},
          riskLevel: fund.riskLevel || 'Moderate',
          fintekproRating: fund.crisilRating || null,
          rating: fund.crisilRating || fund.rating || 4,
          minInvestment: fund.minInvestment || 5000,
          exitLoad: fund.exitLoad || '1% if redeemed within 365 days',
          expenseRatio: fund.expenseRatio,
          aum: fund.aum,
          returns1y: fund.returns?.['1Y'],
          returns3y: fund.returns?.['3Y'],
          returns5y: fund.returns?.['5Y'],
          provenance: fund.provenance
        }));
        
        // Cache the data for future use
        for (const fund of topFunds) {
          try {
            await storage.upsertMutualFund({
              schemeCode: fund.schemeCode,
              schemeName: fund.schemeName,
              category: fund.category,
              fundHouse: fund.fundHouse,
              nav: String(fund.currentNav || fund.nav || '0')
            });
          } catch (cacheError) {
            console.warn(`Failed to cache fund ${fund.schemeCode}:`, cacheError);
          }
        }
        
        return res.json({
          success: true,
          data: formattedFunds,
          total: formattedFunds.length,
          source: 'MultiSource',
          timestamp: new Date().toISOString()
        });
      }
      
      console.warn("⚠️ MultiSource service returned no popular funds, trying fallback...");
      
    // Fallback to cached data
    try {
        const cachedFunds = await storage.getAllMutualFunds();
        if (cachedFunds.length > 0) {
          console.log(`✅ Using cached data with ${cachedFunds.length} funds`);
          
          const topCachedFunds = cachedFunds.slice(0, 30);
          const formattedCached = topCachedFunds.map((fund, index) => ({
            id: `cache-${fund.schemeCode}`,
            scheme_code: fund.schemeCode,
            scheme_name: fund.schemeName,
            amc: fund.fundHouse,
            category: fund.category,
            nav: parseFloat(String(fund.nav)) || 0,
            nav_date: fund.lastUpdated ? fund.lastUpdated.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            returns: {
              '1M': 0,
              '6M': 0,
              '1Y': 0,
              '3Y': 0,
              '5Y': 0
            },
            returnStrings: {
              '1M': 'N/A',
              '6M': 'N/A',
              '1Y': 'N/A',
              '3Y': 'N/A',
              '5Y': 'N/A'
            },
            risk_level: 'Moderate',
            rating: 4,
            min_investment: 5000,
            exit_load: '1% if redeemed within 365 days'
          }));
          
          return res.json({
            success: true,
            data: formattedCached,
            total: formattedCached.length,
            source: 'Cache',
            timestamp: new Date().toISOString()
          });
        }
      } catch (cacheError) {
        console.warn("⚠️ Failed to fetch cached funds:", cacheError);
      }
      
      // Final fallback - return minimal data structure
      console.log("💡 Using minimal fallback data");
      const minimalFunds = [
        {
          id: 'fallback-119551',
          scheme_code: '119551',
          scheme_name: 'SBI BlueChip Fund - Direct Plan - Growth',
          amc: 'SBI Mutual Fund',
          category: 'Large Cap Fund',
          nav: 85.67,
          nav_date: new Date().toISOString().split('T')[0],
          returns: { '1M': 2.1, '6M': 8.5, '1Y': 15.3, '3Y': 12.7, '5Y': 11.2 },
          returnStrings: { '1M': '+2.1%', '6M': '+8.5%', '1Y': '+15.3%', '3Y': '+12.7%', '5Y': '+11.2%' },
          risk_level: 'Moderate',
          rating: 4,
          min_investment: 5000,
          exit_load: '1% if redeemed within 365 days'
        }
      ];
      
      return res.json({
        success: true,
        data: minimalFunds,
        total: minimalFunds.length,
        source: 'Fallback',
        message: 'Using fallback data as all primary sources are unavailable',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error fetching popular mutual funds:", error);
      
      // Return 503 Service Unavailable when no data is available from any source
      res.status(503).json({
        success: false,
        error: "Service temporarily unavailable",
        message: "All data sources are currently unavailable. Please try again later.",
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/mutual-funds/autocomplete", async (req, res) => {
    try {
      const { q, limit = '20' } = req.query;
      
      if (!q || String(q).length < 2) {
        return res.json({ success: true, funds: [] });
      }
      
      const searchPattern = `%${String(q).toLowerCase()}%`;
      const searchPatternUpper = `%${String(q).toUpperCase()}%`;
      
      const funds = await db.select({
        isin: mutualFunds.isin,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        fundHouse: mutualFunds.fundHouse,
        category: mutualFunds.category,
        nav: mutualFunds.nav,
        planType: mutualFunds.planType,
        extendedData: mutualFunds.extendedData
      })
      .from(mutualFunds)
      .where(
        or(
          sql`LOWER(${mutualFunds.schemeName}) LIKE ${searchPattern}`,
          sql`LOWER(${mutualFunds.fundHouse}) LIKE ${searchPattern}`,
          sql`UPPER(${mutualFunds.isin}) LIKE ${searchPatternUpper}`
        )
      )
      .limit(parseInt(limit as string));
      
      const results = funds.map(fund => ({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse || '',
        category: fund.category || '',
        nav: parseFloat(fund.nav || '0'),
        planType: fund.planType || 'Regular',
        isin: fund.isin || (fund.extendedData as any)?.isin || ''
      }));
      
      res.json({ success: true, funds: results });
    } catch (error) {
      console.error("Error in autocomplete search:", error);
      res.status(500).json({ success: false, error: "Search failed" });
    }
  });

  app.get("/api/mutual-funds/by-isin/:isin", async (req, res) => {
    try {
      const { isin } = req.params;
      
      if (!isin || isin.length !== 12) {
        return res.status(400).json({ success: false, error: 'Invalid ISIN format' });
      }
      
      const funds = await db.select({
        isin: mutualFunds.isin,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        fundHouse: mutualFunds.fundHouse,
        category: mutualFunds.category,
        nav: mutualFunds.nav,
        planType: mutualFunds.planType,
        extendedData: mutualFunds.extendedData
      })
      .from(mutualFunds)
      .where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
      .limit(1);
      
      if (funds.length === 0) {
        return res.status(404).json({ success: false, error: 'Fund not found for this ISIN' });
      }
      
      const fund = funds[0];
      res.json({
        success: true,
        fund: {
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse || '',
          category: fund.category || '',
          nav: parseFloat(fund.nav || '0'),
          planType: fund.planType || 'Regular',
          isin: fund.isin || (fund.extendedData as any)?.isin || ''
        }
      });
    } catch (error) {
      console.error("Error looking up fund by ISIN:", error);
      res.status(500).json({ success: false, error: "Lookup failed" });
    }
  });

  // Query param style search handler - MUST be before :schemeCode route to prevent shadowing
  app.get("/api/mutual-funds/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.status(400).json({ 
          success: false, 
          error: "Query too short",
          message: "Search query must be at least 2 characters"
        });
      }
      
      console.log(`🔍 Searching funds with query param: ${query}`);
      const searchResults = await multiSourceMFService.searchFunds(query);
      
      if (searchResults.length > 0) {
        console.log(`✅ Query param search found ${searchResults.length} funds`);
        return res.json({ success: true, data: searchResults });
      }
      
      return res.json({ success: true, data: [], message: "No funds found matching query" });
    } catch (error: any) {
      console.error("❌ Error in query param search:", error);
      return res.status(500).json({
        success: false,
        error: "Search failed",
        message: error.message
      });
    }
  });

  app.get("/api/mutual-funds/:schemeCode", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      console.log(`📊 Fetching fund details for scheme: ${schemeCode} with MultiSource service`);
      
      const fund = await multiSourceMFService.getFund(schemeCode);
      
      if (!fund) {
        return res.status(404).json({
          success: false,
          error: "Fund not found",
          message: `No data available for scheme code: ${schemeCode}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Transform to legacy API format for compatibility
      const formattedFund = {
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        category: fund.category,
        subCategory: fund.subCategory || fund.category,
        fundHouse: fund.fundHouse,
        nav: parseFloat(fund.currentNav || '0'),
        navDate: fund.navDate,
        isin: fund.isin || "N/A",
        aum: fund.aum || "N/A",
        expenseRatio: fund.expenseRatio || "N/A",
        minInvestment: 5000,
        exitLoad: "1% if redeemed within 365 days",
        benchmark: fund.benchmark || "N/A",
        fundManager: fund.manager || "N/A",
        launchDate: "N/A",
        riskLevel: fund.riskLevel || "Moderate",
        rating: 4,
        returns: fund.returns || {},
        returnStrings: fund.returnStrings || {},
        volatility: fund.volatility,
        sharpeRatio: fund.sharpeRatio,
        maxDrawdown: (fund as any).maxDrawdown,
        historicalData: (fund as any).historicalData || [],
        lastUpdated: fund.navDate,
        source: 'MultiSource',
        provenance: fund.provenance
      };
      
      return res.json({
        success: true,
        data: formattedFund,
        source: 'MultiSource',
        timestamp: new Date().toISOString()
      });
        
        /* LEGACY START: BSE/AMFI - to be removed 
        if (bseFundPerformance) {
          console.log(`✅ BSE service found fund: ${bseFundPerformance.schemeName}`);
          
          // Get historical NAV data
          const historicalNAV = await bseService.getHistoricalNAV(schemeCode);
          
          const fundData = {
            schemeCode: bseFundPerformance.schemeCode,
            schemeName: bseFundPerformance.schemeName,
            category: bseFundPerformance.category,
            subCategory: bseFundPerformance.subCategory || bseFundPerformance.category,
            fundHouse: bseFundPerformance.fundHouse,
            nav: bseFundPerformance.currentNav,
            navDate: bseFundPerformance.navDate,
            isin: bseFundPerformance.isin,
            aum: bseFundPerformance.aum || "N/A",
            expenseRatio: bseFundPerformance.expenseRatio || 1.2,
            minInvestment: bseFundPerformance.minInvestment || 5000,
            exitLoad: bseFundPerformance.exitLoad || "1% if redeemed within 365 days",
            benchmark: bseFundPerformance.benchmark || "N/A",
            fundManager: bseFundPerformance.fundManager || "N/A",
            launchDate: bseFundPerformance.launchDate || "N/A",
            riskLevel: bseFundPerformance.riskLevel,
            rating: bseFundPerformance.rating || 4,
            returns: bseFundPerformance.returns,
            returnStrings: bseFundPerformance.returnStrings,
            volatility: bseFundPerformance.volatility,
            sharpeRatio: bseFundPerformance.sharpeRatio,
            maxDrawdown: bseFundPerformance.maxDrawdown,
            historicalData: historicalNAV.slice(0, 365), // Last 1 year of data
            lastUpdated: bseFundPerformance.lastUpdated,
            source: 'BSE'
          };
          
          // Store/update in database for caching
          await storage.upsertMutualFund({
            schemeCode: fundData.schemeCode,
            schemeName: fundData.schemeName,
            category: fundData.category,
            fundHouse: fundData.fundHouse,
            nav: String(fundData.nav),
            lastUpdated: new Date()
          });
          
          return res.json({
            success: true,
            data: fundData,
            source: 'BSE',
            timestamp: new Date().toISOString()
          });
        }
      } catch (bseError) {
        console.warn(`⚠️ BSE service failed for ${schemeCode}, trying AMFI:`, bseError);
      }
      
      // Fallback to AMFI service
      try {
        const amfiFundPerformance = await amfiService.calculateFundPerformance(schemeCode);
        
        if (amfiFundPerformance) {
          console.log(`✅ AMFI fallback found fund: ${amfiFundPerformance.schemeName}`);
          
          const fundData = {
            schemeCode: amfiFundPerformance.schemeCode,
            schemeName: amfiFundPerformance.schemeName,
            category: amfiFundPerformance.category,
            subCategory: amfiFundPerformance.category,
            fundHouse: amfiFundPerformance.fundHouse,
            nav: amfiFundPerformance.currentNav,
            navDate: amfiFundPerformance.lastUpdated,
            returns: amfiFundPerformance.returns,
            returnStrings: amfiFundPerformance.returnStrings,
            historicalData: [], // AMFI service doesn't provide historical data in this format
            lastUpdated: amfiFundPerformance.lastUpdated,
            source: 'AMFI'
          };
          
          await storage.upsertMutualFund({
            schemeCode: fundData.schemeCode,
            schemeName: fundData.schemeName,
            category: fundData.category,
            fundHouse: fundData.fundHouse,
            nav: String(fundData.nav),
            lastUpdated: new Date()
          });
          
          return res.json({
            success: true,
            data: fundData,
            source: 'AMFI',
            timestamp: new Date().toISOString()
          });
        }
      } catch (amfiError) {
        console.error(`❌ AMFI service also failed for ${schemeCode}:`, amfiError);
      }
      
      // Final fallback - check database
      const cachedFund = await storage.getMutualFund(schemeCode);
      if (cachedFund) {
        return res.json({
          success: true,
          data: cachedFund,
          source: 'Cache',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(404).json({
        success: false,
        error: "Fund not found",
        message: `No data available for scheme code: ${schemeCode}`,
        timestamp: new Date().toISOString()
      });
      LEGACY END - to be removed */
      
    } catch (error) {
      console.error(`❌ Error fetching mutual fund ${req.params.schemeCode}:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch mutual fund details",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/mutual-funds/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      console.log(`🔍 Searching funds with query: ${query}`);
      
      // Use MultiSource service for search
      const searchResults = await multiSourceMFService.searchFunds(query);
      
      if (searchResults.length > 0) {
        console.log(`✅ MultiSource search found ${searchResults.length} funds`);
        
        // Transform MultiSource results to API format
        const formattedResults = searchResults.map(fund => ({
          id: `multisource-${fund.schemeCode}`,
          scheme_code: fund.schemeCode,
          scheme_name: fund.schemeName,
          amc: fund.fundHouse,
          category: fund.category,
          nav: fund.nav,
          nav_date: fund.navDate,
          returns: fund.returns,
          returnStrings: fund.returnStrings,
          riskLevel: fund.riskLevel,
          rating: fund.rating,
          provenance: fund.provenance
        }));
        
        return res.json({
          success: true,
          data: formattedResults,
          total: searchResults.length,
          query: query,
          source: 'MultiSource',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.json({
        success: true,
        data: [],
        total: 0,
        query: query,
        message: 'No funds found matching the search criteria',
        source: 'None',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ Error searching mutual funds for "${req.params.query}":`, error);
      res.status(500).json({
        success: false,
        error: "Failed to search mutual funds",
        message: error instanceof Error ? error.message : 'Unknown error',
        query: req.params.query
      });
    }
  });

}
