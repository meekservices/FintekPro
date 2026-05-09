import { storage } from "./storage";
import type { User } from "@shared/schema";

export interface FunctionParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface FunctionDefinition {
  name: string;
  displayName: string;
  description: string;
  category: 'portfolio' | 'market' | 'transaction' | 'utility' | 'profile';
  parameters: FunctionParameter[];
  requiresConfirmation: boolean;
  requiredRoles?: string[];
  execute: (params: any, user: User) => Promise<any>;
}

export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();

  constructor() {
    this.registerFunctions();
  }

  private registerFunctions() {
    // Portfolio Functions
    this.register({
      name: 'getUserPortfolioSummary',
      displayName: 'Get Portfolio Summary',
      description: 'Get a comprehensive summary of the user\'s investment portfolio including total value, asset allocation, and top holdings.',
      category: 'portfolio',
      parameters: [],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const portfolios = await storage.getPortfoliosByUserId(user.id);
        if (!portfolios.length) {
          return { message: 'No portfolios found. Would you like to create one?' };
        }

        const portfolio = portfolios[0];
        const holdings = await storage.getPortfolioHoldings(portfolio.id);
        const assetAllocation = await storage.getAssetAllocation(portfolio.id);

        const totalValue = parseFloat(portfolio.totalValue || '0');
        
        return {
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          totalValue: portfolio.totalValue,
          cash: portfolio.cash,
          holdingsCount: holdings.length,
          topHoldings: holdings
            .slice(0, 5)
            .map(h => ({
              symbol: h.symbol,
              assetType: h.assetType,
              quantity: h.quantity,
              avgPrice: h.avgPrice,
            })),
          assetAllocation: assetAllocation.map(a => ({
            assetType: a.assetType,
            assetClass: a.assetClass,
            currentValue: a.currentValue,
            currentPercentage: a.currentPercentage,
            targetPercentage: a.targetPercentage,
          })),
        };
      },
    });

    this.register({
      name: 'getPortfolioHoldings',
      displayName: 'Get Portfolio Holdings',
      description: 'Get detailed list of all holdings in the user\'s portfolio with current prices and P&L.',
      category: 'portfolio',
      parameters: [{
        name: 'limit',
        type: 'number',
        description: 'Maximum number of holdings to return',
        required: false,
      }],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const portfolios = await storage.getPortfoliosByUserId(user.id);
        if (!portfolios.length) {
          return { message: 'No portfolios found.' };
        }

        const holdings = await storage.getPortfolioHoldings(portfolios[0].id);
        const limit = params.limit || holdings.length;

        return {
          holdings: holdings.slice(0, limit).map(h => ({
            id: h.id,
            symbol: h.symbol,
            assetType: h.assetType,
            assetClass: h.assetClass,
            quantity: h.quantity,
            avgPrice: h.avgPrice,
            sector: h.sector,
          })),
          totalHoldings: holdings.length,
        };
      },
    });

    this.register({
      name: 'getRecentTransactions',
      displayName: 'Get Recent Transactions',
      description: 'Get a list of recent buy/sell transactions from the user\'s portfolio.',
      category: 'portfolio',
      parameters: [{
        name: 'limit',
        type: 'number',
        description: 'Number of transactions to return (default: 10)',
        required: false,
      }],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const limit = params.limit || 10;
        const transactions = await storage.getTransactionRecords(user.id);

        return {
          transactions: transactions.slice(0, limit).map(t => ({
            id: t.id,
            transactionDate: t.transactionDate,
            transactionType: t.transactionType,
            fundName: t.fundName,
            fundCode: t.fundCode,
            units: t.units,
            nav: t.nav,
            amount: t.amount,
          })),
        };
      },
    });

    // Market Data Functions
    this.register({
      name: 'getMarketSnapshot',
      displayName: 'Get Market Snapshot',
      description: 'Get current market overview including index prices, top gainers, and losers.',
      category: 'market',
      parameters: [],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const indices = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
        const marketData = await storage.getMultipleMarketData(indices);

        return {
          indices: marketData.map(d => ({
            symbol: d.symbol,
            price: d.price,
            change: d.change,
            changePercent: d.changePercent,
          })),
          timestamp: new Date().toISOString(),
        };
      },
    });

    this.register({
      name: 'searchSecurities',
      displayName: 'Search Securities',
      description: 'Search for stocks, mutual funds, or other securities by name or symbol.',
      category: 'market',
      parameters: [{
        name: 'query',
        type: 'string',
        description: 'Search query (company name or symbol)',
        required: true,
      }],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const mutualFunds = await storage.searchMutualFunds(params.query);

        return {
          results: mutualFunds.slice(0, 10).map(mf => ({
            code: mf.schemeCode,
            name: mf.schemeName,
            category: mf.category,
            nav: mf.nav,
          })),
        };
      },
    });

    // User Profile Functions
    this.register({
      name: 'getUserProfile',
      displayName: 'Get User Profile',
      description: 'Get user profile information including KYC status, risk profile, and financial goals.',
      category: 'profile',
      parameters: [],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const profile = await storage.getUserProfile(user.id);

        return {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          mobile: user.mobile,
          panNumber: profile?.panNumber,
          dateOfBirth: profile?.dateOfBirth,
          city: profile?.city,
          state: profile?.state,
        };
      },
    });

    this.register({
      name: 'getFinancialGoals',
      displayName: 'Get Financial Goals',
      description: 'Get user\'s financial goals and their progress.',
      category: 'profile',
      parameters: [],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const goals = await storage.getFinancialGoals(user.id);

        return {
          goals: goals.map((g: any) => ({
            id: g.id,
            name: g.goalName,
            type: g.goalType,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
            targetDate: g.targetDate,
            progress: g.currentAmount && g.targetAmount 
              ? Math.round((parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100)
              : 0,
          })),
        };
      },
    });

    // Transaction Functions (Require Confirmation)
    this.register({
      name: 'createMutualFundOrder',
      displayName: 'Create Mutual Fund Order',
      description: 'Create a buy or sell order for a mutual fund. Requires user confirmation.',
      category: 'transaction',
      parameters: [
        {
          name: 'schemeCode',
          type: 'string',
          description: 'Mutual fund scheme code',
          required: true,
        },
        {
          name: 'orderType',
          type: 'string',
          description: 'Order type: buy or sell',
          required: true,
          enum: ['buy', 'sell'],
        },
        {
          name: 'amount',
          type: 'number',
          description: 'Investment amount in INR',
          required: true,
        },
      ],
      requiresConfirmation: true,
      execute: async (params, user) => {
        const fund = await storage.getMutualFund(params.schemeCode);
        if (!fund) {
          throw new Error('Mutual fund not found');
        }

        return {
          message: `Order created successfully for ${fund.schemeName}`,
          orderId: `MF-${Date.now()}`,
          schemeCode: params.schemeCode,
          schemeName: fund.schemeName,
          amount: params.amount,
          orderType: params.orderType,
          status: 'pending',
        };
      },
    });

    this.register({
      name: 'rebalancePortfolio',
      displayName: 'Rebalance Portfolio',
      description: 'Rebalance portfolio to match target asset allocation. Requires user confirmation.',
      category: 'transaction',
      parameters: [{
        name: 'targetAllocation',
        type: 'object',
        description: 'Target allocation percentages by asset category',
        required: true,
      }],
      requiresConfirmation: true,
      requiredRoles: ['investor', 'premium'],
      execute: async (params, user) => {
        const portfolios = await storage.getPortfoliosByUserId(user.id);
        if (!portfolios.length) {
          throw new Error('No portfolio found');
        }

        const suggestions = await storage.getRebalancingSuggestions(portfolios[0].id);

        return {
          message: 'Rebalancing suggestions generated',
          portfolioId: portfolios[0].id,
          suggestions,
          estimatedTrades: suggestions?.trades || [],
        };
      },
    });

    // Utility Functions
    this.register({
      name: 'calculateSIP',
      displayName: 'Calculate SIP Returns',
      description: 'Calculate expected returns for a Systematic Investment Plan (SIP).',
      category: 'utility',
      parameters: [
        {
          name: 'monthlyAmount',
          type: 'number',
          description: 'Monthly SIP amount in INR',
          required: true,
        },
        {
          name: 'years',
          type: 'number',
          description: 'Investment duration in years',
          required: true,
        },
        {
          name: 'expectedReturn',
          type: 'number',
          description: 'Expected annual return rate (as percentage)',
          required: true,
        },
      ],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const { monthlyAmount, years, expectedReturn } = params;
        const months = years * 12;
        const monthlyRate = expectedReturn / 12 / 100;

        const futureValue = monthlyAmount * 
          (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));
        
        const totalInvestment = monthlyAmount * months;
        const totalReturns = futureValue - totalInvestment;

        return {
          monthlyInvestment: monthlyAmount,
          investmentPeriod: years,
          expectedReturn: expectedReturn,
          totalInvestment: Math.round(totalInvestment),
          expectedMaturityValue: Math.round(futureValue),
          totalReturns: Math.round(totalReturns),
          absoluteReturn: Math.round((totalReturns / totalInvestment) * 100),
        };
      },
    });

    this.register({
      name: 'getTaxImplications',
      displayName: 'Get Tax Implications',
      description: 'Calculate tax implications for a potential transaction.',
      category: 'utility',
      parameters: [
        {
          name: 'assetType',
          type: 'string',
          description: 'Type of asset (equity, debt, etc.)',
          required: true,
          enum: ['equity', 'debt', 'hybrid'],
        },
        {
          name: 'gainAmount',
          type: 'number',
          description: 'Capital gain amount',
          required: true,
        },
        {
          name: 'holdingPeriod',
          type: 'number',
          description: 'Holding period in days',
          required: true,
        },
      ],
      requiresConfirmation: false,
      execute: async (params, user) => {
        const { assetType, gainAmount, holdingPeriod } = params;
        
        let isLongTerm = false;
        let taxRate = 0;

        if (assetType === 'equity') {
          isLongTerm = holdingPeriod > 365;
          taxRate = isLongTerm ? 10 : 15; // LTCG: 10%, STCG: 15%
        } else if (assetType === 'debt') {
          isLongTerm = holdingPeriod > 1095; // 3 years
          taxRate = isLongTerm ? 20 : 30; // Indexed LTCG or slab rate
        }

        const taxAmount = (gainAmount * taxRate) / 100;
        const postTaxGain = gainAmount - taxAmount;

        return {
          assetType,
          gainType: isLongTerm ? 'Long Term' : 'Short Term',
          holdingPeriod: `${Math.floor(holdingPeriod / 365)} years ${holdingPeriod % 365} days`,
          gainAmount,
          taxRate: `${taxRate}%`,
          taxAmount: Math.round(taxAmount),
          postTaxGain: Math.round(postTaxGain),
        };
      },
    });
  }

  private register(func: FunctionDefinition) {
    this.functions.set(func.name, func);
  }

  getFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  async executeFunction(name: string, params: any, user: User): Promise<any> {
    const func = this.functions.get(name);
    if (!func) {
      throw new Error(`Function ${name} not found`);
    }

    // Check role requirements
    if (func.requiredRoles && func.requiredRoles.length > 0) {
      const userRoles = user.roles || [];
      const hasRequiredRole = func.requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRole) {
        throw new Error(`Insufficient permissions. Required roles: ${func.requiredRoles.join(', ')}`);
      }
    }

    try {
      const result = await func.execute(params, user);
      return result;
    } catch (error) {
      throw new Error(`Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getFunctionSchema(name: string) {
    const func = this.functions.get(name);
    if (!func) {
      return null;
    }

    return {
      name: func.name,
      description: func.description,
      parameters: {
        type: 'object',
        properties: func.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum && { enum: param.enum }),
          };
          return acc;
        }, {} as any),
        required: func.parameters.filter(p => p.required).map(p => p.name),
      },
    };
  }
}

export const functionRegistry = new FunctionRegistry();
