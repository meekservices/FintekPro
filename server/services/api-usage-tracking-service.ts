import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, sql, and, gte, lte, desc, count, sum } from 'drizzle-orm';

interface ApiCallLogParams {
  provider: string;
  endpoint: string;
  method?: string;
  userId?: string;
  feature?: string;
  statusCode?: number;
  success?: boolean;
  errorMessage?: string;
  responseTimeMs?: number;
  requestPayload?: any;
  responsePayload?: any;
}

interface ProviderPricing {
  providerName: string;
  displayName: string;
  description?: string;
  costPerCall: number;
  currency?: string;
}

interface UsageStats {
  provider: string;
  displayName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  costPerCall: number;
  totalCost: number;
  currency: string;
}

interface MonthlyEstimate {
  month: string;
  totalCalls: number;
  totalCost: number;
  byProvider: UsageStats[];
  projectedMonthEnd: number;
}

const DEFAULT_PROVIDERS: ProviderPricing[] = [
  // Sandbox.co.in — separate services
  { providerName: 'sandbox-pan', displayName: 'Sandbox — PAN Verification', description: 'PAN card identity verification', costPerCall: 2 },
  { providerName: 'sandbox-mca', displayName: 'Sandbox — MCA Data', description: 'Ministry of Corporate Affairs company data', costPerCall: 3 },
  { providerName: 'sandbox-gstin', displayName: 'Sandbox — GSTIN Verification', description: 'GST identification number verification', costPerCall: 1.5 },

  // Truthscreen/AuthBridge — separate services
  { providerName: 'truthscreen-aadhaar', displayName: 'AuthBridge — Aadhaar Verification', description: 'Aadhaar identity verification (OTP/offline)', costPerCall: 3 },
  { providerName: 'truthscreen-ckyc', displayName: 'AuthBridge — CKYC Search', description: 'Central KYC registry lookup', costPerCall: 5 },
  { providerName: 'truthscreen-esign', displayName: 'AuthBridge — eSign', description: 'Aadhaar-based electronic signature', costPerCall: 10 },

  // Cashfree — separate services
  { providerName: 'cashfree-payments', displayName: 'Cashfree — Payment Gateway', description: 'Online payment collection (UPI, cards, netbanking)', costPerCall: 0 },
  { providerName: 'cashfree-payouts', displayName: 'Cashfree — Payouts', description: 'Bank transfer payouts to beneficiaries', costPerCall: 5 },
  { providerName: 'cashfree-pan', displayName: 'Cashfree — PAN Verification', description: 'PAN card verification via Cashfree', costPerCall: 2 },
  { providerName: 'cashfree-bank', displayName: 'Cashfree — Bank Verification', description: 'Bank account penny drop verification', costPerCall: 3 },

  // PhonePe — single service
  { providerName: 'phonepe', displayName: 'PhonePe — Payment Gateway', description: 'UPI & payment gateway', costPerCall: 0 },

  // Twilio — separate services
  { providerName: 'twilio-sms', displayName: 'Twilio — SMS', description: 'SMS OTP & notifications', costPerCall: 0.5 },
  { providerName: 'twilio-whatsapp', displayName: 'Twilio — WhatsApp', description: 'WhatsApp business messaging', costPerCall: 0.3 },

  // Probe42 — separate services
  { providerName: 'probe42-details', displayName: 'Probe42 — Company Details', description: 'Company master data & directors', costPerCall: 5 },
  { providerName: 'probe42-financials', displayName: 'Probe42 — Company Financials', description: 'Balance sheet, P&L, cash flow', costPerCall: 8 },
  { providerName: 'probe42-ratios', displayName: 'Probe42 — Company Ratios', description: 'Financial ratios & analytics', costPerCall: 5 },

  // Google Gemini — single service
  { providerName: 'gemini', displayName: 'Google Gemini', description: 'AI features (fallback)', costPerCall: 0.01 },

  // Zoho — separate services
  { providerName: 'zoho-crm', displayName: 'Zoho — CRM', description: 'Lead & contact management, deal pipeline', costPerCall: 0 },
  { providerName: 'zoho-books', displayName: 'Zoho — Books', description: 'Invoicing & accounting', costPerCall: 0 },
  { providerName: 'zoho-campaigns', displayName: 'Zoho — Campaigns', description: 'Email marketing campaigns', costPerCall: 0 },
  { providerName: 'zoho-meeting', displayName: 'Zoho — Meeting', description: 'Video conferencing & webinars', costPerCall: 0 },
  { providerName: 'zoho-sign', displayName: 'Zoho — Sign', description: 'Document digital signing', costPerCall: 0 },

  // OpenAI — single service
  { providerName: 'openai', displayName: 'OpenAI', description: 'Primary AI engine (recommendations, analysis)', costPerCall: 0.03 },

  // Financial data providers — single service each
  { providerName: 'fmp', displayName: 'Financial Modeling Prep', description: 'Stock financials, ETF data, batch quotes', costPerCall: 0.01 },
  { providerName: 'finnhub', displayName: 'Finnhub', description: 'Stock metrics, real-time market data', costPerCall: 0 },
  { providerName: 'yahoo', displayName: 'Yahoo Finance', description: 'Stock prices, fallback provider', costPerCall: 0 },
  { providerName: 'nse', displayName: 'NSE India', description: 'Market movers, stock exchange data', costPerCall: 0 },
  { providerName: 'bse', displayName: 'BSE India', description: 'Market movers, bond catalog', costPerCall: 0 },
  { providerName: 'amfi', displayName: 'AMFI', description: 'Mutual fund NAV, scheme data', costPerCall: 0 },
  { providerName: 'polygon', displayName: 'Polygon.io', description: 'US market data, flat files', costPerCall: 0.01 },
  { providerName: 'alphavantage', displayName: 'Alpha Vantage', description: 'Financial data, technical indicators', costPerCall: 0.01 },

  // Turtlefin — separate services
  { providerName: 'turtlefin-life', displayName: 'Turtlefin — Life Insurance', description: 'Life insurance quotes & issuance', costPerCall: 1 },
  { providerName: 'turtlefin-health', displayName: 'Turtlefin — Health Insurance', description: 'Health insurance quotes & issuance', costPerCall: 1 },
  { providerName: 'turtlefin-general', displayName: 'Turtlefin — General Insurance', description: 'Motor, travel, property insurance', costPerCall: 1 },

  // Protean (NSDL) — separate services
  { providerName: 'protean-esign', displayName: 'Protean — Aadhaar eSign', description: 'NSDL Aadhaar-based electronic signature', costPerCall: 4 },
  { providerName: 'protean-kra', displayName: 'Protean — KRA Verification', description: 'KYC Registration Agency verification', costPerCall: 2 },

  // CIBIL — separate services
  { providerName: 'cibil-score', displayName: 'CIBIL — Credit Score', description: 'TransUnion CIBIL score fetch', costPerCall: 12 },
  { providerName: 'cibil-report', displayName: 'CIBIL — Credit Report', description: 'Detailed credit report with history', costPerCall: 25 },

  // Utility providers — single service each
  { providerName: 'exchangerate', displayName: 'Exchange Rate API', description: 'Currency conversion rates', costPerCall: 0 },
  { providerName: 'smtp', displayName: 'SMTP/Nodemailer', description: 'Email delivery', costPerCall: 0 },
];

