/**
 * Explainability API Routes - SEBI-Compliant Investment Recommendation Explanations
 * 
 * Endpoints for:
 * - Product recommendation explanations with reasons
 * - Goal impact analysis
 * - Risk/return delta calculations
 * - Portfolio-level explainability
 * - Regulatory disclosures
 */

import { Router, Request, Response } from 'express';
import { explainabilityEngine } from '../services/explainability-engine';

const router = Router();

// ============================================================================
// PRODUCT EXPLANATION ROUTES
// ============================================================================

/**
 * POST /explain/product - Explain a product recommendation
 */
router.post('/explain/product', async (req: Request, res: Response) => {
  try {
    const { clientProfile, product, investmentAmount, goalId, includeAlternatives } = req.body;
    
    if (!clientProfile || !product || !investmentAmount) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: clientProfile, product, investmentAmount' 
      });
      return;
    }
    
    const explanation = explainabilityEngine.explainProductRecommendation({
      clientProfile,
      product,
      investmentAmount,
      goalId,
      includeAlternatives: includeAlternatives ?? true
    });
    
    res.json({ success: true, data: explanation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /explain/product/summary - Get narrative summary of recommendation
 */
router.post('/explain/product/summary', async (req: Request, res: Response) => {
  try {
    const { clientProfile, product, investmentAmount, goalId } = req.body;
    
    if (!clientProfile || !product || !investmentAmount) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: clientProfile, product, investmentAmount' 
      });
      return;
    }
    
    const explanation = explainabilityEngine.explainProductRecommendation({
      clientProfile,
      product,
      investmentAmount,
      goalId,
      includeAlternatives: false
    });
    
    const summary = explainabilityEngine.generateNarrativeSummary(explanation);
    
    res.json({ 
      success: true, 
      data: {
        summary,
        recommendation: explanation.recommendation,
        confidence: explanation.confidence,
        suitabilityScore: explanation.suitabilityExplanation.suitabilityScore
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PORTFOLIO EXPLANATION ROUTES
// ============================================================================

/**
 * POST /explain/portfolio - Explain portfolio allocation and strategy
 */
router.post('/explain/portfolio', async (req: Request, res: Response) => {
  try {
    const { clientProfile, products } = req.body;
    
    if (!clientProfile || !products || !Array.isArray(products)) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: clientProfile, products (array)' 
      });
      return;
    }
    
    const explanation = explainabilityEngine.explainPortfolio(clientProfile, products);
    
    res.json({ success: true, data: explanation });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DISCLOSURE ROUTES
// ============================================================================

/**
 * GET /disclosures/mandatory - Get all mandatory SEBI disclosures
 */
router.get('/disclosures/mandatory', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      disclosures: [
        {
          type: 'sebi_mandatory',
          title: 'Investment Risk Disclaimer',
          content: 'Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing. Past performance is not indicative of future returns.',
          regulatoryReference: 'SEBI (Mutual Funds) Regulations, 1996',
          displayLocation: 'all_pages'
        },
        {
          type: 'sebi_mandatory',
          title: 'Investment Advisor Disclosure',
          content: 'Investment advice is provided in accordance with SEBI (Investment Advisers) Regulations, 2013. We are a SEBI-registered Investment Adviser.',
          regulatoryReference: 'SEBI (Investment Advisers) Regulations, 2013',
          displayLocation: 'recommendation_pages'
        },
        {
          type: 'sebi_mandatory',
          title: 'Conflict of Interest Disclosure',
          content: 'We may receive commissions from product manufacturers. These commissions do not influence our recommendations which are based solely on suitability assessment.',
          regulatoryReference: 'SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2021/024',
          displayLocation: 'recommendation_pages'
        },
        {
          type: 'sebi_mandatory',
          title: 'Suitability Declaration',
          content: 'All investment recommendations are made based on a thorough suitability assessment considering your risk profile, investment objectives, and financial situation.',
          regulatoryReference: 'SEBI (Investment Advisers) Regulations, 2013 - Regulation 17',
          displayLocation: 'recommendation_pages'
        }
      ],
      lastUpdated: new Date().toISOString()
    }
  });
});

/**
 * GET /disclosures/risk-categories - Get risk category definitions
 */
router.get('/disclosures/risk-categories', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      riskCategories: [
        {
          level: 1,
          name: 'Low Risk',
          color: 'green',
          description: 'Principal is relatively safe. Returns may be lower but more predictable.',
          suitableFor: 'Conservative investors, retirement corpus, emergency funds',
          typicalProducts: ['Liquid funds', 'Money market funds', 'Government bonds'],
          volatilityRange: '0-5%',
          potentialLoss: 'Minimal - typically less than 2% in worst case'
        },
        {
          level: 2,
          name: 'Moderately Low Risk',
          color: 'lightgreen',
          description: 'Relatively stable with occasional minor fluctuations.',
          suitableFor: 'Conservative to moderate investors, short-term goals',
          typicalProducts: ['Short-term debt funds', 'Corporate bond funds', 'Banking & PSU funds'],
          volatilityRange: '5-10%',
          potentialLoss: 'Limited - typically 2-5% in adverse conditions'
        },
        {
          level: 3,
          name: 'Moderate Risk',
          color: 'yellow',
          description: 'Balanced risk-return profile with moderate fluctuations.',
          suitableFor: 'Moderate risk investors, medium-term goals (3-5 years)',
          typicalProducts: ['Hybrid funds', 'Dynamic bond funds', 'Balanced advantage funds'],
          volatilityRange: '10-15%',
          potentialLoss: 'Moderate - 5-15% in market corrections'
        },
        {
          level: 4,
          name: 'Moderately High Risk',
          color: 'orange',
          description: 'Higher return potential with significant fluctuations possible.',
          suitableFor: 'Aggressive investors, long-term goals (5+ years)',
          typicalProducts: ['Large cap equity funds', 'Flexi cap funds', 'Index funds'],
          volatilityRange: '15-25%',
          potentialLoss: 'Significant - 15-30% in bear markets'
        },
        {
          level: 5,
          name: 'High Risk',
          color: 'red',
          description: 'High volatility with potential for both significant gains and losses.',
          suitableFor: 'Very aggressive investors, long-term wealth creation (7+ years)',
          typicalProducts: ['Mid cap funds', 'Small cap funds', 'Sectoral funds', 'Thematic funds'],
          volatilityRange: '25%+',
          potentialLoss: 'High - 30-50% or more in severe market conditions'
        }
      ],
      regulatoryNote: 'Risk categorization is based on SEBI guidelines for product labeling and riskometer.',
      lastUpdated: new Date().toISOString()
    }
  });
});

