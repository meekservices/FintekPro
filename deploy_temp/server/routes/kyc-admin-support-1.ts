import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, desc, gte, lte, sql, count, like } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import * as schema from '../../shared/schema';
import { insertManualKycSubmissionSchema } from '../../shared/schema';
import { complianceMonitor } from '../compliance-monitor';

export function registerKYCAdminSupporPart1Routes(app: Express): void {
app.post('/api/kyc/manual-submit', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const submissionData = req.body;
    
    // Validate required fields based on applicant type
    const validationSchema = insertManualKycSubmissionSchema.extend({
      documents: z.record(z.string().url()).refine(
        (docs) => Object.keys(docs).length > 0,
        { message: 'At least one document is required' }
      )
    });
    
    const validated = validationSchema.parse({
      ...submissionData,
      userId: req.user.id,
      submittedFrom: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    // Create the submission
    const submission = await storage.createManualKycSubmission(validated);

    // Log documents separately for tracking
    if (submission.documents && typeof submission.documents === 'object') {
      const docEntries = Object.entries(submission.documents);
      for (const [docType, docUrl] of docEntries) {
        await storage.createManualKycDocument({
          submissionId: submission.id,
          documentType: docType,
          documentUrl: docUrl as string,
          fileName: `${docType}_${submission.id}`,
          verificationStatus: 'pending'
        });
      }
    }

    // Log compliance event
    complianceMonitor.logEvent({
      userId: req.user.id,
      eventType: 'manual_kyc_submission',
      category: 'kyc_compliance',
      action: `Manual KYC submitted - ${validated.applicantType}`,
      resource: `/api/kyc/manual-submit`,
      status: 'success',
      metadata: {
        submissionId: submission.id,
        applicantType: validated.applicantType,
        documentCount: docEntries.length
      }
    });

    res.json({
      success: true,
      message: 'KYC submission received successfully',
      submissionId: submission.id,
      status: submission.status
    });
  } catch (error) {
    console.error('Manual KYC submission error:', error);
    
    complianceMonitor.logEvent({
      userId: req.user?.id,
      eventType: 'manual_kyc_submission_failed',
      category: 'kyc_compliance',
      action: 'Manual KYC submission failed',
      resource: `/api/kyc/manual-submit`,
      status: 'failure',
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
    });

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Submission failed'
    });
  }
});

