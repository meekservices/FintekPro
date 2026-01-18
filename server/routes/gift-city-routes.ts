import { Router, Request, Response } from "express";
import { db } from "../db";
import { giftCityProducts, insertGiftCityProductSchema } from "@shared/schema";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";

const router = Router();

const INBOUND_PRODUCTS_SEED = [
  {
    name: "IFSC Category III AIF - India Tech Growth Fund",
    description: "Category III Alternative Investment Fund focused on listed Indian technology stocks with long-short strategies.",
    category: "Alternative Investment Funds",
    subcategory: "Category III AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Investor",
    lrsApplicable: false,
    minimumInvestment: "1000000",
    currency: "USD",
    expectedReturns: "18-25% IRR",
    riskLevel: "High",
    provider: "GIFT City AMC",
    features: ["Long-short equity strategies", "Leverage permitted up to 2x", "Quarterly liquidity"],
    regulatoryBenefits: ["No STT/CTT", "10-year tax holiday", "No GST on management fees"],
    eligibility: ["Foreign Portfolio Investors", "Family Offices", "Sovereign Wealth Funds"],
    complianceRequirements: ["KYC verification", "FATCA declaration", "CRS reporting"],
    taxImplications: "No capital gains tax in IFSC. Tax holiday for fund manager.",
    isPublished: true, isPremium: true, isLimited: false
  },
  {
    name: "IFSC Category II AIF - India Infrastructure Fund",
    description: "Unlisted infrastructure investments across highways, ports, renewable energy and logistics.",
    category: "Alternative Investment Funds",
    subcategory: "Category II AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "5000000",
    currency: "USD",
    expectedReturns: "14-18% IRR",
    riskLevel: "Medium-High",
    provider: "GIFT Infra Partners",
    features: ["Direct infrastructure investments", "Co-investment opportunities", "ESG-compliant"],
    regulatoryBenefits: ["Zero capital gains tax", "No stamp duty", "Efficient repatriation"],
    eligibility: ["Pension Funds", "Insurance Companies", "Development Finance Institutions"],
    complianceRequirements: ["KYC verification", "FATCA/CRS compliance", "AML checks"],
    taxImplications: "Pass-through taxation. No withholding on capital gains.",
    isPublished: true, isPremium: true, isLimited: true
  },
  {
    name: "IFSC Category I AIF - Venture Capital Fund",
    description: "Early-stage technology investments in Indian startups. Focus on fintech, deeptech and climate-tech.",
    category: "Alternative Investment Funds",
    subcategory: "Category I AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "2500000",
    currency: "USD",
    expectedReturns: "25-35% IRR (target)",
    riskLevel: "Very High",
    provider: "GIFT VC Partners",
    features: ["Early-stage focus", "Board seats", "Follow-on reserves", "Sector expertise"],
    regulatoryBenefits: ["Carried interest tax benefits", "No capital gains in IFSC"],
    eligibility: ["Venture Capital Funds", "Family Offices", "Corporate Venture", "Endowments"],
    complianceRequirements: ["Accredited investor verification", "KYC", "Source of funds"],
    taxImplications: "Long-term capital gains treatment. Carried interest taxed favorably.",
    isPublished: true, isPremium: true, isLimited: true
  },
  {
    name: "IFSC REIT - India Commercial Real Estate Trust",
    description: "Listed REIT investing in Grade A commercial properties across Mumbai, Bengaluru and Hyderabad.",
    category: "Alternative Investment Funds",
    subcategory: "REIT",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Portfolio Investor",
    lrsApplicable: false,
    minimumInvestment: "50000",
    currency: "USD",
    expectedReturns: "8-10% yield + appreciation",
    riskLevel: "Medium",
    provider: "GIFT REIT Manager",
    features: ["Listed on NSE IFSC", "Daily liquidity", "Quarterly dividends"],
    regulatoryBenefits: ["No STT", "Tax-efficient structure", "USD settlement"],
    eligibility: ["FPIs", "NRIs", "Offshore Funds", "Global REITs"],
    complianceRequirements: ["KYC", "PAN for NRIs", "FATCA declaration"],
    taxImplications: "Dividend distribution taxed at 10% for foreign investors.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "IFSC Banking Unit - USD Fixed Deposit",
    description: "Foreign currency fixed deposits with IFSC Banking Units. Various tenors from 3 months to 5 years.",
    category: "IFSC Banking",
    subcategory: "Fixed Deposits",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Banking Regulations",
    investorType: "NRI (Non-Resident Indian)",
    lrsApplicable: false,
    minimumInvestment: "25000",
    currency: "USD",
    expectedReturns: "4.5-5.5% p.a.",
    riskLevel: "Low",
    provider: "Multiple IBUs",
    features: ["Flexible tenors", "Premature withdrawal", "Auto-renewal", "Online banking"],
    regulatoryBenefits: ["Interest tax-free in India", "Full repatriation", "No TDS"],
    eligibility: ["NRIs", "PIOs", "Foreign Nationals", "Offshore Corporates"],
    complianceRequirements: ["KYC documentation", "Overseas address proof", "FATCA/CRS"],
    taxImplications: "Interest income tax-free in India for NRIs.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "India INX Listed Bonds - Sovereign & Corporate",
    description: "Access to Indian sovereign and top-rated corporate bonds listed on India International Exchange.",
    category: "Structured Products",
    subcategory: "Listed Bonds",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Portfolio Investor",
    lrsApplicable: false,
    minimumInvestment: "10000",
    currency: "USD",
    expectedReturns: "6-9% p.a.",
    riskLevel: "Low",
    provider: "India INX",
    features: ["Sovereign bonds", "AAA-rated corporates", "Green bonds", "Daily liquidity"],
    regulatoryBenefits: ["No STT", "No capital gains tax", "Efficient settlement T+2"],
    eligibility: ["FPIs", "Global Bond Funds", "Insurance Companies", "Central Banks"],
    complianceRequirements: ["FPI registration", "KYC", "FATCA/CRS"],
    taxImplications: "Interest taxed at 5% for FPIs (concessional).",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "IFSC Bullion Trading Account",
    description: "Trade in international gold and silver markets through IIBX. Physical delivery available.",
    category: "Global Trading",
    subcategory: "Bullion",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Bullion Exchange",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "50000",
    currency: "USD",
    expectedReturns: "Market-linked",
    riskLevel: "Medium",
    provider: "IIBX / NSE IFSC",
    features: ["Spot and futures trading", "Physical delivery option", "Electronic gold receipts"],
    regulatoryBenefits: ["No customs duty on bullion", "No GST within IFSC"],
    eligibility: ["Bullion dealers", "Jewellers", "Institutional investors"],
    complianceRequirements: ["IIBX membership", "KYC", "Net worth requirements"],
    taxImplications: "Trading profits exempt from tax in IFSC.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "IFSC Insurance - Global Life Cover",
    description: "US Dollar denominated life insurance with investment component. Global coverage.",
    category: "Insurance & Reinsurance",
    subcategory: "Life Insurance",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Insurance",
    investorType: "HNI (High Net Worth Individual)",
    lrsApplicable: false,
    minimumInvestment: "100000",
    currency: "USD",
    expectedReturns: "6-8% (with investment)",
    riskLevel: "Low",
    provider: "IFSC Life Insurance",
    features: ["USD-denominated policy", "Global coverage", "Estate planning benefits"],
    regulatoryBenefits: ["No GST on premiums", "Tax-efficient payouts"],
    eligibility: ["HNIs", "NRIs", "Global Citizens", "Family Offices"],
    complianceRequirements: ["Medical underwriting", "KYC verification", "Source of funds"],
    taxImplications: "Death benefit tax-free. Maturity taxable per investor jurisdiction.",
    isPublished: true, isPremium: true, isLimited: false
  }
];

