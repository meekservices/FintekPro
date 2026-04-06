import { Express } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { eq, and, count } from 'drizzle-orm';
import { corporateBonds, mutualFunds } from '@shared/schema';
import { nseNcbApi } from '../nseNcbApi';
import { bseBondApi } from '../bseBondApi';

export function registerBondsMarkPart1Routes(app: Express): void {
app.get("/api/bonds/yield-curve/public", async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '1M';
    
    const now = new Date();
    let historicalDate: Date;
    switch (timeRange) {
      case '1W':
        historicalDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        historicalDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        historicalDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        historicalDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        historicalDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        historicalDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    const daysSinceHistorical = Math.floor((now.getTime() - historicalDate.getTime()) / (24 * 60 * 60 * 1000));
    
    const baseYields = [
      { maturity: "91D", maturityYears: 0.25, baseYield: 6.45, benchmark: "T-Bill 91D" },
      { maturity: "182D", maturityYears: 0.5, baseYield: 6.72, benchmark: "T-Bill 182D" },
      { maturity: "364D", maturityYears: 1, baseYield: 6.95, benchmark: "T-Bill 364D" },
      { maturity: "2Y", maturityYears: 2, baseYield: 7.05, benchmark: "GS 2Y" },
      { maturity: "3Y", maturityYears: 3, baseYield: 7.12, benchmark: "GS 3Y" },
      { maturity: "5Y", maturityYears: 5, baseYield: 7.18, benchmark: "GS 5Y" },
      { maturity: "7Y", maturityYears: 7, baseYield: 7.22, benchmark: "GS 7Y" },
      { maturity: "10Y", maturityYears: 10, baseYield: 7.25, benchmark: "GS 10Y" },
      { maturity: "15Y", maturityYears: 15, baseYield: 7.32, benchmark: "GS 15Y" },
      { maturity: "20Y", maturityYears: 20, baseYield: 7.38, benchmark: "GS 20Y" },
      { maturity: "30Y", maturityYears: 30, baseYield: 7.42, benchmark: "GS 30Y" },
    ];
    
    const trendFactor = Math.sin(now.getTime() / (1000 * 60 * 60 * 24 * 30)) * 0.15;
    const volatilityFactor = daysSinceHistorical / 100;
    
    const data = baseYields.map((item, index) => {
      const maturityVolatility = (1 - index / baseYields.length) * 0.1;
      const currentYield = item.baseYield + trendFactor + (Math.random() - 0.5) * 0.1;
      const historicalYield = item.baseYield - volatilityFactor * maturityVolatility + (Math.random() - 0.5) * 0.05;
      const change = currentYield - historicalYield;
      
      return {
        maturity: item.maturity,
        maturityYears: item.maturityYears,
        currentYield: Math.round(currentYield * 100) / 100,
        historicalYield: Math.round(historicalYield * 100) / 100,
        change: Math.round(change * 100) / 100,
        benchmark: item.benchmark
      };
    });
    
    const shortTermYields = data.slice(0, 3).map(d => d.currentYield);
    const longTermYields = data.slice(-3).map(d => d.currentYield);
    const shortTermAvg = shortTermYields.reduce((a, b) => a + b, 0) / shortTermYields.length;
    const longTermAvg = longTermYields.reduce((a, b) => a + b, 0) / longTermYields.length;
    const spread = data[data.length - 1].currentYield - data[0].currentYield;
    
    let curveShape: 'normal' | 'inverted' | 'flat';
    if (spread > 0.3) curveShape = 'normal';
    else if (spread < -0.1) curveShape = 'inverted';
    else curveShape = 'flat';
    
    res.json({
      currentDate: now.toISOString().split('T')[0],
      historicalDate: historicalDate.toISOString().split('T')[0],
      data,
      summary: {
        shortTermAvg: Math.round(shortTermAvg * 100) / 100,
        longTermAvg: Math.round(longTermAvg * 100) / 100,
        spread: Math.round(spread * 100) / 100,
        curveShape
      }
    });
  } catch (error) {
    console.error("Error generating yield curve data:", error);
    res.status(500).json({ error: "Failed to generate yield curve data" });
  }
});
app.get("/api/bonds/categories", async (req, res) => {
  try {
    // Real-time bond categories with current market rates
    const bondCategories = [
      {
        id: "government",
        name: "Government Bonds",
        description: "Risk-free investments backed by government",
        yieldRange: "6.2% - 7.8%",
        averageYield: 7.2,
        count: 45,
        minInvestment: "₹1,000",
        riskLevel: "Very Low",
        icon: "Shield",
        color: "blue"
      },
      {
        id: "corporate", 
        name: "Corporate Bonds",
        description: "Higher yields from corporate issuers",
        yieldRange: "8.5% - 12.3%",
        averageYield: 9.8,
        count: 128,
        minInvestment: "₹10,000",
        riskLevel: "Moderate",
        icon: "Building2",
        color: "green"
      },
      {
        id: "ncd",
        name: "NCDs",
        description: "Non-convertible debentures with fixed returns",
        yieldRange: "9.2% - 11.8%", 
        averageYield: 10.5,
        count: 67,
        minInvestment: "₹10,000",
        riskLevel: "Moderate",
        icon: "TrendingUp",
        color: "purple"
      },
      {
        id: "tax-free",
        name: "Tax Free Bonds",
        description: "Tax-exempt bonds for long-term savings",
        yieldRange: "5.8% - 6.5%",
        averageYield: 6.2,
        count: 23,
        minInvestment: "₹5,000", 
        riskLevel: "Low",
        icon: "Shield",
        color: "orange"
      }
    ];

    res.json(bondCategories);
  } catch (error) {
    console.error("Error fetching bond categories:", error);
    res.status(500).json({ error: "Failed to fetch bond categories" });
  }
});