// Admin: KYC Dashboard Stats
app.get('/api/admin/kyc/dashboard', requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get pending KYC count
    const [{ count: pendingCount }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.manualKycSubmissions)
      .where(eq(schema.manualKycSubmissions.status, 'pending'));

    // Get approved today count
    const [{ count: approvedToday }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.manualKycSubmissions)
      .where(and(
        eq(schema.manualKycSubmissions.status, 'approved'),
        gte(schema.manualKycSubmissions.reviewedAt, today),
        lte(schema.manualKycSubmissions.reviewedAt, tomorrow)
      ));

    // Get rejected today count
    const [{ count: rejectedToday }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.manualKycSubmissions)
      .where(and(
        eq(schema.manualKycSubmissions.status, 'rejected'),
        gte(schema.manualKycSubmissions.reviewedAt, today),
        lte(schema.manualKycSubmissions.reviewedAt, tomorrow)
      ));

    // Get pending documents count
    const [{ count: pendingDocs }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.manualKycDocuments)
      .where(eq(schema.manualKycDocuments.verificationStatus, 'pending'));

    // Get active alerts from compliance monitor
    const alerts = complianceMonitor.getAlerts(false);

    // Get KYC status counts from users (kyc_tier column may not exist yet)
    let tier1Count = 0, tier2Count = 0, tier3Count = 0;
    try {
      // Try using kycStatus instead since kyc_tier may not exist
      const [{ count: basicCount }] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(eq(schema.users.kycStatus, 'pending'));
      tier1Count = Number(basicCount) || 0;

      const [{ count: verifiedCount }] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(eq(schema.users.kycStatus, 'verified'));
      tier2Count = Number(verifiedCount) || 0;

      const [{ count: completedCount }] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(eq(schema.users.kycStatus, 'completed'));
      tier3Count = Number(completedCount) || 0;
    } catch (tierError) {
      console.log('KYC tier counts not available, using defaults');
    }

    res.json({
      success: true,
      data: {
        pendingKyc: Number(pendingCount) || 0,
        approvedToday: Number(approvedToday) || 0,
        rejectedToday: Number(rejectedToday) || 0,
        pendingDocuments: Number(pendingDocs) || 0,
        activeAlerts: alerts?.length || 0,
        tier1Count,
        tier2Count,
        tier3Count
      }
    });
  } catch (error) {
    console.error('Error fetching KYC dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

// Admin: KYC Submissions (formatted for compliance page)
app.get('/api/admin/kyc/submissions', requireAdmin, async (req, res) => {
  try {
    const { status, tier, search, limit = '50', offset = '0' } = req.query;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Build filters array conditionally
    const filters: any[] = [];
    if (status && status !== 'all') {
      filters.push(eq(schema.manualKycSubmissions.status, status as string));
    }
    if (tier && tier !== 'all') {
      // Tier filter removed - users table does not have kycStatus field
      // Could map to submission status if needed in future
    }
    if (search) {
      filters.push(or(
        like(schema.manualKycSubmissions.firstName, `%${search}%`),
        like(schema.manualKycSubmissions.lastName, `%${search}%`),
        like(schema.manualKycSubmissions.companyName, `%${search}%`),
        like(schema.manualKycSubmissions.email, `%${search}%`),
        like(schema.manualKycSubmissions.pan, `%${search}%`)
      ));
    }


    // Build base query - users table does not have kycStatus
    let query = db.select({
      id: schema.manualKycSubmissions.id,
      userId: schema.manualKycSubmissions.userId,
      firstName: schema.manualKycSubmissions.firstName,
      lastName: schema.manualKycSubmissions.lastName,
      companyName: schema.manualKycSubmissions.companyName,
      userEmail: schema.manualKycSubmissions.email,
      type: schema.manualKycSubmissions.applicantType,
      status: schema.manualKycSubmissions.status,
      submittedAt: schema.manualKycSubmissions.createdAt,
      reviewedAt: schema.manualKycSubmissions.reviewedAt,
      reviewedBy: schema.manualKycSubmissions.reviewedBy,
    })
      .from(schema.manualKycSubmissions);

    // Apply filters only if we have any
    if (filters.length > 0) {
      query = query.where(filters.length === 1 ? filters[0] : and(...filters)) as any;
    }

    const submissions = await query.limit(limitNum).offset(offsetNum);

    // Get total count with same filters
    let countQuery = db.select({ count: sql<number>`count(*)` })
      .from(schema.manualKycSubmissions)
      

    if (filters.length > 0) {
      countQuery = countQuery.where(filters.length === 1 ? filters[0] : and(...filters)) as any;
    }

    const [{ count: total }] = await countQuery;

    res.json({
      success: true,
      data: submissions.map((s: any) => ({
        userName: s.companyName || [s.firstName, s.lastName].filter(Boolean).join(' ') || 'N/A',
        ...s,
        tier: 'tier1', // Default tier since users table has no kycStatus
        submittedAt: s.submittedAt?.toISOString() || null,
        reviewedAt: s.reviewedAt?.toISOString() || null,
      })),
      pagination: {
        total: Number(total),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(total)
      }
    });
  } catch (error) {
    console.error('Error fetching KYC submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

// ==================== FINANCIAL OPERATIONS API ====================

// Admin: Financial Dashboard Stats
app.get('/api/admin/financial/dashboard', requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get unified orders stats
    const [{ count: totalOrders }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.unifiedOrders);

    const [{ count: pendingOrders }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.status, 'pending'));

    const [{ count: completedOrders }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.status, 'completed'));

    // Calculate total revenue
    const revenueResult = await db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` 
    }).from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.paymentStatus, 'completed'));

    // Today's revenue
    const todayRevenueResult = await db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` 
    }).from(schema.unifiedOrders)
      .where(and(
        eq(schema.unifiedOrders.paymentStatus, 'completed'),
        gte(schema.unifiedOrders.createdAt, today)
      ));

    // Orders by status
    const statusCounts = await db.select({
      status: schema.unifiedOrders.status,
      count: sql<number>`count(*)`
    }).from(schema.unifiedOrders)
      .groupBy(schema.unifiedOrders.status);

    // Orders by product type with revenue
    const productTypeCounts = await db.select({
      productType: schema.unifiedOrders.productType,
      count: sql<number>`count(*)`,
      revenue: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    }).from(schema.unifiedOrders)
      .groupBy(schema.unifiedOrders.productType);

    // Recent orders
    const recentOrders = await db.select()
      .from(schema.unifiedOrders)
      .orderBy(desc(schema.unifiedOrders.createdAt))
      .limit(10);

    res.json({
      success: true,
      data: {
        totalOrders: Number(totalOrders) || 0,
        pendingOrders: Number(pendingOrders) || 0,
        completedOrders: Number(completedOrders) || 0,
        totalRevenue: revenueResult[0]?.total || '0',
        todayRevenue: todayRevenueResult[0]?.total || '0',
        ordersByStatus: statusCounts.map(s => ({ status: s.status || 'unknown', count: Number(s.count) })),
        ordersByProductType: productTypeCounts.map(p => ({ 
          productType: p.productType || 'unknown', 
          count: Number(p.count),
          revenue: p.revenue || '0'
        })),
        recentOrders: recentOrders.map(o => ({
          ...o,
          createdAt: o.createdAt?.toISOString() || null
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching financial dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

// Admin: Financial Orders List
app.get('/api/admin/financial/orders', requireAdmin, async (req, res) => {
  try {
    const { status, productType, paymentStatus, search, limit = '50', offset = '0' } = req.query;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const filters: any[] = [];
    if (status) filters.push(eq(schema.unifiedOrders.status, status as string));
    if (productType) filters.push(eq(schema.unifiedOrders.productType, productType as string));
    if (paymentStatus) filters.push(eq(schema.unifiedOrders.paymentStatus, paymentStatus as string));
    if (search) {
      filters.push(or(
        like(schema.unifiedOrders.orderNumber, `%${search}%`),
        like(schema.unifiedOrders.userId, `%${search}%`)
      ));
    }

    let query = db.select().from(schema.unifiedOrders);
    if (filters.length > 0) {
      query = query.where(filters.length === 1 ? filters[0] : and(...filters)) as any;
    }

    const orders = await query
      .orderBy(desc(schema.unifiedOrders.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    let countQuery = db.select({ count: sql<number>`count(*)` }).from(schema.unifiedOrders);
    if (filters.length > 0) {
      countQuery = countQuery.where(filters.length === 1 ? filters[0] : and(...filters)) as any;
    }
    const [{ count: total }] = await countQuery;

    res.json({
      success: true,
      data: orders.map(o => ({
        ...o,
        createdAt: o.createdAt?.toISOString() || null
      })),
      pagination: { total: Number(total), limit: limitNum, offset: offsetNum }
    });
  } catch (error) {
    console.error('Error fetching financial orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Admin: Get single order details
app.get('/api/admin/financial/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [order] = await db.select().from(schema.unifiedOrders).where(eq(schema.unifiedOrders.id, id));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: { ...order, createdAt: order.createdAt?.toISOString() || null } });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Admin: Cashfree Transactions
app.get('/api/admin/financial/cashfree-transactions', requireAdmin, async (req, res) => {
  try {
    const { status, limit = '50' } = req.query;
    let query = db.select().from(schema.cashfreeTransactions);
    if (status) {
      query = query.where(eq(schema.cashfreeTransactions.status, status as string)) as any;
    }
    const transactions = await query.orderBy(desc(schema.cashfreeTransactions.createdAt)).limit(parseInt(limit as string));
    res.json({ success: true, data: transactions.map(t => ({ ...t, createdAt: t.createdAt?.toISOString() || null })) });
  } catch (error) {
    console.error('Error fetching Cashfree transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// Admin: PhonePe Transactions
app.get('/api/admin/financial/phonepe-transactions', requireAdmin, async (req, res) => {
  try {
    const { state, limit = '50' } = req.query;
    let query = db.select().from(schema.phonePeTransactions);
    if (state) {
      query = query.where(eq(schema.phonePeTransactions.state, state as string)) as any;
    }
    const transactions = await query.orderBy(desc(schema.phonePeTransactions.createdAt)).limit(parseInt(limit as string));
    res.json({ success: true, data: transactions.map(t => ({ ...t, createdAt: t.createdAt?.toISOString() || null })) });
  } catch (error) {
    console.error('Error fetching PhonePe transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// Admin: Payment Reconciliation
app.get('/api/admin/financial/payment-reconciliation', requireAdmin, async (req, res) => {
  try {
    // Get counts by payment status
    const orderPaymentStats = await db.select({
      paymentStatus: schema.unifiedOrders.paymentStatus,
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    }).from(schema.unifiedOrders).groupBy(schema.unifiedOrders.paymentStatus);

    // Get Cashfree totals
    const [cashfreeTotals] = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    }).from(schema.cashfreeTransactions).where(eq(schema.cashfreeTransactions.status, 'success'));

    // Get PhonePe totals  
    const [phonePeTotals] = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`
    }).from(schema.phonePeTransactions).where(eq(schema.phonePeTransactions.state, 'COMPLETED'));

    res.json({
      success: true,
      data: {
        orderPaymentStats: orderPaymentStats.map(s => ({
          paymentStatus: s.paymentStatus || 'unknown',
          count: Number(s.count),
          total: s.total || '0'
        })),
        cashfree: { count: Number(cashfreeTotals?.count) || 0, total: cashfreeTotals?.total || '0' },
        phonePe: { count: Number(phonePeTotals?.count) || 0, total: phonePeTotals?.total || '0' }
      }
    });
  } catch (error) {
    console.error('Error fetching payment reconciliation:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation data' });
  }
});

// Admin: Revenue Analytics
app.get('/api/admin/financial/revenue-analytics', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Last 30 days revenue
    const [last30Days] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
      count: sql<number>`count(*)`
    }).from(schema.unifiedOrders)
      .where(and(
        eq(schema.unifiedOrders.paymentStatus, 'completed'),
        gte(schema.unifiedOrders.createdAt, thirtyDaysAgo)
      ));

    // Last 7 days revenue
    const [last7Days] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
      count: sql<number>`count(*)`
    }).from(schema.unifiedOrders)
      .where(and(
        eq(schema.unifiedOrders.paymentStatus, 'completed'),
        gte(schema.unifiedOrders.createdAt, sevenDaysAgo)
      ));

    // Revenue by product type
    const revenueByProduct = await db.select({
      productType: schema.unifiedOrders.productType,
      total: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
      count: sql<number>`count(*)`
    }).from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.paymentStatus, 'completed'))
      .groupBy(schema.unifiedOrders.productType);

    res.json({
      success: true,
      data: {
        last30Days: { total: last30Days?.total || '0', count: Number(last30Days?.count) || 0 },
        last7Days: { total: last7Days?.total || '0', count: Number(last7Days?.count) || 0 },
        revenueByProduct: revenueByProduct.map(r => ({
          productType: r.productType || 'unknown',
          total: r.total || '0',
          count: Number(r.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue analytics' });
  }
});

// Admin: Refunds List (placeholder - refunds table not yet created)
app.get('/api/admin/financial/refunds', requireAdmin, async (req, res) => {
  try {
    // Refunds table not yet created - return empty array
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch refunds' });
  }
});

// Admin: Initiate Refund (placeholder - refunds table not yet created)
app.post('/api/admin/financial/refunds/initiate', requireAdmin, async (req: any, res) => {
  try {
    const { orderId, amount, reason } = req.body;
    if (!orderId || !amount || !reason) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const [order] = await db.select().from(schema.unifiedOrders).where(eq(schema.unifiedOrders.id, orderId));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Refunds table not yet created - return placeholder response
    res.json({ 
      success: true, 
      message: 'Refund request recorded. Refunds system coming soon.',
      data: { orderId, amount, reason, status: 'pending' }
    });
  } catch (error) {
    console.error('Error initiating refund:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate refund' });
  }
});

// ==================== END FINANCIAL OPERATIONS API ====================

// ==================== DUPLICATE ACCOUNTS API ====================

// Admin: Get duplicate accounts
app.get('/api/admin/duplicates', requireAdmin, async (req, res) => {
  try {
    // Find duplicate emails
    const emailDuplicates = await db.execute<{
      email: string;
      count: number;
    }>(sql`
      SELECT email, COUNT(*) as count 
      FROM users 
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);

    // Find duplicate mobiles
    const mobileDuplicates = await db.execute<{
      mobile: string;
      count: number;
    }>(sql`
      SELECT mobile, COUNT(*) as count 
      FROM users 
      WHERE mobile IS NOT NULL AND mobile != ''
      GROUP BY mobile 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 50
    `);

    // Get users for each duplicate email
    const duplicateEmails = await Promise.all(
      emailDuplicates.rows.map(async (dup) => {
        const users = await db.select({
          id: schema.users.id,
          userId: schema.users.userId,
          email: schema.users.email,
          mobile: schema.users.mobile,
          firstName: schema.users.firstName,
          middleName: schema.users.middleName,
          lastName: schema.users.lastName,
          createdAt: schema.users.createdAt,
          roles: schema.users.roles,
          isActive: schema.users.isActive,
        }).from(schema.users).where(eq(schema.users.email, dup.email));
        
        return {
          email: dup.email,
          count: Number(dup.count),
          users: users.map(u => ({
            id: u.id,
            userId: u.userId || u.id,
            email: u.email || '',
            mobile: u.mobile || '',
            firstName: u.firstName || '',
            middleName: u.middleName,
            lastName: u.lastName || '',
            createdAt: u.createdAt?.toISOString() || '',
            role: (u.roles as string[])?.[0] || 'user',
            isActive: u.isActive ?? true,
          })),
        };
      })
    );

    // Get users for each duplicate mobile
    const duplicateMobiles = await Promise.all(
      mobileDuplicates.rows.map(async (dup) => {
        const users = await db.select({
          id: schema.users.id,
          userId: schema.users.userId,
          email: schema.users.email,
          mobile: schema.users.mobile,
          firstName: schema.users.firstName,
          middleName: schema.users.middleName,
          lastName: schema.users.lastName,
          createdAt: schema.users.createdAt,
          roles: schema.users.roles,
          isActive: schema.users.isActive,
        }).from(schema.users).where(eq(schema.users.mobile, dup.mobile));
        
        return {
          mobile: dup.mobile,
          count: Number(dup.count),
          users: users.map(u => ({
            id: u.id,
            userId: u.userId || u.id,
            email: u.email || '',
            mobile: u.mobile || '',
            firstName: u.firstName || '',
            middleName: u.middleName,
            lastName: u.lastName || '',
            createdAt: u.createdAt?.toISOString() || '',
            role: (u.roles as string[])?.[0] || 'user',
            isActive: u.isActive ?? true,
          })),
        };
      })
    );

    // Calculate affected accounts
    const affectedUserIds = new Set<string>();
    duplicateEmails.forEach(de => de.users.forEach(u => affectedUserIds.add(u.id)));
    duplicateMobiles.forEach(dm => dm.users.forEach(u => affectedUserIds.add(u.id)));

    res.json({
      success: true,
      data: {
        duplicateEmails,
        duplicateMobiles,
        summary: {
          totalDuplicateEmails: duplicateEmails.length,
          totalDuplicateMobiles: duplicateMobiles.length,
          totalAffectedAccounts: affectedUserIds.size,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching duplicates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch duplicate accounts' });
  }
});

// Admin: Get duplicate stats summary
app.get('/api/admin/duplicate-stats', requireAdmin, async (req, res) => {
  try {
    // Count duplicate emails
    const emailResult = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count FROM (
        SELECT email FROM users 
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email 
        HAVING COUNT(*) > 1
      ) as dups
    `);
    const emailCount = Number(emailResult.rows[0]?.count) || 0;

    // Count duplicate mobiles
    const mobileResult = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count FROM (
        SELECT mobile FROM users 
        WHERE mobile IS NOT NULL AND mobile != ''
        GROUP BY mobile 
        HAVING COUNT(*) > 1
      ) as dups
    `);
    const mobileCount = Number(mobileResult.rows[0]?.count) || 0;

    // Count affected users
    const affectedResult = await db.execute<{ count: string }>(sql`
      SELECT COUNT(DISTINCT id) as count FROM users
      WHERE email IN (
        SELECT email FROM users 
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email 
        HAVING COUNT(*) > 1
      ) OR mobile IN (
        SELECT mobile FROM users 
        WHERE mobile IS NOT NULL AND mobile != ''
        GROUP BY mobile 
        HAVING COUNT(*) > 1
      )
    `);
    const affectedCount = Number(affectedResult.rows[0]?.count) || 0;

    res.json({
      success: true,
      data: {
        totalDuplicates: emailCount + mobileCount,
        totalDuplicateEmails: emailCount,
        totalDuplicateMobiles: mobileCount,
        totalAffectedAccounts: affectedCount,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        autoMergeRecommended: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching duplicate stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch duplicate stats' });
  }
});

// ==================== END DUPLICATE ACCOUNTS API ====================

// Get user's manual KYC submissions
app.get('/api/kyc/manual-submissions', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const submissions = await storage.getUserManualKycSubmissions(req.user.id);
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching manual KYC submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

// Admin: Get all manual KYC submissions
app.get('/api/admin/kyc/manual-submissions', requireAdmin, async (req, res) => {
  try {
    const { status, applicantType, limit = 50, offset = 0 } = req.query;
    
    const submissions = await storage.getAllManualKycSubmissions({
      status: status as string,
      applicantType: applicantType as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching admin manual KYC submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions' });
  }
});

// Admin: Review manual KYC submission (approve/reject)
}
