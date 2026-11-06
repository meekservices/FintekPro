/**
 * @file upstox-commodities-catalog.ts
 * @description Master catalog of MCX Commodities, Sovereign Gold Bonds (SGBs), and Benchmark Indices.
 * Synchronized with Upstox API v2 instruments (segments: MCX_FO, NSE_EQ, NSE_INDEX, BSE_INDEX).
 */

export interface UpstoxCommodityDefinition {
  symbol: string;
  name: string;
  shortName: string;
  isin: string;
  upstoxInstrumentKey: string;
  tradingSymbol: string;
  commodityType: "precious_metal" | "energy" | "industrial_metal" | "agricultural";
  subType: string;
  unit: string;
  lotSize: number;
  exchange: "MCX" | "NSE" | "BSE";
  currency: string;
  basePrice: number;
  previousClose: number;
  description: string;
}

export interface SovereignGoldBondDefinition {
  symbol: string;
  isin: string;
  upstoxInstrumentKey: string;
  name: string;
  series: string;
  couponRate: number; // typically 2.50% pa
  issueDate: string;
  maturityDate: string;
  tenorYears: number;
  faceValue: number;
  basePrice: number;
  issuer: string;
  taxStatus: "taxfree_capital_gains";
}

export interface BenchmarkIndexDefinition {
  symbol: string;
  name: string;
  exchangeToken: string;
  instrumentKey: string;
  exchange: "NSE" | "BSE";
  category: "broad_market" | "sectoral";
}

