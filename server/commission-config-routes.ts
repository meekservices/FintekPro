import { Router, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { 
  commissionPlans, 
  commissionRoleMaps, 
  commissionHierarchySplits, 
  commissionAuditLogs,
  CommissionProductTypes,
  RegulatoryCommissionCaps,
  type CommissionProductType,
  type InsertCommissionPlan,
  type InsertCommissionRoleMap,
  type InsertCommissionHierarchySplit,
  type InsertCommissionAuditLog,
  users
} from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { emailService } from "./email-service";
import { AdminApprovalService } from "./services/admin-approval-service";
import { adminApprovalRequests } from "@shared/schema";

interface CommissionNotification {
  eventType: 'plan_activated' | 'plan_frozen' | 'plan_created' | 'plan_updated' | 'percentages_changed';
  productType: string;
  planVersion: number;
  changedBy: string;
  affectedRoles: string[];
  changes?: { roleId: string; oldPercentage?: number; newPercentage?: number }[];
  reason?: string;
}

async function sendCommissionNotification(notification: CommissionNotification): Promise<void> {
  try {
    const adminRoles = ['superadmin', 'admin', 'finance_head', 'compliance_officer'];
    const admins = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      roles: users.roles,
    }).from(users).where(inArray(users.roles as any, adminRoles));

    const eventLabels: Record<string, string> = {
      plan_activated: 'Commission Plan Activated',
      plan_frozen: 'Commission Plan Frozen',
      plan_created: 'New Commission Plan Created',
      plan_updated: 'Commission Plan Updated',
      percentages_changed: 'Commission Percentages Modified',
    };

    const subject = `[FintekPro] ${eventLabels[notification.eventType] || 'Commission Plan Change'} - ${notification.productType}`;

    let changesHtml = '';
    if (notification.changes && notification.changes.length > 0) {
      changesHtml = `
        <h3>Percentage Changes:</h3>
        <table border="1" cellpadding="8" cellspacing="0">
          <tr><th>Role</th><th>Old %</th><th>New %</th></tr>
          ${notification.changes.map(c => `
            <tr>
              <td>${c.roleId}</td>
              <td>${c.oldPercentage ?? 'N/A'}%</td>
              <td>${c.newPercentage ?? 'N/A'}%</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">${eventLabels[notification.eventType]}</h2>
        <p><strong>Product Type:</strong> ${notification.productType}</p>
        <p><strong>Plan Version:</strong> v${notification.planVersion}</p>
        <p><strong>Changed By:</strong> ${notification.changedBy}</p>
        <p><strong>Affected Roles:</strong> ${notification.affectedRoles.join(', ') || 'All roles'}</p>
        ${notification.reason ? `<p><strong>Reason:</strong> ${notification.reason}</p>` : ''}
        ${changesHtml}
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated notification from FintekPro Commission Management System.</p>
      </div>
    `;

    for (const admin of admins) {
      if (admin.email) {
        await emailService.sendEmail({
          to: admin.email,
          subject,
          html: htmlContent,
        });
      }
    }

    console.log(`[Commission Notification] Sent ${notification.eventType} notification to ${admins.length} admins for ${notification.productType}`);
  } catch (error) {
    console.error('[Commission Notification] Failed to send notification:', error);
  }
}

const router = Router();

type CommissionRole = 'superadmin' | 'master_agent' | 'admin' | 'finance_head' | 'compliance_officer' | 'partner' | 'agent' | 'ca' | 'client';

interface CommissionPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canActivate: boolean;
  canFreeze: boolean;
}

const COMMISSION_ROLE_PERMISSIONS: Record<CommissionRole, CommissionPermissions> = {
  superadmin: { canView: true, canCreate: true, canEdit: true, canActivate: true, canFreeze: true },
  master_agent: { canView: true, canCreate: true, canEdit: true, canActivate: true, canFreeze: true },
  admin: { canView: true, canCreate: true, canEdit: true, canActivate: true, canFreeze: true },
  finance_head: { canView: true, canCreate: true, canEdit: true, canActivate: true, canFreeze: true },
  compliance_officer: { canView: true, canCreate: false, canEdit: false, canActivate: false, canFreeze: false },
  partner: { canView: false, canCreate: false, canEdit: false, canActivate: false, canFreeze: false },
  agent: { canView: false, canCreate: false, canEdit: false, canActivate: false, canFreeze: false },
  ca: { canView: false, canCreate: false, canEdit: false, canActivate: false, canFreeze: false },
  client: { canView: false, canCreate: false, canEdit: false, canActivate: false, canFreeze: false },
};

function getUserCommissionRole(req: Request): CommissionRole {
  const user = (req as any).user;
  if (!user?.id) return 'client';
  
  const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
  const normalizedRoles = userRoles.map((r: string) => r?.toLowerCase());
  
  if (normalizedRoles.includes('superadmin')) return 'superadmin';
  if (normalizedRoles.includes('master_agent')) return 'master_agent';
  if (normalizedRoles.includes('admin')) return 'admin';
  if (normalizedRoles.includes('finance_head')) return 'finance_head';
  if (normalizedRoles.includes('compliance_officer')) return 'compliance_officer';
  if (normalizedRoles.includes('partner')) return 'partner';
  if (normalizedRoles.includes('agent')) return 'agent';
  if (normalizedRoles.includes('ca')) return 'ca';
  
  return 'client';
}

function requireCommissionPermission(permission: keyof CommissionPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = getUserCommissionRole(req);
    const permissions = COMMISSION_ROLE_PERMISSIONS[role];
    
    if (!permissions[permission]) {
      return res.status(403).json({ 
        error: "Permission denied",
        message: `Role '${role}' does not have permission: ${permission}`,
        requiredPermission: permission
      });
    }
    
    (req as any).commissionRole = role;
    (req as any).commissionPermissions = permissions;
    next();
  };
}

async function logCommissionAudit(
  planId: number, 
  fieldChanged: string, 
  oldValue: string | null, 
  newValue: string | null, 
  userId: number, 
  ipAddress?: string, 
  remarks?: string
) {
  await db.insert(commissionAuditLogs).values({
    commissionPlanId: planId,
    fieldChanged,
    oldValue,
    newValue,
    changedBy: userId,
    ipAddress,
    remarks,
  });
}

const createCommissionPlanSchema = z.object({
  product_type: z.enum(CommissionProductTypes as unknown as [string, ...string[]]),
  roles: z.array(z.object({
    role_id: z.string(),
    percentage: z.number().min(0).max(100),
    payout_mode: z.enum(['upfront', 'trail', 'revenue_share', 'performance']),
    min_cap: z.number().optional(),
    max_cap: z.number().optional(),
  })),
  hierarchy_splits: z.array(z.object({
    role_id: z.string(),
    hierarchy_level: z.number().int().min(1),
    share_percentage: z.number().min(0).max(100),
    passthrough_rule: z.enum(['stop', 'roll_up']).optional(),
  })).optional(),
  effective_from: z.string(),
  effective_to: z.string().optional(),
  reason: z.string().optional(),
});

router.get("/commission-plans", requireCommissionPermission('canView'), async (req: Request, res: Response) => {
  try {
    const productType = req.query.product_type as string | undefined;
    
    let query = db.select().from(commissionPlans).orderBy(desc(commissionPlans.createdAt));
    
    if (productType) {
      const plans = await db.select().from(commissionPlans)
        .where(eq(commissionPlans.productType, productType))
        .orderBy(desc(commissionPlans.version));
      return res.json(plans);
    }
    
    const plans = await query;
    res.json(plans);
  } catch (error) {
    console.error("Error fetching commission plans:", error);
    res.status(500).json({ error: "Failed to fetch commission plans" });
  }
});

router.get("/commission-plan/:id", requireCommissionPermission('canView'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const [plan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
    
    if (!plan) {
      return res.status(404).json({ error: "Commission plan not found" });
    }
    
    const roleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    const hierarchySplits = await db.select().from(commissionHierarchySplits)
      .where(eq(commissionHierarchySplits.commissionPlanId, planId));
    
    res.json({
      ...plan,
      roleMaps,
      hierarchySplits,
    });
  } catch (error) {
    console.error("Error fetching commission plan:", error);
    res.status(500).json({ error: "Failed to fetch commission plan" });
  }
});

router.post("/commission-plan", requireCommissionPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const validation = createCommissionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const data = validation.data;
    const productType = data.product_type as CommissionProductType;
    
    if (productType === 'mutual_fund_direct') {
      const hasNonZeroCommission = data.roles.some(r => r.percentage > 0);
      if (hasNonZeroCommission) {
        return res.status(400).json({ 
          error: "Validation failed", 
          message: "MF Direct Plans must have 0% commission for all roles" 
        });
      }
    }
    
    const totalPercentage = data.roles.reduce((sum, r) => sum + r.percentage, 0);
    if (totalPercentage > 100) {
      return res.status(400).json({ 
        error: "Validation failed", 
        message: "Total payout percentage cannot exceed 100%" 
      });
    }
    
    const regulatoryCap = RegulatoryCommissionCaps[productType];
    const maxRolePercentage = Math.max(...data.roles.map(r => r.percentage));
    if (maxRolePercentage > regulatoryCap) {
      return res.status(400).json({ 
        error: "Validation failed", 
        message: `Commission exceeds regulatory cap of ${regulatoryCap}% for ${productType}` 
      });
    }
    
    const effectiveDate = new Date(data.effective_from);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isSuperadmin = (req as any).commissionRole === 'superadmin';
    if (effectiveDate < today && !isSuperadmin) {
      return res.status(400).json({ 
        error: "Validation failed", 
        message: "Cannot backdate commission plans without Superadmin override" 
      });
    }
    
    const existingPlans = await db.select()
      .from(commissionPlans)
      .where(eq(commissionPlans.productType, productType))
      .orderBy(desc(commissionPlans.version));
    
    const nextVersion = existingPlans.length > 0 ? (existingPlans[0].version + 1) : 1;
    
    const [newPlan] = await db.insert(commissionPlans).values({
      productType,
      version: nextVersion,
      status: 'draft',
      isActive: false,
      effectiveFrom: data.effective_from,
      effectiveTo: data.effective_to || null,
      regulatoryCap: regulatoryCap.toString(),
      changeReason: data.reason || null,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    
    for (const role of data.roles) {
      await db.insert(commissionRoleMaps).values({
        commissionPlanId: newPlan.id,
        roleId: role.role_id,
        payoutPercentage: role.percentage.toString(),
        payoutMode: role.payout_mode,
        minCap: role.min_cap?.toString() || null,
        maxCap: role.max_cap?.toString() || null,
        validationStatus: true,
      });
    }
    
    if (data.hierarchy_splits) {
      for (const split of data.hierarchy_splits) {
        await db.insert(commissionHierarchySplits).values({
          commissionPlanId: newPlan.id,
          roleId: split.role_id,
          hierarchyLevel: split.hierarchy_level,
          sharePercentage: split.share_percentage.toString(),
          passthroughRule: split.passthrough_rule || 'stop',
        });
      }
    }
    
    await logCommissionAudit(
      newPlan.id,
      'plan_created',
      null,
      JSON.stringify({ productType, version: nextVersion }),
      userId,
      req.ip,
      data.reason
    );
    
    res.status(201).json(newPlan);
  } catch (error) {
    console.error("Error creating commission plan:", error);
    res.status(500).json({ error: "Failed to create commission plan" });
  }
});

router.put("/commission-plan/:id", requireCommissionPermission('canEdit'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const [existingPlan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
    
    if (!existingPlan) {
      return res.status(404).json({ error: "Commission plan not found" });
    }
    
    if (existingPlan.status === 'frozen') {
      return res.status(400).json({ error: "Cannot edit frozen plan" });
    }
    
    if (existingPlan.status === 'active') {
      return res.status(400).json({ error: "Cannot edit active plan. Create a new version instead." });
    }
    
    const validation = createCommissionPlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
    }
    
    const data = validation.data;
    const productType = data.product_type as CommissionProductType;
    
    const totalPercentage = data.roles.reduce((sum, r) => sum + r.percentage, 0);
    if (totalPercentage > 100) {
      return res.status(400).json({ error: "Total payout percentage cannot exceed 100%" });
    }
    
    const oldRoleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    await db.update(commissionPlans)
      .set({
        effectiveFrom: data.effective_from,
        effectiveTo: data.effective_to || null,
        changeReason: data.reason || null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(commissionPlans.id, planId));
    
    await db.delete(commissionRoleMaps).where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    for (const role of data.roles) {
      await db.insert(commissionRoleMaps).values({
        commissionPlanId: planId,
        roleId: role.role_id,
        payoutPercentage: role.percentage.toString(),
        payoutMode: role.payout_mode,
        minCap: role.min_cap?.toString() || null,
        maxCap: role.max_cap?.toString() || null,
        validationStatus: true,
      });
    }
    
    await db.delete(commissionHierarchySplits).where(eq(commissionHierarchySplits.commissionPlanId, planId));
    
    if (data.hierarchy_splits) {
      for (const split of data.hierarchy_splits) {
        await db.insert(commissionHierarchySplits).values({
          commissionPlanId: planId,
          roleId: split.role_id,
          hierarchyLevel: split.hierarchy_level,
          sharePercentage: split.share_percentage.toString(),
          passthroughRule: split.passthrough_rule || 'stop',
        });
      }
    }
    
    await logCommissionAudit(
      planId,
      'plan_updated',
      JSON.stringify(existingPlan),
      JSON.stringify(data),
      userId,
      req.ip,
      data.reason
    );
    
    const percentageChanges: { roleId: string; oldPercentage?: number; newPercentage?: number }[] = [];
    for (const newRole of data.roles) {
      const oldRole = oldRoleMaps.find(r => r.roleId === newRole.role_id);
      const oldPct = oldRole ? parseFloat(oldRole.payoutPercentage.toString()) : undefined;
      if (oldPct !== newRole.percentage) {
        percentageChanges.push({
          roleId: newRole.role_id,
          oldPercentage: oldPct,
          newPercentage: newRole.percentage,
        });
      }
    }
    for (const oldRole of oldRoleMaps) {
      if (!data.roles.find(r => r.role_id === oldRole.roleId)) {
        percentageChanges.push({
          roleId: oldRole.roleId,
          oldPercentage: parseFloat(oldRole.payoutPercentage.toString()),
          newPercentage: undefined,
        });
      }
    }
    
    if (percentageChanges.length > 0) {
      sendCommissionNotification({
        eventType: 'percentages_changed',
        productType: existingPlan.productType,
        planVersion: existingPlan.version,
        changedBy: `User #${userId}`,
        affectedRoles: data.roles.map(r => r.role_id),
        changes: percentageChanges,
        reason: data.reason,
      }).catch(err => console.error('Notification failed:', err));
    }
    
    res.json({ message: "Plan updated successfully" });
  } catch (error) {
    console.error("Error updating commission plan:", error);
    res.status(500).json({ error: "Failed to update commission plan" });
  }
});

