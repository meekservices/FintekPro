import { smsService } from './sms-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';

interface OrderNotificationData {
  orderId: string;
  orderNumber: string;
  userId: string;
  bondName: string;
  bondType: string;
  quantity: number;
  amount: string;
  status: string;
  previousStatus?: string;
  settlementDate?: string;
}

class BondOrderNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured: boolean = false;
  private fromEmail: string = 'noreply@fintekpro.com';

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
      console.log('✅ Bond Order Notification email service configured');
    } else {
      console.log('⚠️ Bond Order Notification email not configured - missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
    }
  }

  private getStatusMessage(status: string): { title: string; description: string; emoji: string } {
    switch (status.toLowerCase()) {
      case 'placed':
      case 'pending':
        return { 
          title: 'Order Received',
          description: 'Your bond order has been received and is awaiting payment.',
          emoji: '📝'
        };
      case 'processing':
      case 'confirmed':
        return { 
          title: 'Payment Confirmed',
          description: 'Your payment has been confirmed. Order is now being processed.',
          emoji: '✅'
        };
      case 'settlement':
      case 'awaiting_settlement':
        return { 
          title: 'Settlement in Progress',
          description: 'Your order is in the settlement queue and will be credited soon.',
          emoji: '⏳'
        };
      case 'allotted':
        return { 
          title: 'Bonds Allotted',
          description: 'Your bonds have been allotted. They will be credited to your demat account.',
          emoji: '🎯'
        };
      case 'credited':
      case 'executed':
        return { 
          title: 'Order Completed',
          description: 'Your bonds have been credited to your demat account.',
          emoji: '🎉'
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
          emoji: 'ℹ️'
        };
    }
  }

  async sendOrderStatusNotification(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    const results = { email: false, sms: false };

    try {
      const [user] = await db.select().from(users).where(eq(users.id, data.userId));
      
      if (!user) {
        console.log(`[Bond Notification] User not found: ${data.userId}`);
        return results;
      }

      const statusInfo = this.getStatusMessage(data.status);
      const formattedAmount = parseFloat(data.amount).toLocaleString('en-IN');

      if (user.email) {
        results.email = await this.sendEmailNotification({
          email: user.email,
          userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
          orderNumber: data.orderNumber,
          bondName: data.bondName,
          quantity: data.quantity,
          amount: formattedAmount,
          status: data.status,
          statusTitle: statusInfo.title,
          statusDescription: statusInfo.description,
          settlementDate: data.settlementDate,
        });
      }

      if (user.mobile) {
        results.sms = await this.sendSMSNotification({
          mobile: user.mobile,
          orderNumber: data.orderNumber,
          bondName: data.bondName,
          status: statusInfo.title,
          amount: formattedAmount,
          emoji: statusInfo.emoji,
        });
      }

      console.log(`[Bond Notification] Order ${data.orderNumber} status ${data.status} - Email: ${results.email}, SMS: ${results.sms}`);
    } catch (error) {
      console.error('[Bond Notification] Error sending notifications:', error);
    }

    return results;
  }

  private async sendEmailNotification(data: {
    email: string;
    userName: string;
    orderNumber: string;
    bondName: string;
    quantity: number;
    amount: string;
    status: string;
    statusTitle: string;
    statusDescription: string;
    settlementDate?: string;
  }): Promise<boolean> {
    if (!this.isEmailConfigured || !this.emailTransporter) {
      console.log(`[Bond Notification] Email (mock): ${data.statusTitle} for order ${data.orderNumber} to ${data.email}`);
      return false;
    }

    try {
      const settlementInfo = data.settlementDate 
        ? `<p style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px;">
             <strong>Expected Settlement:</strong> ${new Date(data.settlementDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
           </p>`
        : '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>FintekPro - Order Update</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #1a56db; margin: 0;">FintekPro</h1>
            </div>
            
            <h2 style="color: #333; margin: 0 0 16px 0;">${data.statusTitle}</h2>
            <p style="color: #666; margin: 0 0 24px 0;">Hi ${data.userName},</p>
            <p style="color: #666; margin: 0 0 24px 0;">${data.statusDescription}</p>
            
            <div style="background: linear-gradient(135deg, #1a56db 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 8px; margin: 24px 0;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px;">Order Details</h3>
              <table style="width: 100%; color: white;">
                <tr><td style="padding: 8px 0;">Order #:</td><td style="text-align: right; font-weight: bold;">${data.orderNumber}</td></tr>
                <tr><td style="padding: 8px 0;">Bond:</td><td style="text-align: right; font-weight: bold;">${data.bondName}</td></tr>
                <tr><td style="padding: 8px 0;">Quantity:</td><td style="text-align: right; font-weight: bold;">${data.quantity} units</td></tr>
                <tr><td style="padding: 8px 0;">Amount:</td><td style="text-align: right; font-weight: bold;">₹${data.amount}</td></tr>
              </table>
            </div>
            
            ${settlementInfo}
            
            <p style="color: #666; margin: 24px 0 0 0; font-size: 14px;">
              Track your order in the <a href="https://fintekpro.com/bonds" style="color: #1a56db;">My Bonds</a> section.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from FintekPro. Please do not reply.
            </p>
          </div>
        </body>
        </html>
      `;

      await this.emailTransporter.sendMail({
        from: this.fromEmail,
        to: data.email,
        subject: `${data.statusTitle} - Order #${data.orderNumber} | FintekPro`,
        html,
      });

      return true;
    } catch (error) {
      console.error('[Bond Notification] Email send error:', error);
      return false;
    }
  }

  private async sendSMSNotification(data: {
    mobile: string;
    orderNumber: string;
    bondName: string;
    status: string;
    amount: string;
    emoji: string;
  }): Promise<boolean> {
    if (!smsService.isAvailable()) {
      console.log(`[Bond Notification] SMS (mock): ${data.status} for order ${data.orderNumber} to ${data.mobile}`);
      return false;
    }

    try {
      const formattedMobile = data.mobile.startsWith('+') ? data.mobile : `+91${data.mobile}`;
      const bondNameShort = data.bondName.length > 25 ? data.bondName.substring(0, 22) + '...' : data.bondName;
      
      const message = `${data.emoji} FintekPro: ${data.status}! Order #${data.orderNumber} for ${bondNameShort} (₹${data.amount}). Track at fintekpro.com/bonds`;

      const result = await (smsService as any).client?.messages?.create({
        body: message,
        from: (smsService as any).fromNumber,
        to: formattedMobile,
      });

      return !!result?.sid;
    } catch (error) {
      console.error('[Bond Notification] SMS send error:', error);
      return false;
    }
  }

  async sendOrderConfirmation(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    return this.sendOrderStatusNotification({ ...data, status: 'placed' });
  }

  async sendPaymentConfirmation(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    return this.sendOrderStatusNotification({ ...data, status: 'confirmed' });
  }

  async sendSettlementUpdate(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    return this.sendOrderStatusNotification({ ...data, status: 'settlement' });
  }

  async sendOrderCompletion(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    return this.sendOrderStatusNotification({ ...data, status: 'credited' });
  }

  async sendOrderCancellation(data: OrderNotificationData): Promise<{ email: boolean; sms: boolean }> {
    return this.sendOrderStatusNotification({ ...data, status: 'cancelled' });
  }
}

export const bondOrderNotificationService = new BondOrderNotificationService();
