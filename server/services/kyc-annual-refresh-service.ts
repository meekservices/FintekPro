/**
 * KYC Annual Refresh Service (Task 12)
 * 
 * Implements automatic reminders for KYC and risk profile refresh
 * SEBI-compliant annual re-verification
 */

interface RefreshReminder {
  userId: string;
  email: string;
  mobile?: string;
  refreshType: 'kyc' | 'risk_profile' | 'accreditation' | 'w8_form';
  currentExpiryDate: Date;
  daysUntilExpiry: number;
  remindersSent: {
    type: '30_day' | '15_day' | '7_day' | '3_day' | '1_day' | 'expired';
    sentAt: Date;
    channel: 'email' | 'sms' | 'both';
    success: boolean;
  }[];
  status: 'active' | 'refreshed' | 'expired' | 'blocked';
  lastRefreshedAt?: Date;
}

interface ReminderConfig {
  daysBefore: number;
  reminderType: '30_day' | '15_day' | '7_day' | '3_day' | '1_day' | 'expired';
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: ('email' | 'sms')[];
}

class KYCAnnualRefreshService {
  private reminders: Map<string, RefreshReminder> = new Map();
  private lastCronRun: Date | null = null;

  private readonly REMINDER_SCHEDULE: ReminderConfig[] = [
    { daysBefore: 30, reminderType: '30_day', priority: 'low', channels: ['email'] },
    { daysBefore: 15, reminderType: '15_day', priority: 'medium', channels: ['email'] },
    { daysBefore: 7, reminderType: '7_day', priority: 'medium', channels: ['email', 'sms'] },
    { daysBefore: 3, reminderType: '3_day', priority: 'high', channels: ['email', 'sms'] },
    { daysBefore: 1, reminderType: '1_day', priority: 'critical', channels: ['email', 'sms'] },
    { daysBefore: 0, reminderType: 'expired', priority: 'critical', channels: ['email', 'sms'] }
  ];

  /**
   * Register a user for refresh reminders
   */
  registerForReminders(
    userId: string,
    email: string,
    mobile: string | undefined,
    refreshType: RefreshReminder['refreshType'],
    expiryDate: Date
  ): RefreshReminder {
    const key = `${userId}-${refreshType}`;
    
    const reminder: RefreshReminder = {
      userId,
      email,
      mobile,
      refreshType,
      currentExpiryDate: expiryDate,
      daysUntilExpiry: this.calculateDaysUntilExpiry(expiryDate),
      remindersSent: [],
      status: 'active'
    };

    this.reminders.set(key, reminder);
    console.log(`📅 [Annual Refresh] Registered ${refreshType} reminder for user ${userId.substring(0, 8)}..., expires: ${expiryDate.toISOString()}`);

    return reminder;
  }

  /**
   * Update refresh status (called after user completes refresh)
   */
  markRefreshed(userId: string, refreshType: RefreshReminder['refreshType'], newExpiryDate: Date): void {
    const key = `${userId}-${refreshType}`;
    const reminder = this.reminders.get(key);
    
    if (reminder) {
      reminder.status = 'refreshed';
      reminder.lastRefreshedAt = new Date();
      reminder.currentExpiryDate = newExpiryDate;
      reminder.daysUntilExpiry = this.calculateDaysUntilExpiry(newExpiryDate);
      reminder.remindersSent = [];
      reminder.status = 'active';
      
      this.reminders.set(key, reminder);
      console.log(`✅ [Annual Refresh] ${refreshType} refreshed for user ${userId.substring(0, 8)}..., new expiry: ${newExpiryDate.toISOString()}`);
    }
  }

