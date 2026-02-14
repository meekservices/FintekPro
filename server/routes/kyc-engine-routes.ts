import { Router, Request, Response } from "express";
import { kycOrchestrationEngine } from "../services/kyc-orchestration-engine";
import { identityTokenService } from "../services/identity-token-service";
import { dpdpConsentService } from "../services/dpdp-consent-service";
import { db } from "../db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  kycProviders,
  providerMetrics,
  productConfigurations,
  brokerConfigurations,
  platformAuditLogs,
  conversionFunnels,
} from "@shared/schema";

const router = Router();

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { userId, kycStep, productType, payload } = req.body;
    if (!userId || !kycStep || !productType) {
      return res.status(400).json({ success: false, error: "userId, kycStep, and productType are required" });
    }
    const result = await kycOrchestrationEngine.executeVerification({
      userId,
      kycStep,
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
          (result as any).identityProfile = {
            kycLevel: updatedProfile?.kycLevel,
            overallStatus: updatedProfile?.overallStatus,
          };
        } catch (profileErr: any) {
          console.error("[KYC-ENGINE-ROUTES] Failed to update identity profile:", profileErr?.message);
        }
      }
    }

    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in verify:", error?.message || error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.get("/flow/:productType", async (req: Request, res: Response) => {
  try {
    const { productType } = req.params;
    const flow = await kycOrchestrationEngine.getFlowForProduct(productType);
    res.json({ success: true, flow });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getFlowForProduct:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get flow" });
  }
});

router.get("/providers/:kycStep", async (req: Request, res: Response) => {
  try {
    const { kycStep } = req.params;
    const productType = (req.query.productType as string) || "";
    const chain = await kycOrchestrationEngine.getProviderChainForStep(kycStep, productType);
    res.json({ success: true, providers: chain });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getProviderChainForStep:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get provider chain" });
  }
});

router.get("/identity/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await identityTokenService.getOrCreateProfile(userId);
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getOrCreateProfile:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get identity profile" });
  }
});

router.get("/identity/:userId/eligibility/:productType", async (req: Request, res: Response) => {
  try {
    const { userId, productType } = req.params;
    const eligibility = await identityTokenService.checkKycEligibility(userId, productType);
    res.json({ success: true, eligibility });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in checkKycEligibility:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to check eligibility" });
  }
});

router.post("/identity/:userId/fatca", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await identityTokenService.declareFatca(userId);
    res.json({ success: true, message: "FATCA declaration recorded" });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in declareFatca:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to declare FATCA" });
  }
});

router.post("/identity/:userId/risk", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { category, score } = req.body;
    if (!category || score === undefined) {
      return res.status(400).json({ success: false, error: "category and score are required" });
    }
    await identityTokenService.assessRisk(userId, { category, score });
    res.json({ success: true, message: "Risk assessment recorded" });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in assessRisk:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to assess risk" });
  }
});

router.get("/consent/purposes/list", async (_req: Request, res: Response) => {
  try {
    const purposes = dpdpConsentService.getPurposes();
    res.json({ success: true, purposes });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getPurposes:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get consent purposes" });
  }
});

router.post("/consent", async (req: Request, res: Response) => {
  try {
    const { userId, consentType, consentGiven, ipAddress, userAgent } = req.body;
    if (!userId || !consentType || consentGiven === undefined) {
      return res.status(400).json({ success: false, error: "userId, consentType, and consentGiven are required" });
    }
    const record = await dpdpConsentService.captureConsent({
      userId,
      consentType,
      consentGiven,
      ipAddress,
      userAgent,
    });
    res.json({ success: true, consent: record });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in captureConsent:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to capture consent" });
  }
});

router.get("/consent/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const consents = await dpdpConsentService.getActiveConsents(userId);
    res.json({ success: true, consents });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getActiveConsents:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get active consents" });
  }
});

