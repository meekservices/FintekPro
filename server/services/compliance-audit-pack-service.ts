// @ts-nocheck
import { db } from "../db";
import { 
  kycVault, 
  users, 
  regulatoryAuditPacks, 
  platformConfig,
  type RegulatoryAuditPack 
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export class ComplianceAuditPackService {
  /**
   * Generates and stores a consolidated audit pack for a lifecycle event.
   * This is used to prove regulatory compliance (KYC, Suitability, Fee transparency)
   * at a specific point in time.
   */
  static async generateAuditPack(
    userId: string, 
    packType: 'account_opening' | 'order_placement' | 'risk_update',
    transactionId?: string,
    orderSnapshot?: any
  ): Promise<RegulatoryAuditPack | null> {
    try {
      console.log(`[ComplianceAuditPack] Generating ${packType} pack for user ${userId}`);

      // 1. Fetch User and KYC Data
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const [kyc] = await db.select().from(kycVault).where(eq(kycVault.userId, userId)).limit(1);

      if (!user) throw new Error("User not found");

      // 2. Fetch Current Platform Config (Revenue Integrity)
      const configRows = await db
        .select()
        .from(platformConfig)
        .where(eq(platformConfig.isActive, true))
        .orderBy(desc(platformConfig.createdAt));
      
      const configSnapshot = configRows.reduce((acc: any, row) => {
        acc[row.configKey] = row.configValue;
        return acc;
      }, {});

      // 3. Build Snapshots
      const kycSnapshot = {
        status: kyc?.kycStatus || 'pending',
        panVerified: !!kyc?.panVerifiedAt,
        aadhaarVerified: !!kyc?.aadhaarVerifiedAt,
        panLast4: user.panNumber ? `***${user.panNumber.slice(-4)}` : null,
        timestamp: new Date().toISOString(),
      };

      const suitabilitySnapshot = {
        riskProfile: user.riskProfile || 'moderate',
        alphaSuitabilityEnabled: true,
        suitabilityWarningAcknowledged: orderSnapshot?.suitabilityWarningAcknowledged || false,
        timestamp: new Date().toISOString(),
      };

      // 4. Generate Integrity Hash
      const payloadString = JSON.stringify({
        userId,
        packType,
        kycSnapshot,
        suitabilitySnapshot,
        orderSnapshot,
        configSnapshot
      });
      
      const auditHash = crypto
        .createHash("sha256")
        .update(payloadString)
        .digest("hex");

      // 5. Save to DB
      const [pack] = await db.insert(regulatoryAuditPacks).values({
        userId,
        packType,
        transactionId,
        kycSnapshot,
        suitabilitySnapshot,
        orderSnapshot: orderSnapshot || {},
        platformConfigSnapshot: configSnapshot,
        auditHash,
      }).returning();

      console.log(`[ComplianceAuditPack] Successfully created pack ${pack.id}`);
      return pack;

    } catch (error: any) {
      console.error("[ComplianceAuditPack] Generation failed:", error.message);
      return null;
    }
  }

  /**
   * Retrieves audit packs for a user, sorted by recency.
   */
  static async getAuditPacks(userId: string) {
    return db
      .select()
      .from(regulatoryAuditPacks)
      .where(eq(regulatoryAuditPacks.userId, userId))
      .orderBy(desc(regulatoryAuditPacks.createdAt));
  }
}
