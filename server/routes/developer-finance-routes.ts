import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
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

router.patch("/financials/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(developerFinancials)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(developerFinancials.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== DISBURSEMENT TRANCHES ==============

router.get("/applications/:applicationId/tranches", readAccess, async (req: Request, res: Response) => {
  try {
    const tranches = await db.select().from(loanDisbursementTranches)
      .where(eq(loanDisbursementTranches.applicationId, req.params.applicationId))
      .orderBy(loanDisbursementTranches.trancheNumber);
    res.json({ success: true, data: tranches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/applications/:applicationId/tranches", agentAccess, async (req: Request, res: Response) => {
  try {
    const parsed = insertLoanDisbursementTrancheSchema.parse({
      ...req.body,
      applicationId: req.params.applicationId,
    });
    const [tranche] = await db.insert(loanDisbursementTranches).values(parsed as any).returning();
    res.json({ success: true, data: tranche });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/applications/:applicationId/tranches/bulk", agentAccess, async (req: Request, res: Response) => {
  try {
    const { tranches: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: "tranches array required" });
    }
    const parsed = rows.map((r: any) =>
      insertLoanDisbursementTrancheSchema.parse({
        ...r,
        applicationId: req.params.applicationId,
      })
    );
    const inserted = await db.insert(loanDisbursementTranches).values(parsed as any).returning();
    res.json({ success: true, data: inserted });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/tranches/:id", agentAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(loanDisbursementTranches)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(loanDisbursementTranches.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== BANK PRODUCT APPETITE ==============

router.get("/bank-appetite", readAccess, async (req: Request, res: Response) => {
  try {
    const loanSubTypeFilter = req.query.loanSubType as string;
    const results = await db.select({
      appetite: bankProductAppetite,
      bank: {
        bankCode: bankConnectors.bankCode,
        bankName: bankConnectors.bankName,
      },
    })
      .from(bankProductAppetite)
      .leftJoin(bankConnectors, eq(bankProductAppetite.bankCode, bankConnectors.bankCode))
      .where(
        loanSubTypeFilter
          ? eq(bankProductAppetite.loanSubType, loanSubTypeFilter as any)
          : eq(bankProductAppetite.isActive, true)
      );
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/bank-appetite", devFinanceRBAC('credit_manager'), async (req: Request, res: Response) => {
  try {
    const parsed = insertBankProductAppetiteSchema.parse(req.body);
    const [appetite] = await db.insert(bankProductAppetite).values(parsed as any).returning();
    res.json({ success: true, data: appetite });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/bank-appetite/:id", creditManagerAccess, async (req: Request, res: Response) => {
  try {
    const [updated] = await db.update(bankProductAppetite)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(bankProductAppetite.id, req.params.id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== CREDIT SUMMARY & METRICS CALCULATOR ==============

router.get("/projects/:projectId/credit-summary", readAccess, async (req: Request, res: Response) => {
  try {
    const [project] = await db.select().from(developerProjects)
      .where(eq(developerProjects.id, req.params.projectId));
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });

    const financials = await db.select().from(developerFinancials)
      .where(eq(developerFinancials.projectId, req.params.projectId))
      .orderBy(desc(developerFinancials.financialYear))
      .limit(1);
    const latestFin = financials[0] || null;

    const cashflows = await db.select().from(projectCashflows)
      .where(eq(projectCashflows.projectId, req.params.projectId));

    const approvals = await db.select().from(projectApprovals)
      .where(eq(projectApprovals.projectId, req.params.projectId));

    const land = await db.select().from(projectLandDetails)
      .where(eq(projectLandDetails.projectId, req.params.projectId));
    const landDetail = land[0] || null;

    const totalProjectCost = parseFloat(project.totalProjectCost || "0");
    const totalProjectRevenue = parseFloat(project.totalProjectRevenue || "0");
    const landCost = parseFloat(project.landCost || "0");
    const constructionCost = parseFloat(project.constructionCost || "0");

    const requestedAmount = totalProjectCost * 0.65;
    const promoterContrib = latestFin ? parseFloat(latestFin.promoterContribution || "0") : totalProjectCost * 0.25;
    const promoterContribPercent = totalProjectCost > 0 ? (promoterContrib / totalProjectCost) * 100 : 0;
    const escrowBalance = latestFin ? parseFloat(latestFin.escrowBalance || "0") : 0;
    const dscr = latestFin ? parseFloat(latestFin.dscr || "0") : 0;
    const debtEquityRatio = latestFin ? parseFloat(latestFin.debtEquityRatio || "0") : 0;

    const ltv = landDetail && parseFloat(landDetail.marketValue || "0") > 0
      ? (requestedAmount / parseFloat(landDetail.marketValue || "1")) * 100 : 0;
    const ltc = totalProjectCost > 0 ? (requestedAmount / totalProjectCost) * 100 : 0;

    const totalInflow = cashflows.reduce((s, c) =>
      s + parseFloat(c.inflowSales || "0") + parseFloat(c.inflowDisbursement || "0") + parseFloat(c.inflowOther || "0"), 0);
    const totalOutflow = cashflows.reduce((s, c) =>
      s + parseFloat(c.outflowConstruction || "0") + parseFloat(c.outflowLand || "0") +
      parseFloat(c.outflowInterest || "0") + parseFloat(c.outflowAdmin || "0") + parseFloat(c.outflowOther || "0"), 0);
    const netCashflow = totalInflow - totalOutflow;

    const projectIrr = totalProjectCost > 0 && totalProjectRevenue > 0
      ? (((totalProjectRevenue / totalProjectCost) - 1) / (project.projectTenureMonths ? project.projectTenureMonths / 12 : 3)) * 100
      : 0;

    const mandatoryApprovals = approvals.filter(a => a.isMandatory);
    const obtainedMandatory = mandatoryApprovals.filter(a => a.status === "OBTAINED");

    const riskFlags: string[] = [];
    if (dscr > 0 && dscr < 1.25) riskFlags.push("DSCR below 1.25x threshold");
    if (promoterContribPercent < 20) riskFlags.push("Promoter contribution below 20%");
    if (ltc > 75) riskFlags.push("LTC ratio exceeds 75%");
    if (ltv > 80) riskFlags.push("LTV ratio exceeds 80%");
    if (debtEquityRatio > 3) riskFlags.push("Debt-equity ratio above 3x");
    if (!project.reraNumber) riskFlags.push("RERA registration missing");
    if (mandatoryApprovals.length > 0 && obtainedMandatory.length < mandatoryApprovals.length) {
      riskFlags.push(`${mandatoryApprovals.length - obtainedMandatory.length} mandatory approvals pending`);
    }
    if (escrowBalance < totalProjectCost * 0.1) riskFlags.push("Escrow balance below 10% of project cost");
    if (landDetail?.titleStatus === "DISPUTED" || landDetail?.titleStatus === "UNDER_LITIGATION") {
      riskFlags.push("Land title is disputed/under litigation");
    }
    if (landDetail?.encumbranceStatus === "ENCUMBERED") riskFlags.push("Land is encumbered");

    const creditRules = [
      { rule: "Promoter Contribution ≥ 20%", value: `${promoterContribPercent.toFixed(1)}%`, pass: promoterContribPercent >= 20 },
      { rule: "DSCR ≥ 1.25x", value: dscr > 0 ? `${dscr.toFixed(2)}x` : "N/A", pass: dscr >= 1.25 },
      { rule: "LTC ≤ 75%", value: `${ltc.toFixed(1)}%`, pass: ltc <= 75 },
      { rule: "LTV ≤ 80%", value: ltv > 0 ? `${ltv.toFixed(1)}%` : "N/A", pass: ltv <= 80 || ltv === 0 },
      { rule: "Debt-Equity ≤ 3x", value: debtEquityRatio > 0 ? `${debtEquityRatio.toFixed(2)}x` : "N/A", pass: debtEquityRatio <= 3 || debtEquityRatio === 0 },
      { rule: "RERA Registration", value: project.reraNumber || "Missing", pass: !!project.reraNumber },
      { rule: "Title Clear", value: landDetail?.titleStatus || "N/A", pass: landDetail?.titleStatus === "CLEAR" },
      { rule: "Encumbrance Clear", value: landDetail?.encumbranceStatus || "N/A", pass: landDetail?.encumbranceStatus === "CLEAR" },
      { rule: "Mandatory Approvals", value: `${obtainedMandatory.length}/${mandatoryApprovals.length}`, pass: obtainedMandatory.length >= mandatoryApprovals.length },
      { rule: "Escrow ≥ 10% of Cost", value: `₹${(escrowBalance / 10000000).toFixed(2)} Cr`, pass: escrowBalance >= totalProjectCost * 0.1 },
    ];

    const passCount = creditRules.filter(r => r.pass).length;
    const creditVerdict = passCount >= 8 ? "APPROVE" : passCount >= 5 ? "CONDITIONAL" : "REJECT";

    res.json({
      success: true,
      data: {
        metrics: {
          totalProjectCost,
          totalProjectRevenue,
          requestedAmount,
          ltv: parseFloat(ltv.toFixed(2)),
          ltc: parseFloat(ltc.toFixed(2)),
          dscr,
          projectIrr: parseFloat(projectIrr.toFixed(2)),
          promoterContribution: promoterContrib,
          promoterContributionPercent: parseFloat(promoterContribPercent.toFixed(2)),
          escrowBalance,
          debtEquityRatio,
          netCashflow,
          totalInflow,
          totalOutflow,
          unitsSold: project.unitsSold || 0,
          totalUnits: project.totalUnits || 0,
          salesPercent: project.totalUnits ? parseFloat((((project.unitsSold || 0) / project.totalUnits) * 100).toFixed(1)) : 0,
        },
        creditRules,
        creditVerdict,
        riskFlags,
        passCount,
        totalRules: creditRules.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== FUNDING STRUCTURE CALCULATOR ==============

router.post("/calculate-funding", readAccess, async (req: Request, res: Response) => {
  try {
    const {
      totalProjectCost,
      seniorDebt,
      mezzanineDebt,
      equity,
      customerAdvances,
      interestRate,
      tenureMonths,
      landValue,
    } = req.body;

    const cost = parseFloat(totalProjectCost || "0");
    const senior = parseFloat(seniorDebt || "0");
    const mezz = parseFloat(mezzanineDebt || "0");
    const eq = parseFloat(equity || "0");
    const advances = parseFloat(customerAdvances || "0");
    const rate = parseFloat(interestRate || "12") / 100;
    const tenure = parseInt(tenureMonths || "36");
    const land = parseFloat(landValue || "0");

    const totalFunding = senior + mezz + eq + advances;
    const gap = cost - totalFunding;
    const ltc = cost > 0 ? (senior / cost) * 100 : 0;
    const ltv = land > 0 ? (senior / land) * 100 : 0;
    const leverageRatio = eq > 0 ? (senior + mezz) / eq : 0;
    const annualInterest = senior * rate;
    const monthlyEmi = senior * (rate / 12) * Math.pow(1 + rate / 12, tenure) / (Math.pow(1 + rate / 12, tenure) - 1);
    const totalInterest = monthlyEmi * tenure - senior;
    const equityPercent = cost > 0 ? (eq / cost) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalProjectCost: cost,
        fundingBreakdown: {
          seniorDebt: senior,
          seniorDebtPercent: cost > 0 ? (senior / cost) * 100 : 0,
          mezzanineDebt: mezz,
          mezzaninePercent: cost > 0 ? (mezz / cost) * 100 : 0,
          equity: eq,
          equityPercent,
          customerAdvances: advances,
          advancesPercent: cost > 0 ? (advances / cost) * 100 : 0,
        },
        totalFunding,
        fundingGap: gap,
        metrics: {
          ltc: parseFloat(ltc.toFixed(2)),
          ltv: parseFloat(ltv.toFixed(2)),
          leverageRatio: parseFloat(leverageRatio.toFixed(2)),
          annualInterest: parseFloat(annualInterest.toFixed(0)),
          monthlyEmi: parseFloat(monthlyEmi.toFixed(0)),
          totalInterest: parseFloat(totalInterest.toFixed(0)),
        },
        validations: {
          ltcOk: ltc <= 75,
          ltvOk: ltv <= 80 || land === 0,
          equityOk: equityPercent >= 20,
          leverageOk: leverageRatio <= 3,
          fundingComplete: Math.abs(gap) < 1,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== DEVELOPER LOAN APPLICATION (FULL SAVE) ==============

router.post("/applications", agentAccess, async (req: Request, res: Response) => {
  try {
    const { project, landDetails, approvals: approvalsData, application } = req.body;

    const [savedProject] = await db.insert(developerProjects).values({
      ...project,
    } as any).returning();

    if (landDetails) {
      await db.insert(projectLandDetails).values({
        ...landDetails,
        projectId: savedProject.id,
      } as any);
    }

    if (Array.isArray(approvalsData) && approvalsData.length > 0) {
      await db.insert(projectApprovals).values(
        approvalsData.map((a: any) => ({ ...a, projectId: savedProject.id })) as any
      );
    }

    const [loan] = await db.update(dsaLoanApplications)
      .set({
        loanVertical: "DEVELOPER" as any,
        loanSubType: application.loanSubType,
        developerProjectId: savedProject.id,
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, application.applicationId))
      .returning();

    res.json({
      success: true,
      data: {
        project: savedProject,
        application: loan,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============== COMPLIANCE VALIDATION ==============

router.get("/projects/:projectId/compliance-check", readAccess, async (req: Request, res: Response) => {
  try {
    const [project] = await db.select().from(developerProjects)
      .where(eq(developerProjects.id, req.params.projectId));
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });

    const approvals = await db.select().from(projectApprovals)
      .where(eq(projectApprovals.projectId, req.params.projectId));
    const land = await db.select().from(projectLandDetails)
      .where(eq(projectLandDetails.projectId, req.params.projectId));

    const checks = [
      { check: "RERA Registration", required: true, status: !!project.reraNumber, value: project.reraNumber || "Missing" },
      { check: "Title Report", required: true, status: land.some(l => l.titleStatus === "CLEAR"), value: land[0]?.titleStatus || "Not submitted" },
      { check: "Encumbrance Certificate", required: true, status: land.some(l => l.encumbranceStatus === "CLEAR"), value: land[0]?.encumbranceStatus || "Not submitted" },
      { check: "Escrow Agreement", required: true, status: approvals.some(a => a.approvalType === "ESCROW_AGREEMENT" && a.status === "OBTAINED"), value: "Check approvals" },
      { check: "CA Certificate", required: true, status: approvals.some(a => a.approvalType === "CA_CERTIFICATE" && a.status === "OBTAINED"), value: "Check approvals" },
      { check: "Engineer Certificate", required: true, status: approvals.some(a => a.approvalType === "ENGINEER_CERTIFICATE" && a.status === "OBTAINED"), value: "Check approvals" },
    ];

    const allMandatoryPass = checks.filter(c => c.required).every(c => c.status);

    res.json({
      success: true,
      data: {
        checks,
        canSubmit: allMandatoryPass,
        missingCount: checks.filter(c => c.required && !c.status).length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
