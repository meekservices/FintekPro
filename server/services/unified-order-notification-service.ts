/**
 * Unified Order Notification Service
 * Centralizes all order notifications (bonds, mutual funds, unlisted, US stocks)
 * into a single service to eliminate code duplication
 * 
 * Replaces:
 * - bond-order-notification-service.ts
 * - mf-order-notification-service.ts
 * - unlisted-order-notification-service.ts
 * - us-order-notification-service.ts
 */

import nodemailer from 'nodemailer';
import { db } from '../db';
import { users, userNotifications, notificationPreferences } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { smsService } from './sms-service';

export type AssetType = 'bond' | 'mutual_fund' | 'unlisted' | 'us_stock';

export interface BaseOrderNotification {
  orderId: string;
  userId: string;
  status: string;
  previousStatus?: string;
  assetType: AssetType;
}

export interface BondOrderNotification extends BaseOrderNotification {
  assetType: 'bond';
  orderNumber: string;
  bondName: string;
  bondType: string;
  quantity: number;
  amount: string;
  settlementDate?: string;
}

export interface MutualFundOrderNotification extends BaseOrderNotification {
  assetType: 'mutual_fund';
  orderReference: string;
  schemeName: string;
  orderType: string;
  amount: string;
  navApplied?: string;
  unitsAllotted?: string;
  settlementDate?: string;
}

export interface UnlistedOrderNotification extends BaseOrderNotification {
  assetType: 'unlisted';
  companyName: string;
  quantity: number;
  price: string;
  dealId?: string;
  expectedSettlement?: string;
  counterpartyName?: string;
}

export interface UsStockOrderNotification extends BaseOrderNotification {
  assetType: 'us_stock';
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  priceUsd: number;
  filledAt?: Date;
}

export type OrderNotification = 
  | BondOrderNotification 
  | MutualFundOrderNotification 
  | UnlistedOrderNotification 
  | UsStockOrderNotification;

interface StatusMessage {
  title: string;
  description: string;
  emoji: string;
}

interface UserDetails {
  email: string | null;
  mobile: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface NotificationResult {
  emailSent: boolean;
  smsSent: boolean;
  inAppCreated: boolean;
}

class UnifiedOrderNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured: boolean = false;
  private fromEmail: string = 'noreply@fintekpro.com';