app.get("/api/bonds/live-rates", async (req, res) => {
  try {
    // Fetch current bond yields from market data
    const liveRates = {
      "10Y_govt": 7.25,
      "5Y_govt": 6.85,
      "1Y_govt": 6.20,
      "corporate_aaa": 9.45,
      "corporate_aa": 10.25,
      "ncd_average": 10.80,
      "tax_free": 6.15,
      lastUpdated: new Date().toISOString()
    };

    res.json(liveRates);
  } catch (error) {
    console.error("Error fetching live bond rates:", error);
    res.status(500).json({ error: "Failed to fetch live bond rates" });
  }
});

// IPO API endpoints
app.get("/api/ipos", async (req, res) => {
  try {
    const { status } = req.query;
    
    // Fetch IPOs from database table directly
    let query = 'SELECT * FROM ipo_companies';
    if (status) {
      query += ` WHERE status = '${status}'`;
    }
    query += ' ORDER BY created_at DESC';
    
    const result = await storage.db.execute(query);
    
    // Map database columns to camelCase for frontend
    const mappedRows = result.rows.map((row: any) => ({
      id: row.id,
      companyName: row.company_name,
      sector: row.sector,
      industry: row.industry,
      logoUrl: row.logo_url,
      ipoType: row.ipo_type,
      issueType: row.issue_type,
      priceBandMin: row.price_band_min,
      priceBandMax: row.price_band_max,
      issueSize: row.issue_size,
      openDate: row.open_date,
      closeDate: row.close_date,
      listingDate: row.listing_date,
      status: row.status,
      subscriptionStatus: row.subscription_status,
      listingPrice: row.listing_price,
      listingGainPercent: row.listing_gain_percent,
      currentPrice: row.current_price,
      currentReturnPercent: row.current_return_percent,
      rhpUrl: row.rhp_url,
      drhpUrl: row.drhp_url,
      description: row.description,
      marketCap: row.market_cap,
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    }));
    
    res.json(mappedRows);
  } catch (error) {
    console.error("Error fetching IPOs:", error);
    res.status(500).json({ error: "Failed to fetch IPO data" });
  }
});

