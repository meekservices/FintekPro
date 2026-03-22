/**
 * Admin Prospect Dashboard Routes
 * 
 * Comprehensive prospect management for admins:
 * - View all prospects across agents (B2B leads + individual prospects)
 * - Create prospects and assign to agents
 * - Import leads from Zoho CRM
 * - Assignment workflow with history tracking
 */

import { Request, Response, Router } from 'express';
import { db } from '../db';
import { 
  prospectLeads,
  prospectClients,
  leadActivities,
  users
} from '@shared/schema';
import { eq, and, desc, sql, ilike, or, count, isNull, isNotNull } from 'drizzle-orm';
import { ZohoCRMService } from '../zoho/services/crm';
import { getZohoConnectionId } from '../zoho/connection-resolver';
import { apiResponse } from '../utils/responses';
import { requireAdmin } from '../middleware/roleMiddleware';

const router = Router();

/**
 * Get consolidated metrics for admin dashboard
 */
router.get('/metrics', requireAdmin, async (req: any, res: Response) => {
  try {
    const [b2bStats] = await db
      .select({
        total: count(),
        new: sql<number>`COUNT(*) FILTER (WHERE status = 'new')`,
        contacted: sql<number>`COUNT(*) FILTER (WHERE status = 'contacted')`,
        qualified: sql<number>`COUNT(*) FILTER (WHERE status = 'qualified')`,
        converted: sql<number>`COUNT(*) FILTER (WHERE status = 'converted')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE status = 'rejected')`,
        unassigned: sql<number>`COUNT(*) FILTER (WHERE assigned_to IS NULL)`,
        hotLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'hot')`,
        warmLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'warm')`,
        coldLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'cold')`
      })
      .from(prospectLeads);

    const [individualStats] = await db
      .select({
        total: count(),
        prospect: sql<number>`COUNT(*) FILTER (WHERE state = 'prospect')`,
        onboarded: sql<number>`COUNT(*) FILTER (WHERE state = 'onboarded')`,
        activeClient: sql<number>`COUNT(*) FILTER (WHERE state = 'active_client')`
      })
      .from(prospectClients);

    const agentDistribution = await db
      .select({
        agentId: prospectClients.agentId,
        firstName: users.firstName,
        lastName: users.lastName,
        prospectCount: count()
      })
      .from(prospectClients)
      .leftJoin(users, eq(prospectClients.agentId, users.id))
      .groupBy(prospectClients.agentId, users.firstName, users.lastName)
      .orderBy(desc(count()));

    const b2bAgentDistribution = await db
      .select({
        agentId: prospectLeads.assignedTo,
        firstName: users.firstName,
        lastName: users.lastName,
        leadCount: count()
      })
      .from(prospectLeads)
      .leftJoin(users, eq(prospectLeads.assignedTo, users.id))
      .where(isNotNull(prospectLeads.assignedTo))
      .groupBy(prospectLeads.assignedTo, users.firstName, users.lastName)
      .orderBy(desc(count()));

    res.json({
      b2bLeads: b2bStats,
      individualProspects: individualStats,
      agentDistribution: {
        individual: agentDistribution,
        b2b: b2bAgentDistribution
      },
      totals: {
        allProspects: (b2bStats?.total || 0) + (individualStats?.total || 0),
        unassignedB2B: b2bStats?.unassigned || 0
      }
    });
  } catch (error) {
    console.error('Error fetching prospect metrics:', error);
    return apiResponse.serverError(res, 'Failed to fetch prospect metrics');
  }
});

/**
 * Get all B2B prospect leads with filtering
 */
router.get('/b2b-leads', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      status, 
      quality, 
      assignedTo, 
      search,
      source,
      limit = 50,
      offset = 0 
    } = req.query;

    let conditions: any[] = [];
    
    if (status && status !== 'all') {
      conditions.push(eq(prospectLeads.status, status as string));
    }
    if (quality && quality !== 'all') {
      conditions.push(eq(prospectLeads.leadQuality, quality as string));
    }
    if (assignedTo === 'unassigned') {
      conditions.push(isNull(prospectLeads.assignedTo));
    } else if (assignedTo && assignedTo !== 'all') {
      conditions.push(eq(prospectLeads.assignedTo, assignedTo as string));
    }
    if (source && source !== 'all') {
      conditions.push(eq(prospectLeads.source, source as string));
    }
    if (search) {
      conditions.push(
        or(
          ilike(prospectLeads.companyName, `%${search}%`),
          ilike(prospectLeads.primaryEmail, `%${search}%`),
          ilike(prospectLeads.cin, `%${search}%`)
        )
      );
    }

    const leads = await db
      .select({
        id: prospectLeads.id,
        cin: prospectLeads.cin,
        companyName: prospectLeads.companyName,
        primaryEmail: prospectLeads.primaryEmail,
        primaryMobile: prospectLeads.primaryMobile,
        city: prospectLeads.city,
        state: prospectLeads.state,
        address: prospectLeads.address,
        pincode: prospectLeads.pincode,
        industrySegment: prospectLeads.industrySegment,
        companyCategory: prospectLeads.companyCategory,
        leadScore: prospectLeads.leadScore,
        leadQuality: prospectLeads.leadQuality,
        status: prospectLeads.status,
        assignedTo: prospectLeads.assignedTo,
        assignedAgentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        source: prospectLeads.source,
        lastContactedAt: prospectLeads.lastContactedAt,
        nextFollowUpAt: prospectLeads.nextFollowUpAt,
        createdAt: prospectLeads.createdAt,
        compositeScore: prospectLeads.compositeScore,
        wealthScore: prospectLeads.wealthScore,
        activityScore: prospectLeads.activityScore,
        relationshipScore: prospectLeads.relationshipScore,
        estimatedNetworth: prospectLeads.estimatedNetworth,
        scoredAt: prospectLeads.scoredAt,
      })
      .from(prospectLeads)
      .leftJoin(users, eq(prospectLeads.assignedTo, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(prospectLeads.leadScore), desc(prospectLeads.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [totalCount] = await db
      .select({ count: count() })
      .from(prospectLeads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      leads,
      total: totalCount?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching B2B leads:', error);
    return apiResponse.serverError(res, 'Failed to fetch B2B leads');
  }
});

/**
 * Get all individual prospects with filtering
 */
router.get('/individual-prospects', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      state, 
      agentId, 
      clientType,
      search,
      limit = 50,
      offset = 0 
    } = req.query;

    let conditions: any[] = [];
    
    if (state && state !== 'all') {
      conditions.push(eq(prospectClients.state, state as string));
    }
    if (agentId && agentId !== 'all') {
      conditions.push(eq(prospectClients.agentId, agentId as string));
    }
    if (clientType && clientType !== 'all') {
      conditions.push(eq(prospectClients.clientType, clientType as string));
    }
    if (search) {
      conditions.push(
        or(
          ilike(prospectClients.name, `%${search}%`),
          ilike(prospectClients.email, `%${search}%`),
          ilike(prospectClients.pan, `%${search}%`),
          ilike(prospectClients.mobile, `%${search}%`)
        )
      );
    }

    const prospects = await db
      .select({
        id: prospectClients.id,
        name: prospectClients.name,
        email: prospectClients.email,
        mobile: prospectClients.mobile,
        pan: prospectClients.pan,
        clientType: prospectClients.clientType,
        indicativeRiskProfile: prospectClients.indicativeRiskProfile,
        state: prospectClients.state,
        agentId: prospectClients.agentId,
        agentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        portfolioFetchConsent: prospectClients.portfolioFetchConsent,
        advisoryConsent: prospectClients.advisoryConsent,
        createdAt: prospectClients.createdAt,
        updatedAt: prospectClients.updatedAt
      })
      .from(prospectClients)
      .leftJoin(users, eq(prospectClients.agentId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(prospectClients.updatedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [totalCount] = await db
      .select({ count: count() })
      .from(prospectClients)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      prospects,
      total: totalCount?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching individual prospects:', error);
    return apiResponse.serverError(res, 'Failed to fetch individual prospects');
  }
});

/**
 * Get agents for assignment dropdown
 */
router.get('/agents', requireAdmin, async (req: any, res: Response) => {
  try {
    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        roles: users.roles
      })
      .from(users)
      .where(
        or(
          sql`'partner' = ANY(${users.roles})`,
          sql`'agent' = ANY(${users.roles})`,
          sql`'sub_agent' = ANY(${users.roles})`
        )
      )
      .orderBy(users.firstName);

    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return apiResponse.serverError(res, 'Failed to fetch agents');
  }
});

/**
 * Create new B2B prospect lead
 */
router.post('/b2b-leads', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      companyName, 
      cin, 
      primaryEmail, 
      primaryMobile,
      address,
      city,
      state,
      pincode,
      industrySegment,
      companyCategory,
      leadQuality,
      assignedTo,
      notes
    } = req.body;

    if (!companyName) {
      return apiResponse.badRequest(res, 'Company name is required');
    }

    const [newLead] = await db
      .insert(prospectLeads)
      .values({
        companyName,
        cin,
        primaryEmail,
        primaryMobile,
        address,
        city,
        state,
        pincode,
        industrySegment,
        companyCategory: companyCategory || 'mid_market',
        leadQuality: leadQuality || 'warm',
        leadScore: leadQuality === 'hot' ? 80 : leadQuality === 'warm' ? 50 : 20,
        assignedTo,
        source: 'manual',
        status: 'new',
        notes
      })
      .returning();

    if (assignedTo) {
      await db.insert(leadActivities).values({
        leadId: newLead.id,
        activityType: 'assignment',
        description: `Lead assigned to agent by admin`,
        performedBy: req.user.id,
        metadata: { assignedTo, assignedBy: req.user.id }
      });
    }

    res.status(201).json(newLead);
  } catch (error) {
    console.error('Error creating B2B lead:', error);
    return apiResponse.serverError(res, 'Failed to create B2B lead');
  }
});

/**
 * Create new individual prospect
 */
router.post('/individual-prospects', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      name, 
      email, 
      mobile,
      pan,
      clientType,
      indicativeRiskProfile,
      agentId
    } = req.body;

    if (!name || !agentId) {
      return apiResponse.badRequest(res, 'Name and agent assignment are required');
    }

    const [agent] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);

    if (!agent) {
      return apiResponse.badRequest(res, 'Invalid agent ID');
    }

    const [newProspect] = await db
      .insert(prospectClients)
      .values({
        agentId,
        name,
        email,
        mobile,
        pan,
        clientType: clientType || 'individual',
        indicativeRiskProfile,
        state: 'prospect'
      })
      .returning();

    res.status(201).json(newProspect);
  } catch (error) {
    console.error('Error creating individual prospect:', error);
    return apiResponse.serverError(res, 'Failed to create individual prospect');
  }
});

/**
 * Assign/Reassign B2B lead to agent
 */
router.patch('/b2b-leads/:id/assign', requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId, reason } = req.body;

    const [existingLead] = await db
      .select()
      .from(prospectLeads)
      .where(eq(prospectLeads.id, id))
      .limit(1);

    if (!existingLead) {
      return apiResponse.notFound(res, 'Lead not found');
    }

    const previousAgentId = existingLead.assignedTo;

    const [updated] = await db
      .update(prospectLeads)
      .set({ 
        assignedTo: agentId || null,
        updatedAt: new Date()
      })
      .where(eq(prospectLeads.id, id))
      .returning();

    await db.insert(leadActivities).values({
      leadId: id,
      activityType: previousAgentId ? 'reassignment' : 'assignment',
      description: agentId 
        ? `Lead ${previousAgentId ? 'reassigned' : 'assigned'} to agent${reason ? ': ' + reason : ''}`
        : 'Lead unassigned',
      performedBy: req.user.id,
      metadata: { 
        previousAgentId,
        newAgentId: agentId,
        reason,
        assignedBy: req.user.id
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error assigning lead:', error);
    return apiResponse.serverError(res, 'Failed to assign lead');
  }
});

/**
 * Reassign individual prospect to different agent
 */
router.patch('/individual-prospects/:id/assign', requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId, reason } = req.body;

    if (!agentId) {
      return apiResponse.badRequest(res, 'Agent ID is required');
    }

    const [existingProspect] = await db
      .select()
      .from(prospectClients)
      .where(eq(prospectClients.id, id))
      .limit(1);

    if (!existingProspect) {
      return apiResponse.notFound(res, 'Prospect not found');
    }

    const previousAgentId = existingProspect.agentId;

    const [updated] = await db
      .update(prospectClients)
      .set({ 
        agentId,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, id))
      .returning();

    res.json({ 
      ...updated,
      reassignment: {
        previousAgentId,
        newAgentId: agentId,
        reason,
        reassignedBy: req.user.id,
        reassignedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error reassigning prospect:', error);
    return apiResponse.serverError(res, 'Failed to reassign prospect');
  }
});

/**
 * Bulk assign B2B leads
 */
router.post('/b2b-leads/bulk-assign', requireAdmin, async (req: any, res: Response) => {
  try {
    const { leadIds, agentId, reason } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return apiResponse.badRequest(res, 'Lead IDs array is required');
    }

    const results = await Promise.allSettled(
      leadIds.map(async (leadId: string) => {
        const [existingLead] = await db
          .select({ assignedTo: prospectLeads.assignedTo })
          .from(prospectLeads)
          .where(eq(prospectLeads.id, leadId))
          .limit(1);

        await db
          .update(prospectLeads)
          .set({ 
            assignedTo: agentId || null,
            updatedAt: new Date()
          })
          .where(eq(prospectLeads.id, leadId));

        await db.insert(leadActivities).values({
          leadId,
          activityType: existingLead?.assignedTo ? 'reassignment' : 'assignment',
          description: `Bulk ${existingLead?.assignedTo ? 'reassignment' : 'assignment'}${reason ? ': ' + reason : ''}`,
          performedBy: req.user.id,
          metadata: { 
            previousAgentId: existingLead?.assignedTo,
            newAgentId: agentId,
            reason,
            bulkOperation: true
          }
        });

        return leadId;
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      processed: leadIds.length,
      succeeded,
      failed
    });
  } catch (error) {
    console.error('Error bulk assigning leads:', error);
    return apiResponse.serverError(res, 'Failed to bulk assign leads');
  }
});

/**
 * Get assignment history for a lead
 */
router.get('/b2b-leads/:id/history', requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const activities = await db
      .select({
        id: leadActivities.id,
        activityType: leadActivities.activityType,
        description: leadActivities.description,
        performedBy: leadActivities.performedBy,
        performerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        metadata: leadActivities.metadata,
        createdAt: leadActivities.createdAt
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.performedBy, users.id))
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt));

    res.json(activities);
  } catch (error) {
    console.error('Error fetching lead history:', error);
    return apiResponse.serverError(res, 'Failed to fetch lead history');
  }
});

/**
 * Import leads from Zoho CRM
 */
router.post('/import/zoho-crm', requireAdmin, async (req: any, res: Response) => {
  try {
    const { module = 'Leads', assignToAgent, maxRecords = 100 } = req.body;

    const connectionId = await getZohoConnectionId();
    
    if (!connectionId) {
      return apiResponse.badRequest(res, 'Zoho CRM is not configured. Please set up Zoho integration first.');
    }

    const crmService = new ZohoCRMService(connectionId);
    
    let records: any[] = [];
    
    if (module === 'Leads') {
      records = await crmService.getLeads(maxRecords);
    } else if (module === 'Contacts') {
      records = await crmService.getContacts(maxRecords);
    }

    if (!records || records.length === 0) {
      return res.json({ 
        success: true, 
        imported: 0, 
        message: 'No records found in Zoho CRM' 
      });
    }

    const importBatchId = `zoho_${Date.now()}`;
    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      const email = record.Email;
      
      if (email) {
        const [existing] = await db
          .select({ id: prospectLeads.id })
          .from(prospectLeads)
          .where(ilike(prospectLeads.primaryEmail, email))
          .limit(1);

        if (existing) {
          skipped++;
          continue;
        }
      }

      await db.insert(prospectLeads).values({
        companyName: record.Company || record.Account_Name || `${record.First_Name || ''} ${record.Last_Name || ''}`.trim() || 'Unknown',
        primaryEmail: record.Email,
        primaryMobile: record.Mobile || record.Phone,
        city: record.Mailing_City || record.City,
        state: record.Mailing_State || record.State,
        industrySegment: record.Industry,
        leadQuality: mapZohoLeadStatus(record.Lead_Status),
        leadScore: 50,
        assignedTo: assignToAgent || null,
        source: 'zoho_crm',
        importBatchId,
        status: 'new',
        notes: `Imported from Zoho CRM (${module}). Zoho ID: ${record.id}`
      });

      imported++;
    }

    res.json({
      success: true,
      imported,
      skipped,
      total: records.length,
      batchId: importBatchId
    });
  } catch (error: any) {
    console.error('Error importing from Zoho CRM:', error);
    return apiResponse.serverError(res, `Failed to import from Zoho CRM: ${error.message}`);
  }
});

/**
 * Get Zoho CRM connection status
 */
router.get('/zoho-status', requireAdmin, async (req: any, res: Response) => {
  try {
    const connectionId = await getZohoConnectionId();
    
    res.json({
      configured: !!connectionId,
      connectionId: connectionId || null
    });
  } catch (error) {
    console.error('Error checking Zoho status:', error);
    res.json({ configured: false, connectionId: null });
  }
});

function mapZohoLeadStatus(status: string | undefined): string {
  if (!status) return 'warm';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('hot') || statusLower.includes('qualified')) return 'hot';
  if (statusLower.includes('cold') || statusLower.includes('junk')) return 'cold';
  return 'warm';
}

export function registerAdminProspectRoutes(app: any) {
  app.use('/api/admin/prospects', router);
}
