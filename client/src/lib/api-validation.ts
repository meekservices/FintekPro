import { z } from 'zod';

export const portfolioHoldingSchema = z.object({
  id: z.number().optional(),
  symbol: z.string(),
  name: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number().optional(),
  value: z.number().optional(),
  pnl: z.number().optional(),
  pnlPercent: z.number().optional()
});

export const portfolioPerformanceSchema = z.object({
  totalCurrentValue: z.number().default(0),
  totalInvestedValue: z.number().default(0),
  totalPnL: z.number().default(0),
  totalPnLPercent: z.number().default(0),
  dayChange: z.number().default(0),
  dayChangePercent: z.number().default(0)
});

export const stockHoldingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  symbol: z.string(),
  exchange: z.string().optional(),
  companyName: z.string().optional(),
  quantity: z.number(),
  averagePrice: z.string().or(z.number()),
  currentPrice: z.string().or(z.number()).optional(),
  isin: z.string().optional()
});

export const mutualFundHoldingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  schemeName: z.string(),
  schemeCode: z.string().optional(),
  amcName: z.string().optional(),
  units: z.number().or(z.string()),
  nav: z.number().or(z.string()).optional(),
  investedAmount: z.number().or(z.string()),
  currentValue: z.number().or(z.string()).optional()
});

export const epfHoldingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  employerName: z.string().optional(),
  uanNumber: z.string().optional(),
  currentBalance: z.string().or(z.number()).default('0'),
  employeeContribution: z.string().or(z.number()).optional(),
  employerContribution: z.string().or(z.number()).optional(),
  interestEarned: z.string().or(z.number()).optional(),
  nomineeName: z.string().optional()
});

export const ppfHoldingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  ppfAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  branchName: z.string().optional(),
  currentBalance: z.string().or(z.number()).default('0'),
  maturityDate: z.string().optional(),
  accountOpenDate: z.string().optional(),
  isActive: z.boolean().default(true),
  nomineeName: z.string().optional()
});

export const insuranceHoldingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  policyNumber: z.string(),
  policyType: z.enum(['life', 'health', 'motor', 'term', 'ulip', 'endowment']).optional(),
  provider: z.string().optional(),
  premium: z.number().or(z.string()).default(0),
  sumAssured: z.number().or(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  nomineeName: z.string().optional()
});

export const agentLeadSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).default('new'),
  source: z.string().optional(),
  assignedTo: z.number().optional(),
  estimatedValue: z.number().optional(),
  createdAt: z.string().optional()
});

export const marketDataSchema = z.object({
  gainers: z.array(z.object({
    symbol: z.string(),
    name: z.string(),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    previousClose: z.number().optional()
  })).default([]),
  losers: z.array(z.object({
    symbol: z.string(),
    name: z.string(),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    previousClose: z.number().optional()
  })).default([])
});

export const platformStatsSchema = z.object({
  activeUsers: z.string().or(z.number()),
  portfolioValue: z.string(),
  portfolioValueRaw: z.number().optional(),
  avgPortfolioValue: z.string().optional(),
  dailyTrades: z.string().or(z.number()),
  monthlyTrades: z.string().or(z.number()),
  mutualFundsCount: z.string(),
  bondsCount: z.string(),
  stocksCount: z.string(),
  investmentOptions: z.string(),
  lastUpdated: z.string().optional()
});

export function validateApiResponse<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  fallback: T
): { data: T; isValid: boolean; errors?: z.ZodError['issues'] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { data: result.data, isValid: true };
  }
  
  if (import.meta.env.DEV) {
    console.warn('[API Validation] Schema validation failed:', result.error.issues);
  }
  
  return { 
    data: fallback, 
    isValid: false, 
    errors: result.error.issues 
  };
}

export function createSafeArrayValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T[] => {
    if (!Array.isArray(data)) return [];
    
    return data.filter(item => {
      const result = schema.safeParse(item);
      if (!result.success && import.meta.env.DEV) {
        console.warn('[API Validation] Skipping invalid item:', result.error.issues);
      }
      return result.success;
    }).map(item => schema.parse(item));
  };
}

export const safeValidators = {
  stockHoldings: createSafeArrayValidator(stockHoldingSchema),
  mutualFundHoldings: createSafeArrayValidator(mutualFundHoldingSchema),
  epfHoldings: createSafeArrayValidator(epfHoldingSchema),
  ppfHoldings: createSafeArrayValidator(ppfHoldingSchema),
  insuranceHoldings: createSafeArrayValidator(insuranceHoldingSchema),
  leads: createSafeArrayValidator(agentLeadSchema)
};