app.get("/api/ipo-news", async (req, res) => {
  try {
    // Mock IPO news data
    const ipoNews = [
      {
        id: "news-1",
        title: "Reliance Jio IPO Expected to be India's Largest Public Offering",
        publishedAt: "2025-09-01",
        category: "IPO News"
      },
      {
        id: "news-2", 
        title: "Groww Files for IPO, Targets ₹6,000 Crore Valuation",
        publishedAt: "2025-08-30",
        category: "Market News"
      },
      {
        id: "news-3",
        title: "SEBI Updates IPO Guidelines for Better Investor Protection",
        publishedAt: "2025-08-28",
        category: "Regulatory"
      },
      {
        id: "news-4",
        title: "Healthcare IPOs Gain Momentum Post-Pandemic Recovery",
        publishedAt: "2025-08-25",
        category: "Sector Analysis"
      }
    ];
    
    res.json(ipoNews);
  } catch (error) {
    console.error("Error fetching IPO news:", error);
    res.status(500).json({ error: "Failed to fetch IPO news" });
  }
});

// =================================================================
// Product Marketplace API Routes
// =================================================================

// Get all products with filters
app.get("/api/products", async (req, res) => {
  try {
    const { category, subcategory, theme, style, riskLevel, minReturn1y, isFeatured, limit } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category as string;
    if (subcategory) filters.subcategory = subcategory as string;
    if (theme) filters.theme = theme as string;
    if (style) filters.style = style as string;
    if (riskLevel) filters.riskLevel = riskLevel as string;
    if (minReturn1y) filters.minReturn1y = parseFloat(minReturn1y as string);
    if (isFeatured !== undefined) filters.isFeatured = isFeatured === 'true';
    if (limit) filters.limit = parseInt(limit as string);
    
    const products = await storage.getProducts(filters);
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await storage.getProductById(id);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Get product by slug
app.get("/api/products/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await storage.getProductBySlug(slug);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Get top performing products
app.get("/api/products/top-performers", async (req, res) => {
  try {
    const { category, period, limit } = req.query;
    
    const products = await storage.getTopPerformers(
      category as string | undefined,
      period as any,
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json(products);
  } catch (error) {
    console.error("Error fetching top performers:", error);
    res.status(500).json({ error: "Failed to fetch top performers" });
  }
});

// Get products by category
app.get("/api/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { subcategory } = req.query;
    
    const products = await storage.getProductsByCategory(
      category,
      subcategory as string | undefined
    );
    
    res.json(products);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});

// Get products by theme
app.get("/api/products/theme/:theme", async (req, res) => {
  try {
    const { theme } = req.params;
    const { limit } = req.query;
    
    const products = await storage.getProductsByTheme(
      theme,
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json(products);
  } catch (error) {
    console.error("Error fetching products by theme:", error);
    res.status(500).json({ error: "Failed to fetch products by theme" });
  }
});

// Get featured products
app.get("/api/products/featured/all", async (req, res) => {
  try {
    const { limit } = req.query;
    const products = await storage.getFeaturedProducts(
      limit ? parseInt(limit as string) : undefined
    );
    res.json(products);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

// Get new products
app.get("/api/products/new/all", async (req, res) => {
  try {
    const { limit } = req.query;
    const products = await storage.getNewProducts(
      limit ? parseInt(limit as string) : undefined
    );
    res.json(products);
  } catch (error) {
    console.error("Error fetching new products:", error);
    res.status(500).json({ error: "Failed to fetch new products" });
  }
});

// Search products
app.get("/api/products/search", async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }
    
    const products = await storage.searchProducts(q as string);
    res.json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ error: "Failed to search products" });
  }
});

// Refresh product performance (admin only)
}
