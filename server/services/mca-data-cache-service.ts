/**
 * MCA Data Cache Service
 * Caches Sandbox API responses into local PostgreSQL database
 * 
 * Features:
 * - Reduces API costs by serving cached data for repeat queries
 * - Persists company master, directors, charges, and financial data
 * - Tracks data freshness with last_refreshed timestamps
 * - Version history for audit compliance
 */

import { db } from '../db';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import {
  mcaCompanyMaster,
  mcaDirectors,
  mcaDirectorCompanyMap,
  mcaCharges,
  mcaFinancialSnapshot,
  mcaShareholdingPattern,
  mcaVersionHistory,
  mcaIngestionLogs,
  type McaCompanyMaster,
  type McaDirector,
  type McaCharge,
  type McaFinancialSnapshot,
  type McaShareholdingPattern,
} from '@shared/schema';
import { mcaService, type MCACompanyMasterData } from './mca-service';
import { credhiveService } from './credhive-service';
import { nanoid } from 'nanoid';

// Cache TTL in hours (data older than this will trigger a refresh)
const CACHE_TTL_HOURS = 24;

export interface CachedCompanyData {
  company: McaCompanyMaster;
  directors: McaDirector[];
  charges: McaCharge[];
  financials: McaFinancialSnapshot[];
  shareholding: McaShareholdingPattern[];
  fromCache: boolean;
  cacheAge?: number; // hours since last refresh
}

export interface CacheResult {
  success: boolean;
  data?: CachedCompanyData;
  error?: string;
  apiCallMade: boolean;
}

class McaDataCacheService {
  constructor() {
    console.log('✅ MCA Data Cache Service initialized');
  }

  /**
   * Get company data with caching
   * First checks local database, then falls back to API if not cached or stale
   */
  async getCompanyWithCache(
    cin: string,
    options: { forceRefresh?: boolean; userId?: string } = {}
  ): Promise<CacheResult> {
    const { forceRefresh = false, userId } = options;
    const runId = `cache_${nanoid(8)}`;

    try {
      // Check if we have cached data
      if (!forceRefresh) {
        const cachedData = await this.getCachedCompany(cin);
        if (cachedData) {
          const cacheAge = this.getCacheAgeHours(cachedData.company.updatedAt);
          
          // If cache is fresh, return it
          if (cacheAge < CACHE_TTL_HOURS) {
            console.log(`[MCA Cache] Serving cached data for ${cin} (age: ${cacheAge.toFixed(1)}h)`);
            return {
              success: true,
              data: {
                ...cachedData,
                fromCache: true,
                cacheAge,
              },
              apiCallMade: false,
            };
          }
          
          console.log(`[MCA Cache] Cache stale for ${cin} (age: ${cacheAge.toFixed(1)}h), refreshing...`);
        }
      }

      // Fetch from API
      console.log(`[MCA Cache] Fetching fresh data for ${cin} from Sandbox API...`);
      
      await this.logIngestionStart(runId, cin, userId);
      
      const apiResult = await mcaService.getCompanyByCINWithDetails(cin);
      
      if (!apiResult.success || !apiResult.data) {
        console.log(`[MCA Cache] Sandbox API failed for ${cin}: ${apiResult.error?.message}`);
        
        // Try CredHive as fallback when Sandbox fails
        console.log(`[MCA Cache] Attempting Credhive fallback for ${cin}...`);
        try {
          const credhiveResult = await credhiveService.getCompanyDetails(cin);
          if (credhiveResult.success && credhiveResult.data) {
            const credhiveData = credhiveResult.data;
            console.log(`[MCA Cache] Credhive fallback successful for ${cin}`);
            
            // Convert Credhive data to MCA format and persist
            const credhiveMcaData: Partial<MCACompanyMasterData> = {
              cin: credhiveData.cin,
              companyName: credhiveData.companyName,
              companyStatus: credhiveData.status || 'Active',
              companyCategory: credhiveData.category || 'Company limited by Shares',
              companySubCategory: 'Non-govt company',
              companyClass: 'Private',
              registeredAddress: credhiveData.registeredAddress || '',
              email: credhiveData.email || '',
              incorporationDate: '',
              authorizedCapital: credhiveData.authorizedCapital?.toString() || '0',
              paidUpCapital: credhiveData.paidUpCapital?.toString() || '0',
            };

            await this.persistCompanyDataFromCredhive(credhiveMcaData, userId, runId);
            await this.logIngestionComplete(runId, 'completed', 1, 'Credhive fallback');
            
            const freshData = await this.getCachedCompany(cin);
            return {
              success: true,
              data: freshData ? {
                ...freshData,
                fromCache: false,
                cacheAge: 0,
              } : undefined,
              apiCallMade: true,
            };
          }
        } catch (credhiveError: any) {
          console.log(`[MCA Cache] Credhive fallback also failed: ${credhiveError.message}`);
        }

        await this.logIngestionComplete(runId, 'failed', 0, apiResult.error?.message);
        
        // If both APIs fail but we have stale cache, return it
        const staleCache = await this.getCachedCompany(cin);
        if (staleCache) {
          console.log(`[MCA Cache] APIs failed, returning stale cache for ${cin}`);
          return {
            success: true,
            data: {
              ...staleCache,
              fromCache: true,
              cacheAge: this.getCacheAgeHours(staleCache.company.updatedAt),
            },
            apiCallMade: true,
          };
        }
        
        return {
          success: false,
          error: apiResult.error?.message || 'Failed to fetch company data from both Sandbox and CredHive',
          apiCallMade: true,
        };
      }

      // Persist to database
      await this.persistCompanyData(apiResult.data, userId, runId);
      await this.logIngestionComplete(runId, 'completed', 1);

      // Fetch the freshly cached data
      const freshData = await this.getCachedCompany(cin);
      
      return {
        success: true,
        data: freshData ? {
          ...freshData,
          fromCache: false,
          cacheAge: 0,
        } : undefined,
        apiCallMade: true,
      };
    } catch (error: any) {
      console.error(`[MCA Cache] Error for ${cin}:`, error.message);
      await this.logIngestionComplete(runId, 'failed', 0, error.message);
      
      return {
        success: false,
        error: error.message,
        apiCallMade: false,
      };
    }
  }

