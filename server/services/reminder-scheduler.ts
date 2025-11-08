import * as cron from 'node-cron';
import { db } from "../db";
import { capitalGainsTaxReminders, taxReminderSubscriptions, users, userProfiles } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { capitalGainsCalculator } from './capital-gains-calculator';
import { logger } from '../logger';

interface ReminderNotification {
  userId: string;
  email: string;
  firstName: string;
  quarter: string;
  dueDate: string;
  estimatedSTCG: number;
  estimatedLTCG: number;
  totalTaxLiability: number;
  reminderChannels: string[];
}

export class ReminderSchedulerService {
  private cronJob: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;

  start(): void {
    if (this.cronJob) {
      logger.info('⏰ Reminder scheduler already running');
      return;
    }

    // Run daily at 9:00 AM IST
    this.cronJob = cron.schedule('0 9 * * *', async () => {
      await this.checkAndSendReminders();
    }, {
      timezone: "Asia/Kolkata"
    });

    logger.info('✅ Capital gains reminder scheduler started (runs daily at 9:00 AM IST)');
    
    // Run once on startup for testing (optional - remove in production)
    // this.checkAndSendReminders().catch(err => logger.error('Error in reminder check', err));
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('⏹️ Reminder scheduler stopped');
    }
  }

  async checkAndSendReminders(): Promise<void> {
    if (this.isRunning) {
      logger.info('⏭️ Reminder check already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Checking for upcoming capital gains tax reminders...');

    try {
      // Get reminders due in the next 7 days that haven't been sent
      const today = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(today.getDate() + 7);

      const todayStr = today.toISOString().split('T')[0];
      const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

      // Query reminders due in next 7 days with pending status
      const upcomingReminders = await db
        .select({
          reminder: capitalGainsTaxReminders,
          subscription: taxReminderSubscriptions,
          user: users,
          profile: userProfiles
        })
        .from(capitalGainsTaxReminders)
        .leftJoin(
          taxReminderSubscriptions,
          eq(capitalGainsTaxReminders.subscriptionId, taxReminderSubscriptions.id)
        )
        .leftJoin(
          users,
          eq(capitalGainsTaxReminders.userId, users.id)
        )
        .leftJoin(
          userProfiles,
          eq(users.id, userProfiles.userId)
        )
        .where(
          and(
            gte(capitalGainsTaxReminders.dueDate, todayStr),
            lte(capitalGainsTaxReminders.dueDate, sevenDaysStr),
            eq(capitalGainsTaxReminders.status, 'pending')
          )
        );

      logger.info(`📋 Found ${upcomingReminders.length} pending reminders`);

      if (upcomingReminders.length === 0) {
        this.isRunning = false;
        return;
      }

      // Filter for active subscriptions only
      const activeReminders = upcomingReminders.filter(item => 
        item.subscription?.subscriptionStatus === 'active' || 
        item.subscription?.subscriptionStatus === 'free_expert_tier'
      );

      logger.info(`✅ ${activeReminders.length} reminders with active subscriptions`);

      // Send notifications
      for (const item of activeReminders) {
        try {
          if (!item.user || !item.reminder) continue;

          const notification: ReminderNotification = {
            userId: item.user.id,
            email: item.user.email || '',
            firstName: item.profile?.firstName || 'Investor',
            quarter: item.reminder.quarter,
            dueDate: item.reminder.dueDate,
            estimatedSTCG: parseFloat(item.reminder.estimatedSTCG || '0'),
            estimatedLTCG: parseFloat(item.reminder.estimatedLTCG || '0'),
            totalTaxLiability: parseFloat(item.reminder.totalTaxLiability || '0'),
            reminderChannels: (item.subscription?.reminderChannels as string[]) || ['email']
          };

          await this.sendNotification(notification);

          // Update reminder status to 'sent'
          await capitalGainsCalculator.updateReminderStatus(item.reminder.id, 'sent');

          logger.info(`✉️ Sent reminder for ${notification.quarter} to ${notification.email}`);
        } catch (error) {
          logger.error(`❌ Error sending reminder for user ${item.user?.id}:`, error);
          // Continue with other reminders even if one fails
        }
      }

      logger.info('✅ Reminder check completed');
    } catch (error) {
      logger.error('❌ Error checking reminders:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async sendNotification(notification: ReminderNotification): Promise<void> {
    const { email, firstName, quarter, dueDate, totalTaxLiability, estimatedSTCG, estimatedLTCG, reminderChannels } = notification;

    // Format the due date
    const formattedDate = new Date(dueDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(amount);
    };

    // Email notification
    if (reminderChannels.includes('email')) {
      await this.sendEmailNotification({
        to: email,
        firstName,
        quarter,
        dueDate: formattedDate,
        totalTaxLiability: formatCurrency(totalTaxLiability),
        stcgAmount: formatCurrency(estimatedSTCG),
        ltcgAmount: formatCurrency(estimatedLTCG)
      });
    }

    // SMS notification
    if (reminderChannels.includes('sms')) {
      await this.sendSMSNotification({
        firstName,
        quarter,
        dueDate: formattedDate,
        totalTaxLiability: formatCurrency(totalTaxLiability)
      });
    }

    // WhatsApp notification
    if (reminderChannels.includes('whatsapp')) {
      await this.sendWhatsAppNotification({
        firstName,
        quarter,
        dueDate: formattedDate,
        totalTaxLiability: formatCurrency(totalTaxLiability),
        stcgAmount: formatCurrency(estimatedSTCG),
        ltcgAmount: formatCurrency(estimatedLTCG)
      });
    }
  }

  private async sendEmailNotification(data: {
    to: string;
    firstName: string;
    quarter: string;
    dueDate: string;
    totalTaxLiability: string;
    stcgAmount: string;
    ltcgAmount: string;
  }): Promise<void> {
    // In production, integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the notification
    logger.info('📧 Email Notification:', {
      to: data.to,
      subject: `Capital Gains Tax Reminder - ${data.quarter}`,
      body: `Dear ${data.firstName}, This is a reminder that your advance tax payment for ${data.quarter} is due on ${data.dueDate}. Tax Breakdown: STCG: ${data.stcgAmount}, LTCG: ${data.ltcgAmount}, Total: ${data.totalTaxLiability}. Please ensure timely payment to avoid penalties. Payment Link: https://www.incometax.gov.in/iec/foportal/`
    });

    // Audit log
    await this.logNotification('email', data.to, data.quarter);
  }

  private async sendSMSNotification(data: {
    firstName: string;
    quarter: string;
    dueDate: string;
    totalTaxLiability: string;
  }): Promise<void> {
    // In production, integrate with SMS gateway (Twilio, AWS SNS, etc.)
    logger.info('📱 SMS Notification:', {
      message: `Dear ${data.firstName}, your advance tax for ${data.quarter} (${data.totalTaxLiability}) is due on ${data.dueDate}. Visit our portal for details.`
    });

    // Audit log
    await this.logNotification('sms', data.firstName, data.quarter);
  }

  private async sendWhatsAppNotification(data: {
    firstName: string;
    quarter: string;
    dueDate: string;
    totalTaxLiability: string;
    stcgAmount: string;
    ltcgAmount: string;
  }): Promise<void> {
    // In production, integrate with WhatsApp Business API
    logger.info('💬 WhatsApp Notification:', {
      recipient: data.firstName,
      message: `Hi ${data.firstName}, 🔔 *Capital Gains Tax Reminder* - Quarter: ${data.quarter}, Due Date: ${data.dueDate}, 📊 *Tax Breakdown:* STCG: ${data.stcgAmount}, LTCG: ${data.ltcgAmount}, Total: ${data.totalTaxLiability}. 💳 Pay now: https://www.incometax.gov.in/iec/foportal/`
    });

    // Audit log
    await this.logNotification('whatsapp', data.firstName, data.quarter);
  }

  private async logNotification(channel: string, recipient: string, quarter: string): Promise<void> {
    try {
      // Log to database or audit trail
      logger.info(`📝 Audit Log: ${channel} notification sent to ${recipient} for ${quarter} at ${new Date().toISOString()}`);
      
      // In production, insert into notifications audit table
      // await db.insert(notificationLogs).values({
      //   channel,
      //   recipient,
      //   quarter,
      //   sentAt: new Date()
      // });
    } catch (error) {
      logger.error('Error logging notification:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualCheck(): Promise<void> {
    logger.info('🔧 Manual reminder check triggered');
    await this.checkAndSendReminders();
  }
}

export const reminderScheduler = new ReminderSchedulerService();
