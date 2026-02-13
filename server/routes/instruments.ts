import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  instrumentMaster,
  proposalHoldings,
  mutualFunds,
  bondCatalog,
  unlistedCompanies 
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
router.get("/api/instruments/search", async (req: Request, res: Response) => {
  try {
    const { q, assetClass, limit = 20 } = req.query;
    
    if (!q || String(q).length < 2) {
      return res.json({ instruments: [] });
    }

    const searchTerm = `%${String(q)}%`;
    const maxResults = Number(limit);
    
    let whereConditions = or(
      ilike(instrumentMaster.isin, searchTerm),
      ilike(instrumentMaster.name, searchTerm),
      ilike(instrumentMaster.symbol, searchTerm),
      ilike(instrumentMaster.shortName, searchTerm)
    );

    if (assetClass) {
      whereConditions = and(
        whereConditions,
        eq(instrumentMaster.assetClass, String(assetClass))
      );
    }

    const instruments = await db.select({
      id: instrumentMaster.id,
      isin: instrumentMaster.isin,
      symbol: instrumentMaster.symbol,
      name: instrumentMaster.name,
      shortName: instrumentMaster.shortName,
      assetClass: instrumentMaster.assetClass,
      subType: instrumentMaster.subType,
      category: instrumentMaster.category,
      issuer: instrumentMaster.issuer,
      lastPrice: instrumentMaster.lastPrice,
      currency: instrumentMaster.currency,
      riskLevel: instrumentMaster.riskLevel,
      priceUpdatedAt: instrumentMaster.priceUpdatedAt,
    })
      .from(instrumentMaster)
      .where(and(whereConditions, eq(instrumentMaster.isActive, true)))
      .orderBy(instrumentMaster.name)
      .limit(maxResults);

    const existingIsins = new Set(instruments.map(i => i.isin).filter(Boolean));
    const assetClassStr = assetClass ? String(assetClass) : '';

    // Fallback: search mutualFunds table for mutual funds
    if ((!assetClassStr || assetClassStr === 'mutual_fund') && instruments.length < maxResults) {
      const remainingSlots = maxResults - instruments.length;
      const mfResults = await db.select({
        id: mutualFunds.id,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        category: mutualFunds.category,
        fundHouse: mutualFunds.fundHouse,
        nav: mutualFunds.nav,
        riskLevel: mutualFunds.riskLevel,
      })
        .from(mutualFunds)
        .where(
          or(
            ilike(mutualFunds.schemeName, searchTerm),
            ilike(mutualFunds.schemeCode, searchTerm),
            ilike(mutualFunds.fundHouse, searchTerm)
          )
        )
        .orderBy(mutualFunds.schemeName)
        .limit(remainingSlots + 10);

      for (const mf of mfResults) {
        if (instruments.length >= maxResults) break;
        const mfIsin = `MF${mf.schemeCode}`;
        if (existingIsins.has(mfIsin)) continue;
        instruments.push({
          id: mf.id, isin: mfIsin, symbol: mf.schemeCode,
          name: mf.schemeName, shortName: mf.fundHouse || mf.schemeName,
          assetClass: 'mutual_fund', subType: mf.category || null,
          category: mf.category || null, issuer: mf.fundHouse || null,
          lastPrice: mf.nav, currency: 'INR', riskLevel: mf.riskLevel || null,
          priceUpdatedAt: null,
        });
        existingIsins.add(mfIsin);
      }
    }

    // Fallback: search mutualFunds table for ETFs (ETF schemes are stored in MF table)
    if (assetClassStr === 'etf' && instruments.length < maxResults) {
      const remainingSlots = maxResults - instruments.length;
      const etfResults = await db.select({
        id: mutualFunds.id,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        category: mutualFunds.category,
        fundHouse: mutualFunds.fundHouse,
        nav: mutualFunds.nav,
        riskLevel: mutualFunds.riskLevel,
      })
        .from(mutualFunds)
        .where(
          and(
            or(
              ilike(mutualFunds.schemeName, searchTerm),
              ilike(mutualFunds.schemeCode, searchTerm),
              ilike(mutualFunds.fundHouse, searchTerm)
            ),
            or(
              ilike(mutualFunds.schemeName, '%ETF%'),
              ilike(mutualFunds.schemeName, '%Exchange Traded%'),
              ilike(mutualFunds.category, '%ETF%')
            )
          )
        )
        .orderBy(mutualFunds.schemeName)
        .limit(remainingSlots + 10);

      for (const etf of etfResults) {
        if (instruments.length >= maxResults) break;
        const etfIsin = `ETF${etf.schemeCode}`;
        if (existingIsins.has(etfIsin)) continue;
        instruments.push({
          id: etf.id, isin: etfIsin, symbol: etf.schemeCode,
          name: etf.schemeName, shortName: etf.fundHouse || etf.schemeName,
          assetClass: 'etf', subType: etf.category || null,
          category: etf.category || null, issuer: etf.fundHouse || null,
          lastPrice: etf.nav, currency: 'INR', riskLevel: etf.riskLevel || null,
          priceUpdatedAt: null,
        });
        existingIsins.add(etfIsin);
      }
    }

    // Fallback: search bondCatalog table for bonds (3,020 bonds)
    if (assetClassStr === 'bond' && instruments.length < maxResults) {
      const remainingSlots = maxResults - instruments.length;
      const bondResults = await db.select({
        id: bondCatalog.id,
        isin: bondCatalog.isin,
        bondName: bondCatalog.bondName,
        issuerName: bondCatalog.issuerName,
        instrumentType: bondCatalog.instrumentType,
        couponRate: bondCatalog.couponRate,
        maturityDate: bondCatalog.maturityDate,
        creditRating: bondCatalog.creditRating,
        faceValue: bondCatalog.faceValue,
        cleanPrice: bondCatalog.cleanPrice,
      })
        .from(bondCatalog)
        .where(
          or(
            ilike(bondCatalog.bondName, searchTerm),
            ilike(bondCatalog.issuerName, searchTerm),
            ilike(bondCatalog.isin, searchTerm)
          )
        )
        .orderBy(bondCatalog.bondName)
        .limit(remainingSlots + 10);

      for (const bond of bondResults) {
        if (instruments.length >= maxResults) break;
        const bondIsin = bond.isin || `BOND${bond.id}`;
        if (existingIsins.has(bondIsin)) continue;
        const price = bond.cleanPrice ? String(bond.cleanPrice) : bond.faceValue ? String(bond.faceValue) : null;
        instruments.push({
          id: bond.id, isin: bondIsin, symbol: bond.isin || '',
          name: bond.bondName || bond.issuerName || '',
          shortName: bond.issuerName || bond.bondName || '',
          assetClass: 'bond', subType: bond.instrumentType || null,
          category: bond.instrumentType || null, issuer: bond.issuerName || null,
          lastPrice: price, currency: 'INR', riskLevel: bond.creditRating || null,
          priceUpdatedAt: null,
        });
        existingIsins.add(bondIsin);
      }
    }

    // Fallback: search hardcoded LISTED_STOCKS for equity when instrumentMaster has few results
    if (assetClassStr === 'equity' && instruments.length < maxResults) {
      const query = String(q).toLowerCase();
      const stockMatches = LISTED_STOCKS.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.symbol.toLowerCase().includes(query) ||
        s.isin.toLowerCase().includes(query)
      );
      for (const stock of stockMatches) {
        if (instruments.length >= maxResults) break;
        if (existingIsins.has(stock.isin)) continue;
        instruments.push({
          id: stock.isin, isin: stock.isin, symbol: stock.symbol,
          name: stock.name, shortName: stock.symbol,
          assetClass: 'equity', subType: stock.sector || null,
          category: stock.industry || null, issuer: null,
          lastPrice: null, currency: 'INR', riskLevel: null,
          priceUpdatedAt: null,
        });
        existingIsins.add(stock.isin);
      }
    }

    res.json({ instruments });
  } catch (error: any) {
    console.error("Instrument search error:", error);
    res.status(500).json({ error: "Failed to search instruments" });
  }
});