class ApiUsageTrackingService {
  private providerPricing: Map<string, ProviderPricing> = new Map();
  private initialized = false;

  constructor() {
    this.initializeDefaultPricing();
  }

  private initializeDefaultPricing() {
    DEFAULT_PROVIDERS.forEach(provider => {
      this.providerPricing.set(provider.providerName.toLowerCase(), provider);
    });
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const existingPricing = await db.select().from(schema.apiProviderPricing);
      
      const existingNames = new Set(existingPricing.map(p => p.providerName.toLowerCase()));
      
      existingPricing.forEach(p => {
        this.providerPricing.set(p.providerName.toLowerCase(), {
          providerName: p.providerName,
          displayName: p.displayName,
          description: p.description || undefined,
          costPerCall: parseFloat(p.costPerCall || '0'),
          currency: p.currency || 'INR',
        });
      });

      let newCount = 0;
      for (const provider of DEFAULT_PROVIDERS) {
        if (!existingNames.has(provider.providerName.toLowerCase())) {
          await db.insert(schema.apiProviderPricing).values({
            providerName: provider.providerName,
            displayName: provider.displayName,
            description: provider.description,
            costPerCall: String(provider.costPerCall),
            currency: 'INR',
            isActive: true,
          }).onConflictDoNothing();
          this.providerPricing.set(provider.providerName.toLowerCase(), provider);
          newCount++;
        }
      }

      if (newCount > 0) {
        console.log(`✅ API provider pricing loaded (${existingPricing.length} existing + ${newCount} new providers)`);
      } else {
        console.log(`✅ API provider pricing loaded (${existingPricing.length} providers)`);
      }
      
      this.initialized = true;
    } catch (error) {
      console.warn('⚠️ Could not load API provider pricing from database, using defaults');
      this.initialized = true;
    }
  }

  private resolveProviderKey(provider: string, endpoint?: string): string {
    const key = provider.toLowerCase();
    if (this.providerPricing.has(key)) return key;

    const ep = (endpoint || '').toLowerCase();
    const LEGACY_MAP: Record<string, (ep: string) => string> = {
      'sandbox': (ep) => ep.includes('gstin') ? 'sandbox-gstin' : ep.includes('mca') ? 'sandbox-mca' : 'sandbox-pan',
      'truthscreen': (ep) => ep.includes('ckyc') ? 'truthscreen-ckyc' : ep.includes('esign') || ep.includes('sign') ? 'truthscreen-esign' : 'truthscreen-aadhaar',
      'cashfree': (ep) => ep.includes('payout') ? 'cashfree-payouts' : ep.includes('pan') ? 'cashfree-pan' : ep.includes('bank') || ep.includes('penny') ? 'cashfree-bank' : 'cashfree-payments',
      'twilio': (ep) => ep.includes('whatsapp') ? 'twilio-whatsapp' : 'twilio-sms',
      'probe42': (ep) => ep.includes('financial') ? 'probe42-financials' : ep.includes('ratio') ? 'probe42-ratios' : 'probe42-details',
      'zoho': (ep) => ep.includes('book') ? 'zoho-books' : ep.includes('campaign') ? 'zoho-campaigns' : ep.includes('meeting') ? 'zoho-meeting' : ep.includes('sign') ? 'zoho-sign' : 'zoho-crm',
      'protean': (ep) => ep.includes('kra') ? 'protean-kra' : 'protean-esign',
      'turtlefin': (ep) => ep.includes('health') ? 'turtlefin-health' : ep.includes('general') || ep.includes('motor') ? 'turtlefin-general' : 'turtlefin-life',
      'cibil': (ep) => ep.includes('report') ? 'cibil-report' : 'cibil-score',
    };

    const mapper = LEGACY_MAP[key];
    return mapper ? mapper(ep) : key;
  }

  async logApiCall(params: ApiCallLogParams): Promise<void> {
    try {
      const resolvedProvider = this.resolveProviderKey(params.provider, params.endpoint);
      const pricing = this.providerPricing.get(resolvedProvider);
      const cost = pricing?.costPerCall || 0;

      await db.insert(schema.apiUsageLogs).values({
        provider: resolvedProvider,
        apiEndpoint: params.endpoint,
        apiMethod: params.method || 'POST',
        userId: params.userId,
        feature: params.feature,
        statusCode: params.statusCode,
        status: params.success === false ? 'error' : 'success',
        errorMessage: params.errorMessage,
        responseTime: params.responseTimeMs,
        requestBody: params.requestPayload,
        responseBody: params.responsePayload,
        estimatedCost: String(cost),
        currency: pricing?.currency || 'INR',
      });
    } catch (error) {
      console.error('[API Usage Tracking] Failed to log API call:', error);
    }
  }

  async getProviderPricing(): Promise<ProviderPricing[]> {
    try {
      const pricing = await db.select().from(schema.apiProviderPricing);
      return pricing.map(p => ({
        providerName: p.providerName,
        displayName: p.displayName,
        description: p.description || undefined,
        costPerCall: parseFloat(p.costPerCall || '0'),
        currency: p.currency || 'INR',
      }));
    } catch (error) {
      return Array.from(this.providerPricing.values());
    }
  }

  async updateProviderPricing(providerName: string, costPerCall: number, adminId: string): Promise<{ success: boolean; message: string }> {
    try {
      const existing = await db.select()
        .from(schema.apiProviderPricing)
        .where(eq(schema.apiProviderPricing.providerName, providerName.toLowerCase()))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: `Provider ${providerName} not found` };
      }

      await db.update(schema.apiProviderPricing)
        .set({ 
          costPerCall: String(costPerCall),
          updatedAt: new Date()
        })
        .where(eq(schema.apiProviderPricing.providerName, providerName.toLowerCase()));

      this.providerPricing.set(providerName.toLowerCase(), {
        ...existing[0],
        providerName: existing[0].providerName,
        displayName: existing[0].displayName,
        costPerCall: costPerCall,
      });

      console.log(`[API Usage] Admin ${adminId} updated ${providerName} pricing to ₹${costPerCall}/call`);
      
      return { success: true, message: `Updated ${providerName} cost to ₹${costPerCall} per call` };
    } catch (error) {
      console.error('[API Usage Tracking] Failed to update pricing:', error);
      return { success: false, message: 'Failed to update pricing' };
    }
  }

  async addProvider(provider: ProviderPricing, adminId: string): Promise<{ success: boolean; message: string }> {
    try {
      await db.insert(schema.apiProviderPricing).values({
        providerName: provider.providerName.toLowerCase(),
        displayName: provider.displayName,
        description: provider.description,
        costPerCall: String(provider.costPerCall),
        currency: provider.currency || 'INR',
        isActive: true,
      });

      this.providerPricing.set(provider.providerName.toLowerCase(), provider);
      
      console.log(`[API Usage] Admin ${adminId} added provider ${provider.providerName}`);
      return { success: true, message: `Added provider ${provider.displayName}` };
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return { success: false, message: 'Provider already exists' };
      }
      return { success: false, message: 'Failed to add provider' };
    }
  }

  async getUsageStats(startDate?: Date, endDate?: Date): Promise<UsageStats[]> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate || now;

      const usageLogs = await db.select({
        provider: schema.apiUsageLogs.provider,
        status: schema.apiUsageLogs.status,
        estimatedCost: schema.apiUsageLogs.estimatedCost,
        currency: schema.apiUsageLogs.currency,
      })
      .from(schema.apiUsageLogs)
      .where(and(
        gte(schema.apiUsageLogs.createdAt, start),
        lte(schema.apiUsageLogs.createdAt, end)
      ));

      const statsByProvider: Map<string, UsageStats> = new Map();

      usageLogs.forEach(log => {
        const providerLower = log.provider.toLowerCase();
        const pricing = this.providerPricing.get(providerLower);
        
        if (!statsByProvider.has(providerLower)) {
          statsByProvider.set(providerLower, {
            provider: providerLower,
            displayName: pricing?.displayName || log.provider,
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            costPerCall: pricing?.costPerCall || parseFloat(log.estimatedCost || '0'),
            totalCost: 0,
            currency: log.currency || 'INR',
          });
        }

        const stats = statsByProvider.get(providerLower)!;
        stats.totalCalls++;
        
        if (log.status === 'success') {
          stats.successfulCalls++;
        } else {
          stats.failedCalls++;
        }
        
        stats.totalCost += parseFloat(log.estimatedCost || '0');
      });

      return Array.from(statsByProvider.values()).sort((a, b) => b.totalCost - a.totalCost);
    } catch (error) {
      console.error('[API Usage Tracking] Failed to get usage stats:', error);
      return [];
    }
  }

  async getMonthlyEstimate(): Promise<MonthlyEstimate> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const dayOfMonth = now.getDate();

    const stats = await this.getUsageStats(startOfMonth, now);
    
    const totalCalls = stats.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalCost = stats.reduce((sum, s) => sum + s.totalCost, 0);
    
    const dailyAvgCost = totalCost / dayOfMonth;
    const projectedMonthEnd = dailyAvgCost * daysInMonth;

    return {
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalCalls,
      totalCost: Math.round(totalCost * 100) / 100,
      byProvider: stats,
      projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
    };
  }

  async getDailyUsage(days: number = 30): Promise<{ date: string; calls: number; cost: number }[]> {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const logs = await db.select({
        createdAt: schema.apiUsageLogs.createdAt,
        estimatedCost: schema.apiUsageLogs.estimatedCost,
      })
      .from(schema.apiUsageLogs)
      .where(gte(schema.apiUsageLogs.createdAt, startDate))
      .orderBy(schema.apiUsageLogs.createdAt);

      const dailyStats: Map<string, { calls: number; cost: number }> = new Map();

      logs.forEach(log => {
        if (!log.createdAt) return;
        const dateKey = log.createdAt.toISOString().split('T')[0];
        
        if (!dailyStats.has(dateKey)) {
          dailyStats.set(dateKey, { calls: 0, cost: 0 });
        }
        
        const stats = dailyStats.get(dateKey)!;
        stats.calls++;
        stats.cost += parseFloat(log.estimatedCost || '0');
      });

      return Array.from(dailyStats.entries())
        .map(([date, stats]) => ({
          date,
          calls: stats.calls,
          cost: Math.round(stats.cost * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('[API Usage Tracking] Failed to get daily usage:', error);
      return [];
    }
  }

  getCostPerCall(provider: string): number {
    const pricing = this.providerPricing.get(provider.toLowerCase());
    return pricing?.costPerCall || 0;
  }
}

export const apiUsageTrackingService = new ApiUsageTrackingService();