const OUTBOUND_PRODUCTS_SEED = [
  {
    name: "Global Multi-Asset Fund (LRS)",
    description: "Diversified global portfolio investing in US, European and Asian markets under LRS limits.",
    category: "Alternative Investment Funds",
    subcategory: "Global Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "8-12% p.a.",
    riskLevel: "Medium",
    provider: "GIFT Global AMC",
    features: ["Diversified global exposure", "Professional management", "Quarterly liquidity"],
    regulatoryBenefits: ["Compliant with RBI LRS", "Tax-efficient IFSC structure"],
    eligibility: ["Resident Indians", "HNIs", "Retail investors with LRS quota"],
    complianceRequirements: ["PAN verification", "Form A2 declaration", "LRS limit check"],
    taxImplications: "Capital gains taxable in India. TCS applicable above ₹7L.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "US S&P 500 Index Fund (LRS)",
    description: "Low-cost index fund tracking the S&P 500 with direct investment in US blue-chip stocks.",
    category: "Alternative Investment Funds",
    subcategory: "Index Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "1000",
    currency: "USD",
    expectedReturns: "10-14% p.a. (historical)",
    riskLevel: "Medium-High",
    provider: "GIFT Passive Funds",
    features: ["S&P 500 tracking", "Low expense ratio", "Daily NAV", "No lock-in"],
    regulatoryBenefits: ["LRS-compliant", "Tax-efficient", "Lower costs than direct US"],
    eligibility: ["Resident Indians", "First-time global investors", "Long-term investors"],
    complianceRequirements: ["PAN", "Aadhaar", "Form A2", "LRS declaration"],
    taxImplications: "LTCG at 20% with indexation after 2 years.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "Global Technology Fund (LRS)",
    description: "Concentrated portfolio of leading global technology companies - FAANG, semiconductors, AI.",
    category: "Alternative Investment Funds",
    subcategory: "Sector Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "15-25% p.a. (target)",
    riskLevel: "High",
    provider: "GIFT Tech Investments",
    features: ["Top 30 global tech stocks", "Active management", "Thematic exposure"],
    regulatoryBenefits: ["LRS-compliant", "Professional stock selection"],
    eligibility: ["Growth-oriented investors", "Tech sector believers"],
    complianceRequirements: ["PAN", "Form A2", "Risk profiling", "LRS utilization check"],
    taxImplications: "High-volatility asset. LTCG taxable at 20% with indexation.",
    isPublished: true, isPremium: true, isLimited: false
  },
  {
    name: "Global Gold ETF (LRS)",
    description: "Physical gold-backed ETF providing exposure to international gold prices.",
    category: "Global Trading",
    subcategory: "Gold ETF",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "500",
    currency: "USD",
    expectedReturns: "Gold price linked",
    riskLevel: "Medium",
    provider: "GIFT Commodities",
    features: ["Physical gold backing", "London vault storage", "Daily liquidity"],
    regulatoryBenefits: ["LRS-compliant", "No storage hassle", "International gold prices"],
    eligibility: ["Gold investors", "Portfolio hedgers", "Inflation protection seekers"],
    complianceRequirements: ["PAN", "Form A2", "Basic KYC"],
    taxImplications: "Taxed as non-equity mutual fund. LTCG at 20% after 3 years.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "International Bond Portfolio (LRS)",
    description: "Investment-grade international bonds including US Treasuries and European sovereigns.",
    category: "Structured Products",
    subcategory: "International Bonds",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "10000",
    currency: "USD",
    expectedReturns: "4-6% p.a.",
    riskLevel: "Low",
    provider: "GIFT Fixed Income",
    features: ["Sovereign bonds", "Investment-grade corporates", "Currency hedging options"],
    regulatoryBenefits: ["LRS route", "Tax efficiency", "USD income"],
    eligibility: ["Conservative investors", "Retirees", "Portfolio diversifiers"],
    complianceRequirements: ["PAN", "Form A2", "Investment declaration"],
    taxImplications: "Interest taxed at slab rate. LTCG at 20% with indexation.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "European Equity Fund (LRS)",
    description: "Diversified European equity exposure covering UK, Germany, France, Switzerland.",
    category: "Alternative Investment Funds",
    subcategory: "Regional Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "EUR",
    expectedReturns: "8-12% p.a.",
    riskLevel: "Medium",
    provider: "GIFT Europe Fund",
    features: ["Diversified European exposure", "Quality dividend focus", "EUR-denominated"],
    regulatoryBenefits: ["LRS route", "Geographic diversification"],
    eligibility: ["Diversification seekers", "International investors", "Euro bulls"],
    complianceRequirements: ["PAN", "Form A2", "LRS declaration"],
    taxImplications: "LTCG at 20% with indexation. Euro dividends taxable at slab rate.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "Emerging Markets ex-India Fund (LRS)",
    description: "Exposure to high-growth emerging markets excluding India - China, Brazil, Indonesia.",
    category: "Alternative Investment Funds",
    subcategory: "Emerging Markets",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "12-18% p.a. (target)",
    riskLevel: "High",
    provider: "GIFT EM Partners",
    features: ["Emerging market growth", "Ex-India exposure", "Active country allocation"],
    regulatoryBenefits: ["LRS-compliant", "EM growth capture", "Portfolio diversification"],
    eligibility: ["Growth investors", "EM believers", "Portfolio diversifiers"],
    complianceRequirements: ["PAN", "Form A2", "High-risk acknowledgment", "LRS check"],
    taxImplications: "Higher volatility. LTCG taxable. Currency risk inherent.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "Global Healthcare & Biotech Fund (LRS)",
    description: "Investment in leading global pharma, biotech, medical devices companies.",
    category: "Alternative Investment Funds",
    subcategory: "Sector Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "10-15% p.a. (target)",
    riskLevel: "Medium-High",
    provider: "GIFT Healthcare Fund",
    features: ["Global pharma leaders", "Biotech exposure", "MedTech innovation"],
    regulatoryBenefits: ["LRS route", "Sector expertise", "Defensive characteristics"],
    eligibility: ["Healthcare sector believers", "Defensive growth seekers"],
    complianceRequirements: ["PAN", "Form A2", "Investment suitability check"],
    taxImplications: "LTCG taxable at 20% with indexation.",
    isPublished: true, isPremium: false, isLimited: false
  },
  {
    name: "IFSC Family Office Services",
    description: "Comprehensive family office setup and management services in GIFT City.",
    category: "Family Office Services",
    subcategory: "Multi-Family Office",
    flowDirection: "outbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "HNI (High Net Worth Individual)",
    lrsApplicable: true,
    lrsCategory: "Capital Account - Investment",
    minimumInvestment: "10000000",
    currency: "USD",
    expectedReturns: "Advisory-based",
    riskLevel: "Low",
    provider: "GIFT Family Office",
    features: ["Dedicated family office setup", "Investment structuring", "Tax optimization"],
    regulatoryBenefits: ["Tax holiday benefits", "Confidentiality", "Single-window regulatory"],
    eligibility: ["Ultra-HNIs", "Business families", "NRI families"],
    complianceRequirements: ["Enhanced due diligence", "Source of wealth", "UBO declaration"],
    taxImplications: "Structure-dependent tax treatment. Professional advice required.",
    isPublished: true, isPremium: true, isLimited: true
  },
  {
    name: "Aircraft Leasing SPV (LRS/FDI)",
    description: "Special Purpose Vehicle for aircraft leasing operations with IFSC tax benefits.",
    category: "Aircraft Leasing",
    subcategory: "Aviation Finance",
    flowDirection: "outbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "25000000",
    currency: "USD",
    expectedReturns: "10-14% IRR",
    riskLevel: "Medium",
    provider: "GIFT Aviation Finance",
    features: ["Aircraft ownership", "India market access", "Tax-efficient structure"],
    regulatoryBenefits: ["No withholding on lease rentals", "No MAT", "GST exemption"],
    eligibility: ["Aviation investors", "Leasing companies", "PE funds", "Family offices"],
    complianceRequirements: ["DGCA compliance", "IFSCA registration", "Due diligence"],
    taxImplications: "Lease income exempt in IFSC. Depreciation benefits available.",
    isPublished: true, isPremium: true, isLimited: true
  }
];

