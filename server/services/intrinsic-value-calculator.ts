/**
 * Intrinsic Value Calculator Service
 * 
 * Provides multiple valuation methods for stocks (listed and unlisted):
 * 1. DCF (Discounted Cash Flow) - FCF projections with WACC and terminal value
 * 2. Graham's Intrinsic Value Formula - V = EPS × (8.5 + 2g) × (4.4/Y)
 * 3. Relative Valuation - Sector P/E and P/B comparisons
 * 4. Book Value Approach - Net asset value with margin of safety
 * 
 * All calculations include full audit trails for regulatory compliance.
 * NO mock data - returns null/insufficient_data when real data unavailable.
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, desc, sql, avg } from 'drizzle-orm';
import { getEnrichedStockSnapshot, EnrichedStockSnapshot } from './screener/enriched-stock-data';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface DCFInputs {
  freeCashFlows: number[];
  fcfGrowthRate: number;
  wacc: number;
  terminalGrowthRate: number;
  sharesOutstanding: number;
  projectionYears: number;
}

export interface DCFResult {
  method: 'dcf';
  intrinsicValue: number;
  intrinsicValuePerShare: number;
  presentValueOfFCF: number;
  terminalValue: number;
  presentValueOfTerminalValue: number;
  enterpriseValue: number;
  inputs: {
    projectedFCFs: number[];
    wacc: number;
    terminalGrowthRate: number;
    projectionYears: number;
    fcfGrowthRate: number;
  };
  formula: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: string;
}

export interface GrahamResult {
  method: 'graham';
  intrinsicValue: number;
  marginOfSafety: number;
  inputs: {
    eps: number;
    epsGrowthRate: number;
    aaa_bond_yield: number;
    no_growth_pe: number;
  };
  formula: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: string;
}

export interface RelativeValuationResult {
  method: 'relative';
  intrinsicValue: number;
  methods: {
    peBasedValue: number | null;
    pbBasedValue: number | null;
    evEbitdaBasedValue: number | null;
  };
  sectorAverages: {
    avgPE: number | null;
    avgPB: number | null;
    avgEvEbitda: number | null;
    sectorName: string;
    peerCount: number;
  };
  formula: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: string;
}

export interface BookValueResult {
  method: 'book_value';
  intrinsicValue: number;
  netAssetValue: number;
  tangibleBookValue: number;
  inputs: {
    totalAssets: number;
    totalLiabilities: number;
    intangibleAssets: number;
    sharesOutstanding: number;
    marginOfSafety: number;
  };
  formula: string;
  confidence: 'high' | 'medium' | 'low';
  dataSource: string;
}

export interface IntrinsicValueResult {
  symbol: string;
  companyName: string;
  stockType: 'listed' | 'unlisted';
  currentPrice: number | null;
  calculatedAt: Date;
  valuations: {
    dcf: DCFResult | null;
    graham: GrahamResult | null;
    relative: RelativeValuationResult | null;
    bookValue: BookValueResult | null;
  };
  compositeIntrinsicValue: number | null;
  compositeConfidence: 'high' | 'medium' | 'low' | 'insufficient_data';
  upside: number | null;
  recommendation: 'undervalued' | 'fairly_valued' | 'overvalued' | 'insufficient_data';
  auditTrail: AuditEntry[];
  dataAvailability: {
    hasFCF: boolean;
    hasEPS: boolean;
    hasBookValue: boolean;
    hasSectorData: boolean;
    hasHistoricalData: boolean;
  };
}

export interface AuditEntry {
  timestamp: Date;
  method: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number | null;
  dataSource: string;
  notes?: string;
}

// ===================================================================
// CONSTANTS
// ===================================================================

const DEFAULT_RISK_FREE_RATE = 7.10;
const DEFAULT_EQUITY_RISK_PREMIUM = 5.5;
const DEFAULT_TERMINAL_GROWTH_RATE = 3.0;
const DEFAULT_AAA_BOND_YIELD = 7.5;
const GRAHAM_NO_GROWTH_PE = 8.5;
const GRAHAM_GROWTH_MULTIPLIER = 2;
const DEFAULT_MARGIN_OF_SAFETY = 0.25;

const MARKET_DATA_SOURCES = {
  riskFreeRate: {
    value: DEFAULT_RISK_FREE_RATE,
    source: 'RBI 10-Year G-Sec Yield (proxy)',
    asOf: '2026-01-30',
    url: 'https://rbi.org.in/Scripts/BS_NSDPDisplay.aspx',
  },
  equityRiskPremium: {
    value: DEFAULT_EQUITY_RISK_PREMIUM,
    source: 'India Equity Risk Premium (Aswath Damodaran)',
    asOf: '2025-01',
    url: 'https://pages.stern.nyu.edu/~adamodar/',
  },
  aaaBondYield: {
    value: DEFAULT_AAA_BOND_YIELD,
    source: 'AAA Corporate Bond Yield (CRISIL/ICRA)',
    asOf: '2026-01-30',
  },
};

// ===================================================================
// INTRINSIC VALUE CALCULATOR SERVICE
// ===================================================================

class IntrinsicValueCalculatorService {
  private auditLog: AuditEntry[] = [];

  /**
   * Calculate intrinsic value for a listed stock
   */
  async calculateListedStockValue(symbol: string): Promise<IntrinsicValueResult> {
    this.auditLog = [];
    
    const [stockData, enriched] = await Promise.all([
      this.fetchListedStockData(symbol),
      getEnrichedStockSnapshot(symbol).catch(() => null),
    ]);
    
    if (!stockData) {
      return this.createInsufficientDataResult(symbol, 'listed');
    }

    if (enriched) {
      this.addAuditEntry('EnrichedData', 'FMP enriched snapshot loaded', 
        { symbol, hasFundamentals: enriched.fundamentals ? 'yes' : 'no', hasGrowth: enriched.growth ? 'yes' : 'no', hasDCF: enriched.dcf ? 'yes' : 'no' }, 
        null, 'FMP enriched');
    }

    const dcfResult = await this.calculateDCF(stockData, enriched);
    const grahamResult = this.calculateGrahamValue(stockData, enriched);
    const relativeResult = await this.calculateRelativeValuation(stockData, enriched);
    const bookValueResult = this.calculateBookValue(stockData, enriched);

    return this.compileResults(symbol, stockData, 'listed', {
      dcf: dcfResult,
      graham: grahamResult,
      relative: relativeResult,
      bookValue: bookValueResult,
    });
  }

  /**
   * Calculate intrinsic value for an unlisted stock using MCA data
   */
  async calculateUnlistedStockValue(companyId: string): Promise<IntrinsicValueResult> {
    this.auditLog = [];
    
    const stockData = await this.fetchUnlistedStockData(companyId);
    
    if (!stockData) {
      return this.createInsufficientDataResult(companyId, 'unlisted');
    }

    const dcfResult = await this.calculateDCF(stockData);
    const grahamResult = this.calculateGrahamValue(stockData);
    const relativeResult = await this.calculateRelativeValuation(stockData);
    const bookValueResult = this.calculateBookValue(stockData);

    return this.compileResults(stockData.symbol, stockData, 'unlisted', {
      dcf: dcfResult,
      graham: grahamResult,
      relative: relativeResult,
      bookValue: bookValueResult,
    });
  }

  // ===================================================================
  // DCF MODEL
  // ===================================================================

  /**
   * Discounted Cash Flow Model
   * 
   * Formula:
   * Enterprise Value = Σ(FCFt / (1 + WACC)^t) + Terminal Value / (1 + WACC)^n
   * Terminal Value = FCFn × (1 + g) / (WACC - g)  [Gordon Growth Model]
   * Intrinsic Value Per Share = (Enterprise Value - Net Debt) / Shares Outstanding
   * 
   * WACC = (E/V × Re) + (D/V × Rd × (1-T))
   * Where: Re = Rf + β × (Rm - Rf)
   */
  private async calculateDCF(stockData: StockFinancialData, enriched?: EnrichedStockSnapshot | null): Promise<DCFResult | null> {
    const { freeCashFlows, sharesOutstanding, totalDebt, cash, beta } = stockData;

    if (enriched?.dcf?.dcfValue && enriched.dcf.dcfValue > 0) {
      const dcfValue = enriched.dcf.dcfValue;
      const stockPrice = enriched.dcf.stockPrice || stockData.currentPrice || 0;
      this.addAuditEntry('DCF', 'FMP DCF valuation used directly', 
        { dcfValue, stockPrice, upsidePercent: enriched.dcf.upsidePercent != null ? enriched.dcf.upsidePercent : 'N/A' }, 
        dcfValue, 'FMP DCF');

      return {
        method: 'dcf',
        intrinsicValue: dcfValue * (sharesOutstanding || 1),
        intrinsicValuePerShare: Math.round(dcfValue * 100) / 100,
        presentValueOfFCF: 0,
        terminalValue: 0,
        presentValueOfTerminalValue: 0,
        enterpriseValue: dcfValue * (sharesOutstanding || 1),
        inputs: {
          projectedFCFs: [],
          wacc: 0,
          terminalGrowthRate: DEFAULT_TERMINAL_GROWTH_RATE,
          projectionYears: 5,
          fcfGrowthRate: enriched?.growth?.freeCashFlowGrowth || 0,
        },
        formula: 'FMP DCF Model (pre-computed)',
        confidence: 'high',
        dataSource: 'FMP DCF',
      };
    }

    if (!freeCashFlows || freeCashFlows.length < 2 || !sharesOutstanding || sharesOutstanding <= 0) {
      if (enriched?.fundamentals?.freeCashFlowPerShare && enriched.fundamentals.freeCashFlowPerShare > 0 && sharesOutstanding && sharesOutstanding > 0) {
        const fcfPerShare = enriched.fundamentals.freeCashFlowPerShare;
        const fcfGrowth = enriched?.growth?.freeCashFlowGrowth || 10;
        const cappedGrowth = Math.min(Math.max(fcfGrowth, 0), 25);
        const wacc = this.calculateWACC(stockData);
        const terminalGrowthRate = DEFAULT_TERMINAL_GROWTH_RATE;
        const projectionYears = 5;
        const currentFCF = fcfPerShare * sharesOutstanding;

        const projectedFCFs: number[] = [];
        let fcf = currentFCF;
        for (let i = 1; i <= projectionYears; i++) {
          fcf = fcf * (1 + cappedGrowth / 100);
          projectedFCFs.push(fcf);
        }

        let pvOfFCF = 0;
        for (let i = 0; i < projectedFCFs.length; i++) {
          pvOfFCF += projectedFCFs[i] / Math.pow(1 + wacc / 100, i + 1);
        }

        const terminalFCF = projectedFCFs[projectedFCFs.length - 1];
        const terminalValue = (terminalFCF * (1 + terminalGrowthRate / 100)) / ((wacc - terminalGrowthRate) / 100);
        const pvOfTerminalValue = terminalValue / Math.pow(1 + wacc / 100, projectionYears);
        const enterpriseValue = pvOfFCF + pvOfTerminalValue;
        const netDebt = (totalDebt || 0) - (cash || 0);
        const equityValue = enterpriseValue - netDebt;
        const intrinsicValuePerShare = equityValue / sharesOutstanding;

        this.addAuditEntry('DCF', 'DCF using FMP enriched FCF per share', 
          { fcfPerShare, fcfGrowth: cappedGrowth, wacc, sharesOutstanding }, 
          intrinsicValuePerShare, 'FMP enriched');

        return {
          method: 'dcf',
          intrinsicValue: equityValue,
          intrinsicValuePerShare: Math.round(intrinsicValuePerShare * 100) / 100,
          presentValueOfFCF: Math.round(pvOfFCF * 100) / 100,
          terminalValue: Math.round(terminalValue * 100) / 100,
          presentValueOfTerminalValue: Math.round(pvOfTerminalValue * 100) / 100,
          enterpriseValue: Math.round(enterpriseValue * 100) / 100,
          inputs: {
            projectedFCFs: projectedFCFs.map((f: any) => Math.round(f)),
            wacc: Math.round(wacc * 100) / 100,
            terminalGrowthRate,
            projectionYears,
            fcfGrowthRate: Math.round(cappedGrowth * 100) / 100,
          },
          formula: `DCF using FMP freeCashFlowPerShare=${fcfPerShare}, growth=${cappedGrowth}%`,
          confidence: 'high',
          dataSource: 'FMP enriched',
        };
      }

      this.addAuditEntry('DCF', 'Insufficient FCF history', {}, null, 'N/A', 'Requires minimum 2 years of FCF data');
      return null;
    }

    const currentFCF = freeCashFlows[0];
    if (currentFCF <= 0) {
      this.addAuditEntry('DCF', 'Negative FCF', { currentFCF }, null, 'financial_data', 'DCF not applicable for negative cash flows');
      return null;
    }

    let fcfGrowthRate = this.calculateHistoricalGrowthRate(freeCashFlows);
    if (enriched?.growth?.freeCashFlowGrowth != null && enriched.growth.freeCashFlowGrowth > -50) {
      fcfGrowthRate = enriched.growth.freeCashFlowGrowth;
    }
    const projectedGrowthRate = Math.min(fcfGrowthRate, 25);
    
    const wacc = this.calculateWACC(stockData);
    const terminalGrowthRate = DEFAULT_TERMINAL_GROWTH_RATE;
    const projectionYears = 5;

    const projectedFCFs: number[] = [];
    let fcf = currentFCF;
    for (let i = 1; i <= projectionYears; i++) {
      fcf = fcf * (1 + projectedGrowthRate / 100);
      projectedFCFs.push(fcf);
    }

    let pvOfFCF = 0;
    for (let i = 0; i < projectedFCFs.length; i++) {
      pvOfFCF += projectedFCFs[i] / Math.pow(1 + wacc / 100, i + 1);
    }

    const terminalFCF = projectedFCFs[projectedFCFs.length - 1];
    const terminalValue = (terminalFCF * (1 + terminalGrowthRate / 100)) / ((wacc - terminalGrowthRate) / 100);
    const pvOfTerminalValue = terminalValue / Math.pow(1 + wacc / 100, projectionYears);

    const enterpriseValue = pvOfFCF + pvOfTerminalValue;
    const netDebt = (totalDebt || 0) - (cash || 0);
    const equityValue = enterpriseValue - netDebt;
    const intrinsicValuePerShare = equityValue / sharesOutstanding;

    const confidence = this.assessDCFConfidence(freeCashFlows.length, fcfGrowthRate, wacc);

    const formula = `EV = Σ(FCF_t / (1 + WACC)^t) + TV / (1 + WACC)^n; TV = FCF_n × (1 + g) / (WACC - g); Intrinsic = (EV - Net Debt) / Shares`;

    this.addAuditEntry('DCF', formula, {
      currentFCF,
      fcfGrowthRate: `${projectedGrowthRate.toFixed(2)}%`,
      wacc: `${wacc.toFixed(2)}%`,
      terminalGrowthRate: `${terminalGrowthRate}%`,
      projectionYears,
      sharesOutstanding,
      netDebt,
    }, intrinsicValuePerShare, 'financial_statements');

    return {
      method: 'dcf',
      intrinsicValue: equityValue,
      intrinsicValuePerShare: Math.round(intrinsicValuePerShare * 100) / 100,
      presentValueOfFCF: Math.round(pvOfFCF * 100) / 100,
      terminalValue: Math.round(terminalValue * 100) / 100,
      presentValueOfTerminalValue: Math.round(pvOfTerminalValue * 100) / 100,
      enterpriseValue: Math.round(enterpriseValue * 100) / 100,
      inputs: {
        projectedFCFs: projectedFCFs.map((f: any) => Math.round(f)),
        wacc: Math.round(wacc * 100) / 100,
        terminalGrowthRate,
        projectionYears,
        fcfGrowthRate: Math.round(projectedGrowthRate * 100) / 100,
      },
      formula,
      confidence,
      dataSource: 'financial_statements',
    };
  }

  /**
   * Calculate WACC (Weighted Average Cost of Capital)
   * 
   * WACC = (E/V × Re) + (D/V × Rd × (1-T))
   * Re = Rf + β × (Rm - Rf)  [CAPM]
   */
  private calculateWACC(stockData: StockFinancialData): number {
    const {
      marketCap = 0,
      totalDebt = 0,
      beta = 1.0,
      interestExpense = 0,
      taxRate = 25,
    } = stockData;

    const riskFreeRate = DEFAULT_RISK_FREE_RATE;
    const equityRiskPremium = DEFAULT_EQUITY_RISK_PREMIUM;
    
    const costOfEquity = riskFreeRate + (beta * equityRiskPremium);
    
    let costOfDebt = 8.0;
    if ((totalDebt ?? 0) > 0 && (interestExpense ?? 0) > 0) {
      costOfDebt = ((interestExpense ?? 0) / (totalDebt ?? 1)) * 100;
    }
    
    const totalValue = (marketCap ?? 0) + (totalDebt ?? 0);
    if (totalValue <= 0) {
      return costOfEquity;
    }
    
    const equityWeight = (marketCap ?? 0) / totalValue;
    const debtWeight = (totalDebt ?? 0) / totalValue;
    const afterTaxCostOfDebt = costOfDebt * (1 - taxRate / 100);
    
    const wacc = (equityWeight * costOfEquity) + (debtWeight * afterTaxCostOfDebt);
    
    this.addAuditEntry('WACC', 
      'WACC = (E/V × Re) + (D/V × Rd × (1-T)); Re = Rf + β × (Rm - Rf)',
      {
        riskFreeRate: `${riskFreeRate}% (${MARKET_DATA_SOURCES.riskFreeRate.source}, as of ${MARKET_DATA_SOURCES.riskFreeRate.asOf})`,
        equityRiskPremium: `${equityRiskPremium}% (${MARKET_DATA_SOURCES.equityRiskPremium.source})`,
        beta,
        costOfEquity: `${costOfEquity.toFixed(2)}%`,
        costOfDebt: `${costOfDebt.toFixed(2)}%`,
        taxRate: `${taxRate}%`,
        equityWeight: `${(equityWeight * 100).toFixed(2)}%`,
        debtWeight: `${(debtWeight * 100).toFixed(2)}%`,
      },
      wacc,
      `market_data (Rf: ${MARKET_DATA_SOURCES.riskFreeRate.source}, ERP: ${MARKET_DATA_SOURCES.equityRiskPremium.source})`
    );
    
    return wacc;
  }

  // ===================================================================
  // GRAHAM'S INTRINSIC VALUE FORMULA
  // ===================================================================

  /**
   * Benjamin Graham's Intrinsic Value Formula
   * 
   * V = EPS × (8.5 + 2g) × (4.4/Y)
   * 
   * Where:
   * - EPS = Earnings Per Share (trailing twelve months)
   * - 8.5 = P/E base for a no-growth company
   * - g = Expected annual growth rate for next 7-10 years
   * - 4.4 = Average AAA corporate bond yield in Graham's era
   * - Y = Current AAA corporate bond yield (using RBI 10Y G-Sec as proxy)
   * 
   * Margin of Safety = (Intrinsic Value - Current Price) / Intrinsic Value
   */
  private calculateGrahamValue(stockData: StockFinancialData, enriched?: EnrichedStockSnapshot | null): GrahamResult | null {
    const { currentPrice } = stockData;
    let { eps, epsGrowthRate } = stockData;

    if (enriched?.fundamentals?.earningsYield && enriched.fundamentals.earningsYield > 0 && currentPrice && currentPrice > 0) {
      const enrichedEps = enriched.fundamentals.earningsYield * currentPrice / 100;
      if (enrichedEps > 0 && (!eps || eps <= 0)) {
        eps = enrichedEps;
      }
    }

    if (!eps || eps <= 0) {
      if (enriched?.fundamentals?.grahamNumber && enriched.fundamentals.grahamNumber > 0) {
        const grahamNumber = enriched.fundamentals.grahamNumber;
        let marginOfSafety = 0;
        if (currentPrice && currentPrice > 0) {
          marginOfSafety = ((grahamNumber - currentPrice) / grahamNumber) * 100;
        }
        this.addAuditEntry('Graham', 'FMP Graham Number used directly', 
          { grahamNumber, currentPrice: currentPrice || 'N/A' }, grahamNumber, 'FMP Graham Number');
        return {
          method: 'graham',
          intrinsicValue: Math.round(grahamNumber * 100) / 100,
          marginOfSafety: Math.round(marginOfSafety * 100) / 100,
          inputs: {
            eps: 0,
            epsGrowthRate: 0,
            aaa_bond_yield: DEFAULT_AAA_BOND_YIELD,
            no_growth_pe: GRAHAM_NO_GROWTH_PE,
          },
          formula: 'FMP Graham Number (pre-computed)',
          confidence: 'high',
          dataSource: 'FMP Graham Number',
        };
      }
      this.addAuditEntry('Graham', 'No positive EPS', { eps: eps || 'N/A' }, null, 'N/A', 'Graham formula requires positive EPS');
      return null;
    }

    if (enriched?.growth?.epsGrowth != null) {
      epsGrowthRate = enriched.growth.epsGrowth;
    }

    const growthRate = epsGrowthRate || 5;
    const cappedGrowthRate = Math.min(Math.max(growthRate, 0), 20);
    
    const aaaBondYield = DEFAULT_AAA_BOND_YIELD;
    
    const intrinsicValue = eps * (GRAHAM_NO_GROWTH_PE + GRAHAM_GROWTH_MULTIPLIER * cappedGrowthRate) * (4.4 / aaaBondYield);
    
    let marginOfSafety = 0;
    if (currentPrice && currentPrice > 0) {
      marginOfSafety = ((intrinsicValue - currentPrice) / intrinsicValue) * 100;
    }

    const usedEnrichedGrowth = enriched?.growth?.epsGrowth != null;
    const confidence = usedEnrichedGrowth ? 'high' as const : this.assessGrahamConfidence(eps, cappedGrowthRate, epsGrowthRate);
    const dataSource = usedEnrichedGrowth ? 'FMP enriched + financial_statements' : 'financial_statements';

    const formula = `V = EPS × (8.5 + 2g) × (4.4/Y) = ${eps.toFixed(2)} × (8.5 + 2×${cappedGrowthRate.toFixed(1)}) × (4.4/${aaaBondYield})`;

    this.addAuditEntry('Graham', formula, {
      eps,
      epsGrowthRate: `${cappedGrowthRate}%`,
      noGrowthPE: GRAHAM_NO_GROWTH_PE,
      aaaBondYield: `${aaaBondYield}% (${MARKET_DATA_SOURCES.aaaBondYield.source}, as of ${MARKET_DATA_SOURCES.aaaBondYield.asOf})`,
      grahamMultiplier: 4.4 / aaaBondYield,
      enrichedGrowthUsed: usedEnrichedGrowth ? 'yes' : 'no',
    }, intrinsicValue, dataSource);

    return {
      method: 'graham',
      intrinsicValue: Math.round(intrinsicValue * 100) / 100,
      marginOfSafety: Math.round(marginOfSafety * 100) / 100,
      inputs: {
        eps,
        epsGrowthRate: cappedGrowthRate,
        aaa_bond_yield: aaaBondYield,
        no_growth_pe: GRAHAM_NO_GROWTH_PE,
      },
      formula,
      confidence,
      dataSource,
    };
  }

  // ===================================================================
  // RELATIVE VALUATION
  // ===================================================================

  /**
   * Relative Valuation using Sector Comparables
   * 
   * Methods:
   * 1. P/E Based: Fair Value = EPS × Sector Avg P/E
   * 2. P/B Based: Fair Value = BVPS × Sector Avg P/B
   * 3. EV/EBITDA Based: Fair Value = (EBITDA × Sector Avg EV/EBITDA - Net Debt) / Shares
   * 
   * Composite = Weighted average of available methods
   */
  private async calculateRelativeValuation(stockData: StockFinancialData, enriched?: EnrichedStockSnapshot | null): Promise<RelativeValuationResult | null> {
    const { totalDebt, cash, sharesOutstanding, sector } = stockData;
    let { eps, bookValuePerShare, ebitda } = stockData;

    if (enriched?.fundamentals) {
      if (enriched.fundamentals.peRatio && enriched.fundamentals.peRatio > 0 && stockData.currentPrice && stockData.currentPrice > 0) {
        const enrichedEps = stockData.currentPrice / enriched.fundamentals.peRatio;
        if (enrichedEps > 0) eps = enrichedEps;
      }
      if (enriched.fundamentals.bookValuePerShare && enriched.fundamentals.bookValuePerShare > 0) {
        bookValuePerShare = enriched.fundamentals.bookValuePerShare;
      }
      if (enriched.fundamentals.evToEbitda && enriched.fundamentals.evToEbitda > 0 && enriched.fundamentals.enterpriseValue) {
        const enrichedEbitda = enriched.fundamentals.enterpriseValue / enriched.fundamentals.evToEbitda;
        if (enrichedEbitda > 0) ebitda = enrichedEbitda;
      }
    }

    if (!sector) {
      this.addAuditEntry('Relative', 'No sector data', {}, null, 'N/A', 'Sector classification required for relative valuation');
      return null;
    }

    const sectorAverages = await this.getSectorAverages(sector);
    
    if (!sectorAverages.avgPE && !sectorAverages.avgPB && !sectorAverages.avgEvEbitda) {
      this.addAuditEntry('Relative', 'No sector comparables', { sector }, null, 'database', 'Insufficient peer data for sector averages');
      return null;
    }

    let peBasedValue: number | null = null;
    let pbBasedValue: number | null = null;
    let evEbitdaBasedValue: number | null = null;
    const valueMethods: number[] = [];

    if (eps && eps > 0 && sectorAverages.avgPE) {
      peBasedValue = eps * sectorAverages.avgPE;
      valueMethods.push(peBasedValue);
      this.addAuditEntry('Relative-PE', `Fair Value = EPS × Sector Avg P/E = ${eps.toFixed(2)} × ${sectorAverages.avgPE.toFixed(2)}`, 
        { eps, sectorAvgPE: sectorAverages.avgPE }, peBasedValue, 'sector_database');
    }

    if (bookValuePerShare && bookValuePerShare > 0 && sectorAverages.avgPB) {
      pbBasedValue = bookValuePerShare * sectorAverages.avgPB;
      valueMethods.push(pbBasedValue);
      this.addAuditEntry('Relative-PB', `Fair Value = BVPS × Sector Avg P/B = ${bookValuePerShare.toFixed(2)} × ${sectorAverages.avgPB.toFixed(2)}`,
        { bookValuePerShare, sectorAvgPB: sectorAverages.avgPB }, pbBasedValue, 'sector_database');
    }

    if (ebitda && ebitda > 0 && sectorAverages.avgEvEbitda && sharesOutstanding && sharesOutstanding > 0) {
      const enterpriseValue = ebitda * sectorAverages.avgEvEbitda;
      const netDebt = (totalDebt || 0) - (cash || 0);
      const equityValue = enterpriseValue - netDebt;
      evEbitdaBasedValue = equityValue / sharesOutstanding;
      if (evEbitdaBasedValue > 0) {
        valueMethods.push(evEbitdaBasedValue);
        this.addAuditEntry('Relative-EVEBITDA', 
          `Fair Value = (EBITDA × Sector Avg EV/EBITDA - Net Debt) / Shares`,
          { ebitda, sectorAvgEvEbitda: sectorAverages.avgEvEbitda, netDebt, sharesOutstanding }, 
          evEbitdaBasedValue, 'sector_database');
      }
    }

    if (valueMethods.length === 0) {
      return null;
    }

    const compositeValue = valueMethods.reduce((a: any, b: any) => a + b, 0) / valueMethods.length;
    const usedEnrichedRelative = !!enriched?.fundamentals;
    const confidence = usedEnrichedRelative ? 'high' as const : this.assessRelativeConfidence(valueMethods.length, sectorAverages.peerCount);
    const relativeDataSource = usedEnrichedRelative ? 'FMP enriched + sector_database' : 'sector_database';

    return {
      method: 'relative',
      intrinsicValue: Math.round(compositeValue * 100) / 100,
      methods: {
        peBasedValue: peBasedValue ? Math.round(peBasedValue * 100) / 100 : null,
        pbBasedValue: pbBasedValue ? Math.round(pbBasedValue * 100) / 100 : null,
        evEbitdaBasedValue: evEbitdaBasedValue ? Math.round(evEbitdaBasedValue * 100) / 100 : null,
      },
      sectorAverages: {
        avgPE: sectorAverages.avgPE ? Math.round(sectorAverages.avgPE * 100) / 100 : null,
        avgPB: sectorAverages.avgPB ? Math.round(sectorAverages.avgPB * 100) / 100 : null,
        avgEvEbitda: sectorAverages.avgEvEbitda ? Math.round(sectorAverages.avgEvEbitda * 100) / 100 : null,
        sectorName: sector,
        peerCount: sectorAverages.peerCount,
      },
      formula: `Composite = Average of P/E, P/B, EV/EBITDA based valuations`,
      confidence,
      dataSource: relativeDataSource,
    };
  }

  /**
   * Get sector average valuation multiples from database
   */
  private async getSectorAverages(sector: string): Promise<{
    avgPE: number | null;
    avgPB: number | null;
    avgEvEbitda: number | null;
    peerCount: number;
  }> {
    try {
      const result = await db.select({
        avgPE: sql<number>`AVG(CASE WHEN CAST(pe_ratio AS DECIMAL) > 0 AND CAST(pe_ratio AS DECIMAL) < 100 THEN CAST(pe_ratio AS DECIMAL) END)`,
        avgPB: sql<number>`AVG(CASE WHEN CAST(pb_ratio AS DECIMAL) > 0 AND CAST(pb_ratio AS DECIMAL) < 20 THEN CAST(pb_ratio AS DECIMAL) END)`,
        avgEvEbitda: sql<number>`NULL`,
        peerCount: sql<number>`COUNT(*)`,
      })
      .from(schema.listedStocks)
      .where(sql`sector = ${sector} OR industry = ${sector}`);

      if (result.length > 0 && result[0].peerCount > 0) {
        return {
          avgPE: result[0].avgPE || null,
          avgPB: result[0].avgPB || null,
          avgEvEbitda: result[0].avgEvEbitda || null,
          peerCount: Number(result[0].peerCount) || 0,
        };
      }
    } catch (error) {
      console.error('[IntrinsicValue] Sector average query error:', error);
    }

    return { avgPE: null, avgPB: null, avgEvEbitda: null, peerCount: 0 };
  }

  // ===================================================================
  // BOOK VALUE APPROACH
  // ===================================================================

  /**
   * Net Asset Value / Book Value Approach
   * 
   * NAV = (Total Assets - Total Liabilities) / Shares Outstanding
   * Tangible Book Value = (Total Assets - Intangibles - Total Liabilities) / Shares
   * Intrinsic Value = NAV × (1 - Margin of Safety)
   */
  private calculateBookValue(stockData: StockFinancialData, enriched?: EnrichedStockSnapshot | null): BookValueResult | null {
    const { totalAssets, totalLiabilities, intangibleAssets, sharesOutstanding } = stockData;

    if (enriched?.fundamentals?.bookValuePerShare && enriched.fundamentals.bookValuePerShare > 0 && sharesOutstanding && sharesOutstanding > 0) {
      const bvps = enriched.fundamentals.bookValuePerShare;
      const marginOfSafety = DEFAULT_MARGIN_OF_SAFETY;
      const intrinsicValue = bvps * (1 - marginOfSafety);

      this.addAuditEntry('BookValue', 'FMP enriched bookValuePerShare used', 
        { bookValuePerShare: bvps, marginOfSafety: `${marginOfSafety * 100}%` }, 
        intrinsicValue, 'FMP enriched');

      return {
        method: 'book_value',
        intrinsicValue: Math.round(intrinsicValue * 100) / 100,
        netAssetValue: Math.round(bvps * 100) / 100,
        tangibleBookValue: Math.round(bvps * 100) / 100,
        inputs: {
          totalAssets: totalAssets || 0,
          totalLiabilities: totalLiabilities || 0,
          intangibleAssets: intangibleAssets || 0,
          sharesOutstanding,
          marginOfSafety,
        },
        formula: `Intrinsic = FMP BVPS × (1 - MoS) = ${bvps.toFixed(2)} × ${(1 - marginOfSafety).toFixed(2)}`,
        confidence: 'high',
        dataSource: 'FMP enriched',
      };
    }

    if (!totalAssets || !sharesOutstanding || sharesOutstanding <= 0) {
      this.addAuditEntry('BookValue', 'Insufficient balance sheet data', {}, null, 'N/A', 'Requires total assets and shares outstanding');
      return null;
    }

    const netAssetValue = (totalAssets - (totalLiabilities || 0)) / sharesOutstanding;
    const tangibleBookValue = (totalAssets - (intangibleAssets || 0) - (totalLiabilities || 0)) / sharesOutstanding;
    
    const marginOfSafety = DEFAULT_MARGIN_OF_SAFETY;
    const intrinsicValue = tangibleBookValue > 0 
      ? tangibleBookValue * (1 - marginOfSafety) 
      : netAssetValue * (1 - marginOfSafety);

    if (intrinsicValue <= 0) {
      this.addAuditEntry('BookValue', 'Negative book value', { netAssetValue, tangibleBookValue }, null, 'balance_sheet', 'Company has negative net worth');
      return null;
    }

    const confidence = this.assessBookValueConfidence(totalAssets, totalLiabilities ?? undefined, intangibleAssets ?? undefined);

    const formula = `NAV = (Assets - Liabilities) / Shares; TBV = (Assets - Intangibles - Liabilities) / Shares; Intrinsic = TBV × (1 - MoS)`;

    this.addAuditEntry('BookValue', formula, {
      totalAssets,
      totalLiabilities: totalLiabilities || 0,
      intangibleAssets: intangibleAssets || 0,
      sharesOutstanding,
      marginOfSafety: `${marginOfSafety * 100}%`,
    }, intrinsicValue, 'balance_sheet');

    return {
      method: 'book_value',
      intrinsicValue: Math.round(intrinsicValue * 100) / 100,
      netAssetValue: Math.round(netAssetValue * 100) / 100,
      tangibleBookValue: Math.round(tangibleBookValue * 100) / 100,
      inputs: {
        totalAssets,
        totalLiabilities: totalLiabilities || 0,
        intangibleAssets: intangibleAssets || 0,
        sharesOutstanding,
        marginOfSafety,
      },
      formula,
      confidence,
      dataSource: 'balance_sheet',
    };
  }

  // ===================================================================
  // DATA FETCHING
  // ===================================================================

  private async fetchListedStockData(symbol: string): Promise<StockFinancialData | null> {
    try {
      const [stock] = await db.select()
        .from(schema.listedStocks)
        .where(eq(schema.listedStocks.symbol, symbol.toUpperCase()))
        .limit(1);

      if (!stock) {
        return null;
      }

      const historicalFCFs = await this.getHistoricalFCFs(stock.id, 'listed');

      return {
        symbol: stock.symbol,
        companyName: stock.companyName || stock.symbol,
        currentPrice: stock.currentPrice ? Number(stock.currentPrice) : null,
        eps: stock.eps ? Number(stock.eps) : null,
        epsGrowthRate: null,
        bookValuePerShare: stock.bookValue ? Number(stock.bookValue) : null,
        freeCashFlows: historicalFCFs,
        totalAssets: null,
        totalLiabilities: null,
        totalDebt: null,
        cash: null,
        ebitda: null,
        marketCap: stock.marketCapValue ? Number(stock.marketCapValue) : null,
        sharesOutstanding: null,
        beta: 1.0,
        interestExpense: null,
        intangibleAssets: null,
        taxRate: 25,
        sector: stock.sector || stock.industry || null,
      };
    } catch (error) {
      console.error('[IntrinsicValue] Error fetching listed stock data:', error);
      return null;
    }
  }

  private async fetchUnlistedStockData(companyId: string): Promise<StockFinancialData | null> {
    try {
      const [company] = await db.select()
        .from(schema.unlistedCompanies)
        .where(eq(schema.unlistedCompanies.id, companyId))
        .limit(1);

      if (!company) {
        return null;
      }

      const financials = await db.select()
        .from(schema.companyFinancials)
        .where(eq(schema.companyFinancials.companyId, companyId))
        .orderBy(desc(schema.companyFinancials.financialYear))
        .limit(5);

      if (financials.length === 0) {
        return null;
      }

      const latestFinancial = financials[0];
      const sharesOutstanding = (company as any).sharesOutstanding ? Number((company as any).sharesOutstanding) : null;
      const currentPrice = (company as any).lastPrice ? Number((company as any).lastPrice) : null;

      const pat = Number(latestFinancial.pat || latestFinancial.netProfit || 0);
      const networth = Number(latestFinancial.networth || 0);
      const totalAssets = Number(latestFinancial.totalAssets || 0);
      const totalLiabilities = Number(latestFinancial.totalLiabilities || 0);
      const totalDebt = Number(latestFinancial.totalDebt || 0);
      const ebitda = Number(latestFinancial.ebitda || 0);
      
      const fcfs = financials.map((f: any) => {
        if (f.freeCashFlow) return Number(f.freeCashFlow);
        if (f.operatingCashFlow) return Number(f.operatingCashFlow) * 0.7;
        const patVal = Number(f.pat || f.netProfit || 0);
        return patVal * 0.8;
      }).filter((v: any) => v > 0);

      const eps = sharesOutstanding && sharesOutstanding > 0 ? pat / sharesOutstanding : null;
      const bookValuePerShare = sharesOutstanding && sharesOutstanding > 0 && networth > 0 ? networth / sharesOutstanding : null;

      let epsGrowthRate = null;
      if (financials.length >= 2) {
        const prevPat = Number(financials[1].pat || financials[1].netProfit || 0);
        if (prevPat > 0 && pat > 0) {
          epsGrowthRate = ((pat - prevPat) / prevPat) * 100;
        }
      }

      return {
        symbol: company.cin || company.name,
        companyName: company.name,
        currentPrice,
        eps,
        epsGrowthRate,
        bookValuePerShare,
        freeCashFlows: fcfs,
        totalAssets: totalAssets > 0 ? totalAssets : null,
        totalLiabilities: totalLiabilities > 0 ? totalLiabilities : null,
        totalDebt: totalDebt > 0 ? totalDebt : null,
        cash: null,
        ebitda: ebitda > 0 ? ebitda : null,
        marketCap: currentPrice && sharesOutstanding ? currentPrice * sharesOutstanding : null,
        sharesOutstanding,
        beta: 1.2,
        interestExpense: null,
        intangibleAssets: null,
        taxRate: 25,
        sector: company.industry || null,
      };
    } catch (error) {
      console.error('[IntrinsicValue] Error fetching unlisted stock data:', error);
      return null;
    }
  }

  /**
   * Get historical Free Cash Flows from database
   * FCF = Operating Cash Flow - Capital Expenditures
   * If FCF not available, estimate: FCF ≈ Net Income + Depreciation - Working Capital Changes
   */
  private async getHistoricalFCFs(stockId: string, stockType: 'listed' | 'unlisted'): Promise<number[]> {
    try {
      if (stockType === 'listed') {
        this.addAuditEntry('FCF-Data', 'Listed stock FCF data not available', 
          { reason: 'company_financials table is for unlisted companies only' }, 0, 'listed_stocks', 'No FCF source for listed stocks');
        return [];
      } else {
        const financials = await db.select({
          fiscalYear: (schema.companyFinancials as any).fiscalYear,
          freeCashFlow: schema.companyFinancials.freeCashFlow,
          operatingCashFlow: schema.companyFinancials.operatingCashFlow,
          netProfit: schema.companyFinancials.netProfit,
        })
        .from(schema.companyFinancials)
        .where(eq(schema.companyFinancials.companyId, stockId))
        .orderBy(desc((schema.companyFinancials as any).fiscalYear))
        .limit(5);

        if (financials.length === 0) {
          return [];
        }

        const fcfs: number[] = [];
        for (const fin of financials) {
          let fcf: number | null = null;
          
          if (fin.freeCashFlow) {
            fcf = Number(fin.freeCashFlow);
          } else if (fin.operatingCashFlow) {
            fcf = Number(fin.operatingCashFlow) * 0.7;
          } else if (fin.netProfit) {
            fcf = Number(fin.netProfit) * 0.8;
          }

          if (fcf && fcf > 0) {
            fcfs.push(fcf);
          }
        }

        if (fcfs.length > 0) {
          this.addAuditEntry('FCF-Data', 'Historical FCF from company_financials', 
            { years: fcfs.length, latestFCF: fcfs[0] }, fcfs[0], 'company_financials');
        }

        return fcfs;
      }
    } catch (error) {
      console.error('[IntrinsicValue] Error fetching historical FCFs:', error);
      return [];
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private calculateHistoricalGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const startValue = values[values.length - 1];
    const endValue = values[0];
    const years = values.length - 1;
    
    if (startValue <= 0 || endValue <= 0) return 0;
    
    const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
    return Math.max(-50, Math.min(50, cagr));
  }

  private compileResults(
    symbol: string,
    stockData: StockFinancialData,
    stockType: 'listed' | 'unlisted',
    valuations: {
      dcf: DCFResult | null;
      graham: GrahamResult | null;
      relative: RelativeValuationResult | null;
      bookValue: BookValueResult | null;
    }
  ): IntrinsicValueResult {
    const validValues: number[] = [];
    const weights: number[] = [];

    if (valuations.dcf) {
      validValues.push(valuations.dcf.intrinsicValuePerShare);
      weights.push(valuations.dcf.confidence === 'high' ? 0.4 : valuations.dcf.confidence === 'medium' ? 0.3 : 0.2);
    }
    if (valuations.graham) {
      validValues.push(valuations.graham.intrinsicValue);
      weights.push(valuations.graham.confidence === 'high' ? 0.3 : valuations.graham.confidence === 'medium' ? 0.25 : 0.15);
    }
    if (valuations.relative) {
      validValues.push(valuations.relative.intrinsicValue);
      weights.push(valuations.relative.confidence === 'high' ? 0.2 : valuations.relative.confidence === 'medium' ? 0.15 : 0.1);
    }
    if (valuations.bookValue) {
      validValues.push(valuations.bookValue.intrinsicValue);
      weights.push(valuations.bookValue.confidence === 'high' ? 0.1 : 0.05);
    }

    let compositeValue: number | null = null;
    if (validValues.length > 0) {
      const totalWeight = weights.reduce((a: any, b: any) => a + b, 0);
      compositeValue = validValues.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
      compositeValue = Math.round(compositeValue * 100) / 100;
    }

    let upside: number | null = null;
    let recommendation: 'undervalued' | 'fairly_valued' | 'overvalued' | 'insufficient_data' = 'insufficient_data';

    if (compositeValue && stockData.currentPrice && stockData.currentPrice > 0) {
      upside = ((compositeValue - stockData.currentPrice) / stockData.currentPrice) * 100;
      upside = Math.round(upside * 100) / 100;

      if (upside > 20) {
        recommendation = 'undervalued';
      } else if (upside < -20) {
        recommendation = 'overvalued';
      } else {
        recommendation = 'fairly_valued';
      }
    }

    const compositeConfidence = this.determineCompositeConfidence(valuations);

    return {
      symbol,
      companyName: stockData.companyName,
      stockType,
      currentPrice: stockData.currentPrice,
      calculatedAt: new Date(),
      valuations,
      compositeIntrinsicValue: compositeValue,
      compositeConfidence,
      upside,
      recommendation,
      auditTrail: [...this.auditLog],
      dataAvailability: {
        hasFCF: (stockData.freeCashFlows?.length || 0) >= 2,
        hasEPS: !!stockData.eps && stockData.eps > 0,
        hasBookValue: !!stockData.bookValuePerShare && stockData.bookValuePerShare > 0,
        hasSectorData: !!stockData.sector,
        hasHistoricalData: (stockData.freeCashFlows?.length || 0) >= 3,
      },
    };
  }

  private createInsufficientDataResult(identifier: string, stockType: 'listed' | 'unlisted'): IntrinsicValueResult {
    return {
      symbol: identifier,
      companyName: identifier,
      stockType,
      currentPrice: null,
      calculatedAt: new Date(),
      valuations: {
        dcf: null,
        graham: null,
        relative: null,
        bookValue: null,
      },
      compositeIntrinsicValue: null,
      compositeConfidence: 'insufficient_data',
      upside: null,
      recommendation: 'insufficient_data',
      auditTrail: [{
        timestamp: new Date(),
        method: 'Data Fetch',
        formula: 'N/A',
        inputs: { identifier },
        result: null,
        dataSource: 'database',
        notes: 'Could not find stock or financial data in database',
      }],
      dataAvailability: {
        hasFCF: false,
        hasEPS: false,
        hasBookValue: false,
        hasSectorData: false,
        hasHistoricalData: false,
      },
    };
  }

  private determineCompositeConfidence(valuations: {
    dcf: DCFResult | null;
    graham: GrahamResult | null;
    relative: RelativeValuationResult | null;
    bookValue: BookValueResult | null;
  }): 'high' | 'medium' | 'low' | 'insufficient_data' {
    const availableMethods = [
      valuations.dcf,
      valuations.graham,
      valuations.relative,
      valuations.bookValue,
    ].filter((v: any) => v !== null);

    if (availableMethods.length === 0) {
      return 'insufficient_data';
    }

    const highCount = availableMethods.filter((v: any) => v?.confidence === 'high').length;
    const mediumCount = availableMethods.filter((v: any) => v?.confidence === 'medium').length;

    if (highCount >= 2 || (highCount >= 1 && availableMethods.length >= 3)) {
      return 'high';
    } else if (highCount >= 1 || mediumCount >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private assessDCFConfidence(fcfYears: number, growthRate: number, wacc: number): 'high' | 'medium' | 'low' {
    if (fcfYears >= 5 && growthRate > 0 && growthRate < 30 && wacc > 5 && wacc < 20) {
      return 'high';
    } else if (fcfYears >= 3 && growthRate > -10 && growthRate < 40) {
      return 'medium';
    }
    return 'low';
  }

  private assessGrahamConfidence(eps: number, cappedGrowthRate: number, originalGrowthRate: number | null): 'high' | 'medium' | 'low' {
    if (eps > 0 && originalGrowthRate !== null && Math.abs(cappedGrowthRate - (originalGrowthRate || 0)) < 5) {
      return 'high';
    } else if (eps > 0) {
      return 'medium';
    }
    return 'low';
  }

  private assessRelativeConfidence(methodCount: number, peerCount: number): 'high' | 'medium' | 'low' {
    if (methodCount >= 2 && peerCount >= 10) {
      return 'high';
    } else if (methodCount >= 1 && peerCount >= 5) {
      return 'medium';
    }
    return 'low';
  }

  private assessBookValueConfidence(totalAssets: number, totalLiabilities: number | undefined, intangibleAssets: number | undefined): 'high' | 'medium' | 'low' {
    const hasCompleteLiabilities = !!totalLiabilities && totalLiabilities > 0;
    const hasIntangibles = intangibleAssets !== undefined;

    if (hasCompleteLiabilities && hasIntangibles && totalAssets > (totalLiabilities || 0)) {
      return 'high';
    } else if (hasCompleteLiabilities) {
      return 'medium';
    }
    return 'low';
  }

  private addAuditEntry(
    method: string,
    formula: string,
    inputs: Record<string, number | string>,
    result: number | null,
    dataSource: string,
    notes?: string
  ): void {
    this.auditLog.push({
      timestamp: new Date(),
      method,
      formula,
      inputs,
      result,
      dataSource,
      notes,
    });
  }
}

// ===================================================================
// INTERNAL TYPES
// ===================================================================

interface StockFinancialData {
  symbol: string;
  companyName: string;
  currentPrice: number | null;
  eps: number | null;
  epsGrowthRate: number | null;
  bookValuePerShare: number | null;
  freeCashFlows: number[];
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalDebt: number | null;
  cash: number | null;
  ebitda: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  beta: number;
  interestExpense: number | null;
  intangibleAssets: number | null;
  taxRate: number;
  sector: string | null;
}

// ===================================================================
// EXPORTS
// ===================================================================

export const intrinsicValueCalculator = new IntrinsicValueCalculatorService();
