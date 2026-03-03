import { db } from "../db";
import { partners, partnerHierarchyAgreements, partnerClientOwnership, users } from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";

export class PartnerHierarchyService {
  private static instance: PartnerHierarchyService;

  static getInstance(): PartnerHierarchyService {
    if (!this.instance) {
      this.instance = new PartnerHierarchyService();
    }
    return this.instance;
  }

  // TICKET 2: Create partner with delegation rules
  async createPartner(data: {
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    password: string;
    partnerType?: string;
    parentPartnerId?: string;
    creatorId: string;
    creatorLevel?: string;
  }): Promise<{ success: boolean; partner?: any; error?: string }> {
    // 1. If parentPartnerId is provided, validate the parent
    if (data.parentPartnerId) {
      const parent = await db.select().from(partners).where(eq(partners.id, data.parentPartnerId)).limit(1);
      if (parent.length === 0) return { success: false, error: "Parent partner not found" };
      const parentPartner = parent[0];
      
      // Parent must be ACTIVE
      if (parentPartner.hierarchyStatus !== 'ACTIVE') return { success: false, error: "Parent partner is not active" };
      // Parent KYC must be VERIFIED
      if (parentPartner.kycStatus !== 'VERIFIED') return { success: false, error: "Parent partner KYC not verified" };
      
      // Delegation rules: L1→L2, L2→L3, L3→cannot create
      const parentLevel = parentPartner.partnerLevel || 'L1';
      if (parentLevel === 'L3') return { success: false, error: "L3 partners cannot create sub-partners" };
      
      // Determine child level and type
      const childLevel = parentLevel === 'L1' ? 'L2' : 'L3';
      const childType = parentLevel === 'L1' ? 'SUB' : 'AGENT';
      
      // Check max depth
      const depth = await this.getPartnerDepth(data.parentPartnerId);
      const maxDepth = parentPartner.maxDepth || 3;
      if (depth >= maxDepth) return { success: false, error: `Maximum hierarchy depth (${maxDepth}) reached` };

      // Check email uniqueness
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
        isActive: true,
        isVerified: false,
      }).returning();

      return { success: true, partner: newPartner };
    }

    // Root partner creation (no parent) - typically admin-only
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

  // Get all partners for admin listing
  async getAllPartners(limit = 100, offset = 0): Promise<any[]> {
    return db.select({
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
      .orderBy(desc(partners.createdAt))
      .limit(limit)
      .offset(offset);
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
