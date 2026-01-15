import twilio from 'twilio';
import { Request, Response, Router } from 'express';
import { db } from '../db';
import { users, userNotifications, whatsappContacts, inboundMessages } from '@shared/schema';
import { eq, sql, desc, and, gte, lte, like } from 'drizzle-orm';
import { twilioWhatsAppService } from './twilio-whatsapp-service';
import { smsService } from './sms-service';
import { requireAdmin } from '../middleware/roleMiddleware';

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

  private normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  }

  async markWhatsAppContact(phoneNumber: string, userId?: string): Promise<void> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    try {
      const [existing] = await db.select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.phoneNumber, normalizedPhone))
        .limit(1);

      if (existing) {
        await db.update(whatsappContacts)
          .set({
            hasInitiatedContact: true,
            lastMessageAt: new Date(),
            messageCount: existing.messageCount + 1,
            updatedAt: new Date(),
            ...(userId && !existing.userId ? { userId } : {}),
          })
          .where(eq(whatsappContacts.phoneNumber, normalizedPhone));
        console.log(`📱 Updated WhatsApp contact: ${normalizedPhone}`);
      } else {
        await db.insert(whatsappContacts).values({
          phoneNumber: normalizedPhone,
          userId: userId || null,
          hasInitiatedContact: true,
          firstContactAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 1,
        });
        console.log(`📱 Created WhatsApp contact: ${normalizedPhone}`);
      }
    } catch (error) {
      console.error('Error marking WhatsApp contact:', error);
    }
  }

  async hasWhatsAppContact(phoneNumber: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    
    try {
      const [contact] = await db.select()
        .from(whatsappContacts)
        .where(eq(whatsappContacts.phoneNumber, normalizedPhone))
        .limit(1);
      
      return contact?.hasInitiatedContact ?? false;
    } catch (error) {
      console.error('Error checking WhatsApp contact:', error);
      return false;
    }
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

    // Generate auto-reply response
    const autoReply = await this.generateResponse(command, args, user, 'sms');

    // Save to database
    await this.saveInboundMessage({
      messageSid: message.MessageSid,
      channel: 'sms',
      direction: 'inbound',
      fromNumber: message.From,
      toNumber: message.To,
      body: message.Body,
      numMedia: parseInt(message.NumMedia || '0'),
      mediaUrls: message.MediaUrl0 ? [message.MediaUrl0] : [],
      userId: user?.id,
      parsedCommand: command || null,
      commandArgs: args.length > 0 ? args : null,
      autoReplyResponse: autoReply,
      processed: true,
    });

    // Also keep in-memory log for quick access
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

    return autoReply;
  }

  async handleIncomingWhatsApp(message: IncomingMessage): Promise<string> {
    const phoneNumber = this.extractPhoneNumber(message.From);
    const user = await this.findUserByPhone(phoneNumber);
    const { command, args } = this.parseCommand(message.Body);

    await this.markWhatsAppContact(phoneNumber, user?.id);

    // Generate auto-reply response
    const autoReply = await this.generateResponse(command, args, user, 'whatsapp');

    // Save to database
    await this.saveInboundMessage({
      messageSid: message.MessageSid,
      channel: 'whatsapp',
      direction: 'inbound',
      fromNumber: message.From,
      toNumber: message.To,
      body: message.Body,
      numMedia: parseInt(message.NumMedia || '0'),
      mediaUrls: message.MediaUrl0 ? [message.MediaUrl0] : [],
      userId: user?.id,
      parsedCommand: command || null,
      commandArgs: args.length > 0 ? args : null,
      autoReplyResponse: autoReply,
      processed: true,
    });

    // Also keep in-memory log for quick access
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

    return autoReply;
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

  private async saveInboundMessage(data: {
    messageSid: string;
    channel: string;
    direction: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    numMedia?: number;
    mediaUrls?: string[];
    userId?: string;
    parsedCommand?: string | null;
    commandArgs?: string[] | null;
    autoReplyResponse?: string;
    processed?: boolean;
  }): Promise<void> {
    try {
      await db.insert(inboundMessages).values({
        messageSid: data.messageSid,
        channel: data.channel,
        direction: data.direction,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        body: data.body,
        numMedia: data.numMedia || 0,
        mediaUrls: data.mediaUrls || [],
        userId: data.userId || null,
        parsedCommand: data.parsedCommand || null,
        commandArgs: data.commandArgs || [],
        autoReplyResponse: data.autoReplyResponse || null,
        processed: data.processed ?? false,
        isRead: false,
        receivedAt: new Date(),
      });
      console.log(`💾 Saved inbound ${data.channel} message from ${data.fromNumber}`);
    } catch (error) {
      console.error('Error saving inbound message to database:', error);
    }
  }

  async getInboundMessages(options: {
    channel?: string;
    fromNumber?: string;
    isRead?: boolean;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ messages: any[]; total: number }> {
    const { channel, fromNumber, isRead, limit = 50, offset = 0, startDate, endDate } = options;

    try {
      const conditions = [];
      
      if (channel) {
        conditions.push(eq(inboundMessages.channel, channel));
      }
      if (fromNumber) {
        conditions.push(like(inboundMessages.fromNumber, `%${fromNumber}%`));
      }
      if (isRead !== undefined) {
        conditions.push(eq(inboundMessages.isRead, isRead));
      }
      if (startDate) {
        conditions.push(gte(inboundMessages.receivedAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(inboundMessages.receivedAt, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [messages, countResult] = await Promise.all([
        db.select()
          .from(inboundMessages)
          .where(whereClause)
          .orderBy(desc(inboundMessages.receivedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(inboundMessages)
          .where(whereClause),
      ]);

      return {
        messages,
        total: countResult[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error fetching inbound messages:', error);
      return { messages: [], total: 0 };
    }
  }

  async markMessageAsRead(messageId: string, readBy: string): Promise<boolean> {
    try {
      await db.update(inboundMessages)
        .set({ 
          isRead: true, 
          readAt: new Date(),
          readBy: readBy,
        })
        .where(eq(inboundMessages.id, messageId));
      return true;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  async markAllAsRead(readBy: string): Promise<number> {
    try {
      // Get count of unread messages first
      const countResult = await db.select({ count: sql<number>`count(*)::int` })
        .from(inboundMessages)
        .where(eq(inboundMessages.isRead, false));
      const unreadCount = countResult[0]?.count || 0;
      
      if (unreadCount > 0) {
        await db.update(inboundMessages)
          .set({ 
            isRead: true, 
            readAt: new Date(),
            readBy: readBy,
          })
          .where(eq(inboundMessages.isRead, false));
      }
      
      return unreadCount;
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return 0;
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(inboundMessages)
        .where(eq(inboundMessages.isRead, false));
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async addAdminNote(messageId: string, note: string): Promise<boolean> {
    try {
      await db.update(inboundMessages)
        .set({ adminNotes: note })
        .where(eq(inboundMessages.id, messageId));
      return true;
    } catch (error) {
      console.error('Error adding admin note:', error);
      return false;
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

  const CALL_FORWARD_NUMBER = process.env.TWILIO_CALL_FORWARD_NUMBER || '+919686854321';

  router.post('/voice/webhook', async (req: Request, res: Response) => {
    try {
      console.log(`📞 Incoming voice call from ${req.body.From} to ${req.body.To}`);
      
      const callerNumber = req.body.From || 'Unknown';
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    Welcome to FintekPro. Please hold while we connect your call.
  </Say>
  <Dial callerId="${req.body.To}" timeout="30" action="/api/twilio/voice/status">
    <Number>${CALL_FORWARD_NUMBER}</Number>
  </Dial>
  <Say voice="alice" language="en-IN">
    We're sorry, we couldn't connect your call. Please try again later or contact us through our website at fintek pro dot com.
  </Say>
</Response>`;

      console.log(`📞 Forwarding call to ${CALL_FORWARD_NUMBER}`);
      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error handling voice webhook:', error);
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please try again later.</Say>
</Response>`);
    }
  });

  router.post('/voice/status', async (req: Request, res: Response) => {
    console.log(`📞 Call status update: ${req.body.CallStatus} for ${req.body.CallSid}`);
    
    if (req.body.DialCallStatus === 'no-answer' || req.body.DialCallStatus === 'busy') {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    We're sorry, no one is available to take your call right now. 
    Please leave a message after the beep, or call back later.
  </Say>
  <Record maxLength="120" action="/api/twilio/voice/recording" transcribe="true" />
</Response>`;
      res.type('text/xml').send(twiml);
    } else {
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
  });

  router.post('/voice/recording', async (req: Request, res: Response) => {
    console.log(`📞 Voicemail recorded: ${req.body.RecordingUrl}`);
    console.log(`   Duration: ${req.body.RecordingDuration}s, From: ${req.body.From}`);
    
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    Thank you for your message. We will get back to you shortly.
  </Say>
</Response>`);
  });

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

  // Admin routes for inbound message management (protected)
  router.get('/admin/messages', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { channel, fromNumber, isRead, limit, offset, startDate, endDate } = req.query;
      
      const result = await twilioWebhookService.getInboundMessages({
        channel: channel as string,
        fromNumber: fromNumber as string,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching inbound messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  router.get('/admin/messages/unread-count', requireAdmin, async (req: Request, res: Response) => {
    try {
      const count = await twilioWebhookService.getUnreadCount();
      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  router.post('/admin/messages/:messageId/read', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const readBy = req.body.readBy || 'admin';
      
      const success = await twilioWebhookService.markMessageAsRead(messageId, readBy);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to mark message as read' });
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  });

  router.post('/admin/messages/mark-all-read', requireAdmin, async (req: Request, res: Response) => {
    try {
      const readBy = req.body.readBy || 'admin';
      const count = await twilioWebhookService.markAllAsRead(readBy);
      res.json({ success: true, markedCount: count });
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  router.post('/admin/messages/:messageId/note', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      const { note } = req.body;
      
      if (!note) {
        return res.status(400).json({ error: 'Note is required' });
      }
      
      const success = await twilioWebhookService.addAdminNote(messageId, note);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to add note' });
      }
    } catch (error) {
      console.error('Error adding admin note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
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
