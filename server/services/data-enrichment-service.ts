/**
 * Data Enrichment Orchestrator Service
 * Handles multi-source financial data enrichment with:
 * - Priority-based source selection for Indian market:
 *   Probe42 (0.98) → MCA (0.95) → NSE/BSE (0.90) → Finnhub (0.75) → Yahoo (0.65)
 * - Metric-level source merging
 * - SEBI-compliant audit logging
 * - AI guardrails for data usage
 */

import { probe42Service } from './probe42-service';
import { finnhubService } from './finnhub-service';
import { exchangeFilingsService } from './exchange-filings-service';
import { xbrlParserService } from './xbrl-parser-service';
import { mcaService } from './mca-service';
import { nsdlISINService } from './nsdl-isin-service';
import { ExternalServiceError } from '../utils/errors';

export type DataSource = 'nse_bse' | 'probe42' | 'finnhub' | 'yahoo' | 'manual' | 'mca';

export interface MetricValue {
  value: number | string | null;
  source: DataSource;
  retrievedAt: Date;
  confidenceScore: number;
  isOverridden?: boolean;
  overrideReason?: string;
  overrideBy?: string;
  originalValue?: number | string | null;
  originalSource?: DataSource;
}

export interface EnrichedFinancials {
  companyId: string;
  financialYear: string;
  currency: string;
  lastEnrichedAt: Date;
  sources: DataSource[];
  overallConfidence: number;
  metrics: {
    revenue?: MetricValue;
    ebitda?: MetricValue;
    ebit?: MetricValue;
    pat?: MetricValue;
    netProfit?: MetricValue;
    totalAssets?: MetricValue;
    totalLiabilities?: MetricValue;
    networth?: MetricValue;
    totalDebt?: MetricValue;
    operatingCashFlow?: MetricValue;
    freeCashFlow?: MetricValue;
    peRatio?: MetricValue;
    pbRatio?: MetricValue;
    roe?: MetricValue;
    roce?: MetricValue;
    debtEquity?: MetricValue;
    currentRatio?: MetricValue;
    marginEbitda?: MetricValue;
    marginPat?: MetricValue;
  };
  auditTrail: EnrichmentAuditEntry[];
}

export interface EnrichmentAuditEntry {
  id: string;
  timestamp: Date;
  action: 'fetch' | 'merge' | 'override' | 'validate' | 'block';
  source: DataSource;
  metric?: string;
  previousValue?: number | string | null;
  newValue?: number | string | null;
  confidence?: number;
  actor?: string;
  reason?: string;
  hashPrevious?: string;
  hashCurrent?: string;
}

export interface EnrichmentConfig {
  sourcePriority: DataSource[];
  minConfidenceThreshold: number;
  allowMixedSources: boolean;
  aiAllowed: boolean;
  executionAllowed: boolean;
  requireAuditLog: boolean;
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  // Indian market priority: Probe42 (primary) → MCA → NSE/BSE → Finnhub → Yahoo
  sourcePriority: ['probe42', 'mca', 'nse_bse', 'finnhub', 'yahoo'],
  minConfidenceThreshold: 0.6,
  allowMixedSources: true,
  aiAllowed: true,
  executionAllowed: true,
  requireAuditLog: true,
};

class DataEnrichmentService {
  private config: EnrichmentConfig;

  constructor(config: Partial<EnrichmentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('✅ Data Enrichment Service initialized');
  }

  getSourcePriority(): DataSource[] {
    return [...this.config.sourcePriority];
  }

