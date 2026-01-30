/**
 * Unified eSign Service
 * 
 * Provider abstraction layer for Aadhaar-based Digital Signature (eSign)
 * Supports multiple providers: AuthBridge, Protean (NSDL), eMudhra, etc.
 * Admin can toggle active provider based on pricing and availability
 */

import { db } from '../db';
import { systemConfigs, esignRequests, users } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authBridgeESignService } from '../authbridge-esign-service';
import { proteanESignService } from './protean-esign-service';
import { dscTokenESignService, DSCSigningRequest, DSCSignatureSubmission } from './dsc-token-esign-service';
import { nanoid } from 'nanoid';

export type ESignProvider = 'authbridge' | 'protean' | 'emudhra' | 'cvl' | 'dsc_token' | 'user_signature';

export interface ESignProviderConfig {
  provider: ESignProvider;
  displayName: string;
  description: string;
  pricingPerSign: number;
  pricingCurrency: string;
  isActive: boolean;
  isConfigured: boolean;
  features: string[];
  environment: 'sandbox' | 'production';
}

export interface ESignInitiateRequest {
  userId: string;
  documentType: 'itr_verification' | 'form_15ca' | 'form_15cb' | 'investment_agreement' | 'kyc_consent' | 'mandate' | 'other';
  documentName: string;
  documentHash: string;
  documentUrl?: string;
  aadhaarNumber: string;
  fullName: string;
  callbackUrl?: string;
}

export interface ESignInitiateResponse {
  success: boolean;
  transactionId: string;
  requestId: string;
  message: string;
  provider: ESignProvider;
  otpSent?: boolean;
  maskedMobile?: string;
  expiresAt?: Date;
}

export interface ESignVerifyRequest {
  transactionId: string;
  otp: string;
}

export interface ESignVerifyResponse {
  success: boolean;
  message: string;
  provider: ESignProvider;
  signedDocumentUrl?: string;
  certificateId?: string;
  signatureData?: {
    signedAt: Date;
    signerName: string;
    signerAadhaar: string;
    certificateSerial: string;
    signatureAlgorithm: string;
    validFrom: Date;
    validTo: Date;
  };
}

class UnifiedESignService {
  private static readonly CONFIG_KEY = 'esign_provider_config';
  private static readonly PRICING_PREFIX = 'esign_pricing_';

  private defaultProviders: Map<ESignProvider, ESignProviderConfig> = new Map([
    ['authbridge', {
      provider: 'authbridge',
      displayName: 'AuthBridge eSign',
      description: 'AuthBridge Aadhaar-based DSC with OTP verification',
      pricingPerSign: 15.00,
      pricingCurrency: 'INR',
      isActive: true,
      isConfigured: false,
      features: ['Aadhaar OTP', 'PDF Signing', 'Certificate Generation', 'Audit Trail'],
      environment: 'sandbox',
    }],
    ['protean', {
      provider: 'protean',
      displayName: 'Protean (NSDL) eSign',
      description: 'NSDL Protean Aadhaar eSign - Government certified ESP',
      pricingPerSign: 8.00,
      pricingCurrency: 'INR',
      isActive: false,
      isConfigured: false,
      features: ['Aadhaar OTP', 'Biometric', 'PDF Signing', 'XML Signing', 'Bulk Signing'],
      environment: 'sandbox',
    }],
    ['emudhra', {
      provider: 'emudhra',
      displayName: 'eMudhra eSign',
      description: 'eMudhra Aadhaar eSign Service Provider',
      pricingPerSign: 10.00,
      pricingCurrency: 'INR',
      isActive: false,
      isConfigured: false,
      features: ['Aadhaar OTP', 'PDF Signing', 'Certificate Generation'],
      environment: 'sandbox',
    }],
    ['cvl', {
      provider: 'cvl',
      displayName: 'CVL (CDSL) eSign',
      description: 'CDSL Ventures Limited Aadhaar-based eSign',
      pricingPerSign: 9.00,
      pricingCurrency: 'INR',
      isActive: false,
      isConfigured: false,
      features: ['Aadhaar OTP', 'PDF Signing', 'Depository Integration'],
      environment: 'sandbox',
    }],
    ['dsc_token', {
      provider: 'dsc_token',
      displayName: 'DSC Token (Hardware)',
      description: 'Digital Signature Certificate via USB Token or Smart Card - Class 2/3 certificates',
      pricingPerSign: 0.00,
      pricingCurrency: 'INR',
      isActive: true,
      isConfigured: true,
      features: ['USB Token', 'Smart Card', 'Class 2/3 DSC', 'No OTP Required', 'Offline Capable', 'TSA Timestamping'],
      environment: 'sandbox',
    }],
    ['user_signature', {
      provider: 'user_signature',
      displayName: 'Saved Signature',
      description: 'Use your uploaded, drawn, or typed signature to sign documents instantly',
      pricingPerSign: 0.00,
      pricingCurrency: 'INR',
      isActive: true,
      isConfigured: true,
      features: ['Upload Image', 'Draw Signature', 'Type Signature', 'Instant Signing', 'No OTP Required', 'PDF Embedding'],
      environment: 'production',
    }],
  ]);

