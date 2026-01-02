import { ZohoApiClient } from '../api-client';
import { db } from '../../db';
import { zohoEntityMappings, partners, users } from '@shared/schema';
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
   * Sync client/prospect to Zoho CRM with agent attribution
   */
  async syncProspectToLead(prospectData: {
    name: string;
    email?: string;
    phone?: string;
    agentId: string;
    portfolioValue?: number;
    notes?: string;
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
      Description: `Referred by Agent: ${agent?.fullName || 'Unknown'}\nPortfolio Value: ₹${prospectData.portfolioValue?.toLocaleString() || 'N/A'}\n${prospectData.notes || ''}`,
      Tag: ['FintekPro Prospect', 'Agent Referral', agent?.fullName || 'Direct']
    };

    return await this.createLead(leadData);
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
}
