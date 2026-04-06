import { Express } from 'express';

const MCX_COMMODITIES = [
  { symbol: 'GOLD', name: 'Gold', unit: '10 GMS', expiry: 'DEC2025' },
  { symbol: 'SILVER', name: 'Silver', unit: '30 KG', expiry: 'DEC2025' },
  { symbol: 'CRUDE', name: 'Crude Oil', unit: '100 BBL', expiry: 'DEC2025' },
  { symbol: 'NATURAL_GAS', name: 'Natural Gas', unit: '1250 MMTU', expiry: 'DEC2025' },
  { symbol: 'COPPER', name: 'Copper', unit: '1000 KG', expiry: 'DEC2025' },
  { symbol: 'ZINC', name: 'Zinc', unit: '5000 KG', expiry: 'DEC2025' },
  { symbol: 'ALUMINIUM', name: 'Aluminium', unit: '5000 KG', expiry: 'DEC2025' },
  { symbol: 'LEAD', name: 'Lead', unit: '5000 KG', expiry: 'DEC2025' }
];

const NCDEX_COMMODITIES = [
  { symbol: 'CHANA', name: 'Chana (Chickpeas)', unit: '10 MT', expiry: 'MAR2025', category: 'Pulses' },
  { symbol: 'WHEAT', name: 'Wheat', unit: '10 MT', expiry: 'MAR2025', category: 'Grains' },
  { symbol: 'GUAR_SEED', name: 'Guar Seed', unit: '10 MT', expiry: 'MAR2025', category: 'Oilseeds' },
  { symbol: 'CORIANDER', name: 'Coriander', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
  { symbol: 'TURMERIC', name: 'Turmeric', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
  { symbol: 'CUMIN', name: 'Cumin', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
  { symbol: 'SOYBEAN', name: 'Soybean', unit: '10 MT', expiry: 'MAR2025', category: 'Oilseeds' },
  { symbol: 'COTTON', name: 'Cotton', unit: '10 BALES', expiry: 'MAR2025', category: 'Fibers' },
  { symbol: 'SUGAR', name: 'Sugar', unit: '10 MT', expiry: 'MAR2025', category: 'Sweeteners' },
  { symbol: 'JEERA', name: 'Jeera (Cumin)', unit: '5 MT', expiry: 'APR2025', category: 'Spices' }
];

const MSEI_EQUITIES = [
  { symbol: 'MSEI_TECH', name: 'MSEI Tech Solutions', segment: 'Equity', fallbackPrice: 450.25, sector: 'Technology' },
  { symbol: 'MSEI_PHARMA', name: 'MSEI Pharmaceuticals', segment: 'Equity', fallbackPrice: 1250.80, sector: 'Healthcare' },
  { symbol: 'MSEI_AUTO', name: 'MSEI Automotive', segment: 'Equity', fallbackPrice: 675.40, sector: 'Automotive' },
  { symbol: 'MSEI_FINANCE', name: 'MSEI Financial Services', segment: 'Equity', fallbackPrice: 890.15, sector: 'Financial Services' },
  { symbol: 'MSEI_ENERGY', name: 'MSEI Energy Corp', segment: 'Equity', fallbackPrice: 320.60, sector: 'Energy' },
  { symbol: 'MSEI_INFRA', name: 'MSEI Infrastructure', segment: 'Equity', fallbackPrice: 185.90, sector: 'Infrastructure' }
];

const MSEI_CURRENCIES = [
  { symbol: 'USD_INR', name: 'US Dollar / Indian Rupee', segment: 'Currency', rate: 83.15 },
  { symbol: 'EUR_INR', name: 'Euro / Indian Rupee', segment: 'Currency', rate: 90.25 },
  { symbol: 'GBP_INR', name: 'British Pound / Indian Rupee', segment: 'Currency', rate: 105.80 },
  { symbol: 'JPY_INR', name: 'Japanese Yen / Indian Rupee', segment: 'Currency', rate: 0.56 }
];

const MSEI_DERIVATIVES = [
  { symbol: 'MSEI_NIFTY_FUT', name: 'NIFTY Future', segment: 'Derivatives', expiry: 'MAR2025', type: 'Future' },
  { symbol: 'MSEI_BANK_FUT', name: 'BANKNIFTY Future', segment: 'Derivatives', expiry: 'MAR2025', type: 'Future' },
  { symbol: 'MSEI_CALL_OPT', name: 'NIFTY Call Option', segment: 'Derivatives', expiry: 'FEB2025', type: 'Option', strike: 22500 },
  { symbol: 'MSEI_PUT_OPT', name: 'NIFTY Put Option', segment: 'Derivatives', expiry: 'FEB2025', type: 'Option', strike: 22000 }
];

export function registerCommoditiesMarketRoutes(app: Express): void {

// MCX API endpoints

// Get MCX commodity data
app.get("/api/mcx/commodities", async (req, res) => {
  try {
    const commoditiesData = MCX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 10000 + 1000;
      const change = (Math.random() - 0.5) * 200;
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        high: basePrice + Math.abs(change) * 2,
        low: basePrice - Math.abs(change) * 2,
        volume: Math.floor(Math.random() * 100000),
        openInterest: Math.floor(Math.random() * 50000),
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      status: "success",
      data: commoditiesData
    });
  } catch (error) {
    console.error("Error fetching MCX commodities:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MCX commodities"
    });
  }
});

// Get MCX gainers
app.get("/api/mcx/gainers", async (req, res) => {
  try {
    const gainersData = MCX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 5000 + 2000;
      const change = Math.random() * 100 + 50; // Positive change for gainers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 80000),
        openInterest: Math.floor(Math.random() * 40000)
      };
    }).sort((a, b) => b.pchange - a.pchange).slice(0, 5);

    res.json({
      status: "success",
      data: gainersData
    });
  } catch (error) {
    console.error("Error fetching MCX gainers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MCX gainers"
    });
  }
});