router.get("/consent/:userId/history", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const history = await dpdpConsentService.getConsentHistory(userId);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in getConsentHistory:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get consent history" });
  }
});

router.post("/consent/:userId/withdraw", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { consentType, reason } = req.body;
    if (!consentType || !reason) {
      return res.status(400).json({ success: false, error: "consentType and reason are required" });
    }
    await dpdpConsentService.withdrawConsent(userId, consentType, reason);
    res.json({ success: true, message: "Consent withdrawn successfully" });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error in withdrawConsent:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to withdraw consent" });
  }
});

router.get("/admin/providers", async (_req: Request, res: Response) => {
  try {
    const providers = await db.select().from(kycProviders);
    res.json({ success: true, providers });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error listing providers:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to list providers" });
  }
});

router.patch("/admin/providers/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid provider ID" });
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
      return res.status(404).json({ success: false, error: "Provider not found" });
    }
    res.json({ success: true, provider: updated });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error updating provider:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to update provider" });
  }
});

router.get("/admin/providers/:id/metrics", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid provider ID" });
    }
    const metrics = await db
      .select()
      .from(providerMetrics)
      .where(eq(providerMetrics.providerId, id))
      .orderBy(desc(providerMetrics.createdAt));
    res.json({ success: true, metrics });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error getting provider metrics:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get provider metrics" });
  }
});

router.patch("/admin/priority", async (req: Request, res: Response) => {
  try {
    const { kycStep, providerId, newPriority, updatedBy } = req.body;
    if (!kycStep || !providerId || !newPriority) {
      return res.status(400).json({ success: false, error: "kycStep, providerId, and newPriority are required" });
    }
    await kycOrchestrationEngine.updateProviderPriority(kycStep, providerId, newPriority, updatedBy);
    res.json({ success: true, message: "Provider priority updated" });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error updating priority:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to update priority" });
  }
});

router.get("/admin/products", async (_req: Request, res: Response) => {
  try {
    const products = await db.select().from(productConfigurations);
    res.json({ success: true, products });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error listing products:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to list products" });
  }
});

router.patch("/admin/products/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
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
      return res.status(404).json({ success: false, error: "Product configuration not found" });
    }
    res.json({ success: true, product: updated });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error updating product:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to update product" });
  }
});

router.get("/admin/brokers", async (_req: Request, res: Response) => {
  try {
    const brokers = await db.select().from(brokerConfigurations);
    res.json({ success: true, brokers });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error listing brokers:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to list brokers" });
  }
});

router.post("/admin/brokers", async (req: Request, res: Response) => {
  try {
    const { brokerCode, brokerName, brokerType, isEnabled, apiEndpoint, apiVersion, requiredEnvVars, supportedProducts, features, configuration } = req.body;
    if (!brokerCode || !brokerName || !brokerType) {
      return res.status(400).json({ success: false, error: "brokerCode, brokerName, and brokerType are required" });
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
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error creating broker:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to create broker" });
  }
});

router.patch("/admin/brokers/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid broker ID" });
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
      return res.status(404).json({ success: false, error: "Broker configuration not found" });
    }
    res.json({ success: true, broker: updated });
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error updating broker:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to update broker" });
  }
});

router.get("/admin/audit-logs", async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error getting audit logs:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get audit logs" });
  }
});

router.get("/admin/funnels", async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error getting funnels:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get funnel data" });
  }
});

router.get("/admin/provider-dashboard", async (_req: Request, res: Response) => {
  try {
    const providers = await db.select().from(kycProviders);
    const metrics = await db.select().from(providerMetrics);

    const dashboard = providers.map((provider) => {
      const providerMetricsList = metrics.filter((m) => m.providerId === provider.id);
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
  } catch (error: any) {
    console.error("[KYC-ENGINE-ROUTES] Error getting provider dashboard:", error?.message || error);
    res.status(500).json({ success: false, error: "Failed to get provider dashboard" });
  }
});

export default router;
