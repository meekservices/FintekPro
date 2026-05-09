/**
 * CKYC Provider Resolution Service
 * 
 * Config-Based Provider Switching with Runtime Resolution
 * Implements SEBI-compliant fallback chain with health checks
 * 
 * PRODUCTION SAFETY:
 * - Mock provider is COMPLETELY DISABLED in PROD environment
 * - All blocked attempts are logged as security events
 * - CKYC_DEFERRED status emitted when all providers exhausted
 * 
 * Provider Priority (default):
 * 1. TruthScreen (API-based)
 * 2. CERSAI Reference (Manual verification)
 * 3. Offline Aadhaar XML (Document-based)
 * 4. Video KYC (V-KYC)
 * 5. Manual (Admin-assisted)
 */

import { db } from "../db";
import { ckycProviderConfig, ckycProviderAuditLog, ckycVerificationRequests, users } from "@shared/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { ckycEnvironmentService, type CkycVerificationStatus, type CkycDeferralReason } from "./ckyc-environment-service";

// Provider codes
export type CkycProviderCode = 
  | 'truthscreen' 
  | 'cersai_reference' 
  | 'vkyc' 
  | 'manual';

// Default provider configurations
const DEFAULT_PROVIDERS: Array<{
  providerCode: CkycProviderCode;
  providerName: string;
  providerDescription: string;
  priority: number;
  eligibilityRules: Record<string, unknown>;
}> = [
  {
    providerCode: 'truthscreen',
    providerName: 'TruthScreen CKYC API',
    providerDescription: 'Primary CKYC verification via TruthScreen API with real-time KRA lookup',
    priority: 1,
    eligibilityRules: {
      requiresAadhaarConsent: false,
      allowedRiskCategories: ['low', 'medium', 'high'],
      requiresApiCredentials: true,
    },
  },
  {
    providerCode: 'cersai_reference',
    providerName: 'CERSAI Reference CKYC',
    providerDescription: 'CKYC verification using existing CKYC reference number from CERSAI registry',
    priority: 2,
    eligibilityRules: {
      requiresAadhaarConsent: false,
      allowedRiskCategories: ['low', 'medium'],
      requiresCkycReference: true,
    },
  },
  {
    providerCode: 'vkyc',
    providerName: 'Video KYC (V-KYC)',
    providerDescription: 'Live video verification with geo-tagging and PAN verification',
    priority: 3,
    eligibilityRules: {
      requiresAadhaarConsent: false,
      allowedRiskCategories: ['low', 'medium', 'high'],
      requiresLiveSession: true,
    },
  },
  {
    providerCode: 'manual',
    providerName: 'Manual CKYC',
    providerDescription: 'Admin-assisted manual CKYC verification with mandatory justification',
    priority: 4,
    eligibilityRules: {
      requiresAadhaarConsent: false,
      allowedRiskCategories: ['low', 'medium', 'high'],
      requiresAdminApproval: true,
      requiresJustification: true,
    },
  },
];

// Client eligibility context
interface ClientEligibilityContext {
  userId: string;
  panNumber: string;
  hasAadhaarConsent?: boolean;
  hasCkycReference?: boolean;
  riskCategory?: 'low' | 'medium' | 'high';
  canDoVideoKyc?: boolean;
}

// Fallback attempt record
interface FallbackAttempt {
  provider: string;
  reason: string;
  timestamp: string;
}

// Provider resolution result
interface ProviderResolutionResult {
  selectedProvider: CkycProviderCode | 'none';
  providerName: string;
  selectionReason: string;
  fallbackChain: CkycProviderCode[];
  fallbackAttempts: FallbackAttempt[];
  isFallback: boolean;
  isDeferred: boolean;
  deferralReason?: CkycDeferralReason;
  verificationStatus: CkycVerificationStatus;
}

export class CkycProviderResolutionService {
  private static instance: CkycProviderResolutionService;

  private constructor() {}

  static getInstance(): CkycProviderResolutionService {
    if (!CkycProviderResolutionService.instance) {
      CkycProviderResolutionService.instance = new CkycProviderResolutionService();
    }
    return CkycProviderResolutionService.instance;
  }

