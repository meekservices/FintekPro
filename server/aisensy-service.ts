/**
 * AiSensy WhatsApp Business API Service
 * 
 * Official WhatsApp Business API platform for:
 * - Broadcast messages using approved templates
 * - Interactive buttons and list messages
 * - Media messaging (images, videos, documents)
 * - Two-way conversations
 * - Message analytics
 * 
 * API Documentation: https://docs.aisensy.com/
 */

import axios, { AxiosInstance } from 'axios';

interface AiSensyConfig {
  apiKey: string;
  partnerKey?: string;
  baseUrl?: string;
}

interface WhatsAppTemplate {
  templateId: string;
  templateName: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phoneNumber?: string;
    }>;
  }>;
}

interface BroadcastMessage {
  templateName: string;
  languageCode?: string;
  headerParams?: string[]; // For header variables
  bodyParams?: string[]; // For body variables
  mediaUrl?: string; // For header media
  buttons?: Array<{
    type: string;
    urlParams?: string[];
  }>;
}

interface BroadcastRequest {
  campaignName: string;
  template: BroadcastMessage;
  recipients: Array<{
    phone: string; // Format: 91XXXXXXXXXX (with country code)
    customParams?: string[];
  }>;
  scheduledAt?: Date;
}

interface BroadcastResponse {
  broadcastId: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  successCount?: number;
  failedCount?: number;
}

interface MessageStatus {
  messageId: string;
  phone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errorCode?: string;
  errorMessage?: string;
}

interface CampaignAnalytics {
  broadcastId: string;
  campaignName: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  deliveryRate: number;
  readRate: number;
  buttonClicks?: Array<{
    buttonText: string;
    clickCount: number;
  }>;
}

export class AiSensyService {
  private client: AxiosInstance;
  private apiKey: string;
  private partnerKey?: string;

  constructor(config: AiSensyConfig) {
    this.apiKey = config.apiKey;
    this.partnerKey = config.partnerKey;

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://backend.aisensy.com/campaign/t1',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get all approved WhatsApp templates
   */
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      const response = await this.client.get('/api/v2/templates');
      return response.data.templates || [];
    } catch (error) {
      console.error('❌ Error fetching AiSensy templates:', error);
      return [];
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string): Promise<WhatsAppTemplate | null> {
    try {
      const response = await this.client.get(`/api/v2/templates/${templateName}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching template ${templateName}:`, error);
      return null;
    }
  }

  /**
   * Send broadcast message using template
   */
  async sendBroadcast(request: BroadcastRequest): Promise<BroadcastResponse | null> {
    try {
      const payload = {
        campaignName: request.campaignName,
        template: {
          name: request.template.templateName,
          languageCode: request.template.languageCode || 'en',
          headerParams: request.template.headerParams || [],
          bodyParams: request.template.bodyParams || [],
          mediaUrl: request.template.mediaUrl,
          buttons: request.template.buttons || []
        },
        destination: request.recipients.map(r => ({
          phone: r.phone,
          customParams: r.customParams || []
        })),
        scheduledTime: request.scheduledAt?.toISOString()
      };

      const response = await this.client.post('/api/v2/broadcast', payload);
      
      return {
        broadcastId: response.data.broadcastId || response.data.id,
        status: response.data.status || 'processing',
        totalRecipients: request.recipients.length,
        successCount: response.data.successCount,
        failedCount: response.data.failedCount
      };
    } catch (error) {
      console.error('❌ Error sending AiSensy broadcast:', error);
      return null;
    }
  }

  /**
   * Send single template message
   */
  async sendTemplateMessage(
    phone: string,
    template: BroadcastMessage
  ): Promise<{ messageId: string; status: string } | null> {
    try {
      const response = await this.client.post('/api/v2/message', {
        phone,
        templateName: template.templateName,
        languageCode: template.languageCode || 'en',
        headerParams: template.headerParams || [],
        bodyParams: template.bodyParams || [],
        mediaUrl: template.mediaUrl,
        buttons: template.buttons || []
      });

      return {
        messageId: response.data.messageId,
        status: response.data.status
      };
    } catch (error) {
      console.error('❌ Error sending AiSensy template message:', error);
      return null;
    }
  }

  /**
   * Send interactive button message
   */
  async sendButtonMessage(
    phone: string,
    bodyText: string,
    buttons: Array<{ id: string; text: string }>
  ): Promise<{ messageId: string } | null> {
    try {
      const response = await this.client.post('/api/v2/interactive/button', {
        phone,
        body: bodyText,
        buttons: buttons.map(btn => ({
          id: btn.id,
          title: btn.text
        }))
      });

      return { messageId: response.data.messageId };
    } catch (error) {
      console.error('❌ Error sending AiSensy button message:', error);
      return null;
    }
  }

