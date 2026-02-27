/**
 * Probe42 Vendor Adapter
 *
 * Implements the CorporateDataProvider interface using the existing probe42-service.
 * All business logic must call this adapter — never call probe42-service directly
 * from enrichment pipelines. This decouples vendor-specific API semantics from
 * business logic and allows future provider switches without touching enrichment code.
 *
 * Available Probe42 endpoints (v2 API):
 *  GET /entities/{cin}/base-details  — Company profile, directors, capital structure
 *  GET /entities/{cin}/credit-ratings — Financial ratios (ROE, ROCE, D/E, etc.)
 *  GET /entities/{cin}/kyc           — Full financials (requires higher subscription tier)
 */

import { db } from '../../db';
import { vendorApiCallLog } from '@shared/schema';
import { probe42Service } from '../probe42-service';
import type { Probe42CompanyDetails, Probe42FinancialData, Probe42RatiosData } from '../probe42-service';

// ── Domain interfaces ───────────────────────────────────────────────────────

export interface CompanyProfile {
  cin: string;
  name: string;
  pan?: string | null;
  sector?: string | null;
  industry?: string | null;
  status?: string | null;
  incorporationDate?: string | null;
  paidUpCapital?: number | null;
  authorizedCapital?: number | null;
  directors?: Array<{ name: string; din?: string; designation?: string }>;
  website?: string | null;
}

export interface FinancialStatement {
  financialYear: string;
  revenue?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  pat?: number | null;
  netProfit?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  networth?: number | null;
  totalDebt?: number | null;
  operatingCashFlow?: number | null;
  source: string;
}

export interface FinancialRatios {
  financialYear: string;
  roe?: number | null;
  roce?: number | null;
  debtEquity?: number | null;
  currentRatio?: number | null;
  revenueGrowth?: number | null;
  profitGrowth?: number | null;
  marginEbitda?: number | null;
  marginPat?: number | null;
  peRatio?: number | null;
  source: string;
}

export interface Director {
  name: string;
  din?: string | null;
  designation?: string | null;
}

export interface Charge {
  chargeId?: string;
  chargeHolder?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
}

// ── Interface contract ──────────────────────────────────────────────────────

export interface CorporateDataProvider {
  fetchCompanyProfile(cin: string): Promise<CompanyProfile | null>;
  fetchFinancials(cin: string, years?: number): Promise<FinancialStatement[]>;
  fetchRatios(cin: string, years?: number): Promise<FinancialRatios[]>;
  fetchDirectors(cin: string): Promise<Director[]>;
  fetchCharges(cin: string): Promise<Charge[]>;
}

// ── Probe42 implementation ──────────────────────────────────────────────────

class Probe42Adapter implements CorporateDataProvider {
  private async logApiCall(
    endpoint: string,
    cin: string,
    startMs: number,
    statusCode: number,
    success: boolean,
    error?: string
  ) {
    try {
      await db.insert(vendorApiCallLog).values({
        vendor: 'probe42',
        endpoint,
        cin,
        statusCode,
        latencyMs: Date.now() - startMs,
        success,
        errorMessage: error ?? null,
        costUnit: 1,
      } as any);
    } catch {
      // Non-critical — never throw from logging
    }
  }

  async fetchCompanyProfile(cin: string): Promise<CompanyProfile | null> {
    const start = Date.now();
    const endpoint = `/entities/${cin}/base-details`;
    try {
      const raw: Probe42CompanyDetails | null = await probe42Service.getCompanyDetails(cin);
      await this.logApiCall(endpoint, cin, start, 200, true);
      if (!raw) return null;

      return {
        cin: raw.cin || cin,
        name: raw.name || '',
        pan: (raw as any).pan ?? null,
        sector: raw.sector ?? null,
        industry: raw.industry ?? null,
        status: raw.status ?? null,
        incorporationDate: (raw as any).incorporation_date ?? null,
        paidUpCapital: raw.paid_up_capital ? Number(raw.paid_up_capital) : null,
        authorizedCapital: raw.authorized_capital ? Number(raw.authorized_capital) : null,
        directors: (raw.directors ?? []).map((d: any) => ({
          name: d.name,
          din: d.din,
          designation: d.designation,
        })),
        website: raw.website ?? null,
      };
    } catch (err: any) {
      const status = err.response?.status ?? 500;
      await this.logApiCall(endpoint, cin, start, status, false, err.message);
      console.warn(`[Probe42Adapter] fetchCompanyProfile failed for ${cin}:`, err.message);
      return null;
    }
  }

