// @ts-nocheck
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, sql, desc, ilike, or, gte, lte, asc } from 'drizzle-orm';
import { reits, invits, reitInvitOrders, reitInvitHoldings, users, userProfiles, unlistedCompanies } from '@shared/schema';
import { z } from 'zod';
import { reitInvitDataService } from '../services/reit-invit-data-service';
import { aiReitInvitService, ReitInvitAsset } from '../services/ai-reit-invit-service';
import { unifiedStockPriceService } from '../services/unified-stock-price-service';

const router = Router();

const SAMPLE_REITS = [
  {
    id: 'reit-1',
    symbol: 'EMBASSY',
    name: 'Embassy Office Parks REIT',
    sponsor: 'Embassy Group & Blackstone',
    manager: 'Embassy Office Parks Management Services',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Bangalore, Mumbai, Pune, Noida',
    totalProperties: 14,
    totalLeasableArea: '45000000',
    occupancyRate: '89.5',
    currentPrice: '362.45',
    nav: '395.20',
    premiumToNav: '-8.28',
    weekHigh52: '425.00',
    weekLow52: '298.50',
    marketCap: '34500000000',
    distributionYield: '6.85',
    dividendFrequency: 'quarterly',
    lastDividend: '6.21',
    returns1M: '2.5',
    returns3M: '5.8',
    returns6M: '8.2',
    returns1Y: '12.5',
    returns3Y: '28.4',
    debtToEquity: '0.45',
    interestCoverageRatio: '3.2',
    minimumInvestment: '362.45',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AAA',
    ratingAgency: 'CRISIL',
    aiSignal: 'buy',
    aiConfidence: '82.5',
    aiRationale: 'Strong occupancy rates with premium Grade-A office properties. Attractive yield compared to government bonds. Potential NAV re-rating as office demand recovers post-pandemic.',
    aiTargetPrice: '410.00',
    isActive: true,
  },
  {
    id: 'reit-2',
    symbol: 'MINDSPACE',
    name: 'Mindspace Business Parks REIT',
    sponsor: 'K Raheja Corp & Blackstone',
    manager: 'Mindspace Business Parks REIT Management',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Hyderabad, Mumbai, Pune, Chennai',
    totalProperties: 5,
    totalLeasableArea: '32000000',
    occupancyRate: '91.2',
    currentPrice: '328.90',
    nav: '348.50',
    premiumToNav: '-5.62',
    weekHigh52: '385.00',
    weekLow52: '275.00',
    marketCap: '19500000000',
    distributionYield: '7.12',
    dividendFrequency: 'quarterly',
    lastDividend: '5.85',
    returns1M: '1.8',
    returns3M: '4.5',
    returns6M: '7.8',
    returns1Y: '15.2',
    returns3Y: '32.1',
    debtToEquity: '0.38',
    interestCoverageRatio: '3.8',
    minimumInvestment: '328.90',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AAA',
    ratingAgency: 'ICRA',
    aiSignal: 'buy',
    aiConfidence: '78.3',
    aiRationale: 'Higher distribution yield with improving occupancy. Strong tenant base of IT/ITeS companies. Well-positioned for hybrid work trend with quality infrastructure.',
    aiTargetPrice: '375.00',
    isActive: true,
  },
  {
    id: 'reit-3',
    symbol: 'BROOKFIELD',
    name: 'Brookfield India Real Estate Trust',
    sponsor: 'Brookfield Asset Management',
    manager: 'Brookprop Management Services',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Noida, Gurugram, Mumbai, Kolkata',
    totalProperties: 4,
    totalLeasableArea: '18500000',
    occupancyRate: '85.8',
    currentPrice: '285.60',
    nav: '312.40',
    premiumToNav: '-8.58',
    weekHigh52: '345.00',
    weekLow52: '240.00',
    marketCap: '12800000000',
    distributionYield: '7.45',
    dividendFrequency: 'quarterly',
    lastDividend: '5.32',
    returns1M: '0.8',
    returns3M: '3.2',
    returns6M: '5.5',
    returns1Y: '8.9',
    returns3Y: '18.5',
    debtToEquity: '0.52',
    interestCoverageRatio: '2.9',
    minimumInvestment: '285.60',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AA+',
    ratingAgency: 'CRISIL',
    aiSignal: 'hold',
    aiConfidence: '65.2',
    aiRationale: 'Attractive valuation with highest yield among listed REITs. However, occupancy improvement needed in NCR assets. Wait for better entry point or signs of occupancy recovery.',
    aiTargetPrice: '310.00',
    isActive: true,
  },
  {
    id: 'reit-4',
    symbol: 'NEXUS',
    name: 'Nexus Select Trust',
    sponsor: 'Blackstone',
    manager: 'Nexus Select Mall Management',
    sector: 'retail',
    propertyType: 'commercial',
    geography: 'Bangalore, Mumbai, Delhi, Hyderabad, Chandigarh',
    totalProperties: 17,
    totalLeasableArea: '9800000',
    occupancyRate: '96.5',
    currentPrice: '142.80',
    nav: '138.90',
    premiumToNav: '2.81',
    weekHigh52: '165.00',
    weekLow52: '118.00',
    marketCap: '21500000000',
    distributionYield: '5.85',
    dividendFrequency: 'quarterly',
    lastDividend: '2.09',
    returns1M: '3.2',
    returns3M: '8.5',
    returns6M: '15.2',
    returns1Y: '22.8',
    returns3Y: null,
    debtToEquity: '0.28',
    interestCoverageRatio: '4.5',
    minimumInvestment: '142.80',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AAA',
    ratingAgency: 'CRISIL',
    aiSignal: 'buy',
    aiConfidence: '85.0',
    aiRationale: 'Premium retail REIT with highest occupancy. Benefiting from strong consumption recovery. Premium malls in metro cities command pricing power. Good capital appreciation potential.',
    aiTargetPrice: '165.00',
    isActive: true,
  },
];