  /**
   * Get cached company data from local database
   */
  async getCachedCompany(cin: string): Promise<Omit<CachedCompanyData, 'fromCache' | 'cacheAge'> | null> {
    try {
      // Get company master
      const [company] = await db
        .select()
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.cin, cin))
        .limit(1);

      if (!company) {
        return null;
      }

      // Get directors linked to this company
      const directorMaps = await db
        .select()
        .from(mcaDirectorCompanyMap)
        .where(eq(mcaDirectorCompanyMap.cin, cin));

      const directorDins = directorMaps.map(d => d.din);
      
      let directors: McaDirector[] = [];
      if (directorDins.length > 0) {
        directors = await db
          .select()
          .from(mcaDirectors)
          .where(sql`${mcaDirectors.din} = ANY(${directorDins})`);
      }

      // Get charges
      const charges = await db
        .select()
        .from(mcaCharges)
        .where(eq(mcaCharges.cin, cin))
        .orderBy(desc(mcaCharges.creationDate));

      // Get financial snapshots
      const financials = await db
        .select()
        .from(mcaFinancialSnapshot)
        .where(eq(mcaFinancialSnapshot.cin, cin))
        .orderBy(desc(mcaFinancialSnapshot.financialYear));

      // Get shareholding patterns
      const shareholding = await db
        .select()
        .from(mcaShareholdingPattern)
        .where(eq(mcaShareholdingPattern.cin, cin))
        .orderBy(desc(mcaShareholdingPattern.financialYear));