router.post("/commission-plan/:id/activate", requireCommissionPermission('canActivate'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const [plan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
    if (!plan) {
      return res.status(404).json({ error: "Commission plan not found" });
    }

    // Instead of direct activation, create an approval request (Maker)
    const request = await AdminApprovalService.createRequest({
      entityType: 'commission_plan',
      entityId: planId.toString(),
      action: 'activate',
      requestedBy: userId,
      requestData: { planId, productType: plan.productType, version: plan.version },
      priority: 'high',
      justification: `Activation requested for ${plan.productType} v${plan.version}`
    });
    
    res.json({ 
      message: "Activation request submitted for approval", 
      requestId: request.id,
      requiresApproval: true 
    });
  } catch (error) {
    console.error("Error creating activation request:", error);
    res.status(500).json({ error: "Failed to submit activation request" });
  }
});

// Admin Approval Routes (Checker)
router.get("/approval-requests", requireCommissionPermission('canView'), async (req, res) => {
  try {
    const requests = await AdminApprovalService.getPendingRequests();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch approval requests" });
  }
});

router.post("/approval-requests/:id/process", requireCommissionPermission('canActivate'), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { status, comments } = req.body;
    const userId = (req as any).session?.userId;

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedRequest = await AdminApprovalService.updateStatus(requestId, {
      status,
      reviewedBy: userId,
      reviewComments: comments
    });

    if (status === 'approved' && updatedRequest.entityType === 'commission_plan' && updatedRequest.action === 'activate') {
      const planId = (updatedRequest as any).requestData?.planId;
      
      const [plan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
      
      // Perform the actual activation
      await db.update(commissionPlans)
        .set({ isActive: false, status: 'archived' })
        .where(and(
          eq(commissionPlans.productType, plan.productType),
          eq(commissionPlans.isActive, true)
        ));
      
      await db.update(commissionPlans)
        .set({ 
          isActive: true, 
          status: 'active',
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(commissionPlans.id, planId));

      await logCommissionAudit(
        planId,
        'plan_activated',
        'pending_approval',
        'active',
        userId,
        req.ip,
        `Plan approved and activated. Request ID: ${requestId}`
      );
    }

    res.json({ message: `Request ${status} successfully`, request: updatedRequest });
  } catch (error: any) {
    console.error("Error processing approval request:", error);
    res.status(400).json({ error: error.message || "Failed to process request" });
  }
});

