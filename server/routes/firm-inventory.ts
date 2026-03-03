import { Express, Request, Response } from 'express';
import { firmInventorySyncService, FirmTxInput } from '../services/firm-inventory-sync-service';
import { db } from '../db';
import { firmDpHoldings, firmTransactions } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { adminService } from '../admin-service';

async function requireAdmin(req: any, res: Response, next: any) {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (await adminService.isAdmin(req.user.id)) return next();
  const roles: string[] = req.user.roles ?? [];
  if (roles.some(r => ['admin', 'superadmin'].includes(r))) return next();
  return res.status(403).json({ error: 'Admin access required' });
}

export function registerFirmInventoryRoutes(app: Express) {

  // ── Holdings ───────────────────────────────────────────────────────────────
  app.get('/api/admin/firm-inventory/holdings', requireAdmin, async (req, res) => {
    try {
      const holdings = await firmInventorySyncService.getAllHoldings();
      const totalCost = holdings.reduce((s, h) => s + parseFloat(h.totalCostValue ?? '0'), 0);
      const totalMV   = holdings.reduce((s, h) => s + parseFloat(h.currentMarketValue ?? h.totalCostValue ?? '0'), 0);
      res.json({ holdings, summary: { count: holdings.length, totalCostValue: totalCost, totalMarketValue: totalMV } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Transactions ───────────────────────────────────────────────────────────
  app.get('/api/admin/firm-inventory/transactions', requireAdmin, async (req, res) => {
    try {
      const page  = Math.max(1, parseInt(req.query.page as string || '1'));
      const limit = Math.min(100, parseInt(req.query.limit as string || '50'));
      const txs = await firmInventorySyncService.getTransactions(page, limit);
      res.json({ transactions: txs, page, limit });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Record a new firm transaction + auto-sync to Zoho
  app.post('/api/admin/firm-inventory/transactions', requireAdmin, async (req: any, res) => {
    try {
      const body = req.body as FirmTxInput;
      if (!body.transactionType || !body.securityName || !body.quantity || !body.totalValue || !body.transactionDate) {
        return res.status(400).json({ error: 'transactionType, securityName, quantity, totalValue, transactionDate are required' });
      }
      const result = await firmInventorySyncService.recordTransaction({
        ...body,
        createdBy: req.user?.id,
      });
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Zoho Books Balance ─────────────────────────────────────────────────────
  app.get('/api/admin/firm-inventory/balance', requireAdmin, async (req, res) => {
    try {
      const balance = await firmInventorySyncService.getZohoBooksBalance();
      res.json(balance);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Manual sync trigger ────────────────────────────────────────────────────
  app.post('/api/admin/firm-inventory/sync', requireAdmin, async (req, res) => {
    try {
      const result = await firmInventorySyncService.retryPendingSync();
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync a specific transaction
  app.post('/api/admin/firm-inventory/transactions/:id/sync', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await firmInventorySyncService.syncTransactionToZohoBooks(id);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Zoho Books → FintekPro webhook (inbound) ───────────────────────────────
  app.post('/api/webhooks/zoho-books/firm-inventory', async (req, res) => {
    try {
      const event = req.body;
      const eventType: string = event?.eventType || event?.event_type || '';
      const module: string = event?.module || '';
      const data = event?.data || {};
      const eventId = event?.id || event?.event_id || `zoho-${Date.now()}`;

      console.log(`[FirmInventory webhook] event=${eventType} module=${module}`);

      if (module === 'bills' && (eventType.includes('payment') || eventType.includes('paid'))) {
        await firmInventorySyncService.processZohoBooksBillPaid(eventId, {
          bill_id: data.bill_id,
          vendor_name: data.vendor_name,
          reference_number: data.reference_number,
          date: data.date || new Date().toISOString().split('T')[0],
          total: parseFloat(data.total || data.amount || '0'),
          line_items: data.line_items,
        });
      } else if (module === 'invoices' && (eventType.includes('payment') || eventType.includes('paid'))) {
        await firmInventorySyncService.processZohoBooksInvoicePaid(eventId, {
          invoice_id: data.invoice_id,
          customer_name: data.customer_name,
          reference_number: data.reference_number,
          date: data.date || new Date().toISOString().split('T')[0],
          total: parseFloat(data.total || data.amount || '0'),
          line_items: data.line_items,
        });
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error('[FirmInventory webhook] Error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  console.log('✅ Firm Inventory routes registered');
}
