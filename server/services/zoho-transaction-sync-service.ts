import { getZohoBooksService, ZohoBooksService } from '../zoho/services/books';
import { db } from '../db';
import { sql, eq, and, isNull, desc, gte } from 'drizzle-orm';
import * as schema from '@shared/schema';

/**
 * SEBI/RBI Regulatory Compliance for Transaction Sync:
 * 
 * Products where money flows DIRECTLY to AMC/Issuer (no invoice creation):
 * - Mutual Funds: Money goes directly to AMC via BSE/NSE/AMFI
 * - AIF/PMS: Money goes directly to fund manager
 * - IPO: ASBA ensures money flows directly from bank to issuer
 * 
 * Products where FintekPro may handle funds (invoice/bill creation):
 * - Unlisted Shares: When escrow/settlement handled in-house
 * - Bonds: Success/brokerage fees when routed through FintekPro
 * - Loans: Processing fees when FintekPro arranges financing
 * 
 * Revenue Recognition (create invoices):
 * - Distributor commissions from AMC (trail, upfront)
 * - Advisory fees charged to clients
 * - Brokerage fees on transactions
 */

export type ProductType = 'mutual_fund' | 'bond' | 'ipo' | 'unlisted' | 'loan' | 'insurance' | 'commission';
export type TransactionType = 'inflow' | 'outflow' | 'pass_through';

interface TransactionSyncResult {
  success: boolean;
  productType: ProductType;
  transactionId: string;
  zohoInvoiceId?: string;
  zohoBillId?: string;
  syncType: 'invoice' | 'bill' | 'compliance_only' | 'skipped';
  reason?: string;
  error?: string;
}

interface SyncSummary {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: TransactionSyncResult[];
}

class ZohoTransactionSyncService {
  private zohoService: ZohoBooksService | null = null;

  async initialize(): Promise<boolean> {
    this.zohoService = await getZohoBooksService();
    return this.zohoService !== null;
  }

  /**
   * SEBI/AMFI Compliance: Mutual Fund orders
   * Money flows DIRECTLY from investor to AMC via BSE/NSE/AMFI platforms.
   * FintekPro does NOT handle the investment amount.
   * 
   * No invoice/bill creation - only mark transaction as synced for compliance tracking.
   * Revenue recognition happens separately via distributor commission invoices from AMC.
   */
  async syncMutualFundOrder(orderId: string): Promise<TransactionSyncResult> {
    try {
      const [order] = await db.select()
        .from(schema.mfOrders)
        .where(eq(schema.mfOrders.id, orderId))
        .limit(1);

      if (!order) {
        return { 
          success: false, 
          productType: 'mutual_fund', 
          transactionId: orderId, 
          syncType: 'skipped',
          error: 'Order not found' 
        };
      }

      // Skip if already synced (prevent duplicate processing)
      if (order.zohoSyncedAt) {
        return {
          success: true,
          productType: 'mutual_fund',
          transactionId: orderId,
          syncType: 'skipped',
          reason: 'Already synced for compliance tracking'
        };
      }

      // Mark as compliance-tracked (no Zoho invoice/bill - money goes directly to AMC)
      await db.update(schema.mfOrders)
        .set({ 
          zohoSyncedAt: new Date(),
          zohoSyncStatus: 'pass_through'
        })
        .where(eq(schema.mfOrders.id, orderId));

      return { 
        success: true, 
        productType: 'mutual_fund', 
        transactionId: orderId,
        syncType: 'compliance_only',
        reason: 'SEBI/AMFI: Money flows directly to AMC. No invoice required - tracked for compliance only.'
      };
    } catch (error: any) {
      return { 
        success: false, 
        productType: 'mutual_fund', 
        transactionId: orderId, 
        syncType: 'skipped',
        error: error.message 
      };
    }
  }

  /**
   * Bond Orders: 
   * For listed bonds via exchange (NSE/BSE), money flows through exchange clearing.
   * FintekPro may earn brokerage on the transaction.
   * 
   * Invoice only for brokerage/service fees, not the principal bond amount.
   * Principal investment amount is pass-through.
   */
  async syncBondOrder(orderId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }
    
    try {
      const [order] = await db.select()
        .from(schema.bondOrders)
        .where(eq(schema.bondOrders.id, orderId))
        .limit(1);

      if (!order) {
        return { 
          success: false, 
          productType: 'bond', 
          transactionId: orderId, 
          syncType: 'skipped',
          error: 'Order not found' 
        };
      }

      // Skip if already synced (prevent duplicate invoices)
      if (order.zohoSyncedAt || order.zohoInvoiceId) {
        return {
          success: true,
          productType: 'bond',
          transactionId: orderId,
          syncType: 'skipped',
          reason: 'Already synced to Zoho Books'
        };
      }

      // Calculate brokerage fee (typically 0.1% to 0.5% of transaction value)
      const investmentAmount = parseFloat(order.investmentAmount?.toString() || '0');
      const brokerageFee = parseFloat(order.brokerageFee?.toString() || '0');

      // Only create invoice if there's a brokerage fee
      if (brokerageFee > 0 && this.zohoService) {
        const [user] = await db.select()
          .from(schema.users)
          .where(eq(schema.users.id, order.userId))
          .limit(1);

        const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';

        const invoice = await this.zohoService.createInvoice({
          customer_name: customerName,
          reference_number: `BOND-FEE-${order.id.substring(0, 8).toUpperCase()}`,
          date: new Date(order.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Bond Brokerage Fee - ${order.bondName || order.isinCode || 'Bond'}`,
            description: `ISIN: ${order.isinCode || 'N/A'}, Investment: ₹${investmentAmount.toLocaleString()}`,
            rate: brokerageFee,
            quantity: 1
          }],
          notes: `Order ID: ${order.id}, Principal investment flows to exchange (pass-through)`
        });

        await db.update(schema.bondOrders)
          .set({ 
            zohoInvoiceId: invoice.invoice_id,
            zohoSyncedAt: new Date(),
            zohoSyncStatus: 'fee_invoiced'
          })
          .where(eq(schema.bondOrders.id, orderId));

        return { 
          success: true, 
          productType: 'bond', 
          transactionId: orderId, 
          zohoInvoiceId: invoice.invoice_id,
          syncType: 'invoice',
          reason: 'Brokerage fee invoiced. Principal flows through exchange.'
        };
      }

      // No brokerage fee - just mark as synced for compliance
      await db.update(schema.bondOrders)
        .set({ 
          zohoSyncedAt: new Date(),
          zohoSyncStatus: 'pass_through'
        })
        .where(eq(schema.bondOrders.id, orderId));

      return { 
        success: true, 
        productType: 'bond', 
        transactionId: orderId,
        syncType: 'compliance_only',
        reason: 'Principal flows through exchange. No brokerage fee to invoice.'
      };
    } catch (error: any) {
      return { 
        success: false, 
        productType: 'bond', 
        transactionId: orderId, 
        syncType: 'skipped',
        error: error.message 
      };
    }
  }

  /**
   * SEBI Compliance: IPO Applications
   * Under ASBA (Application Supported by Blocked Amount), money is blocked in investor's
   * bank account and flows directly from bank to issuer upon allotment.
   * FintekPro does NOT handle IPO application money.
   * 
   * No invoice/bill creation - only mark transaction as synced for compliance tracking.
   */
  async syncIPOApplication(applicationId: string): Promise<TransactionSyncResult> {
    try {
      const [application] = await db.select()
        .from(schema.ipoApplications)
        .where(eq(schema.ipoApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return { 
          success: false, 
          productType: 'ipo', 
          transactionId: applicationId, 
          syncType: 'skipped',
          error: 'Application not found' 
        };
      }

      // Skip if already synced (prevent duplicate processing)
      if (application.zohoSyncedAt) {
        return {
          success: true,
          productType: 'ipo',
          transactionId: applicationId,
          syncType: 'skipped',
          reason: 'Already synced for compliance tracking'
        };
      }

      // Mark as compliance-tracked (no Zoho invoice/bill - ASBA: money flows directly from bank to issuer)
      await db.update(schema.ipoApplications)
        .set({ 
          zohoSyncedAt: new Date(),
          zohoSyncStatus: 'pass_through'
        })
        .where(eq(schema.ipoApplications.id, applicationId));

      return { 
        success: true, 
        productType: 'ipo', 
        transactionId: applicationId,
        syncType: 'compliance_only',
        reason: 'SEBI ASBA: Money blocked in investor bank, flows directly to issuer. No invoice required.'
      };
    } catch (error: any) {
      return { 
        success: false, 
        productType: 'ipo', 
        transactionId: applicationId, 
        syncType: 'skipped',
        error: error.message 
      };
    }
  }

  /**
   * Unlisted Share Deals:
   * When FintekPro manages escrow for unlisted share transactions, we handle actual money flow.
   * 
   * - If escrowManaged = true: Create invoices/bills for the transaction value
   * - If escrowManaged = false: Only invoice brokerage/facilitation fees
   * 
   * This is one of the few products where FintekPro may handle principal amounts.
   */
  async syncUnlistedDeal(dealId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }

    try {
      const [deal] = await db.select()
        .from(schema.unlistedDeals)
        .where(eq(schema.unlistedDeals.id, dealId))
        .limit(1);

      if (!deal) {
        return { 
          success: false, 
          productType: 'unlisted', 
          transactionId: dealId, 
          syncType: 'skipped',
          error: 'Deal not found' 
        };
      }

      // Skip if already synced (prevent duplicate invoices/bills)
      if (deal.zohoSyncedAt || deal.zohoInvoiceId || deal.zohoBillId) {
        return {
          success: true,
          productType: 'unlisted',
          transactionId: dealId,
          syncType: 'skipped',
          reason: 'Already synced to Zoho Books'
        };
      }

      const totalValue = parseFloat(deal.totalValue?.toString() || '0');
      const brokerageFee = parseFloat(deal.brokerageFee?.toString() || '0');
      const escrowManaged = deal.escrowManaged === true;

      // Only create invoices if FintekPro manages escrow OR has brokerage fees
      if (escrowManaged && this.zohoService) {
        // FintekPro manages escrow - create full transaction invoices/bills
        const isBuyer = deal.dealType === 'buy';

        if (isBuyer) {
          // Invoice to buyer for shares purchased via FintekPro escrow
          const invoice = await this.zohoService.createInvoice({
            customer_name: deal.buyerName || 'Buyer',
            reference_number: `UNL-ESC-${deal.id.substring(0, 8).toUpperCase()}`,
            date: new Date(deal.createdAt || new Date()).toISOString().split('T')[0],
            line_items: [{
              name: `Unlisted Shares (Escrow) - ${deal.companyName || 'Company'}`,
              description: `Quantity: ${deal.quantity || 0}, Price: ₹${deal.pricePerShare || 0}`,
              rate: totalValue,
              quantity: 1
            }],
            notes: `Deal ID: ${deal.id}, Escrow-managed transaction`
          });

          await db.update(schema.unlistedDeals)
            .set({ 
              zohoInvoiceId: invoice.invoice_id,
              zohoSyncedAt: new Date(),
              zohoSyncStatus: 'escrow_invoiced'
            })
            .where(eq(schema.unlistedDeals.id, dealId));

          return { 
            success: true, 
            productType: 'unlisted', 
            transactionId: dealId, 
            zohoInvoiceId: invoice.invoice_id,
            syncType: 'invoice',
            reason: 'Escrow-managed deal. Full transaction invoiced.'
          };
        } else {
          // Bill to seller for payment via FintekPro escrow
          const bill = await this.zohoService.createBill({
            vendor_name: deal.sellerName || 'Seller',
            reference_number: `UNL-ESC-${deal.id.substring(0, 8).toUpperCase()}`,
            date: new Date(deal.createdAt || new Date()).toISOString().split('T')[0],
            line_items: [{
              name: `Unlisted Shares Payment (Escrow) - ${deal.companyName || 'Company'}`,
              description: `Quantity: ${deal.quantity || 0}, Price: ₹${deal.pricePerShare || 0}`,
              rate: totalValue,
              quantity: 1
            }]
          });

          await db.update(schema.unlistedDeals)
            .set({ 
              zohoBillId: bill.bill_id,
              zohoSyncedAt: new Date(),
              zohoSyncStatus: 'escrow_billed'
            })
            .where(eq(schema.unlistedDeals.id, dealId));

          return { 
            success: true, 
            productType: 'unlisted', 
            transactionId: dealId, 
            zohoBillId: bill.bill_id,
            syncType: 'bill',
            reason: 'Escrow-managed deal. Seller payment billed.'
          };
        }
      } else if (brokerageFee > 0 && this.zohoService) {
        // No escrow but brokerage fee - invoice only the fee
        const invoice = await this.zohoService.createInvoice({
          customer_name: deal.buyerName || deal.sellerName || 'Client',
          reference_number: `UNL-FEE-${deal.id.substring(0, 8).toUpperCase()}`,
          date: new Date(deal.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Unlisted Share Brokerage Fee - ${deal.companyName || 'Company'}`,
            description: `Deal Value: ₹${totalValue.toLocaleString()}, Qty: ${deal.quantity || 0}`,
            rate: brokerageFee,
            quantity: 1
          }],
          notes: `Deal ID: ${deal.id}, Fee-only (principal exchanged directly between parties)`
        });

        await db.update(schema.unlistedDeals)
          .set({ 
            zohoInvoiceId: invoice.invoice_id,
            zohoSyncedAt: new Date(),
            zohoSyncStatus: 'fee_invoiced'
          })
          .where(eq(schema.unlistedDeals.id, dealId));

        return { 
          success: true, 
          productType: 'unlisted', 
          transactionId: dealId, 
          zohoInvoiceId: invoice.invoice_id,
          syncType: 'invoice',
          reason: 'Brokerage fee invoiced. Principal exchanged directly between parties.'
        };
      }

      // No escrow, no brokerage - just track for compliance
      await db.update(schema.unlistedDeals)
        .set({ 
          zohoSyncedAt: new Date(),
          zohoSyncStatus: 'pass_through'
        })
        .where(eq(schema.unlistedDeals.id, dealId));

      return { 
        success: true, 
        productType: 'unlisted', 
        transactionId: dealId,
        syncType: 'compliance_only',
        reason: 'No escrow or fees. Principal exchanged directly between parties. Tracked for compliance.'
      };
    } catch (error: any) {
      return { 
        success: false, 
        productType: 'unlisted', 
        transactionId: dealId, 
        syncType: 'skipped',
        error: error.message 
      };
    }
  }

  async syncPendingTransactions(options?: {
    productTypes?: ProductType[];
    limit?: number;
    fromDate?: Date;
  }): Promise<SyncSummary> {
    const initialized = await this.initialize();
    if (!initialized) {
      return {
        totalProcessed: 0,
        successCount: 0,
        failedCount: 0,
        results: [{ success: false, productType: 'mutual_fund', transactionId: '', error: 'Zoho Books not configured' }]
      };
    }

    const results: TransactionSyncResult[] = [];
    const limit = options?.limit || 100;
    const fromDate = options?.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const productTypes = options?.productTypes || ['mutual_fund', 'bond', 'ipo', 'unlisted'];

    if (productTypes.includes('mutual_fund')) {
      // MF orders - mark for compliance tracking (no invoices per SEBI/AMFI)
      const mfOrders = await db.select({ id: schema.mfOrders.id })
        .from(schema.mfOrders)
        .where(and(
          isNull(schema.mfOrders.zohoSyncedAt),
          eq(schema.mfOrders.status, 'completed'),
          gte(schema.mfOrders.createdAt, fromDate)
        ))
        .orderBy(desc(schema.mfOrders.createdAt))
        .limit(limit);

      for (const order of mfOrders) {
        results.push(await this.syncMutualFundOrder(order.id));
      }
    }

    if (productTypes.includes('bond')) {
      // Bonds - sync for compliance and fee invoicing
      const bondOrders = await db.select({ id: schema.bondOrders.id })
        .from(schema.bondOrders)
        .where(and(
          isNull(schema.bondOrders.zohoSyncedAt),
          eq(schema.bondOrders.status, 'completed'),
          gte(schema.bondOrders.createdAt, fromDate)
        ))
        .orderBy(desc(schema.bondOrders.createdAt))
        .limit(limit);

      for (const order of bondOrders) {
        results.push(await this.syncBondOrder(order.id));
      }
    }

    if (productTypes.includes('ipo')) {
      // IPO - mark for compliance tracking (ASBA: no invoices)
      const ipoApplications = await db.select({ id: schema.ipoApplications.id })
        .from(schema.ipoApplications)
        .where(and(
          isNull(schema.ipoApplications.zohoSyncedAt),
          sql`LOWER(${schema.ipoApplications.status}) = 'allotted'`,
          gte(schema.ipoApplications.appliedAt, fromDate)
        ))
        .orderBy(desc(schema.ipoApplications.appliedAt))
        .limit(limit);

      for (const app of ipoApplications) {
        results.push(await this.syncIPOApplication(app.id));
      }
    }

    if (productTypes.includes('unlisted')) {
      // Unlisted - sync based on escrow/fee status
      const unlistedDeals = await db.select({ id: schema.unlistedDeals.id })
        .from(schema.unlistedDeals)
        .where(and(
          isNull(schema.unlistedDeals.zohoSyncedAt),
          eq(schema.unlistedDeals.status, 'completed'),
          gte(schema.unlistedDeals.createdAt, fromDate)
        ))
        .orderBy(desc(schema.unlistedDeals.createdAt))
        .limit(limit);

      for (const deal of unlistedDeals) {
        results.push(await this.syncUnlistedDeal(deal.id));
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      totalProcessed: results.length,
      successCount,
      failedCount: results.length - successCount,
      results
    };
  }

  async getSyncStatus(): Promise<{
    configured: boolean;
    pendingSync: {
      mutualFunds: number;
      bonds: number;
      ipos: number;
      unlisted: number;
      total: number;
    };
    syncedCounts: {
      passThrough: number;
      invoiced: number;
      billed: number;
    };
    lastSyncedAt?: Date;
  }> {
    const zohoService = await getZohoBooksService();
    const configured = zohoService !== null;

    // Count pending transactions (not yet synced)
    const [mfCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM mf_orders 
      WHERE zoho_synced_at IS NULL AND status = 'completed'
    `);

    const [bondCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM bond_orders 
      WHERE zoho_synced_at IS NULL AND status = 'completed'
    `);

    const [ipoCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM ipo_applications 
      WHERE zoho_synced_at IS NULL AND LOWER(status) = 'allotted'
    `);

    const [unlistedCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM unlisted_deals 
      WHERE zoho_synced_at IS NULL AND status = 'completed'
    `);

    // Count synced transactions by type
    const [passThroughCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT 1 FROM mf_orders WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM bond_orders WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM ipo_applications WHERE zoho_sync_status = 'pass_through'
        UNION ALL
        SELECT 1 FROM unlisted_deals WHERE zoho_sync_status = 'pass_through'
      ) combined
    `);

    const [invoicedCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM (
        SELECT 1 FROM bond_orders WHERE zoho_invoice_id IS NOT NULL
        UNION ALL
        SELECT 1 FROM unlisted_deals WHERE zoho_invoice_id IS NOT NULL
      ) combined
    `);

    const [billedCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM unlisted_deals WHERE zoho_bill_id IS NOT NULL
    `);

    const mutualFunds = Number((mfCount as any)?.count || 0);
    const bonds = Number((bondCount as any)?.count || 0);
    const ipos = Number((ipoCount as any)?.count || 0);
    const unlisted = Number((unlistedCount as any)?.count || 0);

    return {
      configured,
      pendingSync: {
        mutualFunds,
        bonds,
        ipos,
        unlisted,
        total: mutualFunds + bonds + ipos + unlisted
      },
      syncedCounts: {
        passThrough: Number((passThroughCount as any)?.count || 0),
        invoiced: Number((invoicedCount as any)?.count || 0),
        billed: Number((billedCount as any)?.count || 0)
      }
    };
  }
}

export const zohoTransactionSyncService = new ZohoTransactionSyncService();
console.log('✅ Zoho Transaction Sync Service initialized');