router.get("/admin", async (req: Request, res: Response) => {
  try {
    const products = await db
      .select()
      .from(giftCityProducts)
      .orderBy(desc(giftCityProducts.createdAt));
    
    res.json({ products });
  } catch (error) {
    console.error("Error fetching Gift City products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    
    let conditions = [eq(giftCityProducts.isPublished, true)];
    
    if (category && category !== "all") {
      conditions.push(eq(giftCityProducts.category, category as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(giftCityProducts.name, `%${search}%`),
          ilike(giftCityProducts.provider, `%${search}%`),
          ilike(giftCityProducts.category, `%${search}%`)
        ) as any
      );
    }
    
    const products = await db
      .select()
      .from(giftCityProducts)
      .where(and(...conditions))
      .orderBy(desc(giftCityProducts.createdAt));
    
    res.json({ products });
  } catch (error) {
    console.error("Error fetching Gift City products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/admin", async (req: Request, res: Response) => {
  try {
    const validation = insertGiftCityProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const [product] = await db
      .insert(giftCityProducts)
      .values(validation.data)
      .returning();

    res.status(201).json({ product });
  } catch (error) {
    console.error("Error creating Gift City product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.post("/admin/bulk-seed", async (req: Request, res: Response) => {
  try {
    const { template } = req.body;
    let productsToSeed: any[] = [];

    switch (template) {
      case "inbound":
        productsToSeed = INBOUND_PRODUCTS;
        break;
      case "outbound":
        productsToSeed = OUTBOUND_PRODUCTS;
        break;
      case "all":
        productsToSeed = [...INBOUND_PRODUCTS, ...OUTBOUND_PRODUCTS];
        break;
      case "aif":
        productsToSeed = [...INBOUND_PRODUCTS, ...OUTBOUND_PRODUCTS].filter(
          p => p.category === "Alternative Investment Funds"
        );
        break;
      case "global-funds":
        productsToSeed = OUTBOUND_PRODUCTS.filter(
          p => p.subcategory?.includes("Fund") || p.subcategory?.includes("ETF")
        );
        break;
      default:
        return res.status(400).json({ error: "Invalid template" });
    }

    if (productsToSeed.length === 0) {
      return res.json({ count: 0, message: "No products to seed" });
    }

    const inserted = await db
      .insert(giftCityProducts)
      .values(productsToSeed)
      .returning();

    res.json({ count: inserted.length, products: inserted });
  } catch (error) {
    console.error("Error bulk seeding Gift City products:", error);
    res.status(500).json({ error: "Failed to seed products" });
  }
});

router.delete("/admin/clear-all", async (req: Request, res: Response) => {
  try {
    const deleted = await db.delete(giftCityProducts).returning();
    res.json({ success: true, count: deleted.length });
  } catch (error) {
    console.error("Error clearing Gift City products:", error);
    res.status(500).json({ error: "Failed to clear products" });
  }
});

router.put("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;

    const [product] = await db
      .update(giftCityProducts)
      .set(updateData)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error updating Gift City product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.patch("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    const [product] = await db
      .update(giftCityProducts)
      .set(updateData)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error updating Gift City product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [product] = await db
      .delete(giftCityProducts)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting Gift City product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const result = await db
      .selectDistinct({ category: giftCityProducts.category })
      .from(giftCityProducts)
      .where(eq(giftCityProducts.isPublished, true));

    res.json({ categories: result.map(r => r.category) });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

const INBOUND_PRODUCTS = [
  {
    name: "IFSC Category III AIF - India Tech Growth Fund",
    description: "Category III Alternative Investment Fund focused on listed Indian technology stocks with long-short strategies. Managed by SEBI-registered fund manager operating from GIFT City.",
    category: "Alternative Investment Funds",
    subcategory: "Category III AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Investor",
    lrsApplicable: false,
    minimumInvestment: "1000000",
    currency: "USD",
    expectedReturns: "18-25% IRR",
    riskLevel: "High",
    provider: "GIFT City AMC",
    features: ["Long-short equity strategies", "Leverage permitted up to 2x", "Quarterly liquidity", "Offshore fund structure", "USD-denominated NAV"],
    regulatoryBenefits: ["No STT/CTT", "10-year tax holiday", "No GST on management fees", "DTAA benefits available"],
    eligibility: ["Foreign Portfolio Investors", "Family Offices", "Sovereign Wealth Funds", "Institutional Investors"],
    complianceRequirements: ["KYC verification", "FATCA declaration", "CRS reporting", "Source of funds declaration"],
    taxImplications: "No capital gains tax in IFSC. Dividend withholding per DTAA. Tax holiday for fund manager.",
    isPublished: true,
    isPremium: true,
    isLimited: false
  },
  {
    name: "IFSC Category II AIF - India Infrastructure Fund",
    description: "Unlisted infrastructure investments across highways, ports, renewable energy and logistics. 7-year fund life with possibility of extension.",
    category: "Alternative Investment Funds",
    subcategory: "Category II AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "5000000",
    currency: "USD",
    expectedReturns: "14-18% IRR",
    riskLevel: "Medium-High",
    provider: "GIFT Infra Partners",
    features: ["Direct infrastructure investments", "Co-investment opportunities", "Quarterly reporting", "ESG-compliant investments"],
    regulatoryBenefits: ["Zero capital gains tax", "No stamp duty", "Efficient repatriation", "Regulatory single-window clearance"],
    eligibility: ["Pension Funds", "Insurance Companies", "Development Finance Institutions", "Endowments"],
    complianceRequirements: ["KYC verification", "FATCA/CRS compliance", "Anti-money laundering checks", "Beneficial ownership declaration"],
    taxImplications: "Pass-through taxation at investor level. No withholding on capital gains. Interest income subject to DTAA rates.",
    isPublished: true,
    isPremium: true,
    isLimited: true
  },
  {
    name: "IFSC REIT - India Commercial Real Estate Trust",
    description: "Listed REIT investing in Grade A commercial properties across Mumbai, Bengaluru and Hyderabad. Quarterly dividend distributions.",
    category: "Alternative Investment Funds",
    subcategory: "REIT",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Portfolio Investor",
    lrsApplicable: false,
    minimumInvestment: "50000",
    currency: "USD",
    expectedReturns: "8-10% yield + appreciation",
    riskLevel: "Medium",
    provider: "GIFT REIT Manager",
    features: ["Listed on NSE IFSC", "Daily liquidity", "Quarterly dividends", "Diversified Grade A portfolio", "Professional management"],
    regulatoryBenefits: ["No STT", "Tax-efficient structure", "USD settlement", "Investor-friendly regulations"],
    eligibility: ["FPIs", "NRIs", "Offshore Funds", "Global REITs"],
    complianceRequirements: ["KYC", "PAN for NRIs", "FATCA declaration"],
    taxImplications: "Dividend distribution taxed at 10% for foreign investors. Capital gains exempt in IFSC.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "IFSC Banking Unit - USD Fixed Deposit",
    description: "Foreign currency fixed deposits with IFSC Banking Units offering competitive rates. Various tenors from 3 months to 5 years.",
    category: "IFSC Banking",
    subcategory: "Fixed Deposits",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Banking Regulations",
    investorType: "NRI (Non-Resident Indian)",
    lrsApplicable: false,
    minimumInvestment: "25000",
    currency: "USD",
    expectedReturns: "4.5-5.5% p.a.",
    riskLevel: "Low",
    provider: "Multiple IBUs",
    features: ["Flexible tenors", "Premature withdrawal facility", "Auto-renewal option", "Online banking access", "Multi-currency options"],
    regulatoryBenefits: ["Interest earned tax-free in India", "Full repatriation", "No TDS", "DICGC coverage equivalent"],
    eligibility: ["NRIs", "PIOs", "Foreign Nationals", "Offshore Corporates"],
    complianceRequirements: ["KYC documentation", "Overseas address proof", "FATCA/CRS self-certification"],
    taxImplications: "Interest income tax-free in India for NRIs. Taxable in country of residence per local laws.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "IFSC Insurance - Global Life Cover",
    description: "US Dollar denominated life insurance with investment component. Offshore policy with global coverage and estate planning benefits.",
    category: "Insurance & Reinsurance",
    subcategory: "Life Insurance",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Insurance",
    investorType: "HNI (High Net Worth Individual)",
    lrsApplicable: false,
    minimumInvestment: "100000",
    currency: "USD",
    expectedReturns: "6-8% (with investment)",
    riskLevel: "Low",
    provider: "IFSC Life Insurance",
    features: ["USD-denominated policy", "Global coverage", "Investment-linked options", "Estate planning benefits", "Premium financing available"],
    regulatoryBenefits: ["No GST on premiums", "Tax-efficient payouts", "Offshore structure benefits"],
    eligibility: ["HNIs", "NRIs", "Global Citizens", "Family Offices"],
    complianceRequirements: ["Medical underwriting", "KYC verification", "Source of funds"],
    taxImplications: "Death benefit tax-free. Maturity taxable per investor jurisdiction.",
    isPublished: true,
    isPremium: true,
    isLimited: false
  },
  {
    name: "India INX Listed Bonds - Sovereign & Corporate",
    description: "Access to Indian sovereign and top-rated corporate bonds listed on India International Exchange. Full repatriation with no lock-in.",
    category: "Structured Products",
    subcategory: "Listed Bonds",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Foreign Portfolio Investor",
    lrsApplicable: false,
    minimumInvestment: "10000",
    currency: "USD",
    expectedReturns: "6-9% p.a.",
    riskLevel: "Low",
    provider: "India INX",
    features: ["Sovereign bonds", "AAA-rated corporates", "Green bonds", "Daily liquidity", "USD settlement"],
    regulatoryBenefits: ["No STT", "No capital gains tax", "Efficient settlement T+2"],
    eligibility: ["FPIs", "Global Bond Funds", "Insurance Companies", "Central Banks"],
    complianceRequirements: ["FPI registration", "KYC", "FATCA/CRS"],
    taxImplications: "Interest taxed at 5% for FPIs (concessional). Capital gains exempt.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "IFSC Bullion Trading Account",
    description: "Trade in international gold and silver markets through IIBX. Physical delivery available in GIFT City vault.",
    category: "Global Trading",
    subcategory: "Bullion",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Bullion Exchange",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "50000",
    currency: "USD",
    expectedReturns: "Market-linked",
    riskLevel: "Medium",
    provider: "IIBX / NSE IFSC",
    features: ["Spot and futures trading", "Physical delivery option", "Allocated storage", "Hedging instruments", "Electronic gold receipts"],
    regulatoryBenefits: ["No customs duty on bullion", "No GST within IFSC", "Competitive refining charges"],
    eligibility: ["Bullion dealers", "Jewellers", "Institutional investors", "Trading firms"],
    complianceRequirements: ["IIBX membership", "KYC", "Net worth requirements"],
    taxImplications: "Trading profits exempt from tax in IFSC. Import duty applicable if taken out of IFSC.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "IFSC Category I AIF - Venture Capital Fund",
    description: "Early-stage technology investments in Indian startups. Focus on fintech, deeptech and climate-tech sectors.",
    category: "Alternative Investment Funds",
    subcategory: "Category I AIF",
    flowDirection: "inbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "2500000",
    currency: "USD",
    expectedReturns: "25-35% IRR (target)",
    riskLevel: "Very High",
    provider: "GIFT VC Partners",
    features: ["Early-stage focus", "Board seats", "Follow-on reserves", "Sector expertise", "Exit-focused approach"],
    regulatoryBenefits: ["Carried interest tax benefits", "No capital gains in IFSC", "Efficient fund structure"],
    eligibility: ["Venture Capital Funds", "Family Offices", "Corporate Venture", "Endowments"],
    complianceRequirements: ["Accredited investor verification", "KYC", "Source of funds", "Investment committee approval"],
    taxImplications: "Long-term capital gains treatment. Carried interest taxed favorably.",
    isPublished: true,
    isPremium: true,
    isLimited: true
  }
];

const OUTBOUND_PRODUCTS = [
  {
    name: "Global Multi-Asset Fund (LRS)",
    description: "Diversified global portfolio investing in US, European and Asian markets. Access to developed market equities, bonds and alternatives under LRS limits.",
    category: "Alternative Investment Funds",
    subcategory: "Global Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "8-12% p.a.",
    riskLevel: "Medium",
    provider: "GIFT Global AMC",
    features: ["Diversified global exposure", "Professional management", "Quarterly liquidity", "USD-denominated returns", "Regular rebalancing"],
    regulatoryBenefits: ["Compliant with RBI LRS", "Tax-efficient IFSC structure", "Lower transaction costs"],
    eligibility: ["Resident Indians", "HNIs", "Retail investors with LRS quota"],
    complianceRequirements: ["PAN verification", "Form A2 declaration", "LRS limit check", "Source of funds"],
    taxImplications: "Capital gains taxable in India. Foreign tax credit available. TCS applicable on remittance above ₹7L.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "US S&P 500 Index Fund (LRS)",
    description: "Low-cost index fund tracking the S&P 500 with direct investment in US blue-chip stocks through GIFT City route.",
    category: "Alternative Investment Funds",
    subcategory: "Index Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "1000",
    currency: "USD",
    expectedReturns: "10-14% p.a. (historical)",
    riskLevel: "Medium-High",
    provider: "GIFT Passive Funds",
    features: ["S&P 500 tracking", "Low expense ratio", "Daily NAV", "No lock-in", "Fractional investing"],
    regulatoryBenefits: ["LRS-compliant", "Tax-efficient", "Lower costs than direct US investing"],
    eligibility: ["Resident Indians", "First-time global investors", "Long-term investors"],
    complianceRequirements: ["PAN", "Aadhaar", "Form A2", "LRS declaration"],
    taxImplications: "LTCG at 20% with indexation after 2 years. Dividends taxable at slab rate. TCS 20% above ₹7L (adjustable).",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "International Bond Portfolio (LRS)",
    description: "Investment-grade international bonds including US Treasuries, European sovereigns and global corporate bonds.",
    category: "Structured Products",
    subcategory: "International Bonds",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "10000",
    currency: "USD",
    expectedReturns: "4-6% p.a.",
    riskLevel: "Low",
    provider: "GIFT Fixed Income",
    features: ["Sovereign bonds", "Investment-grade corporates", "Duration management", "Currency hedging options", "Regular income"],
    regulatoryBenefits: ["LRS route", "Tax efficiency", "USD income"],
    eligibility: ["Conservative investors", "Retirees", "Portfolio diversifiers"],
    complianceRequirements: ["PAN", "Form A2", "Investment declaration", "Tax residency certificate"],
    taxImplications: "Interest taxed at slab rate. LTCG at 20% with indexation. Foreign tax credit for withholding.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "Global Technology Fund (LRS)",
    description: "Concentrated portfolio of leading global technology companies - FAANG, semiconductors, cloud computing and AI leaders.",
    category: "Alternative Investment Funds",
    subcategory: "Sector Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "15-25% p.a. (target)",
    riskLevel: "High",
    provider: "GIFT Tech Investments",
    features: ["Top 30 global tech stocks", "Active management", "Thematic exposure", "Growth focus", "Quarterly rebalancing"],
    regulatoryBenefits: ["LRS-compliant", "Professional stock selection", "Reduced single-stock risk"],
    eligibility: ["Growth-oriented investors", "Tech sector believers", "Long-term wealth builders"],
    complianceRequirements: ["PAN", "Form A2", "Risk profiling", "LRS utilization check"],
    taxImplications: "High-volatility asset. LTCG taxable at 20% with indexation. Dividends at slab rate.",
    isPublished: true,
    isPremium: true,
    isLimited: false
  },
  {
    name: "Global Gold ETF (LRS)",
    description: "Physical gold-backed ETF providing exposure to international gold prices. Held in London vaults with daily NAV.",
    category: "Global Trading",
    subcategory: "Gold ETF",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "500",
    currency: "USD",
    expectedReturns: "Gold price linked",
    riskLevel: "Medium",
    provider: "GIFT Commodities",
    features: ["Physical gold backing", "London vault storage", "Daily liquidity", "Low expense ratio", "USD-denominated"],
    regulatoryBenefits: ["LRS-compliant", "No storage hassle", "International gold prices"],
    eligibility: ["Gold investors", "Portfolio hedgers", "Inflation protection seekers"],
    complianceRequirements: ["PAN", "Form A2", "Basic KYC"],
    taxImplications: "Taxed as non-equity mutual fund. LTCG at 20% with indexation after 3 years.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "European Equity Fund (LRS)",
    description: "Diversified European equity exposure covering UK, Germany, France, Switzerland and Nordics. Focus on quality dividend stocks.",
    category: "Alternative Investment Funds",
    subcategory: "Regional Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "EUR",
    expectedReturns: "8-12% p.a.",
    riskLevel: "Medium",
    provider: "GIFT Europe Fund",
    features: ["Diversified European exposure", "Quality dividend focus", "EUR-denominated", "Developed market stability"],
    regulatoryBenefits: ["LRS route", "Geographic diversification", "EUR currency exposure"],
    eligibility: ["Diversification seekers", "International investors", "Euro bulls"],
    complianceRequirements: ["PAN", "Form A2", "LRS declaration", "Investment questionnaire"],
    taxImplications: "LTCG at 20% with indexation. Euro dividends taxable at slab rate.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "Emerging Markets ex-India Fund (LRS)",
    description: "Exposure to high-growth emerging markets excluding India - China, Brazil, Indonesia, Vietnam, Mexico and others.",
    category: "Alternative Investment Funds",
    subcategory: "Emerging Markets",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "12-18% p.a. (target)",
    riskLevel: "High",
    provider: "GIFT EM Partners",
    features: ["Emerging market growth", "Ex-India exposure", "Diversified EM basket", "Active country allocation"],
    regulatoryBenefits: ["LRS-compliant", "EM growth capture", "Portfolio diversification"],
    eligibility: ["Growth investors", "EM believers", "Portfolio diversifiers"],
    complianceRequirements: ["PAN", "Form A2", "High-risk acknowledgment", "LRS check"],
    taxImplications: "Higher volatility. LTCG taxable. Currency risk inherent.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "Global Healthcare & Biotech Fund (LRS)",
    description: "Investment in leading global pharma, biotech, medical devices and healthcare services companies.",
    category: "Alternative Investment Funds",
    subcategory: "Sector Fund",
    flowDirection: "outbound",
    regulatoryFramework: "FEMA LRS (Liberalised Remittance Scheme)",
    investorType: "Resident Indian",
    lrsApplicable: true,
    lrsCategory: "Investment in Equity/Debt",
    minimumInvestment: "5000",
    currency: "USD",
    expectedReturns: "10-15% p.a. (target)",
    riskLevel: "Medium-High",
    provider: "GIFT Healthcare Fund",
    features: ["Global pharma leaders", "Biotech exposure", "MedTech innovation", "Aging population theme", "Defensive growth"],
    regulatoryBenefits: ["LRS route", "Sector expertise", "Defensive characteristics"],
    eligibility: ["Healthcare sector believers", "Defensive growth seekers", "Long-term investors"],
    complianceRequirements: ["PAN", "Form A2", "Investment suitability check"],
    taxImplications: "LTCG taxable at 20% with indexation. Sector-specific risks apply.",
    isPublished: true,
    isPremium: false,
    isLimited: false
  },
  {
    name: "IFSC Family Office Services",
    description: "Comprehensive family office setup and management services in GIFT City. Includes fund structuring, tax planning, succession and governance.",
    category: "Family Office Services",
    subcategory: "Multi-Family Office",
    flowDirection: "outbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "HNI (High Net Worth Individual)",
    lrsApplicable: true,
    lrsCategory: "Capital Account - Investment",
    minimumInvestment: "10000000",
    currency: "USD",
    expectedReturns: "Advisory-based",
    riskLevel: "Low",
    provider: "GIFT Family Office",
    features: ["Dedicated family office setup", "Investment structuring", "Tax optimization", "Succession planning", "Governance framework"],
    regulatoryBenefits: ["Tax holiday benefits", "Confidentiality", "Single-window regulatory", "Global investment access"],
    eligibility: ["Ultra-HNIs", "Business families", "NRI families"],
    complianceRequirements: ["Enhanced due diligence", "Source of wealth", "Family documentation", "UBO declaration"],
    taxImplications: "Structure-dependent tax treatment. Professional advice required.",
    isPublished: true,
    isPremium: true,
    isLimited: true
  },
  {
    name: "Aircraft Leasing SPV (LRS/FDI)",
    description: "Special Purpose Vehicle for aircraft leasing operations. Access to India aviation market with IFSC tax benefits.",
    category: "Aircraft Leasing",
    subcategory: "Aviation Finance",
    flowDirection: "outbound",
    regulatoryFramework: "IFSCA Fund Management",
    investorType: "Institutional Investor",
    lrsApplicable: false,
    minimumInvestment: "25000000",
    currency: "USD",
    expectedReturns: "10-14% IRR",
    riskLevel: "Medium",
    provider: "GIFT Aviation Finance",
    features: ["Aircraft ownership", "India market access", "Tax-efficient structure", "Dollar revenues", "Professional management"],
    regulatoryBenefits: ["No withholding on lease rentals", "No MAT", "GST exemption", "Depreciation benefits"],
    eligibility: ["Aviation investors", "Leasing companies", "PE funds", "Family offices"],
    complianceRequirements: ["DGCA compliance", "IFSCA registration", "Due diligence", "Technical assessment"],
    taxImplications: "Lease income exempt in IFSC. Depreciation benefits available. Exit planning critical.",
    isPublished: true,
    isPremium: true,
    isLimited: true
  }
];

export default router;
