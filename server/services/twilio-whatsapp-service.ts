import twilio from 'twilio';

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

class TwilioWhatsAppService {
  private client: any;
  private fromNumber: string = '';
  private messagingServiceSid: string = '';
  private isConfigured: boolean;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (accountSid && authToken && (whatsappNumber || messagingServiceSid)) {
      this.client = twilio(accountSid, authToken);
      this.messagingServiceSid = messagingServiceSid || '';
      if (whatsappNumber) {
        this.fromNumber = whatsappNumber.startsWith('whatsapp:') 
          ? whatsappNumber 
          : `whatsapp:${whatsappNumber}`;
      }
      this.isConfigured = true;
      console.log('✅ Twilio WhatsApp service initialized');
      if (this.messagingServiceSid) {
        console.log(`   Using Messaging Service: ${this.messagingServiceSid.substring(0, 10)}...`);
      }
      if (this.fromNumber) {
        console.log(`   From number: ${this.fromNumber}`);
      }
    } else {
      this.isConfigured = false;
      console.log('⚠️ Twilio WhatsApp service not configured - missing credentials');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
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

  async sendMessage(to: string, body: string, mediaUrl?: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    if (!this.isConfigured) {
      console.log(`📱 WhatsApp message to ${to.substring(0, 6)}****: ${body.substring(0, 50)}... (not configured)`);
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const toNumber = this.formatWhatsAppNumber(to);
      
      const messageOptions: any = {
        body,
        to: toNumber,
      };

      // For WhatsApp, use the from number directly (Messaging Service SID doesn't work well with WhatsApp)
      if (this.fromNumber) {
        messageOptions.from = this.fromNumber;
      }

      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }

      console.log(`📱 Sending WhatsApp message to ${toNumber.substring(0, 15)}***`);
      console.log(`   Options: ${JSON.stringify({ ...messageOptions, body: body.substring(0, 30) + '...' })}`);

      const message = await this.client.messages.create(messageOptions);
      console.log(`✅ WhatsApp message sent to ${toNumber.substring(0, 15)}*** - SID: ${message.sid}`);
      
      return { success: true, messageSid: message.sid };
    } catch (error: any) {
      console.error('❌ Failed to send WhatsApp message:', error.message);
      return { success: false, error: error.message };
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

  async sendWelcomeMessage(to: string, userName: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const body = `👋 Welcome to *FintekPro*, ${userName}!\n\nYour trusted partner for:\n📈 Stock & Mutual Fund investments\n💼 Portfolio management\n📊 Market insights\n🔐 Secure KYC verification\n\nReply HELP for assistance or visit our app to get started.`;
    return this.sendMessage(to, body);
  }
}

export const twilioWhatsAppService = new TwilioWhatsAppService();