  updateConfig(updates: Partial<EnrichmentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getSourceConfidence(source: DataSource): number {
    // Indian market confidence scores - Probe42 is primary source for unlisted companies
    const confidenceMap: Record<DataSource, number> = {
      probe42: 0.98,   // Primary source for Indian unlisted companies
      mca: 0.95,       // Ministry of Corporate Affairs - official government source
      nse_bse: 0.90,   // Exchange filings (only for listed/partially listed)
      finnhub: 0.75,   // Limited Indian coverage
      yahoo: 0.65,     // Some Indian stocks via .NS/.BO suffix
      manual: 0.50,    // Manual overrides
    };
    return confidenceMap[source] ?? 0.5;
  }

  async fetchFromNSEBSE(
    companyId: string,
    symbol?: string,
    financialYear?: string
  ): Promise<{
    metrics: Record<string, MetricValue>;
    filingId?: string;
    confidence: number;
  }> {
    const metrics: Record<string, MetricValue> = {};
    
    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');
      
      const pendingFilings = await db.execute(sql`
        SELECT * FROM exchange_filings 
        WHERE processing_status = 'pending'
          AND document_type = 'XBRL'
          AND (fintekpro_company_id = ${companyId} OR symbol = ${symbol || ''})
        ORDER BY filing_date DESC
        LIMIT 5
      `);

      for (const filing of pendingFilings.rows as any[]) {
        console.log(`[DataEnrichment] Processing XBRL filing ${filing.id} for ${companyId}`);
        try {
          const parseResult = await xbrlParserService.parseFromUrl(filing.document_url);
          
          if (parseResult.success) {
            await xbrlParserService.extractAndPersistMetrics(filing.id, companyId, parseResult);
            await exchangeFilingsService.updateFilingStatus(
              filing.id, 
              'completed', 
              undefined, 
              parseResult.overallConfidence
            );
          } else {
            await exchangeFilingsService.updateFilingStatus(
              filing.id, 
              'failed', 
              'XBRL parsing failed - no metrics extracted'
            );
          }
        } catch (parseError: any) {
          console.error(`[DataEnrichment] XBRL parsing error for ${filing.id}: ${parseError.message}`);
          await exchangeFilingsService.updateFilingStatus(
            filing.id, 
            'failed', 
            `Parse error: ${parseError.message?.slice(0, 100)}`
          );
        }
      }
      
      const result = await db.execute(sql`
        SELECT eal.*, ef.document_url
        FROM exchange_financial_audit_log eal
        LEFT JOIN exchange_filings ef ON eal.filing_id = ef.id
        WHERE eal.company_id = ${companyId}
          AND eal.is_approved = true
          AND (${financialYear}::text IS NULL OR eal.financial_year = ${financialYear})
        ORDER BY eal.created_at DESC
      `);

      const rows = result.rows as any[];
      
      for (const row of rows) {
        if (!metrics[row.metric]) {
          metrics[row.metric] = {
            value: parseFloat(row.metric_value) || null,
            source: 'nse_bse',
            retrievedAt: new Date(row.created_at),
            confidenceScore: parseFloat(row.extraction_confidence) || 0.95,
          };
        }
      }

      const filingId = rows[0]?.filing_id;
      const avgConfidence = rows.length > 0
        ? rows.reduce((sum, r) => sum + (parseFloat(r.extraction_confidence) || 0.95), 0) / rows.length
        : 0;

      return { metrics, filingId, confidence: avgConfidence };
    } catch (error: any) {
      console.error(`[DataEnrichment] NSE/BSE fetch error: ${error.message}`);
      return { metrics: {}, confidence: 0 };
    }
  }

