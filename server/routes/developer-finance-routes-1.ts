import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, inArray, gte, lte } from "drizzle-orm";
import {
  dsaLoanApplications,
  developerProjects,
  projectLandDetails,
  projectApprovals,
  projectCashflows,
  developerFinancials,
  loanDisbursementTranches,
  bankProductAppetite,
  bankConnectors,
  insertDeveloperProjectSchema,
  insertProjectLandDetailsSchema,
  insertProjectApprovalsSchema,
  insertProjectCashflowsSchema,
  insertDeveloperFinancialsSchema,
  insertLoanDisbursementTrancheSchema,
  insertBankProductAppetiteSchema,
} from "@shared/schema";

const router = Router();

function devFinanceRBAC(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required for developer finance operations" });
    }
    const userRoles: string[] = user.roles || (user.role ? [user.role] : ['user']);
    const isTester = userRoles.includes('tester');
    const hasRole = allowedRoles.some(r => userRoles.includes(r));
    if (isTester || hasRole || userRoles.includes('admin') || userRoles.includes('super_admin')) {
      return next();
    }
    return res.status(403).json({ success: false, error: "Insufficient permissions for developer finance operations" });
  };
}

const agentAccess = devFinanceRBAC('agent', 'credit_manager');
const creditManagerAccess = devFinanceRBAC('credit_manager');
const readAccess = devFinanceRBAC('agent', 'credit_manager', 'user');

// ============== DEVELOPER PROJECTS ==============

router.post("/projects", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertDeveloperProjectSchema.parse(req.body);
    const [project] = await db.insert(developerProjects).values(parsed as any).returning();
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "Failed to create project" });
  }
});

router.get("/projects", readAccess, async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string;
    const whereClause = agentId ? eq(developerProjects.agentId, agentId) : undefined;
    const projects = await db.select().from(developerProjects)
      .where(whereClause as any)
      .orderBy(desc(developerProjects.createdAt));
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/projects/:id", readAccess, async (req: Request, res: Response) => {
  try {
    const [project] = await db.select().from(developerProjects)
      .where(eq(developerProjects.id, req.params.id));
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });

    const land = await db.select().from(projectLandDetails)
      .where(eq(projectLandDetails.projectId, req.params.id));
    const approvals = await db.select().from(projectApprovals)
      .where(eq(projectApprovals.projectId, req.params.id));
    const cashflows = await db.select().from(projectCashflows)
      .where(eq(projectCashflows.projectId, req.params.id));
    const financials = await db.select().from(developerFinancials)
      .where(eq(developerFinancials.projectId, req.params.id));

    res.json({
      success: true,
      data: { ...project, landDetails: land, approvals, cashflows, financials },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/projects/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(developerProjects)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(developerProjects.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ success: false, error: "Project not found" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== LAND DETAILS ==============

router.post("/projects/:projectId/land", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertProjectLandDetailsSchema.parse({ ...req.body, projectId: req.params.projectId });
    const [land] = await db.insert(projectLandDetails).values(parsed as any).returning();
    res.json({ success: true, data: land });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/land/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(projectLandDetails)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(projectLandDetails.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== APPROVALS ==============

router.post("/projects/:projectId/approvals", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertProjectApprovalsSchema.parse({ ...req.body, projectId: req.params.projectId });
    const [approval] = await db.insert(projectApprovals).values(parsed as any).returning();
    res.json({ success: true, data: approval });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/approvals/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(projectApprovals)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(projectApprovals.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete("/approvals/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    await db.delete(projectApprovals).where(eq(projectApprovals.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CASHFLOWS ==============

router.post("/projects/:projectId/cashflows", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertProjectCashflowsSchema.parse({ ...req.body, projectId: req.params.projectId });
    const [cashflow] = await db.insert(projectCashflows).values(parsed as any).returning();
    res.json({ success: true, data: cashflow });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/projects/:projectId/cashflows/bulk", agentAccess, async (req: Request, res: Response) => {
  try {
    const { cashflows: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: "cashflows array required" });
    }
    const parsed = rows.map((r: any) =>
      insertProjectCashflowsSchema.parse({ ...r, projectId: req.params.projectId })
    );
    const inserted = await db.insert(projectCashflows).values(parsed as any).returning();
    res.json({ success: true, data: inserted });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete("/cashflows/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    await db.delete(projectCashflows).where(eq(projectCashflows.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== DEVELOPER FINANCIALS ==============

router.post("/projects/:projectId/financials", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertDeveloperFinancialsSchema.parse({ ...req.body, projectId: req.params.projectId });
    const [fin] = await db.insert(developerFinancials).values(parsed as any).returning();
    res.json({ success: true, data: fin });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});


export default router;
