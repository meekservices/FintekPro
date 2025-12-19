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
  type InsertCommissionAuditLog
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

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
  const session = (req as any).session;
  if (!session?.userId) return 'client';
  
  const userRole = session.userRole?.toLowerCase();
  
  if (userRole === 'superadmin') return 'superadmin';
  if (userRole === 'master_agent') return 'master_agent';
  if (userRole === 'admin') return 'admin';
  if (userRole === 'finance_head') return 'finance_head';
  if (userRole === 'compliance_officer') return 'compliance_officer';
  if (userRole === 'partner') return 'partner';
  if (userRole === 'agent') return 'agent';
  if (userRole === 'ca') return 'ca';
  
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
    
    if (plan.status === 'frozen') {
      return res.status(400).json({ error: "Cannot activate frozen plan" });
    }
    
    const roleMaps = await db.select().from(commissionRoleMaps)
      .where(eq(commissionRoleMaps.commissionPlanId, planId));
    
    if (roleMaps.length === 0) {
      return res.status(400).json({ error: "Cannot activate plan without role mappings" });
    }
    
    const effectiveDate = new Date(plan.effectiveFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (effectiveDate < today) {
      return res.status(400).json({ error: "Cannot activate plan with past effective date" });
    }
    
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
      'draft',
      'active',
      userId,
      req.ip,
      `Plan activated for ${plan.productType}`
    );
    
    res.json({ message: "Plan activated successfully" });
  } catch (error) {
    console.error("Error activating commission plan:", error);
    res.status(500).json({ error: "Failed to activate commission plan" });
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
