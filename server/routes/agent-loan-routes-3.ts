import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import ExcelJS from "exceljs";
import { leadRegistryService } from "../services/lead-registry-service";
import {
  dsaLoanApplications,
  dsaLoanDocuments,
  loanRoutingHistory,
  bankConnectors,
  agentLoanActions,
  agentPayoutClaims,
  agentLoanStatusHistory,
  dsaCommissionTracking,
  bankInteractionEvents,
  bankerContacts,
} from "@shared/dsa-loan-schema";
import * as schema from "@shared/schema";
import { users, agentClientMappingRequests } from "@shared/schema";
import {
  OriginationMode,
  RoutingIntent,
  WorkflowOwner,
  AGENT_ASSISTED_DEFAULTS,
  CURRENT_COMMISSION_POLICY_VERSION,
} from "@shared/loan-origination.constants";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const AGENT_ROLES = ["agent", "sub_agent", "master_agent", "associate", "tester"];

async function requireAgentRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  
  const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
  const hasAgentRole = userRoles.some((r: string) => AGENT_ROLES.includes(r));
  if (!hasAgentRole) {
    return res.status(403).json({ 
      success: false, 
      error: "Access denied. Agent role required.",
      requiredRoles: AGENT_ROLES,
    });
  }
  
  next();
}

async function validateAgentClientMapping(agentId: string, clientId: string): Promise<boolean> {
  const [client] = await db
    .select({ assignedAgentId: users.assignedAgentId })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  if (client?.assignedAgentId === agentId) {
    return true;
  }
  
  const [mapping] = await db
    .select()
    .from(agentClientMappingRequests)
    .where(
      and(
        eq(agentClientMappingRequests.agentId, agentId),
        eq(agentClientMappingRequests.clientId, clientId),
        eq(agentClientMappingRequests.status, "approved")
      )
    )
    .limit(1);
  
  return !!mapping;
}

router.use(requireAgentRole);

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["eligibility_check", "withdrawn"],
  eligibility_check: ["routed", "rejected", "withdrawn"],
  routed: ["pending_with_banks", "rejected", "withdrawn"],
  pending_with_banks: ["in_review", "rejected", "withdrawn"],
  in_review: ["approved", "rejected", "withdrawn"],
  approved: ["disbursed", "withdrawn"],
  disbursed: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

function generateClaimNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `CLM${year}${month}${nanoid(6).toUpperCase()}`;
}

function generateApplicationNumber(): string {
  const prefix = "AGT";
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = nanoid(6).toUpperCase();
  return `${prefix}${year}${month}${random}`;
}

