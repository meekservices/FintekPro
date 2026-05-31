// @ts-nocheck
import { Router, Request, Response } from "express";
import { KycCentralHubService } from "../services/kyc-central-hub-service";
import { kycOrchestrationEngine } from "../services/kyc-orchestration-engine";
import { identityTokenService } from "../services/identity-token-service";
import { dpdpConsentService } from "../services/dpdp-consent-service";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  kycProviders,
  providerMetrics,
  productConfigurations,
  brokerConfigurations,
  platformAuditLogs,
  conversionFunnels,
} from "@shared/schema";
import { requireClientOrHigher, requireAdmin } from "../middleware/auth";

const router: Router = Router();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// All KYC engine routes require at minimum a logged-in user
router.use(requireClientOrHigher);

// Admin sub-router — requires admin/superadmin role
router.use("/admin", requireAdmin);

router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, kycStep, productType, payload, portalId } = req.body as {
      userId?: string;
      kycStep?: string;
      productType?: string;
      payload?: any;
      portalId?: string;
    };
    if (!userId || !kycStep || !productType) {
      res.status(400).json({ success: false, error: "userId, kycStep, and productType are required" });
      return;
    }

    // Use Central Hub to process the step with Audit Hashing and Consent checks enabled
    const result = await KycCentralHubService.processKycStep({
      userId,
      step: kycStep,
      portalId: portalId || 'primary_portal',
      productType,
      payload: payload || {},
    });

    if (result.success) {
      const stepToType: Record<string, 'pan' | 'aadhaar' | 'ckyc' | 'bank' | 'address'> = {
        pan_verification: 'pan',
        aadhaar_verification: 'aadhaar',
        ckyc_verification: 'ckyc',
        bank_verification: 'bank',
        address_verification: 'address',
      };
      const verificationType = stepToType[kycStep];
      if (verificationType) {
        try {
          await identityTokenService.getOrCreateProfile(userId);
          const updatedProfile = await identityTokenService.updateVerificationStatus(userId, verificationType, {
            verified: true,
            provider: result.providerCode,
            details: { ...result.data, ...payload },
          });
          if (updatedProfile) {
            (result as any).identityProfile = {
              kycLevel: updatedProfile.kycLevel,
              overallStatus: updatedProfile.overallStatus,
            };
          }
        } catch (profileErr: unknown) {
          console.error("[KYC-ENGINE-ROUTES] Failed to update identity profile:", errorMessage(profileErr));
        }
      }

      if (kycStep === 'bank_verification' && result.success && result.data?.verified) {
        const bankPayload = (req.body as any).payload || {};
        if (bankPayload.accountNo && bankPayload.ifsc) {
          try {
            const allAccounts = await storage.getUserBankAccounts(userId);
            const activeAccounts = allAccounts.filter(a => a.isActive);
            const existingAccount = activeAccounts.find(a => a.accountNumber === bankPayload.accountNo);
            if (existingAccount) {
              await storage.updateBankAccount(existingAccount.id, {
                isVerified: true,
                verificationStatus: 'verified',
                verificationDate: new Date(),
                verificationMethod: 'kyc_engine',
              });
            } else if (activeAccounts.length < 5) {
              await storage.createBankAccount({
                userId,
                bankName: bankPayload.bankName || 'Unknown',
                accountNumber: bankPayload.accountNo,
                ifscCode: bankPayload.ifsc,
                accountHolderName: bankPayload.accountHolderName || '',
                accountType: bankPayload.accountType || 'savings',
                isVerified: true,
                verificationStatus: 'verified',
                verificationDate: new Date(),
                verificationMethod: 'kyc_engine',
                isPrimary: activeAccounts.length === 0,
              });
            }
          } catch (bankErr: unknown) {
            console.error("[KYC-ENGINE-ROUTES] Failed to sync bank account:", errorMessage(bankErr));
          }
        }
      }
    }

    res.json({ success: true, result });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in verify:", errorMessage(error));
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.get("/flow/:productType", async (req: Request, res: Response): Promise<void> => {
  try {
    const { productType } = req.params;
    const flow = await kycOrchestrationEngine.getFlowForProduct(productType);
    res.json({ success: true, flow });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getFlowForProduct:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get flow" });
  }
});

