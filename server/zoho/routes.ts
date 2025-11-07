import { Router } from 'express';
import { ZohoOAuthService } from './oauth';
import { ZohoCRMService } from './services/crm';
import { db } from '../db';
import { zohoConnections, zohoEntityMappings, zohoSyncLogs, zohoWebhookEvents } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { zohoRateLimiter } from './rate-limiter';
import crypto from 'crypto';

const router = Router();

// Webhook secret for HMAC validation (should be set in environment variables)
const ZOHO_WEBHOOK_SECRET = process.env.ZOHO_WEBHOOK_SECRET || '';

/**
 * Verify Zoho webhook HMAC signature
 * Zoho uses HMAC-SHA256 with base64 encoding
 * 
 * Security Notes:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Validates buffer lengths before comparison
 * - Trims signature header to prevent whitespace issues
 * - Fails closed when secret is not configured in production
 */
function verifyZohoWebhookSignature(
  rawPayload: string,
  signatureFromHeader: string | undefined,
  secret: string
): boolean {
  // Trim and validate signature header
  const trimmedSignature = signatureFromHeader?.trim();
  
  if (!trimmedSignature) {
    console.warn('⚠️ Missing or empty webhook signature header');
    return false;
  }

  if (!secret) {
    const isProduction = process.env.NODE_ENV === 'production';
    console.error(`❌ ZOHO_WEBHOOK_SECRET not configured${isProduction ? ' (PRODUCTION)' : ''}`);
    // Fail closed in production - reject webhooks without secret
    return isProduction ? false : true; // Allow in dev/test for convenience
  }

  try {
    // Compute HMAC-SHA256 hash of raw payload
    const hmac = crypto.createHmac('sha256', secret);
    const computedSignature = hmac.update(rawPayload).digest('base64');

    // Convert to buffers for timing-safe comparison
    const computedBuffer = Buffer.from(computedSignature);
    const receivedBuffer = Buffer.from(trimmedSignature);
    
    // Validate buffer lengths match (prevents Buffer.compare crashes)
    if (computedBuffer.length !== receivedBuffer.length) {
      console.warn(`⚠️ Signature length mismatch: computed=${computedBuffer.length}, received=${receivedBuffer.length}`);
      return false;
    }

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(computedBuffer, receivedBuffer);
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

/**
 * GET /api/zoho/auth/url
 * Get Zoho OAuth authorization URL
 */
router.get('/auth/url', async (req, res) => {
  try {
    const { services, dataCenter = 'com' } = req.query;
    
    if (!services) {
      return res.status(400).json({ message: 'Services parameter is required' });
    }

    const servicesList = (services as string).split(',');
    
    // Define scopes based on requested services
    const scopeMap: Record<string, string[]> = {
      CRM: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
      Books: ['ZohoBooks.fullaccess.all'],
      Desk: ['Desk.tickets.ALL', 'Desk.contacts.ALL', 'Desk.basic.READ'],
      WorkDrive: ['WorkDrive.files.ALL', 'WorkDrive.folders.ALL'],
      People: ['ZohoPeople.employee.ALL'],
      Campaigns: ['ZohoCampaigns.campaign.ALL', 'ZohoCampaigns.contact.ALL'],
      Analytics: ['ZohoAnalytics.fullaccess.all'],
      Projects: ['ZohoProjects.portals.ALL']
    };

    const scopes: string[] = [];
    servicesList.forEach(service => {
      if (scopeMap[service]) {
        scopes.push(...scopeMap[service]);
      }
    });

    const oauthService = new ZohoOAuthService(dataCenter as string);
    const state = Buffer.from(JSON.stringify({ services: servicesList, dataCenter })).toString('base64');
    const authUrl = oauthService.getAuthorizationUrl(scopes, state);

    res.json({ authUrl, state });
  } catch (error: any) {
    console.error('Zoho auth URL generation error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/callback
 * OAuth callback endpoint
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ message: 'Missing authorization code or state' });
    }

    // Decode state to get services and dataCenter
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { services, dataCenter = 'com' } = stateData;

    const oauthService = new ZohoOAuthService(dataCenter);
    const tokenResponse = await oauthService.getTokensFromCode(code as string);

    // Get current user ID from session
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Save connection
    const connectionName = `Zoho ${services.join(', ')} - ${new Date().toISOString().split('T')[0]}`;
    const connectionId = await oauthService.saveConnection(
      tokenResponse,
      userId,
      connectionName,
      services
    );

    // Redirect to admin portal with success message
    res.redirect(`/admin/integrations/zoho?connected=${connectionId}`);
  } catch (error: any) {
    console.error('Zoho OAuth callback error:', error);
    res.redirect(`/admin/integrations/zoho?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/zoho/connections
 * Get all Zoho connections
 */
router.get('/connections', async (req, res) => {
  try {
    const connections = await db
      .select()
      .from(zohoConnections)
      .orderBy(desc(zohoConnections.createdAt));

    res.json(connections);
  } catch (error: any) {
    console.error('Get Zoho connections error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/connections/:id
 * Get specific connection details
 */
router.get('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [connection] = await db
      .select()
      .from(zohoConnections)
      .where(eq(zohoConnections.id, id))
      .limit(1);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    // Don't expose sensitive tokens
    const safeConnection = {
      ...connection,
      accessToken: '***',
      refreshToken: '***'
    };

    res.json(safeConnection);
  } catch (error: any) {
    console.error('Get Zoho connection error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/zoho/connections/:id
 * Delete/revoke a connection
 */
router.delete('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [connection] = await db
      .select()
      .from(zohoConnections)
      .where(eq(zohoConnections.id, id))
      .limit(1);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    // Revoke token at Zoho (decrypt token first)
    const oauthService = new ZohoOAuthService(connection.zohoDataCenter || 'com');
    try {
      const { encryptionService } = await import('../encryption-service');
      const decryptedToken = encryptionService.decrypt(connection.accessToken);
      if (decryptedToken) {
        await oauthService.revokeToken(decryptedToken);
      }
    } catch (error) {
      console.warn('Token revocation failed, continuing with deletion:', error);
    }

    // Delete from database
    await db
      .delete(zohoConnections)
      .where(eq(zohoConnections.id, id));

    res.json({ message: 'Connection deleted successfully' });
  } catch (error: any) {
    console.error('Delete Zoho connection error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/crm/sync/partner/:partnerId
 * Sync a partner to Zoho CRM
 */
router.post('/crm/sync/partner/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const crmService = new ZohoCRMService(connectionId);
    const zohoAccountId = await crmService.syncPartnerToAccount(partnerId);

    res.json({
      message: 'Partner synced successfully',
      zohoAccountId
    });
  } catch (error: any) {
    console.error('Sync partner error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/crm/sync/user/:userId
 * Sync a user to Zoho CRM
 */
router.post('/crm/sync/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const crmService = new ZohoCRMService(connectionId);
    const zohoContactId = await crmService.syncUserToContact(userId);

    res.json({
      message: 'User synced successfully',
      zohoContactId
    });
  } catch (error: any) {
    console.error('Sync user error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/crm/sync/bulk/partners
 * Bulk sync partners to Zoho CRM
 */
router.post('/crm/sync/bulk/partners', async (req, res) => {
  try {
    const { connectionId, partnerIds } = req.body;

    if (!connectionId || !partnerIds || !Array.isArray(partnerIds)) {
      return res.status(400).json({ message: 'Connection ID and partner IDs array are required' });
    }

    const crmService = new ZohoCRMService(connectionId);
    await crmService.bulkSyncPartnersToAccounts(partnerIds);

    res.json({ message: 'Bulk sync initiated successfully' });
  } catch (error: any) {
    console.error('Bulk sync partners error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/mappings
 * Get entity mappings
 */
router.get('/mappings', async (req, res) => {
  try {
    const { connectionId, entityType } = req.query;

    let query = db.select().from(zohoEntityMappings);

    if (connectionId) {
      query = query.where(eq(zohoEntityMappings.connectionId, connectionId as string)) as any;
    }

    const mappings = await query;

    // Filter by entity type if provided
    const filteredMappings = entityType
      ? mappings.filter(m => m.fintekproEntityType === entityType)
      : mappings;

    res.json(filteredMappings);
  } catch (error: any) {
    console.error('Get mappings error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/sync-logs
 * Get sync logs
 */
router.get('/sync-logs', async (req, res) => {
  try {
    const { connectionId, limit = 100 } = req.query;

    let query = db
      .select()
      .from(zohoSyncLogs)
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(parseInt(limit as string));

    if (connectionId) {
      query = query.where(eq(zohoSyncLogs.connectionId, connectionId as string)) as any;
    }

    const logs = await query;

    res.json(logs);
  } catch (error: any) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/webhooks/crm
 * Webhook receiver for Zoho CRM events with HMAC signature validation
 */
router.post('/webhooks/crm', async (req, res) => {
  try {
    const payload = req.body;
    
    // SECURITY: Verify webhook signature
    if (ZOHO_WEBHOOK_SECRET) {
      const signature = req.headers['x-zoho-webhook-signature'] as string | undefined;
      
      // Get raw body for HMAC validation
      // Note: Raw body should be captured by middleware like express.json({ verify: ... })
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      
      const isValid = verifyZohoWebhookSignature(rawBody, signature, ZOHO_WEBHOOK_SECRET);
      
      if (!isValid) {
        console.error('🚨 SECURITY ALERT: Invalid webhook signature for CRM webhook');
        await db.insert(zohoWebhookEvents).values({
          zohoService: 'CRM',
          zohoModule: 'unknown',
          eventType: 'security_violation',
          webhookPayload: { error: 'Invalid signature', headers: req.headers },
          status: 'rejected'
        });
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }
      
      console.log('✅ CRM webhook signature verified');
    } else {
      console.warn('⚠️ ZOHO_WEBHOOK_SECRET not configured - webhook validation disabled');
    }
    
    // Log webhook event
    await db.insert(zohoWebhookEvents).values({
      zohoService: 'CRM',
      zohoModule: payload.module || 'unknown',
      eventType: payload.event_type || 'update',
      webhookPayload: payload,
      status: 'received'
    });

    res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('CRM webhook error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/webhooks/books
 * Webhook receiver for Zoho Books events with HMAC signature validation
 */
router.post('/webhooks/books', async (req, res) => {
  try {
    const payload = req.body;
    
    // SECURITY: Verify webhook signature
    if (ZOHO_WEBHOOK_SECRET) {
      const signature = req.headers['x-zoho-webhook-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      
      const isValid = verifyZohoWebhookSignature(rawBody, signature, ZOHO_WEBHOOK_SECRET);
      
      if (!isValid) {
        console.error('🚨 SECURITY ALERT: Invalid webhook signature for Books webhook');
        await db.insert(zohoWebhookEvents).values({
          zohoService: 'Books',
          zohoModule: 'unknown',
          eventType: 'security_violation',
          webhookPayload: { error: 'Invalid signature', headers: req.headers },
          status: 'rejected'
        });
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }
      
      console.log('✅ Books webhook signature verified');
    }
    
    await db.insert(zohoWebhookEvents).values({
      zohoService: 'Books',
      zohoModule: payload.module || 'unknown',
      eventType: payload.event_type || 'update',
      webhookPayload: payload,
      status: 'received'
    });

    res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('Books webhook error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/webhooks/desk
 * Webhook receiver for Zoho Desk events with HMAC signature validation
 */
router.post('/webhooks/desk', async (req, res) => {
  try {
    const payload = req.body;
    
    // SECURITY: Verify webhook signature
    if (ZOHO_WEBHOOK_SECRET) {
      const signature = req.headers['x-zoho-webhook-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      
      const isValid = verifyZohoWebhookSignature(rawBody, signature, ZOHO_WEBHOOK_SECRET);
      
      if (!isValid) {
        console.error('🚨 SECURITY ALERT: Invalid webhook signature for Desk webhook');
        await db.insert(zohoWebhookEvents).values({
          zohoService: 'Desk',
          zohoModule: 'unknown',
          eventType: 'security_violation',
          webhookPayload: { error: 'Invalid signature', headers: req.headers },
          status: 'rejected'
        });
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }
      
      console.log('✅ Desk webhook signature verified');
    }
    
    await db.insert(zohoWebhookEvents).values({
      zohoService: 'Desk',
      zohoModule: payload.module || 'unknown',
      eventType: payload.event_type || 'update',
      webhookPayload: payload,
      status: 'received'
    });

    res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('Desk webhook error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/zoho/crm/commission-deal
 * Create a commission deal in Zoho CRM
 */
router.post('/crm/commission-deal', async (req, res) => {
  try {
    const { connectionId, commissionId } = req.body;

    if (!connectionId || !commissionId) {
      return res.status(400).json({ message: 'Connection ID and commission ID are required' });
    }

    const crmService = new ZohoCRMService(connectionId);
    const zohoDealId = await crmService.createCommissionDeal(commissionId);

    res.json({
      message: 'Commission deal created successfully',
      zohoDealId
    });
  } catch (error: any) {
    console.error('Create commission deal error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /api/zoho/crm/commission-deal/:commissionId
 * Update commission deal stage
 */
router.patch('/crm/commission-deal/:commissionId', async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { connectionId, status } = req.body;

    if (!connectionId || !status) {
      return res.status(400).json({ message: 'Connection ID and status are required' });
    }

    const crmService = new ZohoCRMService(connectionId);
    await crmService.updateCommissionDealStage(commissionId, status);

    res.json({ message: 'Commission deal stage updated successfully' });
  } catch (error: any) {
    console.error('Update commission deal error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/crm/partner/:partnerId/deals
 * Get all deals for a partner
 */
router.get('/crm/partner/:partnerId/deals', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { connectionId } = req.query;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const crmService = new ZohoCRMService(connectionId as string);
    const deals = await crmService.getPartnerDeals(partnerId);

    res.json(deals);
  } catch (error: any) {
    console.error('Get partner deals error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// ADMIN ROUTES - For Admin Portal UI
// ============================================================================

/**
 * GET /api/zoho/admin/sync-logs
 * Get sync logs with filtering and pagination
 */
router.get('/admin/sync-logs', async (req, res) => {
  try {
    const { 
      connectionId, 
      service, 
      status, 
      startDate, 
      endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    const conditions = [];
    
    if (connectionId) {
      conditions.push(eq(zohoSyncLogs.connectionId, connectionId as string));
    }
    if (service) {
      conditions.push(eq(zohoSyncLogs.zohoService, service as string));
    }
    if (status) {
      conditions.push(eq(zohoSyncLogs.status, status as 'success' | 'failure'));
    }
    if (startDate) {
      conditions.push(gte(zohoSyncLogs.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(zohoSyncLogs.createdAt, new Date(endDate as string)));
    }

    const logs = await db
      .select()
      .from(zohoSyncLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(zohoSyncLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = Number(countResult[0]?.count || 0);

    res.json({
      logs,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + logs.length
      }
    });
  } catch (error: any) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/admin/webhook-events
 * Get webhook events with filtering
 */
router.get('/admin/webhook-events', async (req, res) => {
  try {
    const { 
      connectionId, 
      service,
      status,
      limit = '50',
      offset = '0'
    } = req.query;

    const conditions = [];
    
    if (connectionId) {
      conditions.push(eq(zohoWebhookEvents.connectionId, connectionId as string));
    }
    if (service) {
      conditions.push(eq(zohoWebhookEvents.zohoService, service as string));
    }
    if (status) {
      conditions.push(eq(zohoWebhookEvents.status, status as 'success' | 'failure'));
    }

    const events = await db
      .select()
      .from(zohoWebhookEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(zohoWebhookEvents.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(zohoWebhookEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = Number(countResult[0]?.count || 0);

    res.json({
      events,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + events.length
      }
    });
  } catch (error: any) {
    console.error('Get webhook events error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/admin/stats
 * Get aggregated statistics
 */
router.get('/admin/stats', async (req, res) => {
  try {
    const { connectionId, days = '7' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const conditions = [gte(zohoSyncLogs.createdAt, startDate)];
    if (connectionId) {
      conditions.push(eq(zohoSyncLogs.connectionId, connectionId as string));
    }

    // Get sync stats
    const syncStats = await db
      .select({
        service: zohoSyncLogs.zohoService,
        status: zohoSyncLogs.status,
        count: sql<number>`count(*)`,
        totalRecords: sql<number>`sum(${zohoSyncLogs.recordsProcessed})`,
        avgDuration: sql<number>`avg(${zohoSyncLogs.durationMs})`
      })
      .from(zohoSyncLogs)
      .where(and(...conditions))
      .groupBy(zohoSyncLogs.zohoService, zohoSyncLogs.status);

    // Get webhook stats
    const webhookConditions = [gte(zohoWebhookEvents.createdAt, startDate)];
    if (connectionId) {
      webhookConditions.push(eq(zohoWebhookEvents.connectionId, connectionId as string));
    }

    const webhookStats = await db
      .select({
        service: zohoWebhookEvents.zohoService,
        status: zohoWebhookEvents.status,
        count: sql<number>`count(*)`
      })
      .from(zohoWebhookEvents)
      .where(and(...webhookConditions))
      .groupBy(zohoWebhookEvents.zohoService, zohoWebhookEvents.status);

    res.json({
      syncStats,
      webhookStats,
      period: {
        days: parseInt(days as string),
        startDate,
        endDate: new Date()
      }
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/zoho/admin/rate-limits
 * Get current rate limit status for all connections
 */
router.get('/admin/rate-limits', async (req, res) => {
  try {
    const connections = await db.select().from(zohoConnections);

    const rateLimits = connections.map(conn => ({
      connectionId: conn.id,
      connectionName: conn.connectionName,
      availableTokens: zohoRateLimiter.getAvailableTokens(conn.id),
      maxTokens: 50000, // Base limit
      percentUsed: ((50000 - zohoRateLimiter.getAvailableTokens(conn.id)) / 50000) * 100
    }));

    res.json({ rateLimits });
  } catch (error: any) {
    console.error('Get rate limits error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
