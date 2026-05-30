import twilio from 'twilio';
import { getTwilioClient, getTwilioFromPhoneNumber } from './twilio-client';
import { db } from '../db';
import { users, marketingCampaigns, campaignRecipients } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

interface SMSMarketingResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  status?: string;
}

interface BulkSMSResult {
  totalRecipients: number;
  sent: number;
  failed: number;
  results: Array<{
    mobile: string;
    success: boolean;
    messageSid?: string;
    error?: string;
  }>;
}

interface SMSCampaignConfig {
  campaignId: string;
  message: string;
  targetSegment?: string;
  customFilters?: Record<string, any>;
  scheduledAt?: Date;
}


class SMSMarketingService {
  private client: any = null;
  private messagingServiceSid: string = '';
  private fromNumber: string = '';
  private isConfigured: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.client = await getTwilioClient();
      this.fromNumber = await getTwilioFromPhoneNumber() || '';
      this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
      this.isConfigured = true;
      console.log('✅ SMS Marketing service initialized via shared Twilio client');
    } catch (error) {
      this.isConfigured = false;
      console.log('⚠️ SMS Marketing service not configured - Twilio credentials missing');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureInitialized();
    return this.isConfigured;
  }

  private formatPhoneNumber(mobile: string): string {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  }

  async sendMarketingSMS(to: string, message: string, campaignId?: string, skipConsentCheck: boolean = false): Promise<SMSMarketingResult> {
    await this.ensureInitialized();
    
    if (!this.isConfigured) {
      console.log(`📱 Marketing SMS to ${to.substring(0, 6)}****: ${message.substring(0, 50)}... (not configured)`);
      return { success: false, error: 'SMS Marketing service not configured' };
    }

    if (!skipConsentCheck) {
      const hasConsent = await this.hasMarketingConsent(to);
      if (!hasConsent) {
        console.log(`🚫 Marketing SMS blocked - no consent: ${to.substring(0, 6)}**** (TRAI compliance)`);
        return { success: false, error: 'User has not consented to marketing communications (TRAI compliance)' };
      }
    }

    try {
      const formattedTo = this.formatPhoneNumber(to);
      
      const messageOptions: any = {
        body: message,
        to: formattedTo,
      };

      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else if (this.fromNumber) {
        messageOptions.from = this.fromNumber;
      }

      console.log(`📱 Sending marketing SMS to ${formattedTo.substring(0, 8)}***`);

      const result = await this.client.messages.create(messageOptions);
      
      console.log(`✅ Marketing SMS sent - SID: ${result.sid}, Status: ${result.status}`);
      
      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error: any) {
      console.error('❌ Failed to send marketing SMS:', error.message);
      return { success: false, error: error.message };
    }
  }

  async hasMarketingConsent(mobile: string): Promise<boolean> {
    try {
      const cleaned = mobile.replace(/\D/g, '');
      const last10Digits = cleaned.slice(-10);
      
      const [user] = await db.select({ marketingConsent: users.marketingConsent })
        .from(users)
        .where(sql`${users.mobile} LIKE ${'%' + last10Digits}`)
        .limit(1);

      return user?.marketingConsent === true;
    } catch (error) {
      console.error('Error checking marketing consent:', error);
      return false;
    }
  }

  async sendBulkSMS(recipients: Array<{ mobile: string; name?: string }>, messageTemplate: string, campaignId?: string): Promise<BulkSMSResult> {
    const results: BulkSMSResult = {
      totalRecipients: recipients.length,
      sent: 0,
      failed: 0,
      results: []
    };

    for (const recipient of recipients) {
      const personalizedMessage = messageTemplate
        .replace(/{{name}}/gi, recipient.name || 'Valued Customer')
        .replace(/{{mobile}}/gi, recipient.mobile);

      const result = await this.sendMarketingSMS(recipient.mobile, personalizedMessage, campaignId);
      
      results.results.push({
        mobile: recipient.mobile,
        success: result.success,
        messageSid: result.messageSid,
        error: result.error
      });

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Bulk SMS complete: ${results.sent}/${results.totalRecipients} sent, ${results.failed} failed`);
    
    return results;
  }

  async sendCampaignSMS(config: SMSCampaignConfig): Promise<BulkSMSResult> {
    const { campaignId, message, targetSegment } = config;

    let query = db.select({
      id: users.id,
      mobile: users.mobile,
      fullName: users.fullName,
      marketingConsent: users.marketingConsent
    }).from(users)
    .where(and(
      eq(users.marketingConsent, true),
      sql`${users.mobile} IS NOT NULL`
    ));

    const eligibleUsers = await query;

    const recipients = eligibleUsers
      .filter(user => user.mobile)
      .map(user => ({
        mobile: user.mobile!,
        name: user.fullName || undefined,
        userId: user.id
      }));

    console.log(`📊 Campaign ${campaignId}: Found ${recipients.length} eligible recipients`);

    if (recipients.length === 0) {
      return {
        totalRecipients: 0,
        sent: 0,
        failed: 0,
        results: []
      };
    }

    const results = await this.sendBulkSMS(
      recipients.map(r => ({ mobile: r.mobile, name: r.name })),
      message,
      campaignId
    );

    if (campaignId) {
      await db.update(marketingCampaigns)
        .set({
          sentCount: results.sent,
          status: 'sent',
          updatedAt: new Date()
        })
        .where(eq(marketingCampaigns.id, campaignId));

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const result = results.results[i];

        await db.insert(campaignRecipients).values({
          campaignId,
          userId: recipient.userId,
          mobile: recipient.mobile,
          fullName: recipient.name,
          status: result.success ? 'sent' : 'failed',
          sentAt: result.success ? new Date() : undefined,
          errorMessage: result.error
        }).onConflictDoNothing();
      }
    }

    return results;
  }

  async sendPromotionalSMS(to: string, productType: string, details: Record<string, any>): Promise<SMSMarketingResult> {
    let message = '';

    switch (productType) {
      case 'ipo':
        message = `🎯 FintekPro IPO Alert!\n\n${details.companyName} IPO opens ${details.openDate}.\nPrice: ₹${details.priceMin}-₹${details.priceMax}\nApply now on FintekPro!\n\nReply STOP to opt-out.`;
        break;
      case 'mutual_fund':
        message = `📈 FintekPro MF Update!\n\n${details.fundName} delivered ${details.returns}% returns.\nStart SIP from ₹${details.minSip}/month.\n\nReply STOP to opt-out.`;
        break;
      case 'stock_tip':
        message = `💹 FintekPro Stock Alert!\n\n${details.symbol}: ${details.action} @ ₹${details.price}\nTarget: ₹${details.target}\n\nReply STOP to opt-out.`;
        break;
      case 'loan':
        message = `🏦 FintekPro Loan Offer!\n\nPre-approved ${details.loanType} loan up to ₹${details.amount}.\nInterest from ${details.rate}% p.a.\nApply in 2 mins!\n\nReply STOP to opt-out.`;
        break;
      case 'kyc_reminder':
        message = `🔐 FintekPro KYC Reminder\n\nComplete your KYC to unlock all features.\n- Stocks & MFs\n- IPOs\n- Loans & more\n\nComplete now: ${details.link}\n\nReply STOP to opt-out.`;
        break;
      case 'portfolio_update':
        message = `📊 FintekPro Portfolio Update\n\nYour portfolio: ₹${details.value}\nToday: ${details.change}%\n\nView details: ${details.link}\n\nReply STOP to opt-out.`;
        break;
      default:
        message = `📢 FintekPro Update\n\n${details.message || 'Check out our latest offers!'}\n\nReply STOP to opt-out.`;
    }

    return this.sendMarketingSMS(to, message);
  }

  async checkOptOutStatus(mobile: string): Promise<boolean> {
    try {
      const cleaned = mobile.replace(/\D/g, '');
      const last10Digits = cleaned.slice(-10);
      
      const [user] = await db.select({ marketingConsent: users.marketingConsent })
        .from(users)
        .where(sql`${users.mobile} LIKE ${'%' + last10Digits}`)
        .limit(1);

      return user?.marketingConsent === false;
    } catch (error) {
      console.error('Error checking opt-out status:', error);
      return true;
    }
  }

  async processOptOut(mobile: string): Promise<boolean> {
    try {
      const cleaned = mobile.replace(/\D/g, '');
      
      await db.update(users)
        .set({ marketingConsent: false })
        .where(sql`REPLACE(${users.mobile}, '+', '') LIKE ${'%' + cleaned.slice(-10)}`);

      console.log(`📵 User opted out: ${mobile.substring(0, 6)}***`);
      return true;
    } catch (error) {
      console.error('Error processing opt-out:', error);
      return false;
    }
  }

  async getStatus(): Promise<{
    configured: boolean;
    messagingServiceSid: string;
    fromNumber: string;
    capabilities: string[];
  }> {
    await this.ensureInitialized();
    return {
      configured: this.isConfigured,
      messagingServiceSid: this.messagingServiceSid ? `${this.messagingServiceSid.substring(0, 10)}...` : 'Not configured',
      fromNumber: this.fromNumber || 'Not configured',
      capabilities: this.isConfigured ? [
        'single_sms',
        'bulk_sms',
        'campaign_sms',
        'promotional_sms',
        'opt_out_management'
      ] : []
    };
  }

  /**
   * Returns a catalogue of available SMS template types for agent use.
   * Purpose: Provides UI with selectable template options without hitting the API.
   * Outputs: Array of template descriptors { type, label, description, variables }
   */
  getAvailableTemplates(): Array<{
    type: string;
    label: string;
    description: string;
    variables: string[];
  }> {
    return [
      {
        type: 'portfolio_update',
        label: 'Portfolio Update',
        description: 'Notify client of portfolio value change',
        variables: ['clientName', 'portfolioValue', 'changePercent'],
      },
      {
        type: 'investment_opportunity',
        label: 'Investment Opportunity',
        description: 'Alert client about a new investment product',
        variables: ['clientName', 'productName', 'returnPercent'],
      },
      {
        type: 'sip_reminder',
        label: 'SIP Reminder',
        description: 'Remind client about upcoming SIP deduction',
        variables: ['clientName', 'sipAmount', 'sipDate'],
      },
      {
        type: 'kyc_reminder',
        label: 'KYC Reminder',
        description: 'Remind client to complete KYC verification',
        variables: ['clientName', 'deadlineDate'],
      },
      {
        type: 'meeting_reminder',
        label: 'Meeting Reminder',
        description: 'Remind client about scheduled advisory meeting',
        variables: ['clientName', 'meetingDate', 'meetingTime'],
      },
      {
        type: 'custom',
        label: 'Custom Message',
        description: 'Send a custom message to the client',
        variables: [],
      },
    ];
  }

  /**
   * Higher-level method that resolves a template type and sends an SMS.
   * Purpose: Bridge for routes that need template-based or custom messaging.
   * Inputs:
   *   - mobile: recipient mobile number
   *   - templateType: key from getAvailableTemplates()
   *   - variables: template variable substitution map
   *   - customMessage: override message (used when templateType is 'custom')
   * Outputs: SMSMarketingResult
   * Edge cases: Falls back to sendMarketingSMS for unknown template types.
   */
  async sendMarketingMessage(
    mobile: string,
    templateType: string,
    variables: Record<string, any> = {},
    customMessage?: string
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    if (templateType === 'custom' || (!templateType && customMessage)) {
      return this.sendMarketingSMS(mobile, customMessage || '', undefined, false);
    }

    // For template-based sends, delegate to sendPromotionalSMS
    return this.sendPromotionalSMS(mobile, templateType, variables);
  }
}


export const smsMarketingService = new SMSMarketingService();
