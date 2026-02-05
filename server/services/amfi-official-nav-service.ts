/**
 * AMFI Official NAV Sync Service
 * 
 * Fetches and parses official NAV data from AMFI India (amfiindia.com)
 * SEBI-compliant data source for mutual fund NAV updates
 * 
 * Data Source: https://www.amfiindia.com/spages/NAVAll.txt
 * Updated: Daily by 11 PM IST
 */

import axios from 'axios';
import { db } from '../db';
import { mutualFunds, mfNavHistory } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';

interface AmfiNavRecord {
  schemeCode: string;
  isinGrowth: string;
  isinDividendReinvest: string;
  schemeName: string;
  nav: number;
  navDate: string;
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
}

interface SyncResult {
  success: boolean;
  totalRecords: number;
  updatedFunds: number;
  newFunds: number;
  errors: number;
  syncDuration: number;
  dataSource: string;
  navDate: string | null;
  errorDetails: string[];
}

interface SyncProgress {
  status: 'idle' | 'fetching' | 'parsing' | 'updating' | 'completed' | 'error';
  currentStep: string;
  totalRecords: number;
  processedRecords: number;
  updatedFunds: number;
  startedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncResult: SyncResult | null;
}

class AmfiOfficialNavService {
  private static instance: AmfiOfficialNavService;
  
  // Official AMFI NAV file URL
  private readonly AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
  
  private syncProgress: SyncProgress = {
    status: 'idle',
    currentStep: '',
    totalRecords: 0,
    processedRecords: 0,
    updatedFunds: 0,
    startedAt: null,
    lastSyncAt: null,
    lastSyncResult: null,
  };

  static getInstance(): AmfiOfficialNavService {
    if (!this.instance) {
      this.instance = new AmfiOfficialNavService();
    }
    return this.instance;
  }

  getProgress(): SyncProgress {
    return { ...this.syncProgress };
  }

  /**
   * Fetch and parse the official AMFI NAV file
   */
  async fetchAmfiNavData(): Promise<AmfiNavRecord[]> {
    console.log('[AMFI Official] Fetching NAV data from amfiindia.com...');
    
    try {
      const response = await axios.get(this.AMFI_NAV_URL, {
        timeout: 120000, // 2 minute timeout for large file
        responseType: 'text',
      });
      
      const rawData = response.data as string;
      const records = this.parseAmfiNavFile(rawData);
      
      console.log(`[AMFI Official] Parsed ${records.length} NAV records`);
      return records;
    } catch (error: any) {
      console.error('[AMFI Official] Failed to fetch NAV data:', error.message);
      throw error;
    }
  }

  /**
   * Parse AMFI NAV text file format
   * Format: 
   * Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
   * 
   * Lines starting with fund house names (no semicolons at start) indicate fund house context
   * Lines with "Open Ended Schemes" or "Close Ended Schemes" indicate scheme type context
   */
  private parseAmfiNavFile(rawData: string): AmfiNavRecord[] {
    const records: AmfiNavRecord[] = [];
    const lines = rawData.split('\n');
    
    let currentFundHouse = '';
    let currentSchemeType = '';
    let currentSchemeCategory = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if this is a fund house header (no semicolons, ends with "Mutual Fund")
      if (!trimmedLine.includes(';') && trimmedLine.includes('Mutual Fund')) {
        currentFundHouse = trimmedLine;
        continue;
      }
      
      // Check if this is a scheme type header
      if (trimmedLine.startsWith('Open Ended Schemes') || 
          trimmedLine.startsWith('Close Ended Schemes') ||
          trimmedLine.startsWith('Interval Fund Schemes')) {
        currentSchemeType = trimmedLine.split('(')[0].trim();
        // Extract category from parentheses if present
        const categoryMatch = trimmedLine.match(/\(([^)]+)\)/);
        currentSchemeCategory = categoryMatch ? categoryMatch[1] : '';
        continue;
      }
      
      // Check if this is a category header (no semicolons, all caps or specific patterns)
      if (!trimmedLine.includes(';') && 
          (trimmedLine === trimmedLine.toUpperCase() || 
           trimmedLine.includes('Scheme') ||
           trimmedLine.includes('Fund'))) {
        // This might be a sub-category, skip or use as category
        if (!trimmedLine.includes('Mutual Fund')) {
          currentSchemeCategory = trimmedLine;
        }
        continue;
      }
      
