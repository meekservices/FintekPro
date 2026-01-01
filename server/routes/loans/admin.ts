import { Express, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { loanOrchestrator, LoanProductData, LoanProviderData, ProviderProductOffering } from '../../loan-marketplace/loan-orchestrator';
import { storage } from '../../storage';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getZohoBooksService } from '../../zoho/services/books';

// Validation schemas
const lenderStaffSchema = z.object({
  providerId: z.string().min(1),
  staffCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.enum(['rm', 'senior_rm', 'branch_manager', 'area_manager', 'credit_officer', 'zonal_head', 'regional_head', 'national_head']),
  department: z.enum(['sales', 'credit', 'operations', 'collections']).optional(),
  branchCode: z.string().optional(),
  branchName: z.string().optional(),
  regionCode: z.string().optional(),
  zoneCode: z.string().optional(),
  reportsToId: z.string().optional(),
  employeeId: z.string().optional(),
  joiningDate: z.string().optional(),
  isEscalationContact: z.boolean().optional(),
  escalationLevel: z.number().optional(),
  specializations: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const staffStatusChangeSchema = z.object({
  changeType: z.enum(['resignation', 'termination', 'transfer', 'promotion', 'demotion', 'leave_start', 'leave_end', 'rejoined', 'status_change']),
  newStatus: z.enum(['active', 'on_leave', 'resigned', 'terminated', 'transferred']),
  reason: z.string().min(1),
  remarks: z.string().optional(),
  effectiveDate: z.string(),
  newProviderId: z.string().optional(),
  newDesignation: z.string().optional(),
  newBranchCode: z.string().optional(),
  newReportsToId: z.string().optional(),
  relievingDate: z.string().optional(),
  lastWorkingDay: z.string().optional(),
  isEligibleForRehire: z.boolean().optional(),
  leaveType: z.string().optional(),
  leaveStartDate: z.string().optional(),
  leaveEndDate: z.string().optional(),
  leadsReassignedTo: z.string().optional(),
});

const commissionConfigSchema = z.object({
  providerId: z.string().min(1),
  productId: z.string().min(1),
  commissionType: z.enum(['percentage', 'flat', 'hybrid']),
  commissionBase: z.enum(['loan_amount', 'processing_fee', 'first_emi']),
  baseCommissionRate: z.string(),
  minCommission: z.string().optional(),
  maxCommission: z.string().optional(),
  slabCommissions: z.array(z.object({
    minAmount: z.number(),
    maxAmount: z.number(),
    rate: z.number(),
  })).optional(),
  fintekProShare: z.string(),
  partnerShare: z.string().optional(),
  agentShare: z.string().optional(),
  managementOverrideRate: z.string().optional(),
  paymentTermsDays: z.number().optional(),
  paymentFrequency: z.enum(['monthly', 'quarterly']).optional(),
  clawbackPeriodMonths: z.number().optional(),
  clawbackRate: z.string().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

const referralPayoutConfigSchema = z.object({
  configLevel: z.enum(['global', 'provider', 'product', 'agent', 'partner']),
  providerId: z.string().optional(),
  productId: z.string().optional(),
  agentId: z.string().optional(),
  partnerId: z.string().optional(),
  payoutType: z.enum(['percentage', 'flat', 'tiered']),
  payoutBase: z.enum(['commission', 'loan_amount']),
  agentPayoutRate: z.string().optional(),
  partnerPayoutRate: z.string().optional(),
  tieredPayouts: z.array(z.object({
    minConversions: z.number(),
    rate: z.number(),
  })).optional(),
  level1OverrideRate: z.string().optional(),
  level2OverrideRate: z.string().optional(),
  level3OverrideRate: z.string().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
});

export function registerLoanAdminRoutes(app: Express) {
  // ==================== Loan Products & Providers (Read-only from config) ====================
  
  // Get all loan products
  app.get('/api/admin/loan-marketplace/products', requireAdmin, async (req: Request, res: Response) => {
    try {
      const products = loanOrchestrator.getLoanProducts();
      res.json({ success: true, data: products });
    } catch (error: any) {
      console.error('Error fetching loan products:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch loan products' });
    }
  });

  // Get all loan providers with commission info
  app.get('/api/admin/loan-marketplace/providers', requireAdmin, async (req: Request, res: Response) => {
    try {
      const providers = loanOrchestrator.getLoanProviders();
      res.json({ success: true, data: providers });
    } catch (error: any) {
      console.error('Error fetching loan providers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch loan providers' });
    }
  });

  // Get provider with all their product offerings and commission rates
  app.get('/api/admin/loan-marketplace/providers/:providerKey', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { providerKey } = req.params;
      const provider = loanOrchestrator.getLoanProvider(providerKey);
      
      if (!provider) {
        return res.status(404).json({ success: false, error: 'Provider not found' });
      }

      res.json({ success: true, data: provider });
    } catch (error: any) {
      console.error('Error fetching provider:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch provider' });
    }
  });

  // ==================== Lender Staff Management ====================
  
  // Get all lender staff
  app.get('/api/admin/loan-marketplace/staff', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { providerId, status, designation } = req.query;
      
      let conditions: any[] = [];
      if (providerId) conditions.push(eq(schema.lenderStaff.providerId, providerId as string));
      if (status) conditions.push(eq(schema.lenderStaff.status, status as string));
      if (designation) conditions.push(eq(schema.lenderStaff.designation, designation as string));
      
      const staff = await db.select()
        .from(schema.lenderStaff)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.lenderStaff.createdAt));
      
      res.json({ success: true, data: staff });
    } catch (error: any) {
      console.error('Error fetching lender staff:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch lender staff' });
    }
  });

  // Get single staff member with history
  app.get('/api/admin/loan-marketplace/staff/:staffId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { staffId } = req.params;
      
      const [staff] = await db.select()
        .from(schema.lenderStaff)
        .where(eq(schema.lenderStaff.id, staffId))
        .limit(1);
      
      if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }

      const history = await db.select()
        .from(schema.lenderStaffHistory)
        .where(eq(schema.lenderStaffHistory.staffId, staffId))
        .orderBy(desc(schema.lenderStaffHistory.createdAt));
      
      res.json({ success: true, data: { ...staff, history } });
    } catch (error: any) {
      console.error('Error fetching staff member:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch staff member' });
    }
  });

  // Create new lender staff
  app.post('/api/admin/loan-marketplace/staff', requireAdmin, async (req: any, res: Response) => {
    try {
      const validatedData = lenderStaffSchema.parse(req.body);
      
      const [newStaff] = await db.insert(schema.lenderStaff)
        .values({
          ...validatedData,
          isActive: true,
          status: 'active',
        })
        .returning();

      res.status(201).json({ success: true, data: newStaff });
    } catch (error: any) {
      console.error('Error creating lender staff:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to create lender staff' });
    }
  });

  // Create new lender staff via provider route (alias for frontend compatibility)
  app.post('/api/admin/loan-marketplace/providers/:providerId/staff', requireAdmin, async (req: any, res: Response) => {
    try {
      const { providerId } = req.params;
      
      // Map frontend designation format to backend enum
      const designationMap: Record<string, string> = {
        'relationship_manager': 'rm',
        'branch_manager': 'branch_manager',
        'credit_officer': 'credit_officer',
        'zonal_head': 'zonal_head',
        'regional_head': 'regional_head',
        'sales_executive': 'rm',
        'senior_rm': 'senior_rm',
        'area_manager': 'area_manager',
        'national_head': 'national_head',
      };
      
      const designation = designationMap[req.body.designation] || 'rm';
      
      const [newStaff] = await db.insert(schema.lenderStaff)
        .values({
          providerId,
          staffCode: `STAFF-${Date.now()}`,
          firstName: req.body.name?.split(' ')[0] || 'Staff',
          lastName: req.body.name?.split(' ').slice(1).join(' ') || 'Member',
          email: req.body.email,
          phone: req.body.phone,
          designation,
          branchName: req.body.branch,
          regionCode: req.body.region,
          isActive: true,
          status: 'active',
        })
        .returning();
      
      res.status(201).json({ success: true, data: newStaff });
    } catch (error: any) {
      console.error('Error creating lender staff:', error);
      res.status(500).json({ success: false, error: 'Failed to create lender staff' });
    }
  });

  // Update lender staff (PATCH)
  app.patch('/api/admin/loan-marketplace/staff/:staffId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { staffId } = req.params;
      const updates = req.body;
      
      const [updatedStaff] = await db.update(schema.lenderStaff)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.lenderStaff.id, staffId))
        .returning();
      
      if (!updatedStaff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }
      
      res.json({ success: true, data: updatedStaff });
    } catch (error: any) {
      console.error('Error updating lender staff:', error);
      res.status(500).json({ success: false, error: 'Failed to update lender staff' });
    }
  });

  // Update lender staff (PUT - alias for PATCH)
  app.put('/api/admin/loan-marketplace/staff/:staffId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { staffId } = req.params;
      const updates = req.body;
      
      const [updatedStaff] = await db.update(schema.lenderStaff)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.lenderStaff.id, staffId))
        .returning();
      
      if (!updatedStaff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }
      
      res.json({ success: true, data: updatedStaff });
    } catch (error: any) {
      console.error('Error updating lender staff:', error);
      res.status(500).json({ success: false, error: 'Failed to update lender staff' });
    }
  });

  // Delete lender staff (soft delete by changing status)
  app.delete('/api/admin/loan-marketplace/staff/:staffId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { staffId } = req.params;
      
      // Soft delete - mark as terminated
      const [deletedStaff] = await db.update(schema.lenderStaff)
        .set({
          status: 'terminated',
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.lenderStaff.id, staffId))
        .returning();
      
      if (!deletedStaff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }
      
      res.json({ success: true, data: deletedStaff, message: 'Staff member has been removed' });
    } catch (error: any) {
      console.error('Error deleting lender staff:', error);
      res.status(500).json({ success: false, error: 'Failed to delete lender staff' });
    }
  });

  // Staff status change (resignation, termination, transfer, promotion, leave)
  app.post('/api/admin/loan-marketplace/staff/:staffId/status-change', requireAdmin, async (req: any, res: Response) => {
    try {
      const { staffId } = req.params;
      const adminUserId = req.user?.id || 'system';
      const validatedData = staffStatusChangeSchema.parse(req.body);
      
      // Get current staff state
      const [currentStaff] = await db.select()
        .from(schema.lenderStaff)
        .where(eq(schema.lenderStaff.id, staffId))
        .limit(1);
      
      if (!currentStaff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }

      // Create history record
      const [historyRecord] = await db.insert(schema.lenderStaffHistory)
        .values({
          staffId,
          changeType: validatedData.changeType,
          previousProviderId: currentStaff.providerId,
          previousDesignation: currentStaff.designation,
          previousStatus: currentStaff.status,
          previousBranchCode: currentStaff.branchCode,
          previousReportsToId: currentStaff.reportsToId,
          newProviderId: validatedData.newProviderId || currentStaff.providerId,
          newDesignation: validatedData.newDesignation || currentStaff.designation,
          newStatus: validatedData.newStatus,
          newBranchCode: validatedData.newBranchCode || currentStaff.branchCode,
          newReportsToId: validatedData.newReportsToId || currentStaff.reportsToId,
          effectiveDate: new Date(validatedData.effectiveDate),
          reason: validatedData.reason,
          remarks: validatedData.remarks,
          relievingDate: validatedData.relievingDate ? new Date(validatedData.relievingDate) : undefined,
          lastWorkingDay: validatedData.lastWorkingDay ? new Date(validatedData.lastWorkingDay) : undefined,
          isEligibleForRehire: validatedData.isEligibleForRehire,
          leaveType: validatedData.leaveType,
          leaveStartDate: validatedData.leaveStartDate ? new Date(validatedData.leaveStartDate) : undefined,
          leaveEndDate: validatedData.leaveEndDate ? new Date(validatedData.leaveEndDate) : undefined,
          leadsReassignedTo: validatedData.leadsReassignedTo,
          changedBy: adminUserId,
          changedByRole: 'admin',
        })
        .returning();

      // Update staff record
      const updateData: any = {
        status: validatedData.newStatus,
        statusReason: validatedData.reason,
        statusChangedAt: new Date(),
        statusChangedBy: adminUserId,
        updatedAt: new Date(),
      };
      
      if (validatedData.newProviderId) updateData.providerId = validatedData.newProviderId;
      if (validatedData.newDesignation) updateData.designation = validatedData.newDesignation;
      if (validatedData.newBranchCode) updateData.branchCode = validatedData.newBranchCode;
      if (validatedData.newReportsToId) updateData.reportsToId = validatedData.newReportsToId;

      const [updatedStaff] = await db.update(schema.lenderStaff)
        .set(updateData)
        .where(eq(schema.lenderStaff.id, staffId))
        .returning();

      // Handle lead reassignment if specified
      if (validatedData.leadsReassignedTo) {
        const reassignResult = await db.update(schema.loanLeads)
          .set({
            assignedToStaffId: validatedData.leadsReassignedTo,
            reassignmentCount: sql`${schema.loanLeads.reassignmentCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.loanLeads.assignedToStaffId, staffId));
        
        // Update history with count
        await db.update(schema.lenderStaffHistory)
          .set({ leadsReassignedCount: reassignResult.rowCount || 0 })
          .where(eq(schema.lenderStaffHistory.id, historyRecord.id));
      }

      res.json({ 
        success: true, 
        data: { 
          staff: updatedStaff, 
          historyRecord,
          message: `Staff status changed to ${validatedData.newStatus}`
        } 
      });
    } catch (error: any) {
      console.error('Error changing staff status:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to change staff status' });
    }
  });

  // ==================== Commission Configuration ====================
  
  // Get all commission configurations
  app.get('/api/admin/loan-marketplace/commissions', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { providerId, productId, isActive } = req.query;
      
      let conditions: any[] = [];
      if (providerId) conditions.push(eq(schema.providerProductCommissions.providerId, providerId as string));
      if (productId) conditions.push(eq(schema.providerProductCommissions.productId, productId as string));
      if (isActive !== undefined) conditions.push(eq(schema.providerProductCommissions.isActive, isActive === 'true'));
      
      const commissions = await db.select()
        .from(schema.providerProductCommissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.providerProductCommissions.createdAt));
      
      res.json({ success: true, data: commissions });
    } catch (error: any) {
      console.error('Error fetching commissions:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch commissions' });
    }
  });

  // Create commission configuration
  app.post('/api/admin/loan-marketplace/commissions', requireAdmin, async (req: any, res: Response) => {
    try {
      const validatedData = commissionConfigSchema.parse(req.body);
      
      const [newCommission] = await db.insert(schema.providerProductCommissions)
        .values({
          ...validatedData,
          effectiveFrom: new Date(validatedData.effectiveFrom),
          effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
          approvedBy: req.user?.id,
          approvedAt: new Date(),
        })
        .returning();
      
      res.status(201).json({ success: true, data: newCommission });
    } catch (error: any) {
      console.error('Error creating commission config:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to create commission config' });
    }
  });

  // Update commission configuration
  app.patch('/api/admin/loan-marketplace/commissions/:commissionId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { commissionId } = req.params;
      const updates = req.body;
      
      if (updates.effectiveFrom) updates.effectiveFrom = new Date(updates.effectiveFrom);
      if (updates.effectiveTo) updates.effectiveTo = new Date(updates.effectiveTo);
      
      const [updatedCommission] = await db.update(schema.providerProductCommissions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.providerProductCommissions.id, commissionId))
        .returning();
      
      if (!updatedCommission) {
        return res.status(404).json({ success: false, error: 'Commission config not found' });
      }
      
      res.json({ success: true, data: updatedCommission });
    } catch (error: any) {
      console.error('Error updating commission config:', error);
      res.status(500).json({ success: false, error: 'Failed to update commission config' });
    }
  });

  // ==================== Referral Payout Configuration ====================
  
  // Get all payout configurations
  app.get('/api/admin/loan-marketplace/payouts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { configLevel, isActive } = req.query;
      
      let conditions: any[] = [];
      if (configLevel) conditions.push(eq(schema.referralPayoutConfig.configLevel, configLevel as string));
      if (isActive !== undefined) conditions.push(eq(schema.referralPayoutConfig.isActive, isActive === 'true'));
      
      const payouts = await db.select()
        .from(schema.referralPayoutConfig)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.referralPayoutConfig.createdAt));
      
      res.json({ success: true, data: payouts });
    } catch (error: any) {
      console.error('Error fetching payout configs:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payout configs' });
    }
  });

  // Create payout configuration
  app.post('/api/admin/loan-marketplace/payouts', requireAdmin, async (req: any, res: Response) => {
    try {
      const validatedData = referralPayoutConfigSchema.parse(req.body);
      
      const [newPayout] = await db.insert(schema.referralPayoutConfig)
        .values({
          ...validatedData,
          effectiveFrom: new Date(validatedData.effectiveFrom),
          effectiveTo: validatedData.effectiveTo ? new Date(validatedData.effectiveTo) : undefined,
          approvedBy: req.user?.id,
          approvalDate: new Date(),
        })
        .returning();
      
      res.status(201).json({ success: true, data: newPayout });
    } catch (error: any) {
      console.error('Error creating payout config:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to create payout config' });
    }
  });

  // ==================== Revenue Dashboard ====================
  
  // Get revenue summary
  app.get('/api/admin/loan-marketplace/revenue/summary', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, providerId } = req.query;
      
      // Get commission ledger summary
      let conditions: any[] = [];
      if (providerId) conditions.push(eq(schema.loanCommissionLedger.providerId, providerId as string));
      
      const ledgerEntries = await db.select()
        .from(schema.loanCommissionLedger)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      // Calculate totals
      const summary = {
        totalGrossCommission: 0,
        totalNetCommission: 0,
        totalFintekProShare: 0,
        totalPartnerPayout: 0,
        totalAgentPayout: 0,
        totalManagementOverride: 0,
        pendingPayouts: 0,
        paidPayouts: 0,
        clawedBack: 0,
        byProvider: {} as Record<string, any>,
        byProduct: {} as Record<string, any>,
        byStatus: {} as Record<string, number>,
      };

      for (const entry of ledgerEntries) {
        const gross = parseFloat(entry.grossCommission) || 0;
        const net = parseFloat(entry.netCommission) || 0;
        const fintekPro = parseFloat(entry.fintekProAmount) || 0;
        const partner = parseFloat(entry.partnerAmount || '0') || 0;
        const agent = parseFloat(entry.agentAmount || '0') || 0;
        const management = parseFloat(entry.managementOverrideAmount || '0') || 0;

        summary.totalGrossCommission += gross;
        summary.totalNetCommission += net;
        summary.totalFintekProShare += fintekPro;
        summary.totalPartnerPayout += partner;
        summary.totalAgentPayout += agent;
        summary.totalManagementOverride += management;

        // By status
        summary.byStatus[entry.status] = (summary.byStatus[entry.status] || 0) + net;
        
        if (entry.status === 'pending') summary.pendingPayouts += net;
        if (entry.status === 'paid') summary.paidPayouts += net;
        if (entry.isClawedBack) summary.clawedBack += parseFloat(entry.clawbackAmount || '0') || 0;

        // By provider
        if (!summary.byProvider[entry.providerId]) {
          summary.byProvider[entry.providerId] = { gross: 0, net: 0, count: 0 };
        }
        summary.byProvider[entry.providerId].gross += gross;
        summary.byProvider[entry.providerId].net += net;
        summary.byProvider[entry.providerId].count += 1;

        // By product
        if (!summary.byProduct[entry.productId]) {
          summary.byProduct[entry.productId] = { gross: 0, net: 0, count: 0 };
        }
        summary.byProduct[entry.productId].gross += gross;
        summary.byProduct[entry.productId].net += net;
        summary.byProduct[entry.productId].count += 1;
      }

      res.json({ success: true, data: summary });
    } catch (error: any) {
      console.error('Error fetching revenue summary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch revenue summary' });
    }
  });

  // Get payout transactions
  app.get('/api/admin/loan-marketplace/revenue/payouts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { beneficiaryType, status, page = '1', limit = '50' } = req.query;
      
      let conditions: any[] = [];
      if (beneficiaryType) conditions.push(eq(schema.referralPayoutTransactions.beneficiaryType, beneficiaryType as string));
      if (status) conditions.push(eq(schema.referralPayoutTransactions.status, status as string));
      
      const payouts = await db.select()
        .from(schema.referralPayoutTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.referralPayoutTransactions.createdAt))
        .limit(parseInt(limit as string))
        .offset((parseInt(page as string) - 1) * parseInt(limit as string));
      
      res.json({ success: true, data: payouts });
    } catch (error: any) {
      console.error('Error fetching payout transactions:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payout transactions' });
    }
  });

  // ==================== Zoho Books Integration ====================
  
  // Sync commission to Zoho Books (create invoice)
  app.post('/api/admin/loan-marketplace/revenue/sync-zoho/:ledgerId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { ledgerId } = req.params;
      
      const [ledgerEntry] = await db.select()
        .from(schema.loanCommissionLedger)
        .where(eq(schema.loanCommissionLedger.id, ledgerId))
        .limit(1);
      
      if (!ledgerEntry) {
        return res.status(404).json({ success: false, error: 'Commission entry not found' });
      }

      const zohoService = await getZohoBooksService();
      if (!zohoService) {
        return res.status(503).json({ success: false, error: 'Zoho Books not configured' });
      }

      // Get provider details
      const provider = loanOrchestrator.getLoanProviders().find(p => p.providerKey === ledgerEntry.providerId);
      const providerName = provider?.providerName || ledgerEntry.providerId;

      // Create invoice in Zoho Books
      const invoiceData = {
        customer_name: providerName,
        reference_number: `LOAN-COMM-${ledgerEntry.id.substring(0, 8).toUpperCase()}`,
        date: new Date().toISOString().split('T')[0],
        due_date: ledgerEntry.paymentDueDate?.toISOString().split('T')[0] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        line_items: [
          {
            name: `Loan Commission - Application ${ledgerEntry.applicationId}`,
            description: `Commission for loan disbursement of ₹${ledgerEntry.loanAmount}`,
            rate: parseFloat(ledgerEntry.grossCommission),
            quantity: 1,
          }
        ],
        notes: `GST: ₹${ledgerEntry.gstAmount}, TDS: ₹${ledgerEntry.tdsAmount}`,
      };

      const zohoInvoice = await zohoService.createInvoice(invoiceData);

      // Update ledger with Zoho reference
      await db.update(schema.loanCommissionLedger)
        .set({
          zohoInvoiceId: zohoInvoice.invoice_id,
          zohoSyncStatus: 'synced',
          status: 'invoiced',
          invoiceNumber: zohoInvoice.invoice_number,
          invoiceDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.loanCommissionLedger.id, ledgerId));

      res.json({ 
        success: true, 
        data: { 
          zohoInvoiceId: zohoInvoice.invoice_id,
          invoiceNumber: zohoInvoice.invoice_number,
          message: 'Commission synced to Zoho Books' 
        } 
      });
    } catch (error: any) {
      console.error('Error syncing to Zoho Books:', error);
      
      // Update sync status on failure
      await db.update(schema.loanCommissionLedger)
        .set({
          zohoSyncStatus: 'failed',
          zohoSyncError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(schema.loanCommissionLedger.id, req.params.ledgerId));
      
      res.status(500).json({ success: false, error: 'Failed to sync to Zoho Books', details: error.message });
    }
  });

  // ==================== EMI Calculator & Pre-qualification ====================
  
  // EMI Calculator
  app.post('/api/admin/loan-marketplace/calculator/emi', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { principal, annualRate, tenureMonths } = req.body;
      
      if (!principal || !annualRate || !tenureMonths) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const calculation = loanOrchestrator.calculateEMI(
        parseFloat(principal),
        parseFloat(annualRate),
        parseInt(tenureMonths)
      );

      res.json({ success: true, data: calculation });
    } catch (error: any) {
      console.error('Error calculating EMI:', error);
      res.status(500).json({ success: false, error: 'Failed to calculate EMI' });
    }
  });

  // Pre-qualification check
  app.post('/api/admin/loan-marketplace/prequalify', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { productKey, requestedAmount, monthlyIncome, creditScore, existingEMIs } = req.body;
      
      if (!productKey || !requestedAmount || !monthlyIncome) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const result = await loanOrchestrator.softPrequalify(
        productKey,
        parseFloat(requestedAmount),
        parseFloat(monthlyIncome),
        creditScore ? parseInt(creditScore) : undefined,
        existingEMIs ? parseFloat(existingEMIs) : undefined
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error in pre-qualification:', error);
      res.status(500).json({ success: false, error: 'Failed to run pre-qualification' });
    }
  });

  // ==================== Lead Management ====================
  
  // Get all leads with filters
  app.get('/api/admin/loan-marketplace/leads', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { funnelStage, productId, assignedToStaffId, isConverted, page = '1', limit = '50' } = req.query;
      
      let conditions: any[] = [];
      if (funnelStage) conditions.push(eq(schema.loanLeads.funnelStage, funnelStage as string));
      if (productId) conditions.push(eq(schema.loanLeads.productId, productId as string));
      if (assignedToStaffId) conditions.push(eq(schema.loanLeads.assignedToStaffId, assignedToStaffId as string));
      if (isConverted !== undefined) conditions.push(eq(schema.loanLeads.isConverted, isConverted === 'true'));
      
      const leads = await db.select()
        .from(schema.loanLeads)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.loanLeads.createdAt))
        .limit(parseInt(limit as string))
        .offset((parseInt(page as string) - 1) * parseInt(limit as string));
      
      res.json({ success: true, data: leads });
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch leads' });
    }
  });

  // Lead funnel analytics
  app.get('/api/admin/loan-marketplace/leads/analytics', requireAdmin, async (req: Request, res: Response) => {
    try {
      const leads = await db.select().from(schema.loanLeads);
      
      const analytics = {
        total: leads.length,
        byStage: {} as Record<string, number>,
        bySource: {} as Record<string, number>,
        converted: 0,
        conversionRate: 0,
        avgLeadScore: 0,
      };

      let totalScore = 0;
      for (const lead of leads) {
        analytics.byStage[lead.funnelStage] = (analytics.byStage[lead.funnelStage] || 0) + 1;
        analytics.bySource[lead.source] = (analytics.bySource[lead.source] || 0) + 1;
        if (lead.isConverted) analytics.converted += 1;
        totalScore += lead.leadScore || 0;
      }

      analytics.conversionRate = leads.length > 0 ? (analytics.converted / leads.length) * 100 : 0;
      analytics.avgLeadScore = leads.length > 0 ? totalScore / leads.length : 0;

      res.json({ success: true, data: analytics });
    } catch (error: any) {
      console.error('Error fetching lead analytics:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch lead analytics' });
    }
  });

  console.log('[LoanAdmin] Loan marketplace admin routes registered');
}