  /**
   * Seed default providers if not already present
   */
  async seedDefaultProviders(): Promise<void> {
    try {
      const existingProviders = await db.select().from(ckycProviderConfig);
      
      if (existingProviders.length === 0) {
        console.log('[CKYC Provider] Seeding default providers...');
        
        for (const provider of DEFAULT_PROVIDERS) {
          await db.insert(ckycProviderConfig).values({
            providerCode: provider.providerCode,
            providerName: provider.providerName,
            providerDescription: provider.providerDescription,
            priority: provider.priority,
            isEnabled: provider.providerCode === 'manual' ? true : this.checkProviderCredentials(provider.providerCode),
            eligibilityRules: provider.eligibilityRules,
            healthStatus: 'unknown',
            environment: 'all',
          });
        }
        
        console.log(`[CKYC Provider] Seeded ${DEFAULT_PROVIDERS.length} default providers`);
      } else {
        console.log(`[CKYC Provider] ${existingProviders.length} providers already configured`);
      }
    } catch (error) {
      console.error('[CKYC Provider] Failed to seed providers:', error);
      // Don't throw - allow app to start even if seeding fails
    }
  }

  /**
   * Check if provider has required credentials configured
   */
  private checkProviderCredentials(providerCode: CkycProviderCode): boolean {
    switch (providerCode) {
      case 'truthscreen':
        return !!(process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD);
      case 'sandbox':
        return !!(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
      case 'cersai_reference':
      case 'offline_aadhaar':
      case 'vkyc':
      case 'manual':
        return true; // These don't require API credentials
      default:
        return false;
    }
  }

  /**
   * Get all configured providers
   */
  async getAllProviders(): Promise<typeof ckycProviderConfig.$inferSelect[]> {
    return db.select()
      .from(ckycProviderConfig)
      .where(eq(ckycProviderConfig.isDeleted, false))
      .orderBy(asc(ckycProviderConfig.priority));
  }

  /**
   * Get enabled providers ordered by priority
   */
  async getEnabledProviders(environment?: string): Promise<typeof ckycProviderConfig.$inferSelect[]> {
    const currentEnv = environment || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    
    const allEnabled = await db.select()
      .from(ckycProviderConfig)
      .where(
        and(
          eq(ckycProviderConfig.isEnabled, true),
          eq(ckycProviderConfig.isDeleted, false)
        )
      )
      .orderBy(asc(ckycProviderConfig.priority));
    
    return allEnabled.filter(p => 
      p.environment === 'all' || p.environment === currentEnv
    );
  }

  /**
   * Resolve the best CKYC provider based on config, health, and client eligibility
   * 
   * PRODUCTION SAFETY:
   * - Mock provider is completely excluded in PROD environment
   * - All fallback attempts are tracked with reason codes
   * - CKYC_DEFERRED status is returned when all providers exhausted
   */
  async resolveCkycProvider(context: ClientEligibilityContext): Promise<ProviderResolutionResult> {
    const isProductionMode = ckycEnvironmentService.isProductionMode();
    let enabledProviders = await this.getEnabledProviders();
    
    // PROD SAFETY: Filter out mock provider in production
    if (isProductionMode) {
      enabledProviders = enabledProviders.filter(p => p.providerCode !== 'mock');
      console.log('[CKYC Provider] PROD mode: Mock provider excluded from resolution chain');
    }
    
    const fallbackChain: CkycProviderCode[] = [];
    const fallbackAttempts: FallbackAttempt[] = [];
    let lastProviderAttempted: string | undefined;
    
    for (const provider of enabledProviders) {
      const providerCode = provider.providerCode as CkycProviderCode;
      fallbackChain.push(providerCode);
      lastProviderAttempted = providerCode;
      
      // Check health status
      if (provider.healthStatus === 'unhealthy') {
        fallbackAttempts.push({
          provider: providerCode,
          reason: 'Provider unhealthy',
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      // Check rate limits
      if (this.isRateLimited(provider)) {
        fallbackAttempts.push({
          provider: providerCode,
          reason: 'Rate limit exceeded',
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      // Check eligibility
      const eligibility = await this.checkClientEligibility(provider, context);
      if (!eligibility.eligible) {
        fallbackAttempts.push({
          provider: providerCode,
          reason: eligibility.reason || 'Eligibility check failed',
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      // Found a suitable provider
      return {
        selectedProvider: providerCode,
        providerName: provider.providerName,
        selectionReason: eligibility.reason || 'Primary provider available',
        fallbackChain,
        fallbackAttempts,
        isFallback: fallbackChain.length > 1,
        isDeferred: false,
        verificationStatus: 'in_progress',
      };
    }
    
    // Check if manual provider is available and eligible
    const manualProvider = enabledProviders.find(p => p.providerCode === 'manual');
    if (manualProvider) {
      const manualEligibility = await this.checkClientEligibility(manualProvider, context);
      if (manualEligibility.eligible) {
        return {
          selectedProvider: 'manual',
          providerName: 'Manual CKYC',
          selectionReason: 'All automated providers exhausted, manual verification required',
          fallbackChain,
          fallbackAttempts,
          isFallback: true,
          isDeferred: true, // Manual is considered deferred until admin action
          verificationStatus: 'ckyc_deferred',
          deferralReason: {
            code: 'ALL_PROVIDERS_EXHAUSTED',
            message: 'All automated CKYC providers exhausted. Case routed to manual review queue.',
            lastProviderAttempted,
            failureReasons: fallbackAttempts,
            slaStartedAt: new Date().toISOString(),
            slaDeadline: ckycEnvironmentService.calculateSlaDeadline(72).toISOString(),
          },
        };
      }
    }
    
    // All providers exhausted including manual - return CKYC_DEFERRED
    console.warn(`[CKYC Provider] All providers exhausted for user ${context.userId}, status: CKYC_DEFERRED`);
    
    return {
      selectedProvider: 'none',
      providerName: 'None Available',
      selectionReason: 'All CKYC providers exhausted. Case requires immediate admin attention.',
      fallbackChain,
      fallbackAttempts,
      isFallback: true,
      isDeferred: true,
      verificationStatus: 'ckyc_deferred',
      deferralReason: {
        code: 'NO_PROVIDER_AVAILABLE',
        message: 'All CKYC providers failed or unavailable. This case has been escalated to the admin queue.',
        lastProviderAttempted,
        failureReasons: fallbackAttempts,
        slaStartedAt: new Date().toISOString(),
        slaDeadline: ckycEnvironmentService.calculateSlaDeadline(72).toISOString(),
      },
    };
  }

  /**
   * Check if provider is rate limited
   */
  private isRateLimited(provider: typeof ckycProviderConfig.$inferSelect): boolean {
    const now = new Date();
    
    // Check if rate limit has reset
    if (provider.rateLimitResetAt && new Date(provider.rateLimitResetAt) < now) {
      return false; // Reset time has passed
    }
    
    // Check minute limit
    if (provider.currentMinuteCount && provider.rateLimitPerMinute) {
      if (provider.currentMinuteCount >= provider.rateLimitPerMinute) {
        return true;
      }
    }
    
    // Check day limit
    if (provider.currentDayCount && provider.rateLimitPerDay) {
      if (provider.currentDayCount >= provider.rateLimitPerDay) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check client eligibility for a specific provider
   */
  private async checkClientEligibility(
    provider: typeof ckycProviderConfig.$inferSelect,
    context: ClientEligibilityContext
  ): Promise<{ eligible: boolean; reason?: string }> {
    const rules = provider.eligibilityRules as Record<string, unknown>;
    
    // Check API credentials requirement
    if (rules.requiresApiCredentials && !this.checkProviderCredentials(provider.providerCode as CkycProviderCode)) {
      return { eligible: false, reason: 'API credentials not configured' };
    }
    
    // Check Aadhaar consent requirement
    if (rules.requiresAadhaarConsent && !context.hasAadhaarConsent) {
      return { eligible: false, reason: 'Aadhaar consent not provided' };
    }
    
    // Check CKYC reference requirement
    if (rules.requiresCkycReference && !context.hasCkycReference) {
      return { eligible: false, reason: 'CKYC reference not available' };
    }
    
    // Check risk category
    const allowedRiskCategories = (rules.allowedRiskCategories as string[]) || [];
    if (context.riskCategory && allowedRiskCategories.length > 0) {
      if (!allowedRiskCategories.includes(context.riskCategory)) {
        return { eligible: false, reason: `Risk category ${context.riskCategory} not allowed for this provider` };
      }
    }
    
    // Check video KYC capability
    if (rules.requiresLiveSession && !context.canDoVideoKyc) {
      return { eligible: false, reason: 'Video KYC not available for client' };
    }
    
    return { eligible: true, reason: 'All eligibility checks passed' };
  }

  /**
   * Update provider health status
   */
  async updateProviderHealth(
    providerCode: CkycProviderCode,
    status: 'healthy' | 'degraded' | 'unhealthy',
    isSystemAction: boolean = true
  ): Promise<void> {
    const provider = await db.select()
      .from(ckycProviderConfig)
      .where(eq(ckycProviderConfig.providerCode, providerCode))
      .limit(1);
    
    if (provider.length === 0) return;
    
    const currentProvider = provider[0];
    const previousStatus = currentProvider.healthStatus;
    
    // Update health status
    let updates: Partial<typeof ckycProviderConfig.$inferInsert> = {
      healthStatus: status,
      lastHealthCheck: new Date(),
    };
    
    // Handle consecutive failures
    if (status === 'unhealthy') {
      updates.consecutiveFailures = (currentProvider.consecutiveFailures || 0) + 1;
      
      // Auto-disable after 5 consecutive failures
      if ((updates.consecutiveFailures || 0) >= 5) {
        updates.isEnabled = false;
        updates.autoDisabledAt = new Date();
      }
    } else if (status === 'healthy') {
      updates.consecutiveFailures = 0;
    }
    
    await db.update(ckycProviderConfig)
      .set(updates)
      .where(eq(ckycProviderConfig.providerCode, providerCode));
    
    // Log the change
    await this.logProviderChange(
      currentProvider.id,
      providerCode,
      'health_check',
      { healthStatus: previousStatus },
      { healthStatus: status },
      isSystemAction ? 'Health check' : 'Manual update',
      undefined,
      isSystemAction
    );
  }

  /**
   * Enable/disable a provider
   */
  async toggleProvider(
    providerCode: CkycProviderCode,
    enabled: boolean,
    userId?: string,
    reason?: string
  ): Promise<void> {
    const provider = await db.select()
      .from(ckycProviderConfig)
      .where(eq(ckycProviderConfig.providerCode, providerCode))
      .limit(1);
    
    if (provider.length === 0) {
      throw new Error(`Provider ${providerCode} not found`);
    }
    
    const currentProvider = provider[0];
    
    await db.update(ckycProviderConfig)
      .set({
        isEnabled: enabled,
        updatedBy: userId,
        updatedAt: new Date(),
        autoDisabledAt: enabled ? null : currentProvider.autoDisabledAt,
      })
      .where(eq(ckycProviderConfig.providerCode, providerCode));
    
    // Log the change
    await this.logProviderChange(
      currentProvider.id,
      providerCode,
      enabled ? 'enabled' : 'disabled',
      { isEnabled: currentProvider.isEnabled },
      { isEnabled: enabled },
      reason || (enabled ? 'Provider enabled' : 'Provider disabled'),
      userId
    );
  }

  /**
   * Update provider priority
   */
  async updateProviderPriority(
    providerCode: CkycProviderCode,
    newPriority: number,
    userId?: string
  ): Promise<void> {
    const provider = await db.select()
      .from(ckycProviderConfig)
      .where(eq(ckycProviderConfig.providerCode, providerCode))
      .limit(1);
    
    if (provider.length === 0) {
      throw new Error(`Provider ${providerCode} not found`);
    }
    
    const currentProvider = provider[0];
    
    await db.update(ckycProviderConfig)
      .set({
        priority: newPriority,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(ckycProviderConfig.providerCode, providerCode));
    
    // Log the change
    await this.logProviderChange(
      currentProvider.id,
      providerCode,
      'priority_changed',
      { priority: currentProvider.priority },
      { priority: newPriority },
      `Priority changed from ${currentProvider.priority} to ${newPriority}`,
      userId
    );
  }

  /**
   * Log provider configuration change
   */
  private async logProviderChange(
    providerId: string,
    providerCode: string,
    action: string,
    previousValue: unknown,
    newValue: unknown,
    reason?: string,
    userId?: string,
    isSystemAction: boolean = false
  ): Promise<void> {
    try {
      await db.insert(ckycProviderAuditLog).values({
        providerId,
        providerCode,
        action,
        previousValue,
        newValue,
        changeReason: reason,
        performedBy: userId,
        isSystemAction,
      });
    } catch (error) {
      console.error('[CKYC Provider] Failed to log change:', error);
    }
  }

  /**
   * Get provider by code
   */
  async getProviderByCode(providerCode: CkycProviderCode): Promise<typeof ckycProviderConfig.$inferSelect | null> {
    const result = await db.select()
      .from(ckycProviderConfig)
      .where(eq(ckycProviderConfig.providerCode, providerCode))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get audit log for a provider
   */
  async getProviderAuditLog(providerCode?: CkycProviderCode, limit: number = 50): Promise<typeof ckycProviderAuditLog.$inferSelect[]> {
    if (providerCode) {
      return db.select()
        .from(ckycProviderAuditLog)
        .where(eq(ckycProviderAuditLog.providerCode, providerCode))
        .orderBy(asc(ckycProviderAuditLog.createdAt))
        .limit(limit);
    }
    
    return db.select()
      .from(ckycProviderAuditLog)
      .orderBy(asc(ckycProviderAuditLog.createdAt))
      .limit(limit);
  }

  /**
   * Record a CKYC verification request
   */
  async recordVerificationRequest(
    userId: string,
    panNumber: string,
    selectedProvider: CkycProviderCode,
    selectionReason: string,
    fallbackAttempts: Array<{ provider: string; timestamp: string; reason: string }> = []
  ): Promise<string> {
    const result = await db.insert(ckycVerificationRequests).values({
      userId,
      panNumber,
      selectedProvider,
      providerSelectionReason: selectionReason,
      fallbackAttempts,
    }).returning({ id: ckycVerificationRequests.id });
    
    return result[0].id;
  }

  /**
   * Update verification request with response
   */
  async updateVerificationRequestResponse(
    requestId: string,
    responseStatus: string,
    responseCode: string,
    responseMessage: string,
    ckycResult?: { found: boolean; kin?: string; status?: string },
    responseTimeMs?: number
  ): Promise<void> {
    await db.update(ckycVerificationRequests)
      .set({
        responseStatus,
        responseCode,
        responseMessage,
        ckycFound: ckycResult?.found,
        ckycKin: ckycResult?.kin,
        ckycStatus: ckycResult?.status,
        responseTimeMs,
        completedAt: new Date(),
      })
      .where(eq(ckycVerificationRequests.id, requestId));
  }

  /**
   * Perform CKYC verification using resolved provider with fallback chain
   */
  async verifyCkyc(
    context: ClientEligibilityContext & {
      fullName: string;
      dateOfBirth: string;
      aadhaarNumber?: string;
      mobileNumber?: string;
      emailAddress?: string;
    }
  ): Promise<{
    success: boolean;
    found: boolean;
    provider: string;
    kin?: string;
    status?: string;
    data?: unknown;
    responseTimeMs: number;
    message: string;
    fallbackAttempts: Array<{ provider: string; timestamp: string; reason: string }>;
  }> {
    const { getAdapter } = await import('./ckyc-provider-adapter');
    const fallbackAttempts: Array<{ provider: string; timestamp: string; reason: string }> = [];
    
    const enabledProviders = await this.getEnabledProviders();
    const providerCodes = enabledProviders.map(p => p.providerCode as CkycProviderCode);
    
    if (!providerCodes.includes('manual')) {
      providerCodes.push('manual');
    }
    
    const requestId = await this.recordVerificationRequest(
      context.userId,
      context.panNumber,
      providerCodes[0] || 'manual',
      'Starting verification with fallback chain',
      fallbackAttempts
    );
    
    for (const providerCode of providerCodes) {
      const providerConfig = enabledProviders.find(p => p.providerCode === providerCode);
      
      if (providerConfig) {
        if (providerConfig.healthStatus === 'unhealthy') {
          fallbackAttempts.push({
            provider: providerCode,
            timestamp: new Date().toISOString(),
            reason: 'Provider unhealthy, skipping',
          });
          continue;
        }
        
        if (this.isRateLimited(providerConfig)) {
          fallbackAttempts.push({
            provider: providerCode,
            timestamp: new Date().toISOString(),
            reason: 'Provider rate limited, skipping',
          });
          continue;
        }
        
        const eligibility = await this.checkClientEligibility(providerConfig, context);
        if (!eligibility.eligible) {
          fallbackAttempts.push({
            provider: providerCode,
            timestamp: new Date().toISOString(),
            reason: eligibility.reason || 'Not eligible',
          });
          continue;
        }
      }
      
      try {
        const adapter = await getAdapter(providerCode);
        
        const result = await adapter.verify({
          panNumber: context.panNumber,
          fullName: context.fullName,
          dateOfBirth: context.dateOfBirth,
          aadhaarNumber: context.aadhaarNumber,
          mobileNumber: context.mobileNumber,
          emailAddress: context.emailAddress,
          userId: context.userId,
        });
        
        if (result.success && result.found) {
          await this.updateVerificationRequestResponse(
            requestId,
            'success',
            'CKYC_FOUND',
            result.message,
            { found: true, kin: result.kin, status: result.status },
            result.responseTimeMs
          );
          
          await this.updateProviderHealth(providerCode, 'healthy');
          
          return {
            success: true,
            found: true,
            provider: providerCode,
            kin: result.kin,
            status: result.status,
            data: result.data,
            responseTimeMs: result.responseTimeMs,
            message: result.message,
            fallbackAttempts,
          };
        }
        
        if (!result.success) {
          fallbackAttempts.push({
            provider: providerCode,
            timestamp: new Date().toISOString(),
            reason: result.message,
          });
          
          await this.updateProviderHealth(providerCode, 'degraded');
          continue;
        }
        
        if (result.status === 'not_found') {
          await this.updateVerificationRequestResponse(
            requestId,
            'success',
            'CKYC_NOT_FOUND',
            result.message,
            { found: false },
            result.responseTimeMs
          );
          
          return {
            success: true,
            found: false,
            provider: providerCode,
            responseTimeMs: result.responseTimeMs,
            message: result.message,
            fallbackAttempts,
          };
        }
        
      } catch (error: any) {
        console.error(`[CKYC Provider] Error with ${providerCode}:`, error.message);
        
        fallbackAttempts.push({
          provider: providerCode,
          timestamp: new Date().toISOString(),
          reason: error.message,
        });
        
        await this.updateProviderHealth(providerCode, 'unhealthy');
      }
    }
    
    await this.updateVerificationRequestResponse(
      requestId,
      'failed',
      'ALL_PROVIDERS_FAILED',
      'All CKYC providers failed',
      { found: false },
      0
    );
    
    return {
      success: false,
      found: false,
      provider: 'none',
      responseTimeMs: 0,
      message: 'All CKYC providers failed',
      fallbackAttempts,
    };
  }

  /**
   * Run health checks on all providers
   */
  async runHealthChecks(): Promise<Array<{ provider: string; healthy: boolean; latencyMs?: number }>> {
    const { getAdapter } = await import('./ckyc-provider-adapter');
    const providers = await this.getAllProviders();
    const results: Array<{ provider: string; healthy: boolean; latencyMs?: number }> = [];
    
    for (const provider of providers) {
      try {
        const adapter = await getAdapter(provider.providerCode);
        const health = await adapter.checkHealth();
        
        await this.updateProviderHealth(
          provider.providerCode as CkycProviderCode,
          health.healthy ? 'healthy' : 'unhealthy'
        );
        
        results.push({
          provider: provider.providerCode,
          healthy: health.healthy,
          latencyMs: health.latencyMs,
        });
      } catch (error: any) {
        results.push({
          provider: provider.providerCode,
          healthy: false,
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const ckycProviderResolutionService = CkycProviderResolutionService.getInstance();