export const UPSTOX_COMMODITIES_CATALOG: UpstoxCommodityDefinition[] = [
  {
    symbol: "GOLD",
    name: "Gold 24K COMEX / MCX Bullion",
    shortName: "Gold MCX",
    isin: "COMMODITY-GOLD",
    upstoxInstrumentKey: "MCX_FO|495213",
    tradingSymbol: "GOLD FUT",
    commodityType: "precious_metal",
    subType: "gold",
    unit: "10g",
    lotSize: 1, // 1 kg contract = 100 10g units
    exchange: "MCX",
    currency: "INR",
    basePrice: 78850.00,
    previousClose: 78200.00,
    description: "Gold 999 purity benchmark futures contract traded on Multi Commodity Exchange of India (MCX).",
  },
  {
    symbol: "SILVER",
    name: "Silver COMEX / MCX Bullion",
    shortName: "Silver MCX",
    isin: "COMMODITY-SILVER",
    upstoxInstrumentKey: "MCX_FO|495214",
    tradingSymbol: "SILVER FUT",
    commodityType: "precious_metal",
    subType: "silver",
    unit: "1kg",
    lotSize: 30, // 30 kg standard lot
    exchange: "MCX",
    currency: "INR",
    basePrice: 94500.00,
    previousClose: 93800.00,
    description: "Silver 999 purity benchmark futures contract on MCX, widely tracked for industrial and precious demand.",
  },
  {
    symbol: "CRUDEOIL",
    name: "Crude Oil Light Sweet (WTI / Brent MCX)",
    shortName: "Crude Oil MCX",
    isin: "COMMODITY-CRUDEOIL",
    upstoxInstrumentKey: "MCX_FO|573422",
    tradingSymbol: "CRUDEOIL FUT",
    commodityType: "energy",
    subType: "crude_oil",
    unit: "barrel",
    lotSize: 100, // 100 barrels per lot
    exchange: "MCX",
    currency: "INR",
    basePrice: 6295.00,
    previousClose: 6340.00,
    description: "Light sweet crude oil futures contract traded on MCX, mirroring global energy benchmark movements.",
  },
  {
    symbol: "NATURALGAS",
    name: "Natural Gas (Henry Hub / MCX)",
    shortName: "Natural Gas MCX",
    isin: "COMMODITY-NATURALGAS",
    upstoxInstrumentKey: "MCX_FO|574319",
    tradingSymbol: "NATURALGAS FUT",
    commodityType: "energy",
    subType: "natural_gas",
    unit: "mmBtu",
    lotSize: 1250, // 1250 mmBtu per lot
    exchange: "MCX",
    currency: "INR",
    basePrice: 242.50,
    previousClose: 238.10,
    description: "Natural gas futures on MCX, sensitive to North American storage metrics and power generation heating demand.",
  },
  {
    symbol: "COPPER",
    name: "Copper COMEX / MCX High Grade",
    shortName: "Copper MCX",
    isin: "COMMODITY-COPPER",
    upstoxInstrumentKey: "MCX_FO|578634",
    tradingSymbol: "COPPER FUT",
    commodityType: "industrial_metal",
    subType: "copper",
    unit: "kg",
    lotSize: 2500, // 2500 kg per lot
    exchange: "MCX",
    currency: "INR",
    basePrice: 845.00,
    previousClose: 841.50,
    description: "Refined copper cathodes on MCX, critical industrial metal key to electric vehicles, grids, and construction.",
  },
  {
    symbol: "ALUMINIUM",
    name: "Aluminium LME / MCX Primary",
    shortName: "Aluminium MCX",
    isin: "COMMODITY-ALUMINIUM",
    upstoxInstrumentKey: "MCX_FO|578635",
    tradingSymbol: "ALUMINIUM FUT",
    commodityType: "industrial_metal",
    subType: "aluminium",
    unit: "kg",
    lotSize: 5000,
    exchange: "MCX",
    currency: "INR",
    basePrice: 242.00,
    previousClose: 240.50,
    description: "Primary aluminium ingots on MCX, widely utilized in automotive, aerospace, packaging, and transmission lines.",
  },
  {
    symbol: "ZINC",
    name: "Zinc LME / MCX Special High Grade",
    shortName: "Zinc MCX",
    isin: "COMMODITY-ZINC",
    upstoxInstrumentKey: "MCX_FO|578636",
    tradingSymbol: "ZINC FUT",
    commodityType: "industrial_metal",
    subType: "zinc",
    unit: "kg",
    lotSize: 5000,
    exchange: "MCX",
    currency: "INR",
    basePrice: 282.00,
    previousClose: 280.00,
    description: "Special high grade zinc futures contract on MCX, principal galvanizing agent for infrastructure steel.",
  },
  {
    symbol: "LEAD",
    name: "Lead MCX Primary Ingots",
    shortName: "Lead MCX",
    isin: "COMMODITY-LEAD",
    upstoxInstrumentKey: "MCX_FO|578637",
    tradingSymbol: "LEAD FUT",
    commodityType: "industrial_metal",
    subType: "lead",
    unit: "kg",
    lotSize: 5000,
    exchange: "MCX",
    currency: "INR",
    basePrice: 184.50,
    previousClose: 183.20,
    description: "Primary lead ingots on MCX, primarily consumed in lead-acid automotive batteries and backup power systems.",
  },
  {
    symbol: "NICKEL",
    name: "Nickel MCX Cathodes / Briquettes",
    shortName: "Nickel MCX",
    isin: "COMMODITY-NICKEL",
    upstoxInstrumentKey: "MCX_FO|578638",
    tradingSymbol: "NICKEL FUT",
    commodityType: "industrial_metal",
    subType: "nickel",
    unit: "kg",
    lotSize: 1500,
    exchange: "MCX",
    currency: "INR",
    basePrice: 1420.00,
    previousClose: 1405.00,
    description: "Refined nickel on MCX, indispensable for stainless steel production and EV lithium-ion battery chemistries.",
  },
  {
    symbol: "COTTON",
    name: "Cotton MCX 29mm Shankar-6",
    shortName: "Cotton MCX",
    isin: "COMMODITY-COTTON",
    upstoxInstrumentKey: "MCX_FO|578639",
    tradingSymbol: "COTTON FUT",
    commodityType: "agricultural",
    subType: "cotton",
    unit: "bale",
    lotSize: 25,
    exchange: "MCX",
    currency: "INR",
    basePrice: 58400.00,
    previousClose: 58200.00,
    description: "Standard ginned cotton 29mm contract on MCX, core agricultural raw material for textile spinning mills.",
  },
  {
    symbol: "MENTHAOIL",
    name: "Mentha Oil MCX Sambhal / Chandausi",
    shortName: "Mentha Oil MCX",
    isin: "COMMODITY-MENTHAOIL",
    upstoxInstrumentKey: "MCX_FO|578640",
    tradingSymbol: "MENTHAOIL FUT",
    commodityType: "agricultural",
    subType: "mentha_oil",
    unit: "kg",
    lotSize: 360,
    exchange: "MCX",
    currency: "INR",
    basePrice: 985.00,
    previousClose: 978.00,
    description: "Natural mentha arvensis oil on MCX, utilized in pharmaceuticals, confectionery, and personal care.",
  },
];

