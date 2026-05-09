/**
 * Payment Webhook Retry Service
 * 
 * Handles failed payment webhook callbacks with exponential backoff retry.
 * Stores failed webhooks in database and retries them periodically.
 * 
 * Features:
 * - Exponential backoff (1min, 5min, 15min, 30min, 1hr, 2hr)
 * - Max retry attempts: 6
 * - Failed webhook persistence
 * - Manual retry capability for admin
 */

import { db } from '../db';
import { unifiedOrders } from '@shared/schema';
import { eq, and, lt, lte, sql, desc } from 'drizzle-orm';
import { paymentExecutionBridge, PaymentCallbackData } from '../payment-execution-bridge';

export interface FailedWebhook {
  id: string;
  orderId: string;
  webhookType: 'cashfree' | 'phonepe';
  callbackData: PaymentCallbackData;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date;
  status: 'pending_retry' | 'retrying' | 'success' | 'exhausted';
  createdAt: Date;
  lastAttemptAt: Date;
}

const RETRY_DELAYS_MS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  15 * 60 * 1000,   // 15 minutes
  30 * 60 * 1000,   // 30 minutes
  60 * 60 * 1000,   // 1 hour
  2 * 60 * 60 * 1000, // 2 hours
];

const MAX_RETRIES = RETRY_DELAYS_MS.length;

class PaymentWebhookRetryService {
  private retryTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    // Delay startup to allow database connection
    setTimeout(() => {
      this.initialize();
    }, 5000);
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    
    console.log('[WebhookRetry] Initializing payment webhook retry service...');
    
    // Load pending retries from database on startup
    await this.loadPendingRetriesFromDb();
    
