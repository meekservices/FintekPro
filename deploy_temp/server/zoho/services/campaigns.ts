import { ZohoApiClient } from '../api-client';

interface ZohoCampaign {
  campaign_key?: string;
  campaign_name: string;
  campaign_type: 'regular' | 'ab_test' | 'rss' | 'autoresponder';
  subject: string;
  from_email: string;
  from_name: string;
  reply_to?: string;
  status?: string;
  sent_time?: string;
  created_time?: string;
  total_recipients?: number;
  open_count?: number;
  click_count?: number;
  bounce_count?: number;
  unsubscribe_count?: number;
}

interface ZohoMailingList {
  listkey?: string;
  listname: string;
  list_description?: string;
  signup_form?: boolean;
  double_optin?: boolean;
  list_type?: 'customer' | 'prospect' | 'vendor' | 'partner';
  total_contacts?: number;
  active_contacts?: number;
  created_time?: string;
}

interface ZohoCampaignContact {
  contact_email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  mobile?: string;
  custom_fields?: Record<string, any>;
}

interface CampaignStats {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export class ZohoCampaignsService {
  private client: ZohoApiClient;

  constructor(connectionId: string, dataCenter: string = 'in') {
    this.client = new ZohoApiClient(connectionId, 'Campaigns', dataCenter);
  }

  // ==================== Mailing Lists ====================

  async getMailingLists(): Promise<ZohoMailingList[]> {
    const response = await this.client.get('/getmailinglists');
    return response.data?.list_of_details || [];
  }

  async createMailingList(list: ZohoMailingList): Promise<string> {
    const response = await this.client.post('/addlist', {
      resfmt: 'JSON',
      listname: list.listname,
      list_description: list.list_description || '',
      signup_form: list.signup_form ? 'on' : 'off',
      double_optin: list.double_optin ? 'on' : 'off',
    });
    
    if (response.data?.status === 'success') {
      return response.data.listkey;
    }
    throw new Error(response.data?.message || 'Failed to create mailing list');
  }

  async getMailingListDetails(listKey: string): Promise<ZohoMailingList | null> {
    const response = await this.client.get('/listinfo', {
      params: { listkey: listKey }
    });
    return response.data?.list_of_details?.[0] || null;
  }

  // ==================== Contacts ====================

  async addContactToList(listKey: string, contact: ZohoCampaignContact): Promise<boolean> {
    const contactInfo = {
      'Contact Email': contact.contact_email,
      'First Name': contact.first_name || '',
      'Last Name': contact.last_name || '',
      'Company': contact.company || '',
      'Phone': contact.phone || '',
      'Mobile': contact.mobile || '',
      ...contact.custom_fields
    };

    const response = await this.client.post('/listsubscribe', {
      resfmt: 'JSON',
      listkey: listKey,
      contactinfo: JSON.stringify(contactInfo),
    });

    return response.data?.status === 'success';
  }

  async addContactsToList(listKey: string, contacts: ZohoCampaignContact[]): Promise<{success: number; failed: number}> {
    const contactsData = contacts.map(c => ({
      'Contact Email': c.contact_email,
      'First Name': c.first_name || '',
      'Last Name': c.last_name || '',
      'Company': c.company || '',
      'Phone': c.phone || '',
      'Mobile': c.mobile || '',
      ...c.custom_fields
    }));

    const response = await this.client.post('/listsubscribemany', {
      resfmt: 'JSON',
      listkey: listKey,
      contactinfo: JSON.stringify(contactsData),
    });

    return {
      success: response.data?.success_count || 0,
      failed: response.data?.failed_count || 0,
    };
  }

  async removeContactFromList(listKey: string, email: string): Promise<boolean> {
    const response = await this.client.post('/listunsubscribe', {
      resfmt: 'JSON',
      listkey: listKey,
      contact_email: email,
    });

    return response.data?.status === 'success';
  }

  async getListContacts(listKey: string, options?: {
    fromindex?: number;
    range?: number;
    status?: 'active' | 'unsubscribed' | 'bounced';
  }): Promise<ZohoCampaignContact[]> {
    const response = await this.client.get('/listcontacts', {
      params: {
        listkey: listKey,
        fromindex: options?.fromindex || 1,
        range: options?.range || 100,
        status: options?.status || 'active',
      }
    });

    return response.data?.list_of_details || [];
  }