  constructor() {
    this.initializeProviderStatus();
  }

  private initializeProviderStatus(): void {
    const authbridgeConfig = this.defaultProviders.get('authbridge')!;
    authbridgeConfig.isConfigured = !authBridgeESignService.isInMockMode();
    authbridgeConfig.environment = authBridgeESignService.getEnvironment() as 'sandbox' | 'production';

    const proteanConfig = this.defaultProviders.get('protean')!;
    proteanConfig.isConfigured = !proteanESignService.isInMockMode();
    proteanConfig.environment = proteanESignService.getEnvironment() as 'sandbox' | 'production';

    const dscConfig = this.defaultProviders.get('dsc_token')!;
    dscConfig.isConfigured = true;
    dscConfig.environment = dscTokenESignService.getEnvironment() as 'sandbox' | 'production';

    console.log('✅ Unified eSign Service initialized');
    console.log(`   AuthBridge: ${authbridgeConfig.isConfigured ? 'Configured' : 'Mock Mode'}`);
    console.log(`   Protean: ${proteanConfig.isConfigured ? 'Configured' : 'Mock Mode'}`);
    console.log(`   DSC Token: ${dscConfig.isConfigured ? 'Available' : 'Mock Mode'}`);
  }

  private async loadPersistedPricing(): Promise<Map<ESignProvider, number>> {
    const pricingMap = new Map<ESignProvider, number>();
    try {
      const configs = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.category, 'esign'));
      
