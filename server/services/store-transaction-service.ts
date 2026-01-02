import { db } from '../db';
import { storeTransactionLogs, storeCategories, users } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

type TransactionType = 'purchase' | 'cart_add' | 'cart_remove' | 'inquiry' | 'proposal_accept' | 'proposal_reject' | 'checkout' | 'payment';
type TransactionSource = 'client_direct' | 'ai_recommendation' | 'agent_proposal' | 'self_requested';
type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';

interface TransactionLogParams {
  transactionType: TransactionType;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userPan?: string;
  productCategory: string;
  categoryId?: string;
  productId?: string;
  productName?: string;
  productIsin?: string;
  amount?: string;
  quantity?: number;
  unitPrice?: string;
  source: TransactionSource;
  sourceProposalId?: string;
  sourceAgentId?: string;
  sourcePartnerId?: string;
  status?: TransactionStatus;
  statusReason?: string;
  commissionAmount?: string;
  commissionType?: string;
  commissionAgentId?: string;
  commissionPartnerId?: string;
  regulatoryType?: string;
  consentTimestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
  metadata?: any;
}

interface ZohoSyncParams {
  transactionId: string;
  zohoInvoiceId?: string;
  zohoBillId?: string;
  status: 'pending' | 'synced' | 'failed' | 'not_applicable';
  error?: string;
}

class StoreTransactionService {
  private lastChecksum: string | null = null;

  private generateTransactionId(): string {
    const prefix = 'TXN';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = nanoid(8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private generateChecksum(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private maskPan(pan?: string): string | undefined {
    if (!pan || pan.length < 10) return pan;
    return `${pan.slice(0, 4)}XXXX${pan.slice(-2)}`;
  }

  async logTransaction(params: TransactionLogParams): Promise<string> {
    try {
      const transactionId = this.generateTransactionId();
      
      const recordData = {
        transactionId,
        transactionType: params.transactionType,
        userId: params.userId,
        userEmail: params.userEmail,
        userName: params.userName,
        userPan: this.maskPan(params.userPan),
        productCategory: params.productCategory,
        categoryId: params.categoryId,
        productId: params.productId,
        productName: params.productName,
        productIsin: params.productIsin,
        amount: params.amount,
        quantity: params.quantity,
        unitPrice: params.unitPrice,
        currency: 'INR',
        source: params.source,
        sourceProposalId: params.sourceProposalId,
        sourceAgentId: params.sourceAgentId,
        sourcePartnerId: params.sourcePartnerId,
        status: params.status || 'pending',
        statusReason: params.statusReason,
        commissionAmount: params.commissionAmount,
        commissionType: params.commissionType,
        commissionAgentId: params.commissionAgentId,
        commissionPartnerId: params.commissionPartnerId,
        regulatoryType: params.regulatoryType,
        consentTimestamp: params.consentTimestamp,
        consentIpAddress: params.ipAddress,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceFingerprint: params.deviceFingerprint,
        sessionId: params.sessionId,
        metadata: params.metadata,
        previousChecksum: this.lastChecksum,
      };

      const checksum = this.generateChecksum(recordData);
      
      await db.insert(storeTransactionLogs).values({
        ...recordData,
        checksum,
        consentChecksum: params.consentTimestamp ? this.generateChecksum({ 
          userId: params.userId, 
          timestamp: params.consentTimestamp,
          ip: params.ipAddress 
        }) : undefined,
      });

      this.lastChecksum = checksum;
      
      console.log(`[StoreTransaction] Logged: ${transactionId} - ${params.transactionType} - ${params.productCategory}`);
      return transactionId;
    } catch (error: any) {
      console.error('[StoreTransaction] Error logging transaction:', error);
      throw error;
    }
  }

  async updateTransactionStatus(
    transactionId: string, 
    status: TransactionStatus, 
    reason?: string
  ): Promise<void> {
    await db.update(storeTransactionLogs)
      .set({ 
        status, 
        statusReason: reason,
        updatedAt: new Date(),
        completedAt: status === 'completed' ? new Date() : undefined
      })
      .where(eq(storeTransactionLogs.transactionId, transactionId));
  }

  async updateZohoSync(params: ZohoSyncParams): Promise<void> {
    await db.update(storeTransactionLogs)
      .set({ 
        zohoInvoiceId: params.zohoInvoiceId,
        zohoBillId: params.zohoBillId,
        zohoSyncStatus: params.status,
        zohoSyncedAt: params.status === 'synced' ? new Date() : undefined,
        zohoSyncError: params.error,
        updatedAt: new Date()
      })
      .where(eq(storeTransactionLogs.transactionId, params.transactionId));
  }

  async getTransactionsByUser(userId: string, options?: {
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const conditions: any[] = [eq(storeTransactionLogs.userId, userId)];
    
    if (options?.category) {
      conditions.push(eq(storeTransactionLogs.productCategory, options.category));
    }
    if (options?.startDate) {
      conditions.push(gte(storeTransactionLogs.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(storeTransactionLogs.createdAt, options.endDate));
    }

    const transactions = await db.select()
      .from(storeTransactionLogs)
      .where(and(...conditions))
      .orderBy(desc(storeTransactionLogs.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(storeTransactionLogs)
      .where(and(...conditions));

    return {
      transactions,
      total: countResult[0]?.count || 0,
      hasMore: (options?.offset || 0) + transactions.length < (countResult[0]?.count || 0)
    };
  }

  async getTransactionSummary(userId: string) {
    const result = await db.select({
      category: storeTransactionLogs.productCategory,
      totalAmount: sql<string>`SUM(CAST(${storeTransactionLogs.amount} AS NUMERIC))`,
      count: sql<number>`COUNT(*)`,
    })
      .from(storeTransactionLogs)
      .where(and(
        eq(storeTransactionLogs.userId, userId),
        eq(storeTransactionLogs.status, 'completed')
      ))
      .groupBy(storeTransactionLogs.productCategory);

    return result;
  }

  async getPendingZohoSync(limit: number = 100) {
    return db.select()
      .from(storeTransactionLogs)
      .where(and(
        eq(storeTransactionLogs.zohoSyncStatus, 'pending'),
        eq(storeTransactionLogs.status, 'completed')
      ))
      .orderBy(storeTransactionLogs.createdAt)
      .limit(limit);
  }

  async getAuditTrail(transactionId: string) {
    const [transaction] = await db.select()
      .from(storeTransactionLogs)
      .where(eq(storeTransactionLogs.transactionId, transactionId))
      .limit(1);

    if (!transaction) return null;

    const isValid = transaction.checksum === this.generateChecksum({
      transactionId: transaction.transactionId,
      transactionType: transaction.transactionType,
      userId: transaction.userId,
      productCategory: transaction.productCategory,
      amount: transaction.amount,
      source: transaction.source,
      status: transaction.status,
    });

    return {
      ...transaction,
      integrityValid: isValid,
    };
  }
}

export const storeTransactionService = new StoreTransactionService();
