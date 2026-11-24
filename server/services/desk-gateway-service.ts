/**
 * Desk Gateway Service — FintekPro Financial Services LLP
 *
 * Implements progressive desk capability activation, licensing governance,
 * and seamless dual-mode execution (Test Sandbox vs. Production Live).
 *
 * Governing Regulators:
 * - SEBI (Investment Advisers) Regulations, 2013 (Regulation 22 Segregation & SIDD)
 * - SEBI (Stock Brokers) Regulations, 1992 (Authorised Person Framework for Upstox)
 * - AMFI Code of Conduct & SEBI (Mutual Funds) Regulations, 1996 (Corporate ARN & EUIN)
 * - RBI FEMA (Liberalised Remittance Scheme for Alpaca US Equities)
 *
 * Architecture:
 * - Layered under /services
 * - Drizzle ORM with automatic self-healing in-memory fallback for test/offline resilience
 * - Structured audit logs & deterministic state machine transitions
 *
 * @engineVersion FINTEK-DESK-GATEWAY-v1.0
 */

import { db } from "../db";
import {
  deskOperationalConfigs,
  statutoryLicenses,
  licenseVerificationDocuments,
  DeskType,
  OperatingMode,
  CapabilityTier,
  LicenseStatus,
  DocVerificationStatus,
  LicenseDocType,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { nanoid } from "nanoid";

export interface ExecutionModeResolution {
  mode: "LIVE" | "SANDBOX_MOCK";
  isSimulated: boolean;
  reason: string;
  capabilityTier: CapabilityTier;
  operatingMode: OperatingMode;
  deskStatus: LicenseStatus;
  licenseNumber?: string | null;
  deskType: DeskType;
  resolvedAt: string;
}

export interface DeskStatusSummary {
  config: {
    id: string;
    entityName: string;
    llpin: string | null;
    operatingMode: OperatingMode;
    capabilityTier: CapabilityTier;
    isMfDistributionActive: boolean;
    isUpstoxEquityActive: boolean;
    isAlpacaUsEquityActive: boolean;
    isCorporateFdActive: boolean;
    isBondDistributionActive: boolean;
    isLamfActive: boolean;
    isSdiActive: boolean;
    isAiAdvisoryActive: boolean;
    updatedAt: string;
  };
  licenses: Array<{
    id: string;
    deskType: DeskType;
    licenseNumber: string | null;
    holderName: string | null;
    status: LicenseStatus;
    isSandboxed: boolean;
    issueDate: string | null;
    validUntil: string | null;
    documentsCount: number;
    pendingDocuments: string[];
    partnerCredentialsConfigured: boolean;
  }>;
  nextSteps: string[];
}

export interface SimulatedOrderParams {
  deskType: DeskType;
  symbolOrScheme: string;
  amount: number;
  action: "BUY" | "SELL" | "SIP" | "SCREEN";
  userId?: string;
}

interface InMemoryConfig {
  id: string;
  entityName: string;
  llpin: string | null;
  operatingMode: OperatingMode;
  capabilityTier: CapabilityTier;
  isMfDistributionActive: boolean;
  isUpstoxEquityActive: boolean;
  isAlpacaUsEquityActive: boolean;
  isCorporateFdActive: boolean;
  isBondDistributionActive: boolean;
  isLamfActive: boolean;
  isSdiActive: boolean;
  isAiAdvisoryActive: boolean;
  updatedBy: string;
  updatedAt: Date;
}

interface InMemoryLicense {
  id: string;
  deskConfigId: string;
  deskType: DeskType;
  licenseNumber: string | null;
  holderName: string | null;
  issueDate?: Date | null;
  validUntil?: Date | null;
  status: LicenseStatus;
  isSandboxed: boolean;
  partnerCredentials: Record<string, any>;
  updatedAt: Date;
}

interface InMemoryDoc {
  id: string;
  licenseId: string;
  documentType: LicenseDocType;
  fileName: string;
  fileUrl: string;
  fileHashSha256: string;
  uploadedByAdminId: string;
  status: DocVerificationStatus;
  verifiedAt?: Date | null;
  verifiedByAdminId?: string | null;
  verificationNotes?: string | null;
  uploadedAt: Date;
}

export class DeskGatewayService {
  private static instance: DeskGatewayService;
  static readonly MASTER_CONFIG_ID = "FINTEKPRO_LLP_MASTER";
  static readonly ENGINE_VERSION = "FINTEK-DESK-GATEWAY-v1.0";

  // In-Memory self-healing stores (active when DB connection is offline/testing)
  private memoryConfig: InMemoryConfig;
  private memoryLicenses: Map<string, InMemoryLicense> = new Map();
  private memoryDocs: Map<string, InMemoryDoc> = new Map();
  private isDbConnected = true;

  // Mandatory documents per desk to achieve VERIFIED_ACTIVE
  private static readonly MANDATORY_DOCS_BY_DESK: Record<DeskType, LicenseDocType[]> = {
    MFD_AMFI: ["AMFI_CORPORATE_ARN_CARD", "NISM_V_A_CERTIFICATE", "EUIN_ALLOTMENT_LETTER"],
    IRIS_KFINTECH: ["KFINTECH_IRIS_SERVICE_AGREEMENT"],
    UPSTOX_BROKER: ["UPSTOX_AP_AGREEMENT"],
    ALPACA_GLOBAL: ["ALPACA_BROKER_PARTNER_AGREEMENT", "GST_EXPORT_LUT_CERTIFICATE"],
    SEBI_RIA_ADVISORY: ["SEBI_RIA_REGISTRATION_CERTIFICATE", "CA_NET_WORTH_CERTIFICATE"],
    BONDS_NCDS_DESK: ["UPSTOX_DEBT_SEGMENT_APPROVAL", "CRISIL_ICRA_BOND_RATING_DATA_AGMT"],
    CORPORATE_FD_DESK: ["BAJAJ_SHRIRAM_FD_AGENCY_AGMT"],
    LAMF_CREDIT_DESK: ["VOLT_MONEY_OR_NBFC_LAMF_PARTNER_AGMT"],
    SDI_ALTERNATIVE_DEBT_DESK: ["SEBI_OBPP_SDI_TRUSTEE_OR_ISSUER_AGMT"],
  };

  constructor() {
    this.memoryConfig = {
      id: DeskGatewayService.MASTER_CONFIG_ID,
      entityName: "FintekPro Financial Services LLP",
      llpin: "AAM-1234",
      operatingMode: "TEST_SANDBOX",
      capabilityTier: "SANDBOX_TEST",
      isMfDistributionActive: false,
      isUpstoxEquityActive: false,
      isAlpacaUsEquityActive: false,
      isCorporateFdActive: false,
      isBondDistributionActive: false,
      isLamfActive: false,
      isSdiActive: false,
      isAiAdvisoryActive: false,
      updatedBy: "SYSTEM_INIT",
      updatedAt: new Date(),
    };

    const defaultDesks: Array<{ id: string; deskType: DeskType }> = [
      { id: "LIC_MFD_AMFI", deskType: "MFD_AMFI" },
      { id: "LIC_IRIS_KFINTECH", deskType: "IRIS_KFINTECH" },
      { id: "LIC_UPSTOX_BROKER", deskType: "UPSTOX_BROKER" },
      { id: "LIC_ALPACA_GLOBAL", deskType: "ALPACA_GLOBAL" },
      { id: "LIC_SEBI_RIA_ADVISORY", deskType: "SEBI_RIA_ADVISORY" },
      { id: "LIC_BONDS_NCDS", deskType: "BONDS_NCDS_DESK" },
      { id: "LIC_CORPORATE_FD", deskType: "CORPORATE_FD_DESK" },
      { id: "LIC_LAMF_CREDIT", deskType: "LAMF_CREDIT_DESK" },
      { id: "LIC_SDI_ALT_DEBT", deskType: "SDI_ALTERNATIVE_DEBT_DESK" },
    ];

    for (const d of defaultDesks) {
      this.memoryLicenses.set(d.id, {
        id: d.id,
        deskConfigId: DeskGatewayService.MASTER_CONFIG_ID,
        deskType: d.deskType,
        licenseNumber: null,
        holderName: "FintekPro Financial Services LLP",
        status: "PENDING_UPLOAD",
        isSandboxed: true,
        partnerCredentials: {},
        updatedAt: new Date(),
      });
    }
  }

  static getInstance(): DeskGatewayService {
    if (!DeskGatewayService.instance) {
      DeskGatewayService.instance = new DeskGatewayService();
    }
    return DeskGatewayService.instance;
  }

  /**
   * Initializes master entity configuration and statutory desks in DB if reachable.
   */
  async ensureBootstrapped(): Promise<void> {
    try {
      const [existing] = await db
        .select()
        .from(deskOperationalConfigs)
        .where(eq(deskOperationalConfigs.id, DeskGatewayService.MASTER_CONFIG_ID))
        .limit(1);

      if (!existing) {
        await db.insert(deskOperationalConfigs).values({
          id: DeskGatewayService.MASTER_CONFIG_ID,
          entityName: "FintekPro Financial Services LLP",
          llpin: "AAM-1234",
          operatingMode: "TEST_SANDBOX",
          capabilityTier: "SANDBOX_TEST",
          isMfDistributionActive: false,
          isUpstoxEquityActive: false,
          isAlpacaUsEquityActive: false,
          isCorporateFdActive: false,
          isBondDistributionActive: false,
          isLamfActive: false,
          isSdiActive: false,
          isAiAdvisoryActive: false,
          updatedBy: "SYSTEM_INIT",
        });

        const defaultDesks: Array<{ id: string; deskType: DeskType }> = [
          { id: "LIC_MFD_AMFI", deskType: "MFD_AMFI" },
          { id: "LIC_IRIS_KFINTECH", deskType: "IRIS_KFINTECH" },
          { id: "LIC_UPSTOX_BROKER", deskType: "UPSTOX_BROKER" },
          { id: "LIC_ALPACA_GLOBAL", deskType: "ALPACA_GLOBAL" },
          { id: "LIC_SEBI_RIA_ADVISORY", deskType: "SEBI_RIA_ADVISORY" },
          { id: "LIC_BONDS_NCDS", deskType: "BONDS_NCDS_DESK" },
          { id: "LIC_CORPORATE_FD", deskType: "CORPORATE_FD_DESK" },
          { id: "LIC_LAMF_CREDIT", deskType: "LAMF_CREDIT_DESK" },
          { id: "LIC_SDI_ALT_DEBT", deskType: "SDI_ALTERNATIVE_DEBT_DESK" },
        ];

        for (const desk of defaultDesks) {
          await db.insert(statutoryLicenses).values({
            id: desk.id,
            deskConfigId: DeskGatewayService.MASTER_CONFIG_ID,
            deskType: desk.deskType,
            status: "PENDING_UPLOAD",
            isSandboxed: true,
            partnerCredentials: {},
          });
        }
      }
      this.isDbConnected = true;
    } catch {
      // In sandbox/offline mode, fallback to in-memory state
      this.isDbConnected = false;
    }
  }

  /**
   * Fetches full operational status, licenses, and document checklist.
   */
  async getStatusSummary(): Promise<DeskStatusSummary> {
    await this.ensureBootstrapped();

    let config: any = this.memoryConfig;
    let licenses: any[] = Array.from(this.memoryLicenses.values());
    let allDocs: any[] = Array.from(this.memoryDocs.values());

    if (this.isDbConnected) {
      try {
        const [dbConfig] = await db
          .select()
          .from(deskOperationalConfigs)
          .where(eq(deskOperationalConfigs.id, DeskGatewayService.MASTER_CONFIG_ID))
          .limit(1);

        if (dbConfig) {
          config = dbConfig;
          licenses = await db
            .select()
            .from(statutoryLicenses)
            .where(eq(statutoryLicenses.deskConfigId, DeskGatewayService.MASTER_CONFIG_ID));
          allDocs = await db.select().from(licenseVerificationDocuments);
        }
      } catch {
        this.isDbConnected = false;
      }
    }

    const nextSteps: string[] = [];
    const formattedLicenses = licenses.map((lic) => {
      const docsForLic = allDocs.filter((d) => d.licenseId === lic.id && d.status === "APPROVED");
      const approvedTypes = new Set(docsForLic.map((d) => d.documentType));
      const required = DeskGatewayService.MANDATORY_DOCS_BY_DESK[lic.deskType as DeskType] || [];
      const pending = required.filter((r) => !approvedTypes.has(r));

      if (pending.length > 0) {
        nextSteps.push(
          `Desk ${lic.deskType}: Upload and verify remaining mandatory documents: ${pending.join(", ")}`,
        );
      }

      const creds = lic.partnerCredentials as Record<string, any> | null;
      const partnerConfigured =
        creds && Object.keys(creds).length > 0 && (Boolean(creds.clientId) || Boolean(creds.apiKeyRef));

      return {
        id: lic.id,
        deskType: lic.deskType as DeskType,
        licenseNumber: lic.licenseNumber,
        holderName: lic.holderName,
        status: lic.status as LicenseStatus,
        isSandboxed: lic.isSandboxed,
        issueDate: lic.issueDate ? (lic.issueDate instanceof Date ? lic.issueDate.toISOString() : String(lic.issueDate)) : null,
        validUntil: lic.validUntil ? (lic.validUntil instanceof Date ? lic.validUntil.toISOString() : String(lic.validUntil)) : null,
        documentsCount: docsForLic.length,
        pendingDocuments: pending,
        partnerCredentialsConfigured: Boolean(partnerConfigured),
      };
    });

    if (config?.operatingMode === "TEST_SANDBOX") {
      nextSteps.unshift(
        "Platform is in TEST_SANDBOX mode. All partner API executions run in safe mock/simulation mode. Switch to PRODUCTION_LIVE when licenses are verified.",
      );
    }

    return {
      config: {
        id: config.id,
        entityName: config.entityName,
        llpin: config.llpin,
        operatingMode: config.operatingMode as OperatingMode,
        capabilityTier: config.capabilityTier as CapabilityTier,
        isMfDistributionActive: config.isMfDistributionActive,
        isUpstoxEquityActive: config.isUpstoxEquityActive,
        isAlpacaUsEquityActive: config.isAlpacaUsEquityActive,
        isCorporateFdActive: config.isCorporateFdActive,
        isBondDistributionActive: config.isBondDistributionActive,
        isLamfActive: (config as any).isLamfActive ?? false,
        isSdiActive: (config as any).isSdiActive ?? false,
        isAiAdvisoryActive: config.isAiAdvisoryActive,
        updatedAt: config.updatedAt instanceof Date ? config.updatedAt.toISOString() : String(config.updatedAt),
      },
      licenses: formattedLicenses,
      nextSteps,
    };
  }

  /**
   * Updates global platform operating mode (TEST_SANDBOX | RESTRICTED_PILOT | PRODUCTION_LIVE)
   */
  async updateOperatingMode(mode: OperatingMode, adminId: string): Promise<CapabilityTier> {
    await this.ensureBootstrapped();

    this.memoryConfig.operatingMode = mode;
    this.memoryConfig.updatedBy = adminId;
    this.memoryConfig.updatedAt = new Date();

    if (this.isDbConnected) {
      try {
        await db
          .update(deskOperationalConfigs)
          .set({
            operatingMode: mode,
            updatedBy: adminId,
            updatedAt: new Date(),
          })
          .where(eq(deskOperationalConfigs.id, DeskGatewayService.MASTER_CONFIG_ID));
      } catch {
        this.isDbConnected = false;
      }
    }

    return await this.recalculateCapabilityTier(adminId);
  }

  /**
   * Upserts details for a statutory license (e.g. ARN number, AP ID, Alpaca credentials).
   */
  async upsertLicense(params: {
    deskType: DeskType;
    licenseNumber?: string;
    holderName?: string;
    issueDate?: Date;
    validUntil?: Date;
    partnerCredentials?: Record<string, any>;
    isSandboxed?: boolean;
    adminId: string;
  }): Promise<void> {
    await this.ensureBootstrapped();

    const licenseId = `LIC_${params.deskType}`;
    const memLic = this.memoryLicenses.get(licenseId) || {
      id: licenseId,
      deskConfigId: DeskGatewayService.MASTER_CONFIG_ID,
      deskType: params.deskType,
      licenseNumber: null,
      holderName: "FintekPro Financial Services LLP",
      status: "PENDING_UPLOAD",
      isSandboxed: true,
      partnerCredentials: {},
      updatedAt: new Date(),
    };

    if (params.licenseNumber !== undefined) memLic.licenseNumber = params.licenseNumber;
    if (params.holderName !== undefined) memLic.holderName = params.holderName;
    if (params.issueDate !== undefined) memLic.issueDate = params.issueDate;
    if (params.validUntil !== undefined) memLic.validUntil = params.validUntil;
    if (params.partnerCredentials !== undefined) memLic.partnerCredentials = params.partnerCredentials;
    if (params.isSandboxed !== undefined) memLic.isSandboxed = params.isSandboxed;
    memLic.updatedAt = new Date();
    this.memoryLicenses.set(licenseId, memLic);

    if (this.isDbConnected) {
      try {
        const [existing] = await db
          .select()
          .from(statutoryLicenses)
          .where(eq(statutoryLicenses.id, licenseId))
          .limit(1);

        if (existing) {
          await db
            .update(statutoryLicenses)
            .set({
              licenseNumber: memLic.licenseNumber,
              holderName: memLic.holderName,
              issueDate: memLic.issueDate || null,
              validUntil: memLic.validUntil || null,
              partnerCredentials: memLic.partnerCredentials,
              isSandboxed: memLic.isSandboxed,
              updatedAt: new Date(),
            })
            .where(eq(statutoryLicenses.id, licenseId));
        } else {
          await db.insert(statutoryLicenses).values({
            id: licenseId,
            deskConfigId: DeskGatewayService.MASTER_CONFIG_ID,
            deskType: params.deskType,
            licenseNumber: memLic.licenseNumber,
            holderName: memLic.holderName,
            issueDate: memLic.issueDate || null,
            validUntil: memLic.validUntil || null,
            status: memLic.status,
            isSandboxed: memLic.isSandboxed,
            partnerCredentials: memLic.partnerCredentials,
          });
        }
      } catch {
        this.isDbConnected = false;
      }
    }

    await this.recalculateCapabilityTier(params.adminId);
  }

  /**
   * Uploads and registers a verification document for a license.
   */
  async recordDocumentUpload(params: {
    licenseId: string;
    documentType: LicenseDocType;
    fileName: string;
    fileUrl: string;
    fileHashSha256: string;
    adminId: string;
  }): Promise<string> {
    const docId = `DOC_${nanoid(12)}`;

    const memDoc: InMemoryDoc = {
      id: docId,
      licenseId: params.licenseId,
      documentType: params.documentType,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      fileHashSha256: params.fileHashSha256,
      uploadedByAdminId: params.adminId,
      status: "PENDING",
      uploadedAt: new Date(),
    };
    this.memoryDocs.set(docId, memDoc);

    const memLic = this.memoryLicenses.get(params.licenseId);
    if (memLic) {
      memLic.status = "UNDER_REVIEW";
      memLic.updatedAt = new Date();
    }

    if (this.isDbConnected) {
      try {
        await db.insert(licenseVerificationDocuments).values({
          id: docId,
          licenseId: params.licenseId,
          documentType: params.documentType,
          fileUrl: params.fileUrl,
          fileName: params.fileName,
          fileHashSha256: params.fileHashSha256,
          uploadedByAdminId: params.adminId,
          status: "PENDING",
        });

        await db
          .update(statutoryLicenses)
          .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
          .where(eq(statutoryLicenses.id, params.licenseId));
      } catch {
        this.isDbConnected = false;
      }
    }

    return docId;
  }

  /**
   * Approves or rejects an uploaded verification document.
   */
  async verifyDocument(params: {
    documentId: string;
    status: DocVerificationStatus;
    verificationNotes?: string;
    adminId: string;
  }): Promise<{ capabilityTier: CapabilityTier; licenseStatus: LicenseStatus }> {
    const memDoc = this.memoryDocs.get(params.documentId);
    if (memDoc) {
      memDoc.status = params.status;
      memDoc.verifiedAt = new Date();
      memDoc.verifiedByAdminId = params.adminId;
      memDoc.verificationNotes = params.verificationNotes || null;
    }

    let licId = memDoc?.licenseId || "";

    if (this.isDbConnected) {
      try {
        const [doc] = await db
          .select()
          .from(licenseVerificationDocuments)
          .where(eq(licenseVerificationDocuments.id, params.documentId))
          .limit(1);

        if (doc) {
          licId = doc.licenseId;
          await db
            .update(licenseVerificationDocuments)
            .set({
              status: params.status,
              verifiedAt: new Date(),
              verifiedByAdminId: params.adminId,
              verificationNotes: params.verificationNotes || null,
            })
            .where(eq(licenseVerificationDocuments.id, params.documentId));
        }
      } catch {
        this.isDbConnected = false;
      }
    }

    // Check mandatory documents satisfaction for license
    const memLic = this.memoryLicenses.get(licId);
    let newLicenseStatus: LicenseStatus = memLic?.status || "PENDING_UPLOAD";

    if (memLic) {
      const required = DeskGatewayService.MANDATORY_DOCS_BY_DESK[memLic.deskType] || [];
      const approvedDocs = Array.from(this.memoryDocs.values()).filter(
        (d) => d.licenseId === licId && d.status === "APPROVED",
      );
      const approvedTypes = new Set(approvedDocs.map((d) => d.documentType));
      const allSatisfied = required.length > 0 && required.every((r) => approvedTypes.has(r));

      if (allSatisfied) {
        newLicenseStatus = "VERIFIED_ACTIVE";
      } else if (params.status === "REJECTED") {
        newLicenseStatus = "PENDING_UPLOAD";
      } else {
        newLicenseStatus = "UNDER_REVIEW";
      }

      memLic.status = newLicenseStatus;
      memLic.updatedAt = new Date();

      if (this.isDbConnected) {
        try {
          await db
            .update(statutoryLicenses)
            .set({ status: newLicenseStatus, updatedAt: new Date() })
            .where(eq(statutoryLicenses.id, licId));
        } catch {
          this.isDbConnected = false;
        }
      }
    }

    const tier = await this.recalculateCapabilityTier(params.adminId);
    return { capabilityTier: tier, licenseStatus: newLicenseStatus };
  }

  /**
   * Recalculates capability tier across all active licenses and updates the master config.
   */
  async recalculateCapabilityTier(adminId: string): Promise<CapabilityTier> {
    const statusMap = new Map<DeskType, LicenseStatus>();
    for (const l of this.memoryLicenses.values()) {
      statusMap.set(l.deskType, l.status);
    }

    const isMfActive =
      statusMap.get("MFD_AMFI") === "VERIFIED_ACTIVE" ||
      statusMap.get("IRIS_KFINTECH") === "VERIFIED_ACTIVE";
    const isUpstoxActive = statusMap.get("UPSTOX_BROKER") === "VERIFIED_ACTIVE";
    const isAlpacaActive = statusMap.get("ALPACA_GLOBAL") === "VERIFIED_ACTIVE";
    const isRiaActive = statusMap.get("SEBI_RIA_ADVISORY") === "VERIFIED_ACTIVE";
    const isBondActive =
      statusMap.get("BONDS_NCDS_DESK") === "VERIFIED_ACTIVE" ||
      statusMap.get("UPSTOX_BROKER") === "VERIFIED_ACTIVE";
    const isFdActive = statusMap.get("CORPORATE_FD_DESK") === "VERIFIED_ACTIVE" || isMfActive;
    const isLamfActive = statusMap.get("LAMF_CREDIT_DESK") === "VERIFIED_ACTIVE" || isMfActive;
    const isSdiActive = statusMap.get("SDI_ALTERNATIVE_DEBT_DESK") === "VERIFIED_ACTIVE" || isBondActive;

    let capabilityTier: CapabilityTier = "SANDBOX_TEST";

    if (isRiaActive) {
      capabilityTier = "ADVISORY_UPGRADED";
    } else if (isMfActive && isUpstoxActive && isAlpacaActive) {
      capabilityTier = "FULL_DISTRIBUTION";
    } else if (isMfActive || isUpstoxActive || isAlpacaActive || isBondActive || isFdActive || isLamfActive) {
      capabilityTier = "PARTIAL_DISTRIBUTION";
    } else {
      capabilityTier = "SANDBOX_TEST";
    }

    this.memoryConfig.capabilityTier = capabilityTier;
    this.memoryConfig.isMfDistributionActive = isMfActive;
    this.memoryConfig.isCorporateFdActive = isFdActive;
    this.memoryConfig.isBondDistributionActive = isBondActive;
    this.memoryConfig.isLamfActive = isLamfActive;
    this.memoryConfig.isSdiActive = isSdiActive;
    this.memoryConfig.isUpstoxEquityActive = isUpstoxActive;
    this.memoryConfig.isAlpacaUsEquityActive = isAlpacaActive;
    this.memoryConfig.isAiAdvisoryActive = isRiaActive;
    this.memoryConfig.updatedBy = adminId;
    this.memoryConfig.updatedAt = new Date();

    if (this.isDbConnected) {
      try {
        await db
          .update(deskOperationalConfigs)
          .set({
            capabilityTier,
            isMfDistributionActive: isMfActive,
            isCorporateFdActive: isFdActive,
            isBondDistributionActive: isBondActive,
            isLamfActive,
            isSdiActive,
            isUpstoxEquityActive: isUpstoxActive,
            isAlpacaUsEquityActive: isAlpacaActive,
            isAiAdvisoryActive: isRiaActive,
            updatedBy: adminId,
            updatedAt: new Date(),
          })
          .where(eq(deskOperationalConfigs.id, DeskGatewayService.MASTER_CONFIG_ID));
      } catch {
        this.isDbConnected = false;
      }
    }

    return capabilityTier;
  }

  /**
   * Core routing decision engine: Resolves whether an execution runs LIVE or in SANDBOX_MOCK.
   */
  async resolveExecutionMode(deskType: DeskType): Promise<ExecutionModeResolution> {
    await this.ensureBootstrapped();

    const licenseId = `LIC_${deskType}`;
    const license = this.memoryLicenses.get(licenseId);
    const nowIso = new Date().toISOString();
    const opMode: OperatingMode = this.memoryConfig.operatingMode;
    const capTier: CapabilityTier = this.memoryConfig.capabilityTier;
    const licStatus: LicenseStatus = license?.status || "PENDING_UPLOAD";
    const isSandboxed = license ? license.isSandboxed : true;

    // 1. If global operating mode is TEST_SANDBOX -> Safe simulation
    if (opMode === "TEST_SANDBOX") {
      return {
        mode: "SANDBOX_MOCK",
        isSimulated: true,
        reason: "FintekPro is operating in global TEST_SANDBOX mode. All partner APIs run in mock simulation.",
        capabilityTier: capTier,
        operatingMode: opMode,
        deskStatus: licStatus,
        licenseNumber: license?.licenseNumber,
        deskType,
        resolvedAt: nowIso,
      };
    }

    // 2. If desk is not verified active -> Fall back to simulation
    if (licStatus !== "VERIFIED_ACTIVE") {
      return {
        mode: "SANDBOX_MOCK",
        isSimulated: true,
        reason: `Desk ${deskType} license is ${licStatus} (not VERIFIED_ACTIVE). Diverted to sandbox simulation.`,
        capabilityTier: capTier,
        operatingMode: opMode,
        deskStatus: licStatus,
        licenseNumber: license?.licenseNumber,
        deskType,
        resolvedAt: nowIso,
      };
    }

    // 3. If desk is explicitly sandboxed by admin toggle -> Simulation
    if (isSandboxed) {
      return {
        mode: "SANDBOX_MOCK",
        isSimulated: true,
        reason: `Desk ${deskType} is explicitly set to Sandboxed mode by Admin.`,
        capabilityTier: capTier,
        operatingMode: opMode,
        deskStatus: licStatus,
        licenseNumber: license?.licenseNumber,
        deskType,
        resolvedAt: nowIso,
      };
    }

    // 4. Fully compliant for live production routing
    return {
      mode: "LIVE",
      isSimulated: false,
      reason: `Desk ${deskType} is verified active and unlocked for Production Live execution.`,
      capabilityTier: capTier,
      operatingMode: opMode,
      deskStatus: licStatus,
      licenseNumber: license?.licenseNumber,
      deskType,
      resolvedAt: nowIso,
    };
  }

  /**
   * Executes a simulated transaction under test conditions for admin testing and verification.
   */
  async executeSimulatedOrder(params: SimulatedOrderParams): Promise<{
    success: boolean;
    simulatedOrderId: string;
    deskType: DeskType;
    details: string;
    executionSnapshot: Record<string, any>;
    timestamp: string;
  }> {
    const resolution = await this.resolveExecutionMode(params.deskType);
    const mockId = `SIM_${params.deskType}_${nanoid(10).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    let mockResponse: Record<string, any> = {
      status: "COMPLETE",
      simulatedFillPrice: params.amount > 0 ? (params.amount * 0.999).toFixed(2) : "100.00",
      settlementDate: "T+1 Business Day (Simulated)",
    };

    if (params.deskType === "CORPORATE_FD_DESK") {
      mockResponse = {
        status: "FDR_ISSUED",
        fdrNumber: `FDR-${Math.floor(100000000 + Math.random() * 900000000)}`,
        issuer: "Bajaj Finance Limited (CRISIL AAA)",
        tenureMonths: 36,
        effectiveRate: "8.10% p.a.",
        maturityValue: Math.round(params.amount * 1.263),
        interestPayout: "CUMULATIVE",
      };
    } else if (params.deskType === "LAMF_CREDIT_DESK") {
      mockResponse = {
        status: "PLEDGE_APPROVED",
        pledgeId: `PLG_${Date.now()}`,
        approvedCreditLimit: Math.round(params.amount * 0.50),
        sanctionedInterestRate: "10.25% p.a.",
        disbursalType: "INSTANT_BANK_OVERDRAFT",
      };
    } else if (params.deskType === "SDI_ALTERNATIVE_DEBT_DESK") {
      mockResponse = {
        status: "SDI_UNITS_ALLOCATED",
        sdiTrust: "Grip EV Lease Securitization Trust Series II",
        isin: "INE00SDI0101",
        xirrYield: "11.75% p.a.",
        payoutFrequency: "MONTHLY_AMORTIZING",
      };
    }

    return {
      success: true,
      simulatedOrderId: mockId,
      deskType: params.deskType,
      details: `Simulated order executed successfully under ${resolution.mode} conditions. Zero real money/market exposure.`,
      executionSnapshot: {
        symbolOrScheme: params.symbolOrScheme,
        amount: params.amount,
        action: params.action,
        operatingMode: resolution.operatingMode,
        capabilityTier: resolution.capabilityTier,
        deskStatus: resolution.deskStatus,
        mockExchangeResponse: mockResponse,
      },
      timestamp,
    };
  }
}

export const deskGatewayService = DeskGatewayService.getInstance();