    this.startRetryLoop();
    console.log('[WebhookRetry] Service initialized');
  }

  /**
   * Load pending retries from database on startup (persistence recovery)
   */
  private async loadPendingRetriesFromDb(): Promise<void> {
    try {
      // Find orders with pending webhook retries in their metadata
      const ordersWithPendingRetries = await db
        .select({
          id: unifiedOrders.id,
          orderNumber: unifiedOrders.orderNumber,
          metadata: unifiedOrders.metadata
        })
        .from(unifiedOrders)
        .where(
          and(
            eq(unifiedOrders.status, 'payment_error'),
            sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'pending_retry'`
          )
        )
        .limit(50);

      console.log(`[WebhookRetry] Found ${ordersWithPendingRetries.length} orders with pending webhook retries`);
      
      // These will be retried in the next retry loop cycle
    } catch (error) {
      console.error('[WebhookRetry] Failed to load pending retries from database:', error);
    }
  }

  /**
   * Record a failed webhook for retry
   */
  async recordFailedWebhook(
    orderId: string,
    webhookType: 'cashfree' | 'phonepe',
    callbackData: PaymentCallbackData,
    errorMessage: string
  ): Promise<FailedWebhook> {
    const id = `webhook-${orderId}-${Date.now()}`;
    const now = new Date();
    
    const failedWebhook: FailedWebhook = {
      id,
      orderId,
      webhookType,
      callbackData,
      errorMessage,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      nextRetryAt: new Date(now.getTime() + RETRY_DELAYS_MS[0]),
      status: 'pending_retry',
      createdAt: now,
      lastAttemptAt: now,
    };

    console.log(`[WebhookRetry] Recorded failed webhook for order ${orderId}, first retry at ${failedWebhook.nextRetryAt.toISOString()}`);
    
    await this.persistFailedWebhook(failedWebhook);
    
    return failedWebhook;
  }

  /**
   * Persist failed webhook to order metadata
   */
  private async persistFailedWebhook(webhook: FailedWebhook): Promise<void> {
    try {
      const [order] = await db
        .select({ metadata: unifiedOrders.metadata })
        .from(unifiedOrders)
        .where(eq(unifiedOrders.id, webhook.orderId));

      if (!order) return;

      const metadata = (order.metadata || {}) as Record<string, any>;
      const webhookRetries = metadata.webhookRetries || [];
      
      webhookRetries.push({
        webhookId: webhook.id,
        webhookType: webhook.webhookType,
        callbackData: webhook.callbackData,
        errorMessage: webhook.errorMessage,
        retryCount: webhook.retryCount,
        nextRetryAt: webhook.nextRetryAt.toISOString(),
        status: webhook.status,
        createdAt: webhook.createdAt.toISOString(),
      });

      await db
        .update(unifiedOrders)
        .set({
          metadata: {
            ...metadata,
            webhookRetries,
            lastWebhookError: webhook.errorMessage,
            lastWebhookErrorAt: new Date().toISOString(),
            lastWebhookStatus: webhook.status,
            nextRetryAt: webhook.nextRetryAt.toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(unifiedOrders.id, webhook.orderId));

    } catch (error) {
      console.error(`[WebhookRetry] Failed to persist webhook for order ${webhook.orderId}:`, error);
    }
  }

  /**
   * Start the retry loop (runs every minute)
   */
  private startRetryLoop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }

    this.retryTimer = setInterval(async () => {
      await this.processRetryQueue();
    }, 60 * 1000); // Check every minute

    console.log('[WebhookRetry] Retry loop started');
  }

  /**
   * Process webhooks due for retry (database-based)
   */
  async processRetryQueue(): Promise<void> {
    try {
      const now = new Date();
      
      // Query orders with pending webhook retries from database
      const ordersToRetry = await db
        .select({
          id: unifiedOrders.id,
          orderNumber: unifiedOrders.orderNumber,
          metadata: unifiedOrders.metadata
        })
        .from(unifiedOrders)
        .where(
          and(
            sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'pending_retry'`,
            sql`(${unifiedOrders.metadata}->>'nextRetryAt')::timestamp <= ${now}`
          )
        )
        .limit(20);

      if (ordersToRetry.length === 0) return;

      console.log(`[WebhookRetry] Processing ${ordersToRetry.length} webhooks due for retry`);

      for (const order of ordersToRetry) {
        // Optimistic lock: atomically claim this order by flipping status pending_retry → retrying.
        // In autoscale, multiple instances scan the same DB rows; only the instance that wins
        // this UPDATE will proceed — the others will see rowCount=0 and skip.
        const claimed = await db
          .update(unifiedOrders)
          .set({
            metadata: sql`jsonb_set(${unifiedOrders.metadata}, '{lastWebhookStatus}', '"retrying"')`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(unifiedOrders.id, order.id),
              sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'pending_retry'`
            )
          );

        if (!claimed.rowCount || claimed.rowCount === 0) {
          console.log(`[WebhookRetry] Order ${order.id} already claimed by another instance, skipping`);
          continue;
        }

        const metadata = (order.metadata || {}) as Record<string, any>;
        const webhookRetries = metadata.webhookRetries || [];
        const latestRetry = webhookRetries[webhookRetries.length - 1];
        
        if (latestRetry && latestRetry.callbackData) {
          const webhook: FailedWebhook = {
            id: latestRetry.webhookId,
            orderId: order.id,
            webhookType: latestRetry.webhookType || 'cashfree',
            callbackData: latestRetry.callbackData,
            errorMessage: latestRetry.errorMessage,
            retryCount: latestRetry.retryCount || 0,
            maxRetries: MAX_RETRIES,
            nextRetryAt: new Date(latestRetry.nextRetryAt),
            status: 'retrying',
            createdAt: new Date(latestRetry.createdAt),
            lastAttemptAt: new Date()
          };
          
          await this.retryWebhook(webhook);
        }
      }
    } catch (error) {
      console.error('[WebhookRetry] Error processing retry queue:', error);
    }
  }

  /**
   * Retry a single webhook
   */
  async retryWebhook(webhook: FailedWebhook): Promise<boolean> {
    webhook.status = 'retrying';
    webhook.lastAttemptAt = new Date();
    
    console.log(`[WebhookRetry] Retrying webhook for order ${webhook.orderId}, attempt ${webhook.retryCount + 1}/${webhook.maxRetries}`);

    try {
      const result = await paymentExecutionBridge.processPaymentCallback(webhook.callbackData);

      if (result.success) {
        webhook.status = 'success';
        
        console.log(`[WebhookRetry] Successfully processed webhook for order ${webhook.orderId} on retry ${webhook.retryCount + 1}`);
        
        await this.updateWebhookStatus(webhook, 'success');
        return true;
      }
      
      throw new Error(result.error || 'Retry failed');

    } catch (error) {
      webhook.retryCount++;
      webhook.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (webhook.retryCount >= webhook.maxRetries) {
        webhook.status = 'exhausted';
        console.error(`[WebhookRetry] Webhook exhausted for order ${webhook.orderId} after ${webhook.maxRetries} attempts`);
        
        await this.updateWebhookStatus(webhook, 'exhausted');
        await this.markOrderForManualReview(webhook);
        
        return false;
      }

      const nextDelay = RETRY_DELAYS_MS[webhook.retryCount] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      webhook.nextRetryAt = new Date(Date.now() + nextDelay);
      webhook.status = 'pending_retry';

      console.log(`[WebhookRetry] Webhook retry ${webhook.retryCount} failed for order ${webhook.orderId}, next retry at ${webhook.nextRetryAt.toISOString()}`);

      await this.updateWebhookStatus(webhook, 'pending_retry');
      return false;
    }
  }

  /**
   * Update webhook status in order metadata
   */
  private async updateWebhookStatus(webhook: FailedWebhook, status: string): Promise<void> {
    try {
      const [order] = await db
        .select({ metadata: unifiedOrders.metadata })
        .from(unifiedOrders)
        .where(eq(unifiedOrders.id, webhook.orderId));

      if (!order) return;

      const metadata = (order.metadata || {}) as Record<string, any>;
      const webhookRetries = metadata.webhookRetries || [];
      
      const existingIndex = webhookRetries.findIndex((r: any) => r.webhookId === webhook.id);
      
      if (existingIndex >= 0) {
        // Merge updates into existing entry to preserve callbackData and other fields
        const existingEntry = webhookRetries[existingIndex];
        webhookRetries[existingIndex] = {
          ...existingEntry,
          errorMessage: webhook.errorMessage,
          retryCount: webhook.retryCount,
          nextRetryAt: webhook.nextRetryAt?.toISOString(),
          status: status,
          lastAttemptAt: webhook.lastAttemptAt.toISOString(),
        };
      } else {
        // New entry - include all fields
        webhookRetries.push({
          webhookId: webhook.id,
          webhookType: webhook.webhookType,
          callbackData: webhook.callbackData,
          errorMessage: webhook.errorMessage,
          retryCount: webhook.retryCount,
          nextRetryAt: webhook.nextRetryAt?.toISOString(),
          status: status,
          createdAt: webhook.createdAt.toISOString(),
          lastAttemptAt: webhook.lastAttemptAt.toISOString(),
        });
      }

      await db
        .update(unifiedOrders)
        .set({
          metadata: {
            ...metadata,
            webhookRetries,
            lastWebhookStatus: status,
            lastWebhookRetryAt: new Date().toISOString(),
            nextRetryAt: status === 'pending_retry' ? webhook.nextRetryAt?.toISOString() : null,
          },
          updatedAt: new Date(),
        })
        .where(eq(unifiedOrders.id, webhook.orderId));

    } catch (error) {
      console.error(`[WebhookRetry] Failed to update webhook status for order ${webhook.orderId}:`, error);
    }
  }

  /**
   * Mark order for manual review after exhausting retries
   */
  private async markOrderForManualReview(webhook: FailedWebhook): Promise<void> {
    try {
      await db
        .update(unifiedOrders)
        .set({
          status: 'payment_error',
          failureReason: `Payment webhook failed after ${webhook.maxRetries} retry attempts. Last error: ${webhook.errorMessage}. Requires manual review.`,
          updatedAt: new Date(),
        })
        .where(eq(unifiedOrders.id, webhook.orderId));

      console.log(`[WebhookRetry] Order ${webhook.orderId} marked for manual review`);

    } catch (error) {
      console.error(`[WebhookRetry] Failed to mark order ${webhook.orderId} for manual review:`, error);
    }
  }

  /**
   * Manual retry for admin (database-based)
   */
  async manualRetry(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const [order] = await db
        .select({ id: unifiedOrders.id, metadata: unifiedOrders.metadata })
        .from(unifiedOrders)
        .where(eq(unifiedOrders.id, orderId));

      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      const metadata = (order.metadata || {}) as Record<string, any>;
      const webhookRetries = metadata.webhookRetries || [];
      const latestRetry = webhookRetries[webhookRetries.length - 1];

      if (!latestRetry || !latestRetry.callbackData) {
        return { success: false, message: 'No pending webhook found for this order' };
      }

      const webhook: FailedWebhook = {
        id: latestRetry.webhookId,
        orderId: order.id,
        webhookType: latestRetry.webhookType || 'cashfree',
        callbackData: latestRetry.callbackData,
        errorMessage: latestRetry.errorMessage,
        retryCount: latestRetry.retryCount || 0,
        maxRetries: MAX_RETRIES,
        nextRetryAt: new Date(),
        status: 'pending_retry',
        createdAt: new Date(latestRetry.createdAt),
        lastAttemptAt: new Date()
      };

      const result = await this.retryWebhook(webhook);
      return {
        success: result,
        message: result ? 'Webhook processed successfully' : 'Retry failed, see logs for details',
      };
    } catch (error) {
      console.error('[WebhookRetry] Manual retry error:', error);
      return { success: false, message: 'Failed to process manual retry' };
    }
  }

  /**
   * Get retry status for an order (database-based)
   */
  async getRetryStatus(orderId: string): Promise<any | null> {
    try {
      const [order] = await db
        .select({ metadata: unifiedOrders.metadata })
        .from(unifiedOrders)
        .where(eq(unifiedOrders.id, orderId));

      if (!order) return null;

      const metadata = (order.metadata || {}) as Record<string, any>;
      return {
        webhookRetries: metadata.webhookRetries || [],
        lastWebhookStatus: metadata.lastWebhookStatus,
        lastWebhookError: metadata.lastWebhookError,
        nextRetryAt: metadata.nextRetryAt
      };
    } catch (error) {
      console.error('[WebhookRetry] Get retry status error:', error);
      return null;
    }
  }

  /**
   * Get all pending retries (for admin dashboard, database-based)
   */
  async getPendingRetries(): Promise<any[]> {
    try {
      const orders = await db
        .select({
          id: unifiedOrders.id,
          orderNumber: unifiedOrders.orderNumber,
          metadata: unifiedOrders.metadata
        })
        .from(unifiedOrders)
        .where(sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'pending_retry'`)
        .limit(50);

      return orders.map(order => {
        const metadata = (order.metadata || {}) as Record<string, any>;
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          retryCount: metadata.webhookRetries?.length || 0,
          lastWebhookError: metadata.lastWebhookError,
          nextRetryAt: metadata.nextRetryAt
        };
      });
    } catch (error) {
      console.error('[WebhookRetry] Get pending retries error:', error);
      return [];
    }
  }

  /**
   * Get retry statistics (database-based)
   */
  async getStatistics(): Promise<{
    pending: number;
    exhausted: number;
  }> {
    try {
      const [pendingResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(unifiedOrders)
        .where(sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'pending_retry'`);

      const [exhaustedResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(unifiedOrders)
        .where(sql`${unifiedOrders.metadata}->>'lastWebhookStatus' = 'exhausted'`);

      return {
        pending: Number(pendingResult?.count || 0),
        exhausted: Number(exhaustedResult?.count || 0),
      };
    } catch (error) {
      console.error('[WebhookRetry] Get statistics error:', error);
      return { pending: 0, exhausted: 0 };
    }
  }
}

export const paymentWebhookRetryService = new PaymentWebhookRetryService();