      for (const config of configs) {
        if (config.key.startsWith(UnifiedESignService.PRICING_PREFIX)) {
          const provider = config.key.replace(UnifiedESignService.PRICING_PREFIX, '') as ESignProvider;
          const parsed = JSON.parse(config.value);
          if (parsed.pricePerSign !== undefined) {
            pricingMap.set(provider, parsed.pricePerSign);
          }
        }
      }
    } catch (error) {
      console.error('[UnifiedESign] Error loading persisted pricing:', error);
    }
    return pricingMap;
  }

  detectProviderFromTransactionId(transactionId: string): ESignProvider {
    if (transactionId.startsWith('PROTEAN-')) {
      return 'protean';
    }
    if (transactionId.startsWith('DSC-')) {
      return 'dsc_token';
    }
    if (transactionId.startsWith('USIG-')) {
      return 'user_signature';
    }
    return 'authbridge';
  }

  async getActiveProvider(): Promise<ESignProvider> {
    try {
      const [config] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, UnifiedESignService.CONFIG_KEY))
        .limit(1);

      if (config && config.value) {
        const parsed = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
        return (parsed.activeProvider as ESignProvider) || 'authbridge';
      }
    } catch (error) {
      console.error('[UnifiedESign] Error fetching active provider:', error);
    }
    return 'authbridge';
  }

  async setActiveProvider(provider: ESignProvider, adminUserId: string): Promise<{ success: boolean; message: string }> {
    const providerConfig = this.defaultProviders.get(provider);
    if (!providerConfig) {
      return { success: false, message: `Unknown provider: ${provider}` };
    }

    try {
      const configValue = JSON.stringify({
        activeProvider: provider,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId,
      });

      const [existing] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, UnifiedESignService.CONFIG_KEY))
        .limit(1);

      if (existing) {
        await db.update(systemConfigs)
          .set({ value: configValue, updatedAt: new Date() })
          .where(eq(systemConfigs.key, UnifiedESignService.CONFIG_KEY));
      } else {
        await db.insert(systemConfigs).values({
          id: nanoid(),
          key: UnifiedESignService.CONFIG_KEY,
          value: configValue,
          category: 'esign',
          description: 'Active eSign provider configuration',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      console.log(`[UnifiedESign] Active provider changed to: ${provider} by admin: ${adminUserId}`);

      return { 
        success: true, 
        message: `eSign provider switched to ${providerConfig.displayName}` 
      };
    } catch (error) {
      console.error('[UnifiedESign] Error setting active provider:', error);
      return { success: false, message: 'Failed to update provider configuration' };
    }
  }

  async getProviderConfigs(): Promise<ESignProviderConfig[]> {
    const persistedPricing = await this.loadPersistedPricing();
    const activeProvider = await this.getActiveProvider();
    
    return Array.from(this.defaultProviders.values()).map(config => ({
      ...config,
      pricingPerSign: persistedPricing.get(config.provider) ?? config.pricingPerSign,
      isActive: config.provider === activeProvider,
    }));
  }

  getProviderConfig(provider: ESignProvider): ESignProviderConfig | undefined {
    return this.defaultProviders.get(provider);
  }

  async updateProviderPricing(provider: ESignProvider, pricePerSign: number, adminUserId: string): Promise<{ success: boolean; message: string }> {
    const config = this.defaultProviders.get(provider);
    if (!config) {
      return { success: false, message: `Unknown provider: ${provider}` };
    }

    try {
      const pricingKey = `esign_pricing_${provider}`;
      const pricingValue = JSON.stringify({
        pricePerSign,
        currency: 'INR',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUserId,
      });

      const [existing] = await db.select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, pricingKey))
        .limit(1);

      if (existing) {
        await db.update(systemConfigs)
          .set({ value: pricingValue, updatedAt: new Date() })
          .where(eq(systemConfigs.key, pricingKey));
      } else {
        await db.insert(systemConfigs).values({
          id: nanoid(),
          key: pricingKey,
          value: pricingValue,
          category: 'esign',
          description: `Pricing configuration for ${config.displayName}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return { 
        success: true, 
        message: `Pricing updated for ${config.displayName}: ₹${pricePerSign}/sign` 
      };
    } catch (error) {
      console.error('[UnifiedESign] Error updating pricing:', error);
      return { success: false, message: 'Failed to update pricing' };
    }
  }

  async getCheapestConfiguredProvider(): Promise<ESignProvider> {
    const configs = await this.getProviderConfigs();
    let cheapest: ESignProvider = 'authbridge';
    let lowestPrice = Infinity;

    for (const config of configs) {
      if (config.isConfigured && config.pricingPerSign < lowestPrice) {
        lowestPrice = config.pricingPerSign;
        cheapest = config.provider;
      }
    }

    return cheapest;
  }

  async initiateESign(request: ESignInitiateRequest): Promise<ESignInitiateResponse> {
    const activeProvider = await this.getActiveProvider();
    console.log(`[UnifiedESign] Initiating eSign with provider: ${activeProvider}`);

    switch (activeProvider) {
      case 'protean':
        const proteanResult = await proteanESignService.initiateESign(request);
        return { ...proteanResult, provider: 'protean' };

      case 'authbridge':
      default:
        const authbridgeResult = await authBridgeESignService.initiateESign(request);
        return { ...authbridgeResult, provider: 'authbridge' };
    }
  }

  async verifyESign(request: ESignVerifyRequest): Promise<ESignVerifyResponse> {
    const transactionId = request.transactionId;
    
    const provider = this.detectProviderFromTransactionId(transactionId);
    console.log(`[UnifiedESign] Verifying eSign with provider: ${provider} for transaction: ${transactionId}`);

    switch (provider) {
      case 'protean':
        const proteanResult = await proteanESignService.verifyESign(request);
        return { ...proteanResult, provider: 'protean' };

      case 'authbridge':
      default:
        const authbridgeResult = await authBridgeESignService.verifyESign(request);
        return { ...authbridgeResult, provider: 'authbridge' };
    }
  }

  async resendOTP(transactionId: string): Promise<{ success: boolean; message: string; provider: ESignProvider }> {
    const provider = this.detectProviderFromTransactionId(transactionId);

    switch (provider) {
      case 'protean':
        const proteanResult = await proteanESignService.resendOTP(transactionId);
        return { ...proteanResult, provider: 'protean' };

      case 'authbridge':
      default:
        const authbridgeResult = await authBridgeESignService.resendOTP(transactionId);
        return { ...authbridgeResult, provider: 'authbridge' };
    }
  }

  async getStatus(transactionId: string): Promise<{
    status: string;
    documentName: string;
    signerName: string;
    initiatedAt: Date;
    completedAt?: Date;
    certificateId?: string;
    provider: ESignProvider;
  }> {
    const provider = this.detectProviderFromTransactionId(transactionId);

    switch (provider) {
      case 'protean':
        const proteanStatus = await proteanESignService.getStatus(transactionId);
        return { ...proteanStatus, provider: 'protean' };

      case 'dsc_token':
        const dscStatus = await dscTokenESignService.getStatus(transactionId);
        return { ...dscStatus, provider: 'dsc_token' };

      case 'user_signature':
        const { userSignatureESignService } = await import('./user-signature-esign-service');
        const userSigStatus = await userSignatureESignService.getSigningStatus(transactionId);
        return { ...userSigStatus, provider: 'user_signature' };

      case 'authbridge':
      default:
        const authbridgeStatus = await authBridgeESignService.getStatus(transactionId);
        return { ...authbridgeStatus, provider: 'authbridge' };
    }
  }

  generateDocumentHash(documentContent: Buffer | string): string {
    return authBridgeESignService.generateDocumentHash(documentContent);
  }

  async getProviderUsageStats(): Promise<{
    provider: ESignProvider;
    displayName: string;
    totalSigns: number;
    lastUsed: Date | null;
    estimatedCost: number;
  }[]> {
    return [
      {
        provider: 'authbridge',
        displayName: 'AuthBridge eSign',
        totalSigns: 0,
        lastUsed: null,
        estimatedCost: 0,
      },
      {
        provider: 'protean',
        displayName: 'Protean (NSDL) eSign',
        totalSigns: 0,
        lastUsed: null,
        estimatedCost: 0,
      },
      {
        provider: 'dsc_token',
        displayName: 'DSC Token (Hardware)',
        totalSigns: 0,
        lastUsed: null,
        estimatedCost: 0,
      },
      {
        provider: 'user_signature',
        displayName: 'Saved Signature',
        totalSigns: 0,
        lastUsed: null,
        estimatedCost: 0,
      },
    ];
  }

  async initiateDSCSigningSession(request: DSCSigningRequest) {
    console.log(`[UnifiedESign] Initiating DSC token signing session`);
    return dscTokenESignService.initiateSigningSession(request);
  }

  async submitDSCSignature(submission: DSCSignatureSubmission) {
    console.log(`[UnifiedESign] Submitting DSC signature for transaction: ${submission.transactionId}`);
    return dscTokenESignService.submitSignature(submission);
  }

  async cancelDSCSession(transactionId: string, userId: string, reason?: string) {
    return dscTokenESignService.cancelSession(transactionId, userId, reason);
  }

  getDSCKnownIssuers(): string[] {
    return dscTokenESignService.getKnownIssuers();
  }

  getDSCSupportedAlgorithms(): string[] {
    return dscTokenESignService.getSupportedAlgorithms();
  }

  isDSCProvider(provider: ESignProvider): boolean {
    return provider === 'dsc_token';
  }

  async getAllESignRequests(): Promise<{
    id: string;
    documentName: string;
    documentType: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    agentName: string;
    agentId: string;
    clientName: string;
    provider: string;
    cost?: number;
  }[]> {
    try {
      const requests = await db
        .select({
          id: esignRequests.id,
          documentHash: esignRequests.documentHash,
          documentName: esignRequests.documentName,
          documentType: esignRequests.documentType,
          status: esignRequests.status,
          createdAt: esignRequests.createdAt,
          completedAt: esignRequests.completedAt,
          userId: esignRequests.userId,
          provider: esignRequests.provider,
          clientName: esignRequests.signerName,
          clientEmail: esignRequests.signerEmail,
        })
        .from(esignRequests)
        .orderBy(desc(esignRequests.createdAt))
        .limit(100);

      const userIds = [...new Set(requests.map(r => r.userId).filter(Boolean))];
      const usersMap = new Map<number, string>();
      
      if (userIds.length > 0) {
        const userRecords = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users);
        userRecords.forEach(u => usersMap.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'));
      }

      return requests.map(r => ({
        id: r.id?.toString() || r.documentHash || '',
        documentName: r.documentName || 'Unnamed Document',
        documentType: r.documentType || 'other',
        status: r.status || 'pending',
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
        completedAt: r.completedAt?.toISOString(),
        agentName: r.userId ? (usersMap.get(r.userId) || 'Unknown') : 'System',
        agentId: r.userId?.toString() || '',
        clientName: r.clientName || r.clientEmail || 'Unknown Client',
        provider: r.provider || 'authbridge',
        cost: 15,
      }));
    } catch (error) {
      console.error('[UnifiedESign] Error fetching all requests:', error);
      return [];
    }
  }
}

export const unifiedESignService = new UnifiedESignService();
export default unifiedESignService;