router.get("/providers/:kycStep", async (req: Request, res: Response): Promise<void> => {
  try {
    const { kycStep } = req.params;
    const productType = (req.query.productType as string) || "";
    const chain = await kycOrchestrationEngine.getProviderChainForStep(kycStep, productType);
    res.json({ success: true, providers: chain });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getProviderChainForStep:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get provider chain" });
  }
});

router.get("/identity/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const profile = await identityTokenService.getOrCreateProfile(userId);
    res.json({ success: true, profile });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getOrCreateProfile:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get identity profile" });
  }
});

router.get("/identity/:userId/eligibility/:productType", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, productType } = req.params;
    const eligibility = await identityTokenService.checkKycEligibility(userId, productType);
    res.json({ success: true, eligibility });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in checkKycEligibility:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to check eligibility" });
  }
});

router.post("/identity/:userId/fatca", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    await identityTokenService.declareFatca(userId);
    res.json({ success: true, message: "FATCA declaration recorded" });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in declareFatca:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to declare FATCA" });
  }
});

router.post("/identity/:userId/risk", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { category, score } = req.body as { category?: string; score?: number };
    if (!category || score === undefined) {
      res.status(400).json({ success: false, error: "category and score are required" });
      return;
    }
    await identityTokenService.assessRisk(userId, { category, score });
    res.json({ success: true, message: "Risk assessment recorded" });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in assessRisk:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to assess risk" });
  }
});

router.get("/consent/purposes/list", async (_req: Request, res: Response): Promise<void> => {
  try {
    const purposes = dpdpConsentService.getPurposes();
    res.json({ success: true, purposes });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getPurposes:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get consent purposes" });
  }
});

router.post("/consent", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, consentType, consentGiven, ipAddress, userAgent } = req.body as {
      userId?: string;
      consentType?: string;
      consentGiven?: boolean;
      ipAddress?: string;
      userAgent?: string;
    };
    if (!userId || !consentType || consentGiven === undefined) {
      res.status(400).json({ success: false, error: "userId, consentType, and consentGiven are required" });
      return;
    }
    const record = await dpdpConsentService.captureConsent({
      userId,
      consentType,
      consentGiven,
      ipAddress,
      userAgent,
    });
    res.json({ success: true, consent: record });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in captureConsent:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to capture consent" });
  }
});

router.get("/consent/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const consents = await dpdpConsentService.getActiveConsents(userId);
    res.json({ success: true, consents });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getActiveConsents:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get active consents" });
  }
});

router.get("/consent/:userId/history", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const history = await dpdpConsentService.getConsentHistory(userId);
    res.json({ success: true, history });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in getConsentHistory:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get consent history" });
  }
});

router.post("/consent/:userId/withdraw", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { consentType, reason } = req.body as { consentType?: string; reason?: string };
    if (!consentType || !reason) {
      res.status(400).json({ success: false, error: "consentType and reason are required" });
      return;
    }
    await dpdpConsentService.withdrawConsent(userId, consentType, reason);
    res.json({ success: true, message: "Consent withdrawn successfully" });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error in withdrawConsent:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to withdraw consent" });
  }
});

router.get("/admin/providers", async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await db.select().from(kycProviders);
    res.json({ success: true, providers });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error listing providers:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to list providers" });
  }
});

