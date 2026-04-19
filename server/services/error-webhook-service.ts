import { db } from "../db";
import { 
  errorWebhookConfig, 
  errorAlertHistory,
  errorAlertThreshold,
  type ErrorWebhookConfig,
  type InsertErrorAlertHistory,
  type ErrorAlertThreshold
} from "../../shared/schema";
import { eq, and, gte, isNull, or } from "drizzle-orm";
import axios from "axios";
import * as schema from "@shared/schema";

interface AlertPayload {
  alertType: 'critical' | 'spike';
  errorCode: string;
  module: string;
  message: string;
  severity: string;
  errorIds: string[];
  occurrenceCount?: number;
  windowMinutes?: number;
  environment: string;
  timestamp: string;
}

interface SlackMessage {
  text: string;
  attachments?: Array<{
    color: string;
    title: string;
    text: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
    footer: string;
    ts: number;
  }>;
}

interface TeamsMessage {
  "@type": string;
  "@context": string;
  themeColor: string;
  summary: string;
  sections: Array<{
    activityTitle: string;
    activitySubtitle: string;
    facts: Array<{ name: string; value: string }>;
    markdown: boolean;
  }>;
}

class ErrorWebhookService {
  

  async getActiveWebhooks(environment: string = 'production'): Promise<ErrorWebhookConfig[]> {
    try {
      const webhooks = await db.select()
        .from(errorWebhookConfig)
        .where(and(
          eq(errorWebhookConfig.isEnabled, true),
          or(
            eq(errorWebhookConfig.environment, environment),
            eq(errorWebhookConfig.environment, 'all')
          )
        ));
      return webhooks;
    } catch (error) {
      console.error('[ErrorWebhookService] Failed to get active webhooks:', error);
      return [];
    }
  }

  async sendCriticalAlert(payload: AlertPayload): Promise<void> {
    const webhooks = await this.getActiveWebhooks(payload.environment);
    const criticalWebhooks = webhooks.filter(w => w.triggerOnCritical);
    
    console.log(`[ErrorWebhookService] Sending critical alert to ${criticalWebhooks.length} webhooks`);
    
    await Promise.allSettled(
      criticalWebhooks.map(webhook => this.sendToWebhook(webhook, payload))
    );
  }

  async sendSpikeAlert(payload: AlertPayload): Promise<void> {
    const webhooks = await this.getActiveWebhooks(payload.environment);
    const spikeWebhooks = webhooks.filter(w => w.triggerOnSpike);
    
    console.log(`[ErrorWebhookService] Sending spike alert to ${spikeWebhooks.length} webhooks`);
    
    await Promise.allSettled(
      spikeWebhooks.map(webhook => this.sendToWebhook(webhook, payload))
    );
  }

  private async sendToWebhook(webhook: ErrorWebhookConfig, payload: AlertPayload): Promise<void> {
    const cooldownMs = (webhook.cooldownMinutes || 5) * 60 * 1000;
    const now = new Date();
    
    if (webhook.lastTriggeredAt) {
      const timeSinceLastTrigger = now.getTime() - new Date(webhook.lastTriggeredAt).getTime();
      if (timeSinceLastTrigger < cooldownMs) {
        console.log(`[ErrorWebhookService] Webhook ${webhook.name} is in cooldown, skipping`);
        return;
      }
    }
    
    if (webhook.triggerModules && webhook.triggerModules.length > 0) {
      if (!webhook.triggerModules.includes(payload.module)) {
        console.log(`[ErrorWebhookService] Module ${payload.module} not in webhook trigger list, skipping`);
        return;
      }
    }
    
    const alertHistory: InsertErrorAlertHistory = {
      alertType: payload.alertType,
      webhookConfigId: webhook.id,
      errorIds: payload.errorIds,
      errorCode: payload.errorCode,
      module: payload.module,
      occurrenceCount: payload.occurrenceCount,
      windowMinutes: payload.windowMinutes,
      deliveryStatus: 'pending',
      deliveryAttempts: 0
    };

    try {
      const formattedPayload = this.formatPayload(webhook.provider, payload);
      
      const response = await axios.post(webhook.webhookUrl, formattedPayload, {
        timeout: 10000,
        headers: this.getHeaders(webhook.provider)
      });

      alertHistory.deliveryStatus = 'sent';
      alertHistory.deliveryResponse = JSON.stringify({ status: response.status });
      
      await db.update(errorWebhookConfig)
        .set({ lastTriggeredAt: now, updatedAt: now })
        .where(eq(errorWebhookConfig.id, webhook.id));
      
      console.log(`[ErrorWebhookService] Successfully sent alert to ${webhook.name}`);
    } catch (error: any) {
      console.error(`[ErrorWebhookService] Failed to send to ${webhook.name}:`, error.message);
      alertHistory.deliveryStatus = 'failed';
      alertHistory.deliveryResponse = error.message;
    } finally {
      alertHistory.deliveryAttempts = 1;
      try {
        await db.insert(errorAlertHistory).values(alertHistory);
      } catch (dbError) {
        console.error('[ErrorWebhookService] Failed to record alert history:', dbError);
      }
    }
  }