      // Parse data line (semicolon separated)
      const parts = trimmedLine.split(';');
      if (parts.length >= 5) {
        const schemeCode = parts[0]?.trim();
        const isinGrowth = parts[1]?.trim() || '';
        const isinDividendReinvest = parts[2]?.trim() || '';
        const schemeName = parts[3]?.trim() || '';
        const navStr = parts[4]?.trim() || '';
        const navDate = parts[5]?.trim() || '';
        
        // Skip if scheme code is not numeric or NAV is not valid
        if (!schemeCode || !/^\d+$/.test(schemeCode)) continue;
        
        const nav = parseFloat(navStr);
        if (isNaN(nav) || nav <= 0) continue;
        
        records.push({
          schemeCode,
          isinGrowth,
          isinDividendReinvest,
          schemeName,
          nav,
          navDate,
          fundHouse: currentFundHouse,
          schemeType: currentSchemeType,
          schemeCategory: currentSchemeCategory,
        });
      }
    }
    
    return records;
  }

  /**
   * Sync NAV data to database
   */
  async syncNavToDatabase(options: { batchSize?: number } = {}): Promise<SyncResult> {
    const { batchSize = 500 } = options;
    const startTime = Date.now();
    
    this.syncProgress = {
      status: 'fetching',
      currentStep: 'Fetching NAV data from AMFI...',
      totalRecords: 0,
      processedRecords: 0,
      updatedFunds: 0,
      startedAt: new Date(),
      lastSyncAt: this.syncProgress.lastSyncAt,
      lastSyncResult: this.syncProgress.lastSyncResult,
    };
    
    const result: SyncResult = {
      success: false,
      totalRecords: 0,
      updatedFunds: 0,
      newFunds: 0,
      errors: 0,
      syncDuration: 0,
      dataSource: 'AMFI_OFFICIAL',
      navDate: null,
      errorDetails: [],
    };
    
    try {
      // Fetch AMFI data
      const navRecords = await this.fetchAmfiNavData();
      result.totalRecords = navRecords.length;
      this.syncProgress.totalRecords = navRecords.length;
      
      if (navRecords.length === 0) {
        throw new Error('No NAV records found in AMFI data');
      }
      
      // Get NAV date from first record
      result.navDate = navRecords[0]?.navDate || null;
      
      this.syncProgress.status = 'updating';
      this.syncProgress.currentStep = 'Updating database...';
      
      // Process in batches
      for (let i = 0; i < navRecords.length; i += batchSize) {
        const batch = navRecords.slice(i, i + batchSize);
        
        this.syncProgress.currentStep = `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(navRecords.length / batchSize)}...`;
        
        const batchPromises = batch.map(async (record) => {
          try {
            // Parse NAV date from AMFI format (dd-MMM-yyyy or dd-Mon-yyyy)
            const parsedNavDate = this.parseAmfiDate(record.navDate);
            
            // Update existing fund by scheme code
            const updateResult = await db.update(mutualFunds)
              .set({
                nav: record.nav.toString(),
                isin: record.isinGrowth || undefined,
                isinGrowth: record.isinGrowth || undefined,
                isinDividendReinvest: record.isinDividendReinvest || undefined,
                fundHouse: record.fundHouse || undefined,
                category: record.schemeCategory || undefined,
                dataSource: 'AMFI_OFFICIAL',
                lastVerifiedAt: new Date(),
              })
              .where(eq(mutualFunds.schemeCode, record.schemeCode))
              .returning({ id: mutualFunds.id });
            
            if (updateResult.length > 0) {
              // Insert historical NAV record for SEBI audit trail
              if (parsedNavDate) {
                try {
                  await db.insert(mfNavHistory)
                    .values({
                      schemeCode: record.schemeCode,
                      navDate: parsedNavDate,
                      nav: record.nav.toString(),
                    })
                    .onConflictDoNothing(); // Skip if already exists for this date
                } catch (historyError: any) {
                  // Don't fail the entire sync for history insert errors
                  console.warn(`[AMFI Official] History insert failed for ${record.schemeCode}:`, historyError.message);
                }
              }
              return { updated: true };
            }
            
            // Fund doesn't exist - skip for now (could insert new)
            return { updated: false };
          } catch (error: any) {
            result.errors++;
            if (result.errorDetails.length < 10) {
              result.errorDetails.push(`${record.schemeCode}: ${error.message}`);
            }
            return { updated: false, error: true };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const updatedCount = batchResults.filter(r => r.updated).length;
        result.updatedFunds += updatedCount;
        
        this.syncProgress.processedRecords = i + batch.length;
        this.syncProgress.updatedFunds = result.updatedFunds;
        
        // Small delay between batches to prevent database overload
        if (i + batchSize < navRecords.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      result.success = true;
      result.syncDuration = Date.now() - startTime;
      
      this.syncProgress.status = 'completed';
      this.syncProgress.currentStep = 'Sync completed successfully';
      this.syncProgress.lastSyncAt = new Date();
      this.syncProgress.lastSyncResult = result;
      
      console.log(`[AMFI Official] Sync completed: ${result.updatedFunds} funds updated in ${result.syncDuration}ms`);
      
    } catch (error: any) {
      result.success = false;
      result.syncDuration = Date.now() - startTime;
      result.errorDetails.push(error.message);
      
      this.syncProgress.status = 'error';
      this.syncProgress.currentStep = `Error: ${error.message}`;
      this.syncProgress.lastSyncResult = result;
      
      console.error('[AMFI Official] Sync failed:', error.message);
    }
    
    return result;
  }

  /**
   * Get last sync status
   */
  getLastSyncResult(): SyncResult | null {
    return this.syncProgress.lastSyncResult;
  }

  /**
   * Parse AMFI date format (dd-MMM-yyyy or dd-Mon-yyyy) to ISO date string
   * Examples: "04-Feb-2026", "31-Jan-2026"
   */
  private parseAmfiDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    };
    
    // Try dd-Mon-yyyy format (e.g., "04-Feb-2026")
    const match = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    if (match) {
      const [, day, monthStr, year] = match;
      const month = months[monthStr];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try alternate formats
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore parse errors
    }
    
    return null;
  }
}

export const amfiOfficialNavService = AmfiOfficialNavService.getInstance();
