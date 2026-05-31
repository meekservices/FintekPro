// @ts-nocheck
import { db } from '../../../db';
import { alpacaOrders, alpacaTradeLogs, users } from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { alpacaTradingEngine } from '../core/alpacaTradingEngine';
import { logger } from '../../../logger';

export class AlpacaReconciliationService {
  
  /**
   * Reconciles all pending/open orders for active users.
   * Typically runs as a daily background job or via admin trigger.
   */
  async reconcileAllUsers() {
    logger.info('[AlpacaReconciliation] Starting global reconciliation loop');
    
    // Find all users with mapped Alpaca accounts
    const activeUsers = await db.query.users.findMany({
      where: sql`${users.alpacaAccountId} IS NOT NULL`
    });

    logger.info(`[AlpacaReconciliation] Found ${activeUsers.length} active Alpaca accounts to reconcile`);

    let totalSynced = 0;
    for (const user of activeUsers) {
      try {
        const syncedCount = await this.reconcileUser(user.id, user.alpacaAccountId!);
        totalSynced += syncedCount;
      } catch (err) {
        logger.error(`[AlpacaReconciliation] Failed to reconcile user ${user.id}:`, err);
      }
    }

    logger.info(`[AlpacaReconciliation] Completed. Total orders updated: ${totalSynced}`);
    return { totalSynced };
  }

  /**
   * Reconciles a single user's orders
   */
  async reconcileUser(userId: string, alpacaAccountId: string) {
    // 1. Fetch local "non-final" orders
    const localOrders = await db.query.alpacaOrders.findMany({
      where: and(
        eq(alpacaOrders.userId, userId),
        sql`${alpacaOrders.status} NOT IN ('filled', 'canceled', 'rejected', 'expired')`
      )
    });

    if (localOrders.length === 0) return 0;

    // 2. Fetch remote orders from Alpaca
    const remoteOrders = await alpacaTradingEngine.getOpenOrders(alpacaAccountId);
    const remoteOrderMap = new Map(remoteOrders.map((o: any) => [o.id, o]));

    let updatedCount = 0;
    for (const local of localOrders) {
      const remote = remoteOrderMap.get(local.providerOrderId);

      if (remote) {
        // Update local status if it changed
        if (remote.status !== local.status) {
          await db.update(alpacaOrders)
            .set({ 
              status: remote.status,
              filledQty: remote.filled_qty ? remote.filled_qty.toString() : local.filledQty,
              filledAvgPrice: remote.filled_avg_price ? remote.filled_avg_price.toString() : local.filledAvgPrice,
              updatedAt: new Date()
            })
            .where(eq(alpacaOrders.id, local.id));
          
          updatedCount++;
        }
      } else if (local.providerOrderId !== 'PENDING') {
        // If it's not in the 'open' list, it might have been filled/canceled since last check
        // We should fetch the specific order by ID to be sure
        try {
          const { alpacaClient } = await import('../core/alpacaClient');
          const finishedOrder = await alpacaClient.call(`/trading/accounts/${alpacaAccountId}/orders/${local.providerOrderId}`);
          
          await db.update(alpacaOrders)
            .set({ 
              status: finishedOrder.status,
              filledQty: finishedOrder.filled_qty ? finishedOrder.filled_qty.toString() : local.filledQty,
              filledAvgPrice: finishedOrder.filled_avg_price ? finishedOrder.filled_avg_price.toString() : local.filledAvgPrice,
              updatedAt: new Date()
            })
            .where(eq(alpacaOrders.id, local.id));
          
          updatedCount++;
        } catch (e) {
          logger.warn(`[AlpacaReconciliation] Could not find order ${local.providerOrderId} on remote. Possible archival.`);
        }
      }
    }

    return updatedCount;
  }
}

export const alpacaReconciliationService = new AlpacaReconciliationService();