  // ==================== Campaigns ====================

  async getCampaigns(status?: 'Draft' | 'Scheduled' | 'Sent' | 'Inprogress'): Promise<ZohoCampaign[]> {
    const params: any = { resfmt: 'JSON' };
    if (status) params.status = status;

    const response = await this.client.get('/getcampaigns', { params });
    return response.data?.list_of_details || [];
  }

  async getCampaignDetails(campaignKey: string): Promise<ZohoCampaign | null> {
    const response = await this.client.get('/campaigndetails', {
      params: { campaignkey: campaignKey }
    });
    return response.data?.campaign_details || null;
  }

  async createCampaign(campaign: {
    name: string;
    subject: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    htmlContent: string;
    listKeys: string[];
  }): Promise<string> {
    const response = await this.client.post('/createcampaign', {
      resfmt: 'JSON',
      campaignname: campaign.name,
      campaigntype: 'Regular',
      subject: campaign.subject,
      from_email: campaign.fromEmail,
      from_name: campaign.fromName,
      reply_to: campaign.replyTo || campaign.fromEmail,
      content: campaign.htmlContent,
      listkey: campaign.listKeys.join(','),
    });

    if (response.data?.status === 'success') {
      return response.data.campaign_key;
    }
    throw new Error(response.data?.message || 'Failed to create campaign');
  }

  async sendCampaign(campaignKey: string, scheduleTime?: Date): Promise<boolean> {
    const params: any = {
      resfmt: 'JSON',
      campaignkey: campaignKey,
    };

    if (scheduleTime) {
      params.schedule_time = scheduleTime.toISOString();
    }

    const response = await this.client.post('/sendcampaign', params);
    return response.data?.status === 'success';
  }

  async getCampaignStats(campaignKey: string): Promise<CampaignStats | null> {
    const response = await this.client.get('/campaignreports', {
      params: { campaignkey: campaignKey }
    });

    const data = response.data?.campaign_reports;
    if (!data) return null;

    const totalSent = data.sent || 0;
    const delivered = data.delivered || 0;
    const opened = data.opened || 0;
    const clicked = data.clicked || 0;
    const bounced = data.bounced || 0;
    const unsubscribed = data.unsubscribed || 0;

    return {
      total_sent: totalSent,
      delivered,
      opened,
      clicked,
      bounced,
      unsubscribed,
      open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
      click_rate: delivered > 0 ? (clicked / delivered) * 100 : 0,
      bounce_rate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
    };
  }

  // ==================== Templates ====================

  async getEmailTemplates(): Promise<any[]> {
    const response = await this.client.get('/gettemplates', {
      params: { resfmt: 'JSON' }
    });
    return response.data?.list_of_details || [];
  }

  // ==================== Festival Greeting Integration ====================

  async createFestivalCampaign(options: {
    festivalName: string;
    subject: string;
    htmlContent: string;
    fromEmail: string;
    fromName: string;
    listKeys: string[];
    scheduleTime?: Date;
  }): Promise<{campaignKey: string; scheduled: boolean}> {
    const campaignName = `Festival Greeting - ${options.festivalName} - ${new Date().toISOString().split('T')[0]}`;
    
    const campaignKey = await this.createCampaign({
      name: campaignName,
      subject: options.subject,
      fromEmail: options.fromEmail,
      fromName: options.fromName,
      htmlContent: options.htmlContent,
      listKeys: options.listKeys,
    });

    let scheduled = false;
    if (options.scheduleTime) {
      scheduled = await this.sendCampaign(campaignKey, options.scheduleTime);
    }

    return { campaignKey, scheduled };
  }

  // ==================== Sync with FintekPro ====================

  async syncClientsToList(listKey: string, clients: Array<{
    email: string;
    name: string;
    phone?: string;
    investmentType?: string;
  }>): Promise<{success: number; failed: number}> {
    const contacts: ZohoCampaignContact[] = clients.map(client => {
      const nameParts = client.name.split(' ');
      return {
        contact_email: client.email,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        phone: client.phone || '',
        custom_fields: {
          'Investment Type': client.investmentType || '',
        }
      };
    });

    return this.addContactsToList(listKey, contacts);
  }
}

export const createZohoCampaignsService = (connectionId: string, dataCenter: string = 'in') => {
  return new ZohoCampaignsService(connectionId, dataCenter);
};
