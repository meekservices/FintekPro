import { db } from "../db";
import { 
  commissionPayments, 
  commissionPaymentBatches,
  loanCommissionLedger,
  InsertCommissionPayments,
  InsertCommissionPaymentBatches 
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, isNull, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { loanCommissionService } from "./loan-commission-service";

export interface PaymentStatementRow {
  applicationId?: string;
  loanId?: string;
  borrowerName?: string;
  loanAmount?: number;
  disbursementDate?: string;
  commissionAmount: number;
  utrNumber?: string;
  paymentDate: string;
  paymentMode?: string;
  remarks?: string;
}

export interface ReconciliationResult {
  totalProcessed: number;
  matched: number;
  partial: number;
  unmatched: number;
  disputed: number;
  totalAmount: number;
  matchedAmount: number;
  errors: string[];
}

export interface ReconciliationSummary {
  totalCommissions: number;
  totalExpected: number;
  totalReceived: number;
  pendingReconciliation: number;
  matchedCount: number;
  unmatchedCount: number;
  disputedCount: number;
  partialCount: number;
  overduePayments: number;
  avgDaysToPayment: number;
  disputeRate: number;
}

class CommissionReconciliationService {
  private defaultTolerance = 100;

  async processPaymentStatement(
    rows: PaymentStatementRow[],
    sourceType: string,
    paidBy: 'bank' | 'master_dsa',
    fileName: string,
    uploadedBy?: string
  ): Promise<ReconciliationResult> {
    const batch = await this.createBatch(fileName, 'bank_statement', sourceType, uploadedBy);
    
    const result: ReconciliationResult = {
      totalProcessed: 0,
      matched: 0,
      partial: 0,
      unmatched: 0,
      disputed: 0,
      totalAmount: 0,
      matchedAmount: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      result.totalProcessed++;
      result.totalAmount += row.commissionAmount;

      try {
        const paymentResult = await this.processPaymentRow(row, paidBy, sourceType, batch.id, i + 1, fileName);
        
        if (paymentResult.matchStatus === 'matched') {
          result.matched++;
          result.matchedAmount += row.commissionAmount;
        } else if (paymentResult.matchStatus === 'partial') {
          result.partial++;
        } else if (paymentResult.matchStatus === 'disputed') {
          result.disputed++;
        } else {
          result.unmatched++;
        }
      } catch (error: any) {
        result.errors.push(`Row ${i + 1}: ${error.message}`);
        result.unmatched++;
      }
    }

    await this.updateBatch(batch.id, {
      status: 'completed',
      processedRows: result.totalProcessed,
      matchedRows: result.matched,
      unmatchedRows: result.unmatched,
      disputedRows: result.disputed,
      totalAmount: result.totalAmount.toString(),
      matchedAmount: result.matchedAmount.toString(),
      processedAt: new Date(),
    });

    return result;
  }

  private async processPaymentRow(
    row: PaymentStatementRow,
    paidBy: 'bank' | 'master_dsa',
    payerName: string,
    batchId: string,
    rowNum: number,
    sourceFileName?: string
  ): Promise<any> {
    let commissionLedgerId: string | null = null;
    let expectedAmount = 0;
    let matchStatus = 'unmatched';
    let matchVariance = 0;

    if (row.applicationId) {
      // Use raw SQL to avoid Drizzle ORM issues
      const ledgerResult = await db.execute(sql`
        SELECT id, net_commission FROM loan_commission_ledger 
        WHERE application_id = ${row.applicationId}
      `);
      const ledgerEntries = ledgerResult.rows as any[];

      if (ledgerEntries.length > 0) {
        const ledgerEntry = ledgerEntries[0];
        commissionLedgerId = ledgerEntry.id;
        expectedAmount = parseFloat(ledgerEntry.net_commission) || 0;
        matchVariance = row.commissionAmount - expectedAmount;

        if (Math.abs(matchVariance) <= this.defaultTolerance) {
          matchStatus = 'matched';
        } else if (row.commissionAmount > 0 && row.commissionAmount < expectedAmount) {
          matchStatus = 'partial';
        } else {
          matchStatus = 'disputed';
        }
      }
    }

    const paymentDate = new Date(row.paymentDate).toISOString();
    const now = new Date().toISOString();
    const id = nanoid();

    // Use raw SQL for insert
    await db.execute(sql`
      INSERT INTO commission_payments (
        id, commission_ledger_id, application_id, paid_by, payer_name, payer_reference,
        expected_amount, paid_amount, payment_date, utr_number, payment_mode,
        match_status, match_variance, matched_at, matched_by, tolerance_amount,
        revenue_status, recognized_date, source_file_name, source_file_row_num,
        upload_batch_id, notes, created_at, updated_at
      ) VALUES (
        ${id}, ${commissionLedgerId}, ${row.applicationId || null}, ${paidBy}, ${payerName}, ${row.utrNumber || null},
        ${expectedAmount.toString()}, ${row.commissionAmount.toString()}, ${paymentDate}, ${row.utrNumber || null}, ${row.paymentMode || null},
        ${matchStatus}, ${matchVariance.toString()}, ${matchStatus === 'matched' ? now : null}, ${matchStatus === 'matched' ? 'system' : null}, ${this.defaultTolerance.toString()},
        ${matchStatus === 'matched' ? 'realized' : 'accrued'}, ${matchStatus === 'matched' ? now : null}, ${sourceFileName || null}, ${rowNum},
        ${batchId}, ${row.remarks || null}, ${now}, ${now}
      )
    `);

    if (commissionLedgerId && matchStatus === 'matched') {
      await loanCommissionService.updateCommissionStatus(
        commissionLedgerId,
        'paid',
        undefined,
        undefined
      );
    }

    return { id, matchStatus };
  }

  private async createBatch(
    fileName: string,
    fileType: string,
    sourceType: string,
    uploadedBy?: string
  ): Promise<any> {
    const [batch] = await db
      .insert(commissionPaymentBatches)
      .values({
        fileName,
        fileType,
        sourceType,
        status: 'processing',
        uploadedBy,
      })
      .returning();
    return batch;
  }

  private async updateBatch(id: string, updates: any): Promise<void> {
    await db
      .update(commissionPaymentBatches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commissionPaymentBatches.id, id));
  }

  async getReconciliationSummary(): Promise<ReconciliationSummary> {
    // Use raw SQL to avoid Drizzle ORM schema issues
    const paymentsResult = await db.execute(sql`
      SELECT id, paid_amount, match_status, matched_at, payment_date, commission_ledger_id
      FROM commission_payments
    `);
    const payments = paymentsResult.rows as any[];
    
    const ledgerResult = await db.execute(sql`
      SELECT id, net_commission, status, created_at
      FROM loan_commission_ledger
    `);
    const ledgerEntries = ledgerResult.rows as any[];

    let totalReceived = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let disputedCount = 0;
    let partialCount = 0;
    let totalDaysToPayment = 0;
    let paymentCount = 0;

    for (const payment of payments) {
      totalReceived += parseFloat(payment.paid_amount) || 0;
      
      if (payment.match_status === 'matched') matchedCount++;
      else if (payment.match_status === 'unmatched') unmatchedCount++;
      else if (payment.match_status === 'disputed') disputedCount++;
      else if (payment.match_status === 'partial') partialCount++;

      if (payment.matched_at && payment.payment_date) {
        const days = Math.floor(
          (new Date(payment.matched_at).getTime() - new Date(payment.payment_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        totalDaysToPayment += Math.abs(days);
        paymentCount++;
      }
    }

    const totalExpected = ledgerEntries.reduce(
      (sum, e) => sum + (parseFloat(e.net_commission) || 0), 
      0
    );

    const matchedLedgerIds = new Set(
      payments
        .filter(p => p.match_status === 'matched' && p.commission_ledger_id)
        .map(p => p.commission_ledger_id)
    );

    const pendingReconciliation = ledgerEntries.filter(
      e => !matchedLedgerIds.has(e.id) && (e.status === 'approved' || e.status === 'pending')
    ).length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const overduePayments = ledgerEntries.filter(e => {
      if (matchedLedgerIds.has(e.id)) return false;
      if (e.status !== 'approved') return false;
      const createdAt = new Date(e.created_at!);
      return createdAt < thirtyDaysAgo;
    }).length;

    return {
      totalCommissions: ledgerEntries.length,
      totalExpected,
      totalReceived,
      pendingReconciliation,
      matchedCount,
      unmatchedCount,
      disputedCount,
      partialCount,
      overduePayments,
      avgDaysToPayment: paymentCount > 0 ? Math.round(totalDaysToPayment / paymentCount) : 0,
      disputeRate: payments.length > 0 
        ? Math.round((disputedCount / payments.length) * 100 * 10) / 10 
        : 0,
    };
  }

  async getPayments(filters?: {
    matchStatus?: string;
    paidBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    // Use parameterized queries for security
    let result;
    
    if (filters?.matchStatus && filters?.paidBy) {
      result = await db.execute(sql`
        SELECT * FROM commission_payments 
        WHERE match_status = ${filters.matchStatus} AND paid_by = ${filters.paidBy}
        ORDER BY created_at DESC
      `);
    } else if (filters?.matchStatus) {
      result = await db.execute(sql`
        SELECT * FROM commission_payments 
        WHERE match_status = ${filters.matchStatus}
        ORDER BY created_at DESC
      `);
    } else if (filters?.paidBy) {
      result = await db.execute(sql`
        SELECT * FROM commission_payments 
        WHERE paid_by = ${filters.paidBy}
        ORDER BY created_at DESC
      `);
    } else {
      result = await db.execute(sql`
        SELECT * FROM commission_payments ORDER BY created_at DESC
      `);
    }
    
    // Transform snake_case to camelCase for frontend compatibility
    return (result.rows as any[]).map(row => ({
      id: row.id,
      commissionLedgerId: row.commission_ledger_id,
      applicationId: row.application_id,
      paidBy: row.paid_by,
      payerName: row.payer_name,
      payerReference: row.payer_reference,
      expectedAmount: row.expected_amount,
      paidAmount: row.paid_amount,
      paymentDate: row.payment_date,
      utrNumber: row.utr_number,
      paymentMode: row.payment_mode,
      matchStatus: row.match_status,
      matchVariance: row.match_variance,
      matchedAt: row.matched_at,
      matchedBy: row.matched_by,
      toleranceAmount: row.tolerance_amount,
      disputeReason: row.dispute_reason,
      disputeRaisedAt: row.dispute_raised_at,
      disputeResolvedAt: row.dispute_resolved_at,
      disputeResolution: row.dispute_resolution,
      revenueStatus: row.revenue_status,
      recognizedDate: row.recognized_date,
      sourceFileName: row.source_file_name,
      sourceFileRowNum: row.source_file_row_num,
      uploadBatchId: row.upload_batch_id,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getUnmatchedPayments(): Promise<any[]> {
    return this.getPayments({ matchStatus: 'unmatched' });
  }

  async getDisputedPayments(): Promise<any[]> {
    return this.getPayments({ matchStatus: 'disputed' });
  }

  async getOverdueCommissions(daysOverdue: number = 30): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    // Use raw SQL to avoid Drizzle ORM issues
    const paymentsResult = await db.execute(sql`
      SELECT commission_ledger_id, match_status FROM commission_payments
    `);
    const allPayments = paymentsResult.rows as any[];
    
    const matchedLedgerIds = new Set(
      allPayments
        .filter(p => p.match_status === 'matched' && p.commission_ledger_id)
        .map(p => p.commission_ledger_id)
    );

    const ledgerResult = await db.execute(sql`
      SELECT * FROM loan_commission_ledger 
      WHERE created_at <= ${cutoffDate.toISOString()}
      AND status = 'approved'
    `);
    const ledgerEntries = ledgerResult.rows as any[];

    // Transform snake_case to camelCase and filter
    return ledgerEntries
      .filter(e => !matchedLedgerIds.has(e.id))
      .map(row => ({
        id: row.id,
        applicationId: row.application_id,
        commissionConfigId: row.commission_config_id,
        providerId: row.provider_id,
        productId: row.product_id,
        loanAmount: row.loan_amount,
        disbursementDate: row.disbursement_date,
        commissionableBase: row.commissionable_base,
        commissionRate: row.commission_rate,
        grossCommission: row.gross_commission,
        tdsRate: row.tds_rate,
        tdsAmount: row.tds_amount,
        netCommission: row.net_commission,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  async manualMatch(paymentId: string, commissionLedgerId: string, userId: string): Promise<void> {
    // Use raw SQL to avoid Drizzle ORM issues
    const paymentResult = await db.execute(sql`
      SELECT * FROM commission_payments WHERE id = ${paymentId}
    `);
    const payment = paymentResult.rows[0] as any;

    if (!payment) throw new Error('Payment not found');

    const ledgerResult = await db.execute(sql`
      SELECT * FROM loan_commission_ledger WHERE id = ${commissionLedgerId}
    `);
    const ledgerEntry = ledgerResult.rows[0] as any;

    if (!ledgerEntry) throw new Error('Commission ledger entry not found');

    const expectedAmount = parseFloat(ledgerEntry.net_commission) || 0;
    const paidAmount = parseFloat(payment.paid_amount) || 0;
    const variance = paidAmount - expectedAmount;
    const matchStatus = Math.abs(variance) <= this.defaultTolerance ? 'matched' : 'partial';
    const now = new Date().toISOString();

    await db.execute(sql`
      UPDATE commission_payments SET
        commission_ledger_id = ${commissionLedgerId},
        expected_amount = ${expectedAmount.toString()},
        match_status = ${matchStatus},
        match_variance = ${variance.toString()},
        matched_at = ${now},
        matched_by = ${userId},
        revenue_status = 'realized',
        recognized_date = ${now},
        updated_at = ${now}
      WHERE id = ${paymentId}
    `);

    await loanCommissionService.updateCommissionStatus(
      commissionLedgerId,
      'paid',
      undefined,
      undefined
    );
  }

  async raiseDispute(paymentId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    await db.execute(sql`
      UPDATE commission_payments SET
        match_status = 'disputed',
        dispute_reason = ${reason},
        dispute_raised_at = ${now},
        revenue_status = 'suspense',
        updated_at = ${now}
      WHERE id = ${paymentId}
    `);
  }

  async resolveDispute(paymentId: string, resolution: string, finalStatus: 'matched' | 'partial'): Promise<void> {
    const now = new Date().toISOString();
    await db.execute(sql`
      UPDATE commission_payments SET
        match_status = ${finalStatus},
        dispute_resolution = ${resolution},
        dispute_resolved_at = ${now},
        revenue_status = 'realized',
        recognized_date = ${now},
        updated_at = ${now}
      WHERE id = ${paymentId}
    `);
  }

  async getBatches(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM commission_payment_batches ORDER BY created_at DESC
    `);
    // Transform snake_case to camelCase
    return (result.rows as any[]).map(row => ({
      id: row.id,
      fileName: row.file_name,
      fileType: row.file_type,
      sourceType: row.source_type,
      totalRows: row.total_rows,
      processedRows: row.processed_rows,
      matchedRows: row.matched_rows,
      unmatchedRows: row.unmatched_rows,
      disputedRows: row.disputed_rows,
      totalAmount: row.total_amount,
      matchedAmount: row.matched_amount,
      status: row.status,
      processedAt: row.processed_at,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getKPIs(): Promise<{
    approvalToDisbursementRate: number;
    avgCommissionPerLoan: number;
    avgDaysToPayment: number;
    disputeRate: number;
    monthlyTrend: Array<{ month: string; amount: number; count: number }>;
  }> {
    const summary = await this.getReconciliationSummary();
    
    // Use raw SQL to avoid Drizzle ORM issues
    const ledgerResult = await db.execute(sql`
      SELECT id, net_commission, created_at FROM loan_commission_ledger
    `);
    const ledgerEntries = ledgerResult.rows as any[];

    const monthlyData: Record<string, { amount: number; count: number }> = {};
    
    for (const entry of ledgerEntries) {
      if (entry.created_at) {
        const month = new Date(entry.created_at).toISOString().slice(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { amount: 0, count: 0 };
        }
        monthlyData[month].amount += parseFloat(entry.net_commission) || 0;
        monthlyData[month].count++;
      }
    }

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));

    const totalLoans = ledgerEntries.length;
    const avgCommission = totalLoans > 0 
      ? summary.totalExpected / totalLoans 
      : 0;

    return {
      approvalToDisbursementRate: totalLoans > 0 
        ? Math.round((summary.matchedCount / totalLoans) * 100) 
        : 0,
      avgCommissionPerLoan: Math.round(avgCommission),
      avgDaysToPayment: summary.avgDaysToPayment,
      disputeRate: summary.disputeRate,
      monthlyTrend,
    };
  }
}

export const commissionReconciliationService = new CommissionReconciliationService();
