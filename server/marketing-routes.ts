/**
 * Marketing Automation Routes
 * 
 * Endpoints for:
 * - Email campaigns (Zoho Campaigns)
 * - WhatsApp broadcasts (AiSensy)
 * - Lead prospecting (Probe42)
 * - Client intelligence
 * - Campaign analytics
 */

import { Request, Response } from 'express';
import { db } from './db';
import { 
  marketingCampaigns, 
  campaignRecipients,
  prospectLeads,
  leadActivities,
  clientIntelligence,
  users
} from '../shared/schema';
import { eq, and, desc, sql, ilike, gte, lte } from 'drizzle-orm';
import { getZohoCampaignsService } from './zoho-campaigns-service';
import { getAiSensyService } from './aisensy-service';
import { getProbe42Service } from './probe42-service';
import { apiResponse } from './utils/responses';

// Helper to check if user is admin
const requireAdmin = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return apiResponse.forbidden(res, 'Admin access required');
  }
  next();
};

export function registerMarketingRoutes(app: any) {
  
  // ============================================================================
  // MARKETING CAMPAIGNS - Email & WhatsApp
  // ============================================================================

  /**
   * Get all marketing campaigns
   */
  app.get('/api/admin/marketing/campaigns', requireAdmin, async (req: any, res: Response) => {
    try {
      const { type, status } = req.query;
      
      let query = db.select().from(marketingCampaigns);
      
      const conditions: any[] = [];
      if (type) conditions.push(eq(marketingCampaigns.campaignType, type as string));
      if (status) conditions.push(eq(marketingCampaigns.status, status as string));
      
      const campaigns = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(marketingCampaigns.createdAt))
        : await query.orderBy(desc(marketingCampaigns.createdAt));

      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return apiResponse.serverError(res, 'Failed to fetch campaigns');
    }
  });

  /**
   * Get campaign by ID
   */
  app.get('/api/admin/marketing/campaigns/:id', requireAdmin, async (req: any, res: Response) => {
    try {
      const [campaign] = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, req.params.id));

      if (!campaign) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return apiResponse.serverError(res, 'Failed to fetch campaign');
    }
  });

  /**
   * Create new marketing campaign
   */
  app.post('/api/admin/marketing/campaigns', requireAdmin, async (req: any, res: Response) => {
    try {
      const campaignData = {
        ...req.body,
        createdBy: req.user.id,
        status: 'draft'
      };

      const [campaign] = await db
        .insert(marketingCampaigns)
        .values(campaignData)
        .returning();

      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      return apiResponse.serverError(res, 'Failed to create campaign');
    }
  });

  /**
   * Update campaign
   */
  app.patch('/api/admin/marketing/campaigns/:id', requireAdmin, async (req: any, res: Response) => {
    try {
      const [updated] = await db
        .update(marketingCampaigns)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(marketingCampaigns.id, req.params.id))
        .returning();

      if (!updated) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating campaign:', error);
      return apiResponse.serverError(res, 'Failed to update campaign');
    }
  });

  /**
   * Delete campaign
   */
  app.delete('/api/admin/marketing/campaigns/:id', requireAdmin, async (req: any, res: Response) => {
    try {
      await db
        .delete(marketingCampaigns)
        .where(eq(marketingCampaigns.id, req.params.id));

      res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return apiResponse.serverError(res, 'Failed to delete campaign');
    }
  });

  /**
   * Send/schedule email campaign via Zoho
   */
  app.post('/api/admin/marketing/campaigns/:id/send-email', requireAdmin, async (req: any, res: Response) => {
    try {
      const [campaign] = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, req.params.id));

      if (!campaign) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      if (campaign.campaignType !== 'email') {
        return apiResponse.badRequest(res, 'Campaign is not an email campaign');
      }

      const zoho = getZohoCampaignsService();
      
      // Create campaign in Zoho
      const zohoCampaignKey = await zoho.createCampaign({
        name: campaign.name,
        subject: campaign.emailSubject!,
        fromEmail: campaign.emailFromName!,
        fromName: campaign.emailFromName || undefined,
        replyTo: campaign.emailReplyTo || undefined,
        htmlContent: campaign.emailHtmlContent!,
        textContent: campaign.emailTextContent || undefined
      });

      if (!zohoCampaignKey) {
        return apiResponse.serverError(res, 'Failed to create campaign in Zoho');
      }

      // Update campaign with Zoho ID
      await db
        .update(marketingCampaigns)
        .set({ 
          zohoCampaignId: zohoCampaignKey,
          status: req.body.sendNow ? 'sending' : 'scheduled',
          scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
          updatedAt: new Date()
        })
        .where(eq(marketingCampaigns.id, req.params.id));

      // Send or schedule
      if (req.body.sendNow) {
        await zoho.sendCampaign(zohoCampaignKey);
      } else if (req.body.scheduledAt) {
        await zoho.scheduleCampaign(zohoCampaignKey, new Date(req.body.scheduledAt));
      }

      res.json({ 
        message: req.body.sendNow ? 'Campaign sent' : 'Campaign scheduled',
        zohoCampaignKey 
      });
    } catch (error) {
      console.error('Error sending email campaign:', error);
      return apiResponse.serverError(res, 'Failed to send email campaign');
    }
  });

  /**
   * Send WhatsApp broadcast via AiSensy
   */
  app.post('/api/admin/marketing/campaigns/:id/send-whatsapp', requireAdmin, async (req: any, res: Response) => {
    try {
      const [campaign] = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, req.params.id));

      if (!campaign) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      if (campaign.campaignType !== 'whatsapp') {
        return apiResponse.badRequest(res, 'Campaign is not a WhatsApp campaign');
      }

      const aisensy = getAiSensyService();
      
      // Get recipients
      const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, req.params.id));

      if (recipients.length === 0) {
        return apiResponse.badRequest(res, 'No recipients found for campaign');
      }

      // Send broadcast
      const broadcast = await aisensy.sendBroadcast({
        campaignName: campaign.name,
        template: {
          templateName: campaign.whatsappTemplateName!,
          bodyParams: req.body.bodyParams || [],
          mediaUrl: campaign.whatsappMediaUrl || undefined
        },
        recipients: recipients.map(r => ({
          phone: aisensy.formatPhoneNumber(r.mobile!),
          customParams: []
        })),
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined
      });

      if (!broadcast) {
        return apiResponse.serverError(res, 'Failed to send WhatsApp broadcast');
      }

      // Update campaign
      await db
        .update(marketingCampaigns)
        .set({
          aisensyBroadcastId: broadcast.broadcastId,
          status: broadcast.status === 'scheduled' ? 'scheduled' : 'sending',
          sentCount: broadcast.totalRecipients,
          updatedAt: new Date()
        })
        .where(eq(marketingCampaigns.id, req.params.id));

      res.json({
        message: 'WhatsApp broadcast initiated',
        broadcastId: broadcast.broadcastId,
        totalRecipients: broadcast.totalRecipients
      });
    } catch (error) {
      console.error('Error sending WhatsApp broadcast:', error);
      return apiResponse.serverError(res, 'Failed to send WhatsApp broadcast');
    }
  });

  /**
   * Sync campaign analytics from Zoho/AiSensy
   */
  app.post('/api/admin/marketing/campaigns/:id/sync-analytics', requireAdmin, async (req: any, res: Response) => {
    try {
      const [campaign] = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, req.params.id));

      if (!campaign) {
        return apiResponse.notFound(res, 'Campaign not found');
      }

      let stats: any = null;

      if (campaign.campaignType === 'email' && campaign.zohoCampaignId) {
        const zoho = getZohoCampaignsService();
        stats = await zoho.getCampaignStats(campaign.zohoCampaignId);
        
        if (stats) {
          await db
            .update(marketingCampaigns)
            .set({
              sentCount: stats.sentCount,
              deliveredCount: stats.deliveredCount,
              openedCount: stats.openedCount,
              clickedCount: stats.clickedCount,
              bouncedCount: stats.bouncedCount,
              unsubscribedCount: stats.unsubscribedCount,
              updatedAt: new Date()
            })
            .where(eq(marketingCampaigns.id, req.params.id));
        }
      } else if (campaign.campaignType === 'whatsapp' && campaign.aisensyBroadcastId) {
        const aisensy = getAiSensyService();
        stats = await aisensy.getBroadcastAnalytics(campaign.aisensyBroadcastId);
        
        if (stats) {
          await db
            .update(marketingCampaigns)
            .set({
              sentCount: stats.sentCount,
              deliveredCount: stats.deliveredCount,
              openedCount: stats.readCount, // Read = Opened for WhatsApp
              updatedAt: new Date()
            })
            .where(eq(marketingCampaigns.id, req.params.id));
        }
      }

      res.json({ message: 'Analytics synced successfully', stats });
    } catch (error) {
      console.error('Error syncing analytics:', error);
      return apiResponse.serverError(res, 'Failed to sync analytics');
    }
  });

  // ============================================================================
  // CAMPAIGN RECIPIENTS
  // ============================================================================

  /**
   * Get campaign recipients
   */
  app.get('/api/admin/marketing/campaigns/:id/recipients', requireAdmin, async (req: any, res: Response) => {
    try {
      const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, req.params.id));

      res.json(recipients);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      return apiResponse.serverError(res, 'Failed to fetch recipients');
    }
  });

  /**
   * Add recipients to campaign
   */
  app.post('/api/admin/marketing/campaigns/:id/recipients', requireAdmin, async (req: any, res: Response) => {
    try {
      const { userIds, segment } = req.body;
      
      let targetUsers: any[] = [];

      if (userIds && userIds.length > 0) {
        // Specific users
        targetUsers = await db
          .select()
          .from(users)
          .where(sql`${users.id} = ANY(${userIds})`);
      } else if (segment) {
        // User segment
        switch (segment) {
          case 'all':
            targetUsers = await db.select().from(users);
            break;
          case 'kyc_pending':
            targetUsers = await db.select().from(users).where(eq(users.kycStatus, 'pending'));
            break;
          case 'kyc_verified':
            targetUsers = await db.select().from(users).where(eq(users.kycStatus, 'verified'));
            break;
          // Add more segments as needed
        }
      }

      const recipientData = targetUsers.map(user => ({
        campaignId: req.params.id,
        userId: user.id,
        email: user.email,
        mobile: user.mobile,
        fullName: user.fullName,
        status: 'pending'
      }));

      const inserted = await db
        .insert(campaignRecipients)
        .values(recipientData)
        .returning();

      // Update campaign recipient count
      await db
        .update(marketingCampaigns)
        .set({ 
          recipientCount: inserted.length,
          updatedAt: new Date()
        })
        .where(eq(marketingCampaigns.id, req.params.id));

      res.status(201).json({
        message: `${inserted.length} recipients added`,
        count: inserted.length
      });
    } catch (error) {
      console.error('Error adding recipients:', error);
      return apiResponse.serverError(res, 'Failed to add recipients');
    }
  });

  // ============================================================================
  // PROSPECT LEADS - Probe42 Integration
  // ============================================================================

  /**
   * Search companies via Probe42
   */
  app.post('/api/admin/marketing/leads/search', requireAdmin, async (req: any, res: Response) => {
    try {
      const probe42 = getProbe42Service();
      const companies = await probe42.searchCompanies(req.body);

      res.json({ companies, count: companies.length });
    } catch (error) {
      console.error('Error searching companies:', error);
      return apiResponse.serverError(res, 'Failed to search companies');
    }
  });

  /**
   * Get company details from Probe42
   */
  app.get('/api/admin/marketing/leads/company/:cin', requireAdmin, async (req: any, res: Response) => {
    try {
      const probe42 = getProbe42Service();
      const company = await probe42.getCompanyDetails(req.params.cin);

      if (!company) {
        return apiResponse.notFound(res, 'Company not found');
      }

      res.json(company);
    } catch (error) {
      console.error('Error fetching company details:', error);
      return apiResponse.serverError(res, 'Failed to fetch company details');
    }
  });

  /**
   * Import prospect lead from Probe42
   */
  app.post('/api/admin/marketing/leads/import', requireAdmin, async (req: any, res: Response) => {
    try {
      const { cin } = req.body;
      
      // Check if lead already exists
      const [existing] = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.cin, cin));

      if (existing) {
        return apiResponse.badRequest(res, 'Lead already imported');
      }

      const probe42 = getProbe42Service();
      const company = await probe42.getCompanyDetails(cin);

      if (!company) {
        return apiResponse.notFound(res, 'Company not found in Probe42');
      }

      // Calculate lead score
      const leadScore = probe42.calculateLeadScore(company);
      const leadQuality = probe42.getLeadQuality(leadScore);

      // Calculate investable surplus
      const investableSurplus = company.financials && company.financials.length > 0
        ? probe42.calculateInvestableSurplus(company.financials[0])
        : 0;

      // Import lead
      const [lead] = await db
        .insert(prospectLeads)
        .values({
          cin: company.cin || null,
          companyName: company.companyName,
          registrationNumber: company.registrationNumber || null,
          primaryEmail: company.email || null,
          primaryMobile: company.phone || null,
          website: company.website || null,
          address: company.registeredAddress || null,
          city: company.city || null,
          state: company.state || null,
          pincode: company.pincode || null,
          paidUpCapital: company.paidUpCapital?.toString() || null,
          authorizedCapital: company.authorizedCapital?.toString() || null,
          annualRevenue: company.financials?.[0]?.revenue?.toString() || null,
          netProfit: company.financials?.[0]?.netProfit?.toString() || null,
          ebitda: company.financials?.[0]?.ebitda?.toString() || null,
          totalAssets: company.financials?.[0]?.totalAssets?.toString() || null,
          debtToEquityRatio: company.financials?.[0]?.debtToEquityRatio?.toString() || null,
          currentRatio: company.financials?.[0]?.currentRatio?.toString() || null,
          roe: company.financials?.[0]?.roe?.toString() || null,
          probe42Score: company.probe42Score?.score || null,
          directors: company.directors as any,
          authorizedSignatories: company.authorizedSignatories as any,
          leadScore,
          leadQuality,
          investableSurplus: investableSurplus.toString(),
          source: 'probe42',
          assignedTo: req.body.assignedTo || null
        })
        .returning();

      res.status(201).json(lead);
    } catch (error) {
      console.error('Error importing lead:', error);
      return apiResponse.serverError(res, 'Failed to import lead');
    }
  });

  /**
   * Get all prospect leads
   */
  app.get('/api/admin/marketing/leads', requireAdmin, async (req: any, res: Response) => {
    try {
      const { status, quality, assignedTo } = req.query;
      
      let query = db.select().from(prospectLeads);
      
      const conditions: any[] = [];
      if (status) conditions.push(eq(prospectLeads.status, status as string));
      if (quality) conditions.push(eq(prospectLeads.leadQuality, quality as string));
      if (assignedTo) conditions.push(eq(prospectLeads.assignedTo, assignedTo as string));
      
      const leads = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(prospectLeads.leadScore))
        : await query.orderBy(desc(prospectLeads.leadScore));

      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      return apiResponse.serverError(res, 'Failed to fetch leads');
    }
  });

  /**
   * Update lead status
   */
  app.patch('/api/admin/marketing/leads/:id', requireAdmin, async (req: any, res: Response) => {
    try {
      const [updated] = await db
        .update(prospectLeads)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(prospectLeads.id, req.params.id))
        .returning();

      if (!updated) {
        return apiResponse.notFound(res, 'Lead not found');
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating lead:', error);
      return apiResponse.serverError(res, 'Failed to update lead');
    }
  });

  /**
   * Add activity to lead
   */
  app.post('/api/admin/marketing/leads/:id/activities', requireAdmin, async (req: any, res: Response) => {
    try {
      const [activity] = await db
        .insert(leadActivities)
        .values({
          leadId: req.params.id,
          ...req.body,
          performedBy: req.user.id
        })
        .returning();

      // Update lead last contacted time
      await db
        .update(prospectLeads)
        .set({ 
          lastContactedAt: new Date(),
          nextFollowUpAt: req.body.nextActionDate ? new Date(req.body.nextActionDate) : null,
          updatedAt: new Date()
        })
        .where(eq(prospectLeads.id, req.params.id));

      res.status(201).json(activity);
    } catch (error) {
      console.error('Error adding activity:', error);
      return apiResponse.serverError(res, 'Failed to add activity');
    }
  });

  /**
   * Get lead activities
   */
  app.get('/api/admin/marketing/leads/:id/activities', requireAdmin, async (req: any, res: Response) => {
    try {
      const activities = await db
        .select()
        .from(leadActivities)
        .where(eq(leadActivities.leadId, req.params.id))
        .orderBy(desc(leadActivities.createdAt));

      res.json(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      return apiResponse.serverError(res, 'Failed to fetch activities');
    }
  });

  // ============================================================================
  // CLIENT INTELLIGENCE - Probe42 verification for existing clients
  // ============================================================================

  /**
   * Verify client via Probe42
   */
  app.post('/api/admin/marketing/client-intelligence/verify/:userId', requireAdmin, async (req: any, res: Response) => {
    try {
      const { cin } = req.body;
      
      if (!cin) {
        return apiResponse.badRequest(res, 'CIN required for verification');
      }

      const probe42 = getProbe42Service();
      const verification = await probe42.verifyClient(cin);

      if (!verification.verified || !verification.companyDetails) {
        return res.json({
          verified: false,
          riskFlags: verification.riskFlags
        });
      }

      const company = verification.companyDetails;

      // Determine financial health status
      let healthStatus = 'fair';
      const scoreValue = company.probe42Score?.score;
      if (scoreValue) {
        if (scoreValue >= 4) healthStatus = 'excellent';
        else if (scoreValue === 3) healthStatus = 'good';
        else if (scoreValue === 2) healthStatus = 'fair';
        else healthStatus = 'poor';
      }

      // Determine risk level
      let riskLevel = 'medium';
      if (verification.riskFlags.length === 0 && scoreValue && scoreValue >= 4) {
        riskLevel = 'low';
      } else if (verification.riskFlags.length >= 3 || (scoreValue && scoreValue <= 2)) {
        riskLevel = 'high';
      }

      // Update or create client intelligence
      const [intelligence] = await db
        .insert(clientIntelligence)
        .values({
          userId: req.params.userId,
          cin: cin || null,
          companyVerified: true,
          probe42Score: scoreValue || null,
          financialHealthStatus: healthStatus,
          annualRevenue: company.financials?.[0]?.revenue?.toString() || null,
          netProfit: company.financials?.[0]?.netProfit?.toString() || null,
          totalAssets: company.financials?.[0]?.totalAssets?.toString() || null,
          riskLevel,
          riskFactors: verification.riskFlags as any,
          legalCases: company.legalCases as any,
          lastRefreshedAt: new Date(),
          nextRefreshDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        })
        .onConflictDoUpdate({
          target: clientIntelligence.userId,
          set: {
            cin: cin || null,
            companyVerified: true,
            probe42Score: scoreValue || null,
            financialHealthStatus: healthStatus,
            annualRevenue: company.financials?.[0]?.revenue?.toString() || null,
            netProfit: company.financials?.[0]?.netProfit?.toString() || null,
            totalAssets: company.financials?.[0]?.totalAssets?.toString() || null,
            riskLevel,
            riskFactors: verification.riskFlags as any,
            legalCases: company.legalCases as any,
            lastRefreshedAt: new Date(),
            updatedAt: new Date()
          }
        })
        .returning();

      res.json({
        verified: true,
        intelligence,
        companyDetails: company
      });
    } catch (error) {
      console.error('Error verifying client:', error);
      return apiResponse.serverError(res, 'Failed to verify client');
    }
  });

  /**
   * Get client intelligence
   */
  app.get('/api/admin/marketing/client-intelligence/:userId', requireAdmin, async (req: any, res: Response) => {
    try {
      const [intelligence] = await db
        .select()
        .from(clientIntelligence)
        .where(eq(clientIntelligence.userId, req.params.userId));

      if (!intelligence) {
        return apiResponse.notFound(res, 'No intelligence data found for this client');
      }

      res.json(intelligence);
    } catch (error) {
      console.error('Error fetching client intelligence:', error);
      return apiResponse.serverError(res, 'Failed to fetch client intelligence');
    }
  });

  /**
   * Get all client intelligence with risk alerts
   */
  app.get('/api/admin/marketing/client-intelligence', requireAdmin, async (req: any, res: Response) => {
    try {
      const { riskLevel } = req.query;
      
      let query = db.select().from(clientIntelligence);
      
      const results = riskLevel
        ? await query.where(eq(clientIntelligence.riskLevel, riskLevel as string))
        : await query;

      res.json(results);
    } catch (error) {
      console.error('Error fetching client intelligence:', error);
      return apiResponse.serverError(res, 'Failed to fetch client intelligence');
    }
  });

  // ============================================================================
  // MARKETING ANALYTICS & DASHBOARD
  // ============================================================================

  /**
   * Get marketing dashboard statistics
   */
  app.get('/api/admin/marketing/dashboard/stats', requireAdmin, async (req: any, res: Response) => {
    try {
      // Campaign stats
      const totalCampaigns = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketingCampaigns);

      const activeCampaigns = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketingCampaigns)
        .where(sql`${marketingCampaigns.status} IN ('sending', 'scheduled')`);

      const completedCampaigns = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.status, 'sent'));

      // Lead stats
      const totalLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(prospectLeads);

      const hotLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(prospectLeads)
        .where(eq(prospectLeads.leadQuality, 'hot'));

      const convertedLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(prospectLeads)
        .where(eq(prospectLeads.status, 'converted'));

      // Performance metrics
      const campaignPerformance = await db
        .select({
          totalSent: sql<number>`SUM(${marketingCampaigns.sentCount})`,
          totalDelivered: sql<number>`SUM(${marketingCampaigns.deliveredCount})`,
          totalOpened: sql<number>`SUM(${marketingCampaigns.openedCount})`,
          totalClicked: sql<number>`SUM(${marketingCampaigns.clickedCount})`
        })
        .from(marketingCampaigns);

      res.json({
        campaigns: {
          total: totalCampaigns[0]?.count || 0,
          active: activeCampaigns[0]?.count || 0,
          completed: completedCampaigns[0]?.count || 0
        },
        leads: {
          total: totalLeads[0]?.count || 0,
          hot: hotLeads[0]?.count || 0,
          converted: convertedLeads[0]?.count || 0,
          conversionRate: totalLeads[0]?.count > 0 
            ? ((convertedLeads[0]?.count || 0) / totalLeads[0].count * 100).toFixed(2)
            : '0.00'
        },
        performance: {
          sent: campaignPerformance[0]?.totalSent || 0,
          delivered: campaignPerformance[0]?.totalDelivered || 0,
          opened: campaignPerformance[0]?.totalOpened || 0,
          clicked: campaignPerformance[0]?.totalClicked || 0,
          openRate: campaignPerformance[0]?.totalSent > 0
            ? ((campaignPerformance[0]?.totalOpened || 0) / campaignPerformance[0].totalSent * 100).toFixed(2)
            : '0.00',
          clickRate: campaignPerformance[0]?.totalSent > 0
            ? ((campaignPerformance[0]?.totalClicked || 0) / campaignPerformance[0].totalSent * 100).toFixed(2)
            : '0.00'
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return apiResponse.serverError(res, 'Failed to fetch dashboard stats');
    }
  });

  /**
   * Get recent campaign activity
   */
  app.get('/api/admin/marketing/dashboard/recent-activity', requireAdmin, async (req: any, res: Response) => {
    try {
      const recentCampaigns = await db
        .select()
        .from(marketingCampaigns)
        .orderBy(desc(marketingCampaigns.updatedAt))
        .limit(10);

      const recentLeads = await db
        .select()
        .from(prospectLeads)
        .orderBy(desc(prospectLeads.createdAt))
        .limit(10);

      res.json({
        recentCampaigns,
        recentLeads
      });
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return apiResponse.serverError(res, 'Failed to fetch recent activity');
    }
  });

  console.log('✅ Marketing routes registered');
}
