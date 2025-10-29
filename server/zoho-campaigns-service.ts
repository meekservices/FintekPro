/**
 * Zoho Campaigns API Service
 * 
 * Email marketing platform for creating, sending, and tracking campaigns.
 * Features: email campaigns, subscriber list management, analytics, automation.
 * 
 * API Documentation: https://www.zoho.com/campaigns/help/api/v1.1/
 */

import axios, { AxiosInstance } from 'axios';

interface ZohoCampaignsConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  datacenter?: string; // 'com' | 'eu' | 'in' | 'com.au' | 'jp'
}

interface EmailCampaign {
  campaignKey: string;
  campaignName: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  htmlContent: string;
  textContent?: string;
  status: 'draft' | 'scheduled' | 'sent' | 'sending' | 'failed';
  scheduledTime?: string;
  listKeys?: string[];
  segmentKeys?: string[];
}

interface ContactList {
  listKey: string;
  listName: string;
  description?: string;
  contactCount: number;
  createdTime: string;
  modifiedTime: string;
}

interface Contact {
  emailAddress: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  company?: string;
  customFields?: Record<string, string>;
}

interface CampaignStats {
  campaignKey: string;
  campaignName: string;
  sentCount: number;
  deliveredCount: number;
  bouncedCount: number;
  openedCount: number;
  clickedCount: number;
  unsubscribedCount: number;
  spamReportCount: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export class ZohoCampaignsService {
  private client: AxiosInstance;
  private accessToken: string;
  private refreshToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private datacenter: string;

  constructor(config: ZohoCampaignsConfig) {
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.datacenter = config.datacenter || 'com';

    const baseUrl = `https://campaigns.zoho.${this.datacenter}/api/v1.1`;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for token refresh
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && this.refreshToken) {
          await this.refreshAccessToken();
          // Retry original request with new token
          error.config.headers['Authorization'] = `Zoho-oauthtoken ${this.accessToken}`;
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh OAuth access token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Missing OAuth credentials for token refresh');
    }

    try {
      const response = await axios.post(
        `https://accounts.zoho.${this.datacenter}/oauth/v2/token`,
        null,
        {
          params: {
            refresh_token: this.refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.client.defaults.headers['Authorization'] = `Zoho-oauthtoken ${this.accessToken}`;
      
      console.log('✅ Zoho Campaigns access token refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh Zoho access token:', error);
      throw error;
    }
  }

  /**
   * Get all contact lists
   */
  async getContactLists(): Promise<ContactList[]> {
    try {
      const response = await this.client.get('/lists');
      return response.data.list_of_details || [];
    } catch (error) {
      console.error('❌ Error fetching Zoho contact lists:', error);
      return [];
    }
  }

  /**
   * Create a new contact list
   */
  async createContactList(name: string, description?: string): Promise<string | null> {
    try {
      const response = await this.client.post('/lists', {
        listname: name,
        description: description || ''
      });
      return response.data.list_key;
    } catch (error) {
      console.error('❌ Error creating Zoho contact list:', error);
      return null;
    }
  }

  /**
   * Add contact to a list
   */
  async addContact(listKey: string, contact: Contact): Promise<boolean> {
    try {
      const contactData = {
        contactinfo: {
          'Contact Email': contact.emailAddress,
          'First Name': contact.firstName || '',
          'Last Name': contact.lastName || '',
          'Phone Number': contact.phoneNumber || '',
          'Company': contact.company || '',
          ...contact.customFields
        }
      };

      await this.client.post(`/lists/${listKey}/contacts`, contactData);
      return true;
    } catch (error) {
      console.error('❌ Error adding contact to Zoho list:', error);
      return false;
    }
  }

  /**
   * Add multiple contacts to a list
   */
  async addContactsBulk(listKey: string, contacts: Contact[]): Promise<{
    successCount: number;
    failedCount: number;
  }> {
    try {
      const contactsData = contacts.map(contact => ({
        'Contact Email': contact.emailAddress,
        'First Name': contact.firstName || '',
        'Last Name': contact.lastName || '',
        'Phone Number': contact.phoneNumber || '',
        'Company': contact.company || '',
        ...contact.customFields
      }));

      const response = await this.client.post(
        `/lists/${listKey}/contacts`,
        {
          contactinfo: contactsData
        }
      );

      return {
        successCount: response.data.success_count || 0,
        failedCount: response.data.failed_count || 0
      };
    } catch (error) {
      console.error('❌ Error bulk adding contacts to Zoho list:', error);
      return { successCount: 0, failedCount: contacts.length };
    }
  }

  /**
   * Create email campaign
   */
  async createCampaign(campaign: {
    name: string;
    subject: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
    htmlContent: string;
    textContent?: string;
    listKeys?: string[];
  }): Promise<string | null> {
    try {
      const response = await this.client.post('/campaigns', {
        campaign_name: campaign.name,
        subject: campaign.subject,
        from_email: campaign.fromEmail,
        from_name: campaign.fromName || campaign.fromEmail,
        reply_to: campaign.replyTo || campaign.fromEmail,
        html_content: campaign.htmlContent,
        text_content: campaign.textContent || '',
        list_keys: campaign.listKeys || []
      });

      return response.data.campaign_key;
    } catch (error) {
      console.error('❌ Error creating Zoho campaign:', error);
      return null;
    }
  }

  /**
   * Schedule a campaign
   */
  async scheduleCampaign(campaignKey: string, scheduledTime: Date): Promise<boolean> {
    try {
      await this.client.post(`/campaigns/${campaignKey}/schedule`, {
        schedule_time: scheduledTime.toISOString()
      });
      return true;
    } catch (error) {
      console.error('❌ Error scheduling Zoho campaign:', error);
      return false;
    }
  }

  /**
   * Send campaign immediately
   */
  async sendCampaign(campaignKey: string): Promise<boolean> {
    try {
      await this.client.post(`/campaigns/${campaignKey}/send`);
      return true;
    } catch (error) {
      console.error('❌ Error sending Zoho campaign:', error);
      return false;
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignKey: string): Promise<CampaignStats | null> {
    try {
      const response = await this.client.get(`/campaigns/${campaignKey}/stats`);
      const data = response.data;

      return {
        campaignKey,
        campaignName: data.campaign_name || '',
        sentCount: data.sent_count || 0,
        deliveredCount: data.delivered_count || 0,
        bouncedCount: data.bounced_count || 0,
        openedCount: data.opened_count || 0,
        clickedCount: data.clicked_count || 0,
        unsubscribedCount: data.unsubscribed_count || 0,
        spamReportCount: data.spam_report_count || 0,
        openRate: data.open_rate || 0,
        clickRate: data.click_rate || 0,
        bounceRate: data.bounce_rate || 0
      };
    } catch (error) {
      console.error('❌ Error fetching Zoho campaign stats:', error);
      return null;
    }
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(status?: 'draft' | 'scheduled' | 'sent'): Promise<EmailCampaign[]> {
    try {
      const params = status ? { status } : {};
      const response = await this.client.get('/campaigns', { params });
      return response.data.list_of_campaigns || [];
    } catch (error) {
      console.error('❌ Error fetching Zoho campaigns:', error);
      return [];
    }
  }

  /**
   * Get campaign details
   */
  async getCampaignDetails(campaignKey: string): Promise<EmailCampaign | null> {
    try {
      const response = await this.client.get(`/campaigns/${campaignKey}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching Zoho campaign details:', error);
      return null;
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignKey: string): Promise<boolean> {
    try {
      await this.client.delete(`/campaigns/${campaignKey}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting Zoho campaign:', error);
      return false;
    }
  }

  /**
   * Get campaign click report
   */
  async getCampaignClicks(campaignKey: string): Promise<Array<{
    linkUrl: string;
    clickCount: number;
  }>> {
    try {
      const response = await this.client.get(`/campaigns/${campaignKey}/clicks`);
      return response.data.click_details || [];
    } catch (error) {
      console.error('❌ Error fetching Zoho campaign clicks:', error);
      return [];
    }
  }

  /**
   * Get unsubscribed contacts from campaign
   */
  async getUnsubscribes(campaignKey: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/campaigns/${campaignKey}/unsubscribes`);
      return response.data.unsubscribed_emails || [];
    } catch (error) {
      console.error('❌ Error fetching Zoho unsubscribes:', error);
      return [];
    }
  }

  /**
   * Create and send test campaign
   */
  async sendTestEmail(campaignKey: string, testEmails: string[]): Promise<boolean> {
    try {
      await this.client.post(`/campaigns/${campaignKey}/test`, {
        test_emails: testEmails
      });
      return true;
    } catch (error) {
      console.error('❌ Error sending Zoho test email:', error);
      return false;
    }
  }

  /**
   * Sync campaign metrics from Zoho to our database
   */
  async syncCampaignMetrics(campaignKey: string): Promise<CampaignStats | null> {
    const stats = await this.getCampaignStats(campaignKey);
    
    if (stats) {
      console.log(`📊 Synced metrics for campaign ${campaignKey}:`, {
        sent: stats.sentCount,
        opened: stats.openedCount,
        clicked: stats.clickedCount,
        openRate: `${stats.openRate}%`,
        clickRate: `${stats.clickRate}%`
      });
    }

    return stats;
  }
}

// Singleton instance
let zohoCampaignsService: ZohoCampaignsService | null = null;

export function getZohoCampaignsService(): ZohoCampaignsService {
  if (!zohoCampaignsService) {
    const accessToken = process.env.ZOHO_CAMPAIGNS_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.warn('⚠️ ZOHO_CAMPAIGNS_ACCESS_TOKEN not configured. Email campaigns will not be available.');
      throw new Error('Zoho Campaigns access token not configured');
    }

    zohoCampaignsService = new ZohoCampaignsService({
      accessToken,
      refreshToken: process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN,
      clientId: process.env.ZOHO_CLIENT_ID,
      clientSecret: process.env.ZOHO_CLIENT_SECRET,
      datacenter: process.env.ZOHO_DATACENTER || 'in' // Default to India
    });

    console.log('✅ Zoho Campaigns service initialized');
  }

  return zohoCampaignsService;
}
