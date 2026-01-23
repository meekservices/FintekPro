/**
 * MCA Financial Data Auto-Refresh Scheduler
 * 
 * Monitors for new MCA filings and triggers automatic financial data refresh.
 * Runs daily to check for companies with new filings that need financial data updates.
 */

import { db } from '../db';
import { eq, desc, and, sql, isNull, gte, lt, or } from 'drizzle-orm';
import {
  mcaCompanyMaster,
  mcaFilingTracker,
  mcaFinancialSnapshot,
  companyFinancials,
  unlistedCompanies,
} from '@shared/schema';
import { mcaFinancialBackfillService } from './mca-financial-backfill-service';

interface RefreshJob {
  cin: string;
  companyName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface RefreshResult {
  jobsProcessed: number;
  jobsSuccessful: number;
  jobsFailed: number;
  details: Array<{
    cin: string;
    companyName: string;
    success: boolean;
    yearsUpdated: number;
    error?: string;
  }>;
}

class McaFinancialRefreshScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private refreshIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    console.log('✅ MCA Financial Refresh Scheduler initialized');
  }

  start(): void {
    if (this.intervalId) {
      console.log('[MCA Refresh] Scheduler already running');
      return;
    }

    console.log('[MCA Refresh] Starting daily financial data refresh scheduler...');
    
    this.intervalId = setInterval(() => {
      this.runRefreshCycle();
    }, this.refreshIntervalMs);

    setTimeout(() => {
      this.runRefreshCycle();
    }, 5 * 60 * 1000);

    console.log('[MCA Refresh] Scheduler started - runs every 24 hours');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MCA Refresh] Scheduler stopped');
    }
  }

  async runRefreshCycle(): Promise<RefreshResult> {
    if (this.isRunning) {
      console.log('[MCA Refresh] Refresh cycle already in progress, skipping...');
      return { jobsProcessed: 0, jobsSuccessful: 0, jobsFailed: 0, details: [] };
    }

    this.isRunning = true;
    console.log('[MCA Refresh] Starting financial data refresh cycle...');

    const result: RefreshResult = {
      jobsProcessed: 0,
      jobsSuccessful: 0,
      jobsFailed: 0,
      details: [],
    };

    try {
      const jobs = await this.identifyRefreshJobs();
      console.log(`[MCA Refresh] Found ${jobs.length} companies needing refresh`);

      for (const job of jobs) {
        result.jobsProcessed++;
        
        try {
          const backfillResult = await mcaFinancialBackfillService.backfillFromCompanyFinancials(
            job.cin,
            'auto_refresh_scheduler'
          );

          if (backfillResult.yearsUpdated > 0) {
            result.jobsSuccessful++;
            result.details.push({
              cin: job.cin,
              companyName: job.companyName,
              success: true,
              yearsUpdated: backfillResult.yearsUpdated,
            });
          } else {
            result.jobsFailed++;
            result.details.push({
              cin: job.cin,
              companyName: job.companyName,
              success: false,
              yearsUpdated: 0,
              error: backfillResult.errors[0] || 'No data available',
            });
          }
        } catch (error: any) {
          result.jobsFailed++;
          result.details.push({
            cin: job.cin,
            companyName: job.companyName,
            success: false,
            yearsUpdated: 0,
            error: error.message,
          });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[MCA Refresh] Cycle complete: ${result.jobsSuccessful}/${result.jobsProcessed} successful`);
      
      // Also refresh stale companies that haven't been updated in 90+ days
      await this.refreshStaleCompaniesFromApi();
      
    } catch (error: any) {
      console.error('[MCA Refresh] Error during refresh cycle:', error.message);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Refresh companies with stale data (>90 days old) from Sandbox.co.in API
   * This enriches the database with fresh data for companies that haven't been updated recently
   */
  private async refreshStaleCompaniesFromApi(): Promise<void> {
    try {
      console.log('[MCA Refresh] Checking for stale companies needing API enrichment...');
      
      const { mcaIntelligenceService } = await import('./mca-intelligence-service');
      const staleResult = await mcaIntelligenceService.refreshStaleCompanies({
        maxAgeDays: 90,
        limit: 20, // Process up to 20 stale companies per cycle
        onlyUnlisted: true,
      });

      if (staleResult.companiesRefreshed > 0) {
        console.log(`[MCA Refresh] Enriched ${staleResult.companiesRefreshed}/${staleResult.companiesChecked} stale companies from API`);
      } else if (staleResult.companiesChecked === 0) {
        console.log('[MCA Refresh] No stale companies found');
      } else {
        console.log(`[MCA Refresh] Failed to enrich stale companies: ${staleResult.errors.slice(0, 3).join(', ')}`);
      }
    } catch (error: any) {
      console.error('[MCA Refresh] Error refreshing stale companies:', error.message);
    }
  }

  private async identifyRefreshJobs(): Promise<RefreshJob[]> {
    const jobs: RefreshJob[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentFilings = await db
      .select({
        cin: mcaFilingTracker.cin,
        formType: mcaFilingTracker.formType,
        filingDate: mcaFilingTracker.filingDate,
      })
      .from(mcaFilingTracker)
      .where(
        and(
          gte(mcaFilingTracker.filingDate, thirtyDaysAgo.toISOString().split('T')[0]),
          or(
            eq(mcaFilingTracker.formType, 'AOC-4'),
            eq(mcaFilingTracker.formType, 'AOC-4 CFS'),
            eq(mcaFilingTracker.formType, 'AOC-4 XBRL')
          )
        )
      )
      .limit(50);

    for (const filing of recentFilings) {
      const [company] = await db
        .select()
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.cin, filing.cin))
        .limit(1);

      if (company) {
        const existingSnapshot = await db
          .select()
          .from(mcaFinancialSnapshot)
          .where(eq(mcaFinancialSnapshot.cin, filing.cin))
          .limit(1);

        if (existingSnapshot.length === 0) {
          jobs.push({
            cin: filing.cin,
            companyName: company.companyName,
            reason: `New ${filing.formType} filing on ${filing.filingDate}`,
            priority: 'high',
          });
        }
      }
    }

    const companiesWithStaleData = await db.execute(sql`
      SELECT DISTINCT cm.cin, cm.company_name
      FROM mca_company_master cm
      LEFT JOIN mca_financial_snapshot fs ON cm.cin = fs.cin
      WHERE fs.id IS NULL
      AND cm.company_status = 'Active'
      LIMIT 20
    `);

    for (const row of companiesWithStaleData.rows as any[]) {
      if (!jobs.find(j => j.cin === row.cin)) {
        jobs.push({
          cin: row.cin,
          companyName: row.company_name,
          reason: 'No financial data available',
          priority: 'medium',
        });
      }
    }

    const lowCoverageCompanies = await db.execute(sql`
      SELECT DISTINCT fs.cin, cm.company_name, 
             AVG(COALESCE(fs.data_completeness, 0)) as avg_completeness
      FROM mca_financial_snapshot fs
      JOIN mca_company_master cm ON fs.cin = cm.cin
      GROUP BY fs.cin, cm.company_name
      HAVING AVG(COALESCE(fs.data_completeness, 0)) < 30
      ORDER BY avg_completeness ASC
      LIMIT 10
    `);

    for (const row of lowCoverageCompanies.rows as any[]) {
      if (!jobs.find(j => j.cin === row.cin)) {
        jobs.push({
          cin: row.cin,
          companyName: row.company_name,
          reason: `Low data coverage (${Math.round(row.avg_completeness)}%)`,
          priority: 'low',
        });
      }
    }

    return jobs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getSchedulerStatus(): Promise<{
    isRunning: boolean;
    lastRunAt?: string;
    nextRunAt?: string;
    pendingJobs: number;
  }> {
    const jobs = await this.identifyRefreshJobs();
    
    return {
      isRunning: this.isRunning,
      pendingJobs: jobs.length,
    };
  }

  async triggerManualRefresh(cins?: string[]): Promise<RefreshResult> {
    if (this.isRunning) {
      throw new Error('Refresh already in progress');
    }

    if (cins && cins.length > 0) {
      const result: RefreshResult = {
        jobsProcessed: 0,
        jobsSuccessful: 0,
        jobsFailed: 0,
        details: [],
      };

      for (const cin of cins) {
        result.jobsProcessed++;
        
        try {
          const backfillResult = await mcaFinancialBackfillService.backfillFromCompanyFinancials(
            cin,
            'manual_trigger'
          );

          if (backfillResult.yearsUpdated > 0) {
            result.jobsSuccessful++;
            result.details.push({
              cin,
              companyName: backfillResult.companyName || cin,
              success: true,
              yearsUpdated: backfillResult.yearsUpdated,
            });
          } else {
            result.jobsFailed++;
            result.details.push({
              cin,
              companyName: backfillResult.companyName || cin,
              success: false,
              yearsUpdated: 0,
              error: backfillResult.errors[0] || 'No data available',
            });
          }
        } catch (error: any) {
          result.jobsFailed++;
          result.details.push({
            cin,
            companyName: cin,
            success: false,
            yearsUpdated: 0,
            error: error.message,
          });
        }
      }

      return result;
    }

    return this.runRefreshCycle();
  }
}

export const mcaFinancialRefreshScheduler = new McaFinancialRefreshScheduler();