  constructor() {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
    const emailPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || '587';
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

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
      console.log('✅ Unified Order Notification email service configured');
    } else {
      console.log('⚠️ Unified Order Notification email not configured - missing email credentials');
    }
  }

  private async getUserDetails(userId: string): Promise<UserDetails | null> {
    try {
      const [user] = await db.select({
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, userId));
      return user || null;
    } catch (error) {
      console.error('[Unified Notification] Error fetching user:', error);
      return null;
    }
  }

  private async getUserPreferences(userId: string) {
    try {
      const [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      return prefs || { emailEnabled: true, smsEnabled: true, pushEnabled: true };
    } catch {
      return { emailEnabled: true, smsEnabled: true, pushEnabled: true };
    }
  }

  private getAssetLabel(assetType: AssetType): string {
    const labels: Record<AssetType, string> = {
      bond: 'Bond',
      mutual_fund: 'Mutual Fund',
      unlisted: 'Unlisted Share',
      us_stock: 'US Stock',
    };
    return labels[assetType];
  }

  private getStatusMessage(status: string, assetType: AssetType): StatusMessage {
    const statusLower = status.toLowerCase();
    
    const commonStatuses: Record<string, StatusMessage> = {
      placed: { title: 'Order Received', description: 'Your order has been received and is awaiting processing.', emoji: '📝' },
      pending: { title: 'Order Pending', description: 'Your order is pending confirmation.', emoji: '⏳' },
      confirmed: { title: 'Order Confirmed', description: 'Your order has been confirmed.', emoji: '✅' },
      processing: { title: 'Processing', description: 'Your order is being processed.', emoji: '⚙️' },
      completed: { title: 'Order Completed', description: 'Your order has been successfully completed.', emoji: '🎉' },
      failed: { title: 'Order Failed', description: 'Your order could not be processed.', emoji: '❌' },
      cancelled: { title: 'Order Cancelled', description: 'Your order has been cancelled.', emoji: '🚫' },
      rejected: { title: 'Order Rejected', description: 'Your order was rejected.', emoji: '❌' },
    };

    const assetSpecificStatuses: Record<AssetType, Record<string, StatusMessage>> = {
      bond: {
        allotted: { title: 'Bonds Allotted', description: 'Your bonds have been allotted and will be credited to your demat account.', emoji: '🎯' },
        settlement: { title: 'Settlement in Progress', description: 'Your order is in the settlement queue.', emoji: '⏳' },
      },
      mutual_fund: {
        nav_applied: { title: 'NAV Applied', description: 'NAV has been applied to your order.', emoji: '📈' },
        units_allotted: { title: 'Units Allotted', description: 'Mutual fund units have been allotted.', emoji: '🎯' },
      },
      unlisted: {
        matched: { title: 'Deal Matched', description: 'Your order has been matched with a counterparty.', emoji: '🤝' },
        escrow: { title: 'In Escrow', description: 'Funds are held in escrow pending share transfer.', emoji: '🔒' },
      },
      us_stock: {
        filled: { title: 'Order Filled', description: 'Your US stock order has been filled.', emoji: '✅' },
        partial_fill: { title: 'Partially Filled', description: 'Your order has been partially filled.', emoji: '📊' },
      },
    };

    return assetSpecificStatuses[assetType]?.[statusLower] || 
           commonStatuses[statusLower] || 
           { title: 'Status Update', description: `Order status: ${status}`, emoji: '📋' };
  }

  private getInstrumentName(notification: OrderNotification): string {
    switch (notification.assetType) {
      case 'bond': return notification.bondName;
      case 'mutual_fund': return notification.schemeName;
      case 'unlisted': return notification.companyName;
      case 'us_stock': return notification.symbol;
    }
  }

  private getOrderAmount(notification: OrderNotification): string {
    switch (notification.assetType) {
      case 'bond': return `₹${notification.amount}`;
      case 'mutual_fund': return `₹${notification.amount}`;
      case 'unlisted': return `₹${notification.price} x ${notification.quantity}`;
      case 'us_stock': return `$${notification.priceUsd} x ${notification.quantity}`;
    }
  }

  private generateEmailHtml(notification: OrderNotification, statusMsg: StatusMessage, user: UserDetails): string {
    const instrumentName = this.getInstrumentName(notification);
    const amount = this.getOrderAmount(notification);
    const assetLabel = this.getAssetLabel(notification.assetType);
    const userName = user.firstName || 'Investor';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
          .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
          .status-success { background: #dcfce7; color: #166534; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-failed { background: #fee2e2; color: #dc2626; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .details-table td:first-child { font-weight: 600; color: #64748b; width: 40%; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${statusMsg.emoji} ${assetLabel} Order Update</h1>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p><strong>${statusMsg.title}</strong></p>
            <p>${statusMsg.description}</p>
            
            <table class="details-table">
              <tr><td>Asset Type</td><td>${assetLabel}</td></tr>
              <tr><td>Instrument</td><td>${instrumentName}</td></tr>
              <tr><td>Order ID</td><td>${notification.orderId}</td></tr>
              <tr><td>Amount</td><td>${amount}</td></tr>
              <tr><td>Status</td><td><span class="status-badge ${notification.status.toLowerCase().includes('complete') || notification.status.toLowerCase().includes('allot') ? 'status-success' : notification.status.toLowerCase().includes('fail') || notification.status.toLowerCase().includes('reject') ? 'status-failed' : 'status-pending'}">${notification.status}</span></td></tr>
            </table>
            
            <p style="margin-top: 20px;">
              <a href="https://fintekpro.com/orders/${notification.orderId}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Order Details</a>
            </p>
          </div>
          <div class="footer">
            <p>FintekPro - Your Trusted Investment Partner</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateSmsMessage(notification: OrderNotification, statusMsg: StatusMessage): string {
    const instrumentName = this.getInstrumentName(notification);
    const assetLabel = this.getAssetLabel(notification.assetType);
    return `FintekPro: ${assetLabel} Order ${statusMsg.title}. ${instrumentName} - ${notification.status}. Order ID: ${notification.orderId.slice(0, 8)}...`;
  }

  async sendNotification(notification: OrderNotification): Promise<NotificationResult> {
    const result: NotificationResult = { emailSent: false, smsSent: false, inAppCreated: false };

    const user = await this.getUserDetails(notification.userId);
    if (!user) {
      console.warn(`[Unified Notification] User not found: ${notification.userId}`);
      return result;
    }

    const prefs = await this.getUserPreferences(notification.userId);
    const statusMsg = this.getStatusMessage(notification.status, notification.assetType);
    const assetLabel = this.getAssetLabel(notification.assetType);

    if (prefs.emailEnabled && user.email && this.isEmailConfigured && this.emailTransporter) {
      try {
        await this.emailTransporter.sendMail({
          from: this.fromEmail,
          to: user.email,
          subject: `${statusMsg.emoji} ${assetLabel} Order: ${statusMsg.title}`,
          html: this.generateEmailHtml(notification, statusMsg, user),
        });
        result.emailSent = true;
      } catch (error) {
        console.error('[Unified Notification] Email send error:', error);
      }
    }

    if (prefs.smsEnabled && user.mobile) {
      const smsMessage = this.generateSmsMessage(notification, statusMsg);
      result.smsSent = await smsService.sendSms(user.mobile, smsMessage);
    }

    try {
      await db.insert(userNotifications).values({
        id: crypto.randomUUID(),
        userId: notification.userId,
        type: `${notification.assetType}_order`,
        title: `${assetLabel}: ${statusMsg.title}`,
        message: statusMsg.description,
        data: JSON.stringify(notification),
        isRead: false,
        createdAt: new Date(),
      });
      result.inAppCreated = true;
    } catch (error) {
      console.error('[Unified Notification] In-app notification error:', error);
    }

    console.log(`[Unified Notification] ${assetLabel} order ${notification.orderId}: email=${result.emailSent}, sms=${result.smsSent}, inApp=${result.inAppCreated}`);
    return result;
  }

  async notifyBondOrder(data: Omit<BondOrderNotification, 'assetType'>): Promise<NotificationResult> {
    return this.sendNotification({ ...data, assetType: 'bond' });
  }

  async notifyMutualFundOrder(data: Omit<MutualFundOrderNotification, 'assetType'>): Promise<NotificationResult> {
    return this.sendNotification({ ...data, assetType: 'mutual_fund' });
  }

  async notifyUnlistedOrder(data: Omit<UnlistedOrderNotification, 'assetType'>): Promise<NotificationResult> {
    return this.sendNotification({ ...data, assetType: 'unlisted' });
  }

  async notifyUsStockOrder(data: Omit<UsStockOrderNotification, 'assetType'>): Promise<NotificationResult> {
    return this.sendNotification({ ...data, assetType: 'us_stock' });
  }
}

export const unifiedOrderNotificationService = new UnifiedOrderNotificationService();