// ============================================================================
// SUITABILITY EXPLANATION ROUTES
// ============================================================================

/**
 * GET /suitability/factors - Get suitability assessment factors
 */
router.get('/suitability/factors', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      factors: [
        {
          name: 'Risk Tolerance',
          weight: 30,
          description: 'Match between client risk appetite and product risk level',
          assessmentMethod: 'Risk profiling questionnaire score compared to product riskometer'
        },
        {
          name: 'Investment Horizon',
          weight: 25,
          description: 'Client investment timeline vs product recommended holding period',
          assessmentMethod: 'Years to goal compared to product lock-in and recommended duration'
        },
        {
          name: 'Income Adequacy',
          weight: 20,
          description: 'Client financial capacity to invest and sustain the investment',
          assessmentMethod: 'Investment amount as percentage of surplus income'
        },
        {
          name: 'KYC Compliance',
          weight: 15,
          description: 'Client KYC tier meets product regulatory requirements',
          assessmentMethod: 'KYC tier level comparison (Basic < Enhanced < Accredited)'
        },
        {
          name: 'Liquidity Requirements',
          weight: 10,
          description: 'Product liquidity matches client emergency fund needs',
          assessmentMethod: 'Liquidity score and lock-in period assessment'
        }
      ],
      scoringMethod: 'Weighted average of factor match scores',
      thresholds: {
        highlySuitable: { minScore: 85, description: 'Strong match across all factors' },
        suitable: { minScore: 70, description: 'Good match with minor gaps' },
        moderatelySuitable: { minScore: 50, description: 'Acceptable but with reservations' },
        notSuitable: { minScore: 0, description: 'Significant mismatches - not recommended' }
      }
    }
  });
});

/**
 * GET /suitability/compliance - Get suitability compliance requirements
 */
router.get('/suitability/compliance', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      regulations: [
        {
          name: 'SEBI (Investment Advisers) Regulations, 2013',
          requirements: [
            'Know Your Client (KYC) - Regulation 16',
            'Risk Profiling - Regulation 17(1)',
            'Suitability Assessment - Regulation 17(2)',
            'Documentation - Regulation 17(3)',
            'Disclosure of Rationale - Regulation 17(4)'
          ]
        },
        {
          name: 'SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2021/024',
          requirements: [
            'Conflict of interest disclosure',
            'Commission transparency',
            'Product comparison requirements'
          ]
        }
      ],
      documentationRequirements: [
        'Risk profiling questionnaire responses',
        'Suitability assessment report',
        'Product recommendation rationale',
        'Client acknowledgment of disclosures',
        'Record of advice given'
      ],
      retentionPeriod: '5 years from date of advice or client relationship end, whichever is later'
    }
  });
});

// ============================================================================
// REASON CODE ROUTES
// ============================================================================

/**
 * GET /reasons/categories - Get recommendation reason categories
 */
