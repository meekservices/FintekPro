import { logger } from '../../../logger';
import { db } from '../../../db';
import { users, alpacaOrders, alpacaTradeLogs } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { executionValidator } from './executionValidator';
import { alpacaTradingEngine, OrderPayload } from '../core/alpacaTradingEngine';
import { alpacaCommissionService } from './commissionService';
import crypto from 'crypto';
import BigNumber from 'bignumber.js';

export class OrderManager {
  
  /**
   * Main entry point for a user to place an order
   */
  async placeOrder(userId: string, payload: Omit<OrderPayload, 'client_order_id'>) {
    logger.info(`[OrderManager] User ${userId} requesting order: ${payload.side} ${payload.symbol}`);

    // Resolve FintekPro user to Alpaca Account ID
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord || !userRecord.alpacaAccountId) {
      throw new Error(`User does not have an active Alpaca Account mapped.`);
    }

    const alpacaAccountId = userRecord.alpacaAccountId;
    const accountType = userRecord.alpacaAccountType || 'individual';

    // Validate execution constraints
    const qty = payload.qty || (payload.notional ? payload.notional : 0); 
    await executionValidator.validateOrder(alpacaAccountId, payload.symbol, qty, payload.side);

    // 0. Calculate Commission
    // For now we assume 'us_equity' as asset class, can be dynamic later
    const assetClass = payload.symbol.includes('/') ? 'crypto' : 'us_equity'; 
    const estimatedValue = payload.notional ? payload.notional : (payload.qty ? payload.qty * 100 : 0); // Price should be fetched for real estimate
    const commission = await alpacaCommissionService.calculateCommission(accountType, assetClass, estimatedValue);

    // 1. Generate Idempotency Key (Client Order ID)
    const clientOrderId = `fp_ord_${crypto.randomUUID()}`;

    // 2. Prepare subtag for Omnibus reconciliation
    let subtag: string | undefined = undefined;
    if (accountType === 'omnibus') {
      subtag = userId; // Use internal User UUID as subtag
    }

    // 2. Persist to Local Audit Trail BEFORE API Dispatch
    // This satisfies the "Technical Audit" requirement for local state management.
    await db.insert(alpacaOrders).values({
      userId,
      alpacaAccountId,
      clientOrderId,
      providerOrderId: 'PENDING', // Will be updated after dispatch
      symbol: payload.symbol,
      qty: payload.qty ? payload.qty.toString() : null,
      notional: payload.notional ? payload.notional.toString() : null,
      side: payload.side,
      type: payload.type,
      timeInForce: payload.time_in_force,
      status: 'pending_new'
    });

    try {
      // 3. Dispatch to Broker Core
      const orderResult = await alpacaTradingEngine.dispatchOrder(alpacaAccountId, {
        ...payload,
        client_order_id: clientOrderId,
        subtag: subtag as any // Inject subtag for Omnibus
      });

      // 4. Update Local State with Provider ID
      await db.update(alpacaOrders)
        .set({ 
          providerOrderId: orderResult.id,
          status: orderResult.status 
        })
        .where(eq(alpacaOrders.clientOrderId, clientOrderId));

      await db.insert(alpacaTradeLogs).values({
        userId,
        alpacaAccountId,
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.qty ? payload.qty.toString() : null,
        notional: payload.notional ? payload.notional.toString() : null,
        status: 'success',
        providerOrderId: orderResult.id,
        commission: commission.toString()
      });

      logger.info(`[OrderManager] Order successfully submitted for ${userId}. Alpaca Order ID: ${orderResult.id}`);
      return orderResult;

    } catch (error: any) {
      // 5. Log Failure to Audit Trail
      await db.update(alpacaOrders)
        .set({ status: 'rejected' })
        .where(eq(alpacaOrders.clientOrderId, clientOrderId));

      await db.insert(alpacaTradeLogs).values({
        userId,
        alpacaAccountId,
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.qty ? payload.qty.toString() : null,
        notional: payload.notional ? payload.notional.toString() : null,
        status: 'failed',
        errorMessage: error.message
      });

      throw error;
    }
  }
}

export const orderManager = new OrderManager();
