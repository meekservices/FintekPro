import { db } from "../db";
import { 
  globalInvestmentClientFeeMode, 
  feeModeAuditLog, 
  globalInvestmentAdminSettings,
  orderFeeConsentLog,
  users,
  GlobalInvestmentClientFeeMode,
  FeeModeAuditLog,
  GlobalInvestmentAdminSettings,
  InsertGlobalInvestmentClientFeeMode,
  InsertFeeModeAuditLog,
  InsertOrderFeeConsentLog
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import crypto from "crypto";

export type FeeMode = 'ADVISORY_PLATFORM' | 'PLATFORM_ONLY';
export type ChangedBy = 'CLIENT' | 'ADMIN';

export interface ClientCapabilities {
  canUseAi: boolean;
  canViewRecommendations: boolean;
  advisoryFeeApplicable: boolean;
  platformFeeApplicable: boolean;
  feeMode: FeeMode | null;
  feeModeSelected: boolean;
  requiresModeSelection: boolean;
  policyVersion: number;
}

export interface FeeBreakdown {
  advisoryFeeBps: number;
  platformFeeBps: number;
  advisoryFeeAmount: number;
  platformFeeAmount: number;
  totalFeeAmount: number;
  feeMode: FeeMode;
}

export interface FeeModeSelectionRequest {
  clientId: string;
  feeMode: FeeMode;
  disclaimerAcknowledged: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminOverrideRequest {
  clientId: string;
  newMode: FeeMode;
  adminId: string;
  reason: string;
  ipAddress?: string;
}

class ClientFeeModeService {
  
  private generateChecksum(data: object): string {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async getAdminSettings(): Promise<GlobalInvestmentAdminSettings | null> {
    try {
      const [settings] = await db.select()
        .from(globalInvestmentAdminSettings)
        .limit(1);
      return settings || null;
    } catch (error) {
      console.error("Error fetching admin settings:", error);
      return null;
    }
  }

  async updateAdminSettings(updates: Partial<GlobalInvestmentAdminSettings>, updatedBy: string): Promise<boolean> {
    try {
      const existing = await this.getAdminSettings();
      if (!existing) {
        await db.insert(globalInvestmentAdminSettings).values({
          ...updates,
          policyUpdatedBy: updatedBy,
          policyUpdatedAt: new Date(),
          policyVersion: 1
        } as any);
      } else {
        await db.update(globalInvestmentAdminSettings)
          .set({
            ...updates,
            policyUpdatedBy: updatedBy,
            policyUpdatedAt: new Date(),
            policyVersion: (existing.policyVersion || 1) + 1,
            updatedAt: new Date()
          })
          .where(eq(globalInvestmentAdminSettings.id, existing.id));
      }
      return true;
    } catch (error) {
      console.error("Error updating admin settings:", error);
      return false;
    }
  }

  async getClientFeeMode(clientId: string): Promise<GlobalInvestmentClientFeeMode | null> {
    try {
      const [result] = await db.select()
        .from(globalInvestmentClientFeeMode)
        .where(eq(globalInvestmentClientFeeMode.clientId, clientId))
        .limit(1);
      return result || null;
    } catch (error) {
      console.error("Error fetching client fee mode:", error);
      return null;
    }
  }

  async resolveClientCapabilities(clientId: string): Promise<ClientCapabilities> {
    const [clientFeeMode, adminSettings] = await Promise.all([
      this.getClientFeeMode(clientId),
      this.getAdminSettings()
    ]);

    const policyVersion = adminSettings?.policyVersion || 1;
    const feeMode = clientFeeMode?.feeMode as FeeMode | null;
    const feeModeSelected = !!clientFeeMode;

    let requiresModeSelection = !feeModeSelected;

    if (feeMode === 'PLATFORM_ONLY') {
      return {
        canUseAi: false,
        canViewRecommendations: false,
        advisoryFeeApplicable: false,
        platformFeeApplicable: true,
        feeMode,
        feeModeSelected,
        requiresModeSelection,
        policyVersion
      };
    }

    if (feeMode === 'ADVISORY_PLATFORM') {
      return {
        canUseAi: true,
        canViewRecommendations: true,
        advisoryFeeApplicable: true,
        platformFeeApplicable: true,
        feeMode,
        feeModeSelected,
        requiresModeSelection,
        policyVersion
      };
    }

    return {
      canUseAi: false,
      canViewRecommendations: false,
      advisoryFeeApplicable: false,
      platformFeeApplicable: false,
      feeMode: null,
      feeModeSelected: false,
      requiresModeSelection: true,
      policyVersion
    };
  }

  async selectFeeMode(request: FeeModeSelectionRequest): Promise<{ success: boolean; error?: string }> {
    const { clientId, feeMode, disclaimerAcknowledged, ipAddress, userAgent } = request;

    if (!disclaimerAcknowledged) {
      return { success: false, error: "Disclaimer must be acknowledged" };
    }

    const adminSettings = await this.getAdminSettings();
    
    if (feeMode === 'PLATFORM_ONLY' && !adminSettings?.enablePlatformOnlyMode) {
      return { success: false, error: "Platform-Only mode is not enabled" };
    }

    if (!adminSettings?.allowClientSelfSelection) {
      return { success: false, error: "Self-selection is not enabled. Please contact support." };
    }

    const existingMode = await this.getClientFeeMode(clientId);
    const oldMode = existingMode?.feeMode || null;

    try {
      const now = new Date();

      if (existingMode) {
        await db.update(globalInvestmentClientFeeMode)
          .set({
            feeMode,
            feeModeSelectedAt: now,
            feeModeConsentIp: ipAddress,
            disclaimerAcknowledged: true,
            disclaimerAcknowledgedAt: now,
            lastModifiedBy: 'CLIENT',
            lastModifiedById: clientId,
            updatedAt: now
          })
          .where(eq(globalInvestmentClientFeeMode.clientId, clientId));
      } else {
        await db.insert(globalInvestmentClientFeeMode).values({
          clientId,
          feeMode,
          feeModeSelectedAt: now,
          feeModeConsentIp: ipAddress,
          disclaimerAcknowledged: true,
          disclaimerAcknowledgedAt: now,
          lastModifiedBy: 'CLIENT',
          lastModifiedById: clientId
        });
      }

      const auditData = {
        clientId,
        oldMode,
        newMode: feeMode,
        changedBy: 'CLIENT' as ChangedBy,
        changedById: clientId,
        ipAddress,
        userAgent,
        consentCaptured: true,
        disclaimerShown: true
      };

      await db.insert(feeModeAuditLog).values({
        ...auditData,
        checksumHash: this.generateChecksum(auditData)
      });

      return { success: true };
    } catch (error) {
      console.error("Error selecting fee mode:", error);
      return { success: false, error: "Failed to save fee mode selection" };
    }
  }

  async adminOverrideMode(request: AdminOverrideRequest): Promise<{ success: boolean; error?: string }> {
    const { clientId, newMode, adminId, reason, ipAddress } = request;

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: "A detailed reason is required for admin overrides" };
    }

    const existingMode = await this.getClientFeeMode(clientId);
    const oldMode = existingMode?.feeMode || null;

    try {
      const now = new Date();

      if (existingMode) {
        await db.update(globalInvestmentClientFeeMode)
          .set({
            feeMode: newMode,
            feeModeSelectedAt: now,
            lastModifiedBy: 'ADMIN',
            lastModifiedById: adminId,
            updatedAt: now
          })
          .where(eq(globalInvestmentClientFeeMode.clientId, clientId));
      } else {
        await db.insert(globalInvestmentClientFeeMode).values({
          clientId,
          feeMode: newMode,
          feeModeSelectedAt: now,
          disclaimerAcknowledged: false,
          lastModifiedBy: 'ADMIN',
          lastModifiedById: adminId
        });
      }

      const auditData = {
        clientId,
        oldMode,
        newMode,
        changedBy: 'ADMIN' as ChangedBy,
        changedById: adminId,
        ipAddress,
        changeReason: reason,
        consentCaptured: false,
        disclaimerShown: false
      };

      await db.insert(feeModeAuditLog).values({
        ...auditData,
        checksumHash: this.generateChecksum(auditData)
      });

      return { success: true };
    } catch (error) {
      console.error("Error in admin override:", error);
      return { success: false, error: "Failed to override fee mode" };
    }
  }

  async calculateFees(orderValueInr: number, clientId: string): Promise<FeeBreakdown | null> {
    const [clientFeeMode, adminSettings] = await Promise.all([
      this.getClientFeeMode(clientId),
      this.getAdminSettings()
    ]);

    if (!clientFeeMode || !adminSettings) {
      return null;
    }

    const feeMode = clientFeeMode.feeMode as FeeMode;
    const advisoryFeeBps = adminSettings.advisoryFeeBps || 25;
    const platformFeeBps = adminSettings.platformFeeBps || 10;

    let advisoryFeeAmount = 0;
    let platformFeeAmount = (orderValueInr * platformFeeBps) / 10000;

    if (adminSettings.platformFeeCapInr) {
      platformFeeAmount = Math.min(platformFeeAmount, parseFloat(adminSettings.platformFeeCapInr));
    }

    if (feeMode === 'ADVISORY_PLATFORM') {
      advisoryFeeAmount = (orderValueInr * advisoryFeeBps) / 10000;
      if (adminSettings.advisoryFeeCapInr) {
        advisoryFeeAmount = Math.min(advisoryFeeAmount, parseFloat(adminSettings.advisoryFeeCapInr));
      }
    }

    return {
      advisoryFeeBps: feeMode === 'ADVISORY_PLATFORM' ? advisoryFeeBps : 0,
      platformFeeBps,
      advisoryFeeAmount: Math.round(advisoryFeeAmount * 100) / 100,
      platformFeeAmount: Math.round(platformFeeAmount * 100) / 100,
      totalFeeAmount: Math.round((advisoryFeeAmount + platformFeeAmount) * 100) / 100,
      feeMode
    };
  }

  async logOrderFeeConsent(
    orderId: string,
    clientId: string,
    orderValueInr: number,
    symbol: string,
    side: string,
    ipAddress?: string
  ): Promise<boolean> {
    try {
      const feeBreakdown = await this.calculateFees(orderValueInr, clientId);
      if (!feeBreakdown) {
        return false;
      }

      await db.insert(orderFeeConsentLog).values({
        orderId,
        clientId,
        feeMode: feeBreakdown.feeMode,
        advisoryFeeApplied: feeBreakdown.advisoryFeeAmount.toString(),
        platformFeeApplied: feeBreakdown.platformFeeAmount.toString(),
        totalFeeApplied: feeBreakdown.totalFeeAmount.toString(),
        orderValueInr: orderValueInr.toString(),
        orderSymbol: symbol,
        orderSide: side,
        feeBreakdownShown: true,
        consentAcknowledged: true,
        consentTimestamp: new Date(),
        ipAddress
      });

      return true;
    } catch (error) {
      console.error("Error logging order fee consent:", error);
      return false;
    }
  }

  async getAuditLog(clientId?: string, limit: number = 100): Promise<FeeModeAuditLog[]> {
    try {
      let query = db.select()
        .from(feeModeAuditLog)
        .orderBy(desc(feeModeAuditLog.timestamp))
        .limit(limit);

      if (clientId) {
        query = db.select()
          .from(feeModeAuditLog)
          .where(eq(feeModeAuditLog.clientId, clientId))
          .orderBy(desc(feeModeAuditLog.timestamp))
          .limit(limit);
      }

      return await query;
    } catch (error) {
      console.error("Error fetching audit log:", error);
      return [];
    }
  }

  async getFeeModeStatistics(): Promise<{
    totalClients: number;
    advisoryPlatform: number;
    platformOnly: number;
    noSelection: number;
  }> {
    try {
      const allModes = await db.select({
        feeMode: globalInvestmentClientFeeMode.feeMode
      }).from(globalInvestmentClientFeeMode);

      const advisoryPlatform = allModes.filter(m => m.feeMode === 'ADVISORY_PLATFORM').length;
      const platformOnly = allModes.filter(m => m.feeMode === 'PLATFORM_ONLY').length;

      return {
        totalClients: allModes.length,
        advisoryPlatform,
        platformOnly,
        noSelection: 0
      };
    } catch (error) {
      console.error("Error fetching statistics:", error);
      return {
        totalClients: 0,
        advisoryPlatform: 0,
        platformOnly: 0,
        noSelection: 0
      };
    }
  }

  async generateSebiExportBundle(clientId: string): Promise<{
    modeHistory: FeeModeAuditLog[];
    orderConsents: any[];
    currentMode: GlobalInvestmentClientFeeMode | null;
    exportedAt: string;
    clientId: string;
  }> {
    const [modeHistory, currentMode] = await Promise.all([
      this.getAuditLog(clientId, 1000),
      this.getClientFeeMode(clientId)
    ]);

    const orderConsents = await db.select()
      .from(orderFeeConsentLog)
      .where(eq(orderFeeConsentLog.clientId, clientId))
      .orderBy(desc(orderFeeConsentLog.createdAt));

    return {
      modeHistory,
      orderConsents,
      currentMode,
      exportedAt: new Date().toISOString(),
      clientId
    };
  }

  async generateZohoInvoiceLineItems(
    orderValueInr: number,
    clientId: string,
    orderDetails: {
      orderId: string;
      symbol: string;
      quantity: number;
      assetClass: string;
    }
  ): Promise<{
    lineItems: Array<{
      name: string;
      description: string;
      rate: number;
      quantity: number;
      hsn_or_sac?: string;
    }>;
    notes: string;
    feeMode: FeeMode;
    totalFees: number;
  }> {
    const feeBreakdown = await this.calculateFees(orderValueInr, clientId);
    if (!feeBreakdown) {
      throw new Error("Client fee mode not selected");
    }

    const lineItems: Array<{
      name: string;
      description: string;
      rate: number;
      quantity: number;
      hsn_or_sac?: string;
    }> = [];

    const isAdvisory = feeBreakdown.feeMode === 'ADVISORY_PLATFORM';
    const orderDate = new Date().toISOString().split('T')[0];

    if (isAdvisory && feeBreakdown.advisoryFeeAmount > 0) {
      lineItems.push({
        name: "Advisory Fee - Global Investments",
        description: `Investment advisory service fee for ${orderDetails.symbol} (${orderDetails.assetClass}). ` +
          `Order ID: ${orderDetails.orderId}, Qty: ${orderDetails.quantity}, ` +
          `Order Value: ₹${orderValueInr.toLocaleString('en-IN')}. ` +
          `Rate: ${feeBreakdown.advisoryFeeBps} bps (${(feeBreakdown.advisoryFeeBps / 100).toFixed(2)}%)`,
        rate: feeBreakdown.advisoryFeeAmount,
        quantity: 1,
        hsn_or_sac: "997159"
      });
    }

    lineItems.push({
      name: "Platform Fee - Global Investments",
      description: `Execution platform service fee for ${orderDetails.symbol} (${orderDetails.assetClass}). ` +
        `Order ID: ${orderDetails.orderId}, Qty: ${orderDetails.quantity}, ` +
        `Order Value: ₹${orderValueInr.toLocaleString('en-IN')}. ` +
        `Rate: ${feeBreakdown.platformFeeBps} bps (${(feeBreakdown.platformFeeBps / 100).toFixed(2)}%)`,
      rate: feeBreakdown.platformFeeAmount,
      quantity: 1,
      hsn_or_sac: "997159"
    });

    const notes = isAdvisory
      ? `Global Investments Order - Advisory + Platform Mode. ` +
        `This invoice includes investment advisory fees for personalized AI-powered recommendations ` +
        `and platform execution fees. Client has opted for full advisory services.`
      : `Global Investments Order - Platform-Only (Execution-Only) Mode. ` +
        `This invoice includes only platform execution fees. Client has opted for self-directed trading ` +
        `without investment advisory services. No personalized recommendations were provided for this transaction.`;

    return {
      lineItems,
      notes,
      feeMode: feeBreakdown.feeMode,
      totalFees: feeBreakdown.totalFeeAmount
    };
  }
}

export const clientFeeModeService = new ClientFeeModeService();
