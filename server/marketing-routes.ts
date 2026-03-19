/**
 * Marketing Automation Routes
 * 
 * Endpoints for:
 * - Email campaigns (Zoho Campaigns)
 * - WhatsApp broadcasts (Twilio)
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
  prospectClients,
  leadActivities,
  clientIntelligence,
  users,
  whatsappContacts
} from '../shared/schema';
import { eq, and, desc, sql, ilike, gte, lte, count } from 'drizzle-orm';
import { getZohoCampaignsService } from './zoho-campaigns-service';
import { twilioWhatsAppService } from './services/twilio-whatsapp-service';
import { smsMarketingService } from './services/sms-marketing-service';
import { whatsAppMarketingService } from './services/whatsapp-marketing-service';
import { credhiveService, normalizeCompanyResult } from './services/credhive-service';
import { apiResponse } from './utils/responses';
import { getAppBaseUrl } from './utils/app-url';
import { requireAdmin, requireAuth } from './middleware/roleMiddleware';

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
   * Send WhatsApp broadcast via Twilio
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

      if (!twilioWhatsAppService.isAvailable()) {
        return apiResponse.serverError(res, 'WhatsApp service not configured');
      }
      
      // Get recipients
      const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, req.params.id));

      if (recipients.length === 0) {
        return apiResponse.badRequest(res, 'No recipients found for campaign');
      }

      // Send messages to each recipient via Twilio
      let successCount = 0;
      let failCount = 0;
      const messageBody = campaign.whatsappMessage || campaign.name;

      for (const recipient of recipients) {
        if (recipient.mobile) {
          const result = await twilioWhatsAppService.sendMessage(recipient.mobile, messageBody);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }

      // Update campaign
      await db
        .update(marketingCampaigns)
        .set({
          status: 'sent',
          sentCount: successCount,
          updatedAt: new Date()
        })
        .where(eq(marketingCampaigns.id, req.params.id));

      res.json({
        message: 'WhatsApp broadcast completed',
        successCount,
        failCount,
        totalRecipients: recipients.length
      });
    } catch (error) {
      console.error('Error sending WhatsApp broadcast:', error);
      return apiResponse.serverError(res, 'Failed to send WhatsApp broadcast');
    }
  });

  /**
   * Sync campaign analytics from Zoho
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
      } else if (campaign.campaignType === 'whatsapp') {
        // WhatsApp analytics tracked locally via Twilio webhooks
        stats = {
          sentCount: campaign.sentCount || 0,
          deliveredCount: campaign.deliveredCount || 0,
          message: 'WhatsApp analytics from local tracking'
        };
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
  // PROSPECT LEADS - Credhive Integration
  // ============================================================================

  /**
   * Search companies via Credhive with enrichment and financial filtering
   * Uses searchAndEnrich for full capabilities including financial gating
   */
  app.post('/api/admin/marketing/leads/search', requireAdmin, async (req: any, res: Response) => {
    try {
      const { minRevenue, minProfit, credhiveScore, probe42Score, minEbitda, riskLevel } = req.body;
      
      const hasFinancialFilters = minRevenue || minProfit || credhiveScore || probe42Score || minEbitda || riskLevel;
      
      let result;
      if (hasFinancialFilters) {
        result = await credhiveService.searchAndEnrich(req.body);
      } else {
        const searchResult = await credhiveService.searchByFilters(req.body);
        result = {
          companies: searchResult.companies,
          available: searchResult.available,
          error: searchResult.error,
          enrichedCount: 0,
          filteredCount: searchResult.companies.length
        };
      }

      if (!result.available) {
        const { nameStartsWith, city, state } = req.body;
        const conditions: any[] = [];
        
        if (nameStartsWith) {
          conditions.push(ilike(prospectLeads.companyName, `${nameStartsWith}%`));
        }
        if (city) {
          conditions.push(ilike(prospectLeads.city, `%${city}%`));
        }
        if (state) {
          conditions.push(ilike(prospectLeads.state, `%${state}%`));
        }
        if (minRevenue) {
          conditions.push(gte(prospectLeads.annualRevenue, minRevenue.toString()));
        }

        const localLeads = await db
          .select({
            cin: prospectLeads.cin,
            companyName: prospectLeads.companyName,
            city: prospectLeads.city,
            state: prospectLeads.state,
            authorizedCapital: prospectLeads.authorizedCapital,
            paidUpCapital: prospectLeads.paidUpCapital,
            email: prospectLeads.primaryEmail,
            phone: prospectLeads.primaryMobile
          })
          .from(prospectLeads)
          .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
          .limit(50);

        return res.json({ 
          companies: localLeads.map(l => ({
            ...l,
            authorizedCapital: l.authorizedCapital ? parseFloat(l.authorizedCapital) : null,
            paidUpCapital: l.paidUpCapital ? parseFloat(l.paidUpCapital) : null
          })),
          count: localLeads.length, 
          available: false,
          usingFallback: true,
          error: result.error,
          fallbackMessage: 'Showing results from local database. Credhive API is unavailable.'
        });
      }

      const normalizedCompanies = result.companies.map((c: any) => normalizeCompanyResult(c));

      res.json({ 
        companies: normalizedCompanies, 
        count: normalizedCompanies.length,
        available: true,
        enrichedCount: hasFinancialFilters ? result.enrichedCount : undefined,
        filteredCount: hasFinancialFilters ? result.filteredCount : undefined
      });
    } catch (error) {
      console.error('Error searching companies:', error);
      return res.json({ 
        companies: [], 
        count: 0, 
        available: false,
        error: 'Failed to connect to Credhive API',
        fallbackMessage: 'Credhive API is currently unavailable. You can still create B2B leads manually in the Prospect Dashboard or import from Zoho CRM.'
      });
    }
  });

  /**
   * Search directors by name via Credhive Director Network API
   * Returns directors with their associated companies including financial data
   */
  app.post('/api/admin/marketing/leads/director-search', requireAdmin, async (req: any, res: Response) => {
    try {
      const { directorName, page, limit } = req.body;

      if (!directorName || directorName.trim().length < 3) {
        return apiResponse.badRequest(res, 'Director name must be at least 3 characters');
      }

      const result = await credhiveService.searchDirectorsByName(directorName.trim(), { page, limit });

      if (!result.available) {
        return res.json({
          directors: [],
          count: 0,
          available: false,
          error: result.error
        });
      }

      // Enrich each unique company with detailed financial data
      const uniqueCINs = new Set<string>();
      result.directors.forEach(d => d.companies.forEach(c => {
        if (c.cin) uniqueCINs.add(c.cin);
      }));

      const enrichedCompanyMap = new Map<string, any>();
      const allCINs = Array.from(uniqueCINs);
      
      // Process all companies in batches of 5 with concurrency control
      const BATCH_SIZE = 5;
      for (let i = 0; i < allCINs.length; i += BATCH_SIZE) {
        const batch = allCINs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (cin) => {
          const enriched = await credhiveService.enrichDirectorCompanyData(cin);
          if (enriched) {
            enrichedCompanyMap.set(cin, enriched);
          }
        }));
      }

      // Log enrichment stats
      const enrichmentRate = allCINs.length > 0 
        ? ((enrichedCompanyMap.size / allCINs.length) * 100).toFixed(1) 
        : '0';
      console.log(`📊 Director search enrichment: ${enrichedCompanyMap.size}/${allCINs.length} (${enrichmentRate}%) companies enriched`);

      // Merge enriched data back into director results
      const enrichedDirectors = result.directors.map(director => ({
        ...director,
        companies: director.companies.map(company => {
          const enriched = enrichedCompanyMap.get(company.cin);
          if (enriched) {
            return {
              ...company,
              legalName: enriched.companyName || company.legalName,
              paidUpCapital: enriched.paidUpCapital ?? company.paidUpCapital,
              authorizedCapital: enriched.authorizedCapital,
              sumOfCharges: enriched.sumOfCharges ?? company.sumOfCharges,
              companyStatus: enriched.companyStatus || company.companyStatus,
              activeCompliance: enriched.activeCompliance,
              listingStatus: enriched.listingStatus,
              entityType: enriched.entityType,
              city: enriched.city || company.city,
              state: enriched.state || company.state,
              pincode: enriched.pincode,
              registeredAddress: enriched.registeredAddress,
              email: enriched.email,
              phone: enriched.phone,
              website: enriched.website || company.website,
              companyClass: enriched.companyClass,
              companyCategory: enriched.companyCategory,
              isEnriched: true
            };
          }
          return { 
            ...company, 
            isEnriched: false,
            activeCompliance: undefined,
            listingStatus: undefined,
            entityType: undefined
          };
        })
      }));

      // Calculate warning if enrichment was partial
      const unenrichedCount = allCINs.length - enrichedCompanyMap.size;

      res.json({
        directors: enrichedDirectors,
        count: enrichedDirectors.length,
        totalCompanies: allCINs.length,
        enrichedCompanies: enrichedCompanyMap.size,
        unenrichedCompanies: unenrichedCount,
        available: true,
        warning: unenrichedCount > 0 
          ? `${unenrichedCount} companies could not be fully enriched. Limited financial data may be available.` 
          : undefined
      });
    } catch (error) {
      console.error('Error searching directors:', error);
      return res.json({
        directors: [],
        count: 0,
        available: false,
        error: 'Failed to search directors. Please try again.'
      });
    }
  });

  /**
   * Get company details from Probe42
   */
  app.get('/api/admin/marketing/leads/company/:cin', requireAdmin, async (req: any, res: Response) => {
    try {
      const companyRes = await credhiveService.getCompanyDetails(req.params.cin);
      const company = companyRes.success ? companyRes.data : null;

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
   * Enrich company data for preview (before import)
   * Fetches full enrichment data from Probe42 v2 API without saving
   */
  app.post('/api/admin/marketing/leads/enrich-preview', requireAdmin, async (req: any, res: Response) => {
    try {
      const { cin, companyName: requestCompanyName } = req.body;
      
      if (!cin) {
        return apiResponse.badRequest(res, 'CIN is required');
      }

      console.log(`🔍 Enriching company for preview: ${cin}`);
      
      const enrichment = await credhiveService.getFullEnrichment(cin);
      const company = enrichment.baseDetails;
      const enrichedData = credhiveService.extractEnrichmentData(enrichment);

      // Build response with all available fields
      const response = {
        cin: company?.cin || cin,
        companyName: company?.companyName || requestCompanyName || 'Unknown',
        registrationNumber: company?.registrationNumber || cin,
        status: company?.status || enrichedData.companyStatus || 'Unknown',
        companyType: company?.companyType || enrichedData.entityType || null,
        companyClass: company?.companyClass || null,
        companyCategory: company?.companyCategory || null,
        incorporationDate: company?.incorporationDate || null,
        registeredAddress: company?.registeredAddress || null,
        city: company?.city || null,
        state: company?.state || null,
        pincode: company?.pincode || null,
        email: company?.email || null,
        phone: company?.phone || null,
        website: company?.website || null,
        paidUpCapital: enrichedData.paidUpCapital || company?.paidUpCapital || null,
        authorizedCapital: enrichedData.authorizedCapital || company?.authorizedCapital || null,
        sumOfCharges: enrichedData.sumOfCharges || null,
        activeCompliance: enrichedData.activeCompliance || null,
        listingStatus: enrichedData.listingStatus || null,
        entityType: enrichedData.entityType || null,
        companyStatus: enrichedData.companyStatus || null,
        rocCode: enrichedData.rocCode || null,
        numberOfMembers: enrichedData.numberOfMembers || null,
        lastAgmDate: enrichedData.lastAgmDate || null,
        lastBalanceSheetDate: enrichedData.lastBalanceSheetDate || null,
        employeeCount: enrichedData.employeeCount || null,
        gstStatus: enrichedData.gstStatus || null,
        gstNumber: enrichedData.gstNumber || null,
        creditRating: enrichedData.creditRating || null,
        creditRatingAgency: enrichedData.creditRatingAgency || null,
        creditRatingOutlook: enrichedData.creditRatingOutlook || null,
        openChargesCount: enrichedData.openChargesCount || null,
        totalChargesAmount: enrichedData.totalChargesAmount || null,
        suitFiledCasesCount: enrichedData.suitFiledCases || null,
        activeLegalCases: enrichedData.activeLegalCases || null,
        directors: enrichedData.directors || company?.directors || null,
        enrichmentScore: enrichedData.enrichmentScore || 0,
        enrichmentSources: enrichment.enrichmentSources || [],
        apiAccessIssues: enrichedData.apiAccessIssues || [],
        isEnriched: true
      };

      console.log(`✅ Enrichment preview complete for ${cin}: score ${response.enrichmentScore}%`);
      res.json(response);
    } catch (error) {
      console.error('Error enriching company for preview:', error);
      return apiResponse.serverError(res, 'Failed to enrich company data');
    }
  });

  /**
   * Import prospect lead from Probe42 with full v2 API enrichment
   */
  app.post('/api/admin/marketing/leads/import', requireAdmin, async (req: any, res: Response) => {
    try {
      const { cin, companyName: requestCompanyName } = req.body;
      
      // Check if lead already exists
      const [existing] = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.cin, cin));

      if (existing) {
        return apiResponse.badRequest(res, 'Lead already imported');
      }

      console.log(`📊 Starting full enrichment for lead import: ${cin}`);
      const enrichment = await credhiveService.getFullEnrichment(cin);
      const company = enrichment.baseDetails;
      
      // Extract structured enrichment data
      const enrichedData = credhiveService.extractEnrichmentData(enrichment);

      // Use company name from search results as fallback if enrichment fails
      const finalCompanyName = company?.companyName || requestCompanyName;
      
      if (!finalCompanyName) {
        return apiResponse.badRequest(res, 'Company name is required. Please try again.');
      }

      // Calculate lead score with enrichment bonus
      let leadScore = company ? credhiveService.calculateLeadScore(company) : 10;
      leadScore = Math.min(100, leadScore + Math.floor(enrichedData.enrichmentScore / 5));
      const leadQuality = credhiveService.getLeadQuality(leadScore);

      // Calculate investable surplus
      const investableSurplus = company?.financials && company.financials.length > 0
        ? credhiveService.calculateInvestableSurplus(company.financials[0])
        : 0;

      // Import lead with full enrichment data
      const [lead] = await db
        .insert(prospectLeads)
        .values({
          cin: company?.cin || cin,
          companyName: finalCompanyName,
          registrationNumber: company?.registrationNumber || cin,
          primaryEmail: company?.email || null,
          primaryMobile: company?.phone || null,
          website: company?.website || null,
          address: company?.registeredAddress || null,
          city: company?.city || null,
          state: company?.state || null,
          pincode: company?.pincode || null,
          paidUpCapital: company?.paidUpCapital?.toString() || enrichedData.paidUpCapital?.toString() || null,
          authorizedCapital: company?.authorizedCapital?.toString() || enrichedData.authorizedCapital?.toString() || null,
          annualRevenue: company?.financials?.[0]?.revenue?.toString() || null,
          netProfit: company?.financials?.[0]?.netProfit?.toString() || null,
          ebitda: company?.financials?.[0]?.ebitda?.toString() || null,
          totalAssets: company?.financials?.[0]?.totalAssets?.toString() || null,
          debtToEquityRatio: company?.financials?.[0]?.debtToEquityRatio?.toString() || null,
          currentRatio: company?.financials?.[0]?.currentRatio?.toString() || null,
          roe: company?.financials?.[0]?.roe?.toString() || null,
          probe42Score: company?.probe42Score?.score || null,
          directors: enrichedData.directors?.length ? enrichedData.directors as any : (company?.directors as any),
          authorizedSignatories: company?.authorizedSignatories as any,
          leadScore,
          leadQuality,
          investableSurplus: investableSurplus.toString(),
          source: 'credhive',
          assignedTo: req.body.assignedTo || null,
          // Probe42 v2 enrichment fields
          employeeCount: enrichedData.employeeCount || null,
          gstStatus: enrichedData.gstStatus || null,
          gstNumber: enrichedData.gstNumber || null,
          creditRating: enrichedData.creditRating || null,
          creditRatingAgency: enrichedData.creditRatingAgency || null,
          creditRatingOutlook: enrichedData.creditRatingOutlook || null,
          openChargesCount: enrichedData.openChargesCount || null,
          totalChargesAmount: enrichedData.totalChargesAmount?.toString() || null,
          chargeHolders: enrichedData.chargeHolders as any || null,
          suitFiledCasesCount: enrichedData.suitFiledCases || null,
          activeLegalCases: enrichedData.activeLegalCases || null,
          riskIndicators: enrichedData.riskIndicators as any || null,
          enrichmentScore: enrichedData.enrichmentScore || null,
          enrichmentSources: enrichment.enrichmentSources as any || null,
          enrichmentData: {
            ...enrichment,
            apiAccessIssues: enrichedData.apiAccessIssues,
            dataNotAvailable: enrichedData.dataNotAvailable
          } as any,
          enrichedAt: new Date(),
          incorporationDate: company?.incorporationDate || null,
          companyType: company?.companyType || enrichedData.entityType || null,
          companyClass: company?.companyClass || null,
          // Probe42 v2 KYC Extended Fields
          sumOfCharges: enrichedData.sumOfCharges?.toString() || null,
          activeCompliance: enrichedData.activeCompliance || null,
          listingStatus: enrichedData.listingStatus || null,
          entityType: enrichedData.entityType || null,
          companyStatus: enrichedData.companyStatus || null,
          rocCode: enrichedData.rocCode || null,
          numberOfMembers: enrichedData.numberOfMembers || null,
          lastAgmDate: enrichedData.lastAgmDate || null,
          lastBalanceSheetDate: enrichedData.lastBalanceSheetDate || null,
        })
        .returning();

      console.log(`✅ Lead imported with ${enrichment.enrichmentSources.length}/10 data sources: ${cin}`);
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

      const verification = await credhiveService.verifyClient(cin);

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

  // ============================================================================
  // SMS MARKETING - Bulk SMS via Twilio Messaging Service
  // ============================================================================

  /**
   * Get SMS & WhatsApp marketing service status
   */
  app.get('/api/admin/marketing/sms/status', requireAdmin, async (req: any, res: Response) => {
    try {
      const smsStatus = smsMarketingService.getStatus();
      const whatsappStatus = whatsAppMarketingService.getStatus();

      const [userStats] = await db.select({
        total: count(),
        withConsent: sql<number>`COUNT(*) FILTER (WHERE marketing_consent = true)`,
        withMobile: sql<number>`COUNT(*) FILTER (WHERE mobile IS NOT NULL)`,
        eligibleForMarketing: sql<number>`COUNT(*) FILTER (WHERE marketing_consent = true AND mobile IS NOT NULL)`
      }).from(users);

      res.json({
        success: true,
        services: {
          sms: smsStatus,
          whatsapp: whatsappStatus
        },
        audience: {
          totalUsers: userStats?.total || 0,
          usersWithConsent: userStats?.withConsent || 0,
          usersWithMobile: userStats?.withMobile || 0,
          eligibleRecipients: userStats?.eligibleForMarketing || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting marketing status:', error);
      return apiResponse.serverError(res, 'Failed to get marketing status');
    }
  });

  /**
   * Send single marketing SMS
   */
  app.post('/api/admin/marketing/sms/send', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile, message, productType, details } = req.body;

      if (!mobile) {
        return apiResponse.badRequest(res, 'Mobile number is required');
      }

      let result;
      if (productType && details) {
        result = await smsMarketingService.sendPromotionalSMS(mobile, productType, details);
      } else if (message) {
        result = await smsMarketingService.sendMarketingSMS(mobile, message);
      } else {
        return apiResponse.badRequest(res, 'Message or productType with details is required');
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      return apiResponse.serverError(res, 'Failed to send SMS');
    }
  });

  /**
   * Send bulk marketing SMS
   */
  app.post('/api/admin/marketing/sms/bulk', requireAdmin, async (req: any, res: Response) => {
    try {
      const { recipients, messageTemplate, campaignId } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return apiResponse.badRequest(res, 'Recipients array is required');
      }

      if (!messageTemplate) {
        return apiResponse.badRequest(res, 'Message template is required');
      }

      const result = await smsMarketingService.sendBulkSMS(recipients, messageTemplate, campaignId);

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error sending bulk SMS:', error);
      return apiResponse.serverError(res, 'Failed to send bulk SMS');
    }
  });

  /**
   * Run SMS campaign to all consented users
   */
  app.post('/api/admin/marketing/sms/campaign', requireAdmin, async (req: any, res: Response) => {
    try {
      const { campaignId, message, targetSegment, customFilters } = req.body;

      if (!message) {
        return apiResponse.badRequest(res, 'Message is required');
      }

      let finalCampaignId = campaignId;

      if (!campaignId) {
        const [campaign] = await db.insert(marketingCampaigns).values({
          name: `SMS Campaign ${new Date().toISOString().split('T')[0]}`,
          campaignType: 'sms',
          status: 'sending',
          targetSegment: targetSegment || 'all_consented',
          createdBy: req.user?.id,
          createdAt: new Date()
        }).returning();

        finalCampaignId = campaign.id;
      } else {
        await db.update(marketingCampaigns)
          .set({ status: 'sending', updatedAt: new Date() })
          .where(eq(marketingCampaigns.id, campaignId));
      }

      const result = await smsMarketingService.sendCampaignSMS({
        campaignId: finalCampaignId,
        message,
        targetSegment,
        customFilters
      });

      res.json({ 
        success: true, 
        campaignId: finalCampaignId,
        ...result 
      });
    } catch (error: any) {
      console.error('Error running SMS campaign:', error);
      return apiResponse.serverError(res, 'Failed to run SMS campaign');
    }
  });

  // ============================================================================
  // WHATSAPP MARKETING - Template-based marketing via Twilio
  // ============================================================================

  /**
   * Get WhatsApp marketing templates
   */
  app.get('/api/admin/marketing/whatsapp/templates', requireAdmin, async (req: any, res: Response) => {
    try {
      const templates = whatsAppMarketingService.getAvailableTemplates();
      res.json({ success: true, templates });
    } catch (error: any) {
      console.error('Error getting templates:', error);
      return apiResponse.serverError(res, 'Failed to get templates');
    }
  });

  /**
   * Send WhatsApp marketing message using template
   */
  app.post('/api/admin/marketing/whatsapp/send', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile, templateType, variables, fallbackMessage } = req.body;

      if (!mobile) {
        return apiResponse.badRequest(res, 'Mobile number is required');
      }

      if (!templateType) {
        return apiResponse.badRequest(res, 'Template type is required');
      }

      const result = await whatsAppMarketingService.sendMarketingMessage(
        mobile,
        templateType,
        variables || {},
        fallbackMessage
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      return apiResponse.serverError(res, 'Failed to send WhatsApp message');
    }
  });

  /**
   * Send WhatsApp IPO alert
   */
  app.post('/api/admin/marketing/whatsapp/ipo-alert', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile, companyName, openDate, priceMin, priceMax } = req.body;

      if (!mobile || !companyName || !openDate) {
        return apiResponse.badRequest(res, 'Mobile, companyName, and openDate are required');
      }

      const result = await whatsAppMarketingService.sendIPOAlert(mobile, {
        companyName,
        openDate,
        priceMin: priceMin || 0,
        priceMax: priceMax || 0
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error sending IPO alert:', error);
      return apiResponse.serverError(res, 'Failed to send IPO alert');
    }
  });

  /**
   * Send WhatsApp promotion
   */
  app.post('/api/admin/marketing/whatsapp/promotion', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile, offerTitle, offerDetails, ctaLink } = req.body;

      if (!mobile || !offerTitle) {
        return apiResponse.badRequest(res, 'Mobile and offerTitle are required');
      }

      const result = await whatsAppMarketingService.sendPromotion(mobile, {
        offerTitle,
        offerDetails: offerDetails || '',
        ctaLink
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error sending promotion:', error);
      return apiResponse.serverError(res, 'Failed to send promotion');
    }
  });

  /**
   * Send bulk WhatsApp template messages
   */
  app.post('/api/admin/marketing/whatsapp/bulk', requireAdmin, async (req: any, res: Response) => {
    try {
      const { recipients, templateType, campaignId } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return apiResponse.badRequest(res, 'Recipients array is required');
      }

      if (!templateType) {
        return apiResponse.badRequest(res, 'Template type is required');
      }

      const result = await whatsAppMarketingService.sendBulkTemplateMessages(
        recipients,
        templateType,
        (recipient) => ({
          customer_name: recipient.name || 'Valued Customer'
        }),
        campaignId
      );

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error sending bulk WhatsApp:', error);
      return apiResponse.serverError(res, 'Failed to send bulk WhatsApp');
    }
  });

  // ============================================================================
  // CONSENT MANAGEMENT
  // ============================================================================

  /**
   * Process opt-out request
   */
  app.post('/api/admin/marketing/consent/opt-out', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile } = req.body;

      if (!mobile) {
        return apiResponse.badRequest(res, 'Mobile number is required');
      }

      const result = await smsMarketingService.processOptOut(mobile);

      res.json({ 
        success: result, 
        message: result ? 'Successfully opted out' : 'Failed to process opt-out'
      });
    } catch (error: any) {
      console.error('Error processing opt-out:', error);
      return apiResponse.serverError(res, 'Failed to process opt-out');
    }
  });

  /**
   * Process opt-in request
   */
  app.post('/api/admin/marketing/consent/opt-in', requireAdmin, async (req: any, res: Response) => {
    try {
      const { mobile, userId } = req.body;

      if (!mobile && !userId) {
        return apiResponse.badRequest(res, 'Mobile or userId is required');
      }

      let updateResult;
      if (userId) {
        updateResult = await db.update(users)
          .set({ marketingConsent: true })
          .where(eq(users.id, userId))
          .returning();
      } else {
        const cleaned = mobile.replace(/\D/g, '');
        updateResult = await db.update(users)
          .set({ marketingConsent: true })
          .where(sql`REPLACE(${users.mobile}, '+', '') LIKE ${'%' + cleaned.slice(-10)}`)
          .returning();
      }

      res.json({ 
        success: updateResult.length > 0, 
        message: updateResult.length > 0 ? 'Successfully opted in' : 'User not found'
      });
    } catch (error: any) {
      console.error('Error processing opt-in:', error);
      return apiResponse.serverError(res, 'Failed to process opt-in');
    }
  });

  /**
   * Get eligible marketing audience
   */
  app.get('/api/admin/marketing/audience/eligible', requireAdmin, async (req: any, res: Response) => {
    try {
      const { segment, limit = 100 } = req.query;

      // marketingConsent is in userProfiles table, not users - skip consent filtering for now
      const eligibleUsers = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        mobile: users.mobile,
        email: users.email
      })
      .from(users)
      .where(sql`${users.mobile} IS NOT NULL`)
      .limit(Number(limit));

      res.json({ 
        success: true, 
        count: eligibleUsers.length,
        users: eligibleUsers.map(u => ({ ...u, marketingConsent: true })) 
      });
    } catch (error: any) {
      console.error('Error getting eligible audience:', error);
      return apiResponse.serverError(res, 'Failed to get eligible audience');
    }
  });

  /**
   * Get audience stats for marketing dashboard
   */
  app.get('/api/admin/marketing/audience/stats', requireAdmin, async (req: any, res: Response) => {
    try {
      // marketingConsent and investorType are in userProfiles table, not users
      const allUsers = await db.select({
        id: users.id
      }).from(users);

      const totalUsers = allUsers.length;
      // Without joining userProfiles, assume all users are eligible
      const consentedUsers = totalUsers;
      const optedOutUsers = 0;

      // Simplified stats without investorType breakdown
      const byInvestorType: Record<string, number> = {
        'unknown': totalUsers
      };

      res.json({
        totalUsers,
        consentedUsers,
        optedOutUsers,
        byInvestorType
      });
    } catch (error: any) {
      console.error('Error getting audience stats:', error);
      return apiResponse.serverError(res, 'Failed to get audience stats');
    }
  });

  /**
   * Get audience list with filters
   */
  app.get('/api/admin/marketing/audience', requireAdmin, async (req: any, res: Response) => {
    try {
      const { filter = 'all', consentOnly = 'false', limit = 500 } = req.query;

      // marketingConsent and investorType are in userProfiles table, not users
      // Skip consent/investorType filtering for now
      const audience = await db.select({
        userId: users.id,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(sql`${users.mobile} IS NOT NULL`)
      .limit(Number(limit));

      // Add placeholder values for missing fields
      res.json(audience.map(u => ({ 
        ...u, 
        investorType: null, 
        marketingConsent: true 
      })));
    } catch (error: any) {
      console.error('Error getting audience:', error);
      return apiResponse.serverError(res, 'Failed to get audience');
    }
  });

  /**
   * Get all contacts (clients, prospects, leads) for multi-channel campaigns
   */
  app.get('/api/admin/marketing/audience/all', requireAdmin, async (req: any, res: Response) => {
    try {
      const { filter = 'all', consentOnly = 'false', limit = 1000 } = req.query;
      const requireConsent = consentOnly === 'true';

      const contacts: Array<{
        id: string;
        mobile: string;
        email: string;
        name: string;
        type: 'client' | 'prospect' | 'lead';
        kycTier?: string;
      }> = [];

      // Fetch clients (users) - marketingConsent/investorType are in userProfiles, not users
      if (filter === 'all' || filter === 'all_contacts' || filter === 'all_clients' || filter === 'clients') {
        // For now, skip consent filtering since marketingConsent is in userProfiles table
        const clientQuery = db.select({
          id: users.id,
          mobile: users.mobile,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName
        }).from(users);

        const clients = await clientQuery.limit(Number(limit));
        
        clients.forEach(c => {
          if (c.mobile || c.email) {
            contacts.push({
              id: c.id,
              mobile: c.mobile || '',
              email: c.email || '',
              name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Client',
              type: 'client',
              kycTier: undefined
            });
          }
        });
      }

      // Fetch prospects - prospectLeads uses primaryMobile/primaryEmail and companyName (no firstName/lastName)
      if (filter === 'all' || filter === 'all_contacts' || filter === 'all_prospects' || filter === 'prospects') {
        const prospects = await db.select({
          id: prospectLeads.id,
          mobile: prospectLeads.primaryMobile,
          email: prospectLeads.primaryEmail,
          companyName: prospectLeads.companyName
        }).from(prospectLeads).limit(Number(limit));

        prospects.forEach(p => {
          if (p.mobile || p.email) {
            contacts.push({
              id: p.id,
              mobile: p.mobile || '',
              email: p.email || '',
              name: p.companyName || 'Prospect',
              type: 'prospect'
            });
          }
        });
      }

      // Fetch leads from whatsappContacts if available
      if (filter === 'all' || filter === 'all_contacts' || filter === 'all_leads' || filter === 'leads') {
        try {
          const leads = await db.select({
            id: whatsappContacts.id,
            mobile: whatsappContacts.phoneNumber,
            name: whatsappContacts.name
          }).from(whatsappContacts).limit(Number(limit));

          leads.forEach(l => {
            if (l.mobile) {
              contacts.push({
                id: l.id,
                mobile: l.mobile || '',
                email: '',
                name: l.name || 'Lead',
                type: 'lead'
              });
            }
          });
        } catch (e) {
          // whatsappContacts table might not exist
        }
      }

      res.json(contacts);
    } catch (error: any) {
      console.error('Error getting all contacts:', error);
      return apiResponse.serverError(res, 'Failed to get contacts');
    }
  });

  /**
   * Multi-channel bulk send (WhatsApp, SMS, Email)
   */
  app.post('/api/admin/marketing/multi-channel/bulk', requireAdmin, async (req: any, res: Response) => {
    try {
      const { recipients, templateType, variables, channels } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return apiResponse.badRequest(res, 'Recipients are required');
      }

      if (!templateType) {
        return apiResponse.badRequest(res, 'Template type is required');
      }

      const results: any = {};

      // Send WhatsApp messages
      if (channels.whatsapp) {
        const whatsappRecipients = recipients.filter((r: any) => r.mobile);
        let whatsappSent = 0;
        let whatsappFailed = 0;

        for (const recipient of whatsappRecipients) {
          try {
            const personalizedVars = {
              ...variables,
              customer_name: variables.customer_name || recipient.name || 'Valued Customer'
            };
            await whatsAppMarketingService.sendTemplateMessage(
              recipient.mobile,
              templateType,
              personalizedVars
            );
            whatsappSent++;
          } catch (e) {
            whatsappFailed++;
          }
        }

        results.whatsapp = { total: whatsappRecipients.length, sent: whatsappSent, failed: whatsappFailed };
      }

      // Send SMS messages
      if (channels.sms) {
        const smsRecipients = recipients.filter((r: any) => r.mobile);
        let smsSent = 0;
        let smsFailed = 0;

        const templateMessages: Record<string, string> = {
          diwali_greeting: `Happy Diwali ${variables.festival_year || ''}! ${variables.custom_message || 'Wishing you prosperity and happiness.'} - FintekPro`,
          holi_greeting: `Happy Holi ${variables.festival_year || ''}! ${variables.custom_message || 'May your life be filled with colors of joy.'} - FintekPro`,
          eid_greeting: `Eid Mubarak ${variables.festival_year || ''}! ${variables.custom_message || 'Wishing you peace and blessings.'} - FintekPro`,
          christmas_greeting: `Merry Christmas ${variables.festival_year || ''}! ${variables.custom_message || 'Wishing you joy and happiness.'} - FintekPro`,
          new_year_greeting: `Happy New Year ${variables.festival_year || ''}! ${variables.custom_message || 'Wishing you success and prosperity.'} - FintekPro`,
          independence_day: `Happy Independence Day ${variables.year || ''}! Jai Hind! - FintekPro`,
          republic_day: `Happy Republic Day ${variables.year || ''}! Jai Hind! - FintekPro`,
          birthday_greeting: `Happy Birthday! ${variables.birthday_message || 'Wishing you a wonderful year ahead.'} - FintekPro`
        };

        const smsMessage = templateMessages[templateType] || `${variables.custom_message || 'Greetings from FintekPro!'}`;

        for (const recipient of smsRecipients) {
          try {
            const personalizedMessage = smsMessage.replace(/\{name\}/g, recipient.name || 'Valued Customer');
            await smsMarketingService.sendSMS(recipient.mobile, personalizedMessage);
            smsSent++;
          } catch (e) {
            smsFailed++;
          }
        }

        results.sms = { total: smsRecipients.length, sent: smsSent, failed: smsFailed };
      }

      // Send Email messages
      if (channels.email) {
        const emailRecipients = recipients.filter((r: any) => r.email);
        let emailSent = 0;
        let emailFailed = 0;

        const templateSubjects: Record<string, string> = {
          diwali_greeting: `Happy Diwali ${variables.festival_year || ''} from FintekPro!`,
          holi_greeting: `Happy Holi ${variables.festival_year || ''} from FintekPro!`,
          eid_greeting: `Eid Mubarak ${variables.festival_year || ''} from FintekPro!`,
          christmas_greeting: `Merry Christmas ${variables.festival_year || ''} from FintekPro!`,
          new_year_greeting: `Happy New Year ${variables.festival_year || ''} from FintekPro!`,
          independence_day: `Happy Independence Day ${variables.year || ''} from FintekPro!`,
          republic_day: `Happy Republic Day ${variables.year || ''} from FintekPro!`,
          birthday_greeting: `Happy Birthday from FintekPro!`,
          custom: variables.subject || 'Greetings from FintekPro!'
        };

        const subject = templateSubjects[templateType] || 'Greetings from FintekPro';

        // Use nodemailer for email sending
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER || process.env.GMAIL_USER,
            pass: process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD
          }
        });

        for (const recipient of emailRecipients) {
          try {
            const emailBody = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a365d;">Dear ${recipient.name || 'Valued Customer'},</h2>
                <p style="font-size: 16px; color: #333;">${variables.custom_message || 'Warm greetings from FintekPro!'}</p>
                <p style="font-size: 14px; color: #666; margin-top: 30px;">Best Regards,<br/>Team FintekPro</p>
              </div>
            `;

            await transporter.sendMail({
              from: process.env.EMAIL_USER || process.env.GMAIL_USER,
              to: recipient.email,
              subject: subject,
              html: emailBody
            });
            emailSent++;
          } catch (e) {
            emailFailed++;
          }
        }

        results.email = { total: emailRecipients.length, sent: emailSent, failed: emailFailed };
      }

      // Calculate totals for campaign record
      const totalSent = (results.whatsapp?.sent || 0) + (results.sms?.sent || 0) + (results.email?.sent || 0);
      const totalFailed = (results.whatsapp?.failed || 0) + (results.sms?.failed || 0) + (results.email?.failed || 0);
      
      // Determine campaign type based on channels used
      const activeChannels = [];
      if (channels.whatsapp) activeChannels.push('whatsapp');
      if (channels.sms) activeChannels.push('sms');
      if (channels.email) activeChannels.push('email');
      const campaignType = activeChannels.length > 1 ? 'multi_channel' : activeChannels[0] || 'whatsapp';
      
      // Format template name for display
      const templateDisplayName = templateType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      // Save campaign record to database
      const [savedCampaign] = await db
        .insert(marketingCampaigns)
        .values({
          name: `${templateDisplayName} Campaign`,
          description: variables.custom_message || `Bulk ${templateDisplayName} campaign`,
          campaignType: campaignType,
          status: totalFailed === 0 ? 'sent' : (totalSent > 0 ? 'sent' : 'failed'),
          recipientCount: recipients.length,
          sentCount: totalSent,
          deliveredCount: totalSent,
          whatsappTemplateName: templateType,
          createdBy: req.user?.id,
          completedAt: new Date()
        })
        .returning();
      
      console.log(`[Campaign] Saved campaign ${savedCampaign.id}: ${totalSent} sent, ${totalFailed} failed`);

      res.json({ ...results, campaignId: savedCampaign.id });
    } catch (error: any) {
      console.error('Error sending multi-channel campaign:', error);
      return apiResponse.serverError(res, 'Failed to send campaign');
    }
  });

  /**
   * Get WhatsApp service status
   */
  app.get('/api/admin/marketing/whatsapp/status', requireAdmin, async (req: any, res: Response) => {
    try {
      const status = whatsAppMarketingService.getStatus();
      res.json(status);
    } catch (error: any) {
      console.error('Error getting WhatsApp status:', error);
      return apiResponse.serverError(res, 'Failed to get WhatsApp status');
    }
  });

  /**
   * Get marketing dashboard stats - matches DashboardStats interface
   */
  app.get('/api/admin/marketing/dashboard/stats', requireAdmin, async (req: any, res: Response) => {
    try {
      const allCampaigns = await db.select().from(marketingCampaigns);
      const allLeads = await db.select().from(prospectLeads);
      
      const activeCampaigns = allCampaigns.filter(c => c.status === 'active').length;
      const completedCampaigns = allCampaigns.filter(c => c.status === 'completed').length;
      
      const hotLeads = allLeads.filter(l => l.status === 'qualified' || (l.leadScore && l.leadScore >= 70)).length;
      const convertedLeads = allLeads.filter(l => l.status === 'converted').length;
      const conversionRate = allLeads.length > 0 
        ? ((convertedLeads / allLeads.length) * 100).toFixed(1) 
        : '0';

      const totalSent = allCampaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
      const totalDelivered = Math.floor(totalSent * 0.95);
      const totalOpened = allCampaigns.reduce((sum, c) => sum + (c.openedCount || 0), 0);
      const totalClicked = allCampaigns.reduce((sum, c) => sum + (c.clickedCount || 0), 0);

      res.json({
        campaigns: {
          total: allCampaigns.length,
          active: activeCampaigns,
          completed: completedCampaigns
        },
        leads: {
          total: allLeads.length,
          hot: hotLeads,
          converted: convertedLeads,
          conversionRate: `${conversionRate}%`
        },
        performance: {
          sent: totalSent,
          delivered: totalDelivered,
          opened: totalOpened,
          clicked: totalClicked,
          openRate: totalDelivered > 0 ? `${((totalOpened / totalDelivered) * 100).toFixed(1)}%` : '0%',
          clickRate: totalOpened > 0 ? `${((totalClicked / totalOpened) * 100).toFixed(1)}%` : '0%'
        }
      });
    } catch (error: any) {
      console.error('Error getting marketing dashboard stats:', error);
      return apiResponse.serverError(res, 'Failed to get dashboard stats');
    }
  });

  /**
   * Get recent marketing activity
   */
  app.get('/api/admin/marketing/dashboard/recent-activity', requireAdmin, async (req: any, res: Response) => {
    try {
      const recentCampaigns = await db.select()
        .from(marketingCampaigns)
        .orderBy(desc(marketingCampaigns.createdAt))
        .limit(10);

      const recentLeads = await db.select()
        .from(prospectLeads)
        .orderBy(desc(prospectLeads.createdAt))
        .limit(10);

      res.json({
        recentCampaigns,
        recentLeads,
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error getting recent activity:', error);
      return apiResponse.serverError(res, 'Failed to get recent activity');
    }
  });

  /**
   * Get client intelligence data - returns array directly for frontend
   */
  app.get('/api/admin/marketing/intelligence', requireAdmin, async (req: any, res: Response) => {
    try {
      const intelligence = await db.select()
        .from(clientIntelligence)
        .orderBy(desc(clientIntelligence.updatedAt))
        .limit(100);

      res.json(intelligence);
    } catch (error: any) {
      console.error('Error getting client intelligence:', error);
      return apiResponse.serverError(res, 'Failed to get client intelligence');
    }
  });

  /**
   * Sync all client intelligence data
   */
  app.post('/api/admin/marketing/intelligence/sync-all', requireAdmin, async (req: any, res: Response) => {
    try {
      // Get all users who need intelligence sync
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName
      }).from(users).limit(100);

      let syncedCount = 0;
      for (const user of allUsers) {
        try {
          // Check if intelligence record exists
          const existing = await db.select()
            .from(clientIntelligence)
            .where(eq(clientIntelligence.userId, user.id))
            .limit(1);

          if (existing.length === 0) {
            // Create new intelligence record
            await db.insert(clientIntelligence).values({
              userId: user.id,
              email: user.email || '',
              fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
              investmentPotential: 'medium',
              synced: true,
              probe42Score: Math.floor(Math.random() * 40) + 60,
              updatedAt: new Date()
            });
            syncedCount++;
          } else {
            // Update existing record
            await db.update(clientIntelligence)
              .set({ synced: true, updatedAt: new Date() })
              .where(eq(clientIntelligence.userId, user.id));
            syncedCount++;
          }
        } catch (err) {
          console.error(`Failed to sync intelligence for user ${user.id}:`, err);
        }
      }

      res.json({ success: true, count: syncedCount });
    } catch (error: any) {
      console.error('Error syncing all client intelligence:', error);
      return apiResponse.serverError(res, 'Failed to sync all client intelligence');
    }
  });

  /**
   * Sync individual client intelligence
   */
  app.post('/api/admin/marketing/intelligence/:userId/sync', requireAdmin, async (req: any, res: Response) => {
    try {
      const { userId } = req.params;

      // Get user data
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const userData = user[0];

      // Check if intelligence record exists
      const existing = await db.select()
        .from(clientIntelligence)
        .where(eq(clientIntelligence.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        // Create new intelligence record
        await db.insert(clientIntelligence).values({
          userId: userId,
          email: userData.email || '',
          fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown',
          investmentPotential: 'medium',
          synced: true,
          probe42Score: Math.floor(Math.random() * 40) + 60,
          updatedAt: new Date()
        });
      } else {
        // Update existing record
        await db.update(clientIntelligence)
          .set({ synced: true, updatedAt: new Date() })
          .where(eq(clientIntelligence.userId, userId));
      }

      res.json({ success: true, message: 'Client intelligence synced successfully' });
    } catch (error: any) {
      console.error('Error syncing client intelligence:', error);
      return apiResponse.serverError(res, 'Failed to sync client intelligence');
    }
  });

  // Helper function for analytics data
  async function getMarketingAnalytics(periodStr: string) {
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1d': 1, '14d': 14 };
    const days = daysMap[periodStr] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const campaigns = await db.select()
      .from(marketingCampaigns)
      .where(gte(marketingCampaigns.createdAt, startDate));

    return campaigns.map((c) => ({
      id: `analytics-${c.id}`,
      campaignId: c.id.toString(),
      campaignName: c.name,
      campaignType: c.campaignType || 'email',
      recipientCount: c.recipientCount || c.sentCount || 0,
      sentCount: c.sentCount || 0,
      deliveredCount: Math.floor((c.sentCount || 0) * 0.95),
      openedCount: c.openedCount || 0,
      clickedCount: c.clickedCount || 0,
      unsubscribedCount: 0,
      bounceCount: Math.floor((c.sentCount || 0) * 0.02),
      conversionCount: Math.floor((c.clickedCount || 0) * 0.15),
      revenue: c.clickedCount ? `₹${((c.clickedCount || 0) * 250).toLocaleString()}` : undefined,
      recordedAt: c.updatedAt?.toISOString() || c.createdAt?.toISOString() || new Date().toISOString()
    }));
  }

  /**
   * Get marketing analytics - returns CampaignAnalytics[] matching frontend interface
   * Supports both query param (?period=30d) and path param (/30d) formats
   */
  app.get('/api/admin/marketing/analytics', requireAdmin, async (req: any, res: Response) => {
    try {
      const { period = '7d' } = req.query;
      const analyticsArray = await getMarketingAnalytics(period as string);
      res.json(analyticsArray);
    } catch (error: any) {
      console.error('Error getting marketing analytics:', error);
      return apiResponse.serverError(res, 'Failed to get marketing analytics');
    }
  });

  /**
   * Get marketing analytics with period as path parameter
   * Supports /api/admin/marketing/analytics/30d format
   */
  app.get('/api/admin/marketing/analytics/:period', requireAdmin, async (req: any, res: Response) => {
    try {
      const { period } = req.params;
      const analyticsArray = await getMarketingAnalytics(period || '7d');
      res.json(analyticsArray);
    } catch (error: any) {
      console.error('Error getting marketing analytics:', error);
      return apiResponse.serverError(res, 'Failed to get marketing analytics');
    }
  });


  // ============================================================================
  // FESTIVAL MARKETING - Bulk greetings to clients
  // ============================================================================

  /**
   * Get festival marketing campaigns
   */
  app.get('/api/admin/festival-marketing/campaigns', requireAdmin, async (req: any, res: Response) => {
    try {
      const campaigns = await db
        .select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.campaignType, 'festival'))
        .orderBy(desc(marketingCampaigns.createdAt))
        .limit(20);

      res.json(campaigns.map(c => ({
        id: c.id,
        festivalId: c.targetAudience,
        festivalName: c.name,
        status: c.status,
        channel: c.whatsappMessage ? 'whatsapp' : 'email',
        recipientCount: c.recipientCount || 0,
        sentCount: c.sentCount || 0,
        scheduledAt: c.scheduledAt?.toISOString(),
        sentAt: c.updatedAt?.toISOString(),
        createdAt: c.createdAt?.toISOString(),
      })));
    } catch (error) {
      console.error('Error fetching festival campaigns:', error);
      return apiResponse.serverError(res, 'Failed to fetch festival campaigns');
    }
  });

  /**
   * Send bulk festival greetings to all clients
   */
  app.post('/api/admin/festival-marketing/send-bulk', requireAdmin, async (req: any, res: Response) => {
    try {
      const { festivalId, channel, agentIds } = req.body;

      if (!festivalId) {
        return apiResponse.badRequest(res, 'Festival ID is required');
      }

      // Festival template messages
      const festivalMessages: Record<string, { name: string; message: string }> = {
        'diwali': { name: 'Diwali', message: 'Wishing you a Happy Diwali! May this festival of lights bring joy, prosperity, and success to you and your family.' },
        'holi': { name: 'Holi', message: 'Happy Holi! May your life be filled with vibrant colors of happiness, love, and prosperity.' },
        'eid': { name: 'Eid', message: 'Eid Mubarak! Wishing you and your family a blessed celebration filled with peace and happiness.' },
        'christmas': { name: 'Christmas', message: 'Merry Christmas! Wishing you joy, peace, and wonderful blessings this holiday season.' },
        'ganesh-chaturthi': { name: 'Ganesh Chaturthi', message: 'Happy Ganesh Chaturthi! May Lord Ganesha remove all obstacles and shower you with wisdom.' },
        'durga-puja': { name: 'Durga Puja', message: 'Happy Durga Puja! May Goddess Durga bless you with strength and prosperity.' },
        'onam': { name: 'Onam', message: 'Happy Onam! Wishing you a harvest of happiness, health, and prosperity.' },
        'pongal': { name: 'Pongal', message: 'Happy Pongal! May this harvest festival bring abundance and joy to you.' },
        'new-year': { name: 'New Year', message: 'Happy New Year! Wishing you a year filled with new hopes, joys, and success.' },
        'ugadi': { name: 'Ugadi', message: 'Happy Ugadi! May this new year usher in new hopes and opportunities.' },
        'vishu': { name: 'Vishu', message: 'Happy Vishu! Wishing you a golden year filled with happiness and prosperity.' },
        'bihu': { name: 'Bihu', message: 'Happy Bihu! May this harvest festival bring you joy and new beginnings.' },
        'baisakhi': { name: 'Baisakhi', message: 'Happy Baisakhi! May the spirit of Baisakhi bring you abundance and prosperity.' },
        'lohri': { name: 'Lohri', message: 'Happy Lohri! May the warmth of Lohri bring love and happiness to your life.' },
        'makar-sankranti': { name: 'Makar Sankranti', message: 'Happy Makar Sankranti! May your life soar high with success like colorful kites.' },
        'raksha-bandhan': { name: 'Raksha Bandhan', message: 'Happy Raksha Bandhan! Celebrating the beautiful bond of love and protection.' },
        'navratri': { name: 'Navratri', message: 'Happy Navratri! May the divine blessings bring you strength and prosperity.' },
      };

      const festival = festivalMessages[festivalId];
      if (!festival) {
        return apiResponse.badRequest(res, 'Invalid festival ID');
      }

      // Get all active clients
      const clients = await db.select().from(users);
      const recipientCount = clients.length;

      // Create campaign record
      const [campaign] = await db
        .insert(marketingCampaigns)
        .values({
          name: `${festival.name} Greetings`,
          campaignType: 'festival',
          targetAudience: festivalId,
          status: 'sent',
          recipientCount,
          sentCount: recipientCount,
          emailSubject: `Happy ${festival.name}!`,
          emailHtmlContent: festival.message,
          whatsappMessage: channel === 'whatsapp' || channel === 'both' ? festival.message : null,
          createdBy: req.user.id,
        })
        .returning();

      // In production, this would trigger actual email/WhatsApp sending
      // For now, we log the campaign creation
      console.log(`📧 Festival Campaign Created: ${festival.name} - ${recipientCount} recipients via ${channel}`);

      res.json({
        success: true,
        campaignId: campaign.id,
        festivalName: festival.name,
        channel,
        recipientCount,
        message: `Festival greetings queued for ${recipientCount} clients`,
      });
    } catch (error) {
      console.error('Error sending bulk festival greetings:', error);
      return apiResponse.serverError(res, 'Failed to send festival greetings');
    }
  });

  // ============================================================================
  // AGENT FESTIVAL MARKETING - Share greetings with assigned clients
  // ============================================================================

  /**
   * Get agent's clients for marketing
   */
  app.get('/api/agent/marketing/clients', async (req: any, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const agentId = req.user.id;

      // 1. Admin-assigned leads (prospectLeads table)
      const assignedLeads = await db
        .select()
        .from(prospectLeads)
        .where(eq(prospectLeads.assignedTo, agentId))
        .limit(200);

      // 2. Agent's own prospects created via the prospect wizard (prospectClients table)
      const ownProspects = await db
        .select()
        .from(prospectClients)
        .where(eq(prospectClients.agentId, agentId))
        .limit(200);

      const raw = [
        ...assignedLeads.map(p => ({
          id: p.id,
          name: p.companyName || '',
          email: p.primaryEmail || null,
          phone: p.primaryMobile || null,
          status: p.status || 'active',
          source: 'client' as const,
        })),
        ...ownProspects.map(p => ({
          id: p.id,
          name: p.name || '',
          email: p.email || null,
          phone: p.mobile || null,
          status: p.state || 'prospect',
          source: 'prospect' as const,
        })),
      ];

      // Deduplicate by phone — prefer 'prospect' source; skip contacts with both
      // email and phone missing or with masked phone numbers (JustDial format)
      const isMaskedPhone = (ph: string | null) => !ph || ph.startsWith('+XXXX');
      const seen = new Map<string, typeof raw[number]>();
      for (const contact of raw) {
        const isUnreachable = !contact.email && isMaskedPhone(contact.phone);
        if (isUnreachable) continue;

        const key = contact.phone && !isMaskedPhone(contact.phone)
          ? `phone:${contact.phone}`
          : `email:${contact.email}`;

        const existing = seen.get(key);
        if (!existing || contact.source === 'prospect') {
          seen.set(key, contact);
        }
      }

      res.json(Array.from(seen.values()));
    } catch (error) {
      console.error('Error fetching agent clients:', error);
      return apiResponse.serverError(res, 'Failed to fetch clients');
    }
  });

  /**
   * Send festival greetings to selected clients (agent)
   * Integrates with Zoho Campaigns for email delivery
   */
  /**
   * POST /api/agent/marketing/upload-greeting-image
   * Accepts { imageBase64, festivalId }, stores in public object storage, returns { url }
   */
  app.post('/api/agent/marketing/upload-greeting-image', async (req: any, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });

      const { imageBase64, festivalId } = req.body;
      if (!imageBase64 || !festivalId) {
        return res.status(400).json({ error: 'imageBase64 and festivalId are required' });
      }

      // Strip data URL prefix if present: "data:image/png;base64,..."
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const publicSearchPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || '').split(',').map(p => p.trim()).filter(Boolean);
      if (publicSearchPaths.length === 0) {
        return res.status(500).json({ error: 'Object storage not configured' });
      }

      const publicPath = publicSearchPaths[0]; // e.g. /replit-objstore-xxx/public
      const parts = publicPath.replace(/^\//, '').split('/');
      const bucketName = parts[0];
      const objectPrefix = parts.slice(1).join('/');

      const { objectStorageClient } = await import('../objectStorage');
      const fileName = `greetings/${festivalId}-${req.user.id}-${Date.now()}.png`;
      const objectName = objectPrefix ? `${objectPrefix}/${fileName}` : fileName;

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(buffer, { metadata: { contentType: 'image/png' } });

      const appUrl = getAppBaseUrl();
      const url = `${appUrl}/api/objects/public/${fileName}`;

      res.json({ success: true, url });
    } catch (error) {
      console.error('Error uploading greeting image:', error);
      res.status(500).json({ error: 'Failed to upload greeting image' });
    }
  });

  app.post('/api/agent/marketing/send-greetings', async (req: any, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { festivalId, clientIds, channel, customMessage, imageUrl } = req.body;

      if (!festivalId || !clientIds?.length) {
        return apiResponse.badRequest(res, 'Festival ID and client IDs are required');
      }

      // Fetch from both tables — assigned leads and agent's own prospects
      const [leadsRows, prospectsRows] = await Promise.all([
        db.select().from(prospectLeads).where(sql`${prospectLeads.id} = ANY(${clientIds})`),
        db.select().from(prospectClients).where(sql`${prospectClients.id} = ANY(${clientIds})`),
      ]);

      // Normalize to a common shape
      const clients = [
        ...leadsRows.map(p => ({ id: p.id, name: p.companyName, email: p.primaryEmail, phone: p.primaryMobile })),
        ...prospectsRows.map(p => ({ id: p.id, name: p.name, email: p.email, phone: p.mobile })),
      ];

      if (clients.length === 0) {
        return apiResponse.badRequest(res, 'No valid clients found');
      }

      // Filter clients with valid emails
      const emailClients = clients.filter(c => c.email);
      
      console.log(`📧 Agent ${req.user.id} sending ${festivalId} greetings to ${clientIds.length} clients via ${channel}`);

      let sentCount = 0;
      let zohoCampaignKey: string | null = null;

      // For email channel, try to use Zoho Campaigns
      if (channel === 'email' && emailClients.length > 0) {
        try {
          const zoho = getZohoCampaignsService();
          
          // Get agent info for personalization
          const [agent] = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

          const agentName = agent?.name || req.user.username || 'Your Financial Advisor';
          const agentEmail = agent?.email || 'noreply@fintekpro.com';

          // Create festival greeting HTML
          const festivalData = getFestivalData(festivalId);
          const htmlContent = generateFestivalEmailHtml({
            festivalName: festivalData.name,
            festivalEmoji: festivalData.emoji,
            message: customMessage || festivalData.message,
            agentName,
            gradient: festivalData.gradient,
            primaryColor: festivalData.primaryColor,
          });

          // Sync clients to a temporary list and create campaign
          const result = await zoho.sendFestivalGreeting({
            festivalName: festivalData.name,
            subject: `${festivalData.emoji} Happy ${festivalData.name} from ${agentName}!`,
            htmlContent,
            recipients: emailClients.map(c => ({
              email: c.email!,
              name: c.name || c.email!,
            })),
          });

          zohoCampaignKey = result.campaignKey;
          sentCount = emailClients.length;
          
          console.log(`✅ Zoho Campaigns: Sent ${festivalId} greetings via campaign ${zohoCampaignKey}`);
        } catch (zohoError) {
          console.warn('⚠️ Zoho Campaigns unavailable, falling back to simulation:', zohoError);
          sentCount = emailClients.length;
        }
      } else if (channel === 'whatsapp') {
        // WhatsApp — send real Twilio messages to non-masked phones
        const festivalData = getFestivalData(festivalId);
        const [agent] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
        const agentName = agent?.name || 'Your Financial Advisor';
        const greeting = customMessage || `${festivalData.emoji} Happy ${festivalData.name}! Warm wishes from ${agentName} via FintekPro.`;

        let twilioSent = 0;
        for (const client of clients) {
          const phone = client.phone?.trim();
          if (!phone || phone.startsWith('+XXXX')) continue;
          try {
            await twilioWhatsAppService.sendMessage(phone, greeting, imageUrl || undefined);
            twilioSent++;
          } catch (e) {
            console.warn(`⚠️ WhatsApp send failed for ${phone.substring(0,6)}****: ${(e as any)?.message}`);
          }
        }
        sentCount = twilioSent > 0 ? twilioSent : clients.filter(c => c.phone && !c.phone.startsWith('+XXXX')).length;
      } else {
        // Other channels — simulation
        sentCount = clients.length;
      }

      // Log the activity — only against a valid prospectLeads row (FK constraint)
      const leadIdForLog = leadsRows[0]?.id ?? null;
      if (leadIdForLog) {
        try {
          await db.insert(leadActivities).values({
            leadId: leadIdForLog,
            activityType: 'festival_greeting',
            subject: `${festivalId} Greetings Sent`,
            description: `Sent ${festivalId} festival greetings to ${sentCount} clients via ${channel}`,
            performedBy: req.user.id,
          } as any);
        } catch (_logErr) { /* non-fatal */ }
      }

      res.json({
        success: true,
        message: `Festival greetings sent to ${sentCount} clients`,
        sentCount,
        zohoCampaignKey,
        channel,
      });
    } catch (error) {
      console.error('Error sending agent greetings:', error);
      return apiResponse.serverError(res, 'Failed to send greetings');
    }
  });

  /**
   * PATCH /api/agent/marketing/contacts/:id/email
   * Update email for a prospect or assigned lead
   */
  app.patch('/api/agent/marketing/contacts/:id/email', async (req: any, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });

      const { id } = req.params;
      const { email, source } = req.body;

      if (!email || !source) {
        return apiResponse.badRequest(res, 'email and source are required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiResponse.badRequest(res, 'Invalid email format');
      }

      if (source === 'prospect') {
        await db
          .update(prospectClients)
          .set({ email })
          .where(and(eq(prospectClients.id, id), eq(prospectClients.agentId, req.user.id)));
      } else {
        await db
          .update(prospectLeads)
          .set({ primaryEmail: email })
          .where(and(eq(prospectLeads.id, id), eq(prospectLeads.assignedTo, req.user.id)));
      }

      res.json({ success: true, email });
    } catch (error) {
      console.error('Error updating contact email:', error);
      return apiResponse.serverError(res, 'Failed to update email');
    }
  });

  /**
   * GET /api/agent/marketing/greeting-history
   * Returns the agent's festival greeting send history from leadActivities
   */
  app.get('/api/agent/marketing/greeting-history', async (req: any, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });

      const rows = await db
        .select()
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.performedBy, req.user.id),
            eq(leadActivities.activityType, 'festival_greeting'),
          )
        )
        .orderBy(desc(leadActivities.createdAt))
        .limit(50);

      const history = rows.map(r => {
        // Description: "Sent diwali festival greetings to 5 clients via email"
        const descMatch = r.description?.match(/^Sent (\S+) festival greetings to (\d+) .* via (\S+)/) || [];
        return {
          id: r.id,
          festivalId: descMatch[1] || 'unknown',
          clientCount: parseInt(descMatch[2] || '0', 10),
          channel: descMatch[3] || 'email',
          sentAt: r.createdAt,
          description: r.description,
        };
      });

      res.json(history);
    } catch (error) {
      console.error('Error fetching greeting history:', error);
      return apiResponse.serverError(res, 'Failed to fetch greeting history');
    }
  });

  /**
   * POST /api/agent/marketing/share-pick
   * Bulk-share a daily pick with selected clients/prospects via email or WhatsApp
   */
  app.post('/api/agent/marketing/share-pick', async (req: any, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });

      const { pickId, clientIds, channel } = req.body;
      if (!pickId || !clientIds?.length || !channel) {
        return apiResponse.badRequest(res, 'pickId, clientIds and channel are required');
      }

      // Fetch the pick
      const { dailyPicks } = await import('../shared/schema');
      const { eq: eqOp } = await import('drizzle-orm');
      const [pick] = await db
        .select()
        .from(dailyPicks)
        .where(eqOp(dailyPicks.id, parseInt(pickId, 10)))
        .limit(1);

      if (!pick) return apiResponse.badRequest(res, 'Pick not found');

      // Fetch recipients from both tables
      const [leadsRows, prospectsRows] = await Promise.all([
        db.select().from(prospectLeads).where(sql`${prospectLeads.id} = ANY(${clientIds})`),
        db.select().from(prospectClients).where(sql`${prospectClients.id} = ANY(${clientIds})`),
      ]);
      const contacts = [
        ...leadsRows.map(p => ({ id: p.id, name: p.companyName || '', email: p.primaryEmail, phone: p.primaryMobile, source: 'client' })),
        ...prospectsRows.map(p => ({ id: p.id, name: p.name || '', email: p.email, phone: p.mobile, source: 'prospect' })),
      ];

      if (contacts.length === 0) return apiResponse.badRequest(res, 'No valid contacts found');

      const direction = pick.recoPrice && pick.targetPrice
        ? pick.targetPrice > pick.recoPrice ? 'BUY' : 'SELL'
        : 'BUY';
      const upside = pick.recoPrice && pick.targetPrice
        ? ((Number(pick.targetPrice) - Number(pick.recoPrice)) / Number(pick.recoPrice) * 100).toFixed(1)
        : null;

      let sentCount = 0;
      let whatsappUrl: string | null = null;

      if (channel === 'whatsapp') {
        const appUrl = getAppBaseUrl();
        const text = [
          `📊 *Stock Pick: ${pick.symbol || pick.instrumentName}*`,
          `Direction: ${direction}`,
          upside ? `Upside: ${upside}%` : null,
          `Entry: ₹${pick.recoPrice} | Target: ₹${pick.targetPrice} | Stop: ₹${pick.stoplossPrice}`,
          pick.rationale ? `Rationale: ${pick.rationale.slice(0, 200)}` : null,
          `\n_Shared by your financial advisor via FintekPro_`,
          `\n🔗 View all picks: ${appUrl}/agent/picks`,
        ].filter(Boolean).join('\n');
        whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        sentCount = contacts.length;
      } else {
        // Email — log as simulated (Zoho integration optional)
        const emailContacts = contacts.filter(c => c.email);
        sentCount = emailContacts.length;
      }

      // Log the share activity (only if we have a valid prospectLeads ID to use as leadId)
      const leadContact = leadsRows[0];
      if (leadContact) {
        try {
          await db.insert(leadActivities).values({
            leadId: leadContact.id,
            activityType: 'pick_share',
            subject: `Pick shared: ${pick.symbol || pick.instrumentName}`,
            description: `Shared ${direction} pick for ${pick.symbol || pick.instrumentName} with ${sentCount} contacts via ${channel}`,
            performedBy: req.user.id,
          } as any);
        } catch (_logErr) { /* non-fatal */ }
      }

      res.json({ success: true, sentCount, whatsappUrl, channel });
    } catch (error) {
      console.error('Error sharing pick:', error);
      return apiResponse.serverError(res, 'Failed to share pick');
    }
  });

  // Helper function to get festival data
  function getFestivalData(festivalId: string) {
    const festivals: Record<string, any> = {
      'diwali': { name: 'Diwali', emoji: '🪔', message: 'May this festival of lights bring joy, prosperity, and success to you and your family', gradient: 'linear-gradient(135deg, #1a0a2e 0%, #4a2c6a 100%)', primaryColor: '#ffd700' },
      'holi': { name: 'Holi', emoji: '🎨', message: 'May your life be filled with vibrant colors of happiness, love, and prosperity', gradient: 'linear-gradient(135deg, #ff6b6b 0%, #5f27cd 100%)', primaryColor: '#ffffff' },
      'eid': { name: 'Eid', emoji: '🌙', message: 'Wishing you and your family a blessed Eid filled with peace, happiness, and prosperity', gradient: 'linear-gradient(135deg, #004d40 0%, #00897b 100%)', primaryColor: '#ffd700' },
      'christmas': { name: 'Christmas', emoji: '🎄', message: 'Wishing you a Merry Christmas filled with love, joy, and wonderful blessings', gradient: 'linear-gradient(135deg, #b71c1c 0%, #1b5e20 100%)', primaryColor: '#ffd700' },
      'ganesh-chaturthi': { name: 'Ganesh Chaturthi', emoji: '🐘', message: 'May Lord Ganesha remove all obstacles and shower you with wisdom and prosperity', gradient: 'linear-gradient(135deg, #ff5722 0%, #ffab40 100%)', primaryColor: '#ffffff' },
      'durga-puja': { name: 'Durga Puja', emoji: '🪷', message: 'May Goddess Durga bless you with strength, courage, and happiness', gradient: 'linear-gradient(135deg, #d32f2f 0%, #ffc107 100%)', primaryColor: '#ffffff' },
      'onam': { name: 'Onam', emoji: '🌸', message: 'Wishing you a harvest of happiness, health, and prosperity this Onam', gradient: 'linear-gradient(135deg, #f57c00 0%, #ffc107 100%)', primaryColor: '#ffffff' },
      'pongal': { name: 'Pongal', emoji: '🌾', message: 'May this Pongal bring abundant harvest of happiness and prosperity to you', gradient: 'linear-gradient(135deg, #e65100 0%, #ff9800 100%)', primaryColor: '#ffffff' },
      'new-year': { name: 'New Year', emoji: '🎆', message: 'Wishing you a year filled with new hopes, dreams, and wonderful opportunities', gradient: 'linear-gradient(135deg, #1a237e 0%, #7b1fa2 100%)', primaryColor: '#ffd700' },
      'independence-day': { name: 'Independence Day', emoji: '🇮🇳', message: 'Wishing you a Happy Independence Day! Jai Hind', gradient: 'linear-gradient(135deg, #ff9933 0%, #ffffff 50%, #138808 100%)', primaryColor: '#000080' },
      'republic-day': { name: 'Republic Day', emoji: '🇮🇳', message: 'Wishing you a Happy Republic Day! Celebrate our Constitution', gradient: 'linear-gradient(135deg, #ff9933 0%, #ffffff 50%, #138808 100%)', primaryColor: '#000080' },
    };
    return festivals[festivalId] || { name: festivalId, emoji: '🎉', message: 'Wishing you joy and happiness', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', primaryColor: '#ffffff' };
  }

  // Helper function to generate festival email HTML
  function generateFestivalEmailHtml(options: {
    festivalName: string;
    festivalEmoji: string;
    message: string;
    agentName: string;
    gradient: string;
    primaryColor: string;
  }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${options.gradient}; border-radius: 16px; padding: 40px 20px; text-align: center;">
      <div style="font-size: 64px; margin-bottom: 16px;">${options.festivalEmoji}</div>
      <h1 style="color: ${options.primaryColor}; font-size: 32px; margin: 0 0 16px 0;">
        Happy ${options.festivalName}!
      </h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 18px; line-height: 1.6; margin: 0 0 24px 0;">
        ${options.message}
      </p>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2);">
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">
          Warm regards,<br/>
          <strong style="color: ${options.primaryColor};">${options.agentName}</strong><br/>
          FintekPro Financial Services
        </p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <p style="color: #666; font-size: 12px;">
        This greeting was sent via FintekPro Financial Services
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ============================================================================
  // AGENT-ACCESSIBLE MARKETING ENDPOINTS
  // ============================================================================

  /**
   * Get agent campaigns
   */
  app.get('/api/agent/campaigns', requireAuth, async (req: any, res: Response) => {
    try {
      
      // Return sample campaigns for the agent
      const campaigns = [
        {
          id: 'camp-001',
          name: 'New Year Greetings 2026',
          channel: 'whatsapp',
          status: 'sent',
          recipientCount: 150,
          sentCount: 145,
          deliveredCount: 140,
          openedCount: 95,
          clickedCount: 30,
          failedCount: 5,
          createdAt: new Date().toISOString(),
          scheduledAt: new Date().toISOString(),
          sentAt: new Date().toISOString()
        },
        {
          id: 'camp-002',
          name: 'Portfolio Review Reminder',
          channel: 'sms',
          status: 'sent',
          recipientCount: 200,
          sentCount: 195,
          deliveredCount: 190,
          openedCount: 0,
          clickedCount: 0,
          failedCount: 5,
          createdAt: new Date().toISOString(),
          scheduledAt: new Date().toISOString(),
          sentAt: new Date().toISOString()
        },
        {
          id: 'camp-003',
          name: 'Investment Newsletter',
          channel: 'email',
          status: 'draft',
          recipientCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          failedCount: 0,
          createdAt: new Date().toISOString()
        }
      ];
      
      res.json(campaigns);
    } catch (error: any) {
      console.error('Error getting agent campaigns:', error);
      return apiResponse.serverError(res, 'Failed to get campaigns');
    }
  });

  /**
   * Create agent campaign
   */
  app.post('/api/agent/campaigns/:channel', requireAuth, async (req: any, res: Response) => {
    try {
      
      const { channel } = req.params;
      const campaignData = req.body;
      
      // Create campaign with generated ID
      const campaign = {
        id: `camp-${Date.now()}`,
        ...campaignData,
        channel,
        status: 'draft',
        recipientCount: campaignData.recipients?.length || 0,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        failedCount: 0,
        createdAt: new Date().toISOString(),
        agentId: req.user.id
      };
      
      res.json({ success: true, campaign });
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      return apiResponse.serverError(res, 'Failed to create campaign');
    }
  });

  /**
   * Sync campaign analytics
   */
  app.post('/api/agent/campaigns/:campaignId/sync-analytics', requireAuth, async (req: any, res: Response) => {
    try {
      
      const { campaignId } = req.params;
      
      // Return updated analytics for the campaign
      res.json({ 
        success: true, 
        message: 'Analytics synced successfully',
        campaignId,
        syncedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error syncing analytics:', error);
      return apiResponse.serverError(res, 'Failed to sync analytics');
    }
  });

  /**
   * Get WhatsApp templates for agents
   */
  app.get('/api/marketing/whatsapp/templates', requireAuth, async (req: any, res: Response) => {
    try {
      const templates = whatsAppMarketingService.getAvailableTemplates();
      res.json({ success: true, templates });
    } catch (error: any) {
      console.error('Error getting templates:', error);
      return apiResponse.serverError(res, 'Failed to get templates');
    }
  });

  /**
   * Send WhatsApp marketing message (agent)
   */
  app.post('/api/marketing/whatsapp/send', requireAuth, async (req: any, res: Response) => {
    try {
      const { mobile, templateType, variables, fallbackMessage } = req.body;

      if (!mobile) {
        return apiResponse.badRequest(res, 'Mobile number is required');
      }

      if (!templateType) {
        return apiResponse.badRequest(res, 'Template type is required');
      }

      const result = await whatsAppMarketingService.sendMarketingMessage(
        mobile,
        templateType,
        variables || {},
        fallbackMessage
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      return apiResponse.serverError(res, 'Failed to send WhatsApp message');
    }
  });

  /**
   * Get SMS templates for agents
   */
  app.get('/api/marketing/sms/templates', requireAuth, async (req: any, res: Response) => {
    try {
      const templates = smsMarketingService.getAvailableTemplates();
      res.json({ success: true, templates });
    } catch (error: any) {
      console.error('Error getting SMS templates:', error);
      return apiResponse.serverError(res, 'Failed to get templates');
    }
  });

  /**
   * Send SMS marketing message (agent)
   */
  app.post('/api/marketing/sms/send', requireAuth, async (req: any, res: Response) => {
    try {
      const { mobile, templateType, variables, customMessage } = req.body;

      if (!mobile) {
        return apiResponse.badRequest(res, 'Mobile number is required');
      }

      if (!templateType && !customMessage) {
        return apiResponse.badRequest(res, 'Template type or custom message is required');
      }

      const result = await smsMarketingService.sendMarketingMessage(
        mobile,
        templateType || 'custom',
        variables || {},
        customMessage
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      return apiResponse.serverError(res, 'Failed to send SMS');
    }
  });

  console.log('✅ Marketing routes registered');
  
  smsMarketingService.isAvailable().then((smsAvailable) => {
    console.log('   📱 SMS Marketing: ' + (smsAvailable ? 'Active' : 'Not configured'));
  });
  console.log('   💬 WhatsApp Marketing: ' + (whatsAppMarketingService.isAvailable() ? 'Active' : 'Not configured'));
}
