import { db } from '../db';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import {
  mcaDirectPayments,
  mcaCompanyMaster,
  type McaDirectPayment,
  type InsertMcaDirectPayment,
} from '@shared/schema';
import { getZohoBooksService } from '../zoho/services/books';
import { nanoid } from 'nanoid';

export type McaFeeType = 
  | 'AOC-4'           // Annual Financial Statements
  | 'AOC-4-XBRL'      // XBRL Financial Statements
  | 'MGT-7'           // Annual Return
  | 'MGT-7A'          // Annual Return for OPC/Small Company
  | 'DIR-3-KYC'       // Director KYC
  | 'ADT-1'           // Appointment of Auditor
  | 'CHG-1'           // Creation/Modification of Charge
  | 'CHG-4'           // Satisfaction of Charge
  | 'SH-7'            // Increase in Authorized Capital
  | 'INC-20A'         // Declaration for Commencement
  | 'DPT-3'           // Return of Deposits
  | 'MSME-1'          // Half-yearly MSME Return
  | 'LLP-8'           // LLP Statement of Accounts
  | 'LLP-11'          // LLP Annual Return
  | 'OTHER';

export interface InitiatePaymentParams {
  cin: string;
  companyName?: string;
  feeType: McaFeeType;
  filingYear?: string;
  amount: number;
  initiatedBy: string;
  initiatedByUserId?: string;
  notes?: string;
}

export interface ConfirmPaymentParams {
  paymentId: string;
  mcaChallanNumber: string;
  mcaTransactionId?: string;
  mcaPaymentDate: string;
  paymentMode?: string;
  bankName?: string;
  mcaReceiptUrl?: string;
  confirmedBy: string;
  notes?: string;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  pendingConfirmation: number;
  confirmed: number;
  syncedToZoho: number;
  failedSync: number;
}

export interface ReconciliationReport {
  period: { from: string; to: string };
  summary: PaymentSummary;
  payments: McaDirectPayment[];
  zohoMismatches: Array<{
    paymentId: string;
    issue: string;
  }>;
}

const MCA_FEE_DESCRIPTIONS: Record<McaFeeType, string> = {
  'AOC-4': 'Annual Financial Statements Filing',
  'AOC-4-XBRL': 'XBRL Financial Statements Filing',
  'MGT-7': 'Annual Return Filing',
  'MGT-7A': 'Annual Return (OPC/Small Company)',
  'DIR-3-KYC': 'Director KYC Update',
  'ADT-1': 'Auditor Appointment',
  'CHG-1': 'Charge Creation/Modification',
  'CHG-4': 'Charge Satisfaction',
  'SH-7': 'Authorized Capital Increase',
  'INC-20A': 'Business Commencement Declaration',
  'DPT-3': 'Deposits Return',
  'MSME-1': 'MSME Half-yearly Return',
  'LLP-8': 'LLP Statement of Accounts',
  'LLP-11': 'LLP Annual Return',
  'OTHER': 'Other MCA Filing',
};

const MCA_PORTAL_URL = 'https://www.mca.gov.in/mcafoportal/login.do';