const SAMPLE_INVITS = [
  {
    id: 'invit-1',
    symbol: 'POWERGRID',
    name: 'PowerGrid Infrastructure Investment Trust',
    sponsor: 'Power Grid Corporation of India',
    manager: 'PowerGrid InvIT Management',
    sector: 'power',
    infrastructureType: 'transmission',
    geography: 'Pan India - Multiple States',
    totalAssets: 11,
    assetDetails: 'Interstate transmission lines and substations',
    concessionLife: '22.5',
    currentPrice: '118.50',
    nav: '125.80',
    premiumToNav: '-5.80',
    weekHigh52: '145.00',
    weekLow52: '98.00',
    marketCap: '18200000000',
    distributionYield: '11.25',
    dividendFrequency: 'quarterly',
    lastDividend: '3.33',
    returns1M: '1.2',
    returns3M: '4.8',
    returns6M: '8.5',
    returns1Y: '14.2',
    returns3Y: '35.8',
    debtToEquity: '1.25',
    interestCoverageRatio: '2.1',
    ebitda: '4500000000',
    minimumInvestment: '118.50',
    lotSize: 1,
    riskLevel: 'low',
    creditRating: 'AAA',
    ratingAgency: 'CRISIL',
    aiSignal: 'buy',
    aiConfidence: '88.5',
    aiRationale: 'Government-backed sponsor with regulated returns. Highest yield among InvITs with stable cash flows. Transmission assets have minimal operational risk and predictable revenues.',
    aiTargetPrice: '135.00',
    isActive: true,
  },
  {
    id: 'invit-2',
    symbol: 'INDIGRID',
    name: 'India Grid Trust',
    sponsor: 'KKR & Sterlite Power',
    manager: 'Sterlite Investment Managers',
    sector: 'power',
    infrastructureType: 'transmission',
    geography: 'Gujarat, Maharashtra, Rajasthan, MP, UP',
    totalAssets: 18,
    assetDetails: 'Transmission lines, substations, and solar assets',
    concessionLife: '28.5',
    currentPrice: '142.30',
    nav: '152.60',
    premiumToNav: '-6.75',
    weekHigh52: '168.00',
    weekLow52: '115.00',
    marketCap: '15800000000',
    distributionYield: '10.85',
    dividendFrequency: 'quarterly',
    lastDividend: '3.86',
    returns1M: '2.1',
    returns3M: '5.5',
    returns6M: '9.8',
    returns1Y: '18.5',
    returns3Y: '42.3',
    debtToEquity: '1.45',
    interestCoverageRatio: '1.9',
    ebitda: '3200000000',
    minimumInvestment: '142.30',
    lotSize: 1,
    riskLevel: 'low',
    creditRating: 'AAA',
    ratingAgency: 'ICRA',
    aiSignal: 'buy',
    aiConfidence: '82.0',
    aiRationale: 'Diverse portfolio with growing renewable energy assets. Long concession life provides visibility. Active acquisition strategy for continued growth. Strong sponsor backing from KKR.',
    aiTargetPrice: '160.00',
    isActive: true,
  },
  {
    id: 'invit-3',
    symbol: 'IRB',
    name: 'IRB InvIT Fund',
    sponsor: 'IRB Infrastructure Developers',
    manager: 'IRB Infrastructure Managers',
    sector: 'roads',
    infrastructureType: 'toll_roads',
    geography: 'Maharashtra, Gujarat, Karnataka, Rajasthan',
    totalAssets: 7,
    assetDetails: 'Toll road projects on national highways',
    concessionLife: '12.8',
    currentPrice: '58.20',
    nav: '65.40',
    premiumToNav: '-11.01',
    weekHigh52: '75.00',
    weekLow52: '45.00',
    marketCap: '8500000000',
    distributionYield: '8.95',
    dividendFrequency: 'quarterly',
    lastDividend: '1.30',
    returns1M: '-1.5',
    returns3M: '2.8',
    returns6M: '5.2',
    returns1Y: '12.8',
    returns3Y: '25.5',
    debtToEquity: '1.85',
    interestCoverageRatio: '1.5',
    ebitda: '1800000000',
    minimumInvestment: '58.20',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AA',
    ratingAgency: 'CRISIL',
    aiSignal: 'hold',
    aiConfidence: '62.5',
    aiRationale: 'Toll road InvIT with traffic volume sensitivity. Higher operational risk compared to transmission InvITs. Attractive yield but requires monitoring of traffic trends and economic conditions.',
    aiTargetPrice: '65.00',
    isActive: true,
  },
  {
    id: 'invit-4',
    symbol: 'NATIONALHI',
    name: 'National Highways Infra Trust',
    sponsor: 'NHAI',
    manager: 'NH Infra Asset Managers',
    sector: 'roads',
    infrastructureType: 'toll_roads',
    geography: 'Pan India National Highways',
    totalAssets: 5,
    assetDetails: 'Toll-operate-transfer highway projects',
    concessionLife: '18.2',
    currentPrice: '45.80',
    nav: '52.30',
    premiumToNav: '-12.43',
    weekHigh52: '58.00',
    weekLow52: '38.00',
    marketCap: '6200000000',
    distributionYield: '9.85',
    dividendFrequency: 'quarterly',
    lastDividend: '1.13',
    returns1M: '0.5',
    returns3M: '3.2',
    returns6M: '6.8',
    returns1Y: '10.5',
    returns3Y: null,
    debtToEquity: '1.65',
    interestCoverageRatio: '1.7',
    ebitda: '1200000000',
    minimumInvestment: '45.80',
    lotSize: 1,
    riskLevel: 'moderate',
    creditRating: 'AA+',
    ratingAgency: 'ICRA',
    aiSignal: 'hold',
    aiConfidence: '58.0',
    aiRationale: 'Government-backed InvIT but with traffic volume risk. Suitable for income-focused investors comfortable with infrastructure sector. Monitor for potential NHAI asset additions.',
    aiTargetPrice: '50.00',
    isActive: true,
  },
  {
    id: 'invit-5',
    symbol: 'BHARATIHWI',
    name: 'Bharti AirTel Infrastructure Trust',
    sponsor: 'Bharti Infratel',
    manager: 'Bharti Infra Asset Management',
    sector: 'telecom',
    infrastructureType: 'fiber',
    geography: 'Pan India Metro Cities',
    totalAssets: 25000,
    assetDetails: 'Telecom towers and fiber infrastructure',
    concessionLife: '30.0',
    currentPrice: '285.40',
    nav: '298.50',
    premiumToNav: '-4.39',
    weekHigh52: '325.00',
    weekLow52: '225.00',
    marketCap: '28500000000',
    distributionYield: '7.25',
    dividendFrequency: 'quarterly',
    lastDividend: '5.18',
    returns1M: '2.8',
    returns3M: '7.5',
    returns6M: '12.2',
    returns1Y: '20.5',
    returns3Y: '45.8',
    debtToEquity: '0.95',
    interestCoverageRatio: '2.8',
    ebitda: '8500000000',
    minimumInvestment: '285.40',
    lotSize: 1,
    riskLevel: 'low',
    creditRating: 'AAA',
    ratingAgency: 'CRISIL',
    aiSignal: 'buy',
    aiConfidence: '79.5',
    aiRationale: 'Digital infrastructure play with 5G tailwinds. Long tenure contracts with telecom operators. Growing data consumption drives tower and fiber demand. Strong sponsor in Bharti group.',
    aiTargetPrice: '320.00',
    isActive: true,
  },
];

