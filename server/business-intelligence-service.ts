import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BusinessMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  avgTransactionValue: number;
  customerAcquisitionCost: number;
  customerLifetimeValue: number;
  churnRate: number;
  netPromoterScore?: number;
  avgResponseTime: number;
  customerSatisfaction: number;
  serviceIncidents: number;
  averageResolutionTime: number;
  productSales: { [key: string]: { count: number; revenue: number } };
  topProducts: { name: string; revenue: number; sales: number }[];
  userGrowthRate: number;
  revenueGrowthRate: number;
  profitMargin: number;
}

export interface AIInsight {
  id: string;
  category: 'profitability' | 'service_quality' | 'market_reputation' | 'marketing' | 'operations';
  title: string;
  summary: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'revenue' | 'cost' | 'customer_satisfaction' | 'efficiency' | 'growth';
  recommendations: string[];
  metrics: { label: string; value: string; trend?: 'up' | 'down' | 'stable' }[];
  detailedAnalysis: string;
  actionItems: { action: string; estimatedImpact: string; timeframe: string }[];
  generatedAt: string;
}

export class BusinessIntelligenceService {
  
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      // Get all users
      const allUsers = await storage.getAllUsers();
      const totalUsers = allUsers.length;
      
      // Get active users (logged in within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = allUsers.filter(u => 
        u.lastLoginAt && new Date(u.lastLoginAt) > thirtyDaysAgo
      ).length;
      
      // Get products for revenue calculation
      const products = await storage.getProducts({});
      
      // Calculate revenue metrics (mock data for now - replace with actual transaction data)
      const totalRevenue = products.reduce((sum, p) => sum + (p.revenueGenerated || 0), 0);
      const monthlyRevenue = totalRevenue / 12; // Simplified
      
      // Calculate other metrics
      const avgTransactionValue = totalRevenue / Math.max(totalUsers, 1);
      const customerAcquisitionCost = 50; // Mock - replace with actual marketing spend data
      const customerLifetimeValue = avgTransactionValue * 5; // Simplified estimation
      const churnRate = 0.05; // 5% monthly churn - replace with actual data
      
      // Service metrics
      const avgResponseTime = 2.5; // hours - mock data
      const customerSatisfaction = 4.2; // out of 5 - mock data
      const serviceIncidents = 12; // mock data
      const averageResolutionTime = 4.5; // hours - mock data
      
      // Product sales analysis
      const productSales: { [key: string]: { count: number; revenue: number } } = {};
      const topProducts: { name: string; revenue: number; sales: number }[] = [];
      
      products.forEach(p => {
        if (p.category) {
          if (!productSales[p.category]) {
            productSales[p.category] = { count: 0, revenue: 0 };
          }
          productSales[p.category].count += 1;
          productSales[p.category].revenue += p.revenueGenerated || 0;
          
          topProducts.push({
            name: p.name,
            revenue: p.revenueGenerated || 0,
            sales: p.unitsSold || 0
          });
        }
      });
      
      // Sort top products
      topProducts.sort((a, b) => b.revenue - a.revenue);
      
      // Growth rates (mock - replace with historical data comparison)
      const userGrowthRate = 0.15; // 15% monthly growth
      const revenueGrowthRate = 0.22; // 22% monthly growth
      const profitMargin = 0.35; // 35% profit margin
      
      return {
        totalUsers,
        activeUsers,
        totalRevenue,
        monthlyRevenue,
        avgTransactionValue,
        customerAcquisitionCost,
        customerLifetimeValue,
        churnRate,
        avgResponseTime,
        customerSatisfaction,
        serviceIncidents,
        averageResolutionTime,
        productSales,
        topProducts: topProducts.slice(0, 10),
        userGrowthRate,
        revenueGrowthRate,
        profitMargin
      };
    } catch (error) {
      console.error('Error fetching business metrics:', error);
      throw error;
    }
  }
  
  async generateProfitabilityInsights(metrics: BusinessMetrics): Promise<AIInsight> {
    const prompt = `You are a financial analyst and business strategist. Analyze the following business metrics and provide actionable insights to improve profitability.

Business Metrics:
- Total Revenue: ₹${metrics.totalRevenue.toLocaleString()}
- Monthly Revenue: ₹${metrics.monthlyRevenue.toLocaleString()}
- Average Transaction Value: ₹${metrics.avgTransactionValue.toFixed(2)}
- Customer Acquisition Cost: ₹${metrics.customerAcquisitionCost}
- Customer Lifetime Value: ₹${metrics.customerLifetimeValue.toFixed(2)}
- Profit Margin: ${(metrics.profitMargin * 100).toFixed(1)}%
- Revenue Growth Rate: ${(metrics.revenueGrowthRate * 100).toFixed(1)}%
- Top Products: ${metrics.topProducts.slice(0, 5).map(p => `${p.name} (₹${p.revenue})`).join(', ')}

Provide specific, actionable recommendations to:
1. Increase revenue and profitability
2. Optimize pricing strategies
3. Reduce customer acquisition costs
4. Increase customer lifetime value
5. Improve product mix and cross-selling opportunities

Format your response as a JSON object.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
              impact: { type: "string", enum: ["revenue", "cost", "customer_satisfaction", "efficiency", "growth"] },
              recommendations: { type: "array", items: { type: "string" } },
              metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    trend: { type: "string", enum: ["up", "down", "stable"] }
                  }
                }
              },
              detailedAnalysis: { type: "string" },
              actionItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string" },
                    estimatedImpact: { type: "string" },
                    timeframe: { type: "string" }
                  }
                }
              }
            },
            required: ["title", "summary", "priority", "recommendations", "detailedAnalysis", "actionItems"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("Empty response from Gemini API");
      
      const insight = JSON.parse(rawJson);
      return {
        id: `profitability-${Date.now()}`,
        category: 'profitability',
        ...insight,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error;
    }
  }
  
  async generateServiceQualityInsights(metrics: BusinessMetrics): Promise<AIInsight> {
    const prompt = `You are a customer service expert and operations manager. Analyze the following service metrics and provide recommendations to improve service quality and customer satisfaction.

Service Metrics:
- Customer Satisfaction Score: ${metrics.customerSatisfaction}/5.0
- Average Response Time: ${metrics.avgResponseTime} hours
- Service Incidents: ${metrics.serviceIncidents} this month
- Average Resolution Time: ${metrics.averageResolutionTime} hours
- Active Users: ${metrics.activeUsers}/${metrics.totalUsers}
- Churn Rate: ${(metrics.churnRate * 100).toFixed(1)}%

Provide specific recommendations to:
1. Reduce response and resolution times
2. Improve customer satisfaction scores
3. Reduce service incidents
4. Improve customer retention and reduce churn
5. Enhance overall service quality standards

Format your response as a JSON object.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
              impact: { type: "string", enum: ["revenue", "cost", "customer_satisfaction", "efficiency", "growth"] },
              recommendations: { type: "array", items: { type: "string" } },
              metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    trend: { type: "string", enum: ["up", "down", "stable"] }
                  }
                }
              },
              detailedAnalysis: { type: "string" },
              actionItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string" },
                    estimatedImpact: { type: "string" },
                    timeframe: { type: "string" }
                  }
                }
              }
            },
            required: ["title", "summary", "priority", "recommendations", "detailedAnalysis", "actionItems"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("Empty response from Gemini API");
      
      const insight = JSON.parse(rawJson);
      return {
        id: `service-${Date.now()}`,
        category: 'service_quality',
        ...insight,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error;
    }
  }
  
  async generateMarketingInsights(metrics: BusinessMetrics): Promise<AIInsight> {
    const prompt = `You are a growth marketing strategist and digital marketing expert. Analyze the following business data and provide creative, data-driven marketing strategies.

Business Data:
- Total Users: ${metrics.totalUsers}
- Active Users: ${metrics.activeUsers}
- User Growth Rate: ${(metrics.userGrowthRate * 100).toFixed(1)}% monthly
- Customer Acquisition Cost: ₹${metrics.customerAcquisitionCost}
- Customer Lifetime Value: ₹${metrics.customerLifetimeValue.toFixed(2)}
- Top Product Categories: ${Object.keys(metrics.productSales).slice(0, 5).join(', ')}
- Revenue Growth: ${(metrics.revenueGrowthRate * 100).toFixed(1)}% monthly

Provide innovative marketing strategies to:
1. Acquire new customers cost-effectively
2. Increase brand awareness and market reputation
3. Improve customer engagement and retention
4. Launch targeted campaigns for different customer segments
5. Leverage digital marketing channels (social media, content, SEO, email)
6. Create viral marketing opportunities

Format your response as a JSON object with creative, actionable marketing ideas.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
              impact: { type: "string", enum: ["revenue", "cost", "customer_satisfaction", "efficiency", "growth"] },
              recommendations: { type: "array", items: { type: "string" } },
              metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    trend: { type: "string", enum: ["up", "down", "stable"] }
                  }
                }
              },
              detailedAnalysis: { type: "string" },
              actionItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string" },
                    estimatedImpact: { type: "string" },
                    timeframe: { type: "string" }
                  }
                }
              }
            },
            required: ["title", "summary", "priority", "recommendations", "detailedAnalysis", "actionItems"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("Empty response from Gemini API");
      
      const insight = JSON.parse(rawJson);
      return {
        id: `marketing-${Date.now()}`,
        category: 'marketing',
        ...insight,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error;
    }
  }
  
  async generateOperationalInsights(metrics: BusinessMetrics): Promise<AIInsight> {
    const prompt = `You are an operations consultant and efficiency expert. Analyze the following operational data and provide recommendations to optimize business operations.

Operational Data:
- Total Users: ${metrics.totalUsers}
- Active Users: ${metrics.activeUsers} (${((metrics.activeUsers/metrics.totalUsers)*100).toFixed(1)}% active)
- Service Incidents: ${metrics.serviceIncidents}
- Average Response Time: ${metrics.avgResponseTime} hours
- Average Resolution Time: ${metrics.averageResolutionTime} hours
- Products Managed: ${Object.keys(metrics.productSales).length} categories
- Profit Margin: ${(metrics.profitMargin * 100).toFixed(1)}%

Provide specific recommendations to:
1. Streamline operations and reduce inefficiencies
2. Automate repetitive tasks and processes
3. Optimize resource allocation
4. Reduce operational costs
5. Improve team productivity
6. Identify bottlenecks and process improvements

Format your response as a JSON object with actionable operational improvements.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
              impact: { type: "string", enum: ["revenue", "cost", "customer_satisfaction", "efficiency", "growth"] },
              recommendations: { type: "array", items: { type: "string" } },
              metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    trend: { type: "string", enum: ["up", "down", "stable"] }
                  }
                }
              },
              detailedAnalysis: { type: "string" },
              actionItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string" },
                    estimatedImpact: { type: "string" },
                    timeframe: { type: "string" }
                  }
                }
              }
            },
            required: ["title", "summary", "priority", "recommendations", "detailedAnalysis", "actionItems"]
          }
        },
        contents: prompt,
      });

      const rawJson = response.text;
      if (!rawJson) throw new Error("Empty response from Gemini API");
      
      const insight = JSON.parse(rawJson);
      return {
        id: `operations-${Date.now()}`,
        category: 'operations',
        ...insight,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw error;
    }
  }
  
  async generateAllInsights(): Promise<AIInsight[]> {
    try {
      const metrics = await this.getBusinessMetrics();
      
      // Generate all insights in parallel
      const [profitability, serviceQuality, marketing, operations] = await Promise.all([
        this.generateProfitabilityInsights(metrics),
        this.generateServiceQualityInsights(metrics),
        this.generateMarketingInsights(metrics),
        this.generateOperationalInsights(metrics)
      ]);
      
      return [profitability, serviceQuality, marketing, operations];
    } catch (error) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }
}

export const businessIntelligence = new BusinessIntelligenceService();