// Get MCX losers
app.get("/api/mcx/losers", async (req, res) => {
  try {
    const losersData = MCX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 5000 + 2000;
      const change = -(Math.random() * 100 + 20); // Negative change for losers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 60000),
        openInterest: Math.floor(Math.random() * 30000)
      };
    }).sort((a, b) => a.pchange - b.pchange).slice(0, 5);

    res.json({
      status: "success",
      data: losersData
    });
  } catch (error) {
    console.error("Error fetching MCX losers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MCX losers"
    });
  }
});

// Get MCX market status
app.get("/api/mcx/market-status", async (req, res) => {
  try {
    const currentHour = new Date().getHours();
    const isMarketOpen = (currentHour >= 9 && currentHour <= 23); // MCX timings: 9 AM to 11:30 PM
    
    const status = {
      marketState: isMarketOpen ? "OPEN" : "CLOSED",
      lastUpdated: new Date().toISOString(),
      nextSession: isMarketOpen ? "Current Session" : "Next Day 9:00 AM",
      tradingSegments: [
        { segment: "Bullion", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Energy", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Base Metals", status: isMarketOpen ? "Open" : "Closed" }
      ]
    };

    res.json({
      status: "success",
      data: status
    });
  } catch (error) {
    console.error("Error fetching MCX market status:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MCX market status"
    });
  }
});

// NCDEX API endpoints

// Get NCDEX agricultural commodity data
app.get("/api/ncdex/commodities", async (req, res) => {
  try {
    const commoditiesData = NCDEX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 5000 + 2000; // Agricultural commodities price range
      const change = (Math.random() - 0.5) * 300;
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        category: commodity.category,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        high: basePrice + Math.abs(change) * 1.5,
        low: basePrice - Math.abs(change) * 1.5,
        volume: Math.floor(Math.random() * 50000),
        openInterest: Math.floor(Math.random() * 25000),
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      status: "success",
      data: commoditiesData
    });
  } catch (error) {
    console.error("Error fetching NCDEX commodities:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch NCDEX commodities"
    });
  }
});

// Get NCDEX gainers
app.get("/api/ncdex/gainers", async (req, res) => {
  try {
    const gainersData = NCDEX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 4000 + 2500;
      const change = Math.random() * 150 + 50; // Positive change for gainers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        category: commodity.category,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 40000),
        openInterest: Math.floor(Math.random() * 20000)
      };
    }).sort((a, b) => b.pchange - a.pchange).slice(0, 5);

    res.json({
      status: "success",
      data: gainersData
    });
  } catch (error) {
    console.error("Error fetching NCDEX gainers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch NCDEX gainers"
    });
  }
});

// Get NCDEX losers
app.get("/api/ncdex/losers", async (req, res) => {
  try {
    const losersData = NCDEX_COMMODITIES.map(commodity => {
      const basePrice = Math.random() * 4000 + 2500;
      const change = -(Math.random() * 120 + 30); // Negative change for losers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        unit: commodity.unit,
        expiry: commodity.expiry,
        category: commodity.category,
        ltp: basePrice,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 30000),
        openInterest: Math.floor(Math.random() * 15000)
      };
    }).sort((a, b) => a.pchange - b.pchange).slice(0, 5);

    res.json({
      status: "success",
      data: losersData
    });
  } catch (error) {
    console.error("Error fetching NCDEX losers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch NCDEX losers"
    });
  }
});

// Get NCDEX market status
app.get("/api/ncdex/market-status", async (req, res) => {
  try {
    const currentHour = new Date().getHours();
    const isMarketOpen = (currentHour >= 10 && currentHour <= 17); // NCDEX timings: 10 AM to 5 PM
    
    const status = {
      marketState: isMarketOpen ? "OPEN" : "CLOSED",
      lastUpdated: new Date().toISOString(),
      nextSession: isMarketOpen ? "Current Session" : "Next Day 10:00 AM",
      tradingSegments: [
        { segment: "Spices", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Pulses", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Oilseeds", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Grains", status: isMarketOpen ? "Open" : "Closed" }
      ]
    };

    res.json({
      status: "success",
      data: status
    });
  } catch (error) {
    console.error("Error fetching NCDEX market status:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch NCDEX market status"
    });
  }
});

// MSEI API endpoints