      return {
        company,
        directors,
        charges,
        financials,
        shareholding,
      };
    } catch (error: any) {
      console.error(`[MCA Cache] Error fetching cached data for ${cin}:`, error.message);
      return null;
    }
  }

  /**
   * Persist company data from API response to database
   */
  async persistCompanyData(
    data: MCACompanyMasterData,
    userId?: string,
    runId?: string
  ): Promise<void> {
    const cin = data.cin;
    
    try {
      // 1. Upsert company master
      const existingCompany = await db
        .select()
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.cin, cin))
        .limit(1);

      const companyData = {
        cin: data.cin,
        companyName: data.companyName,
        companyStatus: data.companyStatus,
        companyCategory: data.companyCategory,
        companySubCategory: data.companySubcategory,
        companyClass: data.classOfCompany,
        incorporationDate: data.dateOfIncorporation || null,
        registeredAddress: data.registeredAddress,
        email: data.emailId,
        authorizedCapital: data.authorizedCapital?.toString() || '0',
        paidUpCapital: data.paidUpCapital?.toString() || '0',
        lastAnnualReturn: data.annualReturns?.[0]?.filingDate || null,
        lastBalanceSheet: data.balanceSheets?.[0]?.filingDate || null,
        updatedAt: new Date(),
      };

      if (existingCompany.length > 0) {
        // Log version history
        await this.logVersionChange('company', cin, 'update', existingCompany[0], companyData, userId, runId);
        
        await db
          .update(mcaCompanyMaster)
          .set(companyData)
          .where(eq(mcaCompanyMaster.cin, cin));
      } else {
        await this.logVersionChange('company', cin, 'create', null, companyData, userId, runId);
        
        await db.insert(mcaCompanyMaster).values({
          ...companyData,
          createdAt: new Date(),
        });
      }

      // 2. Persist directors
      for (const director of data.directors || []) {
        await this.persistDirector(cin, director, userId, runId);
      }

      // 3. Persist charges
      for (const charge of data.charges || []) {
        await this.persistCharge(cin, charge, userId, runId);
      }

      // 4. Persist financial data from balance sheets
      for (const bs of data.balanceSheets || []) {
        await this.persistFinancialSnapshot(cin, bs.financialYear, userId, runId);
      }

      // 5. Persist shareholding patterns if available
      if (data.shareholding && Array.isArray(data.shareholding)) {
        for (const sh of data.shareholding) {
          await this.persistShareholding(cin, sh, userId, runId);
        }
      }

      console.log(`[MCA Cache] Persisted data for ${cin}: ${data.directors?.length || 0} directors, ${data.charges?.length || 0} charges, ${data.shareholding?.length || 0} shareholding records`);
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting data for ${cin}:`, error.message);
      throw error;
    }
  }

  /**
   * Persist company data from CredHive fallback response
   */
  async persistCompanyDataFromCredhive(
    data: Partial<MCACompanyMasterData>,
    userId?: string,
    runId?: string
  ): Promise<void> {
    const cin = data.cin;
    if (!cin) {
      throw new Error('CIN is required to persist CredHive data');
    }
    
    try {
      const existingCompany = await db
        .select()
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.cin, cin))
        .limit(1);

      const companyData = {
        cin: data.cin!,
        companyName: data.companyName || 'Unknown',
        companyStatus: data.companyStatus || 'Active',
        companyCategory: data.companyCategory || 'Company limited by Shares',
        companySubCategory: data.companySubCategory || 'Non-govt company',
        companyClass: data.companyClass || 'Private',
        incorporationDate: data.incorporationDate || null,
        registeredAddress: data.registeredAddress || '',
        email: data.email || '',
        authorizedCapital: data.authorizedCapital || '0',
        paidUpCapital: data.paidUpCapital || '0',
        lastAnnualReturn: null,
        lastBalanceSheet: null,
        updatedAt: new Date(),
        sourceAttribution: 'CredHive Fallback',
      };

      if (existingCompany.length > 0) {
        await this.logVersionChange('company', cin, 'update', existingCompany[0], companyData, userId, runId);
        
        await db
          .update(mcaCompanyMaster)
          .set(companyData)
          .where(eq(mcaCompanyMaster.cin, cin));
      } else {
        await this.logVersionChange('company', cin, 'create', null, companyData, userId, runId);
        
        await db.insert(mcaCompanyMaster).values({
          ...companyData,
          createdAt: new Date(),
        });
      }

      console.log(`[MCA Cache] Persisted CredHive data for ${cin}`);
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting CredHive data for ${cin}:`, error.message);
      throw error;
    }
  }

  /**
   * Persist director data
   */
  private async persistDirector(
    cin: string,
    director: { din: string; name: string; designation: string; beginDate: string; endDate?: string },
    userId?: string,
    runId?: string
  ): Promise<void> {
    if (!director.din || director.din.length < 5) return;

    try {
      // Upsert director master
      const existingDirector = await db
        .select()
        .from(mcaDirectors)
        .where(eq(mcaDirectors.din, director.din))
        .limit(1);

      const directorData = {
        din: director.din,
        name: director.name,
        designation: director.designation,
        dataLastRefreshed: new Date(),
        updatedAt: new Date(),
      };

      if (existingDirector.length === 0) {
        await db.insert(mcaDirectors).values({
          ...directorData,
          createdAt: new Date(),
        });
      } else {
        await db
          .update(mcaDirectors)
          .set(directorData)
          .where(eq(mcaDirectors.din, director.din));
      }

      // Upsert director-company mapping
      const existingMap = await db
        .select()
        .from(mcaDirectorCompanyMap)
        .where(and(
          eq(mcaDirectorCompanyMap.din, director.din),
          eq(mcaDirectorCompanyMap.cin, cin)
        ))
        .limit(1);

      const mapData = {
        din: director.din,
        cin: cin,
        designation: director.designation,
        appointmentDate: director.beginDate || null,
        cessationDate: director.endDate || null,
        isCurrentlyActive: !director.endDate,
        updatedAt: new Date(),
      };

      if (existingMap.length === 0) {
        await db.insert(mcaDirectorCompanyMap).values({
          ...mapData,
          createdAt: new Date(),
        });
      } else {
        await db
          .update(mcaDirectorCompanyMap)
          .set(mapData)
          .where(eq(mcaDirectorCompanyMap.id, existingMap[0].id));
      }
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting director ${director.din}:`, error.message);
    }
  }

  /**
   * Persist charge data
   */
  private async persistCharge(
    cin: string,
    charge: { dateOfCreation: string; dateOfModification?: string; chargeAmount: number; status: string },
    userId?: string,
    runId?: string
  ): Promise<void> {
    try {
      const chargeId = `${cin}_${charge.dateOfCreation}_${charge.chargeAmount}`;
      
      const existingCharge = await db
        .select()
        .from(mcaCharges)
        .where(eq(mcaCharges.chargeId, chargeId))
        .limit(1);

      const chargeData = {
        cin,
        chargeId,
        chargeHolder: 'Not Disclosed', // Sandbox doesn't provide this
        chargeAmount: charge.chargeAmount?.toString() || '0',
        creationDate: charge.dateOfCreation || new Date().toISOString().split('T')[0],
        modificationDate: charge.dateOfModification || null,
        status: charge.status?.toLowerCase().includes('satisfied') ? 'satisfied' : 'active',
        updatedAt: new Date(),
      };

      if (existingCharge.length === 0) {
        await db.insert(mcaCharges).values({
          ...chargeData,
          createdAt: new Date(),
        });
      } else {
        await db
          .update(mcaCharges)
          .set(chargeData)
          .where(eq(mcaCharges.id, existingCharge[0].id));
      }
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting charge for ${cin}:`, error.message);
    }
  }

  /**
   * Persist financial snapshot placeholder
   */
  private async persistFinancialSnapshot(
    cin: string,
    financialYear: string,
    userId?: string,
    runId?: string
  ): Promise<void> {
    if (!financialYear) return;

    try {
      const existing = await db
        .select()
        .from(mcaFinancialSnapshot)
        .where(and(
          eq(mcaFinancialSnapshot.cin, cin),
          eq(mcaFinancialSnapshot.financialYear, financialYear)
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(mcaFinancialSnapshot).values({
          cin,
          financialYear,
          source: 'sandbox_mca',
          derivedBy: userId,
        });
      }
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting financial snapshot:`, error.message);
    }
  }

  /**
   * Persist shareholding pattern data
   */
  private async persistShareholding(
    cin: string,
    shareholding: {
      financialYear: string;
      promoterHolding?: number;
      publicHolding?: number;
      institutionalHolding?: number;
      foreignHolding?: number;
    },
    userId?: string,
    runId?: string
  ): Promise<void> {
    if (!shareholding?.financialYear) return;

    try {
      const existing = await db
        .select()
        .from(mcaShareholdingPattern)
        .where(and(
          eq(mcaShareholdingPattern.cin, cin),
          eq(mcaShareholdingPattern.financialYear, shareholding.financialYear)
        ))
        .limit(1);

      const shareholdingData = {
        cin,
        financialYear: shareholding.financialYear,
        promoterHolding: shareholding.promoterHolding?.toString() || null,
        publicHolding: shareholding.publicHolding?.toString() || null,
        institutionalHolding: shareholding.institutionalHolding?.toString() || null,
        foreignHolding: shareholding.foreignHolding?.toString() || null,
        source: 'sandbox_mca',
        derivedBy: userId,
        updatedAt: new Date(),
      };

      if (existing.length === 0) {
        await db.insert(mcaShareholdingPattern).values({
          ...shareholdingData,
          createdAt: new Date(),
        });
      } else {
        await db
          .update(mcaShareholdingPattern)
          .set(shareholdingData)
          .where(eq(mcaShareholdingPattern.id, existing[0].id));
      }
    } catch (error: any) {
      console.error(`[MCA Cache] Error persisting shareholding:`, error.message);
    }
  }

  /**
   * Log version change for audit trail
   */
  private async logVersionChange(
    entityType: string,
    entityId: string,
    changeType: string,
    previousData: any,
    newData: any,
    userId?: string,
    runId?: string
  ): Promise<void> {
    try {
      await db.insert(mcaVersionHistory).values({
        entityType,
        entityId,
        changeType,
        previousData: previousData ? JSON.stringify(previousData) : null,
        newData: JSON.stringify(newData),
        changedBy: userId,
        ingestionRunId: runId,
      });
    } catch (error: any) {
      console.error(`[MCA Cache] Error logging version change:`, error.message);
    }
  }

  /**
   * Log ingestion start
   */
  private async logIngestionStart(runId: string, cin: string, userId?: string): Promise<void> {
    try {
      await db.insert(mcaIngestionLogs).values({
        runId,
        sourceName: 'sandbox',
        operationType: 'single_company',
        targetCins: [cin],
        status: 'running',
        triggeredBy: userId || 'system',
      });
    } catch (error: any) {
      console.error(`[MCA Cache] Error logging ingestion start:`, error.message);
    }
  }

  /**
   * Log ingestion completion
   */
  private async logIngestionComplete(
    runId: string,
    status: 'completed' | 'failed' | 'partial',
    recordsProcessed: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db
        .update(mcaIngestionLogs)
        .set({
          status,
          processedRecords: recordsProcessed,
          completedAt: new Date(),
          apiCallsMade: 1,
          errorMessages: errorMessage ? [errorMessage] : [],
        })
        .where(eq(mcaIngestionLogs.runId, runId));
    } catch (error: any) {
      console.error(`[MCA Cache] Error logging ingestion complete:`, error.message);
    }
  }

  /**
   * Calculate cache age in hours
   */
  private getCacheAgeHours(updatedAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - new Date(updatedAt).getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCompanies: number;
    totalDirectors: number;
    totalCharges: number;
    recentlyUpdated: number;
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [companies] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcaCompanyMaster);

    const [directors] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcaDirectors);

    const [charges] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcaCharges);

    const [recentlyUpdated] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcaCompanyMaster)
      .where(gte(mcaCompanyMaster.updatedAt, oneDayAgo));

    return {
      totalCompanies: Number(companies?.count || 0),
      totalDirectors: Number(directors?.count || 0),
      totalCharges: Number(charges?.count || 0),
      recentlyUpdated: Number(recentlyUpdated?.count || 0),
    };
  }

  /**
   * Get data freshness statistics for compliance dashboard
   */
  async getDataFreshnessStats(): Promise<{
    currentFilingCount: number;
    delayedFilingCount: number;
    missingFilingCount: number;
    averageFilingAgeDays: number;
  }> {
    try {
      const currentYear = new Date().getFullYear();
      const expectedFY = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      const previousFY = `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`;
      
      // Count companies with current filing
      const [current] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.lastFilingYear, expectedFY));
      
      // Count companies with delayed filing (previous year)
      const [delayed] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.lastFilingYear, previousFY));
      
      // Count companies with missing/very old filing
      const [missing] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcaCompanyMaster)
        .where(sql`${mcaCompanyMaster.lastFilingYear} IS NULL OR ${mcaCompanyMaster.lastFilingYear} NOT IN (${expectedFY}, ${previousFY})`);
      
      // Calculate average filing age in days
      const [avgAge] = await db
        .select({
          avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${mcaCompanyMaster.lastBalanceSheet})) / 86400), 0)`,
        })
        .from(mcaCompanyMaster)
        .where(sql`${mcaCompanyMaster.lastBalanceSheet} IS NOT NULL`);
      
      return {
        currentFilingCount: Number(current?.count || 0),
        delayedFilingCount: Number(delayed?.count || 0),
        missingFilingCount: Number(missing?.count || 0),
        averageFilingAgeDays: Math.round(Number(avgAge?.avgDays || 0)),
      };
    } catch (error: any) {
      console.error('[MCA Cache] Error getting data freshness stats:', error.message);
      return {
        currentFilingCount: 0,
        delayedFilingCount: 0,
        missingFilingCount: 0,
        averageFilingAgeDays: 0,
      };
    }
  }

  /**
   * Search companies in local cache
   */
  async searchCachedCompanies(query: string, limit: number = 20): Promise<McaCompanyMaster[]> {
    if (!query || query.length < 2) return [];

    const searchPattern = `%${query}%`;
    
    return db
      .select()
      .from(mcaCompanyMaster)
      .where(sql`${mcaCompanyMaster.companyName} ILIKE ${searchPattern} OR ${mcaCompanyMaster.cin} ILIKE ${searchPattern}`)
      .limit(limit);
  }
}

export const mcaDataCacheService = new McaDataCacheService();