async function logAgentAction(params: {
  applicationId: string;
  agentId: string;
  actionType: string;
  actionDescription?: string;
  previousValue?: any;
  newValue?: any;
  affectedFields?: string[];
  bankCode?: string;
  documentId?: string;
  remarks?: string;
  req?: Request;
}) {
  const agent = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, params.agentId))
    .limit(1);

  await db.insert(agentLoanActions).values({
    applicationId: params.applicationId,
    agentId: params.agentId,
    agentName: agent[0] ? `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim() : undefined,
    agentEmail: agent[0]?.email,
    actionType: params.actionType,
    actionDescription: params.actionDescription,
    previousValue: params.previousValue,
    newValue: params.newValue,
    affectedFields: params.affectedFields || [],
    bankCode: params.bankCode,
    documentId: params.documentId,
    remarks: params.remarks,
    ipAddress: params.req?.ip,
    userAgent: params.req?.headers["user-agent"],
    sessionId: (params.req as any)?.session?.id,
  });
}

const createAgentApplicationSchema = z.object({
  clientMode: z.enum(["new", "existing"]),
  clientId: z.string().optional(),
  applicantType: z.enum(["individual", "business"]).default("individual"),
  applicantName: z.string().min(1),
  applicantPhone: z.string().regex(/^[6-9]\d{9}$/),
  applicantEmail: z.string().email().optional(),
  applicantPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  applicantAadhaar: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  employmentType: z.enum(["salaried", "self_employed", "business", "professional"]),
  companyName: z.string().optional(),
  designation: z.string().optional(),
  workExperience: z.number().int().optional(),
  monthlyIncome: z.number().positive(),
  annualIncome: z.number().positive().optional(),
  otherIncome: z.number().optional(),
  loanType: z.enum(["personal", "home", "car", "business", "education", "gold", "lap", "las"]),
  requestedAmount: z.number().positive(),
  requestedTenure: z.number().int().min(6).max(360),
  loanPurpose: z.string().optional(),
  existingLoans: z.number().int().optional(),
  existingEmiAmount: z.number().optional(),
  creditScore: z.number().int().min(300).max(900).optional(),
  processingMode: z.enum(["PLATFORM", "EXTERNAL_FINANCIER"]).default("PLATFORM"),
  financierName: z.string().optional(),
  bankerName: z.string().optional(),
  bankerMobile: z.string().optional(),
  bankerEmail: z.string().email().optional(),
  routingMode: z.enum(["auto", "manual"]).default("auto"),
  targetBanks: z.array(z.string()).optional(),
  dsaCode: z.string().optional(),
  subDsaCode: z.string().optional(),
});

router.get("/my-applications", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.agentId, agentId))
      .orderBy(desc(dsaLoanApplications.createdAt));

    res.json({ success: true, data: applications });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/banker-contacts", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const search = ((req.query.search as string) || "").trim();

    if (search && search.length < 3) {
      return res.json({ success: true, data: [], message: "Type at least 3 characters to search" });
    }

    const conditions = [
      eq(bankerContacts.isActive, true),
      or(eq(bankerContacts.agentId, agentId), eq(bankerContacts.agentId, "system")),
    ];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(bankerContacts.financierName, searchPattern),
          ilike(bankerContacts.bankerName, searchPattern),
          ilike(bankerContacts.dsaCode, searchPattern),
          sql`EXISTS (SELECT 1 FROM unnest(${bankerContacts.productNames}) AS p WHERE p ILIKE ${searchPattern})`
        )!
      );
    }

    const contacts = await db
      .select()
      .from(bankerContacts)
      .where(and(...conditions))
      .orderBy(desc(bankerContacts.lastUsedAt))
      .limit(50);

    res.json({ success: true, data: contacts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/banker-contacts", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const schema = z.object({
      financierName: z.string().min(1),
      dsaCode: z.string().optional(),
      productNames: z.array(z.string()).optional(),
      bankerName: z.string().min(1),
      bankerMobile: z.string().optional(),
      bankerEmail: z.string().email().optional().or(z.literal("")),
      branch: z.string().optional(),
      rmName: z.string().optional(),
      rmEmail: z.string().email().optional().or(z.literal("")),
      rmMobile: z.string().optional(),
      designation: z.string().optional(),
      supportedLoanTypes: z.array(z.string()).optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const [contact] = await db.insert(bankerContacts).values({
      agentId,
      ...parsed,
      bankerEmail: parsed.bankerEmail || undefined,
      rmEmail: parsed.rmEmail || undefined,
      source: "manual",
    }).onConflictDoUpdate({
      target: [bankerContacts.agentId, bankerContacts.financierName, bankerContacts.bankerMobile],
      set: {
        bankerName: parsed.bankerName,
        dsaCode: parsed.dsaCode,
        productNames: parsed.productNames || [],
        bankerEmail: parsed.bankerEmail || undefined,
        branch: parsed.branch,
        rmName: parsed.rmName,
        rmEmail: parsed.rmEmail || undefined,
        rmMobile: parsed.rmMobile,
        designation: parsed.designation,
        notes: parsed.notes,
        updatedAt: new Date(),
      },
    }).returning();

    res.status(201).json({ success: true, data: contact });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.put("/banker-contacts/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const schema = z.object({
      financierName: z.string().min(1).optional(),
      dsaCode: z.string().optional(),
      productNames: z.array(z.string()).optional(),
      bankerName: z.string().min(1).optional(),
      bankerMobile: z.string().optional(),
      bankerEmail: z.string().email().optional().or(z.literal("")),
      branch: z.string().optional(),
      rmName: z.string().optional(),
      rmEmail: z.string().email().optional().or(z.literal("")),
      rmMobile: z.string().optional(),
      designation: z.string().optional(),
      supportedLoanTypes: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const [updated] = await db
      .update(bankerContacts)
      .set({ ...parsed, bankerEmail: parsed.bankerEmail || undefined, rmEmail: parsed.rmEmail || undefined, updatedAt: new Date() })
      .where(and(eq(bankerContacts.id, req.params.id), or(eq(bankerContacts.agentId, agentId), eq(bankerContacts.agentId, "system"))))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: "Contact not found" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/banker-contacts/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const [updated] = await db
      .update(bankerContacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(bankerContacts.id, req.params.id), or(eq(bankerContacts.agentId, agentId), eq(bankerContacts.agentId, "system"))))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: "Contact not found" });
    res.json({ success: true, message: "Contact removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseProductNames(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,&\/]+/)
    .map(p => p.trim().toUpperCase())
    .filter(p => p.length > 0 && !["AND", "LOANS", "LOAN", "AGAINST", "SECURED", "SMALL", "TICKET"].includes(p));
}

router.post("/banker-contacts/import-excel", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const worksheet = workbook.worksheets[0];
    const rows: any[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push((row.values as any[]).slice(1));
    });

    if (rows.length < 2) {
      return res.status(400).json({ success: false, error: "Excel file is empty or has no data rows" });
    }

    const headers = rows[0].map((h: any) => String(h).toLowerCase().trim());
    const dsaCodeIdx = headers.findIndex((h: string) => h.includes("dsa") || h === "code");
    const financierIdx = headers.findIndex((h: string) => h.includes("institution") || h.includes("financier") || h.includes("bank"));
    const productIdx = headers.findIndex((h: string) => h.includes("product"));
    // "SM Name" / "Banker Name" — avoid matching "institutionname" or "financiername"
    const nameIdx = headers.findIndex((h: string) =>
      h === "sm name" || h === "sm_name" || h.includes("banker") ||
      (h === "name") ||
      (h.includes("name") && !h.includes("institution") && !h.includes("financier") && !h.includes("product") && !h.includes("dsa"))
    );
    const phoneIdx = headers.findIndex((h: string) => h.includes("contact") || h.includes("phone") || h.includes("mobile"));

    if (financierIdx === -1) {
      return res.status(400).json({ success: false, error: "Could not find financier/institution column in Excel" });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[financierIdx]) { skipped++; continue; }

      const financierName = String(row[financierIdx]).trim();
      const dsaCode = dsaCodeIdx >= 0 && row[dsaCodeIdx] ? String(row[dsaCodeIdx]).trim() : undefined;
      const productRaw = productIdx >= 0 && row[productIdx] ? String(row[productIdx]).trim() : "";
      const bankerName = nameIdx >= 0 && row[nameIdx] ? String(row[nameIdx]).trim() : "";
      const phone = phoneIdx >= 0 && row[phoneIdx] ? String(row[phoneIdx]).trim().replace(/\D/g, "").slice(-10) : undefined;

      if (!bankerName && !phone) { skipped++; continue; }

      const productNames = parseProductNames(productRaw);

      try {
        await db.insert(bankerContacts).values({
          agentId: "system",
          financierName,
          dsaCode: dsaCode || undefined,
          productNames,
          bankerName: bankerName || "Unknown",
          bankerMobile: phone && phone.length === 10 ? phone : undefined,
          source: "excel_import",
          isActive: true,
        }).onConflictDoUpdate({
          target: [bankerContacts.agentId, bankerContacts.financierName, bankerContacts.bankerMobile],
          set: {
            dsaCode: dsaCode || undefined,
            productNames,
            bankerName: bankerName || "Unknown",
            source: "excel_import",
            updatedAt: new Date(),
          },
        });
        imported++;
      } catch (rowErr: any) {
        errors.push(`Row ${i + 1}: ${rowErr.message?.substring(0, 80)}`);
        skipped++;
      }
    }

    console.log(`✅ [BankerContacts] Excel import: ${imported} imported, ${skipped} skipped`);
    res.json({
      success: true,
      data: { imported, skipped, total: rows.length - 1, errors: errors.slice(0, 10) },
    });
  } catch (error: any) {
    console.error("❌ [BankerContacts] Excel import error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/banker-contacts/sync-zoho", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const direction = (req.body.direction as string) || "push";

    const { ZohoConnectionResolver } = await import("../zoho/connection-resolver");
    const { ZohoApiClient } = await import("../zoho/api-client");
    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection) {
      return res.status(400).json({ success: false, error: "No Zoho CRM connection found for this agent" });
    }

    const apiClient = new ZohoApiClient(connection.connectionId, "CRM", connection.zohoDataCenter);
    let synced = 0;

    if (direction === "push" || direction === "both") {
      const contacts = await db
        .select()
        .from(bankerContacts)
        .where(and(
          or(eq(bankerContacts.agentId, agentId), eq(bankerContacts.agentId, "system")),
          eq(bankerContacts.isActive, true)
        ));

      for (const contact of contacts) {
        try {
          const zohoData: Record<string, any> = {
            Last_Name: contact.bankerName || "Unknown",
            Company: contact.financierName,
            Phone: contact.bankerMobile || "",
            Email: contact.bankerEmail || "",
            Title: contact.designation || "Banker",
            Description: `DSA Code: ${contact.dsaCode || "N/A"} | Products: ${(contact.productNames || []).join(", ")}`,
          };

          if (contact.zohoCrmId) {
            await apiClient.put(`/Contacts/${contact.zohoCrmId}`, { data: [zohoData] });
          } else {
            const resp: any = await apiClient.post("/Contacts", { data: [zohoData] });
            const zohoId = resp?.data?.[0]?.details?.id;
            if (zohoId) {
              await db.update(bankerContacts)
                .set({ zohoCrmId: zohoId, updatedAt: new Date() })
                .where(eq(bankerContacts.id, contact.id));
            }
          }
          synced++;
        } catch (syncErr: any) {
          console.warn(`[Zoho Sync] Failed to sync contact ${contact.bankerName}:`, syncErr.message);
        }
      }
    }

    if (direction === "pull" || direction === "both") {
      try {
        const resp: any = await apiClient.get("/Contacts", {
          params: { fields: "id,Last_Name,Company,Phone,Email,Title,Description", per_page: "200" }
        });
        const zohoContacts = resp?.data || [];
        for (const zc of zohoContacts) {
          if (!zc.Company) continue;
          let dsaCode: string | undefined;
          let productNames: string[] = [];
          const desc = zc.Description || "";
          const dsaMatch = desc.match(/DSA Code:\s*([^\s|]+)/);
          if (dsaMatch && dsaMatch[1] !== "N/A") dsaCode = dsaMatch[1];
          const prodMatch = desc.match(/Products:\s*(.+)/);
          if (prodMatch) productNames = prodMatch[1].split(",").map((p: string) => p.trim()).filter(Boolean);

          try {
            await db.insert(bankerContacts).values({
              agentId,
              financierName: zc.Company,
              dsaCode,
              productNames,
              bankerName: zc.Last_Name || "Unknown",
              bankerMobile: zc.Phone?.replace(/\D/g, "").slice(-10) || undefined,
              bankerEmail: zc.Email || undefined,
              designation: zc.Title || undefined,
              source: "zoho_sync",
              zohoCrmId: zc.id,
            }).onConflictDoUpdate({
              target: [bankerContacts.agentId, bankerContacts.financierName, bankerContacts.bankerMobile],
              set: {
                dsaCode,
                productNames,
                bankerName: zc.Last_Name || "Unknown",
                bankerEmail: zc.Email || undefined,
                zohoCrmId: zc.id,
                source: "zoho_sync",
                updatedAt: new Date(),
              },
            });
            synced++;
          } catch (_) {}
        }
      } catch (pullErr: any) {
        console.warn("[Zoho Sync] Pull failed:", pullErr.message);
      }
    }

    console.log(`✅ [BankerContacts] Zoho CRM sync complete: ${synced} records (direction: ${direction})`);
    res.json({ success: true, data: { synced, direction } });
  } catch (error: any) {
    console.error("❌ [BankerContacts] Zoho sync error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const INDIAN_FINANCIERS = [
  { name: "HDFC Bank", type: "bank" },
  { name: "ICICI Bank", type: "bank" },
  { name: "State Bank of India (SBI)", type: "bank" },
  { name: "Axis Bank", type: "bank" },
  { name: "Kotak Mahindra Bank", type: "bank" },
  { name: "Punjab National Bank (PNB)", type: "bank" },
  { name: "Bank of Baroda", type: "bank" },
  { name: "IndusInd Bank", type: "bank" },
  { name: "Yes Bank", type: "bank" },
  { name: "IDFC First Bank", type: "bank" },
  { name: "Federal Bank", type: "bank" },
  { name: "Union Bank of India", type: "bank" },
  { name: "Canara Bank", type: "bank" },
  { name: "Bank of India", type: "bank" },
  { name: "Indian Bank", type: "bank" },
  { name: "Central Bank of India", type: "bank" },
  { name: "UCO Bank", type: "bank" },
  { name: "IDBI Bank", type: "bank" },
  { name: "Indian Overseas Bank", type: "bank" },
  { name: "South Indian Bank", type: "bank" },
  { name: "Karur Vysya Bank", type: "bank" },
  { name: "City Union Bank", type: "bank" },
  { name: "Bandhan Bank", type: "bank" },
  { name: "RBL Bank", type: "bank" },
  { name: "DCB Bank", type: "bank" },
  { name: "Dhanlaxmi Bank", type: "bank" },
  { name: "Tamilnad Mercantile Bank", type: "bank" },
  { name: "CSB Bank", type: "bank" },
  { name: "Nainital Bank", type: "bank" },
  { name: "Jammu & Kashmir Bank", type: "bank" },
  { name: "Karnataka Bank", type: "bank" },
  { name: "Bajaj Finance", type: "nbfc" },
  { name: "Bajaj Finserv", type: "nbfc" },
  { name: "Tata Capital", type: "nbfc" },
  { name: "Piramal Finance", type: "nbfc" },
  { name: "L&T Finance", type: "nbfc" },
  { name: "Mahindra Finance", type: "nbfc" },
  { name: "Muthoot Finance", type: "nbfc" },
  { name: "Manappuram Finance", type: "nbfc" },
  { name: "Shriram Finance", type: "nbfc" },
  { name: "Cholamandalam Finance", type: "nbfc" },
  { name: "Sundaram Finance", type: "nbfc" },
  { name: "HDB Financial Services", type: "nbfc" },
  { name: "Aditya Birla Finance", type: "nbfc" },
  { name: "Hero FinCorp", type: "nbfc" },
  { name: "IIFL Finance", type: "nbfc" },
  { name: "JM Financial", type: "nbfc" },
  { name: "Fullerton India", type: "nbfc" },
  { name: "InCred Finance", type: "nbfc" },
  { name: "Poonawalla Fincorp", type: "nbfc" },
  { name: "DMI Finance", type: "nbfc" },
  { name: "Northern Arc Capital", type: "nbfc" },
  { name: "Capri Global Capital", type: "nbfc" },
  { name: "UGRO Capital", type: "nbfc" },
  { name: "Lendingkart", type: "nbfc" },
  { name: "Home First Finance", type: "hfc" },
  { name: "Aavas Financiers", type: "hfc" },
  { name: "Aptus Value Housing", type: "hfc" },
  { name: "Can Fin Homes", type: "hfc" },
  { name: "GIC Housing Finance", type: "hfc" },
  { name: "PNB Housing Finance", type: "hfc" },
  { name: "LIC Housing Finance", type: "hfc" },
  { name: "HUDCO", type: "hfc" },
  { name: "Repco Home Finance", type: "hfc" },
];

router.get("/financier-suggestions", async (req: Request, res: Response) => {
  try {
    const query = ((req.query.q as string) || "").toLowerCase().trim();

    let results = INDIAN_FINANCIERS.map(f => ({ ...f, source: "directory" as const }));

    const agentId = (req as any).user?.id;
    if (agentId) {
      const contacts = await db
        .select({ financierName: bankerContacts.financierName, dsaCode: bankerContacts.dsaCode })
        .from(bankerContacts)
        .where(and(
          or(eq(bankerContacts.agentId, agentId), eq(bankerContacts.agentId, "system")),
          eq(bankerContacts.isActive, true)
        ));

      const existingNames = new Set(results.map(r => r.name.toLowerCase()));
      for (const c of contacts) {
        if (c.financierName && !existingNames.has(c.financierName.toLowerCase())) {
          results.push({ name: c.financierName, type: "saved", source: "contact" as const, dsaCode: c.dsaCode || undefined });
          existingNames.add(c.financierName.toLowerCase());
        }
      }
    }

    if (query) {
      results = results.filter(r => r.name.toLowerCase().includes(query));
    }

    res.json({ success: true, data: results.slice(0, 20) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
