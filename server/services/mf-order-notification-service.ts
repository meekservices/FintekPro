import { smsService } from './sms-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';

interface MfOrderNotificationData {
  orderId: string;
  orderReference: string;
  userId: string;
  schemeName: string;
  orderType: string;
  amount: string;
  status: string;
  previousStatus?: string;
  navApplied?: string;
  unitsAllotted?: string;
  settlementDate?: string;
}

interface ProposalNotificationData {
  proposalId: string;
  userId: string;
  proposalTitle: string;
  totalAmount: string;
  status: string;
  proposalSource: string;
  aiInsight?: string;
  agentNote?: string;
}

class MfOrderNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured: boolean = false;
  private fromEmail: string = 'noreply@fintekpro.com';

  constructor() {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.isEmailConfigured = true;
      console.log('✅ MF Order Notification email service configured');
    } else {
      console.log('⚠️ MF Order Notification email not configured - missing SMTP credentials');
    }
  }

  private getOrderStatusMessage(status: string): { title: string; description: string; emoji: string } {
    switch (status.toLowerCase()) {
      case 'created':
      case 'pending_payment':
        return { 
          title: 'Order Created',
          description: 'Your mutual fund order has been created. Complete payment to proceed.',
          emoji: '📝'
        };
      case 'placed':
        return { 
          title: 'Order Placed',
          description: 'Your order has been placed and is being processed.',
          emoji: '✅'
        };
      case 'confirmed':
        return { 
          title: 'Order Confirmed',
          description: 'Your payment has been confirmed. NAV will be applied on the next business day.',
          emoji: '🎯'
        };
      case 'settled':
        return { 
          title: 'Units Allotted',
          description: 'Your mutual fund units have been allotted and added to your portfolio.',
          emoji: '🎉'
        };
      case 'reconciled':
        return { 
          title: 'Order Completed',
          description: 'Your order has been successfully reconciled with the AMC.',
          emoji: '✨'
        };
      case 'failed':
      case 'rejected':
        return { 
          title: 'Order Failed',
          description: 'Your order could not be processed. Please contact support.',
          emoji: '❌'
        };
      case 'cancelled':
        return { 
          title: 'Order Cancelled',
          description: 'Your order has been cancelled as requested.',
          emoji: '🚫'
        };
      default:
        return { 
          title: 'Order Update',
          description: `Your order status has been updated to: ${status}`,
          emoji: '📋'
        };
    }
  }

  private getProposalStatusMessage(status: string): { title: string; description: string; emoji: string } {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          title: 'New Proposal',
          description: 'A new investment proposal is ready for your review.',
          emoji: '📊'
        };
      case 'approved':
        return {
          title: 'Proposal Approved',
          description: 'Your proposal has been approved and added to your cart.',
          emoji: '✅'
        };
      case 'in_cart':
        return {
          title: 'Added to Cart',
          description: 'Your approved proposal is now in your cart. Proceed to checkout.',
          emoji: '🛒'
        };
      case 'executed':
        return {
          title: 'Proposal Executed',
          description: 'Your investment has been successfully executed.',
          emoji: '🎉'
        };
      case 'rejected':
        return {
          title: 'Proposal Rejected',
          description: 'The investment proposal has been declined.',
          emoji: '❌'
        };
      default:
        return {
          title: 'Proposal Update',
          description: `Your proposal status has been updated to: ${status}`,
          emoji: '📋'
        };
    }
  }

  async sendOrderNotification(data: MfOrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    const results = { email: false, sms: false };

    try {
      const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
      
      if (!user) {
        console.warn(`User not found for MF order notification: ${data.userId}`);
        return results;
      }

      const statusInfo = this.getOrderStatusMessage(data.status);

      if (user.email && this.isEmailConfigured) {
        try {
          await this.sendOrderEmail(user.email, user.firstName || 'Investor', data, statusInfo);
          results.email = true;
        } catch (emailError) {
          console.error('Failed to send MF order email:', emailError);
        }
      }

      if (user.mobile) {
        try {
          const smsMessage = `${statusInfo.emoji} FintekPro: ${statusInfo.title} - ${data.schemeName}, Amount: ₹${data.amount}. Order: ${data.orderReference}`;
          await smsService.sendSMS(user.mobile, smsMessage);
          results.sms = true;
        } catch (smsError) {
          console.error('Failed to send MF order SMS:', smsError);
        }
      }

      console.log(`MF Order notification sent for ${data.orderReference}: Email=${results.email}, SMS=${results.sms}`);
    } catch (error) {
      console.error('Error sending MF order notification:', error);
    }

    return results;
  }

  async sendProposalNotification(data: ProposalNotificationData): Promise<{ email: boolean; sms: boolean }> {
    const results = { email: false, sms: false };

    try {
      const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
      
      if (!user) {
        console.warn(`User not found for proposal notification: ${data.userId}`);
        return results;
      }

      const statusInfo = this.getProposalStatusMessage(data.status);

      if (user.email && this.isEmailConfigured) {
        try {
          await this.sendProposalEmail(user.email, user.firstName || 'Investor', data, statusInfo);
          results.email = true;
        } catch (emailError) {
          console.error('Failed to send proposal email:', emailError);
        }
      }

      if (user.mobile) {
        try {
          const sourceLabel = data.proposalSource === 'ai' ? '🤖 AI' : data.proposalSource === 'agent' ? '👤 Agent' : '📊';
          const smsMessage = `${statusInfo.emoji} FintekPro: ${statusInfo.title} - ${sourceLabel} Proposal: ${data.proposalTitle}. Amount: ₹${data.totalAmount}`;
          await smsService.sendSMS(user.mobile, smsMessage);
          results.sms = true;
        } catch (smsError) {
          console.error('Failed to send proposal SMS:', smsError);
        }
      }

      console.log(`Proposal notification sent for ${data.proposalId}: Email=${results.email}, SMS=${results.sms}`);
    } catch (error) {
      console.error('Error sending proposal notification:', error);
    }

    return results;
  }

  private async sendOrderEmail(
    toEmail: string, 
    userName: string, 
    data: MfOrderNotificationData, 
    statusInfo: { title: string; description: string; emoji: string }
  ): Promise<void> {
    if (!this.emailTransporter) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .status-badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin-bottom: 20px; }
          .order-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #6b7280; }
          .detail-value { font-weight: 600; color: #111827; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusInfo.emoji} ${statusInfo.title}</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>${statusInfo.description}</p>
            
            <div class="order-details">
              <div class="detail-row">
                <span class="detail-label">Order Reference</span>
                <span class="detail-value">${data.orderReference}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Scheme Name</span>
                <span class="detail-value">${data.schemeName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order Type</span>
                <span class="detail-value">${data.orderType.toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value">₹${data.amount}</span>
              </div>
              ${data.navApplied ? `
              <div class="detail-row">
                <span class="detail-label">NAV Applied</span>
                <span class="detail-value">₹${data.navApplied}</span>
              </div>
              ` : ''}
              ${data.unitsAllotted ? `
              <div class="detail-row">
                <span class="detail-label">Units Allotted</span>
                <span class="detail-value">${data.unitsAllotted}</span>
              </div>
              ` : ''}
              ${data.settlementDate ? `
              <div class="detail-row">
                <span class="detail-label">Settlement Date</span>
                <span class="detail-value">${data.settlementDate}</span>
              </div>
              ` : ''}
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">${data.status.toUpperCase()}</span>
              </div>
            </div>
            
            <p>Track your investment in the FintekPro app or website.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from FintekPro. Please do not reply.</p>
            <p>© 2024 FintekPro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailTransporter.sendMail({
      from: this.fromEmail,
      to: toEmail,
      subject: `${statusInfo.emoji} MF Order ${statusInfo.title} - ${data.orderReference}`,
      html,
    });
  }

  private async sendProposalEmail(
    toEmail: string,
    userName: string,
    data: ProposalNotificationData,
    statusInfo: { title: string; description: string; emoji: string }
  ): Promise<void> {
    if (!this.emailTransporter) return;

    const sourceLabel = data.proposalSource === 'ai' ? '🤖 AI-Generated' : 
                        data.proposalSource === 'agent' ? '👤 Agent Recommended' : 
                        '📊 Investment Proposal';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .source-badge { display: inline-block; background: #eef2ff; color: #4f46e5; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin-bottom: 20px; }
          .proposal-details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #6b7280; }
          .detail-value { font-weight: 600; color: #111827; }
          .insight-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .insight-box h4 { margin: 0 0 8px 0; color: #92400e; }
          .cta-button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusInfo.emoji} ${statusInfo.title}</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <span class="source-badge">${sourceLabel}</span>
            <p>${statusInfo.description}</p>
            
            <div class="proposal-details">
              <div class="detail-row">
                <span class="detail-label">Proposal Title</span>
                <span class="detail-value">${data.proposalTitle}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Total Investment</span>
                <span class="detail-value">₹${data.totalAmount}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">${data.status.toUpperCase()}</span>
              </div>
            </div>
            
            ${data.aiInsight ? `
            <div class="insight-box">
              <h4>🤖 AI Insight</h4>
              <p style="margin: 0; color: #78350f;">${data.aiInsight}</p>
            </div>
            ` : ''}
            
            ${data.agentNote ? `
            <div class="insight-box" style="background: #dbeafe; border-color: #3b82f6;">
              <h4 style="color: #1e40af;">👤 Agent Note</h4>
              <p style="margin: 0; color: #1e3a8a;">${data.agentNote}</p>
            </div>
            ` : ''}
            
            <p>Review and manage your proposals in the FintekPro app.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from FintekPro. Please do not reply.</p>
            <p>© 2024 FintekPro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailTransporter.sendMail({
      from: this.fromEmail,
      to: toEmail,
      subject: `${statusInfo.emoji} ${statusInfo.title} - ${data.proposalTitle}`,
      html,
    });
  }
}

export const mfOrderNotificationService = new MfOrderNotificationService();