class McaDirectPaymentService {
  constructor() {
    console.log('✅ MCA Direct Payment Service initialized');
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<{
    success: boolean;
    payment?: McaDirectPayment;
    mcaPortalUrl: string;
    error?: string;
  }> {
    try {
      let companyName = params.companyName;
      if (!companyName) {
        const company = await db
          .select({ companyName: mcaCompanyMaster.companyName })
          .from(mcaCompanyMaster)
          .where(eq(mcaCompanyMaster.cin, params.cin))
          .limit(1);
        companyName = company[0]?.companyName || params.cin;
      }

      const [payment] = await db.insert(mcaDirectPayments).values({
        cin: params.cin,
        companyName,
        feeType: params.feeType,
        filingYear: params.filingYear,
        amount: params.amount.toString(),
        currency: 'INR',
        status: 'initiated',
        initiatedBy: params.initiatedBy,
        initiatedByUserId: params.initiatedByUserId,
        notes: params.notes,
        zohoSyncStatus: 'pending',
      }).returning();

      console.log(`[MCA Direct Payment] Initiated payment ${payment.id} for ${params.cin} - ${params.feeType} - ₹${params.amount}`);

      return {
        success: true,
        payment,
        mcaPortalUrl: MCA_PORTAL_URL,
      };
    } catch (error: any) {
      console.error('[MCA Direct Payment] Error initiating payment:', error.message);
      return {
        success: false,
        mcaPortalUrl: MCA_PORTAL_URL,
        error: error.message,
      };
    }
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<{
    success: boolean;
    payment?: McaDirectPayment;
    zohoSynced?: boolean;
    error?: string;
  }> {
    try {
      const existing = await db
        .select()
        .from(mcaDirectPayments)
        .where(eq(mcaDirectPayments.id, params.paymentId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, error: 'Payment not found' };
      }

      const payment = existing[0];
      if (payment.status === 'confirmed') {
        return { success: false, error: 'Payment already confirmed' };
      }

      const [updated] = await db
        .update(mcaDirectPayments)
        .set({
          status: 'confirmed',
          mcaChallanNumber: params.mcaChallanNumber,
          mcaTransactionId: params.mcaTransactionId,
          mcaPaymentDate: params.mcaPaymentDate,
          paymentMode: params.paymentMode,
          bankName: params.bankName,
          mcaReceiptUrl: params.mcaReceiptUrl,
          confirmedBy: params.confirmedBy,
          confirmedAt: new Date(),
          notes: params.notes || payment.notes,
          updatedAt: new Date(),
        })
        .where(eq(mcaDirectPayments.id, params.paymentId))
        .returning();

      console.log(`[MCA Direct Payment] Confirmed payment ${params.paymentId} - Challan: ${params.mcaChallanNumber}`);

      let zohoSynced = false;
      try {
        await this.syncToZohoBooks(updated);
        zohoSynced = true;
      } catch (zohoError: any) {
        console.error('[MCA Direct Payment] Zoho sync failed:', zohoError.message);
      }

      return {
        success: true,
        payment: updated,
        zohoSynced,
      };
    } catch (error: any) {
      console.error('[MCA Direct Payment] Error confirming payment:', error.message);
      return { success: false, error: error.message };
    }
  }

  async syncToZohoBooks(payment: McaDirectPayment): Promise<{
    success: boolean;
    expenseId?: string;
    error?: string;
  }> {
    try {
      const zohoConnectionId = process.env.ZOHO_CONNECTION_ID;
      const zohoOrganizationId = process.env.ZOHO_ORGANIZATION_ID || process.env.ZOHO_ZSOID;
      
      if (!zohoConnectionId || !zohoOrganizationId) {
        await db
          .update(mcaDirectPayments)
          .set({
            zohoSyncStatus: 'skipped',
            zohoSyncError: 'Zoho Books not configured',
            updatedAt: new Date(),
          })
          .where(eq(mcaDirectPayments.id, payment.id));
        
        return { success: false, error: 'Zoho Books not configured' };
      }

      const booksService = getZohoBooksService(zohoConnectionId, zohoOrganizationId);
      
      const mcaVendor = await booksService.findOrCreateContact({
        contact_name: 'Ministry of Corporate Affairs (MCA)',
        contact_type: 'vendor',
      });

      const feeDescription = MCA_FEE_DESCRIPTIONS[payment.feeType as McaFeeType] || payment.feeType;
      const description = `${feeDescription} - ${payment.companyName || payment.cin}${payment.filingYear ? ` (FY ${payment.filingYear})` : ''} - Challan: ${payment.mcaChallanNumber || 'Pending'}`;

      const expense = await booksService.createExpense({
        account_id: '', // Will use default expense account
        date: payment.mcaPaymentDate || new Date().toISOString().split('T')[0],
        amount: parseFloat(payment.amount),
        vendor_id: mcaVendor.contact_id,
        description,
        reference_number: payment.mcaChallanNumber || payment.id,
      });

      await db
        .update(mcaDirectPayments)
        .set({
          zohoExpenseId: expense.expense_id,
          zohoSyncStatus: 'synced',
          zohoSyncError: null,
          zohoSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mcaDirectPayments.id, payment.id));

      console.log(`[MCA Direct Payment] Synced to Zoho Books: ${expense.expense_id}`);

      return { success: true, expenseId: expense.expense_id };
    } catch (error: any) {
      console.error('[MCA Direct Payment] Zoho sync error:', error.message);
      
      await db
        .update(mcaDirectPayments)
        .set({
          zohoSyncStatus: 'failed',
          zohoSyncError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(mcaDirectPayments.id, payment.id));

      return { success: false, error: error.message };
    }
  }

  async retryZohoSync(paymentId: string): Promise<{
    success: boolean;
    expenseId?: string;
    error?: string;
  }> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }
    if (payment.status !== 'confirmed') {
      return { success: false, error: 'Payment must be confirmed before syncing to Zoho' };
    }
    return this.syncToZohoBooks(payment);
  }

  async getPayment(paymentId: string): Promise<McaDirectPayment | null> {
    const result = await db
      .select()
      .from(mcaDirectPayments)
      .where(eq(mcaDirectPayments.id, paymentId))
      .limit(1);
    return result[0] || null;
  }

  async getPaymentsByCin(cin: string): Promise<McaDirectPayment[]> {
    return db
      .select()
      .from(mcaDirectPayments)
      .where(eq(mcaDirectPayments.cin, cin))
      .orderBy(desc(mcaDirectPayments.createdAt));
  }

  async getPaymentsByStatus(status: string): Promise<McaDirectPayment[]> {
    return db
      .select()
      .from(mcaDirectPayments)
      .where(eq(mcaDirectPayments.status, status))
      .orderBy(desc(mcaDirectPayments.createdAt));
  }

  async getPendingConfirmations(): Promise<McaDirectPayment[]> {
    return db
      .select()
      .from(mcaDirectPayments)
      .where(eq(mcaDirectPayments.status, 'initiated'))
      .orderBy(desc(mcaDirectPayments.createdAt));
  }

  async getPaymentHistory(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    feeType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{ payments: McaDirectPayment[]; total: number }> {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    let query = db.select().from(mcaDirectPayments);
    
    const conditions = [];
    if (params?.status) {
      conditions.push(eq(mcaDirectPayments.status, params.status));
    }
    if (params?.feeType) {
      conditions.push(eq(mcaDirectPayments.feeType, params.feeType));
    }
    if (params?.fromDate) {
      conditions.push(gte(mcaDirectPayments.createdAt, new Date(params.fromDate)));
    }
    if (params?.toDate) {
      conditions.push(lte(mcaDirectPayments.createdAt, new Date(params.toDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const payments = await query
      .orderBy(desc(mcaDirectPayments.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcaDirectPayments);
    
    return {
      payments,
      total: Number(countResult[0]?.count || 0),
    };
  }

  async getPaymentSummary(): Promise<PaymentSummary> {
    const payments = await db.select().from(mcaDirectPayments);
    
    return {
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      pendingConfirmation: payments.filter(p => p.status === 'initiated').length,
      confirmed: payments.filter(p => p.status === 'confirmed').length,
      syncedToZoho: payments.filter(p => p.zohoSyncStatus === 'synced').length,
      failedSync: payments.filter(p => p.zohoSyncStatus === 'failed').length,
    };
  }

  async getReconciliationReport(fromDate: string, toDate: string): Promise<ReconciliationReport> {
    const payments = await db
      .select()
      .from(mcaDirectPayments)
      .where(
        and(
          gte(mcaDirectPayments.createdAt, new Date(fromDate)),
          lte(mcaDirectPayments.createdAt, new Date(toDate))
        )
      )
      .orderBy(desc(mcaDirectPayments.createdAt));

    const zohoMismatches = payments
      .filter(p => p.status === 'confirmed' && p.zohoSyncStatus !== 'synced')
      .map(p => ({
        paymentId: p.id,
        issue: p.zohoSyncStatus === 'failed' 
          ? `Sync failed: ${p.zohoSyncError}` 
          : 'Not synced to Zoho Books',
      }));

    return {
      period: { from: fromDate, to: toDate },
      summary: {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        pendingConfirmation: payments.filter(p => p.status === 'initiated').length,
        confirmed: payments.filter(p => p.status === 'confirmed').length,
        syncedToZoho: payments.filter(p => p.zohoSyncStatus === 'synced').length,
        failedSync: payments.filter(p => p.zohoSyncStatus === 'failed').length,
      },
      payments,
      zohoMismatches,
    };
  }

  async cancelPayment(paymentId: string, reason: string, cancelledBy: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const existing = await this.getPayment(paymentId);
      if (!existing) {
        return { success: false, error: 'Payment not found' };
      }
      if (existing.status === 'confirmed') {
        return { success: false, error: 'Cannot cancel confirmed payment' };
      }

      await db
        .update(mcaDirectPayments)
        .set({
          status: 'cancelled',
          notes: `${existing.notes || ''}\n[Cancelled by ${cancelledBy}]: ${reason}`.trim(),
          updatedAt: new Date(),
        })
        .where(eq(mcaDirectPayments.id, paymentId));

      console.log(`[MCA Direct Payment] Cancelled payment ${paymentId}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getFeeTypes(): Array<{ code: McaFeeType; description: string }> {
    return Object.entries(MCA_FEE_DESCRIPTIONS).map(([code, description]) => ({
      code: code as McaFeeType,
      description,
    }));
  }

  getMcaPortalUrl(): string {
    return MCA_PORTAL_URL;
  }
}

export const mcaDirectPaymentService = new McaDirectPaymentService();
