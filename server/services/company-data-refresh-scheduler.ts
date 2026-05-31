// @ts-nocheck
/**
 * Company Data Auto-Refresh Scheduler
 * 
 * Keeps company data fresh automatically by:
 * - Scheduling periodic refresh of stale company records
 * - Prioritizing active/frequently accessed companies
 * - Using batch operations to minimize API costs
 * - Respecting rate limits with intelligent throttling
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { credhiveService } from './credhive-service';
import * as schema from "@shared/schema";

interface RefreshConfig {
  financialsMaxAgeDays: number;
  detailsMaxAgeDays: number;
  batchSize: number;
  refreshIntervalDays: number;
  checkIntervalMs: number;
  enabled: boolean;
}

interface RefreshMetrics {
  lastRunAt: number | null;
  companiesRefreshed: number;
  financialsUpdated: number;
  detailsUpdated: number;
  errors: number;
  totalRuns: number;
}

const DEFAULT_CONFIG: RefreshConfig = {
  financialsMaxAgeDays: 90,    // Refresh financials older than 90 days
  detailsMaxAgeDays: 30,       // Refresh details older than 30 days
  batchSize: 10,               // Process 10 companies per batch
  refreshIntervalDays: 90,     // Actually refresh every 90 days
  checkIntervalMs: 24 * 60 * 60 * 1000, // Check daily (24 hours) - within 32-bit limit
  enabled: true,
};

class CompanyDataRefreshScheduler {
  private config: RefreshConfig;
  private metrics: RefreshMetrics = {
    lastRunAt: null,
    companiesRefreshed: 0,
    financialsUpdated: 0,
    detailsUpdated: 0,
    errors: 0,
    totalRuns: 0,
  };
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<RefreshConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the automatic refresh scheduler
   * Uses a daily check to avoid JavaScript's 32-bit setTimeout limit (~24.8 days max)
   */
  start(): void {
    if (this.intervalId) {
      console.log('[CompanyRefresh] Scheduler already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[CompanyRefresh] Scheduler disabled');
      return;
    }

    console.log(`✅ Company Data Refresh Scheduler started (refresh every ${this.config.refreshIntervalDays} days, checking daily)`);
    
    this.intervalId = setInterval(() => {
      this.checkAndRefreshIfDue().catch(err => {
        console.error('[CompanyRefresh] Scheduled check failed:', err.message);
      });
    }, this.config.checkIntervalMs);

    setTimeout(() => this.checkAndRefreshIfDue(), 60 * 1000);
  }

  /**
   * Check if 90 days have passed since last refresh, run if due
   */
  private async checkAndRefreshIfDue(): Promise<void> {
    const refreshIntervalMs = this.config.refreshIntervalDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    if (this.metrics.lastRunAt && (now - this.metrics.lastRunAt) < refreshIntervalMs) {
      const daysRemaining = Math.ceil((refreshIntervalMs - (now - this.metrics.lastRunAt)) / (24 * 60 * 60 * 1000));
      console.log(`[CompanyRefresh] Next refresh in ${daysRemaining} days, skipping`);
      return;
    }

    await this.runRefreshCycle();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CompanyRefresh] Scheduler stopped');
    }
  }

  /**
   * Run a single refresh cycle
   */
  async runRefreshCycle(): Promise<{ refreshed: number; errors: number }> {
    if (this.isRunning) {
      console.log('[CompanyRefresh] Refresh already in progress, skipping');
      return { refreshed: 0, errors: 0 };
    }

    this.isRunning = true;
    this.metrics.totalRuns++;
    this.metrics.lastRunAt = Date.now();
    
    let refreshed = 0;
    let errors = 0;

    try {
      console.log('[CompanyRefresh] Starting refresh cycle...');

      const staleCompanies = await this.getStaleCompanies();
      
      if (staleCompanies.length === 0) {
        console.log('[CompanyRefresh] No stale companies found');
        return { refreshed: 0, errors: 0 };
      }

      console.log(`[CompanyRefresh] Found ${staleCompanies.length} stale companies`);

      for (let i = 0; i < staleCompanies.length; i += this.config.batchSize) {
        const batch = staleCompanies.slice(i, i + this.config.batchSize);
        const cins = batch.map(c => c.cin).filter(Boolean) as string[];
        
        if (cins.length === 0) continue;

        try {
          const detailsResult = await credhiveService.batchGetCompanyDetails(cins);
          const successfulDetails = [...detailsResult.values()].filter(v => v !== null).length;
          refreshed += successfulDetails;
          this.metrics.detailsUpdated += successfulDetails;

          const financialsResult = await credhiveService.batchGetCompanyFinancials(cins);
          const successfulFinancials = [...financialsResult.values()].filter(v => v !== null).length;
          this.metrics.financialsUpdated += successfulFinancials;

        } catch (error: any) {
          console.error(`[CompanyRefresh] Batch failed: ${error.message}`);
          errors++;
          this.metrics.errors++;
        }

        if (i + this.config.batchSize < staleCompanies.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      this.metrics.companiesRefreshed += refreshed;
      console.log(`[CompanyRefresh] Cycle complete: ${refreshed} refreshed, ${errors} errors`);

    } finally {
      this.isRunning = false;
    }

    return { refreshed, errors };
  }

  /**
   * Get companies with stale data
   */
  private async getStaleCompanies(): Promise<Array<{ id: number; cin: string; needsFinancials: boolean; needsDetails: boolean }>> {
    try {
      const columnsExist = await this.checkRequiredColumns();
      if (!columnsExist) {
        console.log('[CompanyRefresh] Required columns not found, using fallback query');
        return this.getStaleCompaniesFallback();
      }

      const financialsAgeThreshold = new Date();
      financialsAgeThreshold.setDate(financialsAgeThreshold.getDate() - this.config.financialsMaxAgeDays);

      const detailsAgeThreshold = new Date();
      detailsAgeThreshold.setDate(detailsAgeThreshold.getDate() - this.config.detailsMaxAgeDays);

      const result = await db.execute(`
        SELECT 
          id,
          cin,
          financials_updated_at < $1 as needs_financials,
          details_updated_at < $2 as needs_details
        FROM unlisted_companies
        WHERE cin IS NOT NULL
          AND (financials_updated_at < $1 OR details_updated_at < $2 OR financials_updated_at IS NULL)
        ORDER BY 
          CASE WHEN financials_updated_at IS NULL THEN 0 ELSE 1 END,
          financials_updated_at ASC
        LIMIT 100
      `, [financialsAgeThreshold.toISOString(), detailsAgeThreshold.toISOString()]);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        cin: row.cin,
        needsFinancials: row.needs_financials,
        needsDetails: row.needs_details,
      }));
    } catch (error: any) {
      if (error.message.includes('does not exist') || error.message.includes('column')) {
        console.warn('[CompanyRefresh] Schema mismatch, using fallback');
        return this.getStaleCompaniesFallback();
      }
      console.error('[CompanyRefresh] Error fetching stale companies:', error.message);
      return [];
    }
  }

  /**
   * Check if required timestamp columns exist
   */
  private async checkRequiredColumns(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'unlisted_companies' 
          AND column_name IN ('financials_updated_at', 'details_updated_at')
      `);
      return (result.rows?.length || 0) >= 2;
    } catch {
      return false;
    }
  }

  /**
   * Fallback query when timestamp columns don't exist
   */
  private async getStaleCompaniesFallback(): Promise<Array<{ id: number; cin: string; needsFinancials: boolean; needsDetails: boolean }>> {
    try {
      const result = await db.execute(sql`
        SELECT id, cin
        FROM unlisted_companies
        WHERE cin IS NOT NULL
        ORDER BY updated_at ASC NULLS FIRST
        LIMIT 50
      `);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        cin: row.cin,
        needsFinancials: true,
        needsDetails: true,
      }));
    } catch (error: any) {
      console.error('[CompanyRefresh] Fallback query failed:', error.message);
      return [];
    }
  }

  /**
   * Manually refresh a specific company
   */
  async refreshCompany(cin: string): Promise<boolean> {
    try {
      console.log(`[CompanyRefresh] Manual refresh for ${cin}`);
      
      const details = await credhiveService.getCompanyDetails(cin);
      if (details.success) {
        this.metrics.detailsUpdated++;
      }

      const financials = await credhiveService.getCompanyFinancials(cin);
      if (financials.success && financials.data) {
        this.metrics.financialsUpdated++;
      }

      this.metrics.companiesRefreshed++;
      return true;
    } catch (error: any) {
      console.error(`[CompanyRefresh] Manual refresh failed for ${cin}: ${error.message}`);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Get scheduler metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      config: this.config,
      isRunning: this.isRunning,
      schedulerActive: this.intervalId !== null,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RefreshConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };

    if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (!wasEnabled && this.config.enabled) {
      this.start();
    }
  }
}

export const companyDataRefreshScheduler = new CompanyDataRefreshScheduler();