  /**
   * Process due reminders (called by cron job)
   */
  async processDueReminders(): Promise<{
    processed: number;
    emailsSent: number;
    smsSent: number;
    errors: string[];
  }> {
    const now = new Date();
    this.lastCronRun = now;
    
    let processed = 0;
    let emailsSent = 0;
    let smsSent = 0;
    const errors: string[] = [];

    for (const [key, reminder] of this.reminders.entries()) {
      if (reminder.status !== 'active') continue;

      reminder.daysUntilExpiry = this.calculateDaysUntilExpiry(reminder.currentExpiryDate);

      // Check if expired
      if (reminder.daysUntilExpiry <= 0) {
        reminder.status = 'expired';
        await this.blockUserProducts(reminder.userId, reminder.refreshType);
      }

      // Find applicable reminder config
      const config = this.findApplicableConfig(reminder);
      if (!config) continue;

      // Check if this reminder was already sent
      const alreadySent = reminder.remindersSent.some(r => r.type === config.reminderType);
      if (alreadySent) continue;

      // Send reminders
      try {
        const result = await this.sendReminders(reminder, config);
        
        reminder.remindersSent.push({
          type: config.reminderType,
          sentAt: now,
          channel: config.channels.length > 1 ? 'both' : config.channels[0],
          success: result.success
        });

        if (result.emailSent) emailsSent++;
        if (result.smsSent) smsSent++;
        processed++;

        this.reminders.set(key, reminder);
      } catch (error) {
        errors.push(`Failed to send reminder to ${reminder.userId}: ${(error as Error).message}`);
      }
    }

    console.log(`📧 [Annual Refresh] Cron run complete: ${processed} processed, ${emailsSent} emails, ${smsSent} SMS`);

    return { processed, emailsSent, smsSent, errors };
  }

