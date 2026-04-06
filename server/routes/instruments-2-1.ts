import { Router, Request, Response } from "express";
import { db } from "../db";
import { logger } from "../logger";
import { 
  instrumentMaster,
  proposalHoldings,
  mutualFunds,
  bondCatalog,
  unlistedCompanies,
  listedStocks,
} from "@shared/schema";
import { eq, ilike, or, and, sql, desc, inArray } from "drizzle-orm";
import { NseIndia } from "stock-nse-india";
import { unifiedStockPriceService } from "../services/unified-stock-price-service";

const router = Router();

// NIFTY 50 + Additional Major Stocks with ISINs
const LISTED_STOCKS = [
  { isin: "INE002A01018", symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", industry: "Oil & Gas" },
  { isin: "INE040A01034", symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE090A01021", symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE009A01021", symbol: "INFY", name: "Infosys Ltd", sector: "Information Technology", industry: "IT Services" },
  { isin: "INE467B01029", symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "Information Technology", industry: "IT Services" },
  { isin: "INE176A01028", symbol: "SBIN", name: "State Bank of India", sector: "Financial Services", industry: "Banking" },
  { isin: "INE585B01010", symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Automobile", industry: "Auto Manufacturers" },
  { isin: "INE018A01030", symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "Information Technology", industry: "IT Services" },
  { isin: "INE030A01027", symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE019A01038", symbol: "ITC", name: "ITC Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE881D01027", symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services", industry: "NBFC" },
  { isin: "INE296A01024", symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecommunication", industry: "Telecom Services" },
  { isin: "INE406A01037", symbol: "WIPRO", name: "Wipro Ltd", sector: "Information Technology", industry: "IT Services" },
  { isin: "INE154A01025", symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Construction", industry: "Engineering" },
  { isin: "INE267A01025", symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE628A01036", symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE001A01036", symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automobile", industry: "Auto Manufacturers" },
  { isin: "INE028A01039", symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd", sector: "Healthcare", industry: "Pharmaceuticals" },
  { isin: "INE121A01024", symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE021A01026", symbol: "ADANIENT", name: "Adani Enterprises Ltd", sector: "Diversified", industry: "Conglomerate" },
  { isin: "INE079A01024", symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Metals & Mining", industry: "Steel" },
  { isin: "INE216A01030", symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd", sector: "Utilities", industry: "Power" },
  { isin: "INE081A01012", symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd", sector: "Healthcare", industry: "Pharmaceuticals" },
  { isin: "INE437A01024", symbol: "ASIANPAINT", name: "Asian Paints Ltd", sector: "Consumer Goods", industry: "Paints" },
  { isin: "INE213A01029", symbol: "M&M", name: "Mahindra & Mahindra Ltd", sector: "Automobile", industry: "Auto Manufacturers" },
  { isin: "INE066A01020", symbol: "NTPC", name: "NTPC Ltd", sector: "Utilities", industry: "Power" },
  { isin: "INE245A01021", symbol: "HINDALCO", name: "Hindalco Industries Ltd", sector: "Metals & Mining", industry: "Aluminium" },
  { isin: "INE238A01034", symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", sector: "Cement", industry: "Building Materials" },
  { isin: "INE182A01018", symbol: "ONGC", name: "Oil & Natural Gas Corporation Ltd", sector: "Energy", industry: "Oil & Gas" },
  { isin: "INE115A01026", symbol: "JSWSTEEL", name: "JSW Steel Ltd", sector: "Metals & Mining", industry: "Steel" },
  { isin: "INE103A01014", symbol: "BPCL", name: "Bharat Petroleum Corporation Ltd", sector: "Energy", industry: "Oil & Gas" },
  { isin: "INE208A01029", symbol: "TATACONSUM", name: "Tata Consumer Products Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE759A01021", symbol: "COALINDIA", name: "Coal India Ltd", sector: "Metals & Mining", industry: "Mining" },
  { isin: "INE101A01026", symbol: "GRASIM", name: "Grasim Industries Ltd", sector: "Cement", industry: "Diversified" },
  { isin: "INE192A01025", symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", sector: "Automobile", industry: "Two Wheelers" },
  { isin: "INE226A01021", symbol: "CIPLA", name: "Cipla Ltd", sector: "Healthcare", industry: "Pharmaceuticals" },
  { isin: "INE917I01010", symbol: "ADANIPORTS", name: "Adani Ports & SEZ Ltd", sector: "Infrastructure", industry: "Ports" },
  { isin: "INE848E01016", symbol: "DIVISLAB", name: "Divi's Laboratories Ltd", sector: "Healthcare", industry: "Pharmaceuticals" },
  { isin: "INE117A01022", symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE024A01023", symbol: "TECHM", name: "Tech Mahindra Ltd", sector: "Information Technology", industry: "IT Services" },
  { isin: "INE076A01028", symbol: "SBILIFE", name: "SBI Life Insurance Company Ltd", sector: "Financial Services", industry: "Insurance" },
  { isin: "INE239A01016", symbol: "TITAN", name: "Titan Company Ltd", sector: "Consumer Goods", industry: "Retail" },
  { isin: "INE733E01010", symbol: "HDFCLIFE", name: "HDFC Life Insurance Company Ltd", sector: "Financial Services", industry: "Insurance" },
  { isin: "INE129A01019", symbol: "EICHERMOT", name: "Eicher Motors Ltd", sector: "Automobile", industry: "Two Wheelers" },
  { isin: "INE152A01027", symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", sector: "Automobile", industry: "Two Wheelers" },
  { isin: "INE010A01015", symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd", sector: "Healthcare", industry: "Hospitals" },
  { isin: "INE128A01017", symbol: "BRITANNIA", name: "Britannia Industries Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE274J01014", symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", sector: "Financial Services", industry: "NBFC" },
  { isin: "INE726G01019", symbol: "SHREECEM", name: "Shree Cement Ltd", sector: "Cement", industry: "Building Materials" },
  // Additional NIFTY Next 50 and popular stocks
  { isin: "INE669E01016", symbol: "VEDL", name: "Vedanta Ltd", sector: "Metals & Mining", industry: "Diversified Mining" },
  { isin: "INE752E01010", symbol: "PIDILITIND", name: "Pidilite Industries Ltd", sector: "Chemicals", industry: "Specialty Chemicals" },
  { isin: "INE003A01024", symbol: "SIEMENS", name: "Siemens Ltd", sector: "Capital Goods", industry: "Industrial Manufacturing" },
  { isin: "INE860A01027", symbol: "HAVELLS", name: "Havells India Ltd", sector: "Consumer Durables", industry: "Electricals" },
  { isin: "INE016A01026", symbol: "DABUR", name: "Dabur India Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE329A01031", symbol: "GODREJCP", name: "Godrej Consumer Products Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE111A01025", symbol: "ICICIPRULI", name: "ICICI Prudential Life Insurance Company Ltd", sector: "Financial Services", industry: "Insurance" },
  { isin: "INE066F01012", symbol: "BANDHANBNK", name: "Bandhan Bank Ltd", sector: "Financial Services", industry: "Banking" },
  { isin: "INE361B01024", symbol: "DLF", name: "DLF Ltd", sector: "Real Estate", industry: "Real Estate Development" },
  { isin: "INE795G01014", symbol: "IIFL", name: "IIFL Finance Ltd", sector: "Financial Services", industry: "NBFC" },
  { isin: "INE883A01011", symbol: "VOLTAS", name: "Voltas Ltd", sector: "Consumer Durables", industry: "Air Conditioning" },
  { isin: "INE484C01026", symbol: "LUPIN", name: "Lupin Ltd", sector: "Healthcare", industry: "Pharmaceuticals" },
  { isin: "INE918I01018", symbol: "JUBLFOOD", name: "Jubilant Foodworks Ltd", sector: "Consumer Services", industry: "Restaurants" },
  { isin: "INE326A01037", symbol: "POLYCAB", name: "Polycab India Ltd", sector: "Capital Goods", industry: "Cables & Wires" },
  { isin: "INE059A01026", symbol: "ABB", name: "ABB India Ltd", sector: "Capital Goods", industry: "Industrial Manufacturing" },
  { isin: "INE042A01014", symbol: "AMBUJACEM", name: "Ambuja Cements Ltd", sector: "Cement", industry: "Building Materials" },
  { isin: "INE121J01017", symbol: "PGHH", name: "Procter & Gamble Hygiene and Health Care Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE475B01022", symbol: "BERGEPAINT", name: "Berger Paints India Ltd", sector: "Consumer Goods", industry: "Paints" },
  { isin: "INE038A01020", symbol: "PNB", name: "Punjab National Bank", sector: "Financial Services", industry: "Banking" },
  { isin: "INE062A01020", symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Financial Services", industry: "Banking" },
  { isin: "INE084A01016", symbol: "CANBK", name: "Canara Bank", sector: "Financial Services", industry: "Banking" },
  { isin: "INE148A01019", symbol: "IOC", name: "Indian Oil Corporation Ltd", sector: "Energy", industry: "Oil & Gas" },
  { isin: "INE256A01028", symbol: "GAIL", name: "GAIL (India) Ltd", sector: "Energy", industry: "Natural Gas" },
  { isin: "INE773I01017", symbol: "COLPAL", name: "Colgate-Palmolive (India) Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE199A01012", symbol: "MARICO", name: "Marico Ltd", sector: "Consumer Goods", industry: "FMCG" },
  { isin: "INE585A01012", symbol: "BOSCHLTD", name: "Bosch Ltd", sector: "Automobile", industry: "Auto Components" },
  { isin: "INE761H01022", symbol: "PAGEIND", name: "Page Industries Ltd", sector: "Consumer Goods", industry: "Apparel" },
  { isin: "INE140A01024", symbol: "ACC", name: "ACC Ltd", sector: "Cement", industry: "Building Materials" },
  { isin: "INE018E01016", symbol: "SBICARD", name: "SBI Cards and Payment Services Ltd", sector: "Financial Services", industry: "Credit Cards" },
  { isin: "INE477B01010", symbol: "MUTHOOTFIN", name: "Muthoot Finance Ltd", sector: "Financial Services", industry: "Gold Loans" },
  { isin: "INE101J01011", symbol: "CHOLAFIN", name: "Cholamandalam Investment and Finance Company Ltd", sector: "Financial Services", industry: "NBFC" },
];

// Search instruments by ISIN or name (autocomplete)
router.post("/api/instruments/sync", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].some(r => user.roles?.includes(r))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    let synced = { mutualFunds: 0, bonds: 0, unlisted: 0, stocks: 0 };

    // Sync Listed Stocks (NIFTY 50 + Next 50)
    for (const stock of LISTED_STOCKS) {
      try {
        await db.insert(instrumentMaster).values({
          isin: stock.isin,
          symbol: stock.symbol,
          name: stock.name,
          shortName: stock.name.substring(0, 50),
          assetClass: "equity",
          subType: null,
          sector: stock.sector,
          category: stock.industry,
          issuer: stock.name,
          priceSource: "nse",
          riskLevel: "high",
          currency: "INR",
          sourceTable: "listed_stocks",
          sourceId: stock.isin,
          metadata: {
            symbol: stock.symbol,
            exchange: "NSE",
            industry: stock.industry,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            symbol: stock.symbol,
            name: stock.name,
            sector: stock.sector,
            category: stock.industry,
            updatedAt: new Date(),
          }
        });
        synced.stocks++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Sync Mutual Funds - use schemeCode as pseudo-ISIN since MF table doesn't have ISIN
    const funds = await db.select().from(mutualFunds).limit(1000);
    for (const fund of funds) {
      if (!fund.schemeCode) continue;
      
      // Generate MF pseudo-ISIN from scheme code
      const pseudoIsin = `MF${fund.schemeCode.substring(0, 10).toUpperCase()}`;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: pseudoIsin,
          symbol: fund.schemeCode,
          name: fund.schemeName,
          shortName: fund.schemeName?.substring(0, 50),
          assetClass: "mutual_fund",
          subType: null,
          category: fund.category || null,
          issuer: fund.fundHouse || null,
          lastPrice: fund.nav?.toString() || null,
          priceSource: "amfi",
          priceUpdatedAt: fund.lastUpdated || null,
          riskLevel: fund.riskLevel?.toLowerCase() || null,
          sourceTable: "mutual_funds",
          sourceId: fund.id,
          metadata: {
            schemeCode: fund.schemeCode,
            planType: fund.planType,
            crisilRating: fund.crisilRating,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            name: fund.schemeName,
            lastPrice: fund.nav?.toString() || null,
            priceUpdatedAt: fund.lastUpdated || null,
            updatedAt: new Date(),
          }
        });
        synced.mutualFunds++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Sync Bonds
    const bonds = await db.select().from(bondCatalog).limit(500);
    for (const bond of bonds) {
      if (!bond.isin) continue;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: bond.isin,
          symbol: null,
          name: bond.bondName,
          shortName: bond.bondName?.substring(0, 50),
          assetClass: "bond",
          subType: bond.instrumentType || null,
          category: null,
          issuer: bond.issuerName || null,
          lastPrice: bond.cleanPrice?.toString() || bond.faceValue?.toString() || null,
          priceSource: bond.exchange?.toLowerCase() || null,
          faceValue: bond.faceValue?.toString() || null,
          maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
          creditRating: bond.creditRating || null,
          riskLevel: null,
          sourceTable: "bond_catalog",
          sourceId: bond.id,
          metadata: {
            couponRate: bond.couponRate,
            couponFrequency: bond.couponFrequency,
            exchange: bond.exchange,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            lastPrice: bond.cleanPrice?.toString() || bond.faceValue?.toString() || null,
            creditRating: bond.creditRating || null,
            updatedAt: new Date(),
          }
        });
        synced.bonds++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Sync Unlisted Companies (use ISIN if available, otherwise generate pseudo-ISIN)
    const unlisted = await db.select().from(unlistedCompanies).limit(200);
    for (const company of unlisted) {
      const isinToUse = company.isin || `UL${company.id.substring(0, 10).toUpperCase()}`;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: isinToUse,
          symbol: null,
          name: company.name,
          shortName: company.name?.substring(0, 50),
          assetClass: "unlisted",
          subType: company.industry || null,
          sector: company.sector || null,
          issuer: company.name,
          lastPrice: company.publishedBuyPrice?.toString() || null,
          priceSource: "manual",
          riskLevel: "high",
          sourceTable: "unlisted_companies",
          sourceId: company.id,
          metadata: {
            cin: company.cin,
            listingStage: company.listingStage,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            lastPrice: company.publishedBuyPrice?.toString() || null,
            updatedAt: new Date(),
          }
        });
        synced.unlisted++;
      } catch (e) {
        // Skip duplicates
      }
    }

    res.json({ 
      success: true, 
      synced,
      message: `Synced ${synced.stocks} stocks, ${synced.mutualFunds} MFs, ${synced.bonds} bonds, ${synced.unlisted} unlisted`
    });
  } catch (error: any) {
    console.error("Instrument sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync instruments" });
  }
});

// Sync ALL NSE listed stocks from NSE India API

export default router;
