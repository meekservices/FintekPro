import { generateMarketInsight, analyzePortfolio, explainFinancialConcept } from "./gemini";
import { whatsappService } from "./whatsapp";
import { storage } from "./storage";

export class MarketingAutomationService {
  private campaignRunning = false;

  // AI-powered marketing campaign generator
  async generateMarketingCampaign(targetAudience: string): Promise<{
    subject: string;
    content: string;
    whatsappMessage: string;
  }> {
    const marketData = await this.getLatestMarketData();
    const insight = await generateMarketInsight(marketData);

    return {
      subject: "Your Personalized Market Insights from FinanceHub",
      content: `${insight}\n\nDon't miss out on these opportunities! Visit FinanceHub to optimize your portfolio with AI-powered recommendations.`,
      whatsappMessage: `🏦 *FinanceHub Market Update*\n\n${insight}\n\n📱 Login to your account for detailed analysis and recommendations!`
    };
  }

  // Automated portfolio marketing with AI insights
  async sendPortfolioMarketingMessages(userSegment: "new_users" | "active_traders" | "long_term_investors"): Promise<void> {
    if (this.campaignRunning) return;
    this.campaignRunning = true;

    try {
      const users = await this.getUsersBySegment(userSegment);
      const marketingContent = await this.generateMarketingCampaign(userSegment);

      for (const user of users) {
        if (user.phone) {
          // Send personalized WhatsApp marketing message
          await whatsappService.sendMessage(
            user.phone,
            this.personalizeMessage(marketingContent.whatsappMessage, user)
          );

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error("Marketing campaign error:", error);
    } finally {
      this.campaignRunning = false;
    }
  }

  // AI-powered customer onboarding sequence
  async sendOnboardingSequence(phoneNumber: string, userName: string): Promise<void> {
    const messages = [
      `🎉 Welcome to FinanceHub, ${userName}!\n\nYour journey to smarter investing starts here. Let's set up your profile for personalized recommendations.`,
      
      `📊 *Getting Started:*\n1. Complete your investor profile\n2. Add your first investment\n3. Get AI-powered insights\n\nReady to build wealth with data-driven decisions?`,
      
      `🤖 *AI-Powered Features:*\n✅ Smart portfolio analysis\n✅ Market trend predictions\n✅ Risk assessment\n✅ Personalized recommendations\n\nYour financial success is our priority!`
    ];

    for (let i = 0; i < messages.length; i++) {
      await whatsappService.sendMessage(phoneNumber, messages[i]);
      // Send messages with 30-second intervals
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  // Automated market alerts with AI analysis
  async sendMarketAlerts(): Promise<void> {
    try {
      const marketData = await this.getLatestMarketData();
      const significantMovements = this.detectSignificantMovements(marketData);

      if (significantMovements.length > 0) {
        const analysis = await generateMarketInsight(significantMovements);
        const subscribers = await this.getMarketAlertSubscribers();

        for (const subscriber of subscribers) {
          const alertMessage = `🚨 *Market Alert*\n\n${analysis}\n\n📱 Check your FinanceHub portfolio for impact analysis!`;
          await whatsappService.sendMessage(subscriber.phone, alertMessage);
        }
      }
    } catch (error) {
      console.error("Market alert error:", error);
    }
  }

  // AI-driven customer retention campaigns
  async sendRetentionCampaigns(): Promise<void> {
    const inactiveUsers = await this.getInactiveUsers();

    for (const user of inactiveUsers) {
      const explanation = await explainFinancialConcept("portfolio diversification");
      
      const retentionMessage = 
        `💡 *Financial Tip for ${user.name}*\n\n${explanation}\n\n🎯 Come back to FinanceHub and optimize your investments with our AI advisor!`;
      
      if (user.phone) {
        await whatsappService.sendMessage(user.phone, retentionMessage);
      }
    }
  }

  private personalizeMessage(template: string, user: any): string {
    return template.replace(/FinanceHub/g, `FinanceHub for ${user.name || 'you'}`);
  }

  private async getLatestMarketData(): Promise<any> {
    // Mock market data - replace with actual market API calls
    return {
      indices: [
        { symbol: "NIFTY50", price: 24500, change: 1.5 },
        { symbol: "SENSEX", price: 81000, change: 2.1 }
      ],
      topGainers: [
        { symbol: "RELIANCE", change: 3.2 },
        { symbol: "TCS", change: 2.8 }
      ]
    };
  }

  private detectSignificantMovements(marketData: any): any[] {
    return marketData.indices.filter((index: any) => Math.abs(index.change) > 2);
  }

  private async getUsersBySegment(segment: string): Promise<any[]> {
    // Mock user data - integrate with actual user database
    return [
      { id: "1", name: "Demo User", phone: "+919876543210", segment },
      { id: "2", name: "Test User", phone: "+918765432109", segment }
    ];
  }

  private async getMarketAlertSubscribers(): Promise<any[]> {
    return [
      { id: "1", name: "Demo User", phone: "+919876543210" }
    ];
  }

  private async getInactiveUsers(): Promise<any[]> {
    return [
      { id: "1", name: "Demo User", phone: "+919876543210" }
    ];
  }
}

export const marketingService = new MarketingAutomationService();