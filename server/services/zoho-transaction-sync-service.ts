import { getZohoBooksService, ZohoBooksService } from '../zoho/services/books';
import { db } from '../db';
import { sql, eq, and, isNull, desc, gte } from 'drizzle-orm';
import * as schema from '@shared/schema';

export type ProductType = 'mutual_fund' | 'bond' | 'ipo' | 'unlisted' | 'loan' | 'insurance';
export type TransactionType = 'inflow' | 'outflow';

interface TransactionSyncResult {
  success: boolean;
  productType: ProductType;
  transactionId: string;
  zohoInvoiceId?: string;
  zohoBillId?: string;
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

  async syncMutualFundOrder(orderId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }
    if (!this.zohoService) {
      return { success: false, productType: 'mutual_fund', transactionId: orderId, error: 'Zoho Books not configured' };
    }

    try {
      const [order] = await db.select()
        .from(schema.mfOrders)
        .where(eq(schema.mfOrders.id, orderId))
        .limit(1);

      if (!order) {
        return { success: false, productType: 'mutual_fund', transactionId: orderId, error: 'Order not found' };
      }

      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, order.userId))
        .limit(1);

      const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
      const amount = parseFloat(order.amount?.toString() || '0');

      if (order.orderType === 'purchase' || order.orderType === 'sip') {
        const invoice = await this.zohoService.createInvoice({
          customer_name: customerName,
          reference_number: `MF-${order.id.substring(0, 8).toUpperCase()}`,
          date: new Date(order.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Mutual Fund ${order.orderType === 'sip' ? 'SIP' : 'Purchase'} - ${order.schemeName || 'Scheme'}`,
            description: `Folio: ${order.folioNumber || 'New'}, Units: ${order.units || 'N/A'}`,
            rate: amount,
            quantity: 1
          }],
          notes: `Order ID: ${order.id}, Status: ${order.status}`
        });

        await db.update(schema.mfOrders)
          .set({ zohoInvoiceId: invoice.invoice_id })
          .where(eq(schema.mfOrders.id, orderId));

        return { success: true, productType: 'mutual_fund', transactionId: orderId, zohoInvoiceId: invoice.invoice_id };
      } else if (order.orderType === 'redemption') {
        const bill = await this.zohoService.createBill({
          vendor_name: order.schemeName || 'AMC',
          reference_number: `MF-RED-${order.id.substring(0, 8).toUpperCase()}`,
          date: new Date(order.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Mutual Fund Redemption - ${order.schemeName || 'Scheme'}`,
            description: `Folio: ${order.folioNumber || 'N/A'}, Units: ${order.units || 'N/A'}`,
            rate: amount,
            quantity: 1
          }]
        });

        await db.update(schema.mfOrders)
          .set({ zohoBillId: bill.bill_id })
          .where(eq(schema.mfOrders.id, orderId));

        return { success: true, productType: 'mutual_fund', transactionId: orderId, zohoBillId: bill.bill_id };
      }

      return { success: false, productType: 'mutual_fund', transactionId: orderId, error: 'Unknown order type' };
    } catch (error: any) {
      return { success: false, productType: 'mutual_fund', transactionId: orderId, error: error.message };
    }
  }

  async syncBondOrder(orderId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }
    if (!this.zohoService) {
      return { success: false, productType: 'bond', transactionId: orderId, error: 'Zoho Books not configured' };
    }

    try {
      const [order] = await db.select()
        .from(schema.bondOrders)
        .where(eq(schema.bondOrders.id, orderId))
        .limit(1);

      if (!order) {
        return { success: false, productType: 'bond', transactionId: orderId, error: 'Order not found' };
      }

      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, order.userId))
        .limit(1);

      const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
      const amount = parseFloat(order.investmentAmount?.toString() || '0');

      const invoice = await this.zohoService.createInvoice({
        customer_name: customerName,
        reference_number: `BOND-${order.id.substring(0, 8).toUpperCase()}`,
        date: new Date(order.createdAt || new Date()).toISOString().split('T')[0],
        line_items: [{
          name: `Bond Investment - ${order.bondName || order.isinCode || 'Bond'}`,
          description: `ISIN: ${order.isinCode || 'N/A'}, Quantity: ${order.quantity || 1}`,
          rate: amount,
          quantity: 1
        }],
        notes: `Order ID: ${order.id}, Status: ${order.status}`
      });

      await db.update(schema.bondOrders)
        .set({ zohoInvoiceId: invoice.invoice_id })
        .where(eq(schema.bondOrders.id, orderId));

      return { success: true, productType: 'bond', transactionId: orderId, zohoInvoiceId: invoice.invoice_id };
    } catch (error: any) {
      return { success: false, productType: 'bond', transactionId: orderId, error: error.message };
    }
  }

  async syncIPOApplication(applicationId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }
    if (!this.zohoService) {
      return { success: false, productType: 'ipo', transactionId: applicationId, error: 'Zoho Books not configured' };
    }

    try {
      const [application] = await db.select()
        .from(schema.ipoApplications)
        .where(eq(schema.ipoApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return { success: false, productType: 'ipo', transactionId: applicationId, error: 'Application not found' };
      }

      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, application.userId))
        .limit(1);

      const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
      const amount = parseFloat(application.amount?.toString() || '0');

      const invoice = await this.zohoService.createInvoice({
        customer_name: customerName,
        reference_number: `IPO-${application.id.substring(0, 8).toUpperCase()}`,
        date: new Date(application.appliedAt || new Date()).toISOString().split('T')[0],
        line_items: [{
          name: `IPO Application - ${application.companyName || 'Company'}`,
          description: `Lots: ${application.lots || 1}, Category: ${application.category || 'Retail'}`,
          rate: amount,
          quantity: 1
        }],
        notes: `Application ID: ${application.id}, Status: ${application.status}`
      });

      await db.update(schema.ipoApplications)
        .set({ zohoInvoiceId: invoice.invoice_id })
        .where(eq(schema.ipoApplications.id, applicationId));

      return { success: true, productType: 'ipo', transactionId: applicationId, zohoInvoiceId: invoice.invoice_id };
    } catch (error: any) {
      return { success: false, productType: 'ipo', transactionId: applicationId, error: error.message };
    }
  }

  async syncUnlistedDeal(dealId: string): Promise<TransactionSyncResult> {
    if (!this.zohoService) {
      await this.initialize();
    }
    if (!this.zohoService) {
      return { success: false, productType: 'unlisted', transactionId: dealId, error: 'Zoho Books not configured' };
    }

    try {
      const [deal] = await db.select()
        .from(schema.unlistedDeals)
        .where(eq(schema.unlistedDeals.id, dealId))
        .limit(1);

      if (!deal) {
        return { success: false, productType: 'unlisted', transactionId: dealId, error: 'Deal not found' };
      }

      const amount = parseFloat(deal.totalValue?.toString() || '0');
      const isBuyer = deal.dealType === 'buy';

      if (isBuyer) {
        const invoice = await this.zohoService.createInvoice({
          customer_name: deal.buyerName || 'Buyer',
          reference_number: `UNL-${deal.id.substring(0, 8).toUpperCase()}`,
          date: new Date(deal.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Unlisted Shares - ${deal.companyName || 'Company'}`,
            description: `Quantity: ${deal.quantity || 0}, Price: ₹${deal.pricePerShare || 0}`,
            rate: amount,
            quantity: 1
          }],
          notes: `Deal ID: ${deal.id}, Status: ${deal.status}`
        });

        await db.update(schema.unlistedDeals)
          .set({ zohoInvoiceId: invoice.invoice_id })
          .where(eq(schema.unlistedDeals.id, dealId));

        return { success: true, productType: 'unlisted', transactionId: dealId, zohoInvoiceId: invoice.invoice_id };
      } else {
        const bill = await this.zohoService.createBill({
          vendor_name: deal.sellerName || 'Seller',
          reference_number: `UNL-SELL-${deal.id.substring(0, 8).toUpperCase()}`,
          date: new Date(deal.createdAt || new Date()).toISOString().split('T')[0],
          line_items: [{
            name: `Unlisted Shares Sale - ${deal.companyName || 'Company'}`,
            description: `Quantity: ${deal.quantity || 0}, Price: ₹${deal.pricePerShare || 0}`,
            rate: amount,
            quantity: 1
          }]
        });

        await db.update(schema.unlistedDeals)
          .set({ zohoBillId: bill.bill_id })
          .where(eq(schema.unlistedDeals.id, dealId));

        return { success: true, productType: 'unlisted', transactionId: dealId, zohoBillId: bill.bill_id };
      }
    } catch (error: any) {
      return { success: false, productType: 'unlisted', transactionId: dealId, error: error.message };
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
      // Sync purchase/SIP orders (invoices)
      const mfPurchaseOrders = await db.select({ id: schema.mfOrders.id })
        .from(schema.mfOrders)
        .where(and(
          isNull(schema.mfOrders.zohoInvoiceId),
          sql`${schema.mfOrders.orderType} IN ('purchase', 'sip')`,
          eq(schema.mfOrders.status, 'completed'),
          gte(schema.mfOrders.createdAt, fromDate)
        ))
        .orderBy(desc(schema.mfOrders.createdAt))
        .limit(limit);

      for (const order of mfPurchaseOrders) {
        results.push(await this.syncMutualFundOrder(order.id));
      }

      // Sync redemption orders (bills)
      const mfRedemptionOrders = await db.select({ id: schema.mfOrders.id })
        .from(schema.mfOrders)
        .where(and(
          isNull(schema.mfOrders.zohoBillId),
          eq(schema.mfOrders.orderType, 'redemption'),
          eq(schema.mfOrders.status, 'completed'),
          gte(schema.mfOrders.createdAt, fromDate)
        ))
        .orderBy(desc(schema.mfOrders.createdAt))
        .limit(limit);

      for (const order of mfRedemptionOrders) {
        results.push(await this.syncMutualFundOrder(order.id));
      }
    }

    if (productTypes.includes('bond')) {
      const bondOrders = await db.select({ id: schema.bondOrders.id })
        .from(schema.bondOrders)
        .where(and(
          isNull(schema.bondOrders.zohoInvoiceId),
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
      const ipoApplications = await db.select({ id: schema.ipoApplications.id })
        .from(schema.ipoApplications)
        .where(and(
          isNull(schema.ipoApplications.zohoInvoiceId),
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
      // Sync buy orders (invoices)
      const unlistedBuyDeals = await db.select({ id: schema.unlistedDeals.id })
        .from(schema.unlistedDeals)
        .where(and(
          isNull(schema.unlistedDeals.zohoInvoiceId),
          eq(schema.unlistedDeals.dealType, 'buy'),
          eq(schema.unlistedDeals.status, 'completed'),
          gte(schema.unlistedDeals.createdAt, fromDate)
        ))
        .orderBy(desc(schema.unlistedDeals.createdAt))
        .limit(limit);

      for (const deal of unlistedBuyDeals) {
        results.push(await this.syncUnlistedDeal(deal.id));
      }

      // Sync sell orders (bills)
      const unlistedSellDeals = await db.select({ id: schema.unlistedDeals.id })
        .from(schema.unlistedDeals)
        .where(and(
          isNull(schema.unlistedDeals.zohoBillId),
          eq(schema.unlistedDeals.dealType, 'sell'),
          eq(schema.unlistedDeals.status, 'completed'),
          gte(schema.unlistedDeals.createdAt, fromDate)
        ))
        .orderBy(desc(schema.unlistedDeals.createdAt))
        .limit(limit);

      for (const deal of unlistedSellDeals) {
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
    lastSyncedAt?: Date;
  }> {
    const zohoService = await getZohoBooksService();
    const configured = zohoService !== null;

    const [mfCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM mf_orders 
      WHERE zoho_invoice_id IS NULL AND status = 'completed'
    `);

    const [bondCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM bond_orders 
      WHERE zoho_invoice_id IS NULL AND status = 'completed'
    `);

    const [ipoCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM ipo_applications 
      WHERE zoho_invoice_id IS NULL AND status = 'allotted'
    `);

    const [unlistedCount] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM unlisted_deals 
      WHERE zoho_invoice_id IS NULL AND status = 'completed'
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
      }
    };
  }
}

export const zohoTransactionSyncService = new ZohoTransactionSyncService();
console.log('✅ Zoho Transaction Sync Service initialized');
