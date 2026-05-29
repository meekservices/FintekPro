import { smsService } from './sms-service';
import { twilioWhatsAppService } from './twilio-whatsapp-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { format } from 'date-fns';

interface MeetingNotificationData {
  bookingId: string;
  topic: string;
  description?: string;
  scheduledAt: Date;
  duration: number;
  timezone: string;
  joinLink?: string;
  startLink?: string;
  clientId: string;
  agentId: string;
  clientName?: string;
  agentName?: string;
}

type NotificationType = 'scheduled' | 'approved' | 'cancelled' | 'reminder' | 'rescheduled' | 'completed';

class MeetingNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured: boolean = false;
  private fromEmail: string = 'meetings@fintekpro.com';

  constructor() {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT || '587';
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailHost && emailUser && emailPass) {
      this.emailTransporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort),
        secure: parseInt(emailPort) === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
      this.isEmailConfigured = true;
      console.log('✅ Meeting Notification email service configured');
    } else {
      console.log('⚠️ Meeting Notification email not configured');
    }
  }

  private formatDateTime(date: Date, timezone: string = 'Asia/Kolkata'): string {
    return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
  }

  private getNotificationContent(type: NotificationType, data: MeetingNotificationData, recipientType: 'client' | 'agent'): {
    subject: string;
    title: string;
    message: string;
    emoji: string;
  } {
    const formattedTime = this.formatDateTime(data.scheduledAt, data.timezone);
    const otherParty = recipientType === 'client' ? data.agentName || 'your advisor' : data.clientName || 'your client';

    switch (type) {
      case 'scheduled':
        return {
          subject: `Meeting Scheduled: ${data.topic}`,
          title: 'Meeting Scheduled',
          message: recipientType === 'client'
            ? `Your meeting "${data.topic}" with ${otherParty} has been scheduled for ${formattedTime}.`
            : `You have scheduled a meeting "${data.topic}" with ${otherParty} for ${formattedTime}.`,
          emoji: '📅'
        };
      case 'approved':
        return {
          subject: `Meeting Confirmed: ${data.topic}`,
          title: 'Meeting Request Approved',
          message: recipientType === 'client'
            ? `Great news! Your meeting request "${data.topic}" has been approved by ${otherParty}. The meeting is scheduled for ${formattedTime}.`
            : `You have approved the meeting request "${data.topic}" from ${otherParty}. Meeting scheduled for ${formattedTime}.`,
          emoji: '✅'
        };
      case 'rescheduled':
        return {
          subject: `Meeting Rescheduled: ${data.topic}`,
          title: 'Meeting Rescheduled',
          message: `Your meeting "${data.topic}" has been rescheduled to ${formattedTime}.`,
          emoji: '🔄'
        };
      case 'cancelled':
        return {
          subject: `Meeting Cancelled: ${data.topic}`,
          title: 'Meeting Cancelled',
          message: `Your meeting "${data.topic}" scheduled for ${formattedTime} has been cancelled.`,
          emoji: '❌'
        };
      case 'reminder':
        return {
          subject: `Reminder: Meeting in 30 minutes - ${data.topic}`,
          title: 'Meeting Reminder',
          message: `Your meeting "${data.topic}" with ${otherParty} starts in 30 minutes at ${formattedTime}.`,
          emoji: '⏰'
        };
      case 'completed':
        return {
          subject: `Meeting Completed: ${data.topic}`,
          title: 'Meeting Completed',
          message: `Your meeting "${data.topic}" with ${otherParty} has been marked as completed.`,
          emoji: '🎉'
        };
      default:
        return {
          subject: `Meeting Update: ${data.topic}`,
          title: 'Meeting Update',
          message: `There's an update regarding your meeting "${data.topic}".`,
          emoji: 'ℹ️'
        };
    }
  }

  private generateEmailHtml(
    content: { title: string; message: string; emoji: string },
    data: MeetingNotificationData,
    recipientType: 'client' | 'agent'
  ): string {
    const formattedTime = this.formatDateTime(data.scheduledAt, data.timezone);
    const joinLink = recipientType === 'agent' ? data.startLink : data.joinLink;
    const buttonText = recipientType === 'agent' ? 'Start Meeting' : 'Join Meeting';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .emoji { font-size: 48px; margin-bottom: 16px; }
          .content { padding: 30px; }
          .meeting-details { background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; align-items: flex-start; margin-bottom: 12px; }
          .detail-label { font-weight: 600; color: #6b7280; width: 100px; flex-shrink: 0; }
          .detail-value { color: #1f2937; }
          .button { display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 20px 30px; border-top: 1px solid #e5e7eb; }
          .calendar-links { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .calendar-links a { color: #3b82f6; text-decoration: none; margin-right: 16px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="emoji">${content.emoji}</div>
              <h1>${content.title}</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 24px;">${content.message}</p>
              
              <div class="meeting-details">
                <div class="detail-row">
                  <span class="detail-label">Topic</span>
                  <span class="detail-value">${data.topic}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">When</span>
                  <span class="detail-value">${formattedTime}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration</span>
                  <span class="detail-value">${data.duration} minutes</span>
                </div>
                ${data.description ? `
                <div class="detail-row">
                  <span class="detail-label">Details</span>
                  <span class="detail-value">${data.description}</span>
                </div>
                ` : ''}
              </div>
              
              ${joinLink ? `
              <div style="text-align: center;">
                <a href="${joinLink}" class="button">${buttonText}</a>
              </div>
              ` : ''}
              
              <div class="calendar-links">
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Add to calendar:</p>
                <a href="/api/meetings/${data.bookingId}/calendar.ics">Download .ics file</a>
              </div>
            </div>
            <div class="footer">
              <p>FintekPro - Your Trusted Financial Partner</p>
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateSmsText(
    content: { title: string; message: string },
    data: MeetingNotificationData,
    recipientType: 'client' | 'agent'
  ): string {
    const formattedTime = format(data.scheduledAt, "MMM d 'at' h:mm a");
    const joinLink = recipientType === 'agent' ? data.startLink : data.joinLink;
    
    let sms = `FintekPro: ${content.title} - "${data.topic}" on ${formattedTime}.`;
    if (joinLink) {
      sms += ` Join: ${joinLink}`;
    }
    return sms;
  }

  async sendNotification(
    type: NotificationType,
    data: MeetingNotificationData
  ): Promise<{ clientEmail: boolean; clientSms: boolean; clientWhatsApp: boolean; agentEmail: boolean; agentSms: boolean; agentWhatsApp: boolean }> {
    const results = { clientEmail: false, clientSms: false, clientWhatsApp: false, agentEmail: false, agentSms: false, agentWhatsApp: false };

    try {
      const [client] = await db.select().from(users).where(eq(users.id, data.clientId));
      const [agent] = await db.select().from(users).where(eq(users.id, data.agentId));

      if (!client || !agent) {
        console.log(`[Meeting Notification] User not found: client=${data.clientId}, agent=${data.agentId}`);
        return results;
      }

      const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.userId || 'Client';
      const agentName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.userId || 'Advisor';

      const notificationData = { ...data, clientName, agentName };

      const clientContent = this.getNotificationContent(type, notificationData, 'client');
      if (client.email) {
        results.clientEmail = await this.sendEmailNotification(
          client.email,
          clientContent.subject,
          this.generateEmailHtml(clientContent, notificationData, 'client')
        );
      }
      if (client.mobile) {
        results.clientSms = await this.sendSmsNotification(
          client.mobile,
          this.generateSmsText(clientContent, notificationData, 'client')
        );
        results.clientWhatsApp = await this.sendWhatsAppNotification(
          client.mobile,
          this.generateWhatsAppText(clientContent, notificationData, 'client')
        );
      }

      const agentContent = this.getNotificationContent(type, notificationData, 'agent');
      if (agent.email) {
        results.agentEmail = await this.sendEmailNotification(
          agent.email,
          agentContent.subject,
          this.generateEmailHtml(agentContent, notificationData, 'agent')
        );
      }
      if (agent.mobile) {
        results.agentSms = await this.sendSmsNotification(
          agent.mobile,
          this.generateSmsText(agentContent, notificationData, 'agent')
        );
        results.agentWhatsApp = await this.sendWhatsAppNotification(
          agent.mobile,
          this.generateWhatsAppText(agentContent, notificationData, 'agent')
        );
      }

      console.log(`[Meeting Notification] ${type} notification sent:`, results);
    } catch (error) {
      console.error(`[Meeting Notification] Error sending ${type} notification:`, error);
    }

    return results;
  }

  private async sendEmailNotification(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.emailTransporter) {
      console.log(`📧 [SIMULATED] Meeting email to: ${to} | Subject: ${subject}`);
      return false;
    }

    try {
      await this.emailTransporter.sendMail({
        from: `"FintekPro Meetings" <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      console.error(`[Meeting Notification] Email error:`, error);
      return false;
    }
  }

  private async sendSmsNotification(mobile: string, message: string): Promise<boolean> {
    try {
      const result = await (smsService as any).sendSMS({ to: mobile, message });
      return result.success;
    } catch (error) {
      console.error(`[Meeting Notification] SMS error:`, error);
      return false;
    }
  }

  private generateWhatsAppText(
    content: { title: string; message: string; emoji: string },
    data: MeetingNotificationData,
    recipientType: 'client' | 'agent'
  ): string {
    const formattedTime = format(data.scheduledAt, "EEEE, MMM d 'at' h:mm a");
    const joinLink = recipientType === 'agent' ? data.startLink : data.joinLink;
    
    let whatsappMsg = `${content.emoji} *${content.title}*\n\n`;
    whatsappMsg += `📌 *Topic:* ${data.topic}\n`;
    whatsappMsg += `📅 *When:* ${formattedTime}\n`;
    whatsappMsg += `⏱️ *Duration:* ${data.duration} minutes\n`;
    
    if (data.description) {
      whatsappMsg += `\n📝 ${data.description}\n`;
    }
    
    if (joinLink) {
      whatsappMsg += `\n🔗 *${recipientType === 'agent' ? 'Start' : 'Join'} Meeting:*\n${joinLink}`;
    }
    
    whatsappMsg += `\n\n_FintekPro - Your Trusted Financial Partner_`;
    
    return whatsappMsg;
  }

  private async sendWhatsAppNotification(mobile: string, message: string): Promise<boolean> {
    try {
      const isAvailable = await twilioWhatsAppService.isAvailable();
      if (!isAvailable) {
        console.log(`📱 [SIMULATED] WhatsApp meeting notification to: ${mobile.substring(0, 6)}****`);
        return false;
      }
      const result = await twilioWhatsAppService.sendMessage(mobile, message);
      return result.success;
    } catch (error) {
      console.error(`[Meeting Notification] WhatsApp error:`, error);
      return false;
    }
  }

  generateICalEvent(data: MeetingNotificationData): string {
    const startDate = new Date(data.scheduledAt);
    const endDate = new Date(startDate.getTime() + data.duration * 60 * 1000);
    
    const formatICalDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FintekPro//Meeting//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${data.bookingId}@fintekpro.com`,
      `DTSTAMP:${formatICalDate(new Date())}`,
      `DTSTART:${formatICalDate(startDate)}`,
      `DTEND:${formatICalDate(endDate)}`,
      `SUMMARY:${data.topic}`,
      `DESCRIPTION:${data.description || 'FintekPro Video Meeting'}\\n\\nJoin Link: ${data.joinLink || 'Will be provided'}`,
      `LOCATION:${data.joinLink || 'Online Meeting'}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Meeting reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return icalContent;
  }
}

export const meetingNotificationService = new MeetingNotificationService();
