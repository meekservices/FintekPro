import axios from 'axios';
import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { eq, sql, lt } from 'drizzle-orm';

interface AMFIFund {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  nav: string;
  navDate: string;
}

class MFSyncScheduler {
  private syncIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
  private navRefreshIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
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
    
    // Schedule NAV refresh every 6 hours
    this.scheduleNAVRefresh();
    
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

            if (existing.length > 0) {
              // Update existing
              await db.update(mutualFunds)
                .set({
                  schemeName: fund.schemeName,
                  fundHouse: fund.fundHouse,
                  nav: fund.nav,
                  amfiCode: fund.schemeCode,
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
              // Insert new
              await db.insert(mutualFunds)
                .values({
                  schemeCode: fund.schemeCode,
                  schemeName: fund.schemeName,
                  fundHouse: fund.fundHouse,
                  nav: fund.nav,
                  amfiCode: fund.schemeCode,
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
      console.log(`[MF Sync] AMFI sync complete in ${duration}ms: ${updated} updated, ${added} added, ${errors} errors`);

      // Mark schemes not in AMFI as potentially wound up
      await this.markStaleSchemes();

    } catch (error) {
      console.error('[MF Sync] AMFI master sync failed:', error);
    }

    return { updated, added, errors };
  }

  async runNAVRefresh(): Promise<{ updated: number; errors: number }> {
    console.log('[MF Sync] Starting NAV refresh...');
    let updated = 0;
    let errors = 0;

    try {
      // Get funds that haven't been updated in 6+ hours
      const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
      
      const staleFunds = await db.select({ schemeCode: mutualFunds.schemeCode })
        .from(mutualFunds)
        .where(sql`${mutualFunds.lastVerifiedAt} < ${staleThreshold} OR ${mutualFunds.lastVerifiedAt} IS NULL`)
        .limit(100);

      for (const fund of staleFunds) {
        try {
          const navData = await this.fetchNAVFromMFAPI(fund.schemeCode);
          if (navData) {
            await db.update(mutualFunds)
              .set({
                nav: navData.nav,
                lastVerifiedAt: new Date(),
                dataSource: 'MFAPI',
                lastUpdated: new Date()
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

      // Parse fund data: Scheme Code;ISIN Div;ISIN Growth;Scheme Name;Net Asset Value;Date
      const parts = trimmed.split(';');
      if (parts.length < 6) continue;

      const [schemeCode, , , schemeName, nav, navDate] = parts;
      
      // Validate
      if (!schemeCode?.trim() || !schemeName?.trim()) continue;
      if (!/^\d+$/.test(schemeCode.trim())) continue;
      if (isNaN(parseFloat(nav?.trim()))) continue;

      funds.push({
        schemeCode: schemeCode.trim(),
        schemeName: schemeName.trim(),
        fundHouse: currentFundHouse,
        nav: nav.trim(),
        navDate: navDate?.trim() || ''
      });
    }

    return funds;
  }

  private async fetchNAVFromMFAPI(schemeCode: string): Promise<{ nav: string } | null> {
    try {
      const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`, {
        timeout: 5000
      });
      
      if (response.data?.data?.length > 0) {
        return { nav: response.data.data[0].nav };
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
}

export const mfSyncScheduler = new MFSyncScheduler();
export default mfSyncScheduler;
