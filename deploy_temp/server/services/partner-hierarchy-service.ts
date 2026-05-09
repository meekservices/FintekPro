import { db } from "../db";
import { partners, partnerHierarchyAgreements, partnerClientOwnership, users } from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { runFullIntegrityCheck } from "./hierarchy-integrity-validator";

// GAP 5 FIX: 7-level delegation chain (was hardcoded to 3, then extended to 5, now 7)
const LEVEL_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;
const MAX_HIERARCHY_LEVEL = 'L7'; // Field Associate — cannot create sub-partners

function getChildLevel(parentLevel: string): string | null {
  const idx = LEVEL_ORDER.indexOf(parentLevel as any);
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

const LEVEL_TYPE_MAP: Record<string, string> = {
  L1: 'MASTER',
  L2: 'SUB',
  L3: 'AGENT',
  L4: 'FIELD_EXECUTIVE',
  L5: 'BUSINESS_ASSOCIATE',
  L6: 'DISTRICT_ASSOCIATE',
  L7: 'FIELD_ASSOCIATE',
};

export class PartnerHierarchyService {
  private static instance: PartnerHierarchyService;

  static getInstance(): PartnerHierarchyService {
    if (!this.instance) {
      this.instance = new PartnerHierarchyService();
    }
    return this.instance;
  }

  // GAP 5+7+3 FIX: Create partner with 7-level delegation, referredById attribution, auto integrity check
  async createPartner(data: {
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    password: string;
    partnerType?: string;
    parentPartnerId?: string;
    referredById?: string;   // GAP 7: peer referral attribution (horizontal, not hierarchical)
    creatorId: string;
    creatorLevel?: string;
  }): Promise<{ success: boolean; partner?: any; integrityWarnings?: number; error?: string }> {
    if (data.parentPartnerId) {
      const parent = await db.select().from(partners).where(eq(partners.id, data.parentPartnerId)).limit(1);
      if (parent.length === 0) return { success: false, error: "Parent partner not found" };
      const parentPartner = parent[0];

      if (parentPartner.hierarchyStatus !== 'ACTIVE') return { success: false, error: "Parent partner is not active" };
      if (parentPartner.kycStatus !== 'VERIFIED') return { success: false, error: "Parent partner KYC not verified" };

      // GAP 5 FIX: Dynamic 7-level delegation (was hardcoded L1→L2→L3 only)
      const parentLevel = parentPartner.partnerLevel || 'L1';
      const childLevel = getChildLevel(parentLevel);
      if (!childLevel) {
        return { success: false, error: `${parentLevel} partners cannot create sub-partners (maximum hierarchy depth reached)` };
      }
      const childType = LEVEL_TYPE_MAP[childLevel] || 'AGENT';

      // GAP 5 FIX: Depth check uses dynamic maxDepth (default 7, not 3)
      const depth = await this.getPartnerDepth(data.parentPartnerId);
      const maxDepth = parentPartner.maxDepth || 7;
      if (depth >= maxDepth) return { success: false, error: `Maximum hierarchy depth (${maxDepth}) reached` };

      const existing = await db.select().from(partners).where(eq(partners.contactEmail, data.contactEmail)).limit(1);
      if (existing.length > 0) return { success: false, error: "Email already registered" };

      const [newPartner] = await db.insert(partners).values({
        companyName: data.companyName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || null,
        password: data.password,
        partnerType: data.partnerType || 'distributor',
        parentPartnerId: data.parentPartnerId,
        partnerLevel: childLevel,
        hierarchyPartnerType: childType,
        hierarchyStatus: 'ACTIVE',
        kycStatus: 'PENDING',
        approvalStatus: 'PENDING',
        createdBy: data.creatorId,
        referredById: data.referredById || null, // GAP 7: peer referral attribution
        isActive: true,
        isVerified: false,
      }).returning();

      // GAP 3 FIX: Auto integrity check on every partner creation
      const integrityResult = await runFullIntegrityCheck().catch(() => null);
      const integrityWarnings = integrityResult?.summary?.total || 0;
      if (integrityWarnings > 0) {
        console.warn(`[HierarchyIntegrity] ${integrityWarnings} issue(s) detected after creating partner ${newPartner.id}:`, integrityResult?.issues);
      }

      return { success: true, partner: newPartner, integrityWarnings };
    }

    // Root partner creation (no parent) — admin-only
    const existing = await db.select().from(partners).where(eq(partners.contactEmail, data.contactEmail)).limit(1);
    if (existing.length > 0) return { success: false, error: "Email already registered" };

    const [newPartner] = await db.insert(partners).values({
      companyName: data.companyName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
      password: data.password,
      partnerType: data.partnerType || 'distributor',
      parentPartnerId: null,
      partnerLevel: 'L1',
      hierarchyPartnerType: 'MASTER',
      hierarchyStatus: 'ACTIVE',
      kycStatus: 'PENDING',
      approvalStatus: 'PENDING',
      createdBy: data.creatorId,
      referredById: data.referredById || null,
      isActive: true,
      isVerified: false,
    }).returning();

    return { success: true, partner: newPartner };
  }

  // TICKET 3: Approve a partner
  async approvePartner(partnerId: string, approvedBy: string): Promise<{ success: boolean; error?: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!partner) return { success: false, error: "Partner not found" };
    if (partner.approvalStatus === 'APPROVED') return { success: false, error: "Partner already approved" };

    // Create agreement
    const [agreement] = await db.insert(partnerHierarchyAgreements).values({
      partnerId,
      agreementType: partner.hierarchyPartnerType || 'PARTNER',
      agreementStatus: 'ACTIVE',
      effectiveFrom: new Date(),
      approvedBy,
      approvedAt: new Date(),
    }).returning();

    // Update partner
    await db.update(partners).set({
      approvalStatus: 'APPROVED',
      agreementId: agreement.id,
      updatedAt: new Date(),
    }).where(eq(partners.id, partnerId));

    return { success: true };
  }

  // Reject a partner
  async rejectPartner(partnerId: string, rejectedBy: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!partner) return { success: false, error: "Partner not found" };

    await db.update(partners).set({
      approvalStatus: 'REJECTED',
      hierarchyStatus: 'SUSPENDED',
      updatedAt: new Date(),
    }).where(eq(partners.id, partnerId));

    return { success: true };
  }

  // Update KYC status
  async updateKycStatus(partnerId: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED'): Promise<{ success: boolean; error?: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!partner) return { success: false, error: "Partner not found" };

    await db.update(partners).set({
      kycStatus: status,
      updatedAt: new Date(),
    }).where(eq(partners.id, partnerId));

    return { success: true };
  }

  // TICKET 7: Get downline (recursive children) with PII masking
  async getDownline(partnerId: string, maskPII: boolean = true): Promise<any[]> {
    // Use recursive CTE to get all children
    const result = await db.execute(sql`
      WITH RECURSIVE partner_tree AS (
        SELECT id, company_name, contact_email, contact_phone, partner_level, 
               hierarchy_partner_type, hierarchy_status, kyc_status, approval_status,
               parent_partner_id, created_at, 1 as depth
        FROM partners 
        WHERE parent_partner_id = ${partnerId}
        
        UNION ALL
        
        SELECT p.id, p.company_name, p.contact_email, p.contact_phone, p.partner_level,
               p.hierarchy_partner_type, p.hierarchy_status, p.kyc_status, p.approval_status,
               p.parent_partner_id, p.created_at, pt.depth + 1
        FROM partners p
        INNER JOIN partner_tree pt ON p.parent_partner_id = pt.id
        WHERE pt.depth < 10
      )
      SELECT * FROM partner_tree ORDER BY depth, created_at
    `);

    const rows = (result as any).rows || result;
    if (!rows) return [];

    return rows.map((row: any) => {
      const partner: any = {
        id: row.id,
        companyName: row.company_name,
        partnerLevel: row.partner_level,
        hierarchyPartnerType: row.hierarchy_partner_type,
        hierarchyStatus: row.hierarchy_status,
        kycStatus: row.kyc_status,
        approvalStatus: row.approval_status,
        parentPartnerId: row.parent_partner_id,
        depth: row.depth,
        createdAt: row.created_at,
      };

      if (!maskPII) {
        partner.contactEmail = row.contact_email;
        partner.contactPhone = row.contact_phone;
      } else {
        // Mask email: show first 2 chars + *** + domain
        const email = row.contact_email || '';
        const [localPart, domain] = email.split('@');
        partner.contactEmail = localPart ? `${localPart.substring(0, 2)}***@${domain || ''}` : '***';
        partner.contactPhone = row.contact_phone ? `${row.contact_phone.substring(0, 4)}****` : null;
      }

      return partner;
    });
  }

  // Get partner hierarchy depth
  async getPartnerDepth(partnerId: string): Promise<number> {
    const result = await db.execute(sql`
      WITH RECURSIVE ancestry AS (
        SELECT id, parent_partner_id, 1 as depth
        FROM partners WHERE id = ${partnerId}
        UNION ALL
        SELECT p.id, p.parent_partner_id, a.depth + 1
        FROM partners p
        INNER JOIN ancestry a ON p.id = a.parent_partner_id
        WHERE a.depth < 10
      )
      SELECT MAX(depth) as max_depth FROM ancestry
    `);
    const rows = (result as any).rows || result;
    return rows?.[0]?.max_depth || 1;
  }

  // Get partner by ID
  async getPartnerById(partnerId: string) {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    return partner || null;
  }

  // TICKET 4: Client Ownership - assign client to lowest-level partner
  async assignClientOwnership(clientId: string, ownerPartnerId: string): Promise<{ success: boolean; error?: string }> {
    // Check if ownership already exists
    const existing = await db.select().from(partnerClientOwnership)
      .where(eq(partnerClientOwnership.clientId, clientId)).limit(1);
    
    if (existing.length > 0) {
      if (existing[0].isLocked) {
        return { success: false, error: "Client ownership is locked and cannot be changed" };
      }
      // Update if not locked
      await db.update(partnerClientOwnership).set({
        ownerPartnerId,
        updatedAt: new Date(),
      }).where(eq(partnerClientOwnership.clientId, clientId));
      return { success: true };
    }

    await db.insert(partnerClientOwnership).values({
      clientId,
      ownerPartnerId,
    });
    return { success: true };
  }

  // Lock client ownership after first transaction (immutable)
  async lockClientOwnership(clientId: string): Promise<{ success: boolean; error?: string }> {
    const existing = await db.select().from(partnerClientOwnership)
      .where(eq(partnerClientOwnership.clientId, clientId)).limit(1);
    
    if (existing.length === 0) return { success: false, error: "No ownership record found" };

    await db.update(partnerClientOwnership).set({
      isLocked: true,
      firstTransactionAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(partnerClientOwnership.clientId, clientId));
    return { success: true };
  }

  // Admin override of client ownership (requires reason + audit)
  async overrideClientOwnership(clientId: string, newOwnerId: string, overrideBy: string, reason: string): Promise<{ success: boolean; error?: string }> {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Override reason is required" };
    }

    const existing = await db.select().from(partnerClientOwnership)
      .where(eq(partnerClientOwnership.clientId, clientId)).limit(1);
    
    if (existing.length === 0) return { success: false, error: "No ownership record found" };

    await db.update(partnerClientOwnership).set({
      ownerPartnerId: newOwnerId,
      overrideBy,
      overrideReason: reason,
      overrideAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(partnerClientOwnership.clientId, clientId));

    return { success: true };
  }

  // Get client ownership info
  async getClientOwnership(clientId: string) {
    const [ownership] = await db.select().from(partnerClientOwnership)
      .where(eq(partnerClientOwnership.clientId, clientId)).limit(1);
    return ownership || null;
  }

  // Get all partners pending approval
  async getPendingApprovals(): Promise<any[]> {
    return db.select().from(partners)
      .where(eq(partners.approvalStatus, 'PENDING'));
  }

  // Get all partners for admin listing — includes hierarchy-registered partners
  // AND users with partner/agent roles who haven't been added to the hierarchy yet
  async getAllPartners(limit = 100, offset = 0): Promise<any[]> {
    // 1. Registered hierarchy partners
    const hierarchyPartners = await db.select({
      id: partners.id,
      companyName: partners.companyName,
      contactEmail: partners.contactEmail,
      contactPhone: partners.contactPhone,
      partnerType: partners.partnerType,
      partnerLevel: partners.partnerLevel,
      hierarchyPartnerType: partners.hierarchyPartnerType,
      hierarchyStatus: partners.hierarchyStatus,
      approvalStatus: partners.approvalStatus,
      kycStatus: partners.kycStatus,
      isActive: partners.isActive,
      commissionRate: partners.commissionRate,
      parentPartnerId: partners.parentPartnerId,
      arnCode: partners.arnCode,
      createdAt: partners.createdAt,
    }).from(partners)
      .orderBy(desc(partners.createdAt));

    // Build set of emails already in hierarchy so we don't duplicate
    const registeredEmails = new Set(hierarchyPartners.map(p => p.contactEmail?.toLowerCase()));

    // 2. Users with partner/agent roles not yet in hierarchy
    const partnerUsers = await db.execute(sql`
      SELECT
        id,
        COALESCE(first_name || ' ' || COALESCE(last_name, ''), email) AS company_name,
        email,
        NULL::varchar AS contact_phone,
        CASE
          WHEN 'agent' = ANY(roles) AND 'partner' = ANY(roles) THEN 'distributor'
          WHEN 'agent' = ANY(roles) THEN 'agent'
          ELSE 'distributor'
        END AS partner_type,
        'L1' AS partner_level,
        'AGENT' AS hierarchy_partner_type,
        'ACTIVE' AS hierarchy_status,
        'PENDING' AS approval_status,
        'PENDING' AS kyc_status,
        true AS is_active,
        '0.00' AS commission_rate,
        NULL::varchar AS parent_partner_id,
        NULL::varchar AS arn_code,
        created_at,
        roles
      FROM users
      WHERE (
        'partner' = ANY(roles)
        OR 'agent' = ANY(roles)
      )
    `);

    const userRows = (partnerUsers.rows as any[])
      .filter(u => !registeredEmails.has((u.email as string)?.toLowerCase()))
      .map(u => ({
        id: u.id as string,
        companyName: u.company_name as string,
        contactEmail: u.email as string,
        contactPhone: u.contact_phone as string | null,
        partnerType: u.partner_type as string,
        partnerLevel: u.partner_level as string,
        hierarchyPartnerType: u.hierarchy_partner_type as string,
        hierarchyStatus: u.hierarchy_status as string,
        approvalStatus: u.approval_status as string,
        kycStatus: u.kyc_status as string,
        isActive: u.is_active as boolean,
        commissionRate: u.commission_rate as string,
        parentPartnerId: u.parent_partner_id as string | null,
        arnCode: u.arn_code as string | null,
        createdAt: u.created_at as Date,
        sourceType: 'user_account' as const,
        roles: u.roles as string[],
      }));

    // Merge: hierarchy partners first (they have full data), then user-sourced partners
    const merged = [
      ...hierarchyPartners.map(p => ({ ...p, sourceType: 'hierarchy' as const })),
      ...userRows,
    ];

    // Sort by createdAt desc and apply pagination
    merged.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return merged.slice(offset, offset + limit);
  }

  // Suspend a partner
  async suspendPartner(partnerId: string): Promise<{ success: boolean; error?: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!partner) return { success: false, error: "Partner not found" };

    await db.update(partners).set({
      hierarchyStatus: 'SUSPENDED',
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(partners.id, partnerId));

    return { success: true };
  }

  // Terminate a partner
  async terminatePartner(partnerId: string): Promise<{ success: boolean; error?: string }> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (!partner) return { success: false, error: "Partner not found" };

    await db.update(partners).set({
      hierarchyStatus: 'TERMINATED',
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(partners.id, partnerId));

    return { success: true };
  }

  // Get partner tree (full hierarchy from root)
  async getPartnerTree(partnerId: string): Promise<any[]> {
    // Get ancestors
    const result = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, company_name, partner_level, hierarchy_partner_type, 
               parent_partner_id, hierarchy_status, 0 as depth
        FROM partners WHERE id = ${partnerId}
        UNION ALL
        SELECT p.id, p.company_name, p.partner_level, p.hierarchy_partner_type,
               p.parent_partner_id, p.hierarchy_status, a.depth - 1
        FROM partners p
        INNER JOIN ancestors a ON a.parent_partner_id = p.id
        WHERE a.depth > -10
      )
      SELECT * FROM ancestors ORDER BY depth
    `);
    const rows = (result as any).rows || result;
    return rows || [];
  }
}

export const partnerHierarchyService = PartnerHierarchyService.getInstance();
