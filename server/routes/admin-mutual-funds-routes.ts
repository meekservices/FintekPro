import { Router, Request, Response } from "express";
import { db } from "../db";
import { storeProducts, storeCategories, advisorySubscriptions, mutualFunds, mutualFundAmcs } from "@shared/schema";
import { eq, and, or, like, desc, asc, sql, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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
      return res.status(400).json({ success: false, error: error.errors });
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
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/mutual-funds/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
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

router.get("/check-advisory/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const activeSubscription = await db.select()
      .from(advisorySubscriptions)
      .where(
        and(
          eq(advisorySubscriptions.userId, userId),
          eq(advisorySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    const hasAdvisory = activeSubscription.length > 0;
    const subscription = hasAdvisory ? activeSubscription[0] : null;
    
    res.json({
      success: true,
      hasAdvisorySubscription: hasAdvisory,
      subscription,
      directFundsAccess: hasAdvisory && subscription?.directFundsAccess
    });
  } catch (error: any) {
    console.error("[Admin MF] Error checking advisory subscription:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// AMC (Asset Management Company) Level Controls
// =============================================

// Get all AMCs with scheme counts
router.get("/amcs", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    // Get AMCs with their scheme counts
    const amcs = await db.select().from(mutualFundAmcs).orderBy(desc(mutualFundAmcs.totalSchemes));
    
    // If search provided, filter
    let filteredAmcs = amcs;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredAmcs = amcs.filter(amc => 
        amc.name?.toLowerCase().includes(searchLower) ||
        amc.displayName?.toLowerCase().includes(searchLower)
      );
    }
    
    // Get actual counts from mutual_funds table for each AMC
    const amcsWithCounts = await Promise.all(filteredAmcs.map(async (amc) => {
      const totalResult = await db.select({ count: sql<number>`count(*)` })
        .from(mutualFunds)
        .where(eq(mutualFunds.fundHouse, amc.name));
      
      const publishedResult = await db.select({ count: sql<number>`count(*)` })
        .from(mutualFunds)
        .where(and(
          eq(mutualFunds.fundHouse, amc.name),
          eq(mutualFunds.isPublished, true),
          eq(mutualFunds.planType, 'regular')
        ));
      
      return {
        ...amc,
        totalSchemes: Number(totalResult[0]?.count || 0),
        publishedRegularSchemes: Number(publishedResult[0]?.count || 0),
      };
    }));
    
    res.json({ success: true, amcs: amcsWithCounts });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching AMCs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle AMC regular plans (bulk publish/unpublish)
router.put("/amcs/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { regularPlansEnabled, adminId } = req.body;
    
    // Get AMC info
    const [amc] = await db.select().from(mutualFundAmcs).where(eq(mutualFundAmcs.id, id));
    if (!amc) {
      return res.status(404).json({ success: false, error: 'AMC not found' });
    }
    
    // Update all Regular schemes from this AMC
    const publishedAt = regularPlansEnabled ? new Date() : null;
    
    await db.update(mutualFunds)
      .set({
        isPublished: regularPlansEnabled,
        publishedAt: publishedAt,
        publishedBy: regularPlansEnabled ? adminId : null,
      })
      .where(and(
        eq(mutualFunds.fundHouse, amc.name),
        eq(mutualFunds.planType, 'regular')
      ));
    
    // Update AMC toggle status
    const [updatedAmc] = await db.update(mutualFundAmcs)
      .set({
        regularPlansEnabled,
        lastToggledAt: new Date(),
        lastToggledBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(mutualFundAmcs.id, id))
      .returning();
    
    // Get updated count
    const publishedResult = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(and(
        eq(mutualFunds.fundHouse, amc.name),
        eq(mutualFunds.isPublished, true),
        eq(mutualFunds.planType, 'regular')
      ));
    
    console.log(`[Admin MF] AMC ${amc.name} Regular plans ${regularPlansEnabled ? 'ENABLED' : 'DISABLED'} by ${adminId}`);
    
    res.json({ 
      success: true, 
      amc: {
        ...updatedAmc,
        publishedRegularSchemes: Number(publishedResult[0]?.count || 0),
      },
      message: `${regularPlansEnabled ? 'Published' : 'Unpublished'} all Regular schemes for ${amc.name}`
    });
  } catch (error: any) {
    console.error("[Admin MF] Error toggling AMC:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch toggle AMCs (bulk enable/disable multiple AMCs)
router.put("/amcs/batch-toggle", async (req: Request, res: Response) => {
  try {
    const { amcIds, regularPlansEnabled, adminId } = req.body;
    
    if (!amcIds || !Array.isArray(amcIds) || amcIds.length === 0) {
      return res.status(400).json({ success: false, error: 'amcIds array is required' });
    }
    
    const publishedAt = regularPlansEnabled ? new Date() : null;
    let updatedCount = 0;
    const updatedAmcNames: string[] = [];
    
    // Process each AMC
    for (const amcId of amcIds) {
      const [amc] = await db.select().from(mutualFundAmcs).where(eq(mutualFundAmcs.id, amcId));
      if (!amc) continue;
      
      // Update all Regular schemes from this AMC
      await db.update(mutualFunds)
        .set({
          isPublished: regularPlansEnabled,
          publishedAt: publishedAt,
          publishedBy: regularPlansEnabled ? adminId : null,
        })
        .where(and(
          eq(mutualFunds.fundHouse, amc.name),
          eq(mutualFunds.planType, 'regular')
        ));
      
      // Update AMC toggle status
      await db.update(mutualFundAmcs)
        .set({
          regularPlansEnabled,
          lastToggledAt: new Date(),
          lastToggledBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(mutualFundAmcs.id, amcId));
      
      updatedCount++;
      updatedAmcNames.push(amc.name);
    }
    
    console.log(`[Admin MF] Batch ${regularPlansEnabled ? 'ENABLED' : 'DISABLED'} ${updatedCount} AMCs by ${adminId}: ${updatedAmcNames.join(', ')}`);
    
    res.json({ 
      success: true, 
      updatedCount,
      message: `${regularPlansEnabled ? 'Enabled' : 'Disabled'} ${updatedCount} AMC(s) successfully`
    });
  } catch (error: any) {
    console.error("[Admin MF] Error batch toggling AMCs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get schemes for a specific AMC (Regular plans only)
router.get("/amcs/:id/schemes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { search, published, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Get AMC info
    const [amc] = await db.select().from(mutualFundAmcs).where(eq(mutualFundAmcs.id, id));
    if (!amc) {
      return res.status(404).json({ success: false, error: 'AMC not found' });
    }
    
    // Build conditions
    let conditions: any[] = [
      eq(mutualFunds.fundHouse, amc.name),
      eq(mutualFunds.planType, 'regular')
    ];
    
    if (published === 'true') {
      conditions.push(eq(mutualFunds.isPublished, true));
    } else if (published === 'false') {
      conditions.push(eq(mutualFunds.isPublished, false));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(mutualFunds.schemeName, `%${search}%`),
          ilike(mutualFunds.schemeCode, `%${search}%`),
          ilike(mutualFunds.category, `%${search}%`)
        )
      );
    }
    
    const schemes = await db.select()
      .from(mutualFunds)
      .where(and(...conditions))
      .orderBy(asc(mutualFunds.schemeName))
      .limit(limitNum)
      .offset(offset);
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(and(...conditions));
    
    res.json({
      success: true,
      amc,
      schemes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum)
      }
    });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching AMC schemes:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all Regular schemes with filters (for scheme-level table)
router.get("/regular-schemes", async (req: Request, res: Response) => {
  try {
    const { amcId, search, published, category, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Base condition: Regular plans only
    let conditions: any[] = [eq(mutualFunds.planType, 'regular')];
    
    // Filter by AMC
    if (amcId) {
      const [amc] = await db.select().from(mutualFundAmcs).where(eq(mutualFundAmcs.id, amcId as string));
      if (amc) {
        conditions.push(eq(mutualFunds.fundHouse, amc.name));
      }
    }
    
    // Filter by published status
    if (published === 'true') {
      conditions.push(eq(mutualFunds.isPublished, true));
    } else if (published === 'false') {
      conditions.push(eq(mutualFunds.isPublished, false));
    }
    
    // Filter by category
    if (category) {
      conditions.push(ilike(mutualFunds.category, `%${category}%`));
    }
    
    // Search
    if (search) {
      conditions.push(
        or(
          ilike(mutualFunds.schemeName, `%${search}%`),
          ilike(mutualFunds.schemeCode, `%${search}%`),
          ilike(mutualFunds.fundHouse, `%${search}%`)
        )
      );
    }
    
    const schemes = await db.select()
      .from(mutualFunds)
      .where(and(...conditions))
      .orderBy(asc(mutualFunds.schemeName))
      .limit(limitNum)
      .offset(offset);
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(and(...conditions));
    
    res.json({
      success: true,
      schemes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum)
      }
    });
  } catch (error: any) {
    console.error("[Admin MF] Error fetching regular schemes:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish/Unpublish individual scheme
router.put("/schemes/:schemeCode/publish", async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const { isPublished, adminId } = req.body;
    
    // Get scheme info
    const [scheme] = await db.select()
      .from(mutualFunds)
      .where(eq(mutualFunds.schemeCode, schemeCode));
    
    if (!scheme) {
      return res.status(404).json({ success: false, error: 'Scheme not found' });
    }
    
    // Check if AMC toggle is ON (required for individual publish)
    if (isPublished && scheme.fundHouse) {
      const [amc] = await db.select()
        .from(mutualFundAmcs)
        .where(eq(mutualFundAmcs.name, scheme.fundHouse));
      
      if (amc && !amc.regularPlansEnabled) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot publish scheme when AMC toggle is OFF. Enable the AMC first.' 
        });
      }
    }
    
    // Update scheme
    const [updated] = await db.update(mutualFunds)
      .set({
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        publishedBy: isPublished ? adminId : null,
      })
      .where(eq(mutualFunds.schemeCode, schemeCode))
      .returning();
    
    console.log(`[Admin MF] Scheme ${schemeCode} ${isPublished ? 'PUBLISHED' : 'UNPUBLISHED'} by ${adminId}`);
    
    res.json({ 
      success: true, 
      scheme: updated,
      message: `Scheme ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error: any) {
    console.error("[Admin MF] Error updating scheme publish status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check for missing AMCs (not yet synced to mutual_fund_amcs)
router.get("/amcs/missing", async (req: Request, res: Response) => {
  try {
    // Get all distinct fund houses from mutual_funds
    const fundHousesInMutualFunds = await db.select({
      fundHouse: mutualFunds.fundHouse,
      schemeCount: sql<number>`count(*)`
    })
      .from(mutualFunds)
      .where(sql`fund_house IS NOT NULL AND fund_house != ''`)
      .groupBy(mutualFunds.fundHouse);
    
    // Get all AMCs already in mutual_fund_amcs
    const existingAmcs = await db.select({ name: mutualFundAmcs.name }).from(mutualFundAmcs);
    const existingAmcNames = new Set(existingAmcs.map(a => a.name));
    
    // Find missing AMCs
    const missingAmcs = fundHousesInMutualFunds.filter(fh => 
      fh.fundHouse && !existingAmcNames.has(fh.fundHouse)
    );
    
    res.json({
      success: true,
      missingCount: missingAmcs.length,
      missingAmcs: missingAmcs.map(a => ({
        name: a.fundHouse,
        schemeCount: Number(a.schemeCount)
      })),
      totalInDatabase: fundHousesInMutualFunds.length,
      totalSynced: existingAmcs.length
    });
  } catch (error: any) {
    console.error("[Admin MF] Error checking missing AMCs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync AMC list from mutual_funds table (admin utility)
router.post("/amcs/sync", async (req: Request, res: Response) => {
  try {
    // Get distinct fund houses from mutual_funds
    const fundHouses = await db.select({
      fundHouse: mutualFunds.fundHouse,
      count: sql<number>`count(*)`
    })
      .from(mutualFunds)
      .where(sql`fund_house IS NOT NULL AND fund_house != ''`)
      .groupBy(mutualFunds.fundHouse);
    
    let created = 0;
    let updated = 0;
    const newAmcs: string[] = [];
    
    for (const fh of fundHouses) {
      if (!fh.fundHouse) continue;
      
      const existing = await db.select().from(mutualFundAmcs).where(eq(mutualFundAmcs.name, fh.fundHouse));
      
      if (existing.length === 0) {
        await db.insert(mutualFundAmcs).values({
          name: fh.fundHouse,
          displayName: fh.fundHouse,
          totalSchemes: Number(fh.count),
        });
        created++;
        newAmcs.push(fh.fundHouse);
      } else {
        await db.update(mutualFundAmcs)
          .set({ totalSchemes: Number(fh.count), updatedAt: new Date() })
          .where(eq(mutualFundAmcs.name, fh.fundHouse));
        updated++;
      }
    }
    
    console.log(`[Admin MF] AMC Sync complete: ${created} created, ${updated} updated`);
    if (newAmcs.length > 0) {
      console.log(`[Admin MF] New AMCs added: ${newAmcs.join(', ')}`);
    }
    
    res.json({ 
      success: true, 
      message: `Synced AMCs: ${created} new, ${updated} updated`,
      total: fundHouses.length,
      created,
      updated,
      newAmcs
    });
  } catch (error: any) {
    console.error("[Admin MF] Error syncing AMCs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AMFI Data Import Endpoints
router.post("/amfi-import", async (req: Request, res: Response) => {
  try {
    const { amfiImportService } = await import('../services/amfi-import-service');
    
    const currentProgress = amfiImportService.getImportProgress();
    if (currentProgress.status === 'fetching' || currentProgress.status === 'parsing' || currentProgress.status === 'importing') {
      return res.status(409).json({
        success: false,
        error: 'Import already in progress',
        progress: currentProgress,
      });
    }
    
    res.json({
      success: true,
      message: 'AMFI import started',
    });
    
    amfiImportService.importAmfiData().then((result) => {
      console.log('[Admin MF] AMFI Import completed:', result);
    }).catch((error) => {
      console.error('[Admin MF] AMFI Import failed:', error);
    });
    
  } catch (error: any) {
    console.error("[Admin MF] Error starting AMFI import:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/amfi-import/progress", async (req: Request, res: Response) => {
  try {
    const { amfiImportService } = await import('../services/amfi-import-service');
    const progress = amfiImportService.getImportProgress();
    res.json({ success: true, progress });
  } catch (error: any) {
    console.error("[Admin MF] Error getting import progress:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
