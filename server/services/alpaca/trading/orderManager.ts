import { logger } from '../../../../logger';
import { db } from '../../../../db';
import { users } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { executionValidator } from './executionValidator';
import { alpacaTradingEngine, OrderPayload } from '../core/alpacaTradingEngine';

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

    // Validate execution constraints
    const qty = payload.qty || (payload.notional ? payload.notional : 0); // Notional trading support
    await executionValidator.validateOrder(alpacaAccountId, payload.symbol, qty, payload.side);

    // Dispatch to Broker Core
    const orderResult = await alpacaTradingEngine.dispatchOrder(alpacaAccountId, payload as OrderPayload);

    logger.info(`[OrderManager] Order successfully submitted for ${userId}. Alpaca Order ID: ${orderResult.id}`);

    // In a real system, you would insert an entry into your `alpaca_orders` table here, 
    // but the Alpaca webhook will also handle confirming the status asynchronously.
    
    return orderResult;
  }
}

export const orderManager = new OrderManager();