export const SOVEREIGN_GOLD_BONDS: SovereignGoldBondDefinition[] = [
  {
    symbol: "SGB-AUG27",
    isin: "IN0020200057",
    upstoxInstrumentKey: "NSE_EQ|IN0020200057",
    name: "Sovereign Gold Bond 2026-27 Series I",
    series: "2019-20 Series I",
    couponRate: 2.50,
    issueDate: "2019-06-11",
    maturityDate: "2027-06-11",
    tenorYears: 1.3,
    faceValue: 5100,
    basePrice: 7250.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
  {
    symbol: "SGB-MAY29",
    isin: "IN0020210056",
    upstoxInstrumentKey: "NSE_EQ|IN0020210056",
    name: "Sovereign Gold Bond 2029 Series I",
    series: "2021-22 Series I",
    couponRate: 2.50,
    issueDate: "2021-05-25",
    maturityDate: "2029-05-25",
    tenorYears: 3.2,
    faceValue: 4777,
    basePrice: 7310.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
  {
    symbol: "SGB-OCT29",
    isin: "IN0020210155",
    upstoxInstrumentKey: "NSE_EQ|IN0020210155",
    name: "Sovereign Gold Bond 2029 Series II",
    series: "2021-22 Series II",
    couponRate: 2.50,
    issueDate: "2021-10-15",
    maturityDate: "2029-10-15",
    tenorYears: 3.6,
    faceValue: 4791,
    basePrice: 7325.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
  {
    symbol: "SGB-FEB30",
    isin: "IN0020210254",
    upstoxInstrumentKey: "NSE_EQ|IN0020210254",
    name: "Sovereign Gold Bond 2030 Series X",
    series: "2021-22 Series X",
    couponRate: 2.50,
    issueDate: "2022-03-08",
    maturityDate: "2030-03-08",
    tenorYears: 4.0,
    faceValue: 5109,
    basePrice: 7350.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
  {
    symbol: "SGB-JUN31",
    isin: "IN0020230077",
    upstoxInstrumentKey: "NSE_EQ|IN0020230077",
    name: "Sovereign Gold Bond 2031-32 Series I",
    series: "2023-24 Series I",
    couponRate: 2.50,
    issueDate: "2023-06-27",
    maturityDate: "2031-06-27",
    tenorYears: 5.3,
    faceValue: 5923,
    basePrice: 7420.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
  {
    symbol: "SGB-SEP31",
    isin: "IN0020230184",
    upstoxInstrumentKey: "NSE_EQ|IN0020230184",
    name: "Sovereign Gold Bond 2031-32 Series II",
    series: "2023-24 Series II",
    couponRate: 2.50,
    issueDate: "2023-09-20",
    maturityDate: "2031-09-20",
    tenorYears: 5.5,
    faceValue: 5923,
    basePrice: 7430.00,
    issuer: "Reserve Bank of India",
    taxStatus: "taxfree_capital_gains",
  },
];

export const BENCHMARK_INDICES: BenchmarkIndexDefinition[] = [
  {
    symbol: "NIFTY",
    name: "Nifty 50 Index",
    exchangeToken: "Nifty 50",
    instrumentKey: "NSE_INDEX|Nifty 50",
    exchange: "NSE",
    category: "broad_market",
  },
  {
    symbol: "BANKNIFTY",
    name: "Nifty Bank Index",
    exchangeToken: "Nifty Bank",
    instrumentKey: "NSE_INDEX|Nifty Bank",
    exchange: "NSE",
    category: "sectoral",
  },
  {
    symbol: "NIFTYIT",
    name: "Nifty IT Index",
    exchangeToken: "Nifty IT",
    instrumentKey: "NSE_INDEX|Nifty IT",
    exchange: "NSE",
    category: "sectoral",
  },
  {
    symbol: "SENSEX",
    name: "S&P BSE Sensex",
    exchangeToken: "SENSEX",
    instrumentKey: "BSE_INDEX|SENSEX",
    exchange: "BSE",
    category: "broad_market",
  },
  {
    symbol: "FINNIFTY",
    name: "Nifty Financial Services",
    exchangeToken: "Nifty Fin Service",
    instrumentKey: "NSE_INDEX|Nifty Fin Service",
    exchange: "NSE",
    category: "sectoral",
  },
  {
    symbol: "MIDCPNIFTY",
    name: "Nifty Midcap Select",
    exchangeToken: "NIFTY MID SELECT",
    instrumentKey: "NSE_INDEX|NIFTY MID SELECT",
    exchange: "NSE",
    category: "broad_market",
  },
];

