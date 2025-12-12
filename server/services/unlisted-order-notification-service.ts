import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface NotificationContext {
  userId: string;
  companyName: string;
  quantity: number;
  price: string;
  orderId?: string;
  dealId?: string;
  expectedSettlement?: string;
  counterpartyName?: string;
}

class UnlistedOrderNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured: boolean = false;
  private fromEmail: string = 'noreply@fintekpro.com';
  private twilioClient: any = null;
  private twilioFromNumber: string = '';
  private isSmsConfigured: boolean = false;

  constructor() {
    this.initializeEmailService();
    this.initializeSmsService();
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
      console.log('✅ Unlisted Order Notification email service configured');
    } else {
      console.log('⚠️ Unlisted Order Notification email not configured - missing SMTP credentials');
    }
  }

  private initializeSmsService() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromNumber) {
      this.twilioClient = twilio(accountSid, authToken);
      this.twilioFromNumber = fromNumber;
      this.isSmsConfigured = true;
      console.log('✅ Unlisted Order Notification SMS service configured');
    } else {
      console.log('⚠️ Unlisted Order Notification SMS not configured - missing Twilio credentials');
    }
  }

  private async sendSms(mobile: string, message: string): Promise<boolean> {
    if (!this.isSmsConfigured || !this.twilioClient) {
      console.log(`📱 Unlisted SMS (mock): ${message.substring(0, 50)}... to ${mobile}`);
      return false;
    }

    try {
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;
      await this.twilioClient.messages.create({
        body: message,
        from: this.twilioFromNumber,
        to: formattedMobile,
      });
      return true;
    } catch (error: any) {
      console.error('[UnlistedNotification] SMS send error:', error);
      return false;
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.isEmailConfigured || !this.emailTransporter) {
      console.log(`📧 Unlisted Email (mock): ${subject} to ${to}`);
      return false;
    }

    try {
      await this.emailTransporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
      return true;
    } catch (error: any) {
      console.error('[UnlistedNotification] Email send error:', error);
      return false;
    }
  }

  private async getUserContact(userId: string): Promise<{ email?: string; phone?: string; name?: string } | null> {
    try {
      const [user] = await db.select({
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user) return null;
      
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Investor';
      return { 
        email: user.email || undefined, 
        phone: user.mobile || undefined, 
        name 
      };
    } catch (error: any) {
      console.error('[UnlistedNotification] Failed to get user contact:', error);
      return null;
    }
  }

  async notifyBuyRequestCreated(context: NotificationContext): Promise<void> {
    try {
      const contact = await this.getUserContact(context.userId);
      if (!contact) return;

      const subject = `Buy Request Created - ${context.companyName}`;
      const message = `Your buy request for ${context.quantity} shares of ${context.companyName} at ₹${context.price}/share has been created. We'll notify you when a matching seller is found.`;

      if (contact.email) {
        await this.sendEmail(
          contact.email,
          subject,
          this.formatEmailTemplate(contact.name || 'Investor', 'Buy Request Created', message, [
            { label: 'Company', value: context.companyName },
            { label: 'Quantity', value: context.quantity.toString() },
            { label: 'Max Price', value: `₹${context.price}` },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Email failed:', err.message));
      }

      if (contact.phone) {
        await this.sendSms(contact.phone, `FintekPro: Buy request created for ${context.quantity} shares of ${context.companyName}. We'll notify you when matched.`).catch((err: any) => console.warn('[UnlistedNotification] SMS failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifyBuyRequestCreated error:', error);
    }
  }

  async notifyDealMatched(buyerContext: NotificationContext, sellerContext: NotificationContext): Promise<void> {
    try {
      const [buyerContact, sellerContact] = await Promise.all([
        this.getUserContact(buyerContext.userId),
        this.getUserContact(sellerContext.userId)
      ]);

      const dealPrice = buyerContext.price;
      const quantity = buyerContext.quantity;

      if (buyerContact?.email) {
        await this.sendEmail(
          buyerContact.email,
          `Deal Matched - ${buyerContext.companyName}`,
          this.formatEmailTemplate(buyerContact.name || 'Investor', 'Deal Matched!', 
            `Great news! A seller has been matched for your buy request. Please confirm and proceed with payment.`, [
            { label: 'Company', value: buyerContext.companyName },
            { label: 'Quantity', value: quantity.toString() },
            { label: 'Deal Price', value: `₹${dealPrice}/share` },
            { label: 'Total Amount', value: `₹${(quantity * parseFloat(dealPrice)).toLocaleString('en-IN')}` },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Buyer email failed:', err.message));
      }

      if (sellerContact?.email) {
        await this.sendEmail(
          sellerContact.email,
          `Deal Matched - ${sellerContext.companyName}`,
          this.formatEmailTemplate(sellerContact.name || 'Investor', 'Deal Matched!',
            `Great news! A buyer has been matched for your sell listing. Please confirm to proceed.`, [
            { label: 'Company', value: sellerContext.companyName },
            { label: 'Quantity', value: quantity.toString() },
            { label: 'Deal Price', value: `₹${dealPrice}/share` },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Seller email failed:', err.message));
      }

      if (buyerContact?.phone) {
        await this.sendSms(buyerContact.phone, `FintekPro: Deal matched for ${buyerContext.companyName}! Confirm and pay to complete purchase. Login to proceed.`).catch((err: any) => console.warn('[UnlistedNotification] Buyer SMS failed:', err.message));
      }

      if (sellerContact?.phone) {
        await this.sendSms(sellerContact.phone, `FintekPro: Buyer matched for your ${sellerContext.companyName} shares! Login to confirm the deal.`).catch((err: any) => console.warn('[UnlistedNotification] Seller SMS failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifyDealMatched error:', error);
    }
  }

  async notifyPaymentReceived(context: NotificationContext): Promise<void> {
    try {
      const contact = await this.getUserContact(context.userId);
      if (!contact) return;

      const message = `Payment of ₹${(context.quantity * parseFloat(context.price)).toLocaleString('en-IN')} received for ${context.companyName}. Share transfer will be initiated shortly.`;

      if (contact.email) {
        await this.sendEmail(
          contact.email,
          `Payment Confirmed - ${context.companyName}`,
          this.formatEmailTemplate(contact.name || 'Investor', 'Payment Confirmed', message, [
            { label: 'Company', value: context.companyName },
            { label: 'Quantity', value: context.quantity.toString() },
            { label: 'Amount Paid', value: `₹${(context.quantity * parseFloat(context.price)).toLocaleString('en-IN')}` },
            { label: 'Expected Settlement', value: context.expectedSettlement || 'T+2 business days' },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Email failed:', err.message));
      }

      if (contact.phone) {
        await this.sendSms(contact.phone, `FintekPro: Payment confirmed for ${context.companyName}. Transfer in progress. Track status in your dashboard.`).catch((err: any) => console.warn('[UnlistedNotification] SMS failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifyPaymentReceived error:', error);
    }
  }

  async notifyTransferInitiated(buyerContext: NotificationContext, sellerContext: NotificationContext): Promise<void> {
    try {
      const [buyerContact, sellerContact] = await Promise.all([
        this.getUserContact(buyerContext.userId),
        this.getUserContact(sellerContext.userId)
      ]);

      if (buyerContact?.email) {
        await this.sendEmail(
          buyerContact.email,
          `Share Transfer Initiated - ${buyerContext.companyName}`,
          this.formatEmailTemplate(buyerContact.name || 'Investor', 'Transfer Initiated',
            `The share transfer process has been initiated. You will receive ${buyerContext.quantity} shares in your demat account.`, [
            { label: 'Company', value: buyerContext.companyName },
            { label: 'Quantity', value: buyerContext.quantity.toString() },
            { label: 'Expected in Demat', value: buyerContext.expectedSettlement || '2-3 business days' },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Buyer email failed:', err.message));
      }

      if (sellerContact?.email) {
        await this.sendEmail(
          sellerContact.email,
          `Transfer Your Shares - ${sellerContext.companyName}`,
          this.formatEmailTemplate(sellerContact.name || 'Investor', 'Action Required: Transfer Shares',
            `Please initiate the share transfer from your demat account. Upload the DIS slip once completed.`, [
            { label: 'Company', value: sellerContext.companyName },
            { label: 'Quantity to Transfer', value: sellerContext.quantity.toString() },
            { label: 'Buyer DP ID', value: 'Will be shared in dashboard' },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Seller email failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifyTransferInitiated error:', error);
    }
  }

  async notifySettlementComplete(context: NotificationContext): Promise<void> {
    try {
      const contact = await this.getUserContact(context.userId);
      if (!contact) return;

      if (contact.email) {
        await this.sendEmail(
          contact.email,
          `Transaction Complete - ${context.companyName}`,
          this.formatEmailTemplate(contact.name || 'Investor', 'Transaction Complete! 🎉',
            `Your unlisted share transaction has been successfully completed. ${context.quantity} shares of ${context.companyName} are now in your demat account.`, [
            { label: 'Company', value: context.companyName },
            { label: 'Quantity', value: context.quantity.toString() },
            { label: 'Price per Share', value: `₹${context.price}` },
            { label: 'Total Value', value: `₹${(context.quantity * parseFloat(context.price)).toLocaleString('en-IN')}` },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Email failed:', err.message));
      }

      if (contact.phone) {
        await this.sendSms(contact.phone, `FintekPro: Congratulations! Your ${context.companyName} share transaction is complete. Check your demat account.`).catch((err: any) => console.warn('[UnlistedNotification] SMS failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifySettlementComplete error:', error);
    }
  }

  async notifyPaymentReminder(context: NotificationContext): Promise<void> {
    try {
      const contact = await this.getUserContact(context.userId);
      if (!contact) return;

      if (contact.email) {
        await this.sendEmail(
          contact.email,
          `Payment Reminder - ${context.companyName}`,
          this.formatEmailTemplate(contact.name || 'Investor', 'Payment Pending',
            `Your deal for ${context.companyName} is awaiting payment. Please complete payment to proceed with the transaction.`, [
            { label: 'Company', value: context.companyName },
            { label: 'Amount Due', value: `₹${(context.quantity * parseFloat(context.price)).toLocaleString('en-IN')}` },
          ])
        ).catch((err: any) => console.warn('[UnlistedNotification] Email failed:', err.message));
      }

      if (contact.phone) {
        await this.sendSms(contact.phone, `FintekPro: Payment pending for ${context.companyName} deal. Complete payment to proceed. Login now.`).catch((err: any) => console.warn('[UnlistedNotification] SMS failed:', err.message));
      }
    } catch (error: any) {
      console.error('[UnlistedNotification] notifyPaymentReminder error:', error);
    }
  }

  private formatEmailTemplate(name: string, title: string, message: string, details: { label: string; value: string }[]): string {
    const detailsHtml = details.map(d => `
      <tr>
        <td style="padding: 8px 0; color: #6b7280; width: 40%;">${d.label}</td>
        <td style="padding: 8px 0; font-weight: 600; color: #111827;">${d.value}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">FintekPro</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Unlisted Marketplace</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">${title}</h2>
            <p style="color: #374151; margin: 0 0 8px 0;">Dear ${name},</p>
            <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.6;">${message}</p>
            <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; padding: 16px;">
              ${detailsHtml}
            </table>
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://fintekpro.com'}/unlisted/my-orders" 
                 style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                View in Dashboard
              </a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">This is an automated message from FintekPro. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const unlistedOrderNotificationService = new UnlistedOrderNotificationService();