  /**
   * Fetch financial data from MCA (Ministry of Corporate Affairs) via Sandbox API
   * Second fallback after Probe42 for Indian unlisted companies
   */
  async fetchFromMCA(
    companyId: string,
    cin?: string
  ): Promise<{
    metrics: Record<string, MetricValue>;
    confidence: number;
  }> {
    const metrics: Record<string, MetricValue> = {};
    const now = new Date();
    
    if (!cin) {
      console.log(`[DataEnrichment] No CIN provided for MCA fetch, skipping`);
      return { metrics: {}, confidence: 0 };
    }

    // Helper to normalize values that may come as strings from API
    const toNumber = (val: any): number => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    try {
      console.log(`[DataEnrichment] Fetching MCA data for CIN: ${cin}`);
      const mcaData = await mcaService.getCompanyByCIN(cin);
      
      if (!mcaData) {
        console.log(`[DataEnrichment] No MCA data found for CIN: ${cin}`);
        return { metrics: {}, confidence: 0 };
      }

      // Extract financial metrics from MCA data
      const confidenceScore = this.getSourceConfidence('mca');
      
      // Normalize capital values (API may return strings)
      const paidUpCapital = toNumber(mcaData.paidUpCapital);
      const authorizedCapital = toNumber(mcaData.authorizedCapital);
      
      // Paid-up capital and authorized capital are key financial indicators
      if (paidUpCapital > 0) {
        metrics['paidUpCapital'] = {
          value: paidUpCapital,
          source: 'mca',
          retrievedAt: now,
          confidenceScore,
        };
      }
      
      if (authorizedCapital > 0) {
        metrics['authorizedCapital'] = {
          value: authorizedCapital,
          source: 'mca',
          retrievedAt: now,
          confidenceScore,
        };
      }

      // Calculate networth proxy from paid-up capital (simplified)
      if (paidUpCapital > 0) {
        metrics['networth'] = {
          value: paidUpCapital,
          source: 'mca',
          retrievedAt: now,
          confidenceScore: confidenceScore * 0.8, // Lower confidence for derived metric
        };
      }

      // Extract debt information from charges if available
      if (mcaData.charges && mcaData.charges.length > 0) {
        const activeCharges = mcaData.charges.filter(c => 
          c.status && c.status.toLowerCase() !== 'closed' && c.status.toLowerCase() !== 'satisfied'
        );
        const totalDebt = activeCharges.reduce((sum, c) => sum + toNumber(c.chargeAmount), 0);
        
        if (totalDebt > 0) {
          metrics['totalDebt'] = {
            value: totalDebt,
            source: 'mca',
            retrievedAt: now,
            confidenceScore: confidenceScore * 0.7, // Lower confidence for charge-based estimate
          };
          
          // Calculate debt-equity ratio
          if (paidUpCapital > 0) {
            metrics['debtEquity'] = {
              value: Number((totalDebt / paidUpCapital).toFixed(2)),
              source: 'mca',
              retrievedAt: now,
              confidenceScore: confidenceScore * 0.6,
            };
          }
        }
      }

      const metricsCount = Object.keys(metrics).length;
      if (metricsCount > 0) {
        console.log(`[DataEnrichment] Fetched ${metricsCount} metrics from MCA for ${cin}`);
      } else {
        console.log(`[DataEnrichment] MCA data found but no usable metrics for ${cin} (capital values may be zero or invalid)`);
      }
      
      return { 
        metrics, 
        confidence: metricsCount > 0 ? confidenceScore : 0 
      };
    } catch (error: any) {
      console.error(`[DataEnrichment] MCA fetch error: ${error.message}`);
      return { metrics: {}, confidence: 0 };
    }
  }