// Get instrument by ISIN
router.get("/api/instruments/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    const [instrument] = await db.select()
      .from(instrumentMaster)
      .where(eq(instrumentMaster.isin, isin.toUpperCase()));

    if (!instrument) {
      return res.status(404).json({ error: "Instrument not found", isin });
    }

    res.json({ instrument });
  } catch (error: any) {
    console.error("Get instrument error:", error);
    res.status(500).json({ error: "Failed to get instrument" });
  }
});

// Sync instrument master from existing data sources
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
router.post("/api/instruments/sync-nse", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].some(r => user.roles?.includes(r))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const nseIndia = new NseIndia();
    
    console.log("Fetching all equity stocks from NSE India...");
    
    // Get the list of all stocks from NSE
    const allStocks = await nseIndia.getAllStockSymbols();
    console.log(`Found ${allStocks.length} stock symbols from NSE`);
    
    let synced = 0;
    let errors = 0;
    let skipped = 0;
    const batchSize = 50;
    
    // Process stocks in batches to avoid overwhelming NSE API
    for (let i = 0; i < allStocks.length; i += batchSize) {
      const batch = allStocks.slice(i, i + batchSize);
      
      for (const symbol of batch) {
        try {
          // Get detailed equity info for each stock
          const equityDetails = await nseIndia.getEquityDetails(symbol);
          
          if (!equityDetails || !equityDetails.info) {
            skipped++;
            continue;
          }
          
          const info = equityDetails.info;
          const priceInfo = equityDetails.priceInfo || {};
          
          // Extract ISIN - required field
          const isin = info.isin;
          if (!isin || isin.length !== 12) {
            skipped++;
            continue;
          }
          
          // Get sector/industry from industryInfo if available
          const industryInfo = (equityDetails as any).industryInfo || {};
          const infoAny = info as any;
          
          await db.insert(instrumentMaster).values({
            isin: isin,
            symbol: symbol,
            name: info.companyName || symbol,
            shortName: (info.companyName || symbol).substring(0, 50),
            assetClass: "equity",
            subType: null,
            sector: industryInfo.sector || industryInfo.industry || null,
            category: industryInfo.basicIndustry || industryInfo.industry || null,
            issuer: info.companyName || symbol,
            lastPrice: priceInfo.lastPrice?.toString() || null,
            priceSource: "nse",
            priceUpdatedAt: new Date(),
            riskLevel: "high",
            currency: "INR",
            sourceTable: "nse_equity",
            sourceId: isin,
            metadata: {
              symbol: symbol,
              exchange: "NSE",
              series: infoAny.series,
              industry: industryInfo.industry,
              sector: industryInfo.sector,
              macroSector: industryInfo.macro,
              faceValue: infoAny.faceValue,
              isinDemat: infoAny.isinDemat,
            },
          }).onConflictDoUpdate({
            target: instrumentMaster.isin,
            set: {
              symbol: symbol,
              name: info.companyName || symbol,
              lastPrice: priceInfo.lastPrice?.toString() || null,
              sector: industryInfo.sector || industryInfo.industry || null,
              category: industryInfo.basicIndustry || industryInfo.industry || null,
              priceUpdatedAt: new Date(),
              updatedAt: new Date(),
              metadata: sql`${instrumentMaster.metadata}::jsonb || ${JSON.stringify({
                symbol: symbol,
                exchange: "NSE",
                series: infoAny.series,
                industry: industryInfo.industry,
                sector: industryInfo.sector,
                macroSector: industryInfo.macro,
              })}::jsonb`,
            }
          });
          
          synced++;
          
          // Add small delay to be respectful to NSE API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (e: any) {
          console.error(`Error syncing ${symbol}:`, e.message);
          errors++;
        }
      }
      
      console.log(`Progress: ${Math.min(i + batchSize, allStocks.length)}/${allStocks.length} stocks processed`);
    }

    res.json({ 
      success: true, 
      synced,
      errors,
      skipped,
      total: allStocks.length,
      message: `Synced ${synced} stocks from NSE India (${errors} errors, ${skipped} skipped)`
    });
  } catch (error: any) {
    console.error("NSE sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync NSE stocks" });
  }
});