router.post("/commission-plan/:id/freeze", requireCommissionPermission('canFreeze'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const [plan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
    
    if (!plan) {
      return res.status(404).json({ error: "Commission plan not found" });
    }
    
    if (plan.status === 'frozen') {
      return res.status(400).json({ error: "Plan is already frozen" });
    }
    
    await db.update(commissionPlans)
      .set({ 
        status: 'frozen',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(commissionPlans.id, planId));
    
    await logCommissionAudit(
      planId,
      'plan_frozen',
      plan.status,
      'frozen',
      userId,
      req.ip,
      req.body.reason || 'Plan frozen by admin'
    );
    
    const roleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    sendCommissionNotification({
      eventType: 'plan_frozen',
      productType: plan.productType,
      planVersion: plan.version,
      changedBy: `User #${userId}`,
      affectedRoles: roleMaps.map(rm => rm.roleId),
      reason: req.body.reason || 'Plan frozen by admin',
    }).catch(err => console.error('Notification failed:', err));
    
    res.json({ message: "Plan frozen successfully" });
  } catch (error) {
    console.error("Error freezing commission plan:", error);
    res.status(500).json({ error: "Failed to freeze commission plan" });
  }
});

router.post("/commission-plan/:id/clone", requireCommissionPermission('canCreate'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    const userId = (req as any).session?.userId;
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const [existingPlan] = await db.select().from(commissionPlans).where(eq(commissionPlans.id, planId));
    
    if (!existingPlan) {
      return res.status(404).json({ error: "Commission plan not found" });
    }
    
    const existingPlans = await db.select()
      .from(commissionPlans)
      .where(eq(commissionPlans.productType, existingPlan.productType))
      .orderBy(desc(commissionPlans.version));
    
    const nextVersion = existingPlans.length > 0 ? (existingPlans[0].version + 1) : 1;
    
    const [newPlan] = await db.insert(commissionPlans).values({
      productType: existingPlan.productType,
      version: nextVersion,
      status: 'draft',
      isActive: false,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: null,
      regulatoryCap: existingPlan.regulatoryCap,
      changeReason: `Cloned from version ${existingPlan.version}`,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    
    const roleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    for (const roleMap of roleMaps) {
      await db.insert(commissionRoleMaps).values({
        commissionPlanId: newPlan.id,
        roleId: roleMap.roleId,
        payoutPercentage: roleMap.payoutPercentage,
        payoutMode: roleMap.payoutMode,
        minCap: roleMap.minCap,
        maxCap: roleMap.maxCap,
        validationStatus: roleMap.validationStatus,
      });
    }
    
    const hierarchySplits = await db.select().from(commissionHierarchySplits)
      .where(eq(commissionHierarchySplits.commissionPlanId, planId));
    
    for (const split of hierarchySplits) {
      await db.insert(commissionHierarchySplits).values({
        commissionPlanId: newPlan.id,
        roleId: split.roleId,
        hierarchyLevel: split.hierarchyLevel,
        sharePercentage: split.sharePercentage,
        passthroughRule: split.passthroughRule,
      });
    }
    
    await logCommissionAudit(
      newPlan.id,
      'plan_cloned',
      null,
      JSON.stringify({ clonedFrom: planId, version: nextVersion }),
      userId,
      req.ip,
      `Cloned from plan ${planId}`
    );
    
    res.status(201).json(newPlan);
  } catch (error) {
    console.error("Error cloning commission plan:", error);
    res.status(500).json({ error: "Failed to clone commission plan" });
  }
});

router.get("/commission-plan/:id/audit-log", requireCommissionPermission('canView'), async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id);
    
    if (isNaN(planId)) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }
    
    const logs = await db.select().from(commissionAuditLogs)
      .where(eq(commissionAuditLogs.commissionPlanId, planId))
      .orderBy(desc(commissionAuditLogs.changedAt));
    
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/commission-product-types", requireCommissionPermission('canView'), async (req: Request, res: Response) => {
  res.json({
    productTypes: CommissionProductTypes,
    regulatoryCaps: RegulatoryCommissionCaps,
  });
});