  /**
   * Fetch financial data from Yahoo Finance for Indian stocks
   * Uses .NS (NSE) or .BO (BSE) suffix for Indian market symbols
   */
  async fetchFromYahoo(
    companyId: string,
    symbol?: string,
    isin?: string
  ): Promise<{
    metrics: Record<string, MetricValue>;
    confidence: number;
  }> {
    const metrics: Record<string, MetricValue> = {};
    const now = new Date();
    
    if (!symbol && !isin) {
      console.log(`[DataEnrichment] No symbol or ISIN for Yahoo fetch, skipping`);
      return { metrics: {}, confidence: 0 };
    }

    try {
      const yahooFinance = await import('yahoo-finance2').then(m => m.default);
      
      // Try NSE suffix first, then BSE
      const symbolsToTry = symbol 
        ? [`${symbol}.NS`, `${symbol}.BO`, symbol]
        : [];
      
      let quote: any = null;
      let usedSymbol = '';
      
      for (const sym of symbolsToTry) {
        try {
          console.log(`[DataEnrichment] Trying Yahoo Finance with symbol: ${sym}`);
          quote = await yahooFinance.quote(sym);
          if (quote) {
            usedSymbol = sym;
            break;
          }
        } catch (e: any) {
          console.log(`[DataEnrichment] Yahoo symbol ${sym} not found, trying next...`);
        }
      }

      if (!quote) {
        console.log(`[DataEnrichment] No Yahoo data found for ${symbol}`);
        return { metrics: {}, confidence: 0 };
      }

      const confidenceScore = this.getSourceConfidence('yahoo');

      // Extract available metrics from Yahoo quote
      if (quote.trailingPE) {
        metrics['peRatio'] = {
          value: quote.trailingPE,
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.priceToBook) {
        metrics['pbRatio'] = {
          value: quote.priceToBook,
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.returnOnEquity) {
        metrics['roe'] = {
          value: quote.returnOnEquity * 100, // Convert to percentage
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.debtToEquity) {
        metrics['debtEquity'] = {
          value: quote.debtToEquity,
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.currentRatio) {
        metrics['currentRatio'] = {
          value: quote.currentRatio,
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.profitMargins) {
        metrics['marginPat'] = {
          value: quote.profitMargins * 100, // Convert to percentage
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      if (quote.operatingMargins) {
        metrics['marginEbitda'] = {
          value: quote.operatingMargins * 100, // Convert to percentage
          source: 'yahoo',
          retrievedAt: now,
          confidenceScore,
        };
      }

      // Try to get more detailed financials
      try {
        const quoteSummary = await yahooFinance.quoteSummary(usedSymbol, { 
          modules: ['financialData', 'defaultKeyStatistics'] 
        });
        
        if (quoteSummary?.financialData) {
          const fd = quoteSummary.financialData;
          
          if (fd.totalRevenue) {
            metrics['revenue'] = {
              value: fd.totalRevenue,
              source: 'yahoo',
              retrievedAt: now,
              confidenceScore,
            };
          }
          
          if (fd.ebitda) {
            metrics['ebitda'] = {
              value: fd.ebitda,
              source: 'yahoo',
              retrievedAt: now,
              confidenceScore,
            };
          }
          
          if (fd.freeCashflow) {
            metrics['freeCashFlow'] = {
              value: fd.freeCashflow,
              source: 'yahoo',
              retrievedAt: now,
              confidenceScore,
            };
          }
          
          if (fd.operatingCashflow) {
            metrics['operatingCashFlow'] = {
              value: fd.operatingCashflow,
              source: 'yahoo',
              retrievedAt: now,
              confidenceScore,
            };
          }

          if (fd.totalDebt) {
            metrics['totalDebt'] = {
              value: fd.totalDebt,
              source: 'yahoo',
              retrievedAt: now,
              confidenceScore,
            };
          }
        }
      } catch (summaryError: any) {
        console.log(`[DataEnrichment] Yahoo quoteSummary failed: ${summaryError.message}`);
      }

      console.log(`[DataEnrichment] Fetched ${Object.keys(metrics).length} metrics from Yahoo for ${usedSymbol}`);
      return { 
        metrics, 
        confidence: Object.keys(metrics).length > 0 ? confidenceScore : 0 
      };
    } catch (error: any) {
      console.error(`[DataEnrichment] Yahoo fetch error: ${error.message}`);
      return { metrics: {}, confidence: 0 };
    }
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  async enrichCompanyFinancials(
    companyId: string,
    financialYear: string,
    options: {
      externalSymbols?: {
        finnhub?: string;
        yahoo?: string;
      };
      forceRefresh?: boolean;
      overrideSource?: DataSource;
    } = {}
  ): Promise<EnrichedFinancials> {
    const { storage } = await import('../storage');
    const auditTrail: EnrichmentAuditEntry[] = [];
    const now = new Date();

    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      throw new ExternalServiceError('DataEnrichment', 'Company not found', null, false);
    }

    const confidence = probe42Service.computeIdentityConfidence({
      cin: company.cin,
      isin: company.isin,
      companyName: company.companyName,
      legalName: company.legalName,
      pan: company.pan,
    });

    // Allow admin-triggered fetches (forceRefresh) to bypass identity check when CIN or ISIN is present
    // This enables MCA fallback for companies without Probe42 mapping
    const hasValidIdentifier = !!(company.cin || company.isin);
    const allowBypass = options.forceRefresh && hasValidIdentifier;

    if (!confidence.enrichmentAllowed && !allowBypass) {
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: now,
        action: 'block',
        source: 'probe42',
        reason: confidence.enrichmentBlockReason,
      });

      return {
        companyId,
        financialYear,
        currency: 'INR',
        lastEnrichedAt: now,
        sources: [],
        overallConfidence: 0,
        metrics: {},
        auditTrail,
      };
    }

    if (allowBypass && !confidence.enrichmentAllowed) {
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: now,
        action: 'bypass',
        source: 'admin',
        reason: `Admin-triggered enrichment bypass: CIN=${company.cin || 'N/A'}, ISIN=${company.isin || 'N/A'}`,
      });
    }

    // ISIN→CIN auto-discovery: If ISIN exists but CIN is missing, try to discover CIN
    let discoveredCIN: string | null = null;
    if (!company.cin && company.isin) {
      try {
        console.log(`[DataEnrichment] Attempting ISIN→CIN discovery for ${company.isin}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'mca',
          reason: `Attempting ISIN→CIN discovery via NSDL for ${company.isin}`,
        });

        const cinLookup = await nsdlISINService.lookupCINByISIN(company.isin);
        
        if (cinLookup.cin) {
          discoveredCIN = cinLookup.cin;
          console.log(`[DataEnrichment] Discovered CIN ${discoveredCIN} from ISIN ${company.isin} (via ${cinLookup.source}, confidence: ${cinLookup.confidence})`);
          
          // Persist the discovered CIN to the company record
          await storage.updateUnlistedCompany(companyId, {
            cin: discoveredCIN,
            lastSyncedAt: new Date(),
          });
          
          auditTrail.push({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'fetch',
            source: 'mca',
            confidence: cinLookup.confidence,
            reason: `Discovered and persisted CIN ${discoveredCIN} from ISIN via ${cinLookup.source}`,
          });
        } else {
          // NSDL lookup failed, try MCA name search as fallback
          console.log(`[DataEnrichment] NSDL lookup failed, trying MCA name search for: ${company.companyName || company.name}`);
          
          try {
            const companyName = company.companyName || company.name || '';
            if (companyName && mcaService.isConfigured()) {
              const mcaSearchResults = await mcaService.searchCompanyByName(companyName);
              
              if (mcaSearchResults.length > 0) {
                // Take the best match (first result, highest confidence)
                discoveredCIN = mcaSearchResults[0].cin;
                console.log(`[DataEnrichment] Discovered CIN ${discoveredCIN} via MCA name search for "${companyName}"`);
                
                // Persist the discovered CIN
                await storage.updateUnlistedCompany(companyId, {
                  cin: discoveredCIN,
                  lastSyncedAt: new Date(),
                });
                
                auditTrail.push({
                  id: crypto.randomUUID(),
                  timestamp: new Date(),
                  action: 'fetch',
                  source: 'mca',
                  confidence: 0.7,
                  reason: `Discovered CIN ${discoveredCIN} via MCA name search for "${companyName}"`,
                });
              } else {
                auditTrail.push({
                  id: crypto.randomUUID(),
                  timestamp: new Date(),
                  action: 'fetch',
                  source: 'mca',
                  reason: `ISIN→CIN discovery failed: no matching CIN found for ${company.isin}, MCA name search also returned no results`,
                });
              }
            }
          } catch (mcaSearchError: any) {
            console.log(`[DataEnrichment] MCA name search fallback failed: ${mcaSearchError.message}`);
          }
        }
      } catch (isinError: any) {
        console.error(`[DataEnrichment] ISIN→CIN discovery error: ${isinError.message}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'mca',
          reason: `ISIN→CIN discovery error: ${isinError.message}`,
        });
      }
    }

    // Use discovered CIN or existing CIN for subsequent lookups
    const effectiveCIN = discoveredCIN || company.cin;

    const enriched: EnrichedFinancials = {
      companyId,
      financialYear,
      currency: 'INR',
      lastEnrichedAt: now,
      sources: [],
      overallConfidence: 0,
      metrics: {},
      auditTrail,
    };

    const collectedMetrics: Map<string, MetricValue[]> = new Map();

    // ============================================================
    // INDIAN MARKET FALLBACK CHAIN
    // Priority: Probe42 → MCA → NSE/BSE → Finnhub → Yahoo
    // ============================================================

    // 1. PROBE42 - Primary Source (0.98 confidence)
    // Best source for Indian unlisted companies with comprehensive financials
    if (company.probe42CompanyId) {
      try {
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'probe42',
          reason: 'Fetching primary data from Probe42 (Indian market primary source)',
        });

        const financials = await probe42Service.getCompanyFinancials(company.probe42CompanyId, 1);
        const yearData = financials.find(f => f.financial_year === financialYear) || financials[0];
        
        if (yearData) {
          enriched.sources.push('probe42');
          
          const probe42Metrics: Record<string, number | undefined> = {
            revenue: yearData.revenue,
            ebitda: yearData.ebitda,
            ebit: yearData.ebit,
            pat: yearData.pat,
            netProfit: yearData.net_profit,
            totalAssets: yearData.total_assets,
            totalLiabilities: yearData.total_liabilities,
            networth: yearData.networth,
            totalDebt: yearData.total_debt,
            operatingCashFlow: yearData.operating_cash_flow,
            freeCashFlow: yearData.free_cash_flow,
          };

          for (const [key, value] of Object.entries(probe42Metrics)) {
            if (value !== undefined && value !== null) {
              const existing = collectedMetrics.get(key) || [];
              existing.push({
                value,
                source: 'probe42',
                retrievedAt: now,
                confidenceScore: this.getSourceConfidence('probe42'),
              });
              collectedMetrics.set(key, existing);
            }
          }

          auditTrail.push({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'fetch',
            source: 'probe42',
            confidence: this.getSourceConfidence('probe42'),
            reason: `Fetched ${Object.keys(probe42Metrics).filter(k => probe42Metrics[k] !== undefined).length} metrics from Probe42`,
          });
        }
      } catch (error: any) {
        console.error(`[DataEnrichment] Probe42 fetch failed: ${error.message}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'probe42',
          reason: `Fetch failed: ${error.message}`,
        });
      }
    }

    // 2. MCA - Secondary Source (0.95 confidence)
    // Ministry of Corporate Affairs - official government source for all Indian companies
    if (effectiveCIN) {
      try {
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'mca',
          reason: `Fetching MCA data (Ministry of Corporate Affairs) using CIN: ${effectiveCIN}`,
        });

        const mcaResult = await this.fetchFromMCA(companyId, effectiveCIN);
        
        if (Object.keys(mcaResult.metrics).length > 0) {
          enriched.sources.push('mca');
          
          for (const [key, value] of Object.entries(mcaResult.metrics)) {
            const existing = collectedMetrics.get(key) || [];
            existing.push(value);
            collectedMetrics.set(key, existing);
          }

          auditTrail.push({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'fetch',
            source: 'mca',
            confidence: mcaResult.confidence,
            reason: `Fetched ${Object.keys(mcaResult.metrics).length} metrics from MCA`,
          });
        }
      } catch (error: any) {
        console.error(`[DataEnrichment] MCA fetch failed: ${error.message}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'mca',
          reason: `Fetch failed: ${error.message}`,
        });
      }
    }

