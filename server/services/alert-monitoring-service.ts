import { db } from "../db";
import { userAlerts, alertHistory, users, userExpenses, portfolioHoldings, portfolios, notificationPreferences } from "../../shared/schema";
import { eq, and, lte, gte, isNull, or, sql, sum } from "drizzle-orm";
import { emailService } from "../email-service";
import { whatsappDispatcher } from './whatsapp-dispatcher';
// smsService removed: SMSService exposes OTP methods only; generic alerts use whatsappDispatcher as fallback
import yahooFinance from 'yahoo-finance2';

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
  private startTime = Date.now();

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
  private async checkAllAlerts(retries = 2): Promise<void> {
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
    } catch (error: any) {
      if (error?.code === 'XX000' && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
        return this.checkAllAlerts(retries - 1);
      }
      if (Date.now() - this.startTime > 120000) {
        console.log("[AlertMonitoring] Cycle skipped due to transient DB issue");
      }
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
        alert.userId ?? '',
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
      const portfolioValue = await this.calculatePortfolioValue(alert.userId ?? '');

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
    const user = alert.userId
      ? await db.query.users.findFirst({ where: eq(users.id, alert.userId) })
      : null;

    if (!user) return;

    // Get user notification preferences (email and whatsapp enabled by default)
    let emailEnabled = true;
    let whatsappEnabled = true;
    let smsEnabled = false;
    try {
      const prefs = alert.userId
        ? await db.query.notificationPreferences.findFirst({
            where: eq(notificationPreferences.userId, alert.userId),
          })
        : null;
      if (prefs) {
        emailEnabled = prefs.emailEnabled ?? true;
        whatsappEnabled = prefs.whatsappEnabled ?? true;
        smsEnabled = prefs.smsEnabled ?? false;
      }
    } catch (prefsError) {
      console.warn('Could not fetch notification preferences, using defaults:', prefsError);
    }

    // Send email notification (default: enabled)
    if (channels.includes('email') && emailEnabled) {
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
        console.log(`✅ Alert email sent to ${user.email}`);
      } catch (error) {
        console.error("Error sending email notification:", error);
      }
    }

    // Send WhatsApp notification via IRIS → Twilio dispatcher
    if (channels.includes('whatsapp') && whatsappEnabled && user.mobile) {
      try {
        const message = `🔔 *FintekPro Alert*\n\n*${alert.alertName}*\n\n📊 Priority: ${alert.priority?.toUpperCase()}\n⚡ Trigger: ${triggerReason}\n\nView details at fintekpro.com/alerts`;
        const result = await whatsappDispatcher.send({
          mobile:   user.mobile,
          message,
          category: 'PORTFOLIO_ALERT',
        });
        if (result.success) {
          console.log(`✅ Alert WhatsApp sent to ${user.mobile.slice(0, 6)}**** via ${result.provider}`);
        }
      } catch (error) {
        console.error("Error sending WhatsApp notification:", error);
      }
    }

    // Send SMS notification (default: disabled, fallback only)
    if (channels.includes('sms') && smsEnabled && user.mobile) {
      try {
        const message = `FintekPro Alert: ${alert.alertName} - ${triggerReason}. View details at fintekpro.com/alerts`;
        // SMSService exposes OTP methods only — generic SMS delivery uses WhatsApp dispatcher as primary channel
        console.warn(`[AlertMonitor] SMS channel requested for alert ${alert.id} but generic send is not available; delivering via WhatsApp fallback.`);
        const result = await whatsappDispatcher.send({
          mobile: user.mobile,
          message,
          category: 'PORTFOLIO_ALERT',
        });
        if (result.success) {
          console.log(`✅ Alert SMS-fallback (WhatsApp) sent to ${user.mobile}`);
        }
      } catch (error) {
        console.error("Error sending SMS notification:", error);
      }
    }
  }

  // Helper: Fetch market data using Yahoo Finance API
  private async fetchMarketData(symbol: string): Promise<MarketQuote | null> {
    try {
      const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
      
      const quote = await yahooFinance.quote(yahooSymbol);
      
      if (!quote || !quote.regularMarketPrice) {
        console.warn(`[AlertMonitor] No market data for ${symbol}`);
        return null;
      }
      
      return {
        symbol: symbol,
        currentPrice: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
      };
    } catch (error: any) {
      console.warn(`[AlertMonitor] Failed to fetch market data for ${symbol}:`, error.message);
      
      const fallbackPrices: Record<string, MarketQuote> = {
        'RELIANCE': { symbol: 'RELIANCE', currentPrice: 2450, change: 25, changePercent: 1.03, volume: 5000000 },
        'TCS': { symbol: 'TCS', currentPrice: 3680, change: -15, changePercent: -0.41, volume: 2000000 },
        'INFY': { symbol: 'INFY', currentPrice: 1520, change: 10, changePercent: 0.66, volume: 8000000 },
        'HDFCBANK': { symbol: 'HDFCBANK', currentPrice: 1650, change: -8, changePercent: -0.48, volume: 6000000 },
        '^NSEI': { symbol: '^NSEI', currentPrice: 22150, change: 120, changePercent: 0.54, volume: 1000000 },
      };
      return fallbackPrices[symbol] || null;
    }
  }

  // Helper: Calculate spending for a period
  private async calculateSpending(
    userId: string,
    category: string,
    period: string
  ): Promise<number> {
    try {
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to monthly
      }

      // Build query with proper category filtering
      let whereClause;
      if (category && category !== 'all' && category !== '') {
        whereClause = and(
          eq(userExpenses.userId, userId),
          gte(userExpenses.transactionDate, startDate),
          lte(userExpenses.transactionDate, now),
          eq(userExpenses.category, category)
        );
      } else {
        whereClause = and(
          eq(userExpenses.userId, userId),
          gte(userExpenses.transactionDate, startDate),
          lte(userExpenses.transactionDate, now)
        );
      }

      const result = await db
        .select({
          totalSpending: sql<string>`COALESCE(SUM(CAST(${userExpenses.amount} AS NUMERIC)), 0)`
        })
        .from(userExpenses)
        .where(whereClause);

      const totalSpending = parseFloat(result[0]?.totalSpending || '0');
      console.log(`[AlertMonitor] Calculated spending for user ${userId}, category: ${category}, period: ${period}: ₹${totalSpending.toLocaleString()}`);
      
      return totalSpending;
    } catch (error: any) {
      console.error(`[AlertMonitor] Failed to calculate spending for user ${userId}:`, error.message);
      return 0;
    }
  }

  // Helper: Calculate portfolio value
  private async calculatePortfolioValue(userId: string): Promise<number> {
    try {
      // Get user's portfolios
      const userPortfolios = await db
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(eq(portfolios.userId, userId));

      if (userPortfolios.length === 0) {
        return 0;
      }

      const portfolioIds = userPortfolios.map(p => p.id);
      
      // Get all holdings across user's portfolios
      const holdings = await db
        .select({
          symbol: portfolioHoldings.symbol,
          quantity: portfolioHoldings.quantity,
          avgPrice: portfolioHoldings.avgPrice,
          assetType: portfolioHoldings.assetType
        })
        .from(portfolioHoldings)
        .where(sql`${portfolioHoldings.portfolioId} = ANY(${portfolioIds})`);

      if (holdings.length === 0) {
        return 0;
      }

      // Calculate current value for each holding
      let totalValue = 0;
      
      for (const holding of holdings) {
        const quantity = parseFloat(holding.quantity || '0');
        const avgPrice = parseFloat(holding.avgPrice || '0');
        
        // For equities and mutual funds, try to get current price
        if (['equity', 'mf'].includes(holding.assetType)) {
          try {
            const quote = await this.fetchMarketData(holding.symbol ?? '');
            if (quote) {
              totalValue += quantity * quote.currentPrice;
              continue;
            }
          } catch {
            // Fall through to use avg price
          }
        }
        
        // For other assets or if market data unavailable, use avg price
        totalValue += quantity * avgPrice;
      }

      console.log(`[AlertMonitor] Calculated portfolio value for user ${userId}: ₹${totalValue.toLocaleString()}`);
      return totalValue;
    } catch (error: any) {
      console.error(`[AlertMonitor] Failed to calculate portfolio value for user ${userId}:`, error.message);
      return 0;
    }
  }
}

// Export singleton instance
export const alertMonitoringService = AlertMonitoringService.getInstance();