router.get('/eligibility/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { assetType } = req.query;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const userKycTier = profile?.kycTier || user.kycTier || 'basic';
    const requirement = KYC_TIER_REQUIREMENTS[assetType as string] || KYC_TIER_REQUIREMENTS.reit;
    const eligible = isKycSufficient(userKycTier, requirement.minTier);

    const stepsRequired = [];
    if (!eligible) {
      if (KYC_TIER_LEVELS[userKycTier] < 2) {
        stepsRequired.push('Complete PAN verification');
        stepsRequired.push('Complete address verification');
        stepsRequired.push('Complete bank account verification');
      }
    }

    res.json({
      success: true,
      eligible,
      currentTier: userKycTier,
      requiredTier: requirement.minTier,
      description: requirement.description,
      stepsRequired,
      restrictions: eligible ? [] : ['Cannot place orders until KYC requirements are met'],
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ success: false, error: 'Failed to check eligibility' });
  }
});

const orderSchema = z.object({
  userId: z.string(),
  assetType: z.enum(['reit', 'invit']),
  symbol: z.string(),
  quantity: z.number().positive(),
  orderType: z.enum(['market', 'limit']).default('market'),
  limitPrice: z.number().positive().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.orderType !== 'limit' || (data.limitPrice !== undefined && data.limitPrice > 0),
  { message: 'Limit price is required for limit orders', path: ['limitPrice'] }
);

router.post('/orders', async (req: Request, res: Response) => {
  try {
    const validation = orderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order data',
        details: validation.error.format(),
      });
    }

    const { userId, assetType, symbol, quantity, orderType, limitPrice, notes } = validation.data;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const userKycTier = profile?.kycTier || user.kycTier || 'basic';
    const requirement = KYC_TIER_REQUIREMENTS[assetType];
    
    if (!isKycSufficient(userKycTier, requirement.minTier)) {
      return res.status(403).json({
        success: false,
        error: 'KYC requirements not met',
        currentTier: userKycTier,
        requiredTier: requirement.minTier,
        message: requirement.description,
      });
    }

    let asset;
    if (assetType === 'reit') {
      asset = SAMPLE_REITS.find(r => r.symbol.toLowerCase() === symbol.toLowerCase());
    } else {
      asset = SAMPLE_INVITS.find(i => i.symbol.toLowerCase() === symbol.toLowerCase());
    }

    if (!asset) {
      return res.status(404).json({ success: false, error: `${assetType.toUpperCase()} not found` });
    }

    const price = orderType === 'limit' && limitPrice ? limitPrice : parseFloat(asset.currentPrice);
    const totalValue = price * quantity;

    const order = {
      id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      assetType,
      symbol: asset.symbol,
      name: asset.name,
      quantity,
      orderType,
      price,
      totalValue,
      status: 'pending',
      createdAt: new Date().toISOString(),
      notes,
    };

    setTimeout(() => {
      order.status = 'executed';
      console.log(`Order ${order.id} executed successfully`);
    }, 2000);

    res.json({
      success: true,
      order,
      message: 'Order placed successfully. It will be processed shortly.',
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, error: 'Failed to place order' });
  }
});

