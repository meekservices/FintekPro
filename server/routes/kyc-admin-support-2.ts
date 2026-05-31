// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, desc, gte, lte, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import * as schema from '../../shared/schema';
import { advisorySubscriptions, storeProductInquiries, storeTransactionLogs } from '../../shared/schema';
import { complianceMonitor } from '../compliance-monitor';

export function registerKYCAdminSupporPart2Routes(app: Express): void {
app.post('/api/admin/kyc/manual-submissions/:id/review', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, notes, rejectionReason } = req.body;

    if (!['approved', 'rejected', 'requires_clarification'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await storage.reviewManualKycSubmission(
      id,
      req.user!.id,
      status,
      notes,
      rejectionReason
    );

    if (!updated) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Log compliance event
    complianceMonitor.logEvent({
      userId: req.user!.id,
      eventType: 'admin_action' as any,
      category: 'kyc_compliance',
      action: `Manual KYC ${status}`,
      resource: `/api/admin/kyc/manual-submissions/${id}/review`,
      status: 'success',
      metadata: {
        submissionId: id,
        reviewStatus: status,
        reviewedBy: req.user!.id
      }
    });

    res.json({
      success: true,
      message: `Submission ${status} successfully`,
      submission: updated
    });
  } catch (error) {
    console.error('Error reviewing manual KYC submission:', error);
    res.status(500).json({ message: 'Failed to review submission' });
  }
});