  /**
   * Send list message (interactive list)
   */
  async sendListMessage(
    phone: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<{ messageId: string } | null> {
    try {
      const response = await this.client.post('/api/v2/interactive/list', {
        phone,
        body: bodyText,
        buttonText,
        sections
      });

      return { messageId: response.data.messageId };
    } catch (error) {
      console.error('❌ Error sending AiSensy list message:', error);
      return null;
    }
  }

  /**
   * Send media message (image, video, document)
   */
  async sendMediaMessage(
    phone: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'document',
    caption?: string,
    filename?: string
  ): Promise<{ messageId: string } | null> {
    try {
      const response = await this.client.post('/api/v2/media', {
        phone,
        mediaUrl,
        mediaType,
        caption,
        filename
      });

      return { messageId: response.data.messageId };
    } catch (error) {
      console.error('❌ Error sending AiSensy media message:', error);
      return null;
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus | null> {
    try {
      const response = await this.client.get(`/api/v2/message/${messageId}/status`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching message status ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Get broadcast analytics
   */
  async getBroadcastAnalytics(broadcastId: string): Promise<CampaignAnalytics | null> {
    try {
      const response = await this.client.get(`/api/v2/broadcast/${broadcastId}/analytics`);
      const data = response.data;

      return {
        broadcastId,
        campaignName: data.campaignName || '',
        sentCount: data.sentCount || 0,
        deliveredCount: data.deliveredCount || 0,
        readCount: data.readCount || 0,
        failedCount: data.failedCount || 0,
        deliveryRate: data.deliveryRate || 0,
        readRate: data.readRate || 0,
        buttonClicks: data.buttonClicks || []
      };
    } catch (error) {
      console.error(`❌ Error fetching broadcast analytics ${broadcastId}:`, error);
      return null;
    }
  }

  /**
   * Get all broadcasts
   */
  async getBroadcasts(status?: 'scheduled' | 'processing' | 'completed' | 'failed'): Promise<any[]> {
    try {
      const params = status ? { status } : {};
      const response = await this.client.get('/api/v2/broadcasts', { params });
      return response.data.broadcasts || [];
    } catch (error) {
      console.error('❌ Error fetching AiSensy broadcasts:', error);
      return [];
    }
  }

  /**
   * Cancel scheduled broadcast
   */
  async cancelBroadcast(broadcastId: string): Promise<boolean> {
    try {
      await this.client.post(`/api/v2/broadcast/${broadcastId}/cancel`);
      return true;
    } catch (error) {
      console.error(`❌ Error canceling broadcast ${broadcastId}:`, error);
      return false;
    }
  }

  /**
   * Format phone number for WhatsApp (add country code if missing)
   */
  formatPhoneNumber(phone: string, defaultCountryCode: string = '91'): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing
    if (!cleaned.startsWith(defaultCountryCode)) {
      cleaned = defaultCountryCode + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate template parameters
   */
  validateTemplateParams(
    template: WhatsAppTemplate,
    headerParams: string[],
    bodyParams: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Count placeholders in template body
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const bodyPlaceholders = (bodyComponent.text.match(/\{\{(\d+)\}\}/g) || []).length;
      if (bodyParams.length !== bodyPlaceholders) {
        errors.push(`Body expects ${bodyPlaceholders} parameters, got ${bodyParams.length}`);
      }
    }

    // Check header if applicable
    const headerComponent = template.components.find(c => c.type === 'HEADER');
    if (headerComponent?.format === 'TEXT' && headerComponent.text) {
      const headerPlaceholders = (headerComponent.text.match(/\{\{(\d+)\}\}/g) || []).length;
      if (headerParams.length !== headerPlaceholders) {
        errors.push(`Header expects ${headerPlaceholders} parameters, got ${headerParams.length}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get webhook events (if configured)
   */
  async getWebhookEvents(since?: Date): Promise<any[]> {
    try {
      const params = since ? { since: since.toISOString() } : {};
      const response = await this.client.get('/api/v2/webhook/events', { params });
      return response.data.events || [];
    } catch (error) {
      console.error('❌ Error fetching webhook events:', error);
      return [];
    }
  }

  /**
   * Sync broadcast metrics from AiSensy to database
   */
  async syncBroadcastMetrics(broadcastId: string): Promise<CampaignAnalytics | null> {
    const analytics = await this.getBroadcastAnalytics(broadcastId);
    
    if (analytics) {
      console.log(`📊 Synced WhatsApp metrics for broadcast ${broadcastId}:`, {
        sent: analytics.sentCount,
        delivered: analytics.deliveredCount,
        read: analytics.readCount,
        deliveryRate: `${analytics.deliveryRate}%`,
        readRate: `${analytics.readRate}%`
      });
    }

    return analytics;
  }
}

// Singleton instance
let aiSensyService: AiSensyService | null = null;

export function getAiSensyService(): AiSensyService {
  if (!aiSensyService) {
    const apiKey = process.env.AISENSY_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ AISENSY_API_KEY not configured. WhatsApp campaigns will not be available.');
      throw new Error('AiSensy API key not configured');
    }

    aiSensyService = new AiSensyService({
      apiKey,
      partnerKey: process.env.AISENSY_PARTNER_KEY
    });

    console.log('✅ AiSensy WhatsApp service initialized');
  }

  return aiSensyService;
}