router.get('/orders/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, assetType } = req.query;

    const sampleOrders = [
      {
        id: 'ORD-SAMPLE-001',
        userId,
        assetType: 'reit',
        symbol: 'EMBASSY',
        name: 'Embassy Office Parks REIT',
        quantity: 10,
        orderType: 'market',
        price: 362.45,
        totalValue: 3624.50,
        status: 'executed',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        executedAt: new Date(Date.now() - 86400000 * 5 + 60000).toISOString(),
      },
      {
        id: 'ORD-SAMPLE-002',
        userId,
        assetType: 'invit',
        symbol: 'POWERGRID',
        name: 'PowerGrid Infrastructure Investment Trust',
        quantity: 25,
        orderType: 'market',
        price: 118.50,
        totalValue: 2962.50,
        status: 'executed',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        executedAt: new Date(Date.now() - 86400000 * 3 + 60000).toISOString(),
      },
    ];

    let filteredOrders = sampleOrders.filter(o => o.userId === userId);
    
    if (status && status !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }
    if (assetType && assetType !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.assetType === assetType);
    }

    res.json({
      success: true,
      orders: filteredOrders,
      total: filteredOrders.length,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

router.get('/holdings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const sampleHoldings = [
      {
        id: 'HOLD-001',
        userId,
        assetType: 'reit',
        symbol: 'EMBASSY',
        name: 'Embassy Office Parks REIT',
        quantity: 10,
        avgBuyPrice: 362.45,
        currentPrice: 362.45,
        currentValue: 3624.50,
        unrealizedGain: 0,
        unrealizedGainPct: 0,
        distributionYield: '6.85',
        sector: 'office',
      },
      {
        id: 'HOLD-002',
        userId,
        assetType: 'invit',
        symbol: 'POWERGRID',
        name: 'PowerGrid Infrastructure Investment Trust',
        quantity: 25,
        avgBuyPrice: 118.50,
        currentPrice: 118.50,
        currentValue: 2962.50,
        unrealizedGain: 0,
        unrealizedGainPct: 0,
        distributionYield: '11.25',
        sector: 'power',
      },
    ];

    const totalValue = sampleHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalGain = sampleHoldings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const avgYield = sampleHoldings.length > 0
      ? (sampleHoldings.reduce((sum, h) => sum + parseFloat(h.distributionYield), 0) / sampleHoldings.length).toFixed(2)
      : '0';

    res.json({
      success: true,
      holdings: sampleHoldings,
      summary: {
        totalHoldings: sampleHoldings.length,
        totalValue,
        totalGain,
        totalGainPct: totalValue > 0 ? ((totalGain / (totalValue - totalGain)) * 100).toFixed(2) : '0',
        avgYield,
        reitCount: sampleHoldings.filter(h => h.assetType === 'reit').length,
        invitCount: sampleHoldings.filter(h => h.assetType === 'invit').length,
      },
    });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holdings' });
  }
});