router.get("/commission-roles", requireCommissionPermission('canView'), async (req: Request, res: Response) => {
  const commissionRoles = [
    { id: 'master_agent', name: 'Master Agent', level: 1 },
    { id: 'partner', name: 'Partner', level: 2 },
    { id: 'agent', name: 'Agent', level: 3 },
    { id: 'sub_agent', name: 'Sub-Agent', level: 4 },
    { id: 'associate', name: 'Associate', level: 5 },
    { id: 'district_associate', name: 'District Associate', level: 6 },
    { id: 'field_associate', name: 'Field Associate', level: 7 },
  ];
  
  res.json(commissionRoles);
});

router.get("/active-commission-plan/:productType", async (req: Request, res: Response) => {
  try {
    const productType = req.params.productType;
    
    const [plan] = await db.select().from(commissionPlans)
      .where(and(
        eq(commissionPlans.productType, productType),
        eq(commissionPlans.isActive, true)
      ));
    
    if (!plan) {
      return res.status(404).json({ error: "No active commission plan found for this product type" });
    }
    
    const roleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, plan.id));
    
    const hierarchySplits = await db.select().from(commissionHierarchySplits)
      .where(eq(commissionHierarchySplits.commissionPlanId, plan.id));
    
    res.json({
      ...plan,
      roleMaps,
      hierarchySplits,
    });
  } catch (error) {
    console.error("Error fetching active commission plan:", error);
    res.status(500).json({ error: "Failed to fetch active commission plan" });
  }
});

export default router;