  /**
   * Get users needing refresh action
   */
  getUsersNeedingRefresh(
    daysThreshold: number = 30
  ): Array<{
    userId: string;
    refreshType: string;
    daysUntilExpiry: number;
    email: string;
    priority: string;
  }> {
    const users: Array<{
      userId: string;
      refreshType: string;
      daysUntilExpiry: number;
      email: string;
      priority: string;
    }> = [];

    for (const reminder of this.reminders.values()) {
      if (reminder.status !== 'active') continue;
      if (reminder.daysUntilExpiry > daysThreshold) continue;

      let priority = 'low';
      if (reminder.daysUntilExpiry <= 3) priority = 'critical';
      else if (reminder.daysUntilExpiry <= 7) priority = 'high';
      else if (reminder.daysUntilExpiry <= 15) priority = 'medium';

      users.push({
        userId: reminder.userId,
        refreshType: reminder.refreshType,
        daysUntilExpiry: reminder.daysUntilExpiry,
        email: reminder.email,
        priority
      });
    }

    return users.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Get reminder status for user
   */
  getReminderStatus(userId: string): RefreshReminder[] {
    const userReminders: RefreshReminder[] = [];
    
    for (const [key, reminder] of this.reminders.entries()) {
      if (key.startsWith(`${userId}-`)) {
        userReminders.push(reminder);
      }
    }

    return userReminders;
  }

  /**
   * Generate reminder email content
   */
  generateEmailContent(reminder: RefreshReminder, config: ReminderConfig): {
    subject: string;
    body: string;
  } {
    const refreshTypeLabels: { [key: string]: string } = {
      kyc: 'KYC verification',
      risk_profile: 'Risk Profile assessment',
      accreditation: 'Accredited Investor status',
      w8_form: 'W-8 Tax Form'
    };

    const label = refreshTypeLabels[reminder.refreshType] || reminder.refreshType;
    const urgency = reminder.daysUntilExpiry <= 3 ? 'URGENT: ' : '';

    let subject: string;
    let body: string;

    if (reminder.daysUntilExpiry <= 0) {
      subject = `${urgency}Your ${label} has expired - Action required`;
      body = `Dear Customer,

Your ${label} has expired. To continue accessing our services, please complete the refresh process immediately.

Until you complete the refresh:
- Access to certain products may be restricted
- Some transactions may be blocked

Click here to refresh your ${label}: [REFRESH_LINK]

If you have any questions, please contact our support team.

Best regards,
FintekPro Team`;
    } else {
      subject = `${urgency}Your ${label} expires in ${reminder.daysUntilExpiry} day${reminder.daysUntilExpiry > 1 ? 's' : ''}`;
      body = `Dear Customer,

This is a reminder that your ${label} will expire on ${reminder.currentExpiryDate.toLocaleDateString()}.

Please complete the refresh process to ensure uninterrupted access to our services.

Days remaining: ${reminder.daysUntilExpiry}

Click here to refresh your ${label}: [REFRESH_LINK]

If you have already completed the refresh, please ignore this email.

Best regards,
FintekPro Team`;
    }

    return { subject, body };
  }

  /**
   * Generate SMS content
   */
  generateSMSContent(reminder: RefreshReminder): string {
    const refreshTypeLabels: { [key: string]: string } = {
      kyc: 'KYC',
      risk_profile: 'Risk Profile',
      accreditation: 'Accreditation',
      w8_form: 'W-8 Form'
    };

    const label = refreshTypeLabels[reminder.refreshType] || reminder.refreshType;

    if (reminder.daysUntilExpiry <= 0) {
      return `FintekPro: Your ${label} has expired. Login now to complete refresh and restore access. [LINK]`;
    }

    return `FintekPro: Your ${label} expires in ${reminder.daysUntilExpiry} day(s). Login to refresh. [LINK]`;
  }

  /**
   * Export compliance report
   */
  exportComplianceReport(): {
    totalRegistered: number;
    byType: { [key: string]: number };
    byStatus: { [key: string]: number };
    upcomingExpirations: { [key: string]: number };
    lastCronRun: Date | null;
  } {
    const byType: { [key: string]: number } = {};
    const byStatus: { [key: string]: number } = {};
    const upcomingExpirations: { [key: string]: number } = {
      '7_days': 0,
      '30_days': 0,
      '90_days': 0
    };

    for (const reminder of this.reminders.values()) {
      byType[reminder.refreshType] = (byType[reminder.refreshType] || 0) + 1;
      byStatus[reminder.status] = (byStatus[reminder.status] || 0) + 1;

      if (reminder.status === 'active') {
        if (reminder.daysUntilExpiry <= 7) upcomingExpirations['7_days']++;
        if (reminder.daysUntilExpiry <= 30) upcomingExpirations['30_days']++;
        if (reminder.daysUntilExpiry <= 90) upcomingExpirations['90_days']++;
      }
    }

    return {
      totalRegistered: this.reminders.size,
      byType,
      byStatus,
      upcomingExpirations,
      lastCronRun: this.lastCronRun
    };
  }

  private calculateDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private findApplicableConfig(reminder: RefreshReminder): ReminderConfig | null {
    for (const config of this.REMINDER_SCHEDULE) {
      if (reminder.daysUntilExpiry <= config.daysBefore) {
        return config;
      }
    }
    return null;
  }

  private async sendReminders(
    reminder: RefreshReminder,
    config: ReminderConfig
  ): Promise<{ success: boolean; emailSent: boolean; smsSent: boolean }> {
    let emailSent = false;
    let smsSent = false;

    if (config.channels.includes('email')) {
      const { subject, body } = this.generateEmailContent(reminder, config);
      // In production, use actual email service
      console.log(`📧 [Annual Refresh] Would send email to ${reminder.email}: ${subject}`);
      emailSent = true;
    }

    if (config.channels.includes('sms') && reminder.mobile) {
      const smsContent = this.generateSMSContent(reminder);
      // In production, use actual SMS service (Twilio)
      console.log(`📱 [Annual Refresh] Would send SMS to ${reminder.mobile}: ${smsContent}`);
      smsSent = true;
    }

    return { success: true, emailSent, smsSent };
  }

  private async blockUserProducts(userId: string, refreshType: string): Promise<void> {
    // In production, integrate with product access control
    console.log(`🔒 [Annual Refresh] Blocking products for user ${userId} due to expired ${refreshType}`);
  }
}

export const kycAnnualRefreshService = new KYCAnnualRefreshService();
export type { RefreshReminder, ReminderConfig };