  private formatPayload(provider: string, payload: AlertPayload): any {
    switch (provider) {
      case 'slack':
        return this.formatSlackPayload(payload);
      case 'teams':
        return this.formatTeamsPayload(payload);
      case 'discord':
        return this.formatDiscordPayload(payload);
      default:
        return payload;
    }
  }

  private formatSlackPayload(payload: AlertPayload): SlackMessage {
    const emoji = payload.alertType === 'critical' ? '🚨' : '📈';
    const color = payload.alertType === 'critical' ? '#dc2626' : '#f59e0b';
    
    const fields = [
      { title: 'Module', value: payload.module, short: true },
      { title: 'Severity', value: payload.severity, short: true },
      { title: 'Environment', value: payload.environment, short: true },
      { title: 'Occurrences', value: String(payload.occurrenceCount || 1), short: true },
      ...(payload.windowMinutes ? [{ title: 'Window', value: `${payload.windowMinutes} min`, short: true }] : []),
      { title: 'Error IDs', value: payload.errorIds.slice(0, 3).join(', ') + (payload.errorIds.length > 3 ? '...' : ''), short: false }
    ];

    
    return {
      text: `${emoji} *FintekPro Error Alert*`,
      attachments: [{
        color,
        title: `${payload.alertType.toUpperCase()}: ${payload.errorCode}`,
        text: payload.message,
        fields,
        footer: 'FintekPro Error Tracking',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  private formatTeamsPayload(payload: AlertPayload): TeamsMessage {
    const color = payload.alertType === 'critical' ? 'dc2626' : 'f59e0b';
    
    const facts = [
      { name: "Module", value: payload.module },
      { name: "Severity", value: payload.severity },
      { name: "Environment", value: payload.environment },
      { name: "Occurrences", value: String(payload.occurrenceCount || 1) },
      { name: "Time", value: payload.timestamp }
    ];

    
    return {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: color,
      summary: `FintekPro ${payload.alertType.toUpperCase()} Alert`,
      sections: [{
        activityTitle: `${payload.alertType.toUpperCase()}: ${payload.errorCode}`,
        activitySubtitle: payload.message,
        facts,
        markdown: true
      }]
    };
  }

  private formatDiscordPayload(payload: AlertPayload): any {
    const color = payload.alertType === 'critical' ? 0xdc2626 : 0xf59e0b;
    
    const fields = [
      { name: 'Module', value: payload.module, inline: true },
      { name: 'Severity', value: payload.severity, inline: true },
      { name: 'Environment', value: payload.environment, inline: true },
      { name: 'Occurrences', value: String(payload.occurrenceCount || 1), inline: true }
    ];

    
    return {
      content: `**FintekPro Error Alert**`,
      embeds: [{
        title: `${payload.alertType.toUpperCase()}: ${payload.errorCode}`,
        description: payload.message,
        color,
        fields,
        timestamp: payload.timestamp,
        footer: { text: 'FintekPro Error Tracking' }
      }]
    };
  }

  private getHeaders(provider: string): Record<string, string> {
    return { 'Content-Type': 'application/json' };
  }

  async createWebhookConfig(config: {
    name: string;
    provider: string;
    webhookUrl: string;
    environment?: string;
    triggerOnCritical?: boolean;
    triggerOnSpike?: boolean;
    triggerModules?: string[];
    cooldownMinutes?: number;
    createdBy?: string;
  }): Promise<ErrorWebhookConfig> {
    const [newConfig] = await db.insert(errorWebhookConfig).values({
      name: config.name,
      provider: config.provider,
      webhookUrl: config.webhookUrl,
      environment: config.environment || 'production',
      triggerOnCritical: config.triggerOnCritical ?? true,
      triggerOnSpike: config.triggerOnSpike ?? true,
      triggerModules: config.triggerModules,
      cooldownMinutes: config.cooldownMinutes || 5,
      createdBy: config.createdBy
    }).returning();
    
    return newConfig;
  }

  async updateWebhookConfig(id: string, updates: Partial<{
    name: string;
    webhookUrl: string;
    isEnabled: boolean;
    environment: string;
    triggerOnCritical: boolean;
    triggerOnSpike: boolean;
    triggerModules: string[];
    cooldownMinutes: number;
  }>): Promise<ErrorWebhookConfig | null> {
    const [updated] = await db.update(errorWebhookConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(errorWebhookConfig.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteWebhookConfig(id: string): Promise<boolean> {
    const result = await db.delete(errorWebhookConfig)
      .where(eq(errorWebhookConfig.id, id));
    return true;
  }

  async getAllWebhookConfigs(): Promise<ErrorWebhookConfig[]> {
    return await db.select().from(errorWebhookConfig);
  }

  async testWebhook(id: string): Promise<{ success: boolean; message: string }> {
    const [webhook] = await db.select()
      .from(errorWebhookConfig)
      .where(eq(errorWebhookConfig.id, id));
    
    if (!webhook) {
      return { success: false, message: 'Webhook configuration not found' };
    }

    const testPayload: AlertPayload = {
      alertType: 'critical',
      errorCode: 'TEST_WEBHOOK',
      module: 'system',
      message: 'This is a test alert from FintekPro Error Tracking',
      severity: 'info',
      errorIds: ['test-001'],
      environment: webhook.environment || 'production',
      timestamp: new Date().toISOString()
    };

    try {
      const formattedPayload = this.formatPayload(webhook.provider, testPayload);
      await axios.post(webhook.webhookUrl, formattedPayload, {
        timeout: 10000,
        headers: this.getHeaders(webhook.provider)
      });
      return { success: true, message: 'Test alert sent successfully' };
    } catch (error: any) {
      return { success: false, message: `Failed to send: ${error.message}` };
    }
  }

  async getThresholdConfig(module?: string, errorCode?: string): Promise<ErrorAlertThreshold | null> {
    try {
      let threshold = null;
      
      if (errorCode) {
        [threshold] = await db.select()
          .from(errorAlertThreshold)
          .where(and(
            eq(errorAlertThreshold.errorCode, errorCode),
            eq(errorAlertThreshold.isEnabled, true)
          ))
          .limit(1);
      }
      
      if (!threshold && module) {
        [threshold] = await db.select()
          .from(errorAlertThreshold)
          .where(and(
            eq(errorAlertThreshold.module, module),
            isNull(errorAlertThreshold.errorCode),
            eq(errorAlertThreshold.isEnabled, true)
          ))
          .limit(1);
      }
      
      if (!threshold) {
        [threshold] = await db.select()
          .from(errorAlertThreshold)
          .where(and(
            isNull(errorAlertThreshold.module),
            isNull(errorAlertThreshold.errorCode),
            eq(errorAlertThreshold.isEnabled, true)
          ))
          .limit(1);
      }
      
      return threshold || { windowMinutes: 5, occurrenceThreshold: 10, autoEscalateToCritical: true } as ErrorAlertThreshold;
    } catch (error) {
      console.error('[ErrorWebhookService] Failed to get threshold config:', error);
      return { windowMinutes: 5, occurrenceThreshold: 10, autoEscalateToCritical: true } as ErrorAlertThreshold;
    }
  }

  async createThresholdConfig(config: {
    module?: string;
    errorCode?: string;
    windowMinutes?: number;
    occurrenceThreshold?: number;
    autoEscalateToCritical?: boolean;
    createdBy?: string;
  }): Promise<ErrorAlertThreshold> {
    const [newThreshold] = await db.insert(errorAlertThreshold).values({
      module: config.module,
      errorCode: config.errorCode,
      windowMinutes: config.windowMinutes || 5,
      occurrenceThreshold: config.occurrenceThreshold || 10,
      autoEscalateToCritical: config.autoEscalateToCritical ?? true,
      createdBy: config.createdBy
    }).returning();
    
    return newThreshold;
  }

  async getAllThresholds(): Promise<ErrorAlertThreshold[]> {
    return await db.select().from(errorAlertThreshold);
  }

  async updateThreshold(id: string, updates: Partial<{
    windowMinutes: number;
    occurrenceThreshold: number;
    isEnabled: boolean;
    autoEscalateToCritical: boolean;
  }>): Promise<ErrorAlertThreshold | null> {
    const [updated] = await db.update(errorAlertThreshold)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(errorAlertThreshold.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteThreshold(id: string): Promise<boolean> {
    await db.delete(errorAlertThreshold).where(eq(errorAlertThreshold.id, id));
    return true;
  }

  async getAlertHistory(limit: number = 50): Promise<any[]> {
    return await db.select()
      .from(errorAlertHistory)
      .orderBy(errorAlertHistory.triggeredAt)
      .limit(limit);
  }
}

export const errorWebhookService = new ErrorWebhookService();
