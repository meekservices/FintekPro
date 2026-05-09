import { Express, Request, Response, NextFunction } from 'express';
import { ZohoBooksService, getZohoBooksService } from '../zoho/services/books';
import { zohoTransactionSyncService, ProductType } from '../services/zoho-transaction-sync-service';

// Role-based access middleware for admin and accounts team
const requireAdminOrAccounts = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check using adminService pattern
  const { adminService } = await import('../admin-service');
  if (await adminService.isAdmin(user.id)) {
    return next();
  }
  
  // Fallback to role-based check for accounts/finance roles
  const allowedRoles = ['admin', 'super_admin', 'accounts', 'finance_admin', 'finance_manager'];
  const userRole = user.role || user.userRole || '';
  
  if (!allowedRoles.includes(userRole.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied. Admin or Accounts role required.' });
  }
  
  next();
};

export function registerZohoBooksRoutes(app: Express) {
  // Apply authentication middleware to all Zoho Books routes
  app.use('/api/admin/zoho-books', requireAdminOrAccounts);
  
  // Get Zoho Books connection status
  app.get('/api/admin/zoho-books/status', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      
      if (!service) {
        return res.json({
          connected: false,
          message: 'Zoho Books not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ZSOID.'
        });
      }
      
      // Test connection by fetching organization info
      const org = await service.getOrganization();
      
      res.json({
        connected: true,
        organization: org,
        message: 'Zoho Books connected successfully'
      });
    } catch (error: any) {
      res.json({
        connected: false,
        message: error.message || 'Failed to connect to Zoho Books'
      });
    }
  });

  // Get dashboard summary
  app.get('/api/admin/zoho-books/dashboard', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const summary = await service.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('Error fetching Zoho Books dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get organizations list
  app.get('/api/admin/zoho-books/organizations', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const organizations = await service.getOrganizations();
      res.json(organizations);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Invoices ====================
  
  app.get('/api/admin/zoho-books/invoices', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, status, customer_id, date_start, date_end } = req.query;
      
      const invoices = await service.getInvoices({
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        status: status as any,
        customer_id: customer_id as string,
        date_start: date_start as string,
        date_end: date_end as string
      });
      
      res.json(invoices);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/invoices/:id', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const invoice = await service.getInvoice(req.params.id);
      res.json(invoice);
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Bills ====================
  
  app.get('/api/admin/zoho-books/bills', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, status, vendor_id, date_start, date_end } = req.query;
      
      const bills = await service.getBills({
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        status: status as any,
        vendor_id: vendor_id as string,
        date_start: date_start as string,
        date_end: date_end as string
      });
      
      res.json(bills);
    } catch (error: any) {
      console.error('Error fetching bills:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/bills/:id', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const bill = await service.getBill(req.params.id);
      res.json(bill);
    } catch (error: any) {
      console.error('Error fetching bill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Contacts ====================
  
  app.get('/api/admin/zoho-books/contacts', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, contact_type, status } = req.query;
      
      const contacts = await service.getContacts({
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        contact_type: contact_type as 'customer' | 'vendor',
        status: status as 'active' | 'inactive' | 'all'
      });
      
      res.json(contacts);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/contacts/:id', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const contact = await service.getContact(req.params.id);
      res.json(contact);
    } catch (error: any) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Chart of Accounts ====================
  
  app.get('/api/admin/zoho-books/chart-of-accounts', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { account_type, filter_by } = req.query;
      
      const accounts = await service.getChartOfAccounts({
        account_type: account_type as string,
        filter_by: filter_by as 'Active' | 'Inactive' | 'All'
      });
      
      res.json(accounts);
    } catch (error: any) {
      console.error('Error fetching chart of accounts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Payments ====================
  
  app.get('/api/admin/zoho-books/payments/received', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, customer_id, date_start, date_end } = req.query;
      
      const payments = await service.getPaymentsReceived({
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        customer_id: customer_id as string,
        date_start: date_start as string,
        date_end: date_end as string
      });
      
      res.json(payments);
    } catch (error: any) {
      console.error('Error fetching payments received:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/payments/made', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, vendor_id, date_start, date_end } = req.query;
      
      const payments = await service.getPaymentsMade({
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        vendor_id: vendor_id as string,
        date_start: date_start as string,
        date_end: date_end as string
      });
      
      res.json(payments);
    } catch (error: any) {
      console.error('Error fetching payments made:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Bank Accounts ====================
  
  app.get('/api/admin/zoho-books/bank-accounts', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const accounts = await service.getBankAccounts();
      res.json(accounts);
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/bank-accounts/:id/transactions', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { page, transaction_type, date_start, date_end } = req.query;
      
      const transactions = await service.getBankTransactions(req.params.id, {
        page: page ? parseInt(page as string) : 1,
        per_page: 25,
        transaction_type: transaction_type as any,
        date_start: date_start as string,
        date_end: date_end as string
      });
      
      res.json(transactions);
    } catch (error: any) {
      console.error('Error fetching bank transactions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Reports ====================
  
  app.get('/api/admin/zoho-books/reports/balance-sheet', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { date } = req.query;
      const report = await service.getBalanceSheet({ date: date as string });
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching balance sheet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/reports/profit-loss', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { start_date, end_date } = req.query;
      const report = await service.getProfitAndLoss({
        start_date: start_date as string,
        end_date: end_date as string
      });
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching P&L:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/reports/cash-flow', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { start_date, end_date } = req.query;
      const report = await service.getCashFlow({
        start_date: start_date as string,
        end_date: end_date as string
      });
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching cash flow:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/zoho-books/reports/aging/:type', async (req, res) => {
    try {
      const service = await getZohoBooksService();
      if (!service) {
        return res.status(503).json({ error: 'Zoho Books not configured' });
      }
      
      const { type } = req.params;
      const { as_of_date } = req.query;
      
      if (type !== 'receivables' && type !== 'payables') {
        return res.status(400).json({ error: 'Invalid aging report type' });
      }
      
      const report = await service.getAgingReport(type, { as_of_date: as_of_date as string });
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching aging report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Transaction Sync ====================

  app.get('/api/admin/zoho-books/sync/status', async (req, res) => {
    try {
      const status = await zohoTransactionSyncService.getSyncStatus();
      res.json(status);
    } catch (error: any) {
      console.error('Error fetching sync status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/all', async (req, res) => {
    try {
      const { productTypes, limit, fromDate } = req.body;
      
      const result = await zohoTransactionSyncService.syncPendingTransactions({
        productTypes: productTypes as ProductType[],
        limit: limit ? parseInt(limit) : undefined,
        fromDate: fromDate ? new Date(fromDate) : undefined
      });
      
      res.json({
        success: true,
        message: `Synced ${result.successCount} of ${result.totalProcessed} transactions`,
        ...result
      });
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/mutual-fund/:orderId', async (req, res) => {
    try {
      const result = await zohoTransactionSyncService.syncMutualFundOrder(req.params.orderId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/bond/:orderId', async (req, res) => {
    try {
      const result = await zohoTransactionSyncService.syncBondOrder(req.params.orderId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/ipo/:applicationId', async (req, res) => {
    try {
      const result = await zohoTransactionSyncService.syncIPOApplication(req.params.applicationId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/unlisted/:dealId', async (req, res) => {
    try {
      const result = await zohoTransactionSyncService.syncUnlistedDeal(req.params.dealId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Store transaction sync endpoints
  app.post('/api/admin/zoho-books/sync/store/:transactionId', async (req, res) => {
    try {
      const result = await zohoTransactionSyncService.syncStoreTransaction(req.params.transactionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/zoho-books/sync/store-batch', async (req, res) => {
    try {
      const { limit } = req.body;
      const result = await zohoTransactionSyncService.syncPendingStoreTransactions(
        limit ? parseInt(limit) : 50
      );
      res.json({
        success: true,
        message: `Synced ${result.synced} of ${result.total} store transactions`,
        ...result
      });
    } catch (error: any) {
      console.error('Error syncing store transactions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Commission Reconciliation ====================

  app.get('/api/admin/commission-reconciliation', requireAdminOrAccounts, async (req, res) => {
    try {
      const { productType, syncStatus, limit = '100' } = req.query;
      
      const items = await zohoTransactionSyncService.getReconciliationItems({
        productType: productType as string,
        syncStatus: syncStatus as string,
        limit: parseInt(limit as string),
      });
      
      const summary = {
        totalTransactions: items.length,
        matched: items.filter(i => i.matchStatus === 'matched').length,
        pending: items.filter(i => i.matchStatus === 'pending').length,
        failed: items.filter(i => i.matchStatus === 'failed').length,
        totalAmount: items.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0).toFixed(2),
        syncedAmount: items
          .filter(i => i.matchStatus === 'matched')
          .reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0)
          .toFixed(2),
      };
      
      res.json({ success: true, items, summary });
    } catch (error: any) {
      console.error('Error fetching reconciliation data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/commission-payouts', requireAdminOrAccounts, async (req, res) => {
    try {
      const payouts = await zohoTransactionSyncService.getCommissionPayouts();
      
      const summary = {
        totalPending: payouts
          .filter(p => p.status === 'pending')
          .reduce((sum, p) => sum + parseFloat(p.netAmount || '0'), 0)
          .toFixed(2),
        totalApproved: payouts
          .filter(p => p.status === 'approved')
          .reduce((sum, p) => sum + parseFloat(p.netAmount || '0'), 0)
          .toFixed(2),
        totalPaid: payouts
          .filter(p => p.status === 'paid')
          .reduce((sum, p) => sum + parseFloat(p.netAmount || '0'), 0)
          .toFixed(2),
        pendingCount: payouts.filter(p => p.status === 'pending').length,
      };
      
      res.json({ success: true, payouts, summary });
    } catch (error: any) {
      console.error('Error fetching commission payouts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/commission-payouts/:id/approve', requireAdminOrAccounts, async (req, res) => {
    try {
      const { forceLocalApproval } = req.body || {};
      const result = await zohoTransactionSyncService.approveCommissionPayout(
        req.params.id, 
        { forceLocalApproval: !!forceLocalApproval }
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error approving payout:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unified Payouts endpoint for admin payout management
  app.get('/api/admin/payouts', requireAdminOrAccounts, async (req, res) => {
    try {
      // Aggregate payout data from partner settlements and referral payouts
      const { db } = await import('../db');
      const { partnerSettlements, users, referralPayoutTransactions } = await import('@shared/schema');
      const { eq, sql, desc } = await import('drizzle-orm');
      
      // Get partner settlements as payouts
      const settlements = await db.select({
        id: partnerSettlements.id,
        partnerId: partnerSettlements.partnerId,
        amount: partnerSettlements.finalPayoutAmount,
        status: partnerSettlements.status,
        createdAt: partnerSettlements.createdAt,
        processedAt: partnerSettlements.cashfreePayoutCompletedAt,
        referenceNumber: partnerSettlements.cashfreePayoutId,
      }).from(partnerSettlements).orderBy(desc(partnerSettlements.createdAt)).limit(100);
      
      // Format as PayoutRequest objects
      const payouts = await Promise.all(settlements.map(async (s) => {
        // Get user info
        const [user] = await db.select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }).from(users).where(eq(users.id, parseInt(s.partnerId || '0'))).limit(1);
        
        const statusMap: Record<string, string> = {
          'pending': 'pending',
          'approved': 'approved',
          'processing': 'processing',
          'completed': 'completed',
          'paid': 'completed',
          'failed': 'rejected',
        };
        
        return {
          id: s.id,
          userId: s.partnerId || '',
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown',
          userType: 'partner' as const,
          email: user?.email || '',
          amount: parseFloat(s.amount || '0'),
          requestDate: s.createdAt?.toISOString() || new Date().toISOString(),
          status: statusMap[s.status || 'pending'] || 'pending',
          bankName: 'Bank Account',
          accountEnding: '****',
          ifsc: '',
          processedDate: s.processedAt?.toISOString(),
          referenceNumber: s.referenceNumber || undefined,
        };
      }));
      
      res.json(payouts);
    } catch (error: any) {
      console.error('Error fetching payouts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Zoho Books API routes registered');
  console.log('   📊 Transaction sync endpoints: /api/admin/zoho-books/sync/*');
  console.log('   💰 Commission reconciliation: /api/admin/commission-reconciliation');
}
