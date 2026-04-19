import { Express, Request, Response } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { eq, and, count } from 'drizzle-orm';
import { corporateBonds, mutualFunds } from '@shared/schema';
import { nseNcbApi } from '../nseNcbApi';
import { bseBondApi } from '../bseBondApi';

// Centralized error message utility
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function registerBondsMarkPart3Routes(app: Express): void {
  app.get("/api/bonds/filter/rating", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const ratings = req.query.ratings ? (req.query.ratings as string).split(',') : ['AAA'];
      const bonds = await bseBondApi.getBondsByRating(ratings);

      res.json({
        status: "success",
        data: bonds,
        ratings: ratings,
        count: bonds.length
      });
    } catch (error) {
      console.error("Error fetching bonds by rating:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get bonds by yield range
  app.get("/api/bonds/filter/yield", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const minYield = req.query.min ? parseFloat(req.query.min as string) : 0;
      const maxYield = req.query.max ? parseFloat(req.query.max as string) : 15;
      
      const bonds = await bseBondApi.getBondsByYieldRange(minYield, maxYield);

      res.json({
        status: "success",
        data: bonds,
        yieldRange: { min: minYield, max: maxYield },
        count: bonds.length
      });
    } catch (error) {
      console.error("Error fetching bonds by yield:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get bonds by maturity
  app.get("/api/bonds/filter/maturity", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const params = {
        minYears: req.query.minYears ? parseInt(req.query.minYears as string) : undefined,
        maxYears: req.query.maxYears ? parseInt(req.query.maxYears as string) : undefined,
        exactYears: req.query.exactYears ? parseInt(req.query.exactYears as string) : undefined
      };
      
      const bonds = await bseBondApi.getBondsByMaturity(params);

      res.json({
        status: "success",
        data: bonds,
        maturityFilter: params,
        count: bonds.length
      });
    } catch (error) {
      console.error("Error fetching bonds by maturity:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get tax-free bonds
  app.get("/api/bonds/tax-free-bonds", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const bonds = await bseBondApi.getTaxFreeBonds();

      res.json({
        status: "success",
        data: bonds,
        count: bonds.length,
        message: "Tax-free bonds with interest exempt from taxation"
      });
    } catch (error) {
      console.error("Error fetching tax-free bonds:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get infrastructure bonds
  app.get("/api/bonds/infrastructure-bonds", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const bonds = await bseBondApi.getInfrastructureBonds();

      res.json({
        status: "success",
        data: bonds,
        count: bonds.length,
        message: "Infrastructure bonds for long-term infrastructure projects"
      });
    } catch (error) {
      console.error("Error fetching infrastructure bonds:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get NSE NCB yield curve data
  app.get("/api/bonds/yield-curve", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const yieldCurve = await nseNcbApi.getYieldCurve();

      res.json({
        status: "success",
        data: yieldCurve,
        message: "Government securities yield curve across all tenors"
      });
    } catch (error: unknown) {
      console.warn(`[NSE] Yield curve fetch failed: ${errorMessage(error)}`);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get historical auction results
  app.get("/api/bonds/auctions/historical", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const params = {
        securityType: req.query.securityType as string,
        fromDate: req.query.from as string,
        toDate: req.query.to as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10
      };

      const auctions = await nseNcbApi.getHistoricalAuctions(params);

      res.json({
        status: "success",
        data: auctions,
        filters: params,
        count: auctions.length
      });
    } catch (error: unknown) {
      console.warn(`[NSE] Historical auctions fetch failed: ${errorMessage(error)}`);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get Sovereign Gold Bonds data
  app.get("/api/bonds/sgb", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const sgbs = await nseNcbApi.getSGBData();

      res.json({
        status: "success",
        data: sgbs,
        count: sgbs.length,
        message: "Sovereign Gold Bonds - gold-backed government securities"
      });
    } catch (error: unknown) {
      console.warn(`[NSE] SGB data fetch failed: ${errorMessage(error)}`);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get real-time bond market prices
  app.post("/api/bonds/market-prices", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const { isins } = req.body;
      
      if (!isins || !Array.isArray(isins)) {
        res.status(400).json({
          status: "error",
          error: "ISINs array is required"
        });
        return;
      }

      const prices = await nseNcbApi.getMarketPrices(isins);

      res.json({
        status: "success",
        data: prices,
        count: prices.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching market prices:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get bonds market overview
  app.get("/api/bonds/market-overview", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      const marketOverview = {
        totalMarketSize: "₹45,68,450 Cr",
        dailyTurnover: "₹12,340 Cr",
        averageYield: "7.25%",
        topPerformer: "HDFC Bank 8.25% 2027",
        bondCount: 1250,
        governmentBonds: 450,
        corporateBonds: 620,
        taxFreeBonds: 180,
        yieldCurve: [
          { maturity: "1Y", yield: 6.85 },
          { maturity: "3Y", yield: 7.12 },
          { maturity: "5Y", yield: 7.35 },
          { maturity: "10Y", yield: 7.58 },
          { maturity: "15Y", yield: 7.72 },
          { maturity: "20Y", yield: 7.85 }
        ],
        sectorAllocation: [
          { sector: "Government", percentage: 45, amount: "₹20,55,803 Cr" },
          { sector: "Banking", percentage: 25, amount: "₹11,42,113 Cr" },
          { sector: "Infrastructure", percentage: 15, amount: "₹6,85,268 Cr" },
          { sector: "Corporate", percentage: 15, amount: "₹6,85,268 Cr" }
        ]
      };

      res.json({
        status: "success",
        data: marketOverview
      });
    } catch (error) {
      console.error("Error fetching bonds market overview:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get MCX listed bonds data (commodity-linked bonds)
  app.get("/api/bonds/mcx-listed", requireLevel2, async (req: Request, res: Response): Promise<void> => {
    try {
      // MCX commodity-linked bonds and structured products
      const mcxBonds = [
        {
          id: "mcx-agri-1",
          symbol: "MCXAGRI001",
          name: "MCX Gold-Linked Bond 2030",
          exchange: "MCX",
          type: "Commodity-Linked Bond",
          issuer: "Multi Commodity Exchange of India",
          underlyingAsset: "Gold",
          maturityDate: "2030-03-20",
          couponRate: 6.85,
          faceValue: 10000,
          currentPrice: 10245.80,
          prevClose: 10225.00,
          change: 20.80,
          changePercent: 0.20,
          currentYield: 6.69,
          ytm: 6.75,
          duration: 5.3,
          rating: "AA+",
          volume: "₹450 Cr",
          marketCap: "₹4,520 Cr",
          lastTradedTime: "15:25:00",
          bidPrice: 10240.00,
          askPrice: 10250.00,
          segment: "Commodity",
          goldPrice: "₹72,450/10g",
          linkageRatio: "1:1.2"
        },
        {
          id: "mcx-agri-2", 
          symbol: "MCXAGRI002",
          name: "MCX Silver-Linked NCD 2028",
          exchange: "MCX",
          type: "Commodity-Linked Bond",
          issuer: "Agricultural Finance Corporation",
          underlyingAsset: "Silver",
          maturityDate: "2028-09-15",
          couponRate: 7.25,
          faceValue: 5000,
          currentPrice: 5180.45,
          prevClose: 5165.00,
          change: 15.45,
          changePercent: 0.30,
          currentYield: 7.01,
          ytm: 7.08,
          duration: 3.8,
          rating: "AA",
          volume: "₹285 Cr",
          marketCap: "₹2,890 Cr",
          lastTradedTime: "15:22:30",
          bidPrice: 5175.00,
          askPrice: 5185.00,
          segment: "Precious Metals",
          silverPrice: "₹94,250/kg",
          linkageRatio: "1:1.5"
        }
      ];

      res.json({
        status: "success",
        data: mcxBonds,
        exchange: "MCX",
        totalBonds: mcxBonds.length,
        specialization: "Commodity-Linked Bonds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching MCX bonds data:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get NCDEX listed bonds data (agricultural commodity bonds)
  app.get("/api/bonds/ncdex-listed", async (req: Request, res: Response): Promise<void> => {
    try {
      // NCDEX agricultural commodity-linked bonds
      const ncdexBonds = [
        {
          id: "ncdex-agri-1",
          symbol: "NCDXAGRI001",
          name: "NCDEX Wheat-Linked Bond 2029",
          exchange: "NCDEX",
          type: "Agricultural Bond",
          issuer: "National Commodity & Derivatives Exchange",
          underlyingAsset: "Wheat",
          maturityDate: "2029-04-30",
          couponRate: 7.45,
          faceValue: 25000,
          currentPrice: 25680.50,
          prevClose: 25620.00,
          change: 60.50,
          changePercent: 0.24,
          currentYield: 7.25,
          ytm: 7.32,
          duration: 4.5,
          rating: "AA+",
          volume: "₹320 Cr",
          marketCap: "₹3,240 Cr",
          lastTradedTime: "15:20:00",
          bidPrice: 25675.00,
          askPrice: 25685.00,
          segment: "Agricultural",
          commodityPrice: "₹2,580/quintal",
          linkageRatio: "1:10",
          seasonality: "Rabi Crop"
        },
        {
          id: "ncdex-agri-2",
          symbol: "NCDXAGRI002", 
          name: "NCDEX Cotton-Linked NCD 2030",
          exchange: "NCDEX",
          type: "Agricultural Bond",
          issuer: "Cotton Corporation of India",
          underlyingAsset: "Cotton",
          maturityDate: "2030-12-31",
          couponRate: 7.80,
          faceValue: 50000,
          currentPrice: 51450.75,
          prevClose: 51350.00,
          change: 100.75,
          changePercent: 0.20,
          currentYield: 7.58,
          ytm: 7.65,
          duration: 5.8,
          rating: "AA",
          volume: "₹195 Cr",
          marketCap: "₹1,980 Cr",
          lastTradedTime: "15:18:45",
          bidPrice: 51440.00,
          askPrice: 51460.00,
          segment: "Fiber Crops",
          commodityPrice: "₹58,400/candy",
          linkageRatio: "1:0.85",
          seasonality: "Kharif Crop"
        },
        {
          id: "ncdex-agri-3",
          symbol: "NCDXAGRI003",
          name: "NCDEX Soybean-Linked Bond 2031",
          exchange: "NCDEX",
          type: "Agricultural Bond", 
          issuer: "Soybean Processors Association",
          underlyingAsset: "Soybean",
          maturityDate: "2031-06-15",
          couponRate: 8.15,
          faceValue: 100000,
          currentPrice: 103250.90,
          prevClose: 103100.00,
          change: 150.90,
          changePercent: 0.15,
          currentYield: 7.89,
          ytm: 7.95,
          duration: 6.2,
          rating: "AA+",
          volume: "₹275 Cr",
          marketCap: "₹2,785 Cr",
          lastTradedTime: "15:16:20",
          bidPrice: 103240.00,
          askPrice: 103260.00,
          segment: "Oilseeds",
          commodityPrice: "₹4,850/quintal",
          linkageRatio: "1:20",
          seasonality: "Kharif Crop"
        }
      ];

      res.json({
        status: "success",
        data: ncdexBonds,
        exchange: "NCDEX",
        totalBonds: ncdexBonds.length,
        specialization: "Agricultural Commodity Bonds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NCDEX bonds data:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get MSEI listed bonds data (small/mid-cap and specialized bonds)
  app.get("/api/bonds/msei-listed", async (req: Request, res: Response): Promise<void> => {
    try {
      // MSEI specialized and small-cap bonds
      const mseiBonds = [
        {
          id: "msei-sme-1",
          symbol: "MSEI001",
          name: "MSEI SME Green Bond 2029",
          exchange: "MSEI",
          type: "Green Bond",
          issuer: "Metropolitan Stock Exchange SME Platform",
          maturityDate: "2029-08-30",
          couponRate: 8.95,
          faceValue: 10000,
          currentPrice: 10425.60,
          prevClose: 10390.00,
          change: 35.60,
          changePercent: 0.34,
          currentYield: 8.58,
          ytm: 8.68,
          duration: 4.7,
          rating: "A+",
          volume: "₹125 Cr",
          marketCap: "₹1,280 Cr",
          lastTradedTime: "15:15:00",
          bidPrice: 10420.00,
          askPrice: 10430.00,
          segment: "Green Finance",
          greenCategory: "Renewable Energy",
          carbonCredits: "500 tonnes CO2/year"
        },
        {
          id: "msei-sme-2",
          symbol: "MSEI002",
          name: "MSEI Technology NCD 2030",
          exchange: "MSEI",
          type: "Subordinated Bond",
          issuer: "Metropolitan Stock Exchange SME Platform",
          maturityDate: "2030-11-20",
          couponRate: 9.25,
          faceValue: 50000,
          currentPrice: 51850.40,
          prevClose: 51750.00,
          change: 100.40,
          changePercent: 0.19,
          currentYield: 8.93,
          ytm: 9.02,
          duration: 5.9,
          rating: "A",
          volume: "₹85 Cr",
          marketCap: "₹865 Cr",
          lastTradedTime: "15:12:30",
          bidPrice: 51840.00,
          askPrice: 51860.00,
          segment: "Technology",
          sector: "Fintech & AI",
          innovationIndex: "Tech250"
        },
        {
          id: "msei-sme-3",
          symbol: "MSEI003", 
          name: "MSEI Healthcare Bond 2028",
          exchange: "MSEI",
          type: "Sectoral Bond",
          issuer: "Metropolitan Stock Exchange SME Platform",
          maturityDate: "2028-05-25",
          couponRate: 8.65,
          faceValue: 25000,
          currentPrice: 25975.80,
          prevClose: 25920.00,
          change: 55.80,
          changePercent: 0.22,
          currentYield: 8.33,
          ytm: 8.42,
          duration: 3.4,
          rating: "A+",
          volume: "₹95 Cr",
          marketCap: "₹975 Cr",
          lastTradedTime: "15:10:15",
          bidPrice: 25970.00,
          askPrice: 25980.00,
          segment: "Healthcare",
          sector: "Pharmaceuticals",
          regulatoryStatus: "SEBI Approved"
        }
      ];

      res.json({
        status: "success",
        data: mseiBonds,
        exchange: "MSEI",
        totalBonds: mseiBonds.length,
        specialization: "SME & Specialized Bonds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching MSEI bonds data:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

  // Get comprehensive multi-exchange bonds data
  app.get("/api/bonds/all-exchanges", async (req: Request, res: Response): Promise<void> => {
    try {
      const exchange = req.query.exchange as string;
      const category = req.query.category as string;

      // Note: These should ideally call internal services/functions
      const [nseResponse, bseResponse, mcxResponse, ncdexResponse, mseiResponse] = await Promise.all([
        fetch(`${req.protocol}://${req.get('host')}/api/bonds/nse-listed`),
        fetch(`${req.protocol}://${req.get('host')}/api/bonds/bse-listed`),
        fetch(`${req.protocol}://${req.get('host')}/api/bonds/mcx-listed`),
        fetch(`${req.protocol}://${req.get('host')}/api/bonds/ncdex-listed`),
        fetch(`${req.protocol}://${req.get('host')}/api/bonds/msei-listed`)
      ]);

      const [nseData, bseData, mcxData, ncdexData, mseiData]: any[] = await Promise.all([
        nseResponse.json(),
        bseResponse.json(),
        mcxResponse.json(),
        ncdexResponse.json(),
        mseiResponse.json()
      ]);

      let allBonds = [
        ...(nseData.data || []),
        ...(bseData.data || []), 
        ...(mcxData.data || []),
        ...(ncdexData.data || []),
        ...(mseiData.data || [])
      ];

      // Filter by exchange if specified
      if (exchange && exchange !== 'all') {
        allBonds = allBonds.filter(bond => 
          bond.exchange && bond.exchange.toLowerCase() === exchange.toLowerCase()
        );
      }

      // Filter by category if specified
      if (category && category !== 'all') {
        allBonds = allBonds.filter(bond => {
          const bondCategory = (bond.segment?.toLowerCase() || bond.type?.toLowerCase() || "");
          return bondCategory.includes(category.toLowerCase());
        });
      }

      // Calculate comprehensive market statistics
      const marketStats = allBonds.length > 0 ? {
        totalBonds: allBonds.length,
        exchangeBreakdown: {
          NSE: (nseData.data || []).length,
          BSE: (bseData.data || []).length,
          MCX: (mcxData.data || []).length,
          NCDEX: (ncdexData.data || []).length,
          MSEI: (mseiData.data || []).length
        },
        totalVolume: allBonds.reduce((sum, bond) => {
          const volumeStr = bond.volume ? bond.volume.replace(/[₹,\sCr]/g, '') : "0";
          const volume = parseFloat(volumeStr);
          return sum + (isNaN(volume) ? 0 : volume);
        }, 0),
        averageYield: (allBonds.reduce((sum, bond) => sum + (bond.currentYield || 0), 0) / allBonds.length).toFixed(2),
        topGainer: allBonds.reduce((max, bond) => 
          (bond.changePercent || 0) > (max.changePercent || 0) ? bond : max, allBonds[0]
        ),
        mostTraded: allBonds.reduce((max, bond) => {
          const v1Str = bond.volume ? bond.volume.replace(/[₹,\sCr]/g, '') : "0";
          const v2Str = max.volume ? max.volume.replace(/[₹,\sCr]/g, '') : "0";
          const volume1 = parseFloat(v1Str);
          const volume2 = parseFloat(v2Str);
          return (isNaN(volume1) ? 0 : volume1) > (isNaN(volume2) ? 0 : volume2) ? bond : max;
        }, allBonds[0]),
        segmentDistribution: {
          Government: allBonds.filter(b => b.segment === 'Government').length,
          Corporate: allBonds.filter(b => b.segment === 'Corporate').length,
          Agricultural: allBonds.filter(b => b.segment === 'Agricultural').length,
          Commodity: allBonds.filter(b => b.segment === 'Commodity').length,
          Technology: allBonds.filter(b => b.segment === 'Technology').length,
          Healthcare: allBonds.filter(b => b.segment === 'Healthcare').length
        }
      } : {
        totalBonds: 0,
        exchangeBreakdown: { NSE: 0, BSE: 0, MCX: 0, NCDEX: 0, MSEI: 0 },
        totalVolume: 0,
        averageYield: "0.00",
        topGainer: null,
        mostTraded: null,
        segmentDistribution: { Government: 0, Corporate: 0, Agricultural: 0, Commodity: 0, Technology: 0, Healthcare: 0 }
      };

      res.json({
        status: "success",
        data: allBonds,
        marketStats,
        filters: { exchange: exchange || 'all', category: category || 'all' },
        exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX', 'MSEI'],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching all exchanges bonds data:", error);
      res.status(500).json({
        status: "error",
        error: errorMessage(error)
      });
    }
  });

}