// Sync from NSE official equity list CSV (most reliable method)
router.post("/api/instruments/sync-nse-csv", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].some(r => user.roles?.includes(r))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    console.log("Fetching NSE equity list from archives...");
    
    // Download the official NSE equity list CSV
    const response = await fetch("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
    if (!response.ok) {
      throw new Error(`Failed to fetch NSE equity list: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    console.log(`Processing ${lines.length - 1} stocks from NSE equity list`);
    
    let synced = 0;
    let errors = 0;
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        // Parse CSV: SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
        const parts = line.split(',');
        if (parts.length < 7) continue;
        
        const symbol = parts[0]?.trim();
        const name = parts[1]?.trim();
        const series = parts[2]?.trim();
        const isin = parts[6]?.trim();
        
        // Only process equity stocks (EQ series) with valid ISINs
        if (!symbol || !isin || !isin.startsWith('INE') || isin.length !== 12) {
          continue;
        }
        
        // Skip non-EQ series (BE, BZ, etc. are less liquid)
        // But include EQ for main stocks
        
        await db.insert(instrumentMaster).values({
          isin: isin,
          symbol: symbol,
          name: name || symbol,
          shortName: (name || symbol).substring(0, 50),
          assetClass: "equity",
          subType: null,
          sector: null,
          category: null,
          issuer: name || symbol,
          lastPrice: null,
          priceSource: "nse",
          riskLevel: "high",
          currency: "INR",
          sourceTable: "nse_equity_csv",
          sourceId: isin,
          metadata: {
            symbol: symbol,
            exchange: "NSE",
            series: series,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            symbol: symbol,
            name: name || symbol,
            shortName: (name || symbol).substring(0, 50),
            issuer: name || symbol,
            sourceTable: "nse_equity_csv",
            sourceId: isin,
            metadata: {
              symbol: symbol,
              exchange: "NSE",
              series: series,
            },
            updatedAt: new Date(),
          }
        });
        
        synced++;
      } catch (e: any) {
        console.error(`Error on line ${i}:`, e.message);
        errors++;
      }
    }

    res.json({ 
      success: true, 
      synced,
      errors,
      total: lines.length - 1,
      message: `Synced ${synced} stocks from NSE equity list (${errors} errors)`
    });
  } catch (error: any) {
    console.error("NSE CSV sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync NSE stocks from CSV" });
  }
});

// Light sync - just fetch symbols and basic info without detailed API calls
router.post("/api/instruments/sync-nse-light", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].some(r => user.roles?.includes(r))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const nseIndia = new NseIndia();
    
    console.log("Fetching equity list from NSE India...");
    
    // Get all equity info from the index endpoint
    const niftyTotalMarket = await nseIndia.getEquityStockIndices("NIFTY TOTAL MARKET");
    const stocks = niftyTotalMarket?.data || [];
    
    console.log(`Found ${stocks.length} stocks from NIFTY Total Market index`);
    
    let synced = 0;
    let errors = 0;
    
    for (const stock of stocks) {
      try {
        if (!stock.symbol) continue;
        
        // Generate ISIN if not available (use NSE symbol as identifier)
        const isin = stock.identifier?.startsWith("INE") 
          ? stock.identifier 
          : `NSE${stock.symbol.padEnd(9, '0').substring(0, 9)}`;
        
        await db.insert(instrumentMaster).values({
          isin: isin,
          symbol: stock.symbol,
          name: stock.meta?.companyName || stock.symbol,
          shortName: (stock.meta?.companyName || stock.symbol).substring(0, 50),
          assetClass: "equity",
          subType: null,
          sector: stock.meta?.industry || null,
          category: null,
          issuer: stock.meta?.companyName || stock.symbol,
          lastPrice: stock.lastPrice?.toString() || null,
          priceSource: "nse",
          priceUpdatedAt: new Date(),
          riskLevel: "high",
          currency: "INR",
          sourceTable: "nse_equity",
          sourceId: stock.symbol,
          metadata: {
            symbol: stock.symbol,
            exchange: "NSE",
            series: stock.series || "EQ",
            industry: stock.meta?.industry,
            dayHigh: stock.dayHigh,
            dayLow: stock.dayLow,
            open: stock.open,
            previousClose: stock.previousClose,
            change: stock.change,
            pChange: stock.pChange,
            yearHigh: stock.yearHigh,
            yearLow: stock.yearLow,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            symbol: stock.symbol,
            lastPrice: stock.lastPrice?.toString() || null,
            priceUpdatedAt: new Date(),
            updatedAt: new Date(),
          }
        });
        
        synced++;
      } catch (e: any) {
        console.error(`Error syncing ${stock.symbol}:`, e.message);
        errors++;
      }
    }

    res.json({ 
      success: true, 
      synced,
      errors,
      total: stocks.length,
      message: `Synced ${synced} stocks from NIFTY Total Market (${errors} errors)`
    });
  } catch (error: any) {
    console.error("NSE light sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync NSE stocks" });
  }
});

// Get instrument master stats
router.get("/api/instruments/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db.select({
      assetClass: instrumentMaster.assetClass,
      count: sql<number>`count(*)::int`,
    })
      .from(instrumentMaster)
      .where(eq(instrumentMaster.isActive, true))
      .groupBy(instrumentMaster.assetClass);

    const total = stats.reduce((sum, s) => sum + s.count, 0);

    res.json({ stats, total });
  } catch (error: any) {
    console.error("Get instrument stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ============ PROPOSAL HOLDINGS ============

// Get holdings for a proposal
router.get("/api/proposals/:proposalId/holdings", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const holdings = await db.select()
      .from(proposalHoldings)
      .where(eq(proposalHoldings.proposalId, req.params.proposalId))
      .orderBy(proposalHoldings.sortOrder, proposalHoldings.createdAt);

    res.json({ holdings });
  } catch (error: any) {
    console.error("Get holdings error:", error);
    res.status(500).json({ error: "Failed to get holdings" });
  }
});

// Batch save/update holdings for a proposal
router.post("/api/proposals/:proposalId/holdings", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { holdings } = req.body;
    const proposalId = req.params.proposalId;

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    // Validate each holding
    const errors: string[] = [];
    const validHoldings: Array<{
      proposalId: string;
      isin: string;
      instrumentId: string | null;
      securityName: string;
      assetClass: string;
      category: string | null;
      issuer: string | null;
      quantity: string;
      buyPrice: string;
      buyDate: Date | null;
      currentPrice: string | null;
      currentValue: string | null;
      unrealizedGainLoss: string | null;
      unrealizedGainLossPercent: string | null;
      importedFrom: string;
      notes: string | null;
      sortOrder: number;
    }> = [];

    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      
      if (!h.isin) {
        errors.push(`Row ${i + 1}: ISIN is required`);
        continue;
      }
      if (!h.securityName) {
        errors.push(`Row ${i + 1}: Security name is required`);
        continue;
      }
      if (!h.quantity || Number(h.quantity) <= 0) {
        errors.push(`Row ${i + 1}: Quantity must be greater than 0`);
        continue;
      }
      if (!h.buyPrice || Number(h.buyPrice) <= 0) {
        errors.push(`Row ${i + 1}: Buy price must be greater than 0`);
        continue;
      }
      if (h.buyDate && new Date(h.buyDate) > new Date()) {
        errors.push(`Row ${i + 1}: Buy date cannot be in the future`);
        continue;
      }

      // Check for duplicate ISINs
      const duplicateIndex = validHoldings.findIndex(vh => vh.isin === h.isin);
      if (duplicateIndex >= 0) {
        errors.push(`Row ${i + 1}: Duplicate ISIN ${h.isin} (already in row ${duplicateIndex + 1})`);
        continue;
      }

      validHoldings.push({
        proposalId,
        isin: h.isin.toUpperCase(),
        instrumentId: h.instrumentId || null,
        securityName: h.securityName,
        assetClass: h.assetClass || "other",
        category: h.category || null,
        issuer: h.issuer || null,
        quantity: h.quantity.toString(),
        buyPrice: h.buyPrice.toString(),
        buyDate: h.buyDate ? new Date(h.buyDate) : null,
        currentPrice: h.currentPrice?.toString() || null,
        currentValue: h.currentValue?.toString() || null,
        unrealizedGainLoss: h.unrealizedGainLoss?.toString() || null,
        unrealizedGainLossPercent: h.unrealizedGainLossPercent?.toString() || null,
        importedFrom: h.importedFrom || "manual",
        notes: h.notes || null,
        sortOrder: i,
      });
    }

    if (errors.length > 0 && validHoldings.length === 0) {
      return res.status(400).json({ error: "Validation failed", errors });
    }

    // Delete existing holdings and insert new ones (atomic replace)
    await db.transaction(async (tx) => {
      await tx.delete(proposalHoldings)
        .where(eq(proposalHoldings.proposalId, proposalId));
      
      if (validHoldings.length > 0) {
        await tx.insert(proposalHoldings).values(validHoldings);
      }
    });

    // Calculate totals
    const totalInvestment = validHoldings.reduce((sum, h) => 
      sum + (Number(h.quantity) * Number(h.buyPrice)), 0);
    const totalCurrentValue = validHoldings.reduce((sum, h) => 
      sum + (Number(h.currentValue) || (Number(h.quantity) * Number(h.buyPrice))), 0);

    res.json({ 
      success: true, 
      holdingsCount: validHoldings.length,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        totalInvestment,
        totalCurrentValue,
        gainLoss: totalCurrentValue - totalInvestment,
        gainLossPercent: totalInvestment > 0 
          ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100) 
          : 0,
      }
    });
  } catch (error: any) {
    console.error("Save holdings error:", error);
    res.status(500).json({ error: error.message || "Failed to save holdings" });
  }
});

// Validate holdings (without saving)
router.post("/api/proposals/:proposalId/holdings/validate", async (req: Request, res: Response) => {
  try {
    const { holdings } = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    const isinSet = new Set<string>();

    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      const rowNum = i + 1;

      // Required field validation
      if (!h.isin) errors.push(`Row ${rowNum}: ISIN is required`);
      if (!h.securityName) errors.push(`Row ${rowNum}: Security name is required`);
      if (!h.quantity || Number(h.quantity) <= 0) errors.push(`Row ${rowNum}: Quantity must be > 0`);
      if (!h.buyPrice || Number(h.buyPrice) <= 0) errors.push(`Row ${rowNum}: Buy price must be > 0`);

      // Date validation
      if (h.buyDate && new Date(h.buyDate) > new Date()) {
        errors.push(`Row ${rowNum}: Buy date cannot be in the future`);
      }

      // Duplicate check
      if (h.isin) {
        const normalizedIsin = h.isin.toUpperCase();
        if (isinSet.has(normalizedIsin)) {
          errors.push(`Row ${rowNum}: Duplicate ISIN ${normalizedIsin}`);
        }
        isinSet.add(normalizedIsin);

        // Verify ISIN exists in instrument master
        const [instrument] = await db.select({ id: instrumentMaster.id })
          .from(instrumentMaster)
          .where(eq(instrumentMaster.isin, normalizedIsin));
        
        if (!instrument) {
          warnings.push(`Row ${rowNum}: ISIN ${normalizedIsin} not found in instrument database`);
        }
      }
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      holdingsCount: holdings.length,
    });
  } catch (error: any) {
    console.error("Validate holdings error:", error);
    res.status(500).json({ error: "Failed to validate holdings" });
  }
});

// Compute valuation for holdings
router.post("/api/valuation/compute", async (req: Request, res: Response) => {
  try {
    const { holdings } = req.body;

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    const valuedHoldings = [];

    for (const h of holdings) {
      if (!h.isin || !h.quantity) continue;

      // Look up current price
      const [instrument] = await db.select({
        lastPrice: instrumentMaster.lastPrice,
        priceUpdatedAt: instrumentMaster.priceUpdatedAt,
      })
        .from(instrumentMaster)
        .where(eq(instrumentMaster.isin, h.isin.toUpperCase()));

      const quantity = Number(h.quantity);
      const buyPrice = Number(h.buyPrice) || 0;
      const currentPrice = instrument?.lastPrice ? Number(instrument.lastPrice) : buyPrice;
      const investmentValue = quantity * buyPrice;
      const currentValue = quantity * currentPrice;
      const unrealizedGainLoss = currentValue - investmentValue;
      const unrealizedGainLossPercent = investmentValue > 0 
        ? (unrealizedGainLoss / investmentValue * 100) 
        : 0;

      valuedHoldings.push({
        ...h,
        currentPrice,
        currentValue,
        unrealizedGainLoss,
        unrealizedGainLossPercent,
        priceUpdatedAt: instrument?.priceUpdatedAt,
      });
    }

    const totalInvestment = valuedHoldings.reduce((sum, h) => 
      sum + (Number(h.quantity) * Number(h.buyPrice)), 0);
    const totalCurrentValue = valuedHoldings.reduce((sum, h) => 
      sum + Number(h.currentValue), 0);

    res.json({
      holdings: valuedHoldings,
      summary: {
        totalInvestment,
        totalCurrentValue,
        totalGainLoss: totalCurrentValue - totalInvestment,
        totalGainLossPercent: totalInvestment > 0 
          ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100) 
          : 0,
        holdingsCount: valuedHoldings.length,
      }
    });
  } catch (error: any) {
    console.error("Compute valuation error:", error);
    res.status(500).json({ error: "Failed to compute valuation" });
  }
});

/**
 * Get current price for an instrument by ISIN
 * Searches across instrument_master, mutual_funds, and bond_catalog
 */
router.get("/api/instruments/price/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    if (!isin || isin.length < 3) {
      return res.status(400).json({ error: "Invalid ISIN" });
    }

    const isinUpper = isin.toUpperCase();

    // Search instrument_master first
    const [instrument] = await db.select({
      id: instrumentMaster.id,
      isin: instrumentMaster.isin,
      symbol: instrumentMaster.symbol,
      name: instrumentMaster.name,
      shortName: instrumentMaster.shortName,
      assetClass: instrumentMaster.assetClass,
      lastPrice: instrumentMaster.lastPrice,
      currency: instrumentMaster.currency,
      priceUpdatedAt: instrumentMaster.priceUpdatedAt,
    })
      .from(instrumentMaster)
      .where(eq(instrumentMaster.isin, isinUpper))
      .limit(1);

    if (instrument) {
      let currentPrice = instrument.lastPrice ? parseFloat(instrument.lastPrice) : null;
      let priceSource = "instrument_master";

      if (!currentPrice && instrument.assetClass === 'equity' && instrument.symbol) {
        try {
          const livePrice = await unifiedStockPriceService.getPrice(instrument.symbol, 'NSE');
          if (livePrice && livePrice.price) {
            currentPrice = livePrice.price;
            priceSource = livePrice.source === 'BSE' ? "live_bse" : "live_nse";
          }
        } catch (e) {
          // Live price fetch failed, continue with null
        }
      }

      return res.json({
        success: true,
        source: priceSource,
        data: {
          isin: instrument.isin,
          name: instrument.name || instrument.shortName,
          assetClass: instrument.assetClass,
          currentPrice,
          currency: instrument.currency || "INR",
          priceUpdatedAt: instrument.priceUpdatedAt,
        }
      });
    }

    // Search mutual_funds by ISIN
    const [fund] = await db.select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      isin: mutualFunds.isin,
      nav: mutualFunds.nav,
      fundHouse: mutualFunds.fundHouse,
      lastUpdated: mutualFunds.lastUpdated,
    })
      .from(mutualFunds)
      .where(eq(mutualFunds.isin, isinUpper))
      .limit(1);

    if (fund) {
      return res.json({
        success: true,
        source: "mutual_funds",
        data: {
          isin: fund.isin,
          schemeCode: fund.schemeCode,
          name: fund.schemeName,
          fundHouse: fund.fundHouse,
          assetClass: "mutual_fund",
          currentPrice: fund.nav ? parseFloat(fund.nav) : null,
          currency: "INR",
          priceUpdatedAt: fund.lastUpdated,
        }
      });
    }

    // Search bonds by ISIN
    const [bond] = await db.select({
      id: bondCatalog.id,
      isin: bondCatalog.isin,
      bondName: bondCatalog.bondName,
      issuerName: bondCatalog.issuerName,
      instrumentType: bondCatalog.instrumentType,
      faceValue: bondCatalog.faceValue,
      couponRate: bondCatalog.couponRate,
    })
      .from(bondCatalog)
      .where(eq(bondCatalog.isin, isinUpper))
      .limit(1);

    if (bond) {
      return res.json({
        success: true,
        source: "bonds",
        data: {
          isin: bond.isin,
          name: bond.bondName,
          issuer: bond.issuerName,
          bondType: bond.instrumentType,
          assetClass: "bond",
          currentPrice: bond.faceValue ? parseFloat(bond.faceValue) : null,
          couponRate: bond.couponRate ? parseFloat(bond.couponRate) : null,
          currency: "INR",
          priceUpdatedAt: null,
        }
      });
    }

    // Check listed stocks
    const listedStock = LISTED_STOCKS.find(s => s.isin === isinUpper);
    if (listedStock) {
      let currentPrice: number | null = null;
      let priceSource = "listed_stocks";
      try {
        const livePrice = await unifiedStockPriceService.getPrice(listedStock.symbol, 'NSE');
        if (livePrice && livePrice.price) {
          currentPrice = livePrice.price;
          priceSource = livePrice.source === 'BSE' ? "live_bse" : "live_nse";
        }
      } catch (e) {}

      return res.json({
        success: true,
        source: priceSource,
        data: {
          isin: listedStock.isin,
          symbol: listedStock.symbol,
          name: listedStock.name,
          sector: listedStock.sector,
          assetClass: "equity",
          currentPrice,
          currency: "INR",
          priceUpdatedAt: currentPrice ? new Date() : null,
        }
      });
    }

    return res.status(404).json({
      success: false,
      error: "Instrument not found",
      message: `No instrument found with ISIN: ${isinUpper}`
    });

  } catch (error: any) {
    console.error("ISIN price lookup error:", error);
    res.status(500).json({ error: "Failed to lookup price" });
  }
});

/**
 * Bulk price lookup by multiple ISINs
 */
router.post("/api/instruments/prices", async (req: Request, res: Response) => {
  try {
    const { isins } = req.body;
    
    if (!isins || !Array.isArray(isins) || isins.length === 0) {
      return res.status(400).json({ error: "ISINs array required" });
    }

    if (isins.length > 100) {
      return res.status(400).json({ error: "Maximum 100 ISINs per request" });
    }

    const isinList = isins.map((i: string) => i.toUpperCase());
    const results: Record<string, any> = {};

    // Fetch from instrument_master
    const instruments = await db.select({
      isin: instrumentMaster.isin,
      name: instrumentMaster.name,
      assetClass: instrumentMaster.assetClass,
      lastPrice: instrumentMaster.lastPrice,
      currency: instrumentMaster.currency,
      priceUpdatedAt: instrumentMaster.priceUpdatedAt,
    })
      .from(instrumentMaster)
      .where(inArray(instrumentMaster.isin, isinList));

    for (const inst of instruments) {
      if (inst.isin) {
        results[inst.isin] = {
          isin: inst.isin,
          name: inst.name,
          assetClass: inst.assetClass,
          currentPrice: inst.lastPrice ? parseFloat(inst.lastPrice) : null,
          currency: inst.currency || "INR",
          source: "instrument_master",
        };
      }
    }

    // Fetch remaining from mutual_funds
    const remainingIsins = isinList.filter((i: string) => !results[i]);
    if (remainingIsins.length > 0) {
      const funds = await db.select({
        isin: mutualFunds.isin,
        schemeName: mutualFunds.schemeName,
        nav: mutualFunds.nav,
      })
        .from(mutualFunds)
        .where(inArray(mutualFunds.isin, remainingIsins));

      for (const fund of funds) {
        if (fund.isin) {
          results[fund.isin] = {
            isin: fund.isin,
            name: fund.schemeName,
            assetClass: "mutual_fund",
            currentPrice: fund.nav ? parseFloat(fund.nav) : null,
            currency: "INR",
            source: "mutual_funds",
          };
        }
      }
    }

    // Return results with not-found marked
    const finalResults = isinList.map((isin: string) => ({
      isin,
      found: !!results[isin],
      ...(results[isin] || { error: "Not found" })
    }));

    res.json({
      success: true,
      count: finalResults.filter((r: any) => r.found).length,
      total: isinList.length,
      data: finalResults
    });

  } catch (error: any) {
    console.error("Bulk price lookup error:", error);
    res.status(500).json({ error: "Failed to lookup prices" });
  }
});

// Unified instrument search - searches across all data sources (instrumentMaster, mutualFunds, listedStocks, corporateBonds)
router.get("/api/instruments/unified-search", async (req: Request, res: Response) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || String(q).length < 2) {
      return res.json({ instruments: [] });
    }

    const searchTerm = String(q).trim().toUpperCase();
    const searchPattern = `%${searchTerm}%`;
    const maxResults = Math.min(Number(limit), 50);
    
    // Check if searching by ISIN format
    const isIsinSearch = /^[A-Z]{2}[A-Z0-9]{9}[0-9]?$/.test(searchTerm);

    const results: any[] = [];

    // 1. Search instrumentMaster (primary source)
    const masterResults = await db.select({
      id: instrumentMaster.id,
      isin: instrumentMaster.isin,
      symbol: instrumentMaster.symbol,
      name: instrumentMaster.name,
      shortName: instrumentMaster.shortName,
      assetClass: instrumentMaster.assetClass,
      subType: instrumentMaster.subType,
      category: instrumentMaster.category,
      issuer: instrumentMaster.issuer,
      lastPrice: instrumentMaster.lastPrice,
      riskLevel: instrumentMaster.riskLevel,
    })
      .from(instrumentMaster)
      .where(and(
        or(
          ilike(instrumentMaster.isin, searchPattern),
          ilike(instrumentMaster.name, searchPattern),
          ilike(instrumentMaster.symbol, searchPattern),
          ilike(instrumentMaster.shortName, searchPattern)
        ),
        eq(instrumentMaster.isActive, true)
      ))
      .limit(maxResults);

    for (const item of masterResults) {
      let matchScore = 50;
      let matchField = 'name';
      
      if (item.isin?.toUpperCase() === searchTerm) {
        matchScore = 100;
        matchField = 'isin';
      } else if (item.symbol?.toUpperCase() === searchTerm) {
        matchScore = 95;
        matchField = 'symbol';
      } else if (item.isin?.toUpperCase().includes(searchTerm)) {
        matchScore = 90;
        matchField = 'isin';
      } else if (item.symbol?.toUpperCase().includes(searchTerm)) {
        matchScore = 80;
        matchField = 'symbol';
      } else if (item.name?.toUpperCase().startsWith(searchTerm)) {
        matchScore = 75;
      }

      results.push({
        id: item.id,
        name: item.name || item.shortName || '',
        symbol: item.symbol || undefined,
        isin: item.isin || undefined,
        assetType: mapAssetClass(item.assetClass),
        category: item.category || undefined,
        subCategory: item.subType || undefined,
        issuer: item.issuer || undefined,
        currentPrice: item.lastPrice ? parseFloat(item.lastPrice) : undefined,
        riskLevel: item.riskLevel || undefined,
        matchScore,
        matchField,
        source: 'instrumentMaster'
      });
    }

    // 2. Search mutualFunds if not enough results
    if (results.length < maxResults) {
      const mfResults = await db.select({
        id: mutualFunds.id,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        category: mutualFunds.category,
        fundHouse: mutualFunds.fundHouse,
        nav: mutualFunds.nav,
        riskLevel: mutualFunds.riskLevel,
        returns1y: mutualFunds.returns1y,
        isin: mutualFunds.isin,
        isinGrowth: mutualFunds.isinGrowth,
      })
        .from(mutualFunds)
        .where(
          or(
            ilike(mutualFunds.schemeName, searchPattern),
            ilike(mutualFunds.schemeCode, searchPattern),
            sql`${mutualFunds.isin} ILIKE ${searchPattern}`,
            sql`${mutualFunds.isinGrowth} ILIKE ${searchPattern}`
          )
        )
        .limit(maxResults - results.length);

      for (const fund of mfResults) {
        // Skip if already in results by ISIN
        const isin = fund.isinGrowth || fund.isin;
        if (isin && results.some(r => r.isin === isin)) continue;

        let matchScore = 50;
        let matchField = 'name';
        
        if (isin?.toUpperCase() === searchTerm) {
          matchScore = 100;
          matchField = 'isin';
        } else if (isin?.toUpperCase().includes(searchTerm)) {
          matchScore = 90;
          matchField = 'isin';
        } else if (fund.schemeCode?.toUpperCase() === searchTerm) {
          matchScore = 85;
          matchField = 'symbol';
        } else if (fund.schemeName?.toUpperCase().startsWith(searchTerm)) {
          matchScore = 75;
        }

        const isEtf = fund.category?.toLowerCase().includes('etf') || 
                     fund.schemeName?.toLowerCase().includes('etf');

        results.push({
          id: fund.id,
          name: fund.schemeName || '',
          symbol: fund.schemeCode || undefined,
          isin: isin || undefined,
          assetType: isEtf ? 'ETF' : 'MUTUAL_FUND',
          category: fund.category || undefined,
          fundHouse: fund.fundHouse || undefined,
          currentNav: fund.nav ? parseFloat(fund.nav) : undefined,
          riskLevel: fund.riskLevel || undefined,
          returns1y: fund.returns1y ? parseFloat(fund.returns1y) : undefined,
          matchScore,
          matchField,
          source: 'mutualFunds'
        });
      }
    }

    // Sort by match score descending
    results.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ 
      instruments: results.slice(0, maxResults),
      total: results.length,
      searchTerm
    });
  } catch (error: any) {
    console.error("Unified instrument search error:", error);
    res.status(500).json({ error: "Failed to search instruments" });
  }
});

function mapAssetClass(assetClass?: string | null): string {
  if (!assetClass) return 'EQUITY';
  const lc = assetClass.toLowerCase();
  if (lc.includes('mutual') || lc === 'mf') return 'MUTUAL_FUND';
  if (lc.includes('bond') || lc === 'debt') return 'BOND';
  if (lc.includes('etf')) return 'ETF';
  if (lc.includes('equity') || lc.includes('stock')) return 'EQUITY';
  return 'EQUITY';
}

export default router;
