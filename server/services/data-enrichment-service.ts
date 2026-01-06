/**
 * Data Enrichment Orchestrator Service
 * Handles multi-source financial data enrichment with:
 * - Priority-based source selection (Probe42 > Finnhub > Yahoo)
 * - Metric-level source merging
 * - SEBI-compliant audit logging
 * - AI guardrails for data usage
 */

import { probe42Service } from './probe42-service';
import { finnhubService } from './finnhub-service';
import { exchangeFilingsService } from './exchange-filings-service';
import { xbrlParserService } from './xbrl-parser-service';
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
  sourcePriority: ['nse_bse', 'probe42', 'finnhub', 'yahoo'],
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
    const confidenceMap: Record<DataSource, number> = {
      nse_bse: 0.98,
      probe42: 0.95,
      mca: 0.90,
      finnhub: 0.75,
      yahoo: 0.65,
      manual: 0.50,
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
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    const metrics: Record<string, MetricValue> = {};
    
    try {
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

    if (!confidence.enrichmentAllowed) {
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

    // NSE/BSE - Highest Priority Source (0.98 confidence)
    try {
      auditTrail.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'fetch',
        source: 'nse_bse',
        reason: 'Fetching authoritative data from NSE/BSE exchange filings',
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

    // Probe42 - Second Priority
    if (company.probe42CompanyId) {
      try {
        auditTrail.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'fetch',
          source: 'probe42',
          reason: 'Fetching primary data from Probe42',
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
        }
      } catch (error: any) {
        console.error(`[DataEnrichment] Finnhub fetch failed: ${error.message}`);
      }
    }

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
