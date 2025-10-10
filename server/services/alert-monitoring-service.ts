import { db } from "../db";
import { userAlerts, alertHistory, users } from "@shared/schema";
import { eq, and, lte, gte, isNull, or } from "drizzle-orm";
import { emailService } from "../email-service";

interface MarketQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
}

export class AlertMonitoringService {
  private static instance: AlertMonitoringService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): AlertMonitoringService {
    if (!AlertMonitoringService.instance) {
      AlertMonitoringService.instance = new AlertMonitoringService();
    }
    return AlertMonitoringService.instance;
  }

  // Start monitoring service (runs every 5 minutes)
  start() {
    if (this.isRunning) {
      console.log("Alert monitoring service already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting alert monitoring service...");

    // Run immediately on start
    this.checkAllAlerts().catch(console.error);

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.checkAllAlerts().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Stop monitoring service
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Alert monitoring service stopped");
  }

  // Check all active alerts
  private async checkAllAlerts() {
    console.log(`[${new Date().toISOString()}] Checking alerts...`);

    try {
      // Get all active alerts
      const activeAlerts = await db
        .select()
        .from(userAlerts)
        .where(eq(userAlerts.isActive, true));

      console.log(`Found ${activeAlerts.length} active alerts to check`);

      // Process alerts by category
      for (const alert of activeAlerts) {
        try {
          // Check cooldown period to prevent spam
          if (alert.lastTriggeredAt) {
            const cooldownMs = (alert.cooldownPeriod || 3600) * 1000;
            const timeSinceLastTrigger = Date.now() - new Date(alert.lastTriggeredAt).getTime();
            
            if (timeSinceLastTrigger < cooldownMs) {
              continue; // Skip this alert, still in cooldown
            }
          }

          // Route to appropriate checker based on category
          switch (alert.category) {
            case 'market':
              await this.checkMarketAlert(alert);
              break;
            case 'spending':
              await this.checkSpendingAlert(alert);
              break;
            case 'portfolio':
              await this.checkPortfolioAlert(alert);
              break;
          }
        } catch (error) {
          console.error(`Error checking alert ${alert.id}:`, error);
        }
      }

      console.log(`Alert check complete at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Error in checkAllAlerts:", error);
    }
  }

  // Check market price/change alerts
  private async checkMarketAlert(alert: typeof userAlerts.$inferSelect) {
    if (!alert.symbol) return;

    try {
      // Fetch current market data (you can integrate with real market data API)
      const marketData = await this.fetchMarketData(alert.symbol);
      if (!marketData) return;

      const triggerCondition = alert.triggerCondition as any;
      let shouldTrigger = false;
      let triggerReason = "";

      // Check different alert types
      if (alert.alertType === 'market_price') {
        if (triggerCondition.type === 'price_above' && marketData.currentPrice > triggerCondition.value) {
          shouldTrigger = true;
          triggerReason = `${alert.symbol} price reached ₹${marketData.currentPrice.toFixed(2)} (above target ₹${triggerCondition.value})`;
        } else if (triggerCondition.type === 'price_below' && marketData.currentPrice < triggerCondition.value) {
          shouldTrigger = true;
          triggerReason = `${alert.symbol} price dropped to ₹${marketData.currentPrice.toFixed(2)} (below target ₹${triggerCondition.value})`;
        }
      } else if (alert.alertType === 'market_change') {
        if (triggerCondition.type === 'percent_gain' && marketData.changePercent >= triggerCondition.value) {
          shouldTrigger = true;
          triggerReason = `${alert.symbol} gained ${marketData.changePercent.toFixed(2)}% (target: ${triggerCondition.value}%)`;
        } else if (triggerCondition.type === 'percent_loss' && marketData.changePercent <= -triggerCondition.value) {
          shouldTrigger = true;
          triggerReason = `${alert.symbol} dropped ${Math.abs(marketData.changePercent).toFixed(2)}% (target: ${triggerCondition.value}%)`;
        }
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert, triggerReason, {
          currentPrice: marketData.currentPrice,
          change: marketData.change,
          changePercent: marketData.changePercent,
          symbol: alert.symbol,
        });
      }
    } catch (error) {
      console.error(`Error checking market alert for ${alert.symbol}:`, error);
    }
  }

  // Check spending budget alerts
  private async checkSpendingAlert(alert: typeof userAlerts.$inferSelect) {
    try {
      const triggerCondition = alert.triggerCondition as any;
      
      // Calculate spending for the specified period
      const spentAmount = await this.calculateSpending(
        alert.userId,
        alert.spendingCategory || 'all',
        alert.spendingPeriod || 'monthly'
      );

      const budgetLimit = triggerCondition.value || 0;
      const thresholdPercent = triggerCondition.threshold || 80; // Default 80%
      const thresholdAmount = (budgetLimit * thresholdPercent) / 100;

      let shouldTrigger = false;
      let triggerReason = "";

      if (triggerCondition.type === 'category_limit') {
        if (spentAmount >= thresholdAmount) {
          const percentUsed = (spentAmount / budgetLimit) * 100;
          shouldTrigger = true;
          triggerReason = `You've spent ₹${spentAmount.toFixed(2)} (${percentUsed.toFixed(0)}%) of your ₹${budgetLimit} ${alert.spendingPeriod} budget for ${alert.spendingCategory}`;
        }
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert, triggerReason, {
          spentAmount,
          budgetLimit,
          percentUsed: (spentAmount / budgetLimit) * 100,
          category: alert.spendingCategory,
          period: alert.spendingPeriod,
        });
      }
    } catch (error) {
      console.error(`Error checking spending alert:`, error);
    }
  }

  // Check portfolio value alerts
  private async checkPortfolioAlert(alert: typeof userAlerts.$inferSelect) {
    try {
      const triggerCondition = alert.triggerCondition as any;
      
      // Calculate portfolio value (integrate with your portfolio service)
      const portfolioValue = await this.calculatePortfolioValue(alert.userId);

      let shouldTrigger = false;
      let triggerReason = "";

      if (triggerCondition.type === 'value_below' && portfolioValue < triggerCondition.value) {
        shouldTrigger = true;
        triggerReason = `Portfolio value dropped to ₹${portfolioValue.toFixed(2)} (below threshold ₹${triggerCondition.value})`;
      } else if (triggerCondition.type === 'value_above' && portfolioValue > triggerCondition.value) {
        shouldTrigger = true;
        triggerReason = `Portfolio value reached ₹${portfolioValue.toFixed(2)} (above target ₹${triggerCondition.value})`;
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert, triggerReason, {
          portfolioValue,
          threshold: triggerCondition.value,
        });
      }
    } catch (error) {
      console.error(`Error checking portfolio alert:`, error);
    }
  }

  // Trigger alert and send notifications
  private async triggerAlert(
    alert: typeof userAlerts.$inferSelect,
    triggerReason: string,
    triggerValue: any
  ) {
    try {
      console.log(`Triggering alert ${alert.id}: ${triggerReason}`);

      // Create alert history entry
      await db.insert(alertHistory).values({
        alertId: alert.id,
        userId: alert.userId,
        triggeredAt: new Date(),
        triggerValue,
        alertSnapshot: alert,
        notificationStatus: 'pending',
        notificationChannels: alert.notificationChannels,
      });

      // Update alert trigger count and last triggered time
      await db
        .update(userAlerts)
        .set({
          lastTriggeredAt: new Date(),
          triggerCount: (alert.triggerCount || 0) + 1,
        })
        .where(eq(userAlerts.id, alert.id));

      // Send notifications
      await this.sendAlertNotifications(alert, triggerReason, triggerValue);

    } catch (error) {
      console.error(`Error triggering alert ${alert.id}:`, error);
    }
  }

  // Send notifications through various channels
  private async sendAlertNotifications(
    alert: typeof userAlerts.$inferSelect,
    triggerReason: string,
    triggerValue: any
  ) {
    const channels = (alert.notificationChannels as string[]) || [];

    // Get user info for notifications
    const user = await db.query.users.findFirst({
      where: eq(users.id, alert.userId),
    });

    if (!user) return;

    // Send email notification
    if (channels.includes('email')) {
      try {
        await emailService.sendEmail({
          to: user.email || '',
          subject: `🔔 Alert: ${alert.alertName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">FintekPro Alert</h2>
              <h3>${alert.alertName}</h3>
              <p><strong>Priority:</strong> ${alert.priority?.toUpperCase()}</p>
              <p><strong>Trigger:</strong> ${triggerReason}</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <pre>${JSON.stringify(triggerValue, null, 2)}</pre>
              </div>
              <p>Log in to FintekPro to view more details and manage your alerts.</p>
              <a href="${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/alerts" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                View Alerts
              </a>
            </div>
          `,
        });
      } catch (error) {
        console.error("Error sending email notification:", error);
      }
    }

    // Additional notification channels can be implemented here
    // - SMS via Twilio
    // - Push notifications
    // - WhatsApp
    // - In-app notifications (stored in database)
  }

  // Helper: Fetch market data (mock implementation - replace with real API)
  private async fetchMarketData(symbol: string): Promise<MarketQuote | null> {
    // TODO: Integrate with real market data API (Yahoo Finance, Alpha Vantage, etc.)
    // For now, return mock data
    
    // Mock data for demonstration
    const mockPrices: Record<string, MarketQuote> = {
      'RELIANCE': { symbol: 'RELIANCE', currentPrice: 2450, change: 25, changePercent: 1.03, volume: 5000000 },
      'TCS': { symbol: 'TCS', currentPrice: 3680, change: -15, changePercent: -0.41, volume: 2000000 },
      'INFY': { symbol: 'INFY', currentPrice: 1520, change: 10, changePercent: 0.66, volume: 8000000 },
      'HDFCBANK': { symbol: 'HDFCBANK', currentPrice: 1650, change: -8, changePercent: -0.48, volume: 6000000 },
      '^NSEI': { symbol: '^NSEI', currentPrice: 22150, change: 120, changePercent: 0.54, volume: 1000000 },
    };

    return mockPrices[symbol] || null;
  }

  // Helper: Calculate spending for a period (mock implementation)
  private async calculateSpending(
    userId: string,
    category: string,
    period: string
  ): Promise<number> {
    // TODO: Integrate with transaction/spending tracking system
    // Query transactions from database and sum by category and period
    
    // Mock implementation
    return Math.random() * 15000; // Random amount for demonstration
  }

  // Helper: Calculate portfolio value (mock implementation)
  private async calculatePortfolioValue(userId: string): Promise<number> {
    // TODO: Integrate with portfolio service to calculate actual value
    // Sum all holdings * current prices
    
    // Mock implementation
    return 500000 + Math.random() * 100000; // Random portfolio value
  }
}

// Export singleton instance
export const alertMonitoringService = AlertMonitoringService.getInstance();