    // 3. NSE/BSE - Tertiary Source (0.90 confidence)
    // Exchange filings (only for listed or partially listed companies)
    try {
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'fetch',
        source: 'nse_bse',
        reason: 'Fetching data from NSE/BSE exchange filings',
      });

      const nseBseResult = await this.fetchFromNSEBSE(companyId, company.symbol || undefined, financialYear);
      
      if (Object.keys(nseBseResult.metrics).length > 0) {
        enriched.sources.push('nse_bse');
        
        for (const [key, value] of Object.entries(nseBseResult.metrics)) {
          const existing = collectedMetrics.get(key) || [];
          existing.push(value);
          collectedMetrics.set(key, existing);
        }

        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'nse_bse',
          confidence: nseBseResult.confidence,
          reason: `Fetched ${Object.keys(nseBseResult.metrics).length} metrics from exchange filings`,
        });
      }
    } catch (error: any) {
      console.error(`[DataEnrichment] NSE/BSE fetch failed: ${error.message}`);
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'fetch',
        source: 'nse_bse',
        reason: `Fetch failed: ${error.message}`,
      });
    }

    // 4. FINNHUB - Fourth Source (0.75 confidence)
    // Limited Indian coverage but good for listed stocks with international presence
    if (options.externalSymbols?.finnhub && finnhubService.isReady()) {
      try {
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'finnhub',
          reason: 'Fetching supplementary data from Finnhub',
        });

        const result = await finnhubService.getBasicFinancials(options.externalSymbols.finnhub);
        
        if (result.success && result.data) {
          enriched.sources.push('finnhub');
          
          const finnhubMetrics: Record<string, number | undefined> = {
            peRatio: result.data.metric['peBasicExclExtraTTM'],
            pbRatio: result.data.metric['pbAnnual'],
            roe: result.data.metric['roeTTM'],
            debtEquity: result.data.metric['debtEquityAnnual'],
            currentRatio: result.data.metric['currentRatioAnnual'],
            marginPat: result.data.metric['netProfitMarginTTM'],
            marginEbitda: result.data.metric['operatingMarginTTM'],
          };

          for (const [key, value] of Object.entries(finnhubMetrics)) {
            if (value !== undefined && value !== null) {
              const existing = collectedMetrics.get(key) || [];
              existing.push({
                value,
                source: 'finnhub',
                retrievedAt: now,
                confidenceScore: this.getSourceConfidence('finnhub'),
              });
              collectedMetrics.set(key, existing);
            }
          }

          auditTrail.push({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'fetch',
            source: 'finnhub',
            confidence: this.getSourceConfidence('finnhub'),
            reason: `Fetched ${Object.keys(finnhubMetrics).filter(k => finnhubMetrics[k] !== undefined).length} metrics from Finnhub`,
          });
        }
      } catch (error: any) {
        console.error(`[DataEnrichment] Finnhub fetch failed: ${error.message}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'finnhub',
          reason: `Fetch failed: ${error.message}`,
        });
      }
    }

    // 5. YAHOO FINANCE - Last Resort (0.65 confidence)
    // Uses .NS (NSE) or .BO (BSE) suffix for Indian stocks
    if (company.symbol || options.externalSymbols?.yahoo) {
      try {
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'yahoo',
          reason: 'Fetching fallback data from Yahoo Finance (Indian market .NS/.BO)',
        });

        const yahooSymbol = options.externalSymbols?.yahoo || company.symbol;
        const yahooResult = await this.fetchFromYahoo(companyId, yahooSymbol, company.isin);
        
        if (Object.keys(yahooResult.metrics).length > 0) {
          enriched.sources.push('yahoo');
          
          for (const [key, value] of Object.entries(yahooResult.metrics)) {
            const existing = collectedMetrics.get(key) || [];
            existing.push(value);
            collectedMetrics.set(key, existing);
          }

          auditTrail.push({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'fetch',
            source: 'yahoo',
            confidence: yahooResult.confidence,
            reason: `Fetched ${Object.keys(yahooResult.metrics).length} metrics from Yahoo Finance`,
          });
        }
      } catch (error: any) {
        console.error(`[DataEnrichment] Yahoo fetch failed: ${error.message}`);
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'yahoo',
          reason: `Fetch failed: ${error.message}`,
        });
      }
    }

    // ============================================================
    // MERGE METRICS BY PRIORITY
    // ============================================================
    for (const [metricName, values] of collectedMetrics.entries()) {
      if (values.length === 0) continue;

      values.sort((a, b) => {
        const priorityA = this.config.sourcePriority.indexOf(a.source);
        const priorityB = this.config.sourcePriority.indexOf(b.source);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return b.confidenceScore - a.confidenceScore;
      });

      const best = values[0];
      
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'merge',
        source: best.source,
        metric: metricName,
        newValue: best.value,
        confidence: best.confidenceScore,
        reason: values.length > 1 
          ? `Selected from ${values.length} sources based on priority` 
          : 'Single source available',
      });

      (enriched.metrics as any)[metricName] = best;
    }

    const metricConfidences = Object.values(enriched.metrics)
      .filter((m): m is MetricValue => m !== undefined)
      .map(m => m.confidenceScore);
    
    enriched.overallConfidence = metricConfidences.length > 0
      ? Number((metricConfidences.reduce((a, b) => a + b, 0) / metricConfidences.length).toFixed(2))
      : 0;

    await this.persistAuditLog(companyId, financialYear, auditTrail);

    console.log(`[DataEnrichment] Enriched ${companyId} with ${Object.keys(enriched.metrics).length} metrics from ${enriched.sources.join(', ')}`);

    return enriched;
  }

  private async persistAuditLog(
    companyId: string,
    financialYear: string,
    entries: EnrichmentAuditEntry[]
  ): Promise<void> {
    if (!this.config.requireAuditLog || entries.length === 0) return;

    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      let previousHash: string | null = null;

      for (const entry of entries) {
        const currentHash = this.generateHash({ ...entry, hashPrevious: previousHash });
        
        await db.execute(sql`
          INSERT INTO financial_audit_log (
            id, company_id, metric, metric_value, financial_year,
            source, action_type, action_reason, confidence_score,
            hash_previous, hash_current, created_at
          ) VALUES (
            ${entry.id}, ${companyId}, ${entry.metric || 'system'},
            ${entry.newValue?.toString() || null}, ${financialYear},
            ${entry.source}, ${entry.action}, ${entry.reason || null},
            ${entry.confidence?.toString() || null},
            ${previousHash}, ${currentHash}, ${entry.timestamp.toISOString()}
          )
        `);

        previousHash = currentHash;
      }

      console.log(`[DataEnrichment] Persisted ${entries.length} audit entries for ${companyId}`);
    } catch (error: any) {
      console.error(`[DataEnrichment] Failed to persist audit log: ${error.message}`);
    }
  }

  async getMetricProvenance(
    companyId: string,
    metric: string,
    financialYear?: string
  ): Promise<{
    metric: string;
    currentValue?: MetricValue;
    history: Array<{
      value: number | string | null;
      source: DataSource;
      timestamp: Date;
      action: string;
      actor?: string;
      reason?: string;
    }>;
    sourceBreakdown: Array<{
      source: DataSource;
      confidence: number;
      lastFetched?: Date;
      fetchCount: number;
    }>;
  }> {
    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      const yearCondition = financialYear 
        ? sql`AND financial_year = ${financialYear}` 
        : sql``;

      const result = await db.execute(sql`
        SELECT * FROM financial_audit_log 
        WHERE company_id = ${companyId} 
        AND metric = ${metric}
        ${yearCondition}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      const rows = result.rows as any[];

      const history = rows.map(row => ({
        value: row.metric_value,
        source: row.source as DataSource,
        timestamp: new Date(row.created_at),
        action: row.action_type,
        actor: row.action_by,
        reason: row.action_reason,
      }));

      const sourceMap = new Map<DataSource, { confidence: number; lastFetched?: Date; fetchCount: number }>();
      for (const row of rows) {
        const source = row.source as DataSource;
        const existing = sourceMap.get(source) || { confidence: 0, fetchCount: 0 };
        existing.fetchCount++;
        existing.confidence = Math.max(existing.confidence, parseFloat(row.confidence_score) || 0);
        if (!existing.lastFetched || new Date(row.created_at) > existing.lastFetched) {
          existing.lastFetched = new Date(row.created_at);
        }
        sourceMap.set(source, existing);
      }

      return {
        metric,
        currentValue: history[0] ? {
          value: history[0].value,
          source: history[0].source,
          retrievedAt: history[0].timestamp,
          confidenceScore: this.getSourceConfidence(history[0].source),
        } : undefined,
        history,
        sourceBreakdown: Array.from(sourceMap.entries()).map(([source, data]) => ({
          source,
          ...data,
        })),
      };
    } catch (error: any) {
      console.error(`[DataEnrichment] Provenance query failed: ${error.message}`);
      return {
        metric,
        history: [],
        sourceBreakdown: [],
      };
    }
  }

  async getDataUsageFlags(companyId: string, financialYear: string): Promise<{
    aiAllowed: boolean;
    executionAllowed: boolean;
    lockedForAdvisory: boolean;
    dataQualityScore: number;
    confidenceScore: number;
    blockReasons: string[];
  }> {
    const { storage } = await import('../storage');
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return {
        aiAllowed: false,
        executionAllowed: false,
        lockedForAdvisory: true,
        dataQualityScore: 0,
        confidenceScore: 0,
        blockReasons: ['Company not found'],
      };
    }

    const confidence = probe42Service.computeIdentityConfidence({
      cin: company.cin,
      isin: company.isin,
      companyName: company.companyName,
      legalName: company.legalName,
      pan: company.pan,
    });

    const blockReasons: string[] = [];

    if (confidence.score < 0.6) {
      blockReasons.push('Identity confidence below 60%');
    }

    if (confidence.score < 0.8) {
      blockReasons.push('Identity confidence below 80% - execution blocked');
    }

    const financials = await storage.getCompanyFinancialsByYear(companyId, financialYear);
    const dataQualityScore = financials?.dataQualityScore || 0;

    if (dataQualityScore < 50) {
      blockReasons.push('Data quality score below 50%');
    }

    return {
      aiAllowed: confidence.score >= 0.6 && dataQualityScore >= 30,
      executionAllowed: confidence.score >= 0.8 && dataQualityScore >= 50 && blockReasons.length === 0,
      lockedForAdvisory: blockReasons.length > 0,
      dataQualityScore,
      confidenceScore: confidence.score,
      blockReasons,
    };
  }
}

export const dataEnrichmentService = new DataEnrichmentService();