router.delete('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;

    res.json({
      success: true,
      message: `Order ${orderId} cancelled successfully`,
      cancelledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

// ===================== ADMIN ROUTES =====================

// GET /store/reits/admin - List all REITs for admin (including unpublished)
router.get('/store/reits/admin', async (req: Request, res: Response) => {
  try {
    const dbReits = await db.select().from(reits).orderBy(desc(reits.createdAt));
    
    // Combine with sample data if DB is empty
    const allReits = dbReits.length > 0 ? dbReits : SAMPLE_REITS.map(r => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      sector: r.sector,
      sponsor: r.sponsor,
      marketCap: r.marketCap,
      currentPrice: r.currentPrice,
      dividendYield: r.distributionYield,
      occupancy: r.occupancyRate,
      nav: r.nav,
      totalAssets: r.totalLeasableArea,
      aiSignal: r.aiSignal,
      isPublished: true,
      description: r.aiRationale,
      createdAt: new Date().toISOString(),
    }));
    
    res.json({ reits: allReits });
  } catch (error) {
    console.error('Error fetching REITs for admin:', error);
    res.status(500).json({ error: 'Failed to fetch REITs' });
  }
});

// GET /store/invits/admin - List all InvITs for admin (including unpublished)
router.get('/store/invits/admin', async (req: Request, res: Response) => {
  try {
    const dbInvits = await db.select().from(invits).orderBy(desc(invits.createdAt));
    
    // Combine with sample data if DB is empty
    const allInvits = dbInvits.length > 0 ? dbInvits : SAMPLE_INVITS.map(i => ({
      id: i.id,
      name: i.name,
      symbol: i.symbol,
      sector: i.sector,
      sponsor: i.sponsor,
      marketCap: i.marketCap,
      currentPrice: i.currentPrice,
      dividendYield: i.distributionYield,
      nav: i.nav,
      totalAssets: i.capacityMW?.toString() || null,
      aiSignal: i.aiSignal,
      isPublished: true,
      description: i.aiRationale,
      createdAt: new Date().toISOString(),
    }));
    
    res.json({ invits: allInvits });
  } catch (error) {
    console.error('Error fetching InvITs for admin:', error);
    res.status(500).json({ error: 'Failed to fetch InvITs' });
  }
});

// POST /store/reits - Create new REIT
router.post('/store/reits', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const newReit = await db.insert(reits).values({
      id: `reit-${Date.now()}`,
      name: data.name,
      symbol: data.symbol,
      sector: data.sector,
      sponsor: data.sponsor,
      marketCap: data.marketCap,
      currentPrice: data.currentPrice,
      dividendYield: data.dividendYield,
      occupancy: data.occupancy,
      nav: data.nav,
      totalAssets: data.totalAssets,
      aiSignal: data.aiSignal,
      isPublished: data.isPublished || false,
      description: data.description,
    }).returning();
    
    res.json({ success: true, reit: newReit[0] });
  } catch (error) {
    console.error('Error creating REIT:', error);
    res.status(500).json({ error: 'Failed to create REIT' });
  }
});

// POST /store/invits - Create new InvIT


export default router;
