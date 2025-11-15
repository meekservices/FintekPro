/**
 * Alerting Service
 * 
 * Sends alerts via email and webhooks for critical system events.
 * 
 * Features:
 * - Email alerts using Nodemailer
 * - Webhook notifications
 * - Alert throttling to prevent spam
 * - Configurable severity thresholds
 * - Template-based email formatting
 */

import { logger } from '../logger';
import { emailService } from '../email-service';
import axios from 'axios';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, any>;
  timestamp?: Date;
  source?: string;
}

interface AlertConfig {
  emailEnabled: boolean;
  webhookEnabled: boolean;
  emailRecipients: string[];
  webhookUrl?: string;
  throttleMinutes?: number;
  minSeverity?: AlertSeverity;
}

const DEFAULT_CONFIG: AlertConfig = {
  emailEnabled: false, // Disabled by default until configured
  webhookEnabled: false,
  emailRecipients: [],
  throttleMinutes: 15, // Don't send same alert more than once per 15 minutes
  minSeverity: 'error', // Only alert on errors and above
};

class AlertingService {
  private config: AlertConfig;
  private alertHistory: Map<string, number> = new Map(); // Track last alert time by key

  constructor(config?: Partial<AlertConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Send an alert
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Add timestamp if not provided
    if (!alert.timestamp) {
      alert.timestamp = new Date();
    }

    // Check if severity meets minimum threshold
    if (!this.shouldAlert(alert.severity)) {
      logger.debug(`Alert skipped - severity ${alert.severity} below threshold ${this.config.minSeverity}`);
      return;
    }

    // Check throttling
    const alertKey = this.getAlertKey(alert);
    if (this.isThrottled(alertKey)) {
      logger.debug(`Alert throttled: ${alert.title}`);
      return;
    }

    // Record this alert time
    this.recordAlert(alertKey);

    // Log the alert
    logger.warn(`Sending alert: ${alert.title}`, {
      severity: alert.severity,
      source: alert.source,
    });

    // Send via email
    if (this.config.emailEnabled) {
      await this.sendEmailAlert(alert).catch(error => {
        logger.error('Failed to send email alert', error);
      });
    }

    // Send via webhook
    if (this.config.webhookEnabled && this.config.webhookUrl) {
      await this.sendWebhookAlert(alert).catch(error => {
        logger.error('Failed to send webhook alert', error);
      });
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (this.config.emailRecipients.length === 0) {
      logger.debug('No email recipients configured for alerts');
      return;
    }

    const html = this.formatEmailHtml(alert);
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;

    try {
      // Send to all recipients
      for (const recipient of this.config.emailRecipients) {
        const success = await emailService.sendEmail({
          to: recipient,
          subject,
          html,
        });

        if (!success) {
          logger.warn(`Failed to send email alert to ${recipient}`);
        }
      }

      logger.info(`Email alert sent: ${alert.title}`);
    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) {
      return;
    }

    try {
      await axios.post(
        this.config.webhookUrl,
        {
          ...alert,
          timestamp: alert.timestamp?.toISOString(),
        },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Webhook alert sent: ${alert.title}`);
    } catch (error) {
      throw new Error(`Failed to send webhook: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format alert as HTML email
   */
  private formatEmailHtml(alert: Alert): string {
    const severityColors = {
      info: '#3498db',
      warning: '#f39c12',
      error: '#e74c3c',
      critical: '#c0392b',
    };

    const color = severityColors[alert.severity];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
          .details { background-color: white; padding: 15px; margin-top: 15px; border-radius: 5px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
          .label { font-weight: bold; color: #555; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${alert.title}</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${alert.severity.toUpperCase()} Alert</p>
          </div>
          <div class="content">
            <p>${alert.message}</p>
            
            <div class="details">
              <p><span class="label">Severity:</span> ${alert.severity}</p>
              <p><span class="label">Timestamp:</span> ${alert.timestamp?.toISOString()}</p>
              ${alert.source ? `<p><span class="label">Source:</span> ${alert.source}</p>` : ''}
              
              ${alert.details ? `
                <p><span class="label">Additional Details:</span></p>
                <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto;">${JSON.stringify(alert.details, null, 2)}</pre>
              ` : ''}
            </div>
          </div>
          <div class="footer">
            <p>This is an automated alert from FintekPro Monitoring System.</p>
            <p>If you need to take action, please check the admin dashboard for more details.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Check if alert severity meets minimum threshold
   */
  private shouldAlert(severity: AlertSeverity): boolean {
    const levels = { info: 0, warning: 1, error: 2, critical: 3 };
    return levels[severity] >= levels[this.config.minSeverity || 'error'];
  }

  /**
   * Generate a unique key for an alert (for throttling)
   */
  private getAlertKey(alert: Alert): string {
    return `${alert.severity}:${alert.title}:${alert.source || 'unknown'}`;
  }

  /**
   * Check if alert is throttled
   */
  private isThrottled(alertKey: string): boolean {
    const lastAlertTime = this.alertHistory.get(alertKey);
    if (!lastAlertTime) {
      return false;
    }

    const throttleMs = (this.config.throttleMinutes || 15) * 60 * 1000;
    return Date.now() - lastAlertTime < throttleMs;
  }

  /**
   * Record alert timestamp
   */
  private recordAlert(alertKey: string): void {
    this.alertHistory.set(alertKey, Date.now());

    // Clean up old entries (older than 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, time] of Array.from(this.alertHistory.entries())) {
      if (time < cutoff) {
        this.alertHistory.delete(key);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Alerting service configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  /**
   * Send a test alert
   */
  async sendTestAlert(): Promise<void> {
    await this.sendAlert({
      severity: 'info',
      title: 'Test Alert',
      message: 'This is a test alert from the FintekPro monitoring system.',
      source: 'alerting_service',
      details: {
        testMode: true,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Export singleton instance
export const alertingService = new AlertingService({
  emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  emailEnabled: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
  webhookEnabled: Boolean(process.env.ALERT_WEBHOOK_URL),
});