router.patch("/admin/providers/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid provider ID" });
      return;
    }
    const updates: Record<string, any> = {};
    const { isEnabled, isConfigured, pricePerCall, providerName, apiEndpoint, features } = req.body;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (isConfigured !== undefined) updates.isConfigured = isConfigured;
    if (pricePerCall !== undefined) updates.pricePerCall = String(pricePerCall);
    if (providerName !== undefined) updates.providerName = providerName;
    if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;
    if (features !== undefined) updates.features = features;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(kycProviders)
      .set(updates)
      .where(eq(kycProviders.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: "Provider not found" });
      return;
    }
    res.json({ success: true, provider: updated });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error updating provider:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to update provider" });
  }
});

router.get("/admin/providers/:id/metrics", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid provider ID" });
      return;
    }
    const metrics = await db
      .select()
      .from(providerMetrics)
      .where(eq(providerMetrics.providerId, id))
      .orderBy(desc(providerMetrics.createdAt));
    res.json({ success: true, metrics });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error getting provider metrics:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get provider metrics" });
  }
});

router.patch("/admin/priority", async (req: Request, res: Response): Promise<void> => {
  try {
    const { kycStep, providerId, newPriority, updatedBy } = req.body as {
      kycStep?: string;
      providerId?: number;
      newPriority?: number;
      updatedBy?: string;
    };
    if (!kycStep || !providerId || !newPriority) {
      res.status(400).json({ success: false, error: "kycStep, providerId, and newPriority are required" });
      return;
    }
    await kycOrchestrationEngine.updateProviderPriority(kycStep, providerId, newPriority, updatedBy);
    res.json({ success: true, message: "Provider priority updated" });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error updating priority:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to update priority" });
  }
});

router.get("/admin/products", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await db.select().from(productConfigurations);
    res.json({ success: true, products });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error listing products:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to list products" });
  }
});

router.patch("/admin/products/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid product ID" });
      return;
    }
    const updates: Record<string, any> = {};
    const { isEnabled, requiredKycLevel, requiredKycSteps, configuration } = req.body;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (requiredKycLevel !== undefined) updates.requiredKycLevel = requiredKycLevel;
    if (requiredKycSteps !== undefined) updates.requiredKycSteps = requiredKycSteps;
    if (configuration !== undefined) updates.configuration = configuration;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(productConfigurations)
      .set(updates)
      .where(eq(productConfigurations.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: "Product configuration not found" });
      return;
    }
    res.json({ success: true, product: updated });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error updating product:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to update product" });
  }
});

router.get("/admin/brokers", async (_req: Request, res: Response): Promise<void> => {
  try {
    const brokers = await db.select().from(brokerConfigurations);
    res.json({ success: true, brokers });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error listing brokers:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to list brokers" });
  }
});

router.post("/admin/brokers", async (req: Request, res: Response): Promise<void> => {
  try {
    const { brokerCode, brokerName, brokerType, isEnabled, apiEndpoint, apiVersion, requiredEnvVars, supportedProducts, features, configuration } = req.body as {
      brokerCode?: string;
      brokerName?: string;
      brokerType?: string;
      isEnabled?: boolean;
      apiEndpoint?: string;
      apiVersion?: string;
      requiredEnvVars?: any;
      supportedProducts?: any;
      features?: any;
      configuration?: any;
    };
    if (!brokerCode || !brokerName || !brokerType) {
      res.status(400).json({ success: false, error: "brokerCode, brokerName, and brokerType are required" });
      return;
    }
    const [created] = await db
      .insert(brokerConfigurations)
      .values({
        brokerCode,
        brokerName,
        brokerType,
        isEnabled: isEnabled ?? true,
        apiEndpoint,
        apiVersion,
        requiredEnvVars,
        supportedProducts,
        features,
        configuration,
      })
      .returning();
    res.status(201).json({ success: true, broker: created });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error creating broker:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to create broker" });
  }
});

