/**
 * Sandbox.co.in Capital Gains Tax P&L API Service
 * Provides dynamic capital gains tax calculation using Sandbox's Tax P&L Calculator API
 * Supports: Equity shares, Mutual funds, ETFs, Bonds, Derivatives
 * 
 * API Flow: Submit Job → Upload Payload → Poll for Results
 * Documentation: https://developer.sandbox.co.in/api-reference/it/calculator/overview
 */

import axios from 'axios';

import { getSandboxBaseUrl, getSandboxApiKey, getSandboxApiSecret } from '../utils/sandbox-config';

const SANDBOX_BASE_URL = getSandboxBaseUrl();
const SANDBOX_API_KEY = getSandboxApiKey();
const SANDBOX_API_SECRET = getSandboxApiSecret();

interface SandboxAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export type AssetType = 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'derivative' | 'debt_fund';
export type TransactionType = 'BUY' | 'SELL';

export interface SecurityTransaction {
  scripCode?: string;
  isin?: string;
  scripName: string;
  transactionType: TransactionType;
  transactionDate: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  brokerageCharges?: number;
  sttCharges?: number;
  assetType: AssetType;
  exchange?: 'NSE' | 'BSE' | 'MCX';
}

export interface TaxPnLJobRequest {
  assessmentYear: string;
  pan?: string;
  transactions: SecurityTransaction[];
}

export interface JobSubmitResponse {
  success: boolean;
  jobId: string;
  uploadUrl: string;
  message?: string;
}

export interface JobStatusResponse {
  success: boolean;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  message?: string;
  result?: TaxPnLResult;
}

export interface TaxPnLResult {
  summary: {
    totalRealizedGain: number;
    totalRealizedLoss: number;
    netRealizedGain: number;
    totalUnrealizedGain: number;
    shortTermCapitalGains: number;
    longTermCapitalGains: number;
    shortTermCapitalLoss: number;
    longTermCapitalLoss: number;
    stcgTaxLiability: number;
    ltcgTaxLiability: number;
    totalTaxLiability: number;
    ltcgExemptionUsed: number;
  };
  scripWise: Array<{
    isin?: string;
    scripName: string;
    assetType: AssetType;
    holdingPeriodDays: number;
    isLongTerm: boolean;
    buyValue: number;
    sellValue: number;
    realizedGain: number;
    taxType: 'STCG' | 'LTCG';
    applicableTaxRate: number;
    taxLiability: number;
    indexedCost?: number;
    indexationBenefit?: number;
  }>;
  taxRates: {
    stcgEquity: number;
    ltcgEquity: number;
    stcgDebt: number;
    ltcgDebt: number;
    ltcgExemptionLimit: number;
    effectiveDate: string;
    source: string;
  };
}

export interface CapitalGainsTaxInput {
  productName: string;
  isin?: string;
  assetType: AssetType;
  purchaseDate: string;
  purchaseValue: number;
  currentValue: number;
  quantity: number;
  category?: string;
}

export interface CapitalGainsTaxOutput {
  productName: string;
  isin?: string;
  assetType: AssetType;
  holdingPeriodDays: number;
  isLongTerm: boolean;
  taxType: 'STCG' | 'LTCG' | 'SLAB';
  unrealizedGain: number;
  purchaseValue: number;
  currentValue: number;
  applicableTaxRate: number;
  estimatedTax: number;
  effectiveTaxRate: number;
  indexedCost?: number;
  indexationBenefit?: number;
  taxRateSource: 'SANDBOX_API' | 'LOCAL_FALLBACK';
  assessmentYear: string;
}

