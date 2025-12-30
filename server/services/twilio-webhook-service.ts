import twilio from 'twilio';
import { Request, Response, Router } from 'express';
import { db } from '../db';
import { users, userNotifications } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { twilioWhatsAppService } from './twilio-whatsapp-service';
import { smsService } from './sms-service';

interface IncomingMessage {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

interface MessageLogEntry {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: 'sms' | 'whatsapp';
  from: string;
  to: string;
  body: string;
  messageSid: string;
  timestamp: Date;
  userId?: string;
  processed: boolean;
}

class TwilioWebhookService {
  private authToken: string;
  private isConfigured: boolean;
  private messageLogs: MessageLogEntry[] = [];

  constructor() {
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.isConfigured = !!(process.env.TWILIO_ACCOUNT_SID && this.authToken);
    
    if (this.isConfigured) {
      console.log('✅ Twilio Webhook Service initialized');
    } else {
      console.log('⚠️ Twilio Webhook Service not configured - missing credentials');
    }
  }

  validateRequest(req: Request): boolean {
    if (!this.isConfigured || !this.authToken) {
      console.warn('⚠️ Twilio webhook validation skipped - not configured');
      return true;
    }

    const signature = req.headers['x-twilio-signature'] as string;
    if (!signature) {
      console.warn('⚠️ Missing Twilio signature header');
      return false;
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const url = `${protocol}://${host}${req.originalUrl}`;

    try {
      const isValid = twilio.validateRequest(
        this.authToken,
        signature,
        url,
        req.body
      );

      if (!isValid) {
        console.warn('⚠️ Invalid Twilio signature');
      }

      return isValid;
    } catch (error) {
      console.error('Error validating Twilio request:', error);
      return false;
    }
  }

  private extractPhoneNumber(twilioNumber: string): string {
    return twilioNumber.replace(/^(whatsapp:|tel:|\+)/gi, '');
  }

  private async findUserByPhone(phoneNumber: string): Promise<any | null> {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const variants = [
      cleaned,
      cleaned.startsWith('91') ? cleaned.slice(2) : cleaned,
      `+${cleaned}`,
      `+91${cleaned.length === 10 ? cleaned : ''}`,
    ].filter(v => v.length >= 10);

    try {
      for (const variant of variants) {
        const [user] = await db.select().from(users).where(eq(users.mobile, variant)).limit(1);
        if (user) return user;
      }
    } catch (error) {
      console.error('Error finding user by phone:', error);
    }
    return null;
  }

  private parseCommand(body: string): { command: string; args: string[] } {
    const trimmed = body.trim().toUpperCase();
    const parts = trimmed.split(/\s+/);
    return {
      command: parts[0] || '',
      args: parts.slice(1),
    };
  }

  async handleIncomingSMS(message: IncomingMessage): Promise<string> {
    const phoneNumber = this.extractPhoneNumber(message.From);
    const user = await this.findUserByPhone(phoneNumber);
    const { command, args } = this.parseCommand(message.Body);

    this.logMessage({
      id: message.MessageSid,
      direction: 'inbound',
      channel: 'sms',
      from: message.From,
      to: message.To,
      body: message.Body,
      messageSid: message.MessageSid,
      timestamp: new Date(),
      userId: user?.id,
      processed: true,
    });

    console.log(`📥 Incoming SMS from ${phoneNumber}: ${message.Body.substring(0, 50)}...`);

    return this.generateResponse(command, args, user, 'sms');
  }

  async handleIncomingWhatsApp(message: IncomingMessage): Promise<string> {
    const phoneNumber = this.extractPhoneNumber(message.From);
    const user = await this.findUserByPhone(phoneNumber);
    const { command, args } = this.parseCommand(message.Body);

    this.logMessage({
      id: message.MessageSid,
      direction: 'inbound',
      channel: 'whatsapp',
      from: message.From,
      to: message.To,
      body: message.Body,
      messageSid: message.MessageSid,
      timestamp: new Date(),
      userId: user?.id,
      processed: true,
    });

    console.log(`📥 Incoming WhatsApp from ${phoneNumber}: ${message.Body.substring(0, 50)}...`);

    return this.generateResponse(command, args, user, 'whatsapp');
  }

  private async generateResponse(
    command: string,
    args: string[],
    user: any | null,
    channel: 'sms' | 'whatsapp'
  ): Promise<string> {
    const greeting = user ? `Hi ${user.firstName || 'there'}` : 'Hi there';

    switch (command) {
      case 'HELP':
      case 'HI':
      case 'HELLO':
        return this.getHelpMessage(greeting, channel);

      case 'STATUS':
        if (!user) return this.getNotRegisteredMessage();
        return this.getAccountStatus(user);

      case 'PORTFOLIO':
      case 'PF':
        if (!user) return this.getNotRegisteredMessage();
        return this.getPortfolioSummary(user);

      case 'KYC':
        if (!user) return this.getNotRegisteredMessage();
        return this.getKYCStatus(user);

      case 'ORDERS':
        if (!user) return this.getNotRegisteredMessage();
        return this.getRecentOrders(user);

      case 'ALERTS':
        if (!user) return this.getNotRegisteredMessage();
        return this.getAlertSettings(user);

      case 'STOP':
        return this.handleOptOut(user);

      case 'START':
        return this.handleOptIn(user);

      default:
        if (/^\d{6}$/.test(command)) {
          return 'Your verification code has been received. Please complete the login process in the app.';
        }
        return this.getHelpMessage(greeting, channel);
    }
  }

  private getHelpMessage(greeting: string, channel: 'sms' | 'whatsapp'): string {
    const emoji = channel === 'whatsapp';
    const bullet = emoji ? '📌' : '-';
    
    return `${greeting}! ${emoji ? '👋' : ''} Welcome to FintekPro.

Available commands:
${bullet} STATUS - Check your account status
${bullet} PORTFOLIO or PF - View portfolio summary
${bullet} KYC - Check KYC verification status
${bullet} ORDERS - View recent orders
${bullet} ALERTS - Manage price alerts
${bullet} STOP - Opt out of notifications
${bullet} START - Opt in to notifications
${bullet} HELP - Show this menu

${emoji ? '📱' : ''} Visit https://fintekpro.com for full features.`;
  }

  private getNotRegisteredMessage(): string {
    return `Your phone number is not registered with FintekPro.

Please sign up at https://fintekpro.com or contact support for assistance.`;
  }

  private async getAccountStatus(user: any): Promise<string> {
    return `📊 *Account Status*

Name: ${user.firstName} ${user.lastName || ''}
Email: ${user.email || 'Not set'}
Mobile: ${user.mobile}
KYC Status: ${user.kycStatus || 'Pending'}
Account Type: ${user.accountType || 'Standard'}

Reply HELP for more options.`;
  }

  private async getPortfolioSummary(user: any): Promise<string> {
    return `📈 *Portfolio Summary*

Your portfolio details are available in the FintekPro app.

For real-time updates and detailed analytics, please log in to your account at https://fintekpro.com

Reply HELP for more options.`;
  }

  private async getKYCStatus(user: any): Promise<string> {
    const status = user.kycStatus || 'pending';
    const tier = user.kycTier || 'basic';
    
    let statusMessage = '';
    switch (status.toLowerCase()) {
      case 'verified':
        statusMessage = '✅ Your KYC is verified!';
        break;
      case 'pending':
        statusMessage = '⏳ Your KYC is pending verification.';
        break;
      case 'rejected':
        statusMessage = '❌ Your KYC was rejected. Please resubmit.';
        break;
      default:
        statusMessage = '📋 KYC status: ' + status;
    }

    return `🔐 *KYC Status*

${statusMessage}
KYC Tier: ${tier.charAt(0).toUpperCase() + tier.slice(1)}

To complete or update your KYC, visit https://fintekpro.com/kyc

Reply HELP for more options.`;
  }

  private async getRecentOrders(user: any): Promise<string> {
    return `📋 *Recent Orders*

Your order history is available in the FintekPro app.

To view detailed order status and history, please log in at https://fintekpro.com/orders

Reply HELP for more options.`;
  }

  private async getAlertSettings(user: any): Promise<string> {
    return `🔔 *Alert Settings*

Manage your price alerts and notification preferences in the FintekPro app.

Visit https://fintekpro.com/alerts to configure your alerts.

Reply STOP to opt out of all notifications.
Reply HELP for more options.`;
  }

  private handleOptOut(user: any): string {
    console.log(`📵 User ${user?.id || 'unknown'} opted out of notifications`);
    return `You have been unsubscribed from FintekPro notifications.

Reply START to re-subscribe at any time.`;
  }

  private handleOptIn(user: any): string {
    console.log(`📲 User ${user?.id || 'unknown'} opted in to notifications`);
    return `Welcome back! You are now subscribed to FintekPro notifications.

Reply HELP for available commands.`;
  }

  private logMessage(entry: MessageLogEntry): void {
    this.messageLogs.push(entry);
    if (this.messageLogs.length > 1000) {
      this.messageLogs = this.messageLogs.slice(-500);
    }
  }

  getMessageLogs(limit: number = 50): MessageLogEntry[] {
    return this.messageLogs.slice(-limit);
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

export const twilioWebhookService = new TwilioWebhookService();

export function createTwilioWebhookRouter(): Router {
  const router = Router();

  router.post('/sms/webhook', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production' && !twilioWebhookService.validateRequest(req)) {
        console.warn('⚠️ Rejected invalid Twilio SMS webhook request');
        return res.status(403).send('Forbidden');
      }

      const message: IncomingMessage = req.body;
      const response = await twilioWebhookService.handleIncomingSMS(message);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(response)}</Message>
</Response>`;

      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error handling SMS webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.post('/whatsapp/webhook', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production' && !twilioWebhookService.validateRequest(req)) {
        console.warn('⚠️ Rejected invalid Twilio WhatsApp webhook request');
        return res.status(403).send('Forbidden');
      }

      const message: IncomingMessage = req.body;
      const response = await twilioWebhookService.handleIncomingWhatsApp(message);

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(response)}</Message>
</Response>`;

      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error handling WhatsApp webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.get('/status', (req: Request, res: Response) => {
    res.json({
      configured: twilioWebhookService.isAvailable(),
      endpoints: {
        sms: '/api/twilio/sms/webhook',
        whatsapp: '/api/twilio/whatsapp/webhook',
      },
      recentMessages: twilioWebhookService.getMessageLogs(10).map(m => ({
        direction: m.direction,
        channel: m.channel,
        from: m.from.substring(0, 10) + '***',
        timestamp: m.timestamp,
        processed: m.processed,
      })),
    });
  });

  router.get('/logs', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({
      logs: twilioWebhookService.getMessageLogs(limit),
    });
  });

  return router;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