router.patch("/admin/brokers/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid broker ID" });
      return;
    }
    const updates: Record<string, any> = {};
    const { brokerName, isEnabled, apiEndpoint, apiVersion, requiredEnvVars, supportedProducts, features, configuration, healthStatus } = req.body;
    if (brokerName !== undefined) updates.brokerName = brokerName;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;
    if (apiVersion !== undefined) updates.apiVersion = apiVersion;
    if (requiredEnvVars !== undefined) updates.requiredEnvVars = requiredEnvVars;
    if (supportedProducts !== undefined) updates.supportedProducts = supportedProducts;
    if (features !== undefined) updates.features = features;
    if (configuration !== undefined) updates.configuration = configuration;
    if (healthStatus !== undefined) updates.healthStatus = healthStatus;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brokerConfigurations)
      .set(updates)
      .where(eq(brokerConfigurations.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: "Broker configuration not found" });
      return;
    }
    res.json({ success: true, broker: updated });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error updating broker:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to update broker" });
  }
});

router.get("/admin/audit-logs", async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityType, eventType, startDate, endDate, limit: limitStr, offset: offsetStr } = req.query;
    const limit = parseInt(limitStr as string, 10) || 50;
    const offset = parseInt(offsetStr as string, 10) || 0;

    const conditions: any[] = [];
    if (entityType) conditions.push(eq(platformAuditLogs.entityType, entityType as string));
    if (eventType) conditions.push(eq(platformAuditLogs.eventType, eventType as string));
    if (startDate) conditions.push(gte(platformAuditLogs.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(platformAuditLogs.createdAt, new Date(endDate as string)));

    const query = db
      .select()
      .from(platformAuditLogs)
      .orderBy(desc(platformAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json({ success: true, logs, pagination: { limit, offset } });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error getting audit logs:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get audit logs" });
  }
});

router.get("/admin/funnels", async (req: Request, res: Response): Promise<void> => {
  try {
    const { funnelType, productType, startDate, endDate } = req.query;

    const conditions: any[] = [];
    if (funnelType) conditions.push(eq(conversionFunnels.funnelType, funnelType as string));
    if (productType) conditions.push(eq(conversionFunnels.productType, productType as string));
    if (startDate) conditions.push(gte(conversionFunnels.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(conversionFunnels.createdAt, new Date(endDate as string)));

    const query = db
      .select()
      .from(conversionFunnels)
      .orderBy(desc(conversionFunnels.createdAt));

    const funnels = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json({ success: true, funnels });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error getting funnels:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get funnel data" });
  }
});

router.get("/admin/provider-dashboard", async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await db.select().from(kycProviders);
    const metricsResult = await db.select().from(providerMetrics);

    const dashboard = providers.map((provider) => {
      const providerMetricsList = metricsResult.filter((m) => m.providerId === provider.id);
      const totalCalls = providerMetricsList.reduce((sum, m) => sum + (m.totalCalls || 0), 0);
      const successCalls = providerMetricsList.reduce((sum, m) => sum + (m.successfulCalls || 0), 0);
      const failedCalls = providerMetricsList.reduce((sum, m) => sum + (m.failedCalls || 0), 0);
      const avgLatency = providerMetricsList.length > 0
        ? providerMetricsList.reduce((sum, m) => sum + (m.avgLatencyMs || 0), 0) / providerMetricsList.length
        : 0;

      return {
        providerId: provider.id,
        providerCode: provider.providerCode,
        providerName: provider.providerName,
        providerType: provider.providerType,
        isEnabled: provider.isEnabled,
        isConfigured: provider.isConfigured,
        healthStatus: provider.healthStatus,
        lastHealthCheck: provider.lastHealthCheck,
        metrics: {
          totalCalls,
          successCalls,
          failedCalls,
          successRate: totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(2) : "0.00",
          avgLatencyMs: Math.round(avgLatency),
        },
      };
    });

    res.json({ success: true, dashboard });
  } catch (error: unknown) {
    console.error("[KYC-ENGINE-ROUTES] Error getting provider dashboard:", errorMessage(error));
    res.status(500).json({ success: false, error: "Failed to get provider dashboard" });
  }
});

export default router;
