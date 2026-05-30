import { Router, Request, Response } from "express";
import { db } from "../db";
import { storeProducts, storeCategories, advisorySubscriptions, mutualFunds, mutualFundAmcs } from "@shared/schema";
import { eq, and, or, like, desc, asc, sql, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── SEBI/AMFI Upfront Commission Ban ─────────────────────────────────────────
// SEBI/AMFI circular (Aug 2018) permanently banned upfront commissions for MF
// distribution. Only trail commissions (AUM-based) are permitted.
// Reference: AMFI circular 135/BP/22/2018-19
const MAX_TRAIL_COMMISSION_PERCENT = 2.0; // AMFI capped trail at ~1-2% for most categories

function enforceCommissionCompliance(body: any): string | null {
  const upfront = parseFloat(body.upfrontCommission ?? body.upfrontCommissionRate ?? '0');
  if (upfront > 0) {
    return 'Upfront commissions for mutual fund distribution are permanently prohibited under SEBI/AMFI circular 135/BP/22/2018-19. Only trail commissions (AUM-based) are permitted.';
  }
  const trail = parseFloat(body.trailCommission ?? body.regularTrailCommission ?? '0');
  if (trail > MAX_TRAIL_COMMISSION_PERCENT) {
    return `Trail commission ${trail}% exceeds the AMFI regulatory cap of ${MAX_TRAIL_COMMISSION_PERCENT}%. Please verify with AMFI before proceeding.`;
  }
  return null; // compliant
}

const seedMutualFundSchema = z.object({
  schemeName: z.string().min(1),
  schemeCode: z.string().min(1),
  categoryId: z.string().min(1),
  fundHouse: z.string().min(1),
  planType: z.enum(['direct', 'regular']),
  nav: z.number().optional(),
  expenseRatio: z.number().optional(),
  trailCommission: z.number().optional(),
  exitLoad: z.number().optional(),
  exitLoadPeriod: z.number().optional(),
  minimumInvestment: z.number().optional(),
  lockInPeriod: z.number().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  returns1y: z.number().optional(),
  returns3y: z.number().optional(),
  returns5y: z.number().optional(),
  amfiCode: z.string().optional(),
  isinCode: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

const updateCategoryToggleSchema = z.object({
  isEnabled: z.boolean().optional(),
  directFundsEnabled: z.boolean().optional(),
  comingSoonMessage: z.string().optional(),
  comingSoonExpectedDate: z.string().optional(),
});

router.get("/mutual-funds", async (req: Request, res: Response) => {
  try {
    const { planType, categoryId, search, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    let conditions: any[] = [eq(storeProducts.productType, 'mutual_fund')];
    
    if (planType && planType !== 'all') {
      conditions.push(eq(storeProducts.planType, planType as string));
    }
    
    if (categoryId) {
      conditions.push(eq(storeProducts.categoryId, categoryId as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(storeProducts.name, `%${search}%`),
          ilike(storeProducts.provider, `%${search}%`),
          ilike(storeProducts.schemeCode, `%${search}%`)
        )
      );
    }
    
    const funds = await db.select()
      .from(storeProducts)
      .where(and(...conditions))
      .orderBy(desc(storeProducts.createdAt))
      .limit(limitNum)
      .offset(offset);
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(storeProducts)
      .where(and(...conditions));
    
    const total = Number(countResult[0]?.count || 0);
    
    res.json({
      success: true,
      funds,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching mutual funds:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Simple create endpoint for admin UI
router.post("/mutual-funds", async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // ── SEBI/AMFI upfront commission ban ────────────────────────────────────
    const commissionError = enforceCommissionCompliance(data);
    if (commissionError) {
      return res.status(422).json({ success: false, error: commissionError, regulatoryViolation: true });
    }

    const [newFund] = await db.insert(storeProducts).values({
      name: data.name,
      shortDescription: data.shortDescription,
      fullDescription: data.description,
      categoryId: data.category || "mutual-funds",
      productType: "mutual_fund",
      planType: data.planType,
      schemeCode: data.amfiCode,
      amfiCode: data.amfiCode,
      isinCode: data.isinCode,
      price: data.nav,
      expenseRatio: data.expenseRatio,
      trailCommission: data.trailCommission,
      minimumInvestment: data.minInvestment,
      exitLoad: data.exitLoad,
      riskLevel: data.riskLevel,
      expectedReturns: data.returns1y,
      provider: data.fundHouse,
      regulatory: {
        returns1y: data.returns1y,
        returns3y: data.returns3y,
        returns5y: data.returns5y,
        nav: data.nav,
        aum: data.aum,
      },
      isActive: true,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: data.planType === "regular",
    }).returning();
    
    res.json({ success: true, fund: newFund });
  } catch (error: any) {
    console.error("[Admin MF] Error creating mutual fund:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post("/mutual-funds/seed", async (req: Request, res: Response) => {
  try {
    const data = seedMutualFundSchema.parse(req.body);
    
    const existingFund = await db.select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.schemeCode, data.schemeCode),
          eq(storeProducts.planType, data.planType)
        )
      )
      .limit(1);
    
    if (existingFund.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${data.planType.toUpperCase()} plan for this scheme already exists`
      });
    }
    
    const planSuffix = data.planType === 'direct' ? ' - Direct Plan' : ' - Regular Plan';
    const displayName = data.schemeName.includes(planSuffix) 
      ? data.schemeName 
      : data.schemeName + planSuffix;
    
    const [newFund] = await db.insert(storeProducts).values({
      name: displayName,
      shortDescription: data.shortDescription || `${data.fundHouse} - ${data.planType.toUpperCase()} Plan`,
      fullDescription: data.fullDescription,
      categoryId: data.categoryId,
      productType: 'mutual_fund',
      planType: data.planType,
      schemeCode: data.schemeCode,
      amfiCode: data.amfiCode,
      isinCode: data.isinCode,
      price: data.nav?.toString(),
      expenseRatio: data.expenseRatio?.toString(),
      trailCommission: data.planType === 'regular' ? data.trailCommission?.toString() : null,
      exitLoad: data.exitLoad?.toString(),
      exitLoadPeriod: data.exitLoadPeriod,
      minimumInvestment: data.minimumInvestment?.toString(),
      lockInPeriod: data.lockInPeriod,
      riskLevel: data.riskLevel,
      expectedReturns: data.returns1y?.toString(),
      provider: data.fundHouse,
      features: data.features,
      regulatory: {
        returns1y: data.returns1y,
        returns3y: data.returns3y,
        returns5y: data.returns5y,
        nav: data.nav,
      },
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: data.planType === 'regular',
    }).returning();
    
    res.json({
      success: true,
      message: `${data.planType.toUpperCase()} plan seeded successfully`,
      fund: newFund
    });
  } catch (error: any) {
    console.error("[Admin MF] Error seeding mutual fund:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/mutual-funds/seed-both", async (req: Request, res: Response) => {
  try {
    const baseData = seedMutualFundSchema.omit({ planType: true }).parse(req.body);
    const { directExpenseRatio, regularExpenseRatio, regularTrailCommission } = req.body;
    
    const results = [];
    
    const directData = {
      ...baseData,
      planType: 'direct' as const,
      expenseRatio: directExpenseRatio || (baseData.expenseRatio ? baseData.expenseRatio * 0.6 : undefined),
      trailCommission: undefined,
    };
    
    const directSuffix = ' - Direct Plan';
    const directDisplayName = baseData.schemeName.includes('Direct') 
      ? baseData.schemeName 
      : baseData.schemeName + directSuffix;
    
    const existingDirect = await db.select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.schemeCode, baseData.schemeCode),
          eq(storeProducts.planType, 'direct')
        )
      )
      .limit(1);
    
    if (existingDirect.length === 0) {
      const [directFund] = await db.insert(storeProducts).values({
        name: directDisplayName,
        shortDescription: `${baseData.fundHouse} - DIRECT Plan`,
        fullDescription: baseData.fullDescription,
        categoryId: baseData.categoryId,
        productType: 'mutual_fund',
        planType: 'direct',
        schemeCode: baseData.schemeCode,
        amfiCode: baseData.amfiCode,
        isinCode: baseData.isinCode,
        price: baseData.nav?.toString(),
        expenseRatio: directData.expenseRatio?.toString(),
        trailCommission: null,
        exitLoad: baseData.exitLoad?.toString(),
        exitLoadPeriod: baseData.exitLoadPeriod,
        minimumInvestment: baseData.minimumInvestment?.toString(),
        lockInPeriod: baseData.lockInPeriod,
        riskLevel: baseData.riskLevel,
        expectedReturns: baseData.returns1y?.toString(),
        provider: baseData.fundHouse,
        features: baseData.features,
        regulatory: {
          returns1y: baseData.returns1y,
          returns3y: baseData.returns3y,
          returns5y: baseData.returns5y,
          nav: baseData.nav,
        },
        isActive: baseData.isActive,
        isFeatured: baseData.isFeatured,
        visibleToClients: true,
        visibleToPartners: true,
        visibleToAgents: true,
        visibleToGuests: false,
      }).returning();
      results.push({ planType: 'direct', fund: directFund, status: 'created' });
    } else {
      results.push({ planType: 'direct', status: 'already_exists' });
    }
    
    const regularSuffix = ' - Regular Plan';
    const regularDisplayName = baseData.schemeName.includes('Regular') 
      ? baseData.schemeName 
      : baseData.schemeName + regularSuffix;
    
    const existingRegular = await db.select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.schemeCode, baseData.schemeCode),
          eq(storeProducts.planType, 'regular')
        )
      )
      .limit(1);
    
    if (existingRegular.length === 0) {
      const [regularFund] = await db.insert(storeProducts).values({
        name: regularDisplayName,
        shortDescription: `${baseData.fundHouse} - REGULAR Plan`,
        fullDescription: baseData.fullDescription,
        categoryId: baseData.categoryId,
        productType: 'mutual_fund',
        planType: 'regular',
        schemeCode: baseData.schemeCode,
        amfiCode: baseData.amfiCode,
        isinCode: baseData.isinCode,
        price: baseData.nav?.toString(),
        expenseRatio: (regularExpenseRatio || baseData.expenseRatio)?.toString(),
        trailCommission: regularTrailCommission?.toString(),
        exitLoad: baseData.exitLoad?.toString(),
        exitLoadPeriod: baseData.exitLoadPeriod,
        minimumInvestment: baseData.minimumInvestment?.toString(),
        lockInPeriod: baseData.lockInPeriod,
        riskLevel: baseData.riskLevel,
        expectedReturns: baseData.returns1y?.toString(),
        provider: baseData.fundHouse,
        features: baseData.features,
        regulatory: {
          returns1y: baseData.returns1y,
          returns3y: baseData.returns3y,
          returns5y: baseData.returns5y,
          nav: baseData.nav,
        },
        isActive: baseData.isActive,
        isFeatured: baseData.isFeatured,
        visibleToClients: true,
        visibleToPartners: true,
        visibleToAgents: true,
        visibleToGuests: true,
      }).returning();
      results.push({ planType: 'regular', fund: regularFund, status: 'created' });
    } else {
      results.push({ planType: 'regular', status: 'already_exists' });
    }
    
    res.json({
      success: true,
      message: 'Mutual fund plans processed',
      results
    });
  } catch (error: any) {
    console.error("[Admin MF] Error seeding both plans:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/mutual-funds/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ── SEBI/AMFI upfront commission ban ────────────────────────────────────
    const commissionError = enforceCommissionCompliance(updateData);
    if (commissionError) {
      return res.status(422).json({ success: false, error: commissionError, regulatoryViolation: true });
    }

    const [updatedFund] = await db.update(storeProducts)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(storeProducts.id, id))
      .returning();
    
    if (!updatedFund) {
      return res.status(404).json({ success: false, error: 'Fund not found' });
    }
    
    res.json({ success: true, fund: updatedFund });
  } catch (error: any) {
    console.error("[Admin MF] Error updating mutual fund:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/mutual-funds/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [deletedFund] = await db.delete(storeProducts)
      .where(eq(storeProducts.id, id))
      .returning();
    
    if (!deletedFund) {
      return res.status(404).json({ success: false, error: 'Fund not found' });
    }
    
    res.json({ success: true, message: 'Fund deleted successfully' });
  } catch (error: any) {
    console.error("[Admin MF] Error deleting mutual fund:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await db.select().from(storeCategories).orderBy(storeCategories.displayOrder);
    res.json({ success: true, categories });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching categories:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/categories/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateCategoryToggleSchema.parse(req.body);
    
    const updateFields: any = { updatedAt: new Date() };
    
    if (data.isEnabled !== undefined) updateFields.isEnabled = data.isEnabled;
    if (data.directFundsEnabled !== undefined) updateFields.directFundsEnabled = data.directFundsEnabled;
    if (data.comingSoonMessage !== undefined) updateFields.comingSoonMessage = data.comingSoonMessage;
    if (data.comingSoonExpectedDate !== undefined) updateFields.comingSoonExpectedDate = data.comingSoonExpectedDate;
    
    const [updatedCategory] = await db.update(storeCategories)
      .set(updateFields)
      .where(eq(storeCategories.id, id))
      .returning();
    
    if (!updatedCategory) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    res.json({ success: true, category: updatedCategory });
  } catch (error: any) {
    console.error("[Admin MF] Error updating category toggle:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/source-funds", async (req: Request, res: Response) => {
  try {
    const { search, limit = '50' } = req.query;
    
    let query = db.select().from(mutualFunds);
    
    if (search) {
      query = query.where(
        or(
          ilike(mutualFunds.schemeName, `%${search}%`),
          ilike(mutualFunds.fundHouse, `%${search}%`),
          ilike(mutualFunds.schemeCode, `%${search}%`)
        )
      ) as any;
    }
    
    const funds = await query.limit(parseInt(limit as string));
    
    res.json({ success: true, funds });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching source funds:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/fund-search", async (req: Request, res: Response) => {
  try {
    const { q, limit = '20' } = req.query;
    
    if (!q || String(q).length < 2) {
      return res.json({ success: true, funds: [] });
    }
    
    const searchPattern = `%${String(q).toLowerCase()}%`;
    
    const funds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      fundHouse: mutualFunds.fundHouse,
      category: mutualFunds.category,
      nav: mutualFunds.nav,
      planType: mutualFunds.planType,
      extendedData: mutualFunds.extendedData
    })
    .from(mutualFunds)
    .where(
      or(
        sql`LOWER(${mutualFunds.schemeName}) LIKE ${searchPattern}`,
        sql`LOWER(${mutualFunds.fundHouse}) LIKE ${searchPattern}`,
        sql`${mutualFunds.extendedData}->>'isin' LIKE ${searchPattern.toUpperCase()}`
      )
    )
    .limit(parseInt(limit as string));
    
    const results = funds.map(fund => ({
      schemeCode: fund.schemeCode,
      schemeName: fund.schemeName,
      fundHouse: fund.fundHouse || '',
      category: fund.category || '',
      nav: parseFloat(fund.nav || '0'),
      planType: fund.planType || 'Regular',
      isin: (fund.extendedData as any)?.isin || ''
    }));
    
    res.json({ success: true, funds: results });
  } catch (error: any) {
    console.error("[Admin MF] Error searching funds:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/fund-by-isin/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    if (!isin || isin.length !== 12) {
      return res.status(400).json({ success: false, error: 'Invalid ISIN format' });
    }
    
    const funds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      fundHouse: mutualFunds.fundHouse,
      category: mutualFunds.category,
      nav: mutualFunds.nav,
      planType: mutualFunds.planType,
      extendedData: mutualFunds.extendedData
    })
    .from(mutualFunds)
    .where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
    .limit(1);
    
    if (funds.length === 0) {
      return res.status(404).json({ success: false, error: 'Fund not found' });
    }
    
    const fund = funds[0];
    res.json({
      success: true,
      fund: {
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse || '',
        category: fund.category || '',
        nav: parseFloat(fund.nav || '0'),
        planType: fund.planType || 'Regular',
        isin: (fund.extendedData as any)?.isin || ''
      }
    });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching fund by ISIN:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/advisory-subscriptions", async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    let conditions: any[] = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(advisorySubscriptions.status, status as string));
    }
    
    const query = conditions.length > 0
      ? db.select().from(advisorySubscriptions).where(and(...conditions))
      : db.select().from(advisorySubscriptions);
    
    const subscriptions = await query
      .orderBy(desc(advisorySubscriptions.createdAt))
      .limit(limitNum)
      .offset(offset);
    
    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(advisorySubscriptions).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)` }).from(advisorySubscriptions);
    
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);
    
    res.json({
      success: true,
      subscriptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching advisory subscriptions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/advisory-subscriptions", async (req: Request, res: Response) => {
  try {
    const { userId, planName, planType, startDate, endDate, subscriptionFee, feeFrequency, notes, enrolledBy, enrolledByRole } = req.body;
    
    const existingActive = await db.select()
      .from(advisorySubscriptions)
      .where(
        and(
          eq(advisorySubscriptions.userId, userId),
          eq(advisorySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    if (existingActive.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has an active advisory subscription'
      });
    }
    
    const [subscription] = await db.insert(advisorySubscriptions).values({
      userId,
      planName,
      planType,
      startDate,
      endDate,
      subscriptionFee: subscriptionFee?.toString(),
      feeFrequency,
      notes,
      enrolledBy,
      enrolledByRole,
      directFundsAccess: true,
      status: 'active',
    }).returning();
    
    res.json({ success: true, subscription });
  } catch (error: any) {
    console.error("[Admin MF] Error creating advisory subscription:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/advisory-subscriptions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const [updated] = await db.update(advisorySubscriptions)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(advisorySubscriptions.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    res.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error("[Admin MF] Error updating advisory subscription:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/advisory-subscriptions/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const [cancelled] = await db.update(advisorySubscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(advisorySubscriptions.id, id))
      .returning();
    
    if (!cancelled) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    res.json({ success: true, subscription: cancelled });
  } catch (error: any) {
    console.error("[Admin MF] Error cancelling advisory subscription:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
