import { getTwilioClient, getTwilioFromPhoneNumber, isTwilioConfigured } from './twilio-client';
import { db } from '../db';
import { whatsappContacts } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

interface WhatsAppTemplateMessage {
  to: string;
  templateSid: string;
  templateVariables?: Record<string, string>;
}

interface WhatsAppTemplateConfig {
  contentSid: string;
  contentVariables?: Record<string, string>;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  welcome: process.env.TWILIO_WHATSAPP_WELCOME_TEMPLATE || '',
  order_update: process.env.TWILIO_WHATSAPP_ORDER_TEMPLATE || '',
  kyc_update: process.env.TWILIO_WHATSAPP_KYC_TEMPLATE || '',
  otp: process.env.TWILIO_WHATSAPP_OTP_TEMPLATE || '',
  notification: process.env.TWILIO_WHATSAPP_NOTIFICATION_TEMPLATE || '',
};

class TwilioWhatsAppService {
  private messagingServiceSid: string = '';
  private whatsappNumber: string = '';

  constructor() {
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
    const whatsappNum = process.env.TWILIO_WHATSAPP_NUMBER;
    if (whatsappNum) {
      this.whatsappNumber = whatsappNum.startsWith('whatsapp:') 
        ? whatsappNum 
        : `whatsapp:${whatsappNum}`;
    }
    console.log('📱 WhatsApp service initialized (using Replit Twilio connector)');
    if (this.messagingServiceSid) {
      console.log(`   Messaging Service SID: ${this.messagingServiceSid.substring(0, 10)}...`);
    }
    if (this.whatsappNumber) {
      console.log(`   WhatsApp number: ${this.whatsappNumber}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    return await isTwilioConfigured();
  }

  private formatWhatsAppNumber(mobile: string): string {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `whatsapp:+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `whatsapp:+91${cleaned}`;
    }
    return `whatsapp:+${cleaned}`;
  }

  private normalizePhoneForDb(mobile: string): string {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  }

  async hasUserInitiatedContact(phoneNumber: string): Promise<boolean> {
    try {
      const normalizedPhone = this.normalizePhoneForDb(phoneNumber);
      const [contact] = await db.select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.phoneNumber, normalizedPhone))
        .limit(1);
      
      return contact?.hasInitiatedContact ?? false;
    } catch (error) {
      console.error('Error checking WhatsApp contact status:', error);
      return false;
    }
  }

  async sendMessage(to: string, body: string, mediaUrl?: string, templateType?: string): Promise<{ success: boolean; messageSid?: string; error?: string; usedTemplate?: boolean }> {
    const isConfigured = await isTwilioConfigured();
    if (!isConfigured) {
      console.log(`📱 WhatsApp message to ${to.substring(0, 6)}****: ${body.substring(0, 50)}... (not configured)`);
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const toNumber = this.formatWhatsAppNumber(to);
      const hasContact = await this.hasUserInitiatedContact(to);

      if (hasContact) {
        return this.sendFreeformMessage(toNumber, body, mediaUrl);
      } else {
        const templateSid = templateType ? DEFAULT_TEMPLATES[templateType] : DEFAULT_TEMPLATES.notification;
        if (templateSid) {
          return this.sendTemplateMessage(toNumber, templateSid, { body });
        } else {
          console.log(`⚠️ No template configured for ${templateType || 'notification'}, falling back to freeform message...`);
          return this.sendFreeformMessage(toNumber, body, mediaUrl);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to send WhatsApp message:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async sendFreeformMessage(toNumber: string, body: string, mediaUrl?: string): Promise<{ success: boolean; messageSid?: string; error?: string; usedTemplate?: boolean }> {
    try {
      const client = await getTwilioClient();
      const fromNumber = this.whatsappNumber || (await getTwilioFromPhoneNumber());
      
      const messageOptions: any = {
        body,
        to: toNumber,
      };

      if (fromNumber) {
        messageOptions.from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
      }

      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }

      console.log(`📱 Sending freeform WhatsApp message to ${toNumber.substring(0, 15)}***`);

      const message = await client.messages.create(messageOptions);
      console.log(`✅ WhatsApp freeform message sent - SID: ${message.sid}`);
      
      return { success: true, messageSid: message.sid, usedTemplate: false };
    } catch (error: any) {
      console.error('❌ Failed to send freeform WhatsApp message:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendTemplateMessage(toNumber: string, contentSid: string, variables?: Record<string, string>): Promise<{ success: boolean; messageSid?: string; error?: string; usedTemplate?: boolean }> {
    try {
      const client = await getTwilioClient();
      const fromNumber = this.whatsappNumber || (await getTwilioFromPhoneNumber());
      
      const messageOptions: any = {
        to: toNumber,
        contentSid: contentSid,
      };

      if (fromNumber) {
        messageOptions.from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
      }

      if (variables && Object.keys(variables).length > 0) {
        messageOptions.contentVariables = JSON.stringify(variables);
      }

      console.log(`📱 Sending template WhatsApp message to ${toNumber.substring(0, 15)}*** (template: ${contentSid})`);

      const message = await client.messages.create(messageOptions);
      console.log(`✅ WhatsApp template message sent - SID: ${message.sid}`);
      
      return { success: true, messageSid: message.sid, usedTemplate: true };
    } catch (error: any) {
      console.error('❌ Failed to send template WhatsApp message:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendMessageForced(to: string, body: string, useTemplate: boolean = false, templateSid?: string, templateVars?: Record<string, string>): Promise<{ success: boolean; messageSid?: string; error?: string; usedTemplate?: boolean }> {
    const isConfigured = await isTwilioConfigured();
    if (!isConfigured) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    const toNumber = this.formatWhatsAppNumber(to);

    if (useTemplate && templateSid) {
      return this.sendTemplateMessage(toNumber, templateSid, templateVars);
    } else {
      return this.sendFreeformMessage(toNumber, body);
    }
  }

  async sendPortfolioAlert(to: string, alertType: string, details: Record<string, any>): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    let body = '';
    
    switch (alertType) {
      case 'price_alert':
        body = `📈 *FintekPro Price Alert*\n\n${details.symbol} has reached ₹${details.price}\n\nTarget: ₹${details.target}\nChange: ${details.changePercent}%`;
        break;
      case 'portfolio_update':
        body = `📊 *FintekPro Portfolio Update*\n\nYour portfolio value: ₹${details.totalValue}\nToday's change: ${details.dayChange}%\n\nTop gainer: ${details.topGainer}\nTop loser: ${details.topLoser}`;
        break;
      case 'dividend':
        body = `💰 *FintekPro Dividend Alert*\n\n${details.companyName} has announced a dividend of ₹${details.amount} per share.\n\nEx-date: ${details.exDate}\nRecord date: ${details.recordDate}`;
        break;
      case 'ipo_alert':
        body = `🎯 *FintekPro IPO Alert*\n\n${details.companyName} IPO opens on ${details.openDate}\n\nPrice band: ₹${details.priceMin} - ₹${details.priceMax}\nLot size: ${details.lotSize} shares`;
        break;
      case 'order_confirmation':
        body = `✅ *FintekPro Order Confirmed*\n\nOrder ID: ${details.orderId}\n${details.type} ${details.quantity} ${details.symbol} @ ₹${details.price}\n\nTotal: ₹${details.total}`;
        break;
      case 'kyc_update':
        body = `🔐 *FintekPro KYC Update*\n\nYour KYC status has been updated to: ${details.status}\n\n${details.message || 'You can now access additional features.'}`;
        break;
      default:
        body = `📢 *FintekPro Notification*\n\n${details.message || 'You have a new notification from FintekPro.'}`;
    }

    return this.sendMessage(to, body);
  }

  async sendOTP(to: string, otp: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const body = `🔐 *FintekPro Verification*\n\nYour OTP is: *${otp}*\n\nValid for 5 minutes. Do not share this code with anyone.`;
    return this.sendMessage(to, body);
  }

  async sendLoginOTP(mobile: string, otp: string): Promise<boolean> {
    const result = await this.sendOTP(mobile, otp);
    return result.success;
  }

  async sendWelcomeMessage(to: string, userName: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const body = `👋 Welcome to *FintekPro*, ${userName}!\n\nYour trusted partner for:\n📈 Stock & Mutual Fund investments\n💼 Portfolio management\n📊 Market insights\n🔐 Secure KYC verification\n\nReply HELP for assistance or visit our app to get started.`;
    return this.sendMessage(to, body);
  }
}

export const twilioWhatsAppService = new TwilioWhatsAppService();