// Batch KYC approval endpoint
app.post('/api/admin/kyc/batch-approve', requireAdmin, async (req: any, res) => {
  try {
    const { ids, notes } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No submission IDs provided' });
    }

    const results = { success: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        const updated = await storage.reviewManualKycSubmission(id, req.user!.id, 'approved', notes || 'Batch approved', null);
        if (updated) {
          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    const logStatus = results.failed.length === 0 ? 'success' : 
                      results.success.length === 0 ? 'failure' : 'partial_success';

    complianceMonitor.logEvent({
      userId: req.user!.id,
      eventType: 'admin_action' as any,
      category: 'kyc_compliance',
      action: 'Batch KYC Approval',
      resource: '/api/admin/kyc/batch-approve',
      status: logStatus,
      metadata: {
        approvedCount: results.success.length,
        failedCount: results.failed.length,
        successIds: results.success,
        failedIds: results.failed
      }
    });

    const allFailed = results.success.length === 0;
    res.status(allFailed ? 400 : 200).json({
      success: !allFailed,
      message: allFailed 
        ? 'All submissions failed to approve' 
        : `Batch approved ${results.success.length} submissions${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      results
    });
  } catch (error) {
    console.error('Error batch approving KYC:', error);
    res.status(500).json({ message: 'Failed to batch approve' });
  }
});

// Batch KYC rejection endpoint
app.post('/api/admin/kyc/batch-reject', requireAdmin, async (req: any, res) => {
  try {
    const { ids, reason } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No submission IDs provided' });
    }

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const results = { success: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        const updated = await storage.reviewManualKycSubmission(id, req.user!.id, 'rejected', null, reason);
        if (updated) {
          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    const logStatus = results.failed.length === 0 ? 'success' : 
                      results.success.length === 0 ? 'failure' : 'partial_success';

    complianceMonitor.logEvent({
      userId: req.user!.id,
      eventType: 'admin_action' as any,
      category: 'kyc_compliance',
      action: 'Batch KYC Rejection',
      resource: '/api/admin/kyc/batch-reject',
      status: logStatus,
      metadata: {
        rejectedCount: results.success.length,
        failedCount: results.failed.length,
        reason,
        successIds: results.success,
        failedIds: results.failed
      }
    });

    const allFailed = results.success.length === 0;
    res.status(allFailed ? 400 : 200).json({
      success: !allFailed,
      message: allFailed 
        ? 'All submissions failed to reject' 
        : `Batch rejected ${results.success.length} submissions${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      results
    });
  } catch (error) {
    console.error('Error batch rejecting KYC:', error);
    res.status(500).json({ message: 'Failed to batch reject' });
  }
});

// Batch export KYC data
app.post('/api/admin/kyc/batch-export', requireAdmin, async (req: any, res) => {
  try {
    const { ids, format = 'json' } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No submission IDs provided' });
    }

    const submissions = await storage.getManualKycSubmission({ status: 'all', limit: 1000 });
    const selectedSubmissions = submissions.filter((s: any) => ids.includes(s.id));

    if (format === 'csv') {
      const headers = ['ID', 'User', 'Email', 'Type', 'Tier', 'Status', 'Submitted At'];
      const rows = selectedSubmissions.map((s: any) => [
        s.id,
        s.userName || 'N/A',
        s.userEmail || 'N/A',
        s.applicantType || 'N/A',
        s.tier || 'N/A',
        s.status || 'N/A',
        s.createdAt || 'N/A'
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=kyc_export.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: selectedSubmissions,
      count: selectedSubmissions.length
    });
  } catch (error) {
    console.error('Error batch exporting KYC:', error);
    res.status(500).json({ message: 'Failed to export' });
  }
});


// ===================================================================
// PUBLIC STORE ROUTES (Client-facing - No Auth Required)
// ===================================================================

// Get active store categories for client store page (includes PMS/AIF)
app.get('/api/store/categories', async (req, res) => {
  try {
    const allCategories = await storage.getAllStoreCategories();
    const allSubcategories = await storage.getAllStoreSubcategories();
    
    // Add virtual PMS and AIF categories if not already in store categories
    const categoryNames = new Set(allCategories.map(c => c.name.toLowerCase()));
    const virtualCategories: any[] = [];
    
    if (!categoryNames.has('pms') && !categoryNames.has('portfolio management services')) {
      virtualCategories.push({
        id: 'virtual-pms',
        name: 'Portfolio Management Services (PMS)',
        slug: 'pms',
        description: 'SEBI-registered discretionary portfolio management',
        icon: 'Briefcase',
        displayOrder: 100,
        isActive: true,
        isEnabled: true,
        comingSoonMessage: null,
        subcategories: []
      });
    }
    
    if (!categoryNames.has('aif') && !categoryNames.has('alternative investment funds')) {
      virtualCategories.push({
        id: 'virtual-aif',
        name: 'Alternative Investment Funds (AIF)',
        slug: 'aif',
        description: 'SEBI-regulated alternative investment vehicles',
        icon: 'Crown',
        displayOrder: 101,
        isActive: true,
        isEnabled: true,
        comingSoonMessage: null,
        subcategories: []
      });
    }

    // ── Virtual: IRIS Mutual Funds (live KFintech schemes) ──────────────────
    if (!categoryNames.has('mutual funds') && !categoryNames.has('iris mutual funds')) {
      const { irisKfintechService } = await import('../services/iris-kfintech-service');
      if (irisKfintechService.isConfigured) {
        virtualCategories.push({
          id: 'virtual-iris-mf',
          name: 'Mutual Funds',
          slug: 'mutual-funds',
          description: 'Live mutual fund schemes via IRIS KFintech — top performers & NFOs',
          icon: 'TrendingUp',
          displayOrder: 1,
          isActive: true,
          isEnabled: true,
          comingSoonMessage: null,
          providerSource: 'IRIS',
          subcategories: [
            { id: 'iris-mf-top', name: 'Top Performers', description: 'Highest 1Y returns' },
            { id: 'iris-mf-nfo', name: 'New Fund Offers', description: 'Currently open for subscription' },
          ],
        });
      }
    }

    // ── Virtual: Alpaca US Equities & ETFs ───────────────────────────────────
    if (!categoryNames.has('us equities') && !categoryNames.has('us equities & etfs')) {
      const { alpacaBrokerService } = await import('../services/alpaca-broker-service');
      if (alpacaBrokerService.isConfigured()) {
        virtualCategories.push({
          id: 'virtual-alpaca-us',
          name: 'US Equities & ETFs',
          slug: 'us-equities',
          description: 'US stocks, index ETFs & fractional shares via Alpaca',
          icon: 'Globe',
          displayOrder: 50,
          isActive: true,
          isEnabled: true,
          comingSoonMessage: null,
          providerSource: 'ALPACA',
          subcategories: [
            { id: 'alpaca-etf',   name: 'Index ETFs',    description: 'Broad market index funds' },
            { id: 'alpaca-stock', name: 'US Stocks',     description: 'Individual US equities' },
          ],
        });
      }
    }
    
    // Combine real and virtual categories
    const combinedCategories = [...allCategories, ...virtualCategories];
    
    // Build response with Coming Soon info for disabled categories
    const categoriesWithSubs = combinedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      displayOrder: cat.displayOrder,
      isActive: cat.isActive,
      isEnabled: cat.isEnabled !== false, // Default to enabled
      comingSoonMessage: cat.comingSoonMessage,
      comingSoonExpectedDate: cat.comingSoonExpectedDate,
      subcategories: allSubcategories
        .filter(sub => sub.categoryId === cat.id && sub.isActive)
        .map(sub => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          icon: sub.icon,
          displayOrder: sub.displayOrder,
        })),
    }));

    // Sort by display order
    categoriesWithSubs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    res.json({ 
      success: true,
      categories: categoriesWithSubs 
    });
  } catch (error) {
    console.error('Error fetching public store categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Get active store products for client store page
app.get('/api/store/products', async (req: any, res: any) => {
  try {
    const { category, subcategory } = req.query;
    
    const allProducts = await storage.getAllStoreProducts();
    const allCategories = await storage.getAllStoreCategories();
    const allSubcategories = await storage.getAllStoreSubcategories();
    
    // Build lookup maps for active status
    const activeCategoryIds = new Set(allCategories.filter(c => c.isActive).map(c => c.id));
    const activeSubcategoryIds = new Set(allSubcategories.filter(s => s.isActive).map(s => s.id));
    
    // Filter to only active products with active parents
    let activeProducts = allProducts.filter(product => {
      if (!product.isActive) return false;
      if (!activeCategoryIds.has(product.categoryId)) return false;
      if (product.subcategoryId && !activeSubcategoryIds.has(product.subcategoryId)) return false;
      return true;
    });
    
    // Apply optional filters
    if (category) {
      activeProducts = activeProducts.filter(p => p.categoryId === category);
    }
    if (subcategory) {
      activeProducts = activeProducts.filter(p => p.subcategoryId === subcategory);
    }
    
    // Visibility gating for Direct funds based on advisory subscription
    let hasDirectFundsAccess = false;
    if (req.user?.id) {
      try {
        const userAdvisory = await db.select()
          .from(advisorySubscriptions)
          .where(
            and(
              eq(advisorySubscriptions.userId, req.user!.id),
              eq(advisorySubscriptions.status, "active")
            )
          )
          .limit(1);
        hasDirectFundsAccess = userAdvisory.length > 0 && userAdvisory[0]?.directFundsAccess;
      } catch (e: any) {
        console.error("Error checking advisory subscription:", e);
      }
    }
    
    // Filter out Direct funds for users without advisory subscription
    if (!hasDirectFundsAccess) {
      activeProducts = activeProducts.filter(p => p.planType !== "direct");
    }

    
    // Get category and subcategory names for each product
    const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
    const subcategoryMap = Object.fromEntries(allSubcategories.map(s => [s.id, s.name]));
    
    const productsWithNames = activeProducts.map(product => ({
      ...product,
      categoryName: categoryMap[product.categoryId] || product.categoryId,
      subcategoryName: product.subcategoryId ? (subcategoryMap[product.subcategoryId] || product.subcategoryId) : null,
    }));

    // Merge AIF and PMS products from master tables
    let mergedProducts = [...productsWithNames];
    
    // Add AIF products if AIF category is requested or all products
    if (!category || category === 'aif' || category === 'AIF') {
      try {
        const aifProducts = await db.select().from(schema.aifMaster).where(and(eq(schema.aifMaster.fundStatus, 'active'), eq(schema.aifMaster.isPublished, true)));
        const aifMerged = aifProducts.map(aif => ({
          id: `aif-${aif.id}`,
          name: aif.name,
          shortDescription: aif.description || aif.investmentObjective || '',
          description: aif.description,
          categoryId: 'aif',
          categoryName: 'AIF',
          subcategoryId: aif.category?.toLowerCase() || 'category-iii',
          subcategoryName: aif.category || 'Category III',
          productType: 'aif',
          planType: 'regular',
          provider: aif.fundHouseName || aif.sponsor || '',
          minimumInvestment: parseFloat(aif.minInvestment?.toString() || '0') || 10000000,
          expectedReturns: parseFloat(aif.return1Y?.toString() || '0'),
          riskLevel: aif.riskScore && aif.riskScore >= 7 ? 'high' : 'moderate',
          features: [],
          isActive: true,
          isFeatured: false,
          isPremium: true,
          kycProductCode: 'ACCREDITED_AIF',
          sourceTable: 'aif_master',
          sourceId: aif.id,
        }));
        mergedProducts = [...mergedProducts, ...aifMerged];
      } catch (e) {
        console.warn('[Store Products] Error fetching AIF products:', e);
      }
    }
    
    // Add PMS products if PMS category is requested or all products
    if (!category || category === 'pms' || category === 'PMS') {
      try {
        const pmsProducts = await db.select().from(schema.pmsMaster).where(and(eq(schema.pmsMaster.fundStatus, 'active'), eq(schema.pmsMaster.isPublished, true)));
        const pmsMerged = pmsProducts.map(pms => ({
          id: `pms-${pms.id}`,
          name: pms.name,
          shortDescription: pms.strategy || pms.description || '',
          description: pms.description,
          categoryId: 'pms',
          categoryName: 'PMS',
          subcategoryId: pms.strategy?.toLowerCase() || 'discretionary',
          subcategoryName: pms.strategy || 'Discretionary',
          productType: 'pms',
          planType: 'regular',
          provider: pms.fundHouseName || pms.sponsor || '',
          minimumInvestment: parseFloat(pms.minInvestment?.toString() || '0') || 5000000,
          expectedReturns: parseFloat(pms.return1Y?.toString() || '0'),
          riskLevel: pms.riskScore && pms.riskScore >= 7 ? 'high' : 'moderate',
          features: [],
          isActive: true,
          isFeatured: false,
          isPremium: true,
          kycProductCode: 'ENHANCED_PMS',
          sourceTable: 'pms_master',
          sourceId: pms.id,
        }));
        mergedProducts = [...mergedProducts, ...pmsMerged];
      } catch (e) {
        console.warn('[Store Products] Error fetching PMS products:', e);
      }
    }

    // ── IRIS Mutual Funds: Top Performers ────────────────────────────────────
    try {
      const { irisKfintechService } = await import('../services/iris-kfintech-service');
      if (irisKfintechService.isConfigured && (!category || ['mutual-funds', 'mutual_funds', 'Mutual Funds', 'virtual-iris-mf'].includes(category as string))) {
        const topSchemes: any = await irisKfintechService.getTopPerformingSchemes({ limit: 20 }).catch(() => ({ schemes: [] }));
        const schemes: any[] = Array.isArray(topSchemes) ? topSchemes : (topSchemes?.schemes ?? []);
        const irisMfProducts = schemes.map((s: any) => ({
          id: `iris-mf-${s.schemeCode ?? s.code ?? s.isin ?? Math.random()}`,
          name: s.schemeName ?? s.name ?? 'Mutual Fund Scheme',
          shortDescription: `${s.category ?? ''} • ${s.subCategory ?? ''} • ${s.amcName ?? ''}`.replace(/^[• ]+|[• ]+$/g, ''),
          description: s.investmentObjective ?? s.schemeName,
          categoryId: 'virtual-iris-mf',
          categoryName: 'Mutual Funds',
          subcategoryId: 'iris-mf-top',
          subcategoryName: 'Top Performers',
          productType: 'mutual_fund',
          planType: (s.planType ?? '').toLowerCase().includes('direct') ? 'direct' : 'regular',
          provider: s.amcName ?? s.fundHouse ?? 'KFintech',
          minimumInvestment: parseFloat(s.minSipAmount ?? s.minPurchaseAmount ?? '500') || 500,
          expectedReturns: parseFloat(s.return1Y ?? s.returns1Y ?? '0') || 0,
          riskLevel: s.riskometer ?? (s.riskScore >= 5 ? 'high' : s.riskScore >= 3 ? 'medium' : 'low'),
          features: [s.category, s.subCategory].filter(Boolean),
          isActive: true,
          isFeatured: true,
          isPremium: false,
          isNew: false,
          badge: undefined,
          kycProductCode: 'BASIC_MF',
          sourceTable: 'iris_live',
          sourceId: s.schemeCode ?? s.code,
          providerSource: 'IRIS' as const,
          providerProductId: s.schemeCode ?? s.isin,
        }));
        mergedProducts = [...mergedProducts, ...irisMfProducts];
      }
    } catch (e) {
      console.warn('[Store Products] IRIS top-performing MF fetch failed (non-fatal):', e);
    }

    // ── IRIS NFO (New Fund Offers) ────────────────────────────────────────────
    try {
      const { irisKfintechService } = await import('../services/iris-kfintech-service');
      if (irisKfintechService.isConfigured && (!category || ['mutual-funds', 'virtual-iris-mf'].includes(category as string))) {
        const nfoData: any = await irisKfintechService.getNfoSchemes().catch(() => []);
        const nfoSchemes: any[] = Array.isArray(nfoData) ? nfoData : (nfoData?.schemes ?? nfoData?.nfos ?? []);
        const irisNfoProducts = nfoSchemes.map((nfo: any) => ({
          id: `iris-nfo-${nfo.schemeCode ?? nfo.code ?? Math.random()}`,
          name: nfo.schemeName ?? nfo.name ?? 'New Fund Offer',
          shortDescription: `NFO • ${nfo.amcName ?? ''} • Open: ${nfo.openDate ?? ''} – ${nfo.closeDate ?? ''}`.replace(/[•\s]+$/g, ''),
          categoryId: 'virtual-iris-mf',
          categoryName: 'Mutual Funds',
          subcategoryId: 'iris-mf-nfo',
          subcategoryName: 'New Fund Offers',
          productType: 'nfo',
          planType: 'regular',
          provider: nfo.amcName ?? 'KFintech',
          minimumInvestment: parseFloat(nfo.minPurchaseAmount ?? '5000') || 5000,
          expectedReturns: 0,
          riskLevel: 'medium',
          features: ['New Fund Offer', nfo.category].filter(Boolean),
          isActive: true,
          isFeatured: false,
          isPremium: false,
          isNew: true,
          badge: 'NEW',
          kycProductCode: 'BASIC_MF',
          sourceTable: 'iris_live',
          sourceId: nfo.schemeCode ?? nfo.code,
          providerSource: 'IRIS' as const,
          providerProductId: nfo.schemeCode ?? nfo.isin,
        }));
        mergedProducts = [...mergedProducts, ...irisNfoProducts];
      }
    } catch (e) {
      console.warn('[Store Products] IRIS NFO fetch failed (non-fatal):', e);
    }

    // ── IRIS Fixed Deposits ───────────────────────────────────────────────────
    try {
      const { irisKfintechService } = await import('../services/iris-kfintech-service');
      if (irisKfintechService.isConfigured && (!category || ['fixed-deposits', 'fixed_deposits', 'Fixed Deposits'].includes(category as string))) {
        const fdData: any = await irisKfintechService.getFixedDepositProducts().catch(() => []);
        const fds: any[] = Array.isArray(fdData) ? fdData : (fdData?.products ?? fdData?.data ?? []);
        const irisFdProducts = fds.map((fd: any) => ({
          id: `iris-fd-${fd.productId ?? fd.id ?? Math.random()}`,
          name: fd.productName ?? fd.name ?? 'Fixed Deposit',
          shortDescription: `${fd.issuerName ?? ''} FD • ${fd.tenure ?? ''} • ${fd.interestRate ?? ''}% p.a.`.replace(/^[•\s]+|[•\s]+$/g, ''),
          categoryId: 'fixed-deposits',
          categoryName: 'Fixed Deposits',
          subcategoryId: undefined,
          subcategoryName: undefined,
          productType: 'fixed_deposit',
          planType: 'regular',
          provider: fd.issuerName ?? fd.companyName ?? 'KFintech',
          minimumInvestment: parseFloat(fd.minimumDeposit ?? fd.minAmount ?? '10000') || 10000,
          expectedReturns: parseFloat(fd.interestRate ?? fd.rate ?? '0') || 0,
          riskLevel: 'low',
          features: [fd.tenure, `${fd.interestRate}% p.a.`, fd.fdType].filter(Boolean),
          isActive: true,
          isFeatured: false,
          isPremium: false,
          isNew: false,
          kycProductCode: 'BASIC_MF',
          sourceTable: 'iris_live',
          sourceId: fd.productId ?? fd.id,
          providerSource: 'IRIS' as const,
          providerProductId: fd.productId ?? fd.isin,
        }));
        mergedProducts = [...mergedProducts, ...irisFdProducts];
      }
    } catch (e) {
      console.warn('[Store Products] IRIS Fixed Deposit fetch failed (non-fatal):', e);
    }

    // ── Alpaca Curated US Equities & ETFs ─────────────────────────────────────
    // Curated list: flagship index ETFs + large-cap US stocks accessible to
    // Indian investors via the LRS (Liberalised Remittance Scheme) route.
    const ALPACA_CURATED_SYMBOLS = [
      // Index ETFs
      { symbol: 'SPY',  name: 'SPDR S&P 500 ETF Trust',         subcategoryId: 'alpaca-etf',   returns: 14.2, minUSD: 1 },
      { symbol: 'QQQ',  name: 'Invesco QQQ (NASDAQ-100)',        subcategoryId: 'alpaca-etf',   returns: 18.5, minUSD: 1 },
      { symbol: 'VTI',  name: 'Vanguard Total Stock Market ETF', subcategoryId: 'alpaca-etf',   returns: 13.8, minUSD: 1 },
      { symbol: 'IVV',  name: 'iShares Core S&P 500 ETF',       subcategoryId: 'alpaca-etf',   returns: 14.1, minUSD: 1 },
      { symbol: 'VOO',  name: 'Vanguard S&P 500 ETF',           subcategoryId: 'alpaca-etf',   returns: 14.0, minUSD: 1 },
      { symbol: 'VEA',  name: 'Vanguard FTSE Developed ETF',    subcategoryId: 'alpaca-etf',   returns: 9.3,  minUSD: 1 },
      { symbol: 'GLD',  name: 'SPDR Gold Shares ETF',           subcategoryId: 'alpaca-etf',   returns: 8.5,  minUSD: 1 },
      { symbol: 'ARKK', name: 'ARK Innovation ETF',             subcategoryId: 'alpaca-etf',   returns: 12.0, minUSD: 1 },
      // Large-cap US Stocks
      { symbol: 'AAPL', name: 'Apple Inc.',                     subcategoryId: 'alpaca-stock', returns: 22.3, minUSD: 1 },
      { symbol: 'MSFT', name: 'Microsoft Corporation',          subcategoryId: 'alpaca-stock', returns: 25.1, minUSD: 1 },
      { symbol: 'GOOGL',name: 'Alphabet Inc. (Google)',         subcategoryId: 'alpaca-stock', returns: 19.8, minUSD: 1 },
      { symbol: 'AMZN', name: 'Amazon.com Inc.',                subcategoryId: 'alpaca-stock', returns: 21.0, minUSD: 1 },
      { symbol: 'NVDA', name: 'NVIDIA Corporation',             subcategoryId: 'alpaca-stock', returns: 65.0, minUSD: 1 },
      { symbol: 'META', name: 'Meta Platforms Inc.',            subcategoryId: 'alpaca-stock', returns: 38.0, minUSD: 1 },
      { symbol: 'TSLA', name: 'Tesla Inc.',                     subcategoryId: 'alpaca-stock', returns: 18.0, minUSD: 1 },
      { symbol: 'BRKA', name: 'Berkshire Hathaway Inc.',        subcategoryId: 'alpaca-stock', returns: 12.0, minUSD: 1 },
    ];
    try {
      const { alpacaBrokerService } = await import('../services/alpaca-broker-service');
      if (alpacaBrokerService.isConfigured() && (!category || ['us-equities', 'US Equities & ETFs', 'virtual-alpaca-us'].includes(category as string))) {
        // Fetch live USD/INR rate — fallback to 84 if unavailable
        let usdInr = 84;
        try {
          const fx = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR').then(r => r.json());
          usdInr = fx?.rates?.INR ?? 84;
        } catch { /* use fallback */ }

        const alpacaProducts = ALPACA_CURATED_SYMBOLS.map(asset => ({
          id: `alpaca-${asset.symbol.toLowerCase()}`,
          name: asset.name,
          shortDescription: `${asset.symbol} • Listed on US markets • Fractional shares available`,
          categoryId: 'virtual-alpaca-us',
          categoryName: 'US Equities & ETFs',
          subcategoryId: asset.subcategoryId,
          subcategoryName: asset.subcategoryId === 'alpaca-etf' ? 'Index ETFs' : 'US Stocks',
          productType: asset.subcategoryId === 'alpaca-etf' ? 'etf' : 'us_equity',
          planType: 'regular',
          provider: 'Alpaca',
          minimumInvestment: Math.ceil(asset.minUSD * usdInr),   // ₹84 minimum (fractional)
          expectedReturns: asset.returns,
          riskLevel: 'high',
          features: ['Fractional shares', 'US market access', 'LRS route', 'Real-time pricing'],
          isActive: true,
          isFeatured: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'].includes(asset.symbol),
          isPremium: false,
          isNew: false,
          badge: ['NVDA', 'META'].includes(asset.symbol) ? 'HOT' : undefined,
          kycProductCode: 'ENHANCED_PMS',  // US equities require enhanced KYC
          sourceTable: 'alpaca_live',
          sourceId: asset.symbol,
          providerSource: 'ALPACA' as const,
          providerProductId: asset.symbol,
        }));
        mergedProducts = [...mergedProducts, ...alpacaProducts];
      }
    } catch (e) {
      console.warn('[Store Products] Alpaca product merge failed (non-fatal):', e);
    }

    res.json({ 
      success: true,
      products: mergedProducts,
      count: mergedProducts.length
    });
  } catch (error) {
    console.error('Error fetching public store products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// Get featured/popular products for store homepage
app.get('/api/store/featured', async (req, res) => {
  try {
    const allProducts = await storage.getAllStoreProducts();
    const allCategories = await storage.getAllStoreCategories();
    const allSubcategories = await storage.getAllStoreSubcategories();
    
    const activeCategoryIds = new Set(allCategories.filter(c => c.isActive).map(c => c.id));
    const activeSubcategoryIds = new Set(allSubcategories.filter(s => s.isActive).map(s => s.id));
    
    // Get active products from active parents
    const activeProducts = allProducts.filter(product => {
      if (!product.isActive) return false;
      if (!activeCategoryIds.has(product.categoryId)) return false;
      if (product.subcategoryId && !activeSubcategoryIds.has(product.subcategoryId)) return false;
      return true;
    });
    
    // Get category names
    const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
    const subcategoryMap = Object.fromEntries(allSubcategories.map(s => [s.id, s.name]));
    
    const productsWithNames = activeProducts.map(product => ({
      ...product,
      categoryName: categoryMap[product.categoryId] || product.categoryId,
      subcategoryName: product.subcategoryId ? (subcategoryMap[product.subcategoryId] || product.subcategoryId) : null,
    }));

    res.json({ 
      success: true,
      featured: productsWithNames.slice(0, 6),
      popular: productsWithNames.slice(0, 10),
      count: productsWithNames.length
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured products' });
  }
});

// Submit product/category inquiry (for Coming Soon or disabled products)
app.post('/api/store/inquiries', async (req: any, res) => {
  try {
    const { categoryId, productId, name, email, phone, message, inquiryType } = req.body;
    
    if (!email || (!categoryId && !productId)) {
      return res.status(400).json({ success: false, message: 'Email and category/product are required' });
    }

    const inquiry = await db.insert(storeProductInquiries).values({
      categoryId,
      productId,
      userId: req.user?.id,
      name: name || req.user?.fullName,
      email: email || req.user?.email,
      phone: phone || req.user?.phone,
      message,
      inquiryType: inquiryType || 'callback',
      status: 'pending',
    } as any).returning();

    // Log transaction for compliance
    const { storeTransactionService } = await import('../services/store-transaction-service');
    await storeTransactionService.logTransaction({
      transactionType: 'inquiry',
      userId: req.user?.id,
      userEmail: email,
      userName: name,
      productCategory: categoryId ? 'category_inquiry' : 'product_inquiry',
      categoryId,
      productId,
      source: 'client_direct',
      status: 'completed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { message, inquiryType }
    });

    res.json({ success: true, inquiry: inquiry[0] });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ success: false, message: 'Failed to submit inquiry' });
  }
});

// Get client transaction history (requires auth)
app.get('/api/client/transactions', requireAuth, async (req: any, res) => {
  try {
    const { category, startDate, endDate, limit, offset } = req.query;
    
    const { storeTransactionService } = await import('../services/store-transaction-service');
    const result = await storeTransactionService.getTransactionsByUser(req.user!.id, {
      category: category as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

// Get client transaction summary by category
app.get('/api/client/transactions/summary', requireAuth, async (req: any, res) => {
  try {
    const { storeTransactionService } = await import('../services/store-transaction-service');
    const summary = await storeTransactionService.getTransactionSummary(req.user!.id);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch summary' });
  }
});

// Admin: Get all inquiries for follow-up
app.get('/api/admin/store/inquiries', requireAdmin, async (req: any, res) => {
  try {
    const { status, category, limit, offset } = req.query;
    
    const conditions: any[] = [];
    if (status) conditions.push(eq(storeProductInquiries.status, status as string));
    if (category) conditions.push(eq(storeProductInquiries.categoryId, category as string));
    
    const inquiries = await db.select()
      .from(storeProductInquiries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(storeProductInquiries.createdAt))
      .limit(parseInt(limit as string) || 50)
      .offset(parseInt(offset as string) || 0);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(storeProductInquiries)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ 
      success: true, 
      inquiries,
      total: countResult[0]?.count || 0
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inquiries' });
  }
});

// Admin: Update inquiry status
app.put('/api/admin/store/inquiries/:id', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedTo } = req.body;
    
    const updated = await db.update(storeProductInquiries)
      .set({ 
        status, 
        notes, 
        assignedTo,
        resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : undefined
      })
      .where(eq(storeProductInquiries.id, id))
      .returning();

    res.json({ success: true, inquiry: updated[0] });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    res.status(500).json({ success: false, message: 'Failed to update inquiry' });
  }
});

// Admin: Get transaction audit logs
app.get('/api/admin/store/transactions', requireAdmin, async (req: any, res) => {
  try {
    const { userId, category, status, startDate, endDate, limit, offset } = req.query;
    
    const conditions: any[] = [];
    if (userId) conditions.push(eq(storeTransactionLogs.userId, userId as string));
    if (category) conditions.push(eq(storeTransactionLogs.productCategory, category as string));
    if (status) conditions.push(eq(storeTransactionLogs.status, status as string));
    if (startDate) conditions.push(gte(storeTransactionLogs.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(storeTransactionLogs.createdAt, new Date(endDate as string)));

    const transactions = await db.select()
      .from(storeTransactionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(storeTransactionLogs.createdAt))
      .limit(parseInt(limit as string) || 100)
      .offset(parseInt(offset as string) || 0);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(storeTransactionLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ 
      success: true, 
      transactions,
      total: countResult[0]?.count || 0
    });
  } catch (error) {
    console.error('Error fetching transaction logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction logs' });
  }
});

// Admin: Get pending Zoho sync transactions
app.get('/api/admin/store/transactions/pending-sync', requireAdmin, async (req: any, res) => {
  try {
    const { storeTransactionService } = await import('../services/store-transaction-service');
    const pendingTransactions = await storeTransactionService.getPendingZohoSync(100);
    res.json({ success: true, transactions: pendingTransactions });
  } catch (error) {
    console.error('Error fetching pending sync:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending sync' });
  }
});


// ===================================================================
// STORE MANAGEMENT ROUTES (ADMIN)
// ===================================================================

// Get all store categories with their subcategories
app.get('/api/admin/store/categories', requireAdmin, async (req: any, res) => {
  console.log('[Store Categories] Request received from user:', req.user?.id, req.user?.email);
  try {
    const categories = await storage.getAllStoreCategories();
    const subcategories = await storage.getAllStoreSubcategories();
    console.log('[Store Categories] Fetched', categories.length, 'categories and', subcategories.length, 'subcategories');
    
    // Group subcategories by category
    const categoriesWithSubs = categories.map(cat => ({
      ...cat,
      subcategories: subcategories.filter(sub => sub.categoryId === cat.id),
    }));

    res.json({ categories: categoriesWithSubs });
  } catch (error) {
    console.error('Error fetching store categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// Get single category by ID
app.get('/api/admin/store/categories/:id', requireAdmin, async (req, res) => {
  try {
    const category = await storage.getStoreCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

// Create store category
app.post('/api/admin/store/categories', requireAdmin, async (req: any, res) => {
  try {
    const { name, description, icon, displayOrder } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = await storage.createStoreCategory({
      name,
      description,
      icon: icon || 'folder',
      displayOrder: displayOrder || 0,
      isActive: true,
    });

    // Log audit
    await storage.createStoreAuditLog({
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'create',
      targetType: 'category',
      targetId: category.id,
      targetName: category.name,
      afterValue: category,
    });

    res.json({ success: true, category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Failed to create category' });
  }
});

// Update store category
}
