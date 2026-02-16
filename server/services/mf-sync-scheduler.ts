import axios from 'axios';
import { db } from '../db';
import { mutualFunds, schemeRenameLog } from '@shared/schema';
import { eq, sql, lt } from 'drizzle-orm';

interface AMFIFund {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  nav: string;
  navDate: string;
  isinDiv: string;
  isinGrowth: string;
}

class MFSyncScheduler {
  private syncIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
  private navRefreshIntervalMs = 24 * 60 * 60 * 1000; // 24 hours (once daily, same as stocks)
  private isRunning = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private navTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log('✅ MF Sync Scheduler initialized');
  }

  start(): void {
    if (this.isRunning) {
      console.log('[MF Sync] Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('[MF Sync] Starting mutual fund sync scheduler...');
    
    // Schedule daily AMFI master sync (runs at 6 AM IST)
    this.scheduleNextAMFISync();
    
    // Schedule NAV refresh once daily (same as stocks)
    this.scheduleNAVRefresh();
    
    // Run startup catch-up in background (don't block server startup)
    setTimeout(async () => {
      try {
        await this.runStartupCatchUp();
      } catch (error) {
        console.error('[MF Sync] Startup catch-up failed:', error);
      }
    }, 10000); // Wait 10 seconds after server starts
    
    console.log('[MF Sync] Scheduler started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.navTimer) {
      clearTimeout(this.navTimer);
      this.navTimer = null;
    }
    console.log('[MF Sync] Scheduler stopped');
  }

  private scheduleNextAMFISync(): void {
    // Calculate time until 6 AM IST tomorrow
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const nowIST = new Date(now.getTime() + istOffset);
    
    const next6AM = new Date(nowIST);
    next6AM.setHours(6, 0, 0, 0);
    if (nowIST.getHours() >= 6) {
      next6AM.setDate(next6AM.getDate() + 1);
    }
    
    const msUntilNext = next6AM.getTime() - nowIST.getTime();
    
    console.log(`[MF Sync] Next AMFI sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`);
    
    this.syncTimer = setTimeout(async () => {
      await this.runAMFIMasterSync();
      this.scheduleNextAMFISync(); // Schedule next run
    }, msUntilNext);
  }

  private scheduleNAVRefresh(): void {
    this.navTimer = setInterval(async () => {
      await this.runNAVRefresh();
    }, this.navRefreshIntervalMs);
  }

  async runAMFIMasterSync(): Promise<{ updated: number; added: number; errors: number }> {
    console.log('[MF Sync] Starting AMFI master sync...');
    const startTime = Date.now();
    let updated = 0;
    let added = 0;
    let errors = 0;
    let renamed = 0;

    try {
      // Fetch AMFI master data
      const response = await axios.get('https://www.amfiindia.com/spages/NAVAll.txt', {
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const funds = this.parseAMFIData(response.data);
      console.log(`[MF Sync] Parsed ${funds.length} funds from AMFI`);

      // Batch upsert
      const batchSize = 100;
      for (let i = 0; i < funds.length; i += batchSize) {
        const batch = funds.slice(i, i + batchSize);
        
        for (const fund of batch) {
          try {
            // Check if exists
            const existing = await db.select()
              .from(mutualFunds)
              .where(eq(mutualFunds.schemeCode, fund.schemeCode))
              .limit(1);

            const now = new Date();
            const optionType = this.detectOptionType(fund.schemeName);
            const planType = this.detectPlanType(fund.schemeName);

            const isinGrowth = fund.isinGrowth || null;
            const isinDiv = fund.isinDiv || null;
            const primaryIsin = isinGrowth || isinDiv || null;

            if (existing.length > 0) {
              const existingFund = existing[0];
              if (existingFund.schemeName && existingFund.schemeName !== fund.schemeName) {
                try {
                  await db.insert(schemeRenameLog).values({
                    isin: primaryIsin,
                    schemeCode: fund.schemeCode,
                    oldName: existingFund.schemeName,
                    newName: fund.schemeName,
                    syncSource: 'AMFI'
                  });
                  renamed++;
                  if (renamed <= 10) {
                    console.log(`[MF Sync] Rename detected: "${existingFund.schemeName}" → "${fund.schemeName}" (${fund.schemeCode})`);
                  }
                } catch (renameErr) {
                  // Non-critical, continue sync
                }
              }

              await db.update(mutualFunds)
                .set({
                  schemeName: fund.schemeName,
                  fundHouse: fund.fundHouse,
                  nav: fund.nav,
                  amfiCode: fund.schemeCode,
                  isin: primaryIsin,
                  isinGrowth: isinGrowth,
                  isinDividendPayout: isinDiv,
                  optionType,
                  planType,
                  schemeStatus: 'active',
                  lastVerifiedAt: now,
                  dataSource: 'AMFI',
                  lastUpdated: now
                })
                .where(eq(mutualFunds.schemeCode, fund.schemeCode));
              updated++;
            } else {
              await db.insert(mutualFunds)
                .values({
                  schemeCode: fund.schemeCode,
                  schemeName: fund.schemeName,
                  fundHouse: fund.fundHouse,
                  nav: fund.nav,
                  amfiCode: fund.schemeCode,
                  isin: primaryIsin,
                  isinGrowth: isinGrowth,
                  isinDividendPayout: isinDiv,
                  optionType,
                  planType,
                  schemeStatus: 'active',
                  lastVerifiedAt: now,
                  dataSource: 'AMFI',
                  lastUpdated: now
                });
              added++;
            }
          } catch (err) {
            errors++;
            if (errors < 5) {
              console.warn(`[MF Sync] Error upserting fund ${fund.schemeCode}:`, err);
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[MF Sync] AMFI sync complete in ${duration}ms: ${updated} updated, ${added} added, ${renamed} renames detected, ${errors} errors`);

      // Mark schemes not in AMFI as potentially wound up
      await this.markStaleSchemes();

    } catch (error) {
      console.error('[MF Sync] AMFI master sync failed:', error);
    }

    return { updated, added, errors };
  }

  async runNAVRefresh(batchSize: number = 500): Promise<{ updated: number; errors: number }> {
    console.log(`[MF Sync] Starting NAV refresh (batch size: ${batchSize})...`);
    let updated = 0;
    let errors = 0;

    try {
      const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      // Prioritize funds with NULL last_verified_at first (never verified)
      const nullVerifiedFunds = await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} IS NULL`)
        .limit(Math.floor(batchSize / 2));
      
      // Then get stale funds (verified but outdated)
      const remainingSlots = batchSize - nullVerifiedFunds.length;
      const staleFunds = remainingSlots > 0 ? await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} < ${staleThreshold} AND ${mutualFunds.lastVerifiedAt} IS NOT NULL`)
        .limit(remainingSlots) : [];
      
      const allFundsToRefresh = [...nullVerifiedFunds, ...staleFunds];
      console.log(`[MF Sync] Processing ${nullVerifiedFunds.length} unverified + ${staleFunds.length} stale funds`);

      for (const fund of allFundsToRefresh) {
        try {
          const navData = await this.fetchNAVFromMFAPI(fund.schemeCode);
          if (navData) {
            const now = new Date();
            await db.update(mutualFunds)
              .set({
                nav: navData.nav,
                lastVerifiedAt: now,
                dataSource: 'MFAPI',
                lastUpdated: now,
                extendedData: sql`jsonb_set(COALESCE(${mutualFunds.extendedData}, '{}'::jsonb), '{navDate}', ${JSON.stringify(navData.navDate || now.toISOString().split('T')[0])}::jsonb)`
              })
              .where(eq(mutualFunds.schemeCode, fund.schemeCode));
            updated++;
          }
        } catch (err) {
          errors++;
        }
      }

      console.log(`[MF Sync] NAV refresh complete: ${updated} updated, ${errors} errors`);
    } catch (error) {
      console.error('[MF Sync] NAV refresh failed:', error);
    }

    return { updated, errors };
  }
  
  async runStartupCatchUp(): Promise<{ updated: number; errors: number }> {
    console.log('[MF Sync] Running startup catch-up for stale funds...');
    
    // Use consistent 24-hour threshold for "stale" definition
    const staleThreshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(sql`${mutualFunds.lastVerifiedAt} IS NULL OR ${mutualFunds.lastVerifiedAt} < ${staleThreshold24h}`);
    
    const staleFundCount = Number(countResult?.count || 0);
    console.log(`[MF Sync] Found ${staleFundCount} funds needing refresh (>24h stale or unverified)`);
    
    if (staleFundCount === 0) {
      return { updated: 0, errors: 0 };
    }
    
    // Process all stale funds in background batches
    let totalUpdated = 0;
    let totalErrors = 0;
    const batchSize = 500;
    let processedSoFar = 0;
    const maxIterations = Math.ceil(staleFundCount / batchSize) + 5; // Safety limit
    
    for (let i = 0; i < maxIterations; i++) {
      // Check remaining stale count
      const [remaining] = await db.select({ count: sql<number>`count(*)` })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} IS NULL OR ${mutualFunds.lastVerifiedAt} < ${staleThreshold24h}`);
      
      const remainingCount = Number(remaining?.count || 0);
      if (remainingCount === 0) {
        console.log(`[MF Sync] All stale funds processed!`);
        break;
      }
      
      const result = await this.runNAVRefreshBatch(batchSize, staleThreshold24h);
      totalUpdated += result.updated;
      totalErrors += result.errors;
      processedSoFar += result.updated + result.errors;
      
      console.log(`[MF Sync] Batch ${i + 1}: ${result.updated} updated, ${remainingCount - result.updated} remaining`);
      
      // Delay between batches to respect rate limits
      if (remainingCount > batchSize) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Break if no progress made (all errors)
      if (result.updated === 0 && result.errors > 0) {
        console.log(`[MF Sync] Stopping catch-up: no progress made in last batch`);
        break;
      }
    }
    
    console.log(`[MF Sync] Startup catch-up complete: ${totalUpdated} updated, ${totalErrors} errors`);
    return { updated: totalUpdated, errors: totalErrors };
  }
  
  private async runNAVRefreshBatch(batchSize: number, staleThreshold: Date): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;
    
    try {
      // Get oldest unverified funds first (NULL last_verified_at)
      const nullVerifiedFunds = await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} IS NULL`)
        .orderBy(sql`${mutualFunds.schemeCode} ASC`)
        .limit(Math.floor(batchSize / 2));
      
      // Then get oldest stale funds (ordered by lastVerifiedAt to avoid re-processing same funds)
      const remainingSlots = batchSize - nullVerifiedFunds.length;
      const staleFunds = remainingSlots > 0 ? await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} < ${staleThreshold} AND ${mutualFunds.lastVerifiedAt} IS NOT NULL`)
        .orderBy(sql`${mutualFunds.lastVerifiedAt} ASC`)
        .limit(remainingSlots) : [];
      
      const allFundsToRefresh = [...nullVerifiedFunds, ...staleFunds];
      
      for (const fund of allFundsToRefresh) {
        try {
          const navData = await this.fetchNAVFromMFAPI(fund.schemeCode);
          if (navData) {
            const now = new Date();
            await db.update(mutualFunds)
              .set({
                nav: navData.nav,
                lastVerifiedAt: now,
                dataSource: 'MFAPI',
                lastUpdated: now,
                extendedData: sql`jsonb_set(COALESCE(${mutualFunds.extendedData}, '{}'::jsonb), '{navDate}', ${JSON.stringify(navData.navDate)}::jsonb)`
              })
              .where(eq(mutualFunds.schemeCode, fund.schemeCode));
            updated++;
          } else {
            errors++;
          }
        } catch (err) {
          errors++;
        }
      }
    } catch (error) {
      console.error('[MF Sync] Batch refresh failed:', error);
    }
    
    return { updated, errors };
  }

  private async markStaleSchemes(): Promise<void> {
    // Mark schemes not verified in 30+ days as potentially wound up
    const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      const result = await db.update(mutualFunds)
        .set({ schemeStatus: 'stale' })
        .where(sql`${mutualFunds.lastVerifiedAt} < ${staleThreshold} AND ${mutualFunds.schemeStatus} = 'active'`);
      
      console.log('[MF Sync] Marked stale schemes');
    } catch (error) {
      console.warn('[MF Sync] Failed to mark stale schemes:', error);
    }
  }

  private parseAMFIData(data: string): AMFIFund[] {
    const funds: AMFIFund[] = [];
    const lines = data.split('\n');
    let currentFundHouse = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Fund house header (no semicolons)
      if (!trimmed.includes(';')) {
        currentFundHouse = trimmed;
        continue;
      }

      // Parse fund data: Scheme Code;ISIN Div Payout/Reinvest;ISIN Growth;Scheme Name;Net Asset Value;Date
      const parts = trimmed.split(';');
      if (parts.length < 6) continue;

      const [schemeCode, isinDiv, isinGrowth, schemeName, nav, navDate] = parts;
      
      if (!schemeCode?.trim() || !schemeName?.trim()) continue;
      if (!/^\d+$/.test(schemeCode.trim())) continue;
      if (isNaN(parseFloat(nav?.trim()))) continue;

      funds.push({
        schemeCode: schemeCode.trim(),
        schemeName: schemeName.trim(),
        fundHouse: currentFundHouse,
        nav: nav.trim(),
        navDate: navDate?.trim() || '',
        isinDiv: isinDiv?.trim() || '',
        isinGrowth: isinGrowth?.trim() || ''
      });
    }

    return funds;
  }

  private async fetchNAVFromMFAPI(schemeCode: string): Promise<{ nav: string; navDate: string } | null> {
    try {
      const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`, {
        timeout: 5000
      });
      
      if (response.data?.data?.length > 0) {
        const latestData = response.data.data[0];
        return { 
          nav: latestData.nav,
          navDate: latestData.date || new Date().toISOString().split('T')[0]
        };
      }
    } catch (error) {
      // Silent fail
    }
    return null;
  }

  private detectOptionType(schemeName: string): string | null {
    if (!schemeName) return null;
    const name = schemeName.toUpperCase();
    if (name.includes('IDCW') || name.includes('DIVIDEND')) return 'idcw';
    if (name.includes('GROWTH')) return 'growth';
    return null;
  }

  private detectPlanType(schemeName: string): string {
    if (!schemeName) return 'regular';
    const name = schemeName.toUpperCase();
    if (name.includes('DIRECT')) return 'direct';
    return 'regular';
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    totalFunds: number;
    freshFunds: number;
    staleFunds: number;
    lastSync: Date | null;
  }> {
    const freshThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds);
    
    const [freshResult] = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(sql`${mutualFunds.lastVerifiedAt} > ${freshThreshold}`);
    
    const [staleResult] = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(sql`${mutualFunds.lastVerifiedAt} < ${staleThreshold} OR ${mutualFunds.lastVerifiedAt} IS NULL`);

    const [lastSyncResult] = await db.select({ lastSync: sql<Date>`MAX(${mutualFunds.lastVerifiedAt})` })
      .from(mutualFunds);

    return {
      isRunning: this.isRunning,
      totalFunds: Number(totalResult?.count || 0),
      freshFunds: Number(freshResult?.count || 0),
      staleFunds: Number(staleResult?.count || 0),
      lastSync: lastSyncResult?.lastSync || null
    };
  }

  async triggerManualSync(): Promise<{ updated: number; added: number; errors: number }> {
    return this.runAMFIMasterSync();
  }
  
  async refreshFundBySchemeCode(schemeCode: string): Promise<{ success: boolean; nav?: string; navDate?: string; error?: string }> {
    try {
      console.log(`[MF Sync] Refreshing fund ${schemeCode}...`);
      const navData = await this.fetchNAVFromMFAPI(schemeCode);
      
      if (!navData) {
        return { success: false, error: 'Failed to fetch NAV from MFAPI' };
      }
      
      const now = new Date();
      await db.update(mutualFunds)
        .set({
          nav: navData.nav,
          lastVerifiedAt: now,
          dataSource: 'MFAPI',
          lastUpdated: now,
          extendedData: sql`jsonb_set(COALESCE(${mutualFunds.extendedData}, '{}'::jsonb), '{navDate}', ${JSON.stringify(navData.navDate)}::jsonb)`
        })
        .where(eq(mutualFunds.schemeCode, schemeCode));
      
      console.log(`[MF Sync] Fund ${schemeCode} refreshed: NAV=${navData.nav}, Date=${navData.navDate}`);
      return { success: true, nav: navData.nav, navDate: navData.navDate };
    } catch (error: any) {
      console.error(`[MF Sync] Failed to refresh fund ${schemeCode}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async refreshFundByISIN(isin: string): Promise<{ success: boolean; nav?: string; navDate?: string; schemeCode?: string; error?: string }> {
    try {
      // Find the fund by ISIN in extended_data
      const [fund] = await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
        .limit(1);
      
      if (!fund) {
        return { success: false, error: `Fund with ISIN ${isin} not found` };
      }
      
      const result = await this.refreshFundBySchemeCode(fund.schemeCode);
      return { ...result, schemeCode: fund.schemeCode };
    } catch (error: any) {
      console.error(`[MF Sync] Failed to refresh fund by ISIN ${isin}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const mfSyncScheduler = new MFSyncScheduler();
export default mfSyncScheduler;