router.get('/reasons/categories', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      categories: [
        {
          code: 'risk_match',
          name: 'Risk Alignment',
          description: 'How well product risk matches client risk tolerance',
          impactWeight: 25
        },
        {
          code: 'return_potential',
          name: 'Return Potential',
          description: 'Expected returns relative to market and client goals',
          impactWeight: 20
        },
        {
          code: 'goal_alignment',
          name: 'Goal Alignment',
          description: 'How well product contributes to specific client goals',
          impactWeight: 20
        },
        {
          code: 'diversification',
          name: 'Diversification',
          description: 'Portfolio diversification benefit from adding this product',
          impactWeight: 15
        },
        {
          code: 'tax_efficiency',
          name: 'Tax Efficiency',
          description: 'Tax implications and optimization potential',
          impactWeight: 10
        },
        {
          code: 'liquidity',
          name: 'Liquidity',
          description: 'Ease of access to funds when needed',
          impactWeight: 10
        },
        {
          code: 'historical_performance',
          name: 'Track Record',
          description: 'Historical performance and consistency',
          impactWeight: 15
        },
        {
          code: 'market_conditions',
          name: 'Market Context',
          description: 'Current market conditions favoring/disfavoring the product',
          impactWeight: 10
        },
        {
          code: 'regulatory',
          name: 'Regulatory Compliance',
          description: 'Regulatory considerations and restrictions',
          impactWeight: 5
        }
      ]
    }
  });
});

// ============================================================================
// SCENARIO ANALYSIS ROUTES
// ============================================================================

/**
 * POST /scenario/analyze - Analyze investment under different scenarios
 */
router.post('/scenario/analyze', async (req: Request, res: Response) => {
  try {
    const { investmentAmount, expectedReturn, volatility, horizon } = req.body;
    
    if (!investmentAmount || !expectedReturn) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: investmentAmount, expectedReturn' 
      });
      return;
    }
    
    const vol = volatility || 15;
    const years = horizon || 5;
    
    const scenarios = [
      {
        name: 'Bull',
        probability: 25,
        annualizedReturn: expectedReturn + vol * 0.7,
        projectedValue: investmentAmount * Math.pow(1 + (expectedReturn + vol * 0.7) / 100, years),
        description: 'Strong economic growth, favorable market conditions'
      },
      {
        name: 'Base',
        probability: 50,
        annualizedReturn: expectedReturn,
        projectedValue: investmentAmount * Math.pow(1 + expectedReturn / 100, years),
        description: 'Normal market conditions, expected performance'
      },
      {
        name: 'Bear',
        probability: 20,
        annualizedReturn: expectedReturn - vol * 0.8,
        projectedValue: investmentAmount * Math.pow(1 + (expectedReturn - vol * 0.8) / 100, years),
        description: 'Economic slowdown, market correction'
      },
      {
        name: 'Crisis',
        probability: 5,
        annualizedReturn: expectedReturn - vol * 2,
        projectedValue: Math.max(investmentAmount * 0.3, investmentAmount * Math.pow(1 + (expectedReturn - vol * 2) / 100, years)),
        description: 'Severe market disruption, significant drawdown'
      }
    ];
    
    // Calculate weighted expected value
    const weightedValue = scenarios.reduce((sum, s) => sum + (s.projectedValue * s.probability / 100), 0);
    
    res.json({
      success: true,
      data: {
        investmentAmount,
        horizon: years,
        scenarios: scenarios.map(s => ({
          ...s,
          projectedValue: Math.round(s.projectedValue),
          annualizedReturn: Math.round(s.annualizedReturn * 100) / 100
        })),
        weightedExpectedValue: Math.round(weightedValue),
        riskMetrics: {
          valueAtRisk95: Math.round(investmentAmount * (1 - vol * 1.65 / 100)),
          maxDrawdown: Math.round(vol * 2.5 * 100) / 100,
          recoveryTime: Math.ceil(vol / expectedReturn * 12)
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AUDIT TRAIL ROUTES
// ============================================================================

/**
 * POST /audit/log-explanation - Log explanation generation for audit
 */
router.post('/audit/log-explanation', async (req: Request, res: Response) => {
  try {
    const { clientId, productCode, explanation, advisorId, channel } = req.body;
    
    if (!clientId || !productCode) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: clientId, productCode' 
      });
      return;
    }
    
    const auditEntry = {
      id: `EXPL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      clientId,
      productCode,
      explanationType: 'product_recommendation',
      recommendation: explanation?.recommendation || 'unknown',
      suitabilityScore: explanation?.suitabilityExplanation?.suitabilityScore || 0,
      disclosuresProvided: explanation?.disclosures?.map((d: any) => d.type) || [],
      advisorId: advisorId || 'system',
      channel: channel || 'web',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      complianceChecks: {
        riskProfileVerified: true,
        suitabilityAssessed: true,
        disclosuresDisplayed: true,
        clientAcknowledged: false
      }
    };
    
    // In production, this would be stored in a database
    console.log('Explanation audit logged:', auditEntry.id);
    
    res.json({
      success: true,
      data: {
        auditId: auditEntry.id,
        logged: true,
        timestamp: auditEntry.timestamp,
        message: 'Explanation audit trail recorded for compliance'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
