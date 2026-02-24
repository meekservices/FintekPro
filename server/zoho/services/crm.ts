import { ZohoApiClient } from '../api-client';
import { db } from '../../db';
import { zohoEntityMappings, partners, users, zohoConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ZohoCRMContact {
  id?: string;
  First_Name?: string;
  Last_Name: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Account_Name?: string;
  Title?: string;
  Department?: string;
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Zip?: string;
  Mailing_Country?: string;
  Description?: string;
  Lead_Source?: string;
  Tag?: string[];
  [key: string]: any;
}

interface ZohoCRMAccount {
  id?: string;
  Account_Name: string;
  Email?: string;
  Phone?: string;
  Website?: string;
  Billing_Street?: string;
  Billing_City?: string;
  Billing_State?: string;
  Billing_Code?: string;
  Billing_Country?: string;
  Description?: string;
  Industry?: string;
  Annual_Revenue?: number;
  Tag?: string[];
  [key: string]: any;
}

interface ZohoCRMLead {
  id?: string;
  First_Name?: string;
  Last_Name: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Company?: string;
  Designation?: string;
  Lead_Source?: string;
  Lead_Status?: string;
  Industry?: string;
  Description?: string;
  Tag?: string[];
  [key: string]: any;
}

interface ZohoCRMDeal {
  id?: string;
  Deal_Name: string;
  Account_Name?: string;
  Amount: number;
  Stage: string;
  Closing_Date?: string;
  Type?: string;
  Lead_Source?: string;
  Description?: string;
  Tag?: string[];
  [key: string]: any;
}

export class ZohoCRMService {
  private apiClient: ZohoApiClient;
  private connectionId: string;

  constructor(connectionId: string, dataCenter: string = 'com') {
    this.connectionId = connectionId;
    this.apiClient = new ZohoApiClient(connectionId, 'CRM', dataCenter);
  }

  /**
   * Factory method that auto-detects data center from the connection
   */
  static async create(connectionId: string): Promise<ZohoCRMService> {
    const [connection] = await db
      .select({ dataCenter: zohoConnections.zohoDataCenter })
      .from(zohoConnections)
      .where(eq(zohoConnections.id, connectionId))
      .limit(1);
    
    const dataCenter = connection?.dataCenter || 'in';
    return new ZohoCRMService(connectionId, dataCenter);
  }

  /**
   * Sync FintekPro partner to Zoho CRM as Account
   */
  async syncPartnerToAccount(partnerId: string): Promise<string> {
    // Get partner from database
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    if (!partner) {
      throw new Error('Partner not found');
    }

    // Check if mapping already exists
    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'partner'),
          eq(zohoEntityMappings.fintekproEntityId, partnerId),
          eq(zohoEntityMappings.zohoModule, 'Accounts')
        )
      )
      .limit(1);

    const accountData: ZohoCRMAccount = {
      Account_Name: partner.companyName,
      Email: partner.contactEmail,
      Phone: partner.contactPhone || undefined,
      Website: partner.website || undefined,
      Billing_Street: partner.address || undefined,
      Description: `FintekPro Partner - ARN: ${partner.arnCode || 'N/A'}, EUIN: ${partner.euinNumber || 'N/A'}`,
      Industry: 'Financial Services',
      Tag: [
        'FintekPro Partner',
        partner.partnerType,
        ...(partner.productTypes || [])
      ]
    };

    if (existingMapping) {
      // Update existing account
      const response = await this.apiClient.put(
        `/Accounts/${existingMapping.zohoRecordId}`,
        { data: [accountData] }
      );

      // Update mapping
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: response.data,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      return existingMapping.zohoRecordId;
    } else {
      // Create new account
      const response = await this.apiClient.post(
        '/Accounts',
        { data: [accountData] }
      );

      const zohoRecordId = response.data?.data?.[0]?.details?.id;

      if (!zohoRecordId) {
        throw new Error('Failed to create Zoho Account');
      }

      // Create mapping
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'partner',
        fintekproEntityId: partnerId,
        zohoService: 'CRM',
        zohoModule: 'Accounts',
        zohoRecordId,
        zohoRecordData: response.data,
        syncDirection: 'bidirectional',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });

      return zohoRecordId;
    }
  }

  /**
   * Sync FintekPro user/client to Zoho CRM as Contact
   */
  async syncUserToContact(userId: string): Promise<string> {
    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if mapping already exists
    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'user'),
          eq(zohoEntityMappings.fintekproEntityId, userId),
          eq(zohoEntityMappings.zohoModule, 'Contacts')
        )
      )
      .limit(1);

    const firstName = user.firstName || '';
    const lastName = user.lastName || user.userId || 'Client';

    const contactData: ZohoCRMContact = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: user.email || undefined,
      Phone: user.mobile || undefined,
      Mobile: user.mobile || undefined,
      Description: `FintekPro Client - UID: ${user.userId || user.id}`,
      Lead_Source: 'FintekPro Platform',
      Tag: ['FintekPro Client']
    };

    if (existingMapping) {
      // Update existing contact
      const response = await this.apiClient.put(
        `/Contacts/${existingMapping.zohoRecordId}`,
        { data: [contactData] }
      );

      // Update mapping
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: response.data,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      return existingMapping.zohoRecordId;
    } else {
      // Create new contact
      const response = await this.apiClient.post(
        '/Contacts',
        { data: [contactData] }
      );

      const zohoRecordId = response.data?.data?.[0]?.details?.id;

      if (!zohoRecordId) {
        throw new Error('Failed to create Zoho Contact');
      }

      // Create mapping
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'user',
        fintekproEntityId: userId,
        zohoService: 'CRM',
        zohoModule: 'Contacts',
        zohoRecordId,
        zohoRecordData: response.data,
        syncDirection: 'bidirectional',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });

      return zohoRecordId;
    }
  }

  /**
   * Get contact from Zoho CRM
   */
  async getContact(zohoContactId: string): Promise<ZohoCRMContact> {
    const response = await this.apiClient.get(`/Contacts/${zohoContactId}`);
    return response.data?.data?.[0];
  }

  /**
   * Get account from Zoho CRM
   */
  async getAccount(zohoAccountId: string): Promise<ZohoCRMAccount> {
    const response = await this.apiClient.get(`/Accounts/${zohoAccountId}`);
    return response.data?.data?.[0];
  }

  /**
   * Search contacts by email
   */
  async searchContactsByEmail(email: string): Promise<ZohoCRMContact[]> {
    const response = await this.apiClient.get('/Contacts/search', {
      criteria: `(Email:equals:${email})`
    });
    return response.data?.data || [];
  }

  /**
   * Get all leads from Zoho CRM for import
   * Note: Zoho CRM API v6 requires the 'fields' parameter
   */
  async getLeads(limit: number = 100): Promise<ZohoCRMLead[]> {
    try {
      const response = await this.apiClient.get('/Leads', {
        fields: 'First_Name,Last_Name,Email,Phone,Mobile,Company,Designation,Lead_Source,Lead_Status,Industry,Description,Tag,Created_Time,Modified_Time',
        per_page: Math.min(limit, 200),
        sort_by: 'Created_Time',
        sort_order: 'desc'
      });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching leads from Zoho CRM:', error);
      return [];
    }
  }

  /**
   * Get single lead from Zoho CRM by ID
   */
  async getLead(leadId: string): Promise<ZohoCRMLead | null> {
    try {
      const response = await this.apiClient.get(`/Leads/${leadId}`);
      return response.data?.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching lead from Zoho CRM:', error);
      return null;
    }
  }

  /**
   * Add note to a Zoho CRM record (Lead, Contact, Account, etc.)
   */
  async addNote(module: string, recordId: string, noteData: { title: string; content: string }): Promise<string | null> {
    try {
      const response = await this.apiClient.post('/Notes', {
        data: [{
          Note_Title: noteData.title,
          Note_Content: noteData.content,
          Parent_Id: recordId,
          '$se_module': module
        }]
      });
      return response.data?.data?.[0]?.details?.id || null;
    } catch (error) {
      console.error('Error adding note to Zoho CRM:', error);
      return null;
    }
  }

  /**
   * Update lead status in Zoho CRM
   */
  async updateLeadStatus(leadId: string, status: string): Promise<boolean> {
    try {
      await this.apiClient.put(`/Leads/${leadId}`, {
        data: [{ Lead_Status: status }]
      });
      return true;
    } catch (error) {
      console.error('Error updating lead status in Zoho CRM:', error);
      return false;
    }
  }

  /**
   * Get all contacts from Zoho CRM for import
   * Note: Zoho CRM API v6 requires the 'fields' parameter
   */
  async getContacts(limit: number = 100): Promise<ZohoCRMContact[]> {
    try {
      const response = await this.apiClient.get('/Contacts', {
        fields: 'First_Name,Last_Name,Email,Phone,Mobile,Account_Name,Title,Department,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip,Mailing_Country,Description,Lead_Source,Tag,Created_Time,Modified_Time',
        per_page: Math.min(limit, 200),
        sort_by: 'Created_Time',
        sort_order: 'desc'
      });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching contacts from Zoho CRM:', error);
      return [];
    }
  }

  /**
   * Create lead in Zoho CRM
   */
  async createLead(leadData: ZohoCRMLead): Promise<string> {
    const response = await this.apiClient.post('/Leads', {
      data: [leadData]
    });

    const zohoRecordId = response.data?.data?.[0]?.details?.id;
    return zohoRecordId;
  }

  /**
   * Update lead in Zoho CRM
   */
  async updateLead(leadId: string, leadData: Partial<ZohoCRMLead>): Promise<boolean> {
    try {
      await this.apiClient.put(`/Leads/${leadId}`, {
        data: [leadData]
      });
      return true;
    } catch (error) {
      console.error('Error updating lead in Zoho CRM:', error);
      return false;
    }
  }

  /**
   * Update contact in Zoho CRM
   */
  async updateContact(contactId: string, contactData: Partial<ZohoCRMContact>): Promise<boolean> {
    try {
      await this.apiClient.put(`/Contacts/${contactId}`, {
        data: [contactData]
      });
      return true;
    } catch (error) {
      console.error('Error updating contact in Zoho CRM:', error);
      return false;
    }
  }

  /**
   * Bulk sync partners to accounts
   */
  async bulkSyncPartnersToAccounts(partnerIds: string[]): Promise<void> {
    const results = await Promise.allSettled(
      partnerIds.map(partnerId => this.syncPartnerToAccount(partnerId))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Bulk sync completed: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Bulk sync users to contacts
   */
  async bulkSyncUsersToContacts(userIds: string[]): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map(userId => this.syncUserToContact(userId))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Bulk sync completed: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Create commission deal in Zoho CRM
   */
  async createCommissionDeal(commissionId: string): Promise<string> {
    const { partnerCommissions } = await import('@shared/schema');
    
    const [commission] = await db
      .select()
      .from(partnerCommissions)
      .where(eq(partnerCommissions.id, commissionId))
      .limit(1);

    if (!commission) {
      throw new Error('Commission not found');
    }

    // Get partner mapping to find Account ID
    const [partnerMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'partner'),
          eq(zohoEntityMappings.fintekproEntityId, commission.partnerId),
          eq(zohoEntityMappings.zohoModule, 'Accounts')
        )
      )
      .limit(1);

    const dealData: ZohoCRMDeal = {
      Deal_Name: `Commission - ${commission.productType} - ${commission.transactionDate.toISOString().split('T')[0]}`,
      Account_Name: partnerMapping?.zohoRecordId,
      Amount: parseFloat(commission.commissionAmount.toString()),
      Stage: this.mapCommissionStatusToStage(commission.status),
      Closing_Date: commission.settlementDate?.toISOString().split('T')[0],
      Type: 'Partner Commission',
      Lead_Source: 'FintekPro Platform',
      Description: `Order ID: ${commission.orderId}\nProduct: ${commission.productType}\nBase Amount: ₹${commission.baseAmount}\nCommission Rate: ${commission.commissionRate}%`,
      Tag: ['FintekPro Commission', commission.productType, commission.commissionTier]
    };

    const response = await this.apiClient.post('/Deals', {
      data: [dealData]
    });

    const zohoRecordId = response.data?.data?.[0]?.details?.id;

    if (!zohoRecordId) {
      throw new Error('Failed to create Zoho Deal');
    }

    // Create mapping
    await db.insert(zohoEntityMappings).values({
      connectionId: this.connectionId,
      fintekproEntityType: 'partner_commission',
      fintekproEntityId: commissionId,
      zohoService: 'CRM',
      zohoModule: 'Deals',
      zohoRecordId,
      zohoRecordData: response.data,
      syncDirection: 'to_zoho',
      lastSyncedAt: new Date(),
      syncStatus: 'synced'
    });

    return zohoRecordId;
  }

  /**
   * Update commission deal stage in Zoho CRM
   */
  async updateCommissionDealStage(commissionId: string, status: string): Promise<void> {
    const [mapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'partner_commission'),
          eq(zohoEntityMappings.fintekproEntityId, commissionId)
        )
      )
      .limit(1);

    if (!mapping) {
      throw new Error('Commission deal mapping not found');
    }

    const stage = this.mapCommissionStatusToStage(status);

    await this.apiClient.put(`/Deals/${mapping.zohoRecordId}`, {
      data: [{
        Stage: stage
      }]
    });

    await db
      .update(zohoEntityMappings)
      .set({
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(zohoEntityMappings.id, mapping.id));
  }

  /**
   * Map FintekPro commission status to Zoho CRM deal stage
   */
  private mapCommissionStatusToStage(status: string): string {
    const stageMap: Record<string, string> = {
      'pending': 'Qualification',
      'approved': 'Needs Analysis',
      'processing': 'Value Proposition',
      'completed': 'Closed Won',
      'cancelled': 'Closed Lost',
      'on_hold': 'Negotiation/Review'
    };

    return stageMap[status] || 'Qualification';
  }

  /**
   * Sync FintekPro agent to Zoho CRM as Contact with Agent tag
   * Called when agent is approved
   */
  async syncAgentToContact(agentId: string): Promise<string> {
    const { customerCareAgents } = await import('@shared/schema');
    
    const [agent] = await db
      .select()
      .from(customerCareAgents)
      .where(eq(customerCareAgents.id, agentId))
      .limit(1);

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check if mapping already exists
    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'agent'),
          eq(zohoEntityMappings.fintekproEntityId, agentId),
          eq(zohoEntityMappings.zohoModule, 'Contacts')
        )
      )
      .limit(1);

    // Parse name
    const nameParts = (agent.fullName || 'Agent').split(' ');
    const firstName = nameParts[0] || 'Agent';
    const lastName = nameParts.slice(1).join(' ') || 'FintekPro';

    // Build tags based on agent properties
    const tags: string[] = ['FintekPro Agent'];
    if (agent.agentLevel) tags.push(`Level: ${agent.agentLevel}`);
    if (agent.regulatoryCategory) tags.push(agent.regulatoryCategory);
    if (agent.productTypes && Array.isArray(agent.productTypes)) {
      agent.productTypes.forEach((pt: string) => tags.push(pt));
    }

    const contactData: ZohoCRMContact = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: agent.email || undefined,
      Phone: agent.phone || undefined,
      Mobile: agent.phone || undefined,
      Title: agent.agentLevel === 'master' ? 'Master Agent' : agent.agentLevel === 'sub_agent' ? 'Sub-Agent' : 'Associate Agent',
      Description: `FintekPro Agent - ARN: ${agent.arnCode || 'N/A'}, EUIN: ${agent.euinNumber || 'N/A'}\nProducts: ${(agent.productTypes || []).join(', ')}`,
      Lead_Source: 'FintekPro Platform',
      Tag: tags
    };

    if (existingMapping) {
      // Update existing contact
      const response = await this.apiClient.put(
        `/Contacts/${existingMapping.zohoRecordId}`,
        { data: [contactData] }
      );

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: response.data,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      return existingMapping.zohoRecordId;
    } else {
      // Create new contact
      const response = await this.apiClient.post(
        '/Contacts',
        { data: [contactData] }
      );

      const zohoRecordId = response.data?.data?.[0]?.details?.id;

      if (!zohoRecordId) {
        throw new Error('Failed to create Zoho Contact for Agent');
      }

      // Create mapping
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'agent',
        fintekproEntityId: agentId,
        zohoService: 'CRM',
        zohoModule: 'Contacts',
        zohoRecordId,
        zohoRecordData: response.data,
        syncDirection: 'bidirectional',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });

      return zohoRecordId;
    }
  }

  /**
   * Create agent as Lead in Zoho CRM (for pending agents)
   * Called when agent registers, before approval
   */
  async createAgentAsLead(agentId: string): Promise<string> {
    const { customerCareAgents } = await import('@shared/schema');
    
    const [agent] = await db
      .select()
      .from(customerCareAgents)
      .where(eq(customerCareAgents.id, agentId))
      .limit(1);

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check if lead already exists
    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'agent'),
          eq(zohoEntityMappings.fintekproEntityId, agentId),
          eq(zohoEntityMappings.zohoModule, 'Leads')
        )
      )
      .limit(1);

    if (existingMapping) {
      return existingMapping.zohoRecordId;
    }

    const nameParts = (agent.fullName || 'Agent').split(' ');
    const firstName = nameParts[0] || 'Agent';
    const lastName = nameParts.slice(1).join(' ') || 'FintekPro';

    const leadData: ZohoCRMLead = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: agent.email || undefined,
      Phone: agent.phone || undefined,
      Mobile: agent.phone || undefined,
      Company: 'FintekPro Agent Network',
      Designation: agent.agentLevel === 'master' ? 'Master Agent' : agent.agentLevel === 'sub_agent' ? 'Sub-Agent' : 'Associate Agent',
      Lead_Source: 'FintekPro Platform',
      Lead_Status: 'Pending Approval',
      Industry: 'Financial Services',
      Description: `Agent Registration - ARN: ${agent.arnCode || 'Pending'}, EUIN: ${agent.euinNumber || 'Pending'}\nProducts: ${(agent.productTypes || []).join(', ')}`,
      Tag: ['FintekPro Agent', 'Pending Approval', ...(agent.productTypes || [])]
    };

    const zohoRecordId = await this.createLead(leadData);

    if (zohoRecordId) {
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'agent',
        fintekproEntityId: agentId,
        zohoService: 'CRM',
        zohoModule: 'Leads',
        zohoRecordId,
        zohoRecordData: { id: zohoRecordId },
        syncDirection: 'to_zoho',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });
    }

    return zohoRecordId;
  }

  /**
   * Sync client/prospect to Zoho CRM with agent attribution and hierarchical tracking
   * Links the prospect to the owning agent and optionally to a master agent's account
   */
  async syncProspectToLead(prospectData: {
    name: string;
    email?: string;
    phone?: string;
    agentId: string;
    prospectId?: string;
    portfolioValue?: number;
    notes?: string;
    masterAgentZohoAccountId?: string;
  }): Promise<string> {
    const nameParts = prospectData.name.split(' ');
    const firstName = nameParts[0] || 'Prospect';
    const lastName = nameParts.slice(1).join(' ') || 'Client';

    // Get agent info for attribution
    const { customerCareAgents } = await import('@shared/schema');
    const [agent] = await db
      .select()
      .from(customerCareAgents)
      .where(eq(customerCareAgents.id, prospectData.agentId))
      .limit(1);

    const leadData: ZohoCRMLead = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: prospectData.email || undefined,
      Phone: prospectData.phone || undefined,
      Mobile: prospectData.phone || undefined,
      Company: 'Individual Investor',
      Lead_Source: 'Agent Referral',
      Lead_Status: 'Prospect',
      Industry: 'Individual',
      Description: `Referred by Agent: ${agent?.fullName || 'Unknown'} (ID: ${prospectData.agentId})\nPortfolio Value: ₹${prospectData.portfolioValue?.toLocaleString() || 'N/A'}\n${prospectData.notes || ''}`,
      Tag: ['FintekPro Prospect', 'Agent Referral', agent?.fullName || 'Direct']
    };

    const zohoRecordId = await this.createLead(leadData);

    // Create or update entity mapping with hierarchical tracking (upsert pattern)
    if (zohoRecordId && prospectData.prospectId) {
      // Check for existing mapping to avoid duplicates
      const [existingMapping] = await db
        .select()
        .from(zohoEntityMappings)
        .where(
          and(
            eq(zohoEntityMappings.connectionId, this.connectionId),
            eq(zohoEntityMappings.fintekproEntityType, 'prospect'),
            eq(zohoEntityMappings.fintekproEntityId, prospectData.prospectId),
            eq(zohoEntityMappings.zohoModule, 'Leads')
          )
        )
        .limit(1);

      if (existingMapping) {
        // Update existing mapping
        await db
          .update(zohoEntityMappings)
          .set({
            zohoRecordId,
            zohoRecordData: { id: zohoRecordId, name: prospectData.name },
            parentZohoRecordId: prospectData.masterAgentZohoAccountId || existingMapping.parentZohoRecordId,
            owningAgentId: prospectData.agentId,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            updatedAt: new Date()
          })
          .where(eq(zohoEntityMappings.id, existingMapping.id));
      } else {
        // Create new mapping
        await db.insert(zohoEntityMappings).values({
          connectionId: this.connectionId,
          fintekproEntityType: 'prospect',
          fintekproEntityId: prospectData.prospectId,
          zohoService: 'CRM',
          zohoModule: 'Leads',
          zohoRecordId,
          zohoRecordData: { id: zohoRecordId, name: prospectData.name },
          parentZohoRecordId: prospectData.masterAgentZohoAccountId || null,
          owningAgentId: prospectData.agentId,
          syncDirection: 'to_zoho',
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });
      }
    }

    return zohoRecordId;
  }

  async syncLoanLeadToCRM(loanData: {
    applicationId: string;
    applicationNumber: string;
    applicantName: string;
    applicantEmail?: string;
    applicantPhone?: string;
    loanType: string;
    requestedAmount: string;
    requestedTenure?: number;
    loanPurpose?: string;
    processingMode: string;
    financierName?: string;
    bankerName?: string;
    bankerMobile?: string;
    bankerEmail?: string;
    agentId: string;
    masterAgentZohoAccountId?: string;
  }): Promise<string> {
    const nameParts = loanData.applicantName.split(' ');
    const firstName = nameParts[0] || 'Loan';
    const lastName = nameParts.slice(1).join(' ') || 'Applicant';

    const { customerCareAgents } = await import('@shared/schema');
    const [agent] = await db
      .select()
      .from(customerCareAgents)
      .where(eq(customerCareAgents.id, loanData.agentId))
      .limit(1);

    const descriptionParts = [
      `Loan Type: ${loanData.loanType}`,
      `Amount: ₹${Number(loanData.requestedAmount).toLocaleString()}`,
      `Tenure: ${loanData.requestedTenure || 'N/A'} months`,
      `Purpose: ${loanData.loanPurpose || 'N/A'}`,
      `Processing: ${loanData.processingMode === 'EXTERNAL_FINANCIER' ? 'Bank/Financier Direct' : 'Platform'}`,
      `Agent: ${agent?.fullName || 'Unknown'} (ID: ${loanData.agentId})`,
      `Application #: ${loanData.applicationNumber}`,
    ];

    if (loanData.processingMode === 'EXTERNAL_FINANCIER') {
      if (loanData.financierName) descriptionParts.push(`Financier/Bank: ${loanData.financierName}`);
      if (loanData.bankerName) descriptionParts.push(`Banker Contact: ${loanData.bankerName}`);
      if (loanData.bankerMobile) descriptionParts.push(`Banker Mobile: ${loanData.bankerMobile}`);
      if (loanData.bankerEmail) descriptionParts.push(`Banker Email: ${loanData.bankerEmail}`);
    }

    const leadData: ZohoCRMLead = {
      First_Name: firstName,
      Last_Name: lastName,
      Email: loanData.applicantEmail || undefined,
      Phone: loanData.applicantPhone || undefined,
      Mobile: loanData.applicantPhone || undefined,
      Company: loanData.financierName || 'Individual',
      Lead_Source: 'DSA Loan Lead',
      Lead_Status: 'New',
      Industry: 'Financial Services',
      Description: descriptionParts.join('\n'),
      Tag: ['FintekPro Loan Lead', loanData.loanType, loanData.processingMode === 'EXTERNAL_FINANCIER' ? 'Bank Direct' : 'Platform Processed'],
      Banker: loanData.financierName || '',
      Banker_Contact_Person: loanData.bankerName || '',
      Banker_Mobile: loanData.bankerMobile || '',
      Banker_Email: loanData.bankerEmail || '',
    };

    const zohoRecordId = await this.createLead(leadData);

    if (zohoRecordId) {
      const [existingMapping] = await db
        .select()
        .from(zohoEntityMappings)
        .where(
          and(
            eq(zohoEntityMappings.connectionId, this.connectionId),
            eq(zohoEntityMappings.fintekproEntityType, 'loan_application'),
            eq(zohoEntityMappings.fintekproEntityId, loanData.applicationId),
            eq(zohoEntityMappings.zohoModule, 'Leads')
          )
        )
        .limit(1);

      if (existingMapping) {
        await db
          .update(zohoEntityMappings)
          .set({
            zohoRecordId,
            zohoRecordData: { id: zohoRecordId, name: loanData.applicantName, loanType: loanData.loanType, applicationNumber: loanData.applicationNumber },
            parentZohoRecordId: loanData.masterAgentZohoAccountId || existingMapping.parentZohoRecordId,
            owningAgentId: loanData.agentId,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            updatedAt: new Date()
          })
          .where(eq(zohoEntityMappings.id, existingMapping.id));
      } else {
        await db.insert(zohoEntityMappings).values({
          connectionId: this.connectionId,
          fintekproEntityType: 'loan_application',
          fintekproEntityId: loanData.applicationId,
          zohoService: 'CRM',
          zohoModule: 'Leads',
          zohoRecordId,
          zohoRecordData: { id: zohoRecordId, name: loanData.applicantName, loanType: loanData.loanType, applicationNumber: loanData.applicationNumber },
          parentZohoRecordId: loanData.masterAgentZohoAccountId || null,
          owningAgentId: loanData.agentId,
          syncDirection: 'to_zoho',
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });
      }

      console.log(`✅ [Zoho CRM] Loan lead ${loanData.applicationNumber} synced to Zoho Lead ${zohoRecordId} (banker: ${loanData.financierName || 'N/A'})`);
    }

    return zohoRecordId;
  }

  /**
   * Get all deals for a partner
   */
  async getPartnerDeals(partnerId: string): Promise<ZohoCRMDeal[]> {
    const [partnerMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'partner'),
          eq(zohoEntityMappings.fintekproEntityId, partnerId),
          eq(zohoEntityMappings.zohoModule, 'Accounts')
        )
      )
      .limit(1);

    if (!partnerMapping) {
      throw new Error('Partner not mapped to Zoho Account');
    }

    const response = await this.apiClient.get('/Deals/search', {
      criteria: `(Account_Name:equals:${partnerMapping.zohoRecordId})`
    });

    return response.data?.data || [];
  }

  // ============ ZOHO → FINTEKPRO IMPORT METHODS ============

  /**
   * Fetch all contacts from Zoho CRM with pagination
   * Handles 200 records per page as per Zoho API limits
   */
  async fetchAllContacts(options: {
    limit?: number;
    page?: number;
    fields?: string[];
  } = {}): Promise<{ contacts: ZohoCRMContact[]; hasMore: boolean; total: number }> {
    const perPage = Math.min(options.limit || 200, 200);
    const page = options.page || 1;
    const fields = options.fields || [
      'id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
      'Mailing_Street', 'Mailing_City', 'Mailing_State', 'Mailing_Zip',
      'Description', 'Lead_Source', 'Tag', 'Owner', 'Created_Time', 'Modified_Time'
    ];

    try {
      const response = await this.apiClient.get('/Contacts', {
        fields: fields.join(','),
        per_page: perPage,
        page: page,
        sort_by: 'Created_Time',
        sort_order: 'desc'
      });

      const contacts = response.data?.data || [];
      const info = response.data?.info || {};
      const hasMore = info.more_records === true;
      const total = info.count || contacts.length;

      return { contacts, hasMore, total };
    } catch (error: any) {
      console.error('[Zoho CRM Import] Failed to fetch contacts:', error.message);
      return { contacts: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Fetch all leads from Zoho CRM with pagination
   */
  async fetchAllLeads(options: {
    limit?: number;
    page?: number;
    fields?: string[];
  } = {}): Promise<{ leads: ZohoCRMLead[]; hasMore: boolean; total: number }> {
    const perPage = Math.min(options.limit || 200, 200);
    const page = options.page || 1;
    const fields = options.fields || [
      'id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile',
      'Company', 'Designation', 'Lead_Source', 'Lead_Status',
      'Description', 'Tag', 'Owner', 'Created_Time', 'Modified_Time'
    ];

    try {
      const response = await this.apiClient.get('/Leads', {
        fields: fields.join(','),
        per_page: perPage,
        page: page,
        sort_by: 'Created_Time',
        sort_order: 'desc'
      });

      const leads = response.data?.data || [];
      const info = response.data?.info || {};
      const hasMore = info.more_records === true;
      const total = info.count || leads.length;

      return { leads, hasMore, total };
    } catch (error: any) {
      console.error('[Zoho CRM Import] Failed to fetch leads:', error.message);
      return { leads: [], hasMore: false, total: 0 };
    }
  }

  /**
   * Get import preview - counts and sample records
   * Works in both dev and production environments
   */
  async getImportPreview(): Promise<{
    contacts: { total: number; sample: ZohoCRMContact[] };
    leads: { total: number; sample: ZohoCRMLead[] };
    existingProspects: number;
    potentialDuplicates: number;
  }> {
    const { prospectClients } = await import('@shared/schema');
    const { count } = await import('drizzle-orm');

    // Fetch first page from Zoho
    const [contactsResult, leadsResult] = await Promise.all([
      this.fetchAllContacts({ limit: 10 }),
      this.fetchAllLeads({ limit: 10 })
    ]);

    // Get total contacts/leads count by fetching with minimal data
    const [contactsCount, leadsCount] = await Promise.all([
      this.apiClient.get('/Contacts', { per_page: 1, page: 1 }).then(r => r.data?.info?.count || 0).catch(() => 0),
      this.apiClient.get('/Leads', { per_page: 1, page: 1 }).then(r => r.data?.info?.count || 0).catch(() => 0)
    ]);

    // Count existing prospects
    const [existingCount] = await db
      .select({ count: count() })
      .from(prospectClients);

    // Check for potential duplicates by email
    const sampleEmails = [
      ...contactsResult.contacts.map(c => c.Email).filter(Boolean),
      ...leadsResult.leads.map(l => l.Email).filter(Boolean)
    ];

    let potentialDuplicates = 0;
    if (sampleEmails.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const [dupeCount] = await db
        .select({ count: count() })
        .from(prospectClients)
        .where(inArray(prospectClients.email, sampleEmails as string[]));
      potentialDuplicates = dupeCount?.count || 0;
    }

    return {
      contacts: { total: contactsCount, sample: contactsResult.contacts },
      leads: { total: leadsCount, sample: leadsResult.leads },
      existingProspects: existingCount?.count || 0,
      potentialDuplicates
    };
  }

  /**
   * Import contacts from Zoho CRM as FintekPro prospects
   * PRODUCTION ONLY - includes deduplication and agent attribution
   */
  async importContactsAsProspects(options: {
    agentId: string;
    skipDuplicates?: boolean;
    batchSize?: number;
    onProgress?: (imported: number, total: number) => void;
  }): Promise<{
    imported: number;
    skipped: number;
    duplicates: number;
    errors: Array<{ email?: string; error: string }>;
  }> {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      console.log('[Zoho CRM Import] DRY RUN - Production import disabled in development');
    }

    const { prospectClients } = await import('@shared/schema');
    const { or, eq: eqFn } = await import('drizzle-orm');
    const batchSize = options.batchSize || 200;
    const skipDuplicates = options.skipDuplicates !== false;

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: Array<{ email?: string; error: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { contacts, hasMore: more } = await this.fetchAllContacts({ page, limit: batchSize });
      hasMore = more;
      page++;

      for (const contact of contacts) {
        try {
          const email = contact.Email?.toLowerCase().trim();
          const mobile = contact.Mobile || contact.Phone;
          const name = [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ').trim() || 'Unknown';

          // Check for duplicates
          if (skipDuplicates && (email || mobile)) {
            const conditions = [];
            if (email) conditions.push(eqFn(prospectClients.email, email));
            if (mobile) conditions.push(eqFn(prospectClients.mobile, mobile));

            const existing = await db
              .select({ id: prospectClients.id })
              .from(prospectClients)
              .where(or(...conditions))
              .limit(1);

            if (existing.length > 0) {
              duplicates++;
              continue;
            }
          }

          // Skip if no contact info
          if (!email && !mobile) {
            skipped++;
            continue;
          }

          // Create prospect (only in production)
          if (isProduction) {
            const [newProspect] = await db.insert(prospectClients).values({
              agentId: options.agentId,
              name,
              email: email || null,
              mobile: mobile || null,
              clientType: 'individual',
              state: 'prospect',
              createdAt: new Date()
            }).returning({ id: prospectClients.id });

            // Create entity mapping for sync tracking
            if (contact.id && newProspect?.id) {
              await db.insert(zohoEntityMappings).values({
                connectionId: this.connectionId,
                fintekproEntityType: 'prospect',
                fintekproEntityId: newProspect.id,
                zohoService: 'CRM',
                zohoModule: 'Contacts',
                zohoRecordId: contact.id,
                zohoRecordData: contact,
                syncDirection: 'from_zoho',
                lastSyncedAt: new Date(),
                syncStatus: 'synced'
              });
            }
          }

          imported++;
          options.onProgress?.(imported, contacts.length);

        } catch (error: any) {
          errors.push({ email: contact.Email, error: error.message });
        }
      }

      console.log(`[Zoho CRM Import] Page ${page - 1}: ${imported} imported, ${duplicates} duplicates, ${skipped} skipped`);
    }

    return { imported, skipped, duplicates, errors };
  }

  /**
   * Import leads from Zoho CRM as FintekPro prospects
   * PRODUCTION ONLY - includes deduplication
   */
  async importLeadsAsProspects(options: {
    agentId: string;
    skipDuplicates?: boolean;
    batchSize?: number;
    onProgress?: (imported: number, total: number) => void;
  }): Promise<{
    imported: number;
    skipped: number;
    duplicates: number;
    errors: Array<{ email?: string; error: string }>;
  }> {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      console.log('[Zoho CRM Import] DRY RUN - Production import disabled in development');
    }

    const { prospectClients } = await import('@shared/schema');
    const { or, eq: eqFn } = await import('drizzle-orm');
    const batchSize = options.batchSize || 200;
    const skipDuplicates = options.skipDuplicates !== false;

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: Array<{ email?: string; error: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { leads, hasMore: more } = await this.fetchAllLeads({ page, limit: batchSize });
      hasMore = more;
      page++;

      for (const lead of leads) {
        try {
          const email = lead.Email?.toLowerCase().trim();
          const mobile = lead.Mobile || lead.Phone;
          const name = [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ').trim() || 'Unknown';

          // Check for duplicates
          if (skipDuplicates && (email || mobile)) {
            const conditions = [];
            if (email) conditions.push(eqFn(prospectClients.email, email));
            if (mobile) conditions.push(eqFn(prospectClients.mobile, mobile));

            const existing = await db
              .select({ id: prospectClients.id })
              .from(prospectClients)
              .where(or(...conditions))
              .limit(1);

            if (existing.length > 0) {
              duplicates++;
              continue;
            }
          }

          // Skip if no contact info
          if (!email && !mobile) {
            skipped++;
            continue;
          }

          // Create prospect (only in production)
          if (isProduction) {
            const [newProspect] = await db.insert(prospectClients).values({
              agentId: options.agentId,
              name,
              email: email || null,
              mobile: mobile || null,
              clientType: 'individual',
              state: 'prospect',
              createdAt: new Date()
            }).returning({ id: prospectClients.id });

            // Create entity mapping for sync tracking
            if (lead.id && newProspect?.id) {
              await db.insert(zohoEntityMappings).values({
                connectionId: this.connectionId,
                fintekproEntityType: 'prospect',
                fintekproEntityId: newProspect.id,
                zohoService: 'CRM',
                zohoModule: 'Leads',
                zohoRecordId: lead.id,
                zohoRecordData: lead,
                syncDirection: 'from_zoho',
                lastSyncedAt: new Date(),
                syncStatus: 'synced'
              });
            }
          }

          imported++;
          options.onProgress?.(imported, leads.length);

        } catch (error: any) {
          errors.push({ email: lead.Email, error: error.message });
        }
      }

      console.log(`[Zoho CRM Import] Leads Page ${page - 1}: ${imported} imported, ${duplicates} duplicates, ${skipped} skipped`);
    }

    return { imported, skipped, duplicates, errors };
  }

  /**
   * Get sync status - how many records are synced between Zoho and FintekPro
   */
  async getSyncStatus(): Promise<{
    syncedFromZoho: number;
    syncedToZoho: number;
    pendingSync: number;
    lastSyncAt: Date | null;
  }> {
    const { count, sql: sqlFn } = await import('drizzle-orm');

    const [fromZoho] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.syncDirection, 'from_zoho')
        )
      );

    const [toZoho] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.syncDirection, 'to_zoho')
        )
      );

    const [pending] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.syncStatus, 'pending')
        )
      );

    const [lastSync] = await db
      .select({ lastSyncedAt: zohoEntityMappings.lastSyncedAt })
      .from(zohoEntityMappings)
      .where(eq(zohoEntityMappings.connectionId, this.connectionId))
      .orderBy(sqlFn`${zohoEntityMappings.lastSyncedAt} DESC NULLS LAST`)
      .limit(1);

    return {
      syncedFromZoho: fromZoho?.count || 0,
      syncedToZoho: toZoho?.count || 0,
      pendingSync: pending?.count || 0,
      lastSyncAt: lastSync?.lastSyncedAt || null
    };
  }
}