// Get MSEI equity data
app.get("/api/msei/equities", async (req, res) => {
  try {
    const equitiesData = MSEI_EQUITIES.map(equity => {
      const basePrice = equity.price;
      const change = (Math.random() - 0.5) * 50; // Price change
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: equity.symbol,
        name: equity.name,
        segment: equity.segment,
        sector: equity.sector,
        ltp: basePrice + change,
        change: change,
        pchange: pChange,
        high: basePrice + Math.abs(change) * 1.2,
        low: basePrice - Math.abs(change) * 1.2,
        volume: Math.floor(Math.random() * 100000) + 10000,
        value: Math.floor(Math.random() * 10000000) + 1000000,
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      status: "success",
      data: equitiesData
    });
  } catch (error) {
    console.error("Error fetching MSEI equities:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI equities"
    });
  }
});

// Get MSEI currency data
app.get("/api/msei/currencies", async (req, res) => {
  try {
    const currencyData = MSEI_CURRENCIES.map(currency => {
      const baseRate = currency.rate;
      const change = (Math.random() - 0.5) * 2; // Rate change
      const pChange = (change / baseRate) * 100;
      
      return {
        symbol: currency.symbol,
        name: currency.name,
        segment: currency.segment,
        rate: baseRate + change,
        change: change,
        pchange: pChange,
        high: baseRate + Math.abs(change) * 1.5,
        low: baseRate - Math.abs(change) * 1.5,
        volume: Math.floor(Math.random() * 500000) + 100000,
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      status: "success",
      data: currencyData
    });
  } catch (error) {
    console.error("Error fetching MSEI currencies:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI currencies"
    });
  }
});

// Get MSEI derivatives data
app.get("/api/msei/derivatives", async (req, res) => {
  try {
    const derivativesData = MSEI_DERIVATIVES.map(derivative => {
      const basePrice = Math.random() * 1000 + 100; // Random base price for derivatives
      const change = (Math.random() - 0.5) * 100;
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: derivative.symbol,
        name: derivative.name,
        segment: derivative.segment,
        type: derivative.type,
        expiry: derivative.expiry,
        strike: derivative.strike || null,
        ltp: basePrice + change,
        change: change,
        pchange: pChange,
        high: basePrice + Math.abs(change) * 1.3,
        low: basePrice - Math.abs(change) * 1.3,
        volume: Math.floor(Math.random() * 50000) + 5000,
        openInterest: Math.floor(Math.random() * 25000) + 2500,
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      status: "success",
      data: derivativesData
    });
  } catch (error) {
    console.error("Error fetching MSEI derivatives:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI derivatives"
    });
  }
});

// Get MSEI gainers
app.get("/api/msei/gainers", async (req, res) => {
  try {
    const gainersData = MSEI_EQUITIES.map(equity => {
      const basePrice = equity.price;
      const change = Math.random() * 30 + 10; // Positive change for gainers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: equity.symbol,
        name: equity.name,
        segment: equity.segment,
        sector: equity.sector,
        ltp: basePrice + change,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 80000) + 20000
      };
    }).sort((a, b) => b.pchange - a.pchange).slice(0, 3);

    res.json({
      status: "success",
      data: gainersData
    });
  } catch (error) {
    console.error("Error fetching MSEI gainers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI gainers"
    });
  }
});

// Get MSEI losers
app.get("/api/msei/losers", async (req, res) => {
  try {
    const losersData = MSEI_EQUITIES.map(equity => {
      const basePrice = equity.price;
      const change = -(Math.random() * 25 + 5); // Negative change for losers
      const pChange = (change / basePrice) * 100;
      
      return {
        symbol: equity.symbol,
        name: equity.name,
        segment: equity.segment,
        sector: equity.sector,
        ltp: basePrice + change,
        change: change,
        pchange: pChange,
        volume: Math.floor(Math.random() * 60000) + 15000
      };
    }).sort((a, b) => a.pchange - b.pchange).slice(0, 3);

    res.json({
      status: "success",
      data: losersData
    });
  } catch (error) {
    console.error("Error fetching MSEI losers:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI losers"
    });
  }
});

// Get MSEI market status
app.get("/api/msei/market-status", async (req, res) => {
  try {
    const currentHour = new Date().getHours();
    const isMarketOpen = (currentHour >= 9 && currentHour <= 15); // MSEI timings: 9 AM to 3:30 PM
    
    const status = {
      marketState: isMarketOpen ? "OPEN" : "CLOSED",
      lastUpdated: new Date().toISOString(),
      nextSession: isMarketOpen ? "Current Session" : "Next Day 9:00 AM",
      tradingSegments: [
        { segment: "Equity", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Currency", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Derivatives", status: isMarketOpen ? "Open" : "Closed" },
        { segment: "Debt", status: "Suspended" } // MSEI debt trading suspended
      ]
    };

    res.json({
      status: "success",
      data: status
    });
  } catch (error) {
    console.error("Error fetching MSEI market status:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch MSEI market status"
    });
  }
});

// Market data endpoints

// Market movers - real-time gainers and losers (CACHED)
}