const taxResultCache = new Map<string, { result: TaxPnLResult; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

class SandboxCapitalGainsService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Sandbox API credentials not configured. Please set SANDBOX_API_KEY and SANDBOX_API_SECRET.');
    }

    try {
      const response = await axios.post<SandboxAuthResponse>(
        `${SANDBOX_BASE_URL}/authenticate`,
        {},
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'x-api-secret': SANDBOX_API_SECRET,
            'x-api-version': '1.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = response.data?.data?.access_token || response.data.access_token;
      const expiresIn = response.data?.data?.expires_in || response.data.expires_in || 86400;
      this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      console.error('[SandboxCapitalGains] Authentication failed:', error?.response?.data || error.message);
      throw new Error('Failed to authenticate with Sandbox API');
    }
  }

  async submitTaxPnLJob(request: TaxPnLJobRequest): Promise<JobSubmitResponse> {
    const token = await this.authenticate();

    try {
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/it/v1/calculator/tax-pnl/securities/domestic/job`,
        {
          assessment_year: request.assessmentYear,
          pan: request.pan,
        },
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'authorization': token,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data;
      if (!data?.job_id || !data?.upload_url) {
        throw new Error(response.data.message || 'Invalid response: missing job_id or upload_url');
      }

      return {
        success: true,
        jobId: data.job_id,
        uploadUrl: data.upload_url,
      };
    } catch (error: any) {
      console.error('[SandboxCapitalGains] Job submit failed:', error?.response?.data || error.message);
      throw error;
    }
  }

  async uploadTransactionPayload(uploadUrl: string, transactions: SecurityTransaction[]): Promise<boolean> {
    try {
      const payload = {
        transactions: transactions.map(t => ({
          scrip_code: t.scripCode,
          isin: t.isin,
          scrip_name: t.scripName,
          transaction_type: t.transactionType,
          transaction_date: t.transactionDate,
          quantity: t.quantity,
          price_per_unit: t.pricePerUnit,
          total_value: t.totalValue,
          brokerage_charges: t.brokerageCharges || 0,
          stt_charges: t.sttCharges || 0,
          asset_type: this.mapAssetType(t.assetType),
          exchange: t.exchange || 'NSE',
        })),
      };

      await axios.put(uploadUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return true;
    } catch (error: any) {
      console.error('[SandboxCapitalGains] Payload upload failed:', error?.response?.data || error.message);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const token = await this.authenticate();

    try {
      const response = await axios.get(
        `${SANDBOX_BASE_URL}/it/v1/calculator/tax-pnl/securities/domestic/job/${jobId}`,
        {
          headers: {
            'x-api-key': SANDBOX_API_KEY,
            'authorization': token,
            'x-api-version': '1.0',
          },
        }
      );

      const data = response.data.data;
      
      if (data.status === 'COMPLETED' && data.result) {
        return {
          success: true,
          status: 'COMPLETED',
          result: this.parseResult(data.result),
        };
      }

      return {
        success: true,
        status: data.status,
        message: data.message,
      };
    } catch (error: any) {
      console.error('[SandboxCapitalGains] Job status check failed:', error?.response?.data || error.message);
      throw error;
    }
  }

  async pollForResult(jobId: string, maxAttempts = 30, intervalMs = 2000): Promise<TaxPnLResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getJobStatus(jobId);
      
      if (status.status === 'COMPLETED' && status.result) {
        return status.result;
      }
      
      if (status.status === 'FAILED') {
        throw new Error(`Tax P&L calculation failed: ${status.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Tax P&L calculation timed out');
  }

  async calculateTaxPnL(request: TaxPnLJobRequest): Promise<TaxPnLResult> {
    const cacheKey = this.generateCacheKey(request);
    const cached = taxResultCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[SandboxCapitalGains] Returning cached result');
      return cached.result;
    }

    const jobResponse = await this.submitTaxPnLJob(request);
    await this.uploadTransactionPayload(jobResponse.uploadUrl, request.transactions);
    const result = await this.pollForResult(jobResponse.jobId);

    this.setCacheWithEviction(cacheKey, result);

    return result;
  }

  private setCacheWithEviction(key: string, result: TaxPnLResult): void {
    if (taxResultCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = taxResultCache.keys().next().value;
      if (oldestKey) {
        taxResultCache.delete(oldestKey);
      }
    }
    taxResultCache.set(key, { result, timestamp: Date.now() });
  }

  private findMatchingScripResult(
    scripWise: TaxPnLResult['scripWise'],
    isin?: string,
    productName?: string
  ): TaxPnLResult['scripWise'][0] | undefined {
    if (!scripWise || scripWise.length === 0) return undefined;
    
    if (isin) {
      const byIsin = scripWise.find(s => s.isin === isin);
      if (byIsin) return byIsin;
    }
    
    if (productName) {
      const byName = scripWise.find(s => 
        s.scripName.toLowerCase() === productName.toLowerCase()
      );
      if (byName) return byName;
      
      const byPartialName = scripWise.find(s => 
        s.scripName.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(s.scripName.toLowerCase())
      );
      if (byPartialName) return byPartialName;
    }
    
    return scripWise[0];
  }

  async calculateSingleHoldingTax(holding: CapitalGainsTaxInput): Promise<CapitalGainsTaxOutput> {
    const assessmentYear = this.getCurrentAssessmentYear();
    const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
    const isLongTerm = this.isLongTermHolding(holding.assetType, holdingPeriodDays);
    const unrealizedGain = holding.currentValue - holding.purchaseValue;

    try {
      const simulatedSellDate = new Date().toISOString().split('T')[0];
      
      const transactions: SecurityTransaction[] = [
        {
          isin: holding.isin,
          scripName: holding.productName,
          transactionType: 'BUY',
          transactionDate: holding.purchaseDate,
          quantity: holding.quantity,
          pricePerUnit: holding.purchaseValue / holding.quantity,
          totalValue: holding.purchaseValue,
          assetType: holding.assetType,
        },
        {
          isin: holding.isin,
          scripName: holding.productName,
          transactionType: 'SELL',
          transactionDate: simulatedSellDate,
          quantity: holding.quantity,
          pricePerUnit: holding.currentValue / holding.quantity,
          totalValue: holding.currentValue,
          assetType: holding.assetType,
        },
      ];

      const result = await this.calculateTaxPnL({
        assessmentYear,
        transactions,
      });

      const scripResult = this.findMatchingScripResult(result.scripWise, holding.isin, holding.productName);
      const taxRates = result.taxRates;

      return {
        productName: holding.productName,
        isin: holding.isin,
        assetType: holding.assetType,
        holdingPeriodDays,
        isLongTerm: scripResult?.isLongTerm ?? isLongTerm,
        taxType: scripResult?.taxType ?? (isLongTerm ? 'LTCG' : 'STCG'),
        unrealizedGain,
        purchaseValue: holding.purchaseValue,
        currentValue: holding.currentValue,
        applicableTaxRate: scripResult?.applicableTaxRate ?? (isLongTerm ? taxRates.ltcgEquity : taxRates.stcgEquity),
        estimatedTax: scripResult?.taxLiability ?? this.calculateLocalTax(unrealizedGain, isLongTerm, holding.assetType),
        effectiveTaxRate: unrealizedGain > 0 ? (scripResult?.taxLiability ?? 0) / unrealizedGain : 0,
        indexedCost: scripResult?.indexedCost,
        indexationBenefit: scripResult?.indexationBenefit,
        taxRateSource: 'SANDBOX_API',
        assessmentYear,
      };
    } catch (error) {
      console.warn('[SandboxCapitalGains] API failed, using local fallback:', error);
      return this.calculateLocalFallback(holding, holdingPeriodDays, isLongTerm, unrealizedGain, assessmentYear);
    }
  }

  async getCurrentTaxRates(): Promise<{
    stcgEquity: number;
    ltcgEquity: number;
    stcgDebt: number;
    ltcgDebt: number;
    ltcgExemptionLimit: number;
    effectiveDate: string;
    source: 'SANDBOX_API' | 'LOCAL_FALLBACK';
  }> {
    try {
      const dummyTransaction: SecurityTransaction = {
        scripName: 'DUMMY_RATE_CHECK',
        transactionType: 'BUY',
        transactionDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        quantity: 1,
        pricePerUnit: 100,
        totalValue: 100,
        assetType: 'equity',
      };

      const result = await this.calculateTaxPnL({
        assessmentYear: this.getCurrentAssessmentYear(),
        transactions: [
          dummyTransaction,
          { ...dummyTransaction, transactionType: 'SELL', transactionDate: new Date().toISOString().split('T')[0] },
        ],
      });

      return {
        ...result.taxRates,
        source: 'SANDBOX_API',
      };
    } catch (error) {
      console.warn('[SandboxCapitalGains] Could not fetch tax rates from API, using local fallback');
      return {
        stcgEquity: 0.20,
        ltcgEquity: 0.125,
        stcgDebt: 0.20,
        ltcgDebt: 0.125,
        ltcgExemptionLimit: 125000,
        effectiveDate: '2024-07-23',
        source: 'LOCAL_FALLBACK',
      };
    }
  }

  isServiceAvailable(): boolean {
    return !!(SANDBOX_API_KEY && SANDBOX_API_SECRET);
  }

  private mapAssetType(assetType: AssetType): string {
    const mapping: Record<AssetType, string> = {
      equity: 'EQUITY',
      mutual_fund: 'MUTUAL_FUND',
      etf: 'ETF',
      bond: 'BOND',
      derivative: 'DERIVATIVE',
      debt_fund: 'DEBT_FUND',
    };
    return mapping[assetType] || 'EQUITY';
  }

  private parseResult(rawResult: any): TaxPnLResult {
    return {
      summary: {
        totalRealizedGain: rawResult.summary?.total_realized_gain || 0,
        totalRealizedLoss: rawResult.summary?.total_realized_loss || 0,
        netRealizedGain: rawResult.summary?.net_realized_gain || 0,
        totalUnrealizedGain: rawResult.summary?.total_unrealized_gain || 0,
        shortTermCapitalGains: rawResult.summary?.short_term_capital_gains || 0,
        longTermCapitalGains: rawResult.summary?.long_term_capital_gains || 0,
        shortTermCapitalLoss: rawResult.summary?.short_term_capital_loss || 0,
        longTermCapitalLoss: rawResult.summary?.long_term_capital_loss || 0,
        stcgTaxLiability: rawResult.summary?.stcg_tax_liability || 0,
        ltcgTaxLiability: rawResult.summary?.ltcg_tax_liability || 0,
        totalTaxLiability: rawResult.summary?.total_tax_liability || 0,
        ltcgExemptionUsed: rawResult.summary?.ltcg_exemption_used || 0,
      },
      scripWise: (rawResult.scrip_wise || []).map((s: any) => ({
        isin: s.isin,
        scripName: s.scrip_name,
        assetType: this.reverseMapAssetType(s.asset_type),
        holdingPeriodDays: s.holding_period_days,
        isLongTerm: s.is_long_term,
        buyValue: s.buy_value,
        sellValue: s.sell_value,
        realizedGain: s.realized_gain,
        taxType: s.tax_type,
        applicableTaxRate: s.applicable_tax_rate,
        taxLiability: s.tax_liability,
        indexedCost: s.indexed_cost,
        indexationBenefit: s.indexation_benefit,
      })),
      taxRates: {
        stcgEquity: rawResult.tax_rates?.stcg_equity || 0.20,
        ltcgEquity: rawResult.tax_rates?.ltcg_equity || 0.125,
        stcgDebt: rawResult.tax_rates?.stcg_debt || 0.20,
        ltcgDebt: rawResult.tax_rates?.ltcg_debt || 0.125,
        ltcgExemptionLimit: rawResult.tax_rates?.ltcg_exemption_limit || 125000,
        effectiveDate: rawResult.tax_rates?.effective_date || '2024-07-23',
        source: 'Sandbox.co.in Tax API',
      },
    };
  }

  private reverseMapAssetType(apiType: string): AssetType {
    const mapping: Record<string, AssetType> = {
      'EQUITY': 'equity',
      'MUTUAL_FUND': 'mutual_fund',
      'ETF': 'etf',
      'BOND': 'bond',
      'DERIVATIVE': 'derivative',
      'DEBT_FUND': 'debt_fund',
    };
    return mapping[apiType] || 'equity';
  }

  private getCurrentAssessmentYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 3) {
      return `${year + 1}-${(year + 2).toString().slice(-2)}`;
    }
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }

  private calculateHoldingPeriod(purchaseDate: string): number {
    const purchase = new Date(purchaseDate);
    const now = new Date();
    return Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
  }

  private isLongTermHolding(assetType: AssetType, holdingDays: number): boolean {
    const equityTypes: AssetType[] = ['equity', 'mutual_fund', 'etf'];
    const threshold = equityTypes.includes(assetType) ? 365 : 730;
    return holdingDays >= threshold;
  }

  private calculateLocalTax(gain: number, isLongTerm: boolean, assetType: AssetType): number {
    if (gain <= 0) return 0;

    const equityTypes: AssetType[] = ['equity', 'mutual_fund', 'etf'];
    const isEquity = equityTypes.includes(assetType);

    if (isLongTerm) {
      const exemption = isEquity ? 125000 : 0;
      const taxableGain = Math.max(0, gain - exemption);
      return taxableGain * 0.125;
    }
    return gain * 0.20;
  }

  private calculateLocalFallback(
    holding: CapitalGainsTaxInput,
    holdingPeriodDays: number,
    isLongTerm: boolean,
    unrealizedGain: number,
    assessmentYear: string
  ): CapitalGainsTaxOutput {
    const estimatedTax = this.calculateLocalTax(unrealizedGain, isLongTerm, holding.assetType);
    
    return {
      productName: holding.productName,
      isin: holding.isin,
      assetType: holding.assetType,
      holdingPeriodDays,
      isLongTerm,
      taxType: isLongTerm ? 'LTCG' : 'STCG',
      unrealizedGain,
      purchaseValue: holding.purchaseValue,
      currentValue: holding.currentValue,
      applicableTaxRate: isLongTerm ? 0.125 : 0.20,
      estimatedTax,
      effectiveTaxRate: unrealizedGain > 0 ? estimatedTax / unrealizedGain : 0,
      taxRateSource: 'LOCAL_FALLBACK',
      assessmentYear,
    };
  }

  private generateCacheKey(request: TaxPnLJobRequest): string {
    const transactionHash = request.transactions
      .map(t => `${t.isin || t.scripName}:${t.transactionType}:${t.transactionDate}:${t.quantity}`)
      .sort()
      .join('|');
    return `${request.assessmentYear}:${transactionHash}`;
  }

  clearCache(): void {
    taxResultCache.clear();
    console.log('[SandboxCapitalGains] Cache cleared');
  }
}

export const sandboxCapitalGainsService = new SandboxCapitalGainsService();