  /**
   * Attempt to fetch full financial statements via /kyc endpoint.
   * If the subscription tier blocks access (403/402/400 with subscription error),
   * returns empty array so callers can fall back gracefully.
   * Never throws — callers must handle empty results.
   */
  async fetchFinancials(cin: string, years: number = 5): Promise<FinancialStatement[]> {
    const start = Date.now();
    const endpoint = `/entities/${cin}/kyc`;
    try {
      const raw: Probe42FinancialData[] = await probe42Service.getCompanyFinancialsFromKyc(cin, years);
      await this.logApiCall(endpoint, cin, start, 200, true);

      return raw.map((r) => ({
        financialYear: r.financial_year,
        revenue: r.revenue ?? null,
        ebitda: r.ebitda ?? null,
        ebit: r.ebit ?? null,
        pat: r.pat ?? null,
        netProfit: r.net_profit ?? null,
        totalAssets: r.total_assets ?? null,
        totalLiabilities: r.total_liabilities ?? null,
        networth: r.networth ?? null,
        totalDebt: r.total_debt ?? null,
        operatingCashFlow: r.operating_cash_flow ?? null,
        source: 'probe42',
      }));
    } catch (err: any) {
      const status = err.response?.status ?? 500;
      const isSubscriptionBlock = status === 402 || status === 403 ||
        (status === 400 && err.message?.toLowerCase().includes('subscription'));

      await this.logApiCall(endpoint, cin, start, status, false,
        isSubscriptionBlock ? 'subscription_tier_insufficient' : err.message);

      if (isSubscriptionBlock) {
        console.warn(`[Probe42Adapter] /kyc endpoint unavailable for ${cin} (subscription tier). Falling back to empty financials.`);
      } else {
        console.warn(`[Probe42Adapter] fetchFinancials failed for ${cin}:`, err.message);
      }
      return [];
    }
  }

  async fetchRatios(cin: string, years: number = 5): Promise<FinancialRatios[]> {
    const start = Date.now();
    const endpoint = `/entities/${cin}/credit-ratings`;
    try {
      const raw: Probe42RatiosData[] = await probe42Service.getCompanyRatios(cin, years);
      await this.logApiCall(endpoint, cin, start, 200, true);

      return raw.map((r) => ({
        financialYear: r.financial_year,
        roe: r.roe ?? null,
        roce: r.roce ?? null,
        debtEquity: r.debt_equity ?? null,
        currentRatio: r.current_ratio ?? null,
        revenueGrowth: r.revenue_growth ?? null,
        profitGrowth: r.profit_growth ?? null,
        marginEbitda: r.margin_ebitda ?? null,
        marginPat: r.margin_pat ?? null,
        peRatio: r.pe_ratio ?? null,
        source: 'probe42',
      }));
    } catch (err: any) {
      const status = err.response?.status ?? 500;
      await this.logApiCall(endpoint, cin, start, status, false, err.message);
      console.warn(`[Probe42Adapter] fetchRatios failed for ${cin}:`, err.message);
      return [];
    }
  }

  async fetchDirectors(cin: string): Promise<Director[]> {
    const profile = await this.fetchCompanyProfile(cin);
    return profile?.directors ?? [];
  }

  async fetchCharges(cin: string): Promise<Charge[]> {
    // Charge data is embedded in base-details response in some Probe42 tiers.
    // Currently not available in our subscription — return empty, log nothing.
    return [];
  }
}

export const probe42Adapter = new Probe42Adapter();
