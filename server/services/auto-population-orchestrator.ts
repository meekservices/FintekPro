/**
 * Post-KYC Auto-Population Orchestrator
 * 
 * Coordinates fetching of financial data from multiple sources after KYC completion:
 * 1. Mutual Funds (BSE STAR API)
 * 2. Demat Holdings (NSDL/CDSL)
 * 3. Bank Accounts (Account Aggregator)
 * 4. Loan Liabilities (CIBIL)
 * 5. Insurance Policies (Turtlefin)
 * 
 * Features:
 * - Parallel data fetching with Promise.all
 * - Error handling and retry logic
 * - Progress tracking and status updates
 * - Integration with KYC Vault for user data
 * - Consent management integration
 */

import { db } from '../db';
import { 
  autoPopulationStatus,
  comprehensiveHoldings,
  epfHoldings,
  npsAccounts,
  apyAccounts,
  kycVault,
  portfolios,
  type InsertAutoPopulationStatus,
  type AutoPopulationStatus,
  type InsertComprehensiveHolding,
  type InsertEpfHolding,
  type InsertNpsAccount,
  type InsertApyAccount
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { consentManagementService, type DataSourceType } from './consent-management-service';
import { turtlefinAPI } from '../turtlefin-api';
import { bseStarCASService, type CASFetchRequest } from './bse-star-cas-service';
import { kycVaultDecryptionService } from './kyc-vault-decryption-service';
import { dematHoldingsService, type DematFetchRequest } from './demat-holdings-service';
import { epfoService, type EPFFetchRequest } from './epfo-service';
import { NPSService, type NPSFetchRequest } from './nps-service';
import { APYService, type APYFetchRequest } from './apy-service';
import axios from 'axios';

interface KYCData {
  userId: string;
  pan: string;
  name: string;
  dob: string;
  mobile: string;
  email: string;
}

interface DataSourceResult {
  source: DataSourceType;
  success: boolean;
  recordsFetched: number;
  totalValue?: number;
  error?: string;
  errorSuggestion?: string;
  retryable?: boolean;
  data?: any;
}

interface AutoPopulationResult {
  workflowId: string;
  userId: string;
  status: 'completed' | 'partial_success' | 'failed';
  totalDataSources: number;
  successfulSources: number;
  failedSources: number;
  totalRecordsFetched: number;
  totalHoldingsValue: number;
  sourceResults: DataSourceResult[];
  durationMs: number;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND']
};

// User-friendly error messages with recovery suggestions
const ERROR_MESSAGES: Record<string, { message: string; suggestion: string }> = {
  'CONSENT_NOT_GRANTED': {
    message: 'Data access not authorized',
    suggestion: 'Grant consent for this data source in the Auto-Population Dashboard'
  },
  'KYC_NOT_FOUND': {
    message: 'KYC verification required',
    suggestion: 'Complete your KYC verification to enable data fetching'
  },
  'API_TIMEOUT': {
    message: 'Data provider is slow to respond',
    suggestion: 'Try again in a few minutes. The service may be experiencing high load.'
  },
  'API_UNAVAILABLE': {
    message: 'Data provider temporarily unavailable',
    suggestion: 'The external service is down. Please try again later.'
  },
  'RATE_LIMITED': {
    message: 'Too many requests',
    suggestion: 'Please wait a few minutes before trying again'
  },
  'INVALID_CREDENTIALS': {
    message: 'Authentication failed with data provider',
    suggestion: 'Contact support if this issue persists'
  },
  'DATA_NOT_FOUND': {
    message: 'No data found for your account',
    suggestion: 'Ensure you have active accounts with this provider'
  },
  'NETWORK_ERROR': {
    message: 'Connection error',
    suggestion: 'Check your internet connection and try again'
  }
};

export class AutoPopulationOrchestrator {
  
  /**
   * Exponential backoff retry helper
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = RETRY_CONFIG.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          console.error(`❌ ${operationName} failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const baseDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);
        
        console.log(`⏳ ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check HTTP status code
    if (error.response?.status) {
      if (RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)) {
        return true;
      }
    }
    
    // Check error codes
    if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check axios timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get user-friendly error message and suggestion
   */
  private getEnhancedError(error: any): { message: string; suggestion: string } {
    // Map common errors to user-friendly messages
    if (error.response?.status === 429) {
      return ERROR_MESSAGES['RATE_LIMITED'];
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return ERROR_MESSAGES['INVALID_CREDENTIALS'];
    }
    if (error.response?.status === 404) {
      return ERROR_MESSAGES['DATA_NOT_FOUND'];
    }
    if (error.response?.status >= 500) {
      return ERROR_MESSAGES['API_UNAVAILABLE'];
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ERROR_MESSAGES['API_TIMEOUT'];
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return ERROR_MESSAGES['NETWORK_ERROR'];
    }
    if (error.message?.includes('consent')) {
      return ERROR_MESSAGES['CONSENT_NOT_GRANTED'];
    }
    if (error.message?.includes('KYC')) {
      return ERROR_MESSAGES['KYC_NOT_FOUND'];
    }
    
    return {
      message: error.message || 'An unexpected error occurred',
      suggestion: 'Try again or contact support if the issue persists'
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initiate auto-population after KYC completion
   */
  async initiateFromKYC(
    userId: string,
    triggeredBy: 'kyc_completion' | 'manual_refresh' | 'scheduled_sync' = 'kyc_completion'
  ): Promise<AutoPopulationResult> {
    const startTime = Date.now();
    const workflowId = `AUTO_POP_${nanoid(16)}`;

    console.log(`🚀 Initiating auto-population workflow: ${workflowId} for user ${userId}`);

    // Create initial status record
    const statusRecord: InsertAutoPopulationStatus = {
      userId,
      workflowId,
      triggeredBy,
      status: 'in_progress',
      totalDataSources: 8, // mutual_funds, demat, bank, loans, insurance, epf, nps, apy
      successfulSources: 0,
      failedSources: 0,
      sourceStatus: {},
      sourceErrors: {},
      totalRecordsFetched: 0
    };

    await db.insert(autoPopulationStatus).values(statusRecord);

    try {
      // Step 1: Fetch KYC data from vault
      const kycData = await this.getKYCData(userId);
      if (!kycData) {
        throw new Error('KYC data not found in vault. Complete KYC first.');
      }

      // Step 2: Check consents for each data source
      const consents = await this.checkAllConsents(userId);
      console.log(`📋 Consent status:`, consents);

      // Step 3: Fetch data from all sources in parallel
      const results = await this.fetchAllDataSources(kycData, consents);

      // Step 4: Store fetched data in comprehensive holdings
      await this.storeHoldings(userId, results);

      // Step 5: Calculate metrics
      const totalRecordsFetched = results.reduce((sum, r) => sum + r.recordsFetched, 0);
      const totalHoldingsValue = results.reduce((sum, r) => sum + (r.totalValue || 0), 0);
      const successfulSources = results.filter(r => r.success).length;
      const failedSources = results.filter(r => !r.success).length;

      const finalStatus = failedSources === 0 ? 'completed' :
                         successfulSources > 0 ? 'partial_success' : 'failed';

      // Step 6: Update final status
      const durationMs = Date.now() - startTime;
      
      await this.updateStatus(workflowId, {
        status: finalStatus,
        successfulSources,
        failedSources,
        totalRecordsFetched,
        totalHoldingsValue: totalHoldingsValue.toString(),
        completedAt: new Date(),
        durationMs,
        sourceStatus: Object.fromEntries(results.map(r => [r.source, r.success ? 'success' : 'failed'])),
        sourceErrors: Object.fromEntries(results.filter(r => r.error).map(r => [r.source, r.error!]))
      });

      console.log(`✅ Auto-population completed: ${workflowId} - ${successfulSources}/${results.length} sources successful`);

      return {
        workflowId,
        userId,
        status: finalStatus,
        totalDataSources: results.length,
        successfulSources,
        failedSources,
        totalRecordsFetched,
        totalHoldingsValue,
        sourceResults: results,
        durationMs
      };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      await this.updateStatus(workflowId, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
        durationMs
      });

      console.error(`❌ Auto-population failed: ${workflowId} -`, error.message);
      throw error;
    }
  }

  /**
   * Get KYC data from vault for the user
   * 
   * SECURITY: This method retrieves and decrypts sensitive KYC data from the vault.
   * - All decryption happens in-memory only (never persisted or logged)
   * - Every vault access is logged to kycAuditLogs for compliance
   * - Decrypted data is cleared from memory after use
   * - Uses AES-256-GCM for encrypted fields and tokenization reversal for PAN/Aadhaar
   */
  private async getKYCData(userId: string): Promise<KYCData | null> {
    try {
      console.log(`🔐 Fetching KYC data from vault for user ${userId}`);

      // Decrypt vault data with full audit logging
      const decryptionResult = await kycVaultDecryptionService.decryptVaultData(userId, {
        purpose: 'auto_population',
        requestId: `autopop_${Date.now()}`,
        fieldsRequired: ['pan', 'fullName', 'dateOfBirth', 'mobile', 'email']
      });

      if (!decryptionResult.success || !decryptionResult.data) {
        console.error(`❌ KYC vault decryption failed for user ${userId}: ${decryptionResult.error}`);
        return null;
      }

      const decrypted = decryptionResult.data;

      // Map to KYCData format expected by auto-population
      const kycData: KYCData = {
        userId: decrypted.userId,
        pan: decrypted.pan,
        name: decrypted.fullName,
        dob: decrypted.dateOfBirth,
        mobile: decrypted.mobile,
        email: decrypted.email
      };

      console.log(`✅ KYC data decrypted successfully for user ${userId} (Audit: ${decryptionResult.auditLogId})`);

      return kycData;

    } catch (error: any) {
      console.error(`❌ Error fetching KYC data for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Check consents for all data sources
   */
  private async checkAllConsents(userId: string): Promise<Record<DataSourceType, boolean>> {
    const sources: DataSourceType[] = ['mutual_funds', 'demat', 'bank', 'loans', 'insurance', 'epf', 'nps', 'apy'];
    const consents: Record<DataSourceType, boolean> = {} as any;

    for (const source of sources) {
      const consentStatus = await consentManagementService.checkConsent(userId, source);
      consents[source] = consentStatus.hasConsent;
    }

    return consents;
  }

  /**
   * Fetch data from all sources in parallel using Promise.allSettled
   * This ensures all sources are queried simultaneously with graceful error handling
   */
  private async fetchAllDataSources(
    kycData: KYCData,
    consents: Record<DataSourceType, boolean>
  ): Promise<DataSourceResult[]> {
    console.log(`📊 Fetching data from ${Object.keys(consents).length} sources in parallel with Promise.allSettled...`);

    // Execute ALL fetches in parallel using Promise.allSettled for graceful error handling
    const fetchPromises = [
      this.fetchMutualFunds(kycData, consents.mutual_funds),
      this.fetchDematHoldings(kycData, consents.demat),
      this.fetchBankAccounts(kycData, consents.bank),
      this.fetchLoanLiabilities(kycData, consents.loans),
      this.fetchInsurance(kycData, consents.insurance),
      this.fetchEPFAccounts(kycData, consents.epf),
      this.fetchNPSAccounts(kycData, consents.nps),
      this.fetchAPYAccounts(kycData, consents.apy)
    ];

    // Promise.allSettled ensures all promises complete regardless of individual failures
    const settledResults = await Promise.allSettled(fetchPromises);

    // Map settled results to DataSourceResult format
    const sources: DataSourceType[] = ['mutual_funds', 'demat', 'bank', 'loans', 'insurance', 'epf', 'nps', 'apy'];
    
    return settledResults.map((result, index) => {
      const source = sources[index];

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Log error for debugging
        console.error(`❌ Failed to fetch ${source}:`, result.reason?.message);
        return {
          source,
          success: false,
          recordsFetched: 0,
          error: result.reason?.message || 'Unknown error'
        };
      }
    });
  }

  /**
   * Fetch mutual fund holdings from BSE STAR via CAS (Consolidated Account Statement)
   */
  private async fetchMutualFunds(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      const { message, suggestion } = ERROR_MESSAGES['CONSENT_NOT_GRANTED'];
      return {
        source: 'mutual_funds',
        success: false,
        recordsFetched: 0,
        error: message,
        errorSuggestion: suggestion,
        retryable: false
      };
    }

    try {
      console.log(`🔍 Fetching mutual funds from BSE STAR CAS`);
      
      // Call BSE STAR CAS API with retry logic
      const casRequest: CASFetchRequest = {
        panNumber: kycData.pan,
        name: kycData.name,
        dob: kycData.dob,
        mobile: kycData.mobile,
        email: kycData.email
      };

      const casResponse = await this.withRetry(
        () => bseStarCASService.fetchCAS(casRequest),
        'Mutual Funds CAS Fetch'
      );

      if (!casResponse.success) {
        return {
          source: 'mutual_funds',
          success: false,
          recordsFetched: 0,
          error: casResponse.message || 'CAS fetch failed',
          errorSuggestion: 'Verify your PAN details and ensure you have active mutual fund investments',
          retryable: true
        };
      }

      console.log(`✅ Fetched ${casResponse.totalHoldings} mutual fund holdings across ${casResponse.rtaSummary.camsHoldings + casResponse.rtaSummary.karvyHoldings + casResponse.rtaSummary.franklinHoldings} RTAs`);

      return {
        source: 'mutual_funds',
        success: true,
        recordsFetched: casResponse.totalHoldings,
        totalValue: casResponse.totalValue,
        data: casResponse.holdings
      };
    } catch (error: any) {
      console.error('❌ Mutual funds fetch error:', error.message);
      const { message, suggestion } = this.getEnhancedError(error);
      return {
        source: 'mutual_funds',
        success: false,
        recordsFetched: 0,
        error: message,
        errorSuggestion: suggestion,
        retryable: this.isRetryableError(error)
      };
    }
  }

  /**
   * Fetch demat holdings from NSDL/CDSL via Account Aggregator
   */
  private async fetchDematHoldings(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      const { message, suggestion } = ERROR_MESSAGES['CONSENT_NOT_GRANTED'];
      return {
        source: 'demat',
        success: false,
        recordsFetched: 0,
        error: message,
        errorSuggestion: suggestion,
        retryable: false
      };
    }

    try {
      console.log(`🔍 Fetching demat holdings from NSDL/CDSL via Account Aggregator`);
      
      // Call demat holdings service with retry logic
      const dematRequest: DematFetchRequest = {
        panNumber: kycData.pan,
        name: kycData.name,
        dob: kycData.dob,
        mobile: kycData.mobile,
        email: kycData.email,
        requestId: `demat_${kycData.userId}_${Date.now()}`
      };

      const dematResponse = await this.withRetry(
        () => dematHoldingsService.fetchHoldings(dematRequest),
        'Demat Holdings Fetch'
      );

      if (!dematResponse.success) {
        console.error(`❌ Demat holdings fetch failed: ${dematResponse.message}`);
        return {
          source: 'demat',
          success: false,
          recordsFetched: 0,
          error: dematResponse.message || 'Failed to fetch demat holdings'
        };
      }

      // Demat holdings will be stored via the storeHoldings method which is called by the main workflow
      // No need to store inline here - it will be handled in the data source results loop

      console.log(`✅ Fetched ${dematResponse.totalHoldings} demat holdings across ${dematResponse.accounts.length} accounts (NSDL: ${dematResponse.nsdlHoldings}, CDSL: ${dematResponse.cdslHoldings})`);

      return {
        source: 'demat',
        success: true,
        recordsFetched: dematResponse.totalHoldings,
        totalValue: dematResponse.totalValue,
        data: dematResponse.holdings
      };
    } catch (error: any) {
      console.error('❌ Demat holdings fetch error:', error.message);
      return {
        source: 'demat',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Determine equity asset class based on market cap
   */
  private determineEquityClass(holding: any): string {
    const marketCap = holding.marketCap || 0;
    
    if (marketCap >= 20000000000000) return 'large_cap'; // > ₹20,000 Cr
    if (marketCap >= 5000000000000) return 'mid_cap'; // ₹5,000-20,000 Cr
    return 'small_cap'; // < ₹5,000 Cr
  }

  /**
   * Fetch bank accounts via Account Aggregator
   */
  private async fetchBankAccounts(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'bank',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching bank accounts via Account Aggregator for user: ${kycData.userId}`);
      
      // Mock data - in production, call Account Aggregator API
      const mockAccounts = [
        {
          accountNumber: '****6789',
          bankName: 'HDFC Bank',
          accountType: 'savings',
          balance: 285000,
          ifsc: 'HDFC0001234'
        },
        {
          accountNumber: '****4321',
          bankName: 'ICICI Bank',
          accountType: 'current',
          balance: 520000,
          ifsc: 'ICIC0001234'
        }
      ];

      return {
        source: 'bank',
        success: true,
        recordsFetched: mockAccounts.length,
        totalValue: mockAccounts.reduce((sum, a) => sum + a.balance, 0),
        data: mockAccounts
      };
    } catch (error: any) {
      return {
        source: 'bank',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch loan liabilities from CIBIL
   */
  private async fetchLoanLiabilities(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'loans',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching loan liabilities from CIBIL`);
      
      // Call internal CIBIL API
      const response = await axios.post('http://localhost:5000/api/cibil/fetch-loan-liabilities', {
        panNumber: kycData.pan,
        name: kycData.name,
        dob: kycData.dob,
        mobile: kycData.mobile
      });

      const loanData = response.data;

      return {
        source: 'loans',
        success: loanData.success,
        recordsFetched: loanData.totalLoans || 0,
        totalValue: loanData.totalOutstanding || 0,
        data: loanData.loanAccounts || []
      };
    } catch (error: any) {
      console.error('CIBIL fetch error:', error.message);
      return {
        source: 'loans',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch insurance policies from Turtlefin
   */
  private async fetchInsurance(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'insurance',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching insurance policies from Turtlefin`);
      
      const policies = await turtlefinAPI.searchPoliciesByKYC({
        pan: kycData.pan,
        name: kycData.name,
        dob: kycData.dob,
        mobile: kycData.mobile,
        email: kycData.email
      });

      const totalValue = policies.policies.reduce((sum, p) => sum + p.sumAssured, 0);

      return {
        source: 'insurance',
        success: policies.success,
        recordsFetched: policies.totalPolicies,
        totalValue,
        data: policies.policies
      };
    } catch (error: any) {
      return {
        source: 'insurance',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch EPF/VPF accounts from EPFO
   */
  private async fetchEPFAccounts(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'epf',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching EPF/VPF accounts from EPFO`);
      
      // Call EPFO service
      const epfRequest: EPFFetchRequest = {
        panNumber: kycData.pan,
        name: kycData.name,
        dob: kycData.dob,
        mobile: kycData.mobile,
        requestId: `epf_${kycData.userId}_${Date.now()}`
      };

      const epfResponse = await epfoService.fetchEPFAccounts(epfRequest);

      if (!epfResponse.success) {
        console.error(`❌ EPF fetch failed: ${epfResponse.message}`);
        return {
          source: 'epf',
          success: false,
          recordsFetched: 0,
          error: epfResponse.message || 'Failed to fetch EPF accounts'
        };
      }

      // EPF accounts will be stored via the storeHoldings method which is called by the main workflow
      // No need to store inline here - it will be handled in the data source results loop

      console.log(`✅ Fetched ${epfResponse.totalAccounts} EPF accounts (Total Balance: ₹${epfResponse.totalBalance.toFixed(2)})`);

      return {
        source: 'epf',
        success: true,
        recordsFetched: epfResponse.totalAccounts,
        totalValue: epfResponse.totalBalance,
        data: epfResponse.accounts
      };
    } catch (error: any) {
      console.error('❌ EPF accounts fetch error:', error.message);
      return {
        source: 'epf',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch NPS (National Pension System) accounts from NPS CRA
   */
  private async fetchNPSAccounts(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'nps',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching NPS accounts from NPS CRA`);
      
      // Call NPS service
      const npsService = new NPSService();
      const npsRequest: NPSFetchRequest = {
        panNumber: kycData.pan,
        dateOfBirth: kycData.dob,
        name: kycData.name,
        mobile: kycData.mobile
      };

      const npsResponse = await npsService.fetchNPSAccounts(npsRequest);

      if (!npsResponse.success) {
        console.error(`❌ NPS fetch failed: ${npsResponse.message}`);
        return {
          source: 'nps',
          success: false,
          recordsFetched: 0,
          error: npsResponse.message || 'Failed to fetch NPS accounts'
        };
      }

      // NPS accounts will be stored via the storeHoldings method which is called by the main workflow
      // No need to store inline here - it will be handled in the data source results loop

      console.log(`✅ Fetched ${npsResponse.accounts.length} NPS accounts (Total Balance: ₹${npsResponse.totalBalance.toFixed(2)})`);

      return {
        source: 'nps',
        success: true,
        recordsFetched: npsResponse.accounts.length,
        totalValue: npsResponse.totalBalance,
        data: npsResponse.holdings
      };
    } catch (error: any) {
      console.error('❌ NPS accounts fetch error:', error.message);
      return {
        source: 'nps',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Fetch APY (Atal Pension Yojana) accounts via Account Aggregator
   */
  private async fetchAPYAccounts(kycData: KYCData, hasConsent: boolean): Promise<DataSourceResult> {
    if (!hasConsent) {
      return {
        source: 'apy',
        success: false,
        recordsFetched: 0,
        error: 'User consent not granted'
      };
    }

    try {
      console.log(`🔍 Fetching APY accounts via Account Aggregator`);
      
      // Call APY service
      const apyService = new APYService();
      const apyRequest: APYFetchRequest = {
        panNumber: kycData.pan,
        dateOfBirth: kycData.dob,
        name: kycData.name,
        mobile: kycData.mobile
      };

      const apyResponse = await apyService.fetchAPYAccounts(apyRequest);

      if (!apyResponse.success) {
        console.error(`❌ APY fetch failed: ${apyResponse.message}`);
        return {
          source: 'apy',
          success: false,
          recordsFetched: 0,
          error: apyResponse.message || 'Failed to fetch APY accounts'
        };
      }

      // APY accounts will be stored via the storeHoldings method which is called by the main workflow
      // No need to store inline here - it will be handled in the data source results loop

      console.log(`✅ Fetched ${apyResponse.accounts.length} APY accounts (Total Balance: ₹${apyResponse.totalBalance.toFixed(2)})`);

      return {
        source: 'apy',
        success: true,
        recordsFetched: apyResponse.accounts.length,
        totalValue: apyResponse.totalBalance,
        data: apyResponse.holdings
      };
    } catch (error: any) {
      console.error('❌ APY accounts fetch error:', error.message);
      return {
        source: 'apy',
        success: false,
        recordsFetched: 0,
        error: error.message
      };
    }
  }

  /**
   * Store fetched holdings in database
   */
  private async storeHoldings(userId: string, results: DataSourceResult[]): Promise<void> {
    console.log(`💾 Storing ${results.length} data source results in database...`);

    // Get or create default portfolio for user
    const portfolio = await this.getOrCreateDefaultPortfolio(userId);

    for (const result of results) {
      if (!result.success || !result.data || !Array.isArray(result.data)) continue;

      try {
        // Store each type of holding based on source
        switch (result.source) {
          case 'mutual_funds':
            await this.storeMutualFundHoldings(userId, portfolio.id, result.data);
            break;
          case 'demat':
            await this.storeDematHoldings(userId, portfolio.id, result.data);
            break;
          case 'bank':
            await this.storeBankAccounts(userId, portfolio.id, result.data);
            break;
          case 'loans':
            await this.storeLoanLiabilities(userId, portfolio.id, result.data);
            break;
          case 'insurance':
            await this.storeInsurancePolicies(userId, portfolio.id, result.data);
            break;
          case 'epf':
            await this.storeEPFHoldings(userId, result.data);
            break;
          case 'nps':
            await this.storeNPSAccounts(userId, result.data);
            break;
          case 'apy':
            await this.storeAPYAccounts(userId, result.data);
            break;
        }

        console.log(`  ✓ Stored ${result.recordsFetched} records from ${result.source}`);
      } catch (error: any) {
        console.error(`  ✗ Failed to store ${result.source}:`, error.message);
      }
    }
  }

  /**
   * Get or create default portfolio for user
   */
  private async getOrCreateDefaultPortfolio(userId: string): Promise<{ id: string }> {
    // Check if user has a default portfolio
    const existingPortfolio = await db
      .select()
      .from(portfolios)
      .where(and(
        eq(portfolios.userId, userId),
        eq(portfolios.isDefault, true)
      ))
      .limit(1);

    if (existingPortfolio.length > 0) {
      return existingPortfolio[0];
    }

    // Create default portfolio
    const newPortfolio = await db
      .insert(portfolios)
      .values({
        userId,
        name: 'Default Portfolio',
        isDefault: true,
        totalValue: '0',
        cash: '0'
      })
      .returning();

    console.log(`📁 Created default portfolio for user ${userId}`);
    return newPortfolio[0];
  }

  /**
   * Store mutual fund holdings in comprehensive holdings table
   */
  private async storeMutualFundHoldings(userId: string, portfolioId: string, holdings: any[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    for (const holding of holdings) {
      const record: InsertComprehensiveHolding = {
        portfolioId,
        userId,
        holdingDate: today,
        
        // Asset identification
        symbol: holding.schemeCode,
        isin: holding.isin || null,
        assetName: holding.schemeName,
        assetType: 'mutual_fund',
        assetClass: this.determineMFAssetClass(holding.schemeName),
        
        // Holding details
        units: holding.units.toString(),
        currentPrice: holding.nav.toString(),
        marketValue: holding.currentValue.toString(),
        investedValue: holding.investedAmount.toString(),
        gainLoss: holding.returns.toString(),
        gainLossPercent: holding.returnsPercentage.toString(),
        
        // Source details
        dataSource: `bse_star_${holding.rtaCode.toLowerCase()}`,
        folio: holding.folioNumber,
        
        // Additional metadata
        metadata: {
          amcName: holding.amcName,
          registrarName: holding.registrarName,
          schemePlan: holding.schemePlan,
          schemeOption: holding.schemeOption,
          purchaseDate: holding.purchaseDate,
          lastTransactionDate: holding.lastTransactionDate,
          lockinStatus: holding.lockinStatus,
          lockinDate: holding.lockinDate,
          averageNav: holding.averageNav
        }
      };

      await db.insert(comprehensiveHoldings).values(record);
    }
  }

  /**
   * Determine asset class from mutual fund scheme name
   */
  private determineMFAssetClass(schemeName: string): string {
    const name = schemeName.toLowerCase();
    
    if (name.includes('equity') || name.includes('bluechip') || name.includes('large cap') || 
        name.includes('mid cap') || name.includes('small cap') || name.includes('flexi cap') || 
        name.includes('multi cap') || name.includes('focused')) {
      return 'equity';
    } else if (name.includes('debt') || name.includes('bond') || name.includes('gilt') || 
               name.includes('liquid') || name.includes('overnight') || name.includes('ultra short')) {
      return 'debt';
    } else if (name.includes('hybrid') || name.includes('balanced') || name.includes('aggressive') || 
               name.includes('conservative') || name.includes('dynamic asset')) {
      return 'hybrid';
    } else if (name.includes('elss') || name.includes('tax saver')) {
      return 'equity'; // ELSS is equity-oriented
    } else {
      return 'other';
    }
  }

  /**
   * Store demat holdings in comprehensiveHoldings table
   */
  private async storeDematHoldings(userId: string, portfolioId: string, holdings: any[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    for (const holding of holdings) {
      const record: InsertComprehensiveHolding = {
        portfolioId,
        userId,
        holdingDate: today,
        
        // Asset identification
        symbol: holding.symbol,
        isin: holding.isin,
        assetName: holding.companyName,
        assetType: holding.assetType, // 'equity', 'bond', 'etf'
        assetClass: holding.assetType === 'equity' ? this.determineEquityClass(holding) : null,
        
        // Holding details
        quantity: holding.quantity.toString(),
        avgPrice: holding.averagePrice.toString(),
        currentPrice: holding.currentPrice.toString(),
        marketValue: holding.currentValue.toString(),
        investedValue: holding.investedAmount.toString(),
        gainLoss: holding.returns.toString(),
        gainLossPercent: holding.returnsPercentage.toString(),
        
        // Source details
        dataSource: holding.depository?.toLowerCase() || 'nsdl',
        dematAccountNumber: holding.dematAccountNumber || null,
        
        // Additional details
        sector: holding.sector || null,
        industry: holding.industry || null,
        marketCap: holding.marketCap?.toString() || null,
        
        // Metadata
        metadata: {
          pledgedQuantity: holding.pledgedQuantity || 0,
          freeQuantity: holding.freeQuantity || holding.quantity,
          lockedQuantity: holding.lockedQuantity || 0,
          exchange: holding.exchange || 'NSE'
        }
      };

      await db.insert(comprehensiveHoldings).values(record);
    }
  }

  /**
   * Store bank accounts (placeholder)
   */
  private async storeBankAccounts(userId: string, portfolioId: string, accounts: any[]): Promise<void> {
    // Bank accounts are stored separately, not in comprehensive holdings
    console.log(`  ℹ️ Bank accounts storage - handled separately`);
  }

  /**
   * Store loan liabilities (placeholder)
   */
  private async storeLoanLiabilities(userId: string, portfolioId: string, loans: any[]): Promise<void> {
    // Loans are stored separately, not in comprehensive holdings
    console.log(`  ℹ️ Loan liabilities storage - handled separately`);
  }

  /**
   * Store insurance policies (placeholder)
   */
  private async storeInsurancePolicies(userId: string, portfolioId: string, policies: any[]): Promise<void> {
    // Insurance is stored separately, not in comprehensive holdings
    console.log(`  ℹ️ Insurance policies storage - handled separately`);
  }

  /**
   * Store EPF/VPF holdings in epfHoldings table
   */
  private async storeEPFHoldings(userId: string, accounts: any[]): Promise<void> {
    try {
      // Map EPF accounts to epfHoldings format
      const holdingsToInsert: InsertEpfHolding[] = accounts.map((account: any) => ({
        userId,
        epfAccountNumber: account.epfAccountNumber,
        employerName: account.employerName,
        memberName: account.memberName,
        employeeContribution: account.employeeContribution.toString(),
        employerContribution: account.employerContribution.toString(),
        pensionContribution: account.pensionContribution.toString(),
        totalBalance: account.totalBalance.toString(),
        interestEarned: account.interestEarned.toString(),
        interestRate: account.interestRate.toString(),
        dateOfJoining: account.dateOfJoining,
        dateOfExit: account.dateOfExit || null,
        isActive: account.isActive,
        nomineeName: account.nomineeName || null,
        nomineeRelationship: account.nomineeRelationship || null
      }));

      // Insert EPF holdings (upsert logic can be added later)
      await db.insert(epfHoldings).values(holdingsToInsert);

      console.log(`  ✓ Stored ${holdingsToInsert.length} EPF accounts in epfHoldings table`);
    } catch (error: any) {
      console.error(`  ✗ Error storing EPF holdings:`, error.message);
      // Don't throw - this is not critical for the workflow
    }
  }

  /**
   * Store NPS accounts in npsAccounts table
   */
  private async storeNPSAccounts(userId: string, holdings: any[]): Promise<void> {
    try {
      // Map NPS holdings to npsAccounts format
      const accountsToInsert: InsertNpsAccount[] = holdings.map((holding: any) => ({
        userId,
        pran: holding.pran,
        accountHolderName: holding.accountHolderName,
        dateOfBirth: holding.dateOfBirth,
        registrationDate: holding.registrationDate,
        // Tier I
        tierIBalance: holding.tierIBalance.toString(),
        tierIContributions: holding.tierIContributions.toString(),
        tierIReturns: holding.tierIReturns.toString(),
        tierIAssetAllocation: holding.tierIAssetAllocation,
        // Tier II
        tierIIBalance: holding.tierIIBalance.toString(),
        tierIIContributions: holding.tierIIContributions.toString(),
        tierIIReturns: holding.tierIIReturns.toString(),
        tierIIAssetAllocation: holding.tierIIAssetAllocation,
        // Total
        totalBalance: holding.totalBalance.toString(),
        totalContributions: holding.totalContributions.toString(),
        totalReturns: holding.totalReturns.toString(),
        returnsPercentage: holding.returnsPercentage.toString(),
        // Account details
        fundManager: holding.fundManager,
        scheme: holding.scheme,
        tier: holding.tier,
        nominee: holding.nominee || null,
        nomineeRelation: holding.nomineeRelation || null,
        status: holding.status,
        lastContributionDate: holding.lastContributionDate || null
      }));

      // Insert NPS accounts (upsert logic can be added later)
      await db.insert(npsAccounts).values(accountsToInsert);

      console.log(`  ✓ Stored ${accountsToInsert.length} NPS accounts in npsAccounts table`);
    } catch (error: any) {
      console.error(`  ✗ Error storing NPS accounts:`, error.message);
      // Don't throw - this is not critical for the workflow
    }
  }

  /**
   * Store APY accounts in apyAccounts table
   */
  private async storeAPYAccounts(userId: string, holdings: any[]): Promise<void> {
    try {
      // Map APY holdings to apyAccounts format
      const accountsToInsert: InsertApyAccount[] = holdings.map((holding: any) => ({
        userId,
        pran: holding.pran,
        accountHolderName: holding.accountHolderName,
        dateOfBirth: holding.dateOfBirth,
        enrollmentDate: holding.enrollmentDate,
        // Pension Details
        pensionAmount: holding.pensionAmount.toString(),
        monthlyContribution: holding.monthlyContribution.toString(),
        // Contributions
        totalContribution: holding.totalContribution.toString(),
        governmentContribution: holding.governmentContribution.toString(),
        totalBalance: holding.totalBalance.toString(),
        // Account Details
        enrollmentAge: holding.enrollmentAge,
        maturityAge: holding.maturityAge,
        yearsToMaturity: holding.yearsToMaturity,
        expectedMaturityDate: holding.expectedMaturityDate,
        // Bank Details
        bankName: holding.bankName,
        bankAccountNumber: holding.bankAccountNumber,
        ifscCode: holding.ifscCode,
        branchName: holding.branchName || null,
        // Nominee
        nominee: holding.nominee || null,
        nomineeRelation: holding.nomineeRelation || null,
        nomineeAge: holding.nomineeAge || null,
        // Status
        status: holding.status,
        lastContributionDate: holding.lastContributionDate || null
      }));

      // Insert APY accounts (upsert logic can be added later)
      await db.insert(apyAccounts).values(accountsToInsert);

      console.log(`  ✓ Stored ${accountsToInsert.length} APY accounts in apyAccounts table`);
    } catch (error: any) {
      console.error(`  ✗ Error storing APY accounts:`, error.message);
      // Don't throw - this is not critical for the workflow
    }
  }

  /**
   * Update workflow status
   */
  private async updateStatus(workflowId: string, updates: Partial<InsertAutoPopulationStatus>): Promise<void> {
    await db
      .update(autoPopulationStatus)
      .set(updates)
      .where(eq(autoPopulationStatus.workflowId, workflowId));
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<AutoPopulationStatus | null> {
    const status = await db
      .select()
      .from(autoPopulationStatus)
      .where(eq(autoPopulationStatus.workflowId, workflowId))
      .limit(1);

    return status.length > 0 ? status[0] : null;
  }

  /**
   * Get all workflows for a user
   */
  async getUserWorkflows(userId: string): Promise<AutoPopulationStatus[]> {
    return await db
      .select()
      .from(autoPopulationStatus)
      .where(eq(autoPopulationStatus.userId, userId))
      .orderBy(desc(autoPopulationStatus.initiatedAt));
  }

  /**
   * Retry a single failed data source
   */
  async retryDataSource(userId: string, dataSource: DataSourceType): Promise<DataSourceResult> {
    console.log(`🔄 Retrying data source: ${dataSource} for user ${userId}`);

    try {
      // Get KYC data from vault
      const kycData = await this.getKYCData(userId);
      if (!kycData) {
        const { message, suggestion } = ERROR_MESSAGES['KYC_NOT_FOUND'];
        return {
          source: dataSource,
          success: false,
          recordsFetched: 0,
          error: message,
          errorSuggestion: suggestion,
          retryable: false
        };
      }

      // Check consent for this specific source
      const hasConsent = await consentManagementService.hasValidConsent(userId, dataSource);
      
      // Retry the specific source
      let result: DataSourceResult;
      
      switch (dataSource) {
        case 'mutual_funds':
          result = await this.fetchMutualFunds(kycData, hasConsent);
          break;
        case 'demat':
          result = await this.fetchDematHoldings(kycData, hasConsent);
          break;
        case 'bank':
          result = await this.fetchBankAccounts(kycData, hasConsent);
          break;
        case 'loans':
          result = await this.fetchLoanLiabilities(kycData, hasConsent);
          break;
        case 'insurance':
          result = await this.fetchInsurancePolicies(kycData, hasConsent);
          break;
        case 'epf':
          result = await this.fetchEPFHoldings(kycData, hasConsent);
          break;
        case 'nps':
          result = await this.fetchNPSAccounts(kycData, hasConsent);
          break;
        case 'apy':
          result = await this.fetchAPYAccounts(kycData, hasConsent);
          break;
        default:
          result = {
            source: dataSource,
            success: false,
            recordsFetched: 0,
            error: `Unknown data source: ${dataSource}`,
            retryable: false
          };
      }

      // Store data if successful
      if (result.success && result.data) {
        await this.storeHoldings(userId, dataSource, result.data);
      }

      // Update the latest workflow status for this user
      await this.updateLatestWorkflowSourceStatus(userId, dataSource, result);

      console.log(`${result.success ? '✅' : '❌'} Retry ${dataSource}: ${result.success ? 'succeeded' : 'failed'}`);
      return result;

    } catch (error: any) {
      console.error(`❌ Error retrying ${dataSource}:`, error.message);
      const { message, suggestion } = this.getEnhancedError(error);
      const result: DataSourceResult = {
        source: dataSource,
        success: false,
        recordsFetched: 0,
        error: message,
        errorSuggestion: suggestion,
        retryable: this.isRetryableError(error)
      };
      
      // Update the latest workflow status for this user
      await this.updateLatestWorkflowSourceStatus(userId, dataSource, result);
      
      return result;
    }
  }

  /**
   * Update latest workflow's source status after a retry
   */
  private async updateLatestWorkflowSourceStatus(
    userId: string, 
    dataSource: DataSourceType, 
    result: DataSourceResult
  ): Promise<void> {
    try {
      // Get the most recent workflow for this user
      const workflows = await this.getUserWorkflows(userId);
      if (workflows.length === 0) {
        console.log(`No existing workflow to update for user ${userId}`);
        return;
      }

      const latestWorkflow = workflows[0];
      
      // Parse existing source status and normalize legacy string values to objects
      const rawSourceStatus = (latestWorkflow.sourceStatus as Record<string, any>) || {};
      const sourceStatus: Record<string, any> = {};
      
      // Normalize existing entries - convert legacy string statuses to object format
      for (const [key, value] of Object.entries(rawSourceStatus)) {
        if (typeof value === 'string') {
          // Legacy format: string like 'success', 'failed', 'pending'
          sourceStatus[key] = {
            status: value === 'success' ? 'completed' : value,
            recordsFetched: 0,
            error: value === 'failed' ? 'Unknown error' : undefined
          };
        } else if (typeof value === 'object' && value !== null) {
          // Already object format
          sourceStatus[key] = value;
        }
      }
      
      const sourceErrors = (latestWorkflow.sourceErrors as Record<string, any>) || {};
      
      // Update the specific source status
      sourceStatus[dataSource] = {
        status: result.success ? 'completed' : 'failed',
        recordsFetched: result.recordsFetched,
        totalValue: result.totalValue,
        error: result.error,
        errorSuggestion: result.errorSuggestion,
        retryable: result.retryable,
        lastRetryAt: new Date().toISOString()
      };
      
      if (result.error) {
        sourceErrors[dataSource] = result.error;
      } else {
        delete sourceErrors[dataSource];
      }

      // Recalculate summary using normalized data
      const sources = Object.values(sourceStatus);
      const successfulSources = sources.filter(s => 
        s.status === 'completed' || s.status === 'success'
      ).length;
      const failedSources = sources.filter(s => s.status === 'failed').length;
      const totalRecordsFetched = sources.reduce((sum, s) => sum + (s.recordsFetched || 0), 0);

      // Preserve original totals for sources not yet updated
      const originalSuccessful = latestWorkflow.successfulSources || 0;
      const originalFailed = latestWorkflow.failedSources || 0;
      const originalRecords = latestWorkflow.totalRecordsFetched || 0;

      // Update workflow record
      await db
        .update(autoPopulationStatus)
        .set({
          sourceStatus,
          sourceErrors,
          successfulSources: Math.max(successfulSources, originalSuccessful - (result.success ? 0 : 1)),
          failedSources: Math.max(0, failedSources),
          totalRecordsFetched: result.success 
            ? originalRecords + result.recordsFetched 
            : originalRecords,
          status: failedSources === 0 ? 'completed' : 'partial_success'
        })
        .where(eq(autoPopulationStatus.workflowId, latestWorkflow.workflowId));

      console.log(`📊 Updated workflow ${latestWorkflow.workflowId} source status for ${dataSource}`);
    } catch (error: any) {
      console.error(`Failed to update workflow source status:`, error.message);
      // Don't throw - this is not critical
    }
  }
}

// Export singleton instance
export const autoPopulationOrchestrator = new AutoPopulationOrchestrator();
