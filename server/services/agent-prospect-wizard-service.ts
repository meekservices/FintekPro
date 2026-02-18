import { db } from "../db";
import { 
  prospectClients, 
  prospectProposals,
  prospectProposalEvents,
  InsertProspectClient,
  users,
  onboardingInvitations,
  agentClientMappingRequests,
  listedStocks,
  preIpoCompanies
} from "@shared/schema";
import { eq, and, desc, or, isNotNull, sql, ilike } from "drizzle-orm";
import { nanoid } from "nanoid";
import { aiInvestmentOrchestrator } from "./ai-investment-orchestrator";
import { aiResponseCacheService } from "./ai-response-cache-service";
import { proposalCapitalGainsService } from "./proposal-capital-gains-service";
import { historicalNavService } from "./historical-nav-service";
import { getRecommendationsByCategory, getAllActiveRecommendations } from "./recommendation-products-service";
import { mfReturnsSyncService } from "./mf-returns-sync-service";
import { mutualFunds, schemeTransactionRules, proposalAuditLog, proposalVersions, signalResolutionLog, rebalanceGovernanceConfig, rebalanceDecisionLog } from "@shared/schema";
import { prospectReadinessService } from "./prospect-readiness-service";
import { allocationPolicyService } from "./allocation-policy-service";
import { complianceSnapshotService } from "./compliance-snapshot-service";
import { schemeGovernanceService } from "./scheme-governance-service";
import { signalOrchestrator, OrchestratedRecommendation } from './signal-orchestrator';
import { pickOfTheDayService } from './pick-of-the-day-service';
import { quantOrchestrator } from './quant/quant-orchestrator';

// Format amount in Indian currency format (₹X.XX L for lakhs, ₹X.XX Cr for crores)
const formatAmount = (amount: number): string => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
};

// Real mutual fund recommendations based on risk profile - Using Regular plans for agent advisory
// Organized by asset class for flexible category-based filtering
// FUND_RECOMMENDATIONS_BY_CATEGORY - Fund metadata only, returns must be enriched via live data
// CRITICAL: Returns are set to 'PENDING' to force live enrichment - no static mock values
const FUND_RECOMMENDATIONS_BY_CATEGORY = {
  equity: {
    conservative: [
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    aggressive: [
      { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'HDFC Small Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'Kotak Small Cap Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
      { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Multi Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
      { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    ]
  },
  debt: {
    conservative: [
      { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Corporate Bond', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
      { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt - Medium Duration', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
      { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt - Banking & PSU', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    ],
    moderate: [
      { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Corporate Bond', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
      { name: 'HDFC Short Term Debt Fund - Regular (G)', amc: 'HDFC', category: 'Debt - Short Duration', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    ],
    aggressive: [
      { name: 'ICICI Pru Credit Risk Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Credit Risk', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'SBI Dynamic Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Dynamic Bond', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ]
  },
  hybrid: {
    conservative: [
      { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Balanced Advantage', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'ICICI Pru Equity & Debt Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Aggressive', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Aggressive', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'Kotak Equity Hybrid Fund - Regular (G)', amc: 'Kotak', category: 'Hybrid - Aggressive', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'ICICI Pru Multi Asset Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Multi Asset', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Multi Asset Fund - Regular (G)', amc: 'Quant', category: 'Hybrid - Multi Asset', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
    ]
  },
  gold_fof: {
    conservative: [
      { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'HDFC Gold Fund - Regular (G)', amc: 'HDFC', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'Axis Gold Fund - Regular (G)', amc: 'Axis', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ]
  },
  silver_fof: {
    conservative: [
      { name: 'ICICI Pru Silver ETF FOF - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Silver', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    moderate: [
      { name: 'Nippon India Silver ETF FOF - Regular (G)', amc: 'Nippon India', category: 'FOF - Silver', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    aggressive: [
      { name: 'Aditya Birla Sun Life Silver ETF FOF - Regular (G)', amc: 'Aditya Birla', category: 'FOF - Silver', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Kotak Silver ETF FOF - Regular (G)', amc: 'Kotak', category: 'FOF - Silver', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ]
  },
  index_fund: {
    conservative: [
      { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Index Fund - Nifty 50 Plan - Regular (G)', amc: 'HDFC', category: 'Index Fund - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'UTI Nifty Next 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large & Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    aggressive: [
      { name: 'Motilal Oswal Nifty Midcap 150 Index Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Index Fund - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Nippon India Nifty Smallcap 250 Index Fund - Regular (G)', amc: 'Nippon India', category: 'Index Fund - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    ]
  },
  etf: {
    conservative: [
      { name: 'Nippon India ETF Nifty BeES', amc: 'Nippon India', category: 'ETF - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
      { name: 'SBI ETF Nifty 50', amc: 'SBI', category: 'ETF - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'ICICI Pru Nifty Next 50 ETF', amc: 'ICICI Prudential', category: 'ETF - Large & Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
      { name: 'Nippon India ETF Bank BeES', amc: 'Nippon India', category: 'ETF - Banking', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
      { name: 'Kotak Nifty ETF', amc: 'Kotak', category: 'ETF - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'Motilal Oswal Midcap 100 ETF', amc: 'Motilal Oswal', category: 'ETF - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
      { name: 'Nippon India ETF Nifty IT', amc: 'Nippon India', category: 'ETF - Sectoral IT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Motilal Oswal Nifty Smallcap 250 ETF', amc: 'Motilal Oswal', category: 'ETF - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
      { name: 'ICICI Pru Nifty Pharma ETF', amc: 'ICICI Prudential', category: 'ETF - Sectoral Pharma', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    ]
  },
  international: {
    conservative: [
      { name: 'Motilal Oswal Nasdaq 100 FOF - Regular (G)', amc: 'Motilal Oswal', category: 'FOF - International', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'US' },
      { name: 'PGIM India Global Equity Opp Fund - Regular (G)', amc: 'PGIM India', category: 'FOF - International', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'Global' },
    ],
    moderate: [
      { name: 'Franklin India Feeder - Franklin US Opp Fund - Regular (G)', amc: 'Franklin', category: 'FOF - US Markets', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'US' },
      { name: 'Kotak International REIT FOF - Regular (G)', amc: 'Kotak', category: 'FOF - Global REIT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', region: 'Global' },
      { name: 'Nippon India Japan Equity Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Japan', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'Asia-Pacific' },
    ],
    aggressive: [
      { name: 'Nippon India US Equity Opp Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - US Markets', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'US' },
      { name: 'Kotak Nasdaq 100 FOF - Regular (G)', amc: 'Kotak', category: 'FOF - US Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'US' },
      { name: 'Edelweiss Europe Dynamic Equity Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - Europe', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', region: 'Europe' },
    ],
    very_aggressive: [
      { name: 'Edelweiss Greater China Equity Off-shore Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - China', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', region: 'Asia-Pacific' },
      { name: 'DSP Global Innovation FOF - Regular (G)', amc: 'DSP', category: 'FOF - Global Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', region: 'Global' },
      { name: 'ICICI Pru Global Advantage Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Global Multi-Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', region: 'Global' },
    ]
  },
  // Regional Global Market Categories for Diversification
  us_markets: {
    conservative: [
      { name: 'Motilal Oswal S&P 500 Index Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Index - S&P 500', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_etf', region: 'US', expenseRatio: '0.49%' },
      { name: 'Franklin India Feeder - Franklin US Opp Fund - Regular (G)', amc: 'Franklin', category: 'FOF - US Equity', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'US' },
    ],
    moderate: [
      { name: 'Motilal Oswal Nasdaq 100 FOF - Regular (G)', amc: 'Motilal Oswal', category: 'Index - Nasdaq 100', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_etf', region: 'US', expenseRatio: '0.50%' },
      { name: 'Kotak Nasdaq 100 FOF - Regular (G)', amc: 'Kotak', category: 'FOF - US Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'US' },
      { name: 'Mirae Asset NYSE FANG+ ETF FOF - Regular (G)', amc: 'Mirae Asset', category: 'ETF - US Tech Giants', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_etf', region: 'US', expenseRatio: '0.55%' },
    ],
    aggressive: [
      { name: 'Nippon India US Equity Opp Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - US Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'US' },
      { name: 'ICICI Pru US Bluechip Equity Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - US Blue Chip', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'US' },
      { name: 'DSP US Flexible Equity Fund - Regular (G)', amc: 'DSP', category: 'FOF - US Multi-Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'US' },
    ],
    very_aggressive: [
      { name: 'Motilal Oswal Nasdaq Q50 ETF - Regular (G)', amc: 'Motilal Oswal', category: 'ETF - US Tech Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_etf', region: 'US', expenseRatio: '0.58%' },
      { name: 'Axis Global Innovation FOF - Regular (G)', amc: 'Axis', category: 'FOF - US Innovation', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'US' },
    ]
  },
  europe_markets: {
    conservative: [
      { name: 'ICICI Pru European Markets Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Europe Diversified', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Europe' },
      { name: 'Edelweiss Europe Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - Pan-European', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Europe' },
    ],
    moderate: [
      { name: 'Franklin European Growth Fund - Regular (G)', amc: 'Franklin', category: 'FOF - Europe Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Europe' },
      { name: 'Kotak Global Emerging Market Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Europe & EM', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Europe' },
      { name: 'SBI European Equity Fund - Regular (G)', amc: 'SBI', category: 'FOF - Eurozone', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Europe' },
    ],
    aggressive: [
      { name: 'Edelweiss Europe Dynamic Equity Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - Europe Dynamic', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Europe' },
      { name: 'DSP European Opportunities Fund - Regular (G)', amc: 'DSP', category: 'FOF - European Mid-Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Europe' },
    ],
    very_aggressive: [
      { name: 'Mirae Asset European Small Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'FOF - Europe Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Europe' },
      { name: 'HDFC European Tech Fund - Regular (G)', amc: 'HDFC', category: 'FOF - Europe Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Europe' },
    ]
  },
  asia_pacific_markets: {
    conservative: [
      { name: 'Nippon India Japan Equity Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Japan', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'ICICI Pru Asia Pacific Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Asia-Pacific Diversified', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Asia-Pacific' },
    ],
    moderate: [
      { name: 'Kotak Pacific Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Pacific Rim', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'Franklin Asian Equity Fund - Regular (G)', amc: 'Franklin', category: 'FOF - Asian Equity', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'Mirae Asset ASEAN Fund - Regular (G)', amc: 'Mirae Asset', category: 'FOF - ASEAN Markets', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
    ],
    aggressive: [
      { name: 'Edelweiss Greater China Equity Off-shore Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - Greater China', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'SBI South Korea Fund - Regular (G)', amc: 'SBI', category: 'FOF - South Korea', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'Axis Taiwan Semiconductor Fund - Regular (G)', amc: 'Axis', category: 'FOF - Taiwan Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Asia-Pacific' },
    ],
    very_aggressive: [
      { name: 'DSP China Growth Fund - Regular (G)', amc: 'DSP', category: 'FOF - China Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'HDFC Asian Dragon Fund - Regular (G)', amc: 'HDFC', category: 'FOF - China & Hong Kong', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Asia-Pacific' },
      { name: 'Nippon India Vietnam Opp Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Vietnam', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Asia-Pacific' },
    ]
  },
  emerging_markets: {
    conservative: [
      { name: 'PGIM India Emerging Markets Fund - Regular (G)', amc: 'PGIM India', category: 'FOF - EM Diversified', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'ICICI Pru Emerging Markets Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - EM Index', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'international_fund', region: 'Emerging Markets' },
    ],
    moderate: [
      { name: 'Kotak BRICS Nations Fund - Regular (G)', amc: 'Kotak', category: 'FOF - BRICS', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'Franklin BRIC Fund - Regular (G)', amc: 'Franklin', category: 'FOF - BRIC Markets', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'SBI Emerging Markets Fund - Regular (G)', amc: 'SBI', category: 'FOF - EM Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
    ],
    aggressive: [
      { name: 'Edelweiss Latin America Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - Latin America', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'DSP Africa Opportunities Fund - Regular (G)', amc: 'DSP', category: 'FOF - Africa', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'Mirae Asset EM Consumer Fund - Regular (G)', amc: 'Mirae Asset', category: 'FOF - EM Consumer', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'international_fund', region: 'Emerging Markets' },
    ],
    very_aggressive: [
      { name: 'HDFC Emerging Markets Alpha Fund - Regular (G)', amc: 'HDFC', category: 'FOF - EM High Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'Axis Frontier Markets Fund - Regular (G)', amc: 'Axis', category: 'FOF - Frontier Markets', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Emerging Markets' },
      { name: 'Nippon India EM Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - EM Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'international_fund', region: 'Emerging Markets' },
    ]
  },
  reit: {
    conservative: [
      { name: 'Embassy Office Parks REIT', amc: 'Embassy Group', category: 'REIT - Office', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'reit' },
    ],
    moderate: [
      { name: 'Mindspace Business Parks REIT', amc: 'K Raheja Corp', category: 'REIT - Office', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'reit' },
      { name: 'Brookfield India Real Estate Trust', amc: 'Brookfield', category: 'REIT - Office', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'reit' },
    ],
    aggressive: [
      { name: 'Nexus Select Trust REIT', amc: 'Blackstone', category: 'REIT - Retail', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'reit' },
    ],
    very_aggressive: [
      { name: 'Embassy Office Parks REIT', amc: 'Embassy Group', category: 'REIT - Office', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'reit' },
    ]
  },
  invit: {
    conservative: [
      { name: 'IndiGrid InvIT', amc: 'IndiGrid', category: 'InvIT - Power Transmission', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'invit' },
    ],
    moderate: [
      { name: 'PowerGrid Infrastructure Investment Trust', amc: 'PGCIL', category: 'InvIT - Power Transmission', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'invit' },
      { name: 'India Grid Trust', amc: 'Sterlite Power', category: 'InvIT - Power Transmission', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'invit' },
    ],
    aggressive: [
      { name: 'IRB InvIT Fund', amc: 'IRB Infrastructure', category: 'InvIT - Roads', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'invit' },
    ],
    very_aggressive: [
      { name: 'National Highways Infra Trust', amc: 'NHAI', category: 'InvIT - Roads', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'invit' },
    ]
  },
  bonds: {
    conservative: [
      { name: 'REC Limited NCD - 7.5% 2028', amc: 'REC', category: 'Corporate Bond - PSU', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'bond' },
      { name: 'NHAI 54EC Bonds', amc: 'NHAI', category: 'Tax-Free Bond', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very Low', productType: 'bond' },
    ],
    moderate: [
      { name: 'PFC Limited NCD - 7.75% 2029', amc: 'PFC', category: 'Corporate Bond - PSU', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'bond' },
      { name: 'HDFC Ltd NCD - 8.0% 2027', amc: 'HDFC', category: 'Corporate Bond - NBFC', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'bond' },
    ],
    aggressive: [
      { name: 'Tata Capital NCD - 8.25% 2028', amc: 'Tata Capital', category: 'Corporate Bond - NBFC', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'bond' },
    ],
    very_aggressive: [
      { name: 'Shriram Transport Finance NCD - 9.0% 2027', amc: 'Shriram Transport', category: 'Corporate Bond - NBFC', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'bond' },
    ]
  },
  mld: {
    conservative: [
      { name: 'HDFC MLD - Principal Protected Nifty Linked', amc: 'HDFC', category: 'MLD - Principal Protected', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low', productType: 'mld' },
    ],
    moderate: [
      { name: 'ICICI Securities MLD - Equity Linked', amc: 'ICICI Securities', category: 'MLD - Equity Linked', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'mld' },
      { name: 'Kotak Mahindra MLD - Multi Asset', amc: 'Kotak', category: 'MLD - Multi Asset', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'mld' },
    ],
    aggressive: [
      { name: 'JM Financial MLD - Nifty Booster', amc: 'JM Financial', category: 'MLD - Nifty Linked', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'mld' },
    ],
    very_aggressive: [
      { name: 'Axis Securities MLD - Aggressive Growth', amc: 'Axis Securities', category: 'MLD - Equity Linked', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'mld' },
    ]
  },
  pms: {
    conservative: [
      { name: 'HDFC AMC PMS - Balanced', amc: 'HDFC AMC', category: 'PMS - Balanced', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'pms', minInvestment: 5000000 },
    ],
    moderate: [
      { name: 'Motilal Oswal PMS - Value Strategy', amc: 'Motilal Oswal', category: 'PMS - Value', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'pms', minInvestment: 5000000 },
      { name: 'Kotak PMS - Special Situations', amc: 'Kotak', category: 'PMS - Special Situations', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'pms', minInvestment: 5000000 },
    ],
    aggressive: [
      { name: 'ASK Investment PMS - Growth Portfolio', amc: 'ASK Investment', category: 'PMS - Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'pms', minInvestment: 5000000 },
    ],
    very_aggressive: [
      { name: 'Marcellus PMS - Consistent Compounders', amc: 'Marcellus', category: 'PMS - Quality', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'pms', minInvestment: 5000000 },
      { name: 'Alchemy Capital PMS - High Growth', amc: 'Alchemy Capital', category: 'PMS - High Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'pms', minInvestment: 5000000 },
    ]
  },
  aif: {
    conservative: [
      { name: 'ICICI Prudential Credit AIF - Category II', amc: 'ICICI Prudential', category: 'AIF - Credit', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'aif', minInvestment: 10000000 },
    ],
    moderate: [
      { name: 'Kotak Special Situations AIF - Category II', amc: 'Kotak', category: 'AIF - Special Situations', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'aif', minInvestment: 10000000 },
      { name: 'HDFC Ventures AIF - Category II', amc: 'HDFC', category: 'AIF - Growth', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'aif', minInvestment: 10000000 },
    ],
    aggressive: [
      { name: 'Edelweiss Pre-IPO AIF - Category I', amc: 'Edelweiss', category: 'AIF - Pre-IPO', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'aif', minInvestment: 10000000 },
    ],
    very_aggressive: [
      { name: 'True North AIF - Category II', amc: 'True North', category: 'AIF - Private Equity', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'aif', minInvestment: 10000000 },
      { name: 'Multiples PE AIF - Category II', amc: 'Multiples', category: 'AIF - Growth Equity', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'aif', minInvestment: 10000000 },
    ]
  },
  listed_stocks: {
    conservative: [
      { name: 'Reliance Industries Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'stock', ticker: 'RELIANCE' },
      { name: 'HDFC Bank Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Banking', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'stock', ticker: 'HDFCBANK' },
      { name: 'Tata Consultancy Services Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap IT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'stock', ticker: 'TCS' },
    ],
    moderate: [
      { name: 'Infosys Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap IT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'stock', ticker: 'INFY' },
      { name: 'ICICI Bank Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Banking', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'stock', ticker: 'ICICIBANK' },
      { name: 'Bharti Airtel Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Telecom', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'stock', ticker: 'BHARTIARTL' },
      { name: 'Larsen & Toubro Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Infrastructure', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'stock', ticker: 'LT' },
    ],
    aggressive: [
      { name: 'Bajaj Finance Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap NBFC', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'stock', ticker: 'BAJFINANCE' },
      { name: 'Tata Motors Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Auto', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'stock', ticker: 'TATAMOTORS' },
      { name: 'SBI Cards Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap Financial', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'stock', ticker: 'SBICARD' },
      { name: 'Persistent Systems Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap IT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'stock', ticker: 'PERSISTENT' },
    ],
    very_aggressive: [
      { name: 'Zomato Ltd', amc: 'NSE/BSE', category: 'Stock - New Age Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'ZOMATO' },
      { name: 'Paytm (One97 Communications)', amc: 'NSE/BSE', category: 'Stock - Fintech', returns1Y: '-25.5', returns3Y: '-15.0', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'PAYTM' },
      { name: 'Tata Elxsi Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap IT Services', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'stock', ticker: 'TATAELXSI' },
      { name: 'Dixon Technologies Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap Electronics', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'stock', ticker: 'DIXON' },
      { name: 'Happiest Minds Technologies', amc: 'NSE/BSE', category: 'Stock - Small Cap IT', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'HAPPSTMNDS' },
    ]
  },
  unlisted_stocks: {
    conservative: [
      { name: 'NSE India Ltd', amc: 'Unlisted', category: 'Unlisted - Exchange', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    moderate: [
      { name: 'HDB Financial Services Ltd', amc: 'Unlisted', category: 'Unlisted - NBFC', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Tata Technologies Ltd', amc: 'Unlisted', category: 'Unlisted - Engineering', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    aggressive: [
      { name: 'Swiggy (Bundl Technologies)', amc: 'Unlisted', category: 'Unlisted - Food Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'PhonePe (PhonePe Pvt Ltd)', amc: 'Unlisted', category: 'Unlisted - Fintech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Lenskart Solutions Pvt Ltd', amc: 'Unlisted', category: 'Unlisted - E-commerce', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    very_aggressive: [
      { name: 'OfBusiness (OFB Tech Pvt Ltd)', amc: 'Unlisted', category: 'Unlisted - B2B Commerce', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Pine Labs Pvt Ltd', amc: 'Unlisted', category: 'Unlisted - Payment Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Pharmeasy (API Holdings)', amc: 'Unlisted', category: 'Unlisted - Health Tech', returns1Y: '-15.0', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'ixigo (Le Travenues Technology)', amc: 'Unlisted', category: 'Unlisted - Travel Tech', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ]
  }
};

// Legacy format for backward compatibility
const REAL_FUND_RECOMMENDATIONS = {
  conservative: [
    { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
  ],
  moderate: [
    { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
    { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Low' },
    { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
  ],
  aggressive: [
    { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderately High' },
    { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
    { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
  ],
  very_aggressive: [
    { name: 'Quant Multi Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'High' },
    { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Very High' },
    { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: 'PENDING', returns3Y: 'PENDING', returns5Y: 'PENDING', risk: 'Moderate' },
  ]
};

/**
 * PURCHASE RESTRICTION REGISTRY
 * Funds that are currently not accepting certain types of investments.
 * This list should be updated periodically based on AMC circulars.
 * 
 * restrictionType: 'lumpsum' = not accepting one-time purchases, 'sip' = not accepting new SIPs, 'both' = fully closed
 * reason: Human-readable reason for the restriction
 * effectiveFrom: When the restriction started (for audit trail)
 * alternativeFund: Suggested replacement fund when this fund is excluded
 */
export const PURCHASE_RESTRICTED_FUNDS: Array<{
  fundNamePattern: string;
  restrictionType: 'lumpsum' | 'sip' | 'both';
  reason: string;
  effectiveFrom: string;
  alternativeFund?: string;
}> = [
  {
    fundNamePattern: 'Nippon India Small Cap Fund',
    restrictionType: 'lumpsum',
    reason: 'AMC has temporarily suspended lumpsum investments due to fund size management',
    effectiveFrom: '2024-10-01',
    alternativeFund: 'HDFC Small Cap Fund - Regular (G)'
  },
  {
    fundNamePattern: 'SBI Small Cap Fund',
    restrictionType: 'lumpsum',
    reason: 'AMC has restricted lumpsum investments to protect existing investors',
    effectiveFrom: '2024-06-01',
    alternativeFund: 'Kotak Small Cap Fund - Regular (G)'
  },
  {
    fundNamePattern: 'Tata Small Cap Fund',
    restrictionType: 'lumpsum',
    reason: 'AMC has suspended lumpsum purchases in this scheme',
    effectiveFrom: '2024-09-01',
    alternativeFund: 'HDFC Small Cap Fund - Regular (G)'
  }
];

export function isLumpsumRestricted(fundName: string): { restricted: boolean; reason?: string; alternative?: string } {
  const match = PURCHASE_RESTRICTED_FUNDS.find(
    r => fundName.toLowerCase().includes(r.fundNamePattern.toLowerCase()) && 
         (r.restrictionType === 'lumpsum' || r.restrictionType === 'both')
  );
  if (match) {
    return { restricted: true, reason: match.reason, alternative: match.alternativeFund };
  }
  return { restricted: false };
}

export function isSipRestricted(fundName: string): { restricted: boolean; reason?: string; alternative?: string } {
  const match = PURCHASE_RESTRICTED_FUNDS.find(
    r => fundName.toLowerCase().includes(r.fundNamePattern.toLowerCase()) && 
         (r.restrictionType === 'sip' || r.restrictionType === 'both')
  );
  if (match) {
    return { restricted: true, reason: match.reason, alternative: match.alternativeFund };
  }
  return { restricted: false };
}

/**
 * Look up a fund by name from all catalogs (FUND_RECOMMENDATIONS_BY_CATEGORY + REAL_FUND_RECOMMENDATIONS).
 * Returns the actual catalog entry if found, null otherwise.
 */
function findFundInCatalog(fundName: string): any | null {
  const searchName = fundName.toLowerCase();
  
  for (const category of Object.values(FUND_RECOMMENDATIONS_BY_CATEGORY)) {
    for (const riskFunds of Object.values(category)) {
      const found = (riskFunds as any[]).find((f: any) => f.name.toLowerCase() === searchName);
      if (found) return { ...found };
    }
  }
  
  for (const riskFunds of Object.values(REAL_FUND_RECOMMENDATIONS)) {
    const found = (riskFunds as any[]).find((f: any) => f.name.toLowerCase() === searchName);
    if (found) return { ...found };
  }
  
  return null;
}

/**
 * DB-driven eligibility check for a single fund.
 * Queries scheme_transaction_rules first, falls back to hardcoded registry.
 */
async function checkFundLumpsumEligibility(fundName: string): Promise<{
  restricted: boolean;
  reason?: string;
  alternativeName?: string;
}> {
  try {
    const eligibility = await schemeGovernanceService.checkEligibility(fundName, "name");
    if (!eligibility.lumpsumAllowed) {
      return {
        restricted: true,
        reason: eligibility.restrictionReason || "Lumpsum not allowed per AMC rules",
        alternativeName: eligibility.alternativeSchemeName || undefined,
      };
    }
  } catch (err) {
    // DB unavailable — fall through to hardcoded registry
  }
  const hardcoded = isLumpsumRestricted(fundName);
  return {
    restricted: hardcoded.restricted,
    reason: hardcoded.reason,
    alternativeName: hardcoded.alternative,
  };
}

async function checkFundSipEligibility(fundName: string): Promise<{
  restricted: boolean;
  reason?: string;
  alternativeName?: string;
}> {
  try {
    const eligibility = await schemeGovernanceService.checkEligibility(fundName, "name");
    if (!eligibility.sipAllowed) {
      return {
        restricted: true,
        reason: eligibility.restrictionReason || "SIP not allowed per AMC rules",
        alternativeName: eligibility.alternativeSchemeName || undefined,
      };
    }
  } catch (err) {
    // DB unavailable — fall through to hardcoded registry
  }
  const hardcoded = isSipRestricted(fundName);
  return {
    restricted: hardcoded.restricted,
    reason: hardcoded.reason,
    alternativeName: hardcoded.alternative,
  };
}

/**
 * Unified helper: select eligible funds for lumpsum investment from a candidate list.
 * Uses DB-driven eligibility (scheme_transaction_rules) with hardcoded registry fallback.
 * Resolves configured alternatives from the actual master catalog.
 * Returns at most `maxFunds` entries.
 */
async function selectEligibleFundsForLumpsum(candidateFunds: any[], maxFunds: number = 2): Promise<any[]> {
  const eligible: any[] = [];
  const alternatives: string[] = [];

  for (const fund of candidateFunds) {
    const restriction = await checkFundLumpsumEligibility(fund.name);
    if (restriction.restricted) {
      console.log(`[FundRestriction] Excluding ${fund.name} from lumpsum: ${restriction.reason}`);
      if (restriction.alternativeName) {
        alternatives.push(restriction.alternativeName);
      }
    } else {
      eligible.push(fund);
    }
  }

  if (eligible.length >= maxFunds) {
    return eligible.slice(0, maxFunds);
  }

  const seenNames = new Set(eligible.map(f => f.name.toLowerCase()));
  for (const altName of alternatives) {
    if (eligible.length >= maxFunds) break;
    if (seenNames.has(altName.toLowerCase())) continue;

    const catalogEntry = findFundInCatalog(altName);
    if (catalogEntry) {
      const altRestriction = await checkFundLumpsumEligibility(catalogEntry.name);
      if (!altRestriction.restricted) {
        eligible.push(catalogEntry);
        seenNames.add(catalogEntry.name.toLowerCase());
        console.log(`[FundRestriction] Resolved alternative from catalog: ${catalogEntry.name} (${catalogEntry.amc})`);
      }
    } else {
      console.log(`[FundRestriction] Alternative ${altName} not found in catalog, skipping`);
    }
  }

  return eligible.slice(0, maxFunds);
}

/**
 * Enrich fund recommendations with live returns from database/MFAPI
 * Falls back to static values if live data unavailable
 */
async function enrichFundWithLiveReturns(fund: {
  name: string;
  amc: string;
  category: string;
  returns1Y: string;
  returns3Y: string;
  returns5Y: string;
  risk: string;
  [key: string]: any;
}): Promise<typeof fund> {
  try {
    // Search for scheme by name (partial match)
    const searchTerm = fund.name.replace(/- Regular \(G\)|- Growth|- Direct.*$/gi, '').trim();
    
    const matchingFunds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      returns1y: mutualFunds.returns1y,
      returns3y: mutualFunds.returns3y,
      returns5y: mutualFunds.returns5y,
      nav: mutualFunds.nav
    })
    .from(mutualFunds)
    .where(sql`${mutualFunds.schemeName} ILIKE ${'%' + searchTerm + '%'}`)
    .limit(5);

    // Find best match (Regular plan preferred)
    let bestMatch = matchingFunds.find(f => 
      f.schemeName?.toLowerCase().includes('regular') || 
      !f.schemeName?.toLowerCase().includes('direct')
    ) || matchingFunds[0];

    if (bestMatch && bestMatch.schemeCode) {
      // Check if we have returns in DB
      if (bestMatch.returns1y || bestMatch.returns3y) {
        console.log(`[LiveReturns] Found DB returns for ${fund.name}: 1Y=${bestMatch.returns1y}, 3Y=${bestMatch.returns3y}`);
        return {
          ...fund,
          returns1Y: bestMatch.returns1y ? parseFloat(bestMatch.returns1y as string).toFixed(1) : fund.returns1Y,
          returns3Y: bestMatch.returns3y ? parseFloat(bestMatch.returns3y as string).toFixed(1) : fund.returns3Y,
          returns5Y: bestMatch.returns5y ? parseFloat(bestMatch.returns5y as string).toFixed(1) : fund.returns5Y,
          schemeCode: bestMatch.schemeCode,
          dataSource: 'live'
        };
      }

      // Try fetching live returns from MFAPI
      const liveReturns = await mfReturnsSyncService.getReturnsForFund(bestMatch.schemeCode);
      if (liveReturns && liveReturns.dataQuality !== 'insufficient') {
        console.log(`[LiveReturns] Fetched MFAPI returns for ${fund.name}: 1Y=${liveReturns.returns1y?.toFixed(1)}, 3Y=${liveReturns.returns3y?.toFixed(1)}`);
        return {
          ...fund,
          returns1Y: liveReturns.returns1y ? liveReturns.returns1y.toFixed(1) : fund.returns1Y,
          returns3Y: liveReturns.returns3y ? liveReturns.returns3y.toFixed(1) : fund.returns3Y,
          returns5Y: liveReturns.returns5y ? liveReturns.returns5y.toFixed(1) : fund.returns5Y,
          schemeCode: bestMatch.schemeCode,
          dataSource: 'mfapi'
        };
      }
    }
  } catch (error: any) {
    console.warn(`[LiveReturns] Failed to enrich ${fund.name}:`, error.message);
  }

  // CRITICAL: No static fallback - mark returns as unavailable to avoid mock data
  // Clear static returns and flag as unavailable so UI can handle appropriately
  return { 
    ...fund, 
    returns1Y: 'N/A',
    returns3Y: 'N/A', 
    returns5Y: 'N/A',
    dataSource: 'unavailable',
    dataUnavailableReason: 'Live returns not available - sync pending'
  };
}

/**
 * Enrich all funds in a category with live returns (batch)
 */
async function enrichCategoryFundsWithLiveReturns(funds: Array<{
  name: string;
  amc: string;
  category: string;
  returns1Y: string;
  returns3Y: string;
  returns5Y: string;
  risk: string;
  [key: string]: any;
}>): Promise<typeof funds> {
  // Process in parallel with concurrency limit
  const enrichedFunds = await Promise.all(
    funds.map(fund => enrichFundWithLiveReturns(fund))
  );
  return enrichedFunds;
}

/**
 * Get fund recommendations with live returns for a given category and risk profile
 */
export async function getLiveFundRecommendations(
  assetClass: keyof typeof FUND_RECOMMENDATIONS_BY_CATEGORY,
  riskProfile: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive'
): Promise<typeof REAL_FUND_RECOMMENDATIONS.conservative> {
  const categoryFunds = FUND_RECOMMENDATIONS_BY_CATEGORY[assetClass];
  if (!categoryFunds) return [];
  
  const funds = categoryFunds[riskProfile] || [];
  return enrichCategoryFundsWithLiveReturns(funds as any);
}

/**
 * In-memory cache for live fund returns (populated by scheduler)
 * Key: fund name (normalized), Value: { returns1Y, returns3Y, returns5Y, dataSource, syncedAt }
 */
const liveReturnsCache = new Map<string, {
  returns1Y: string;
  returns3Y: string;
  returns5Y: string;
  dataSource: 'live' | 'mfapi';
  syncedAt: Date;
}>();

/**
 * Update live returns cache (called by scheduler after sync)
 */
export function updateLiveReturnsCache(fundName: string, returns: {
  returns1Y: number | null;
  returns3Y: number | null;
  returns5Y: number | null;
  dataSource: 'live' | 'mfapi';
}): void {
  const normalizedName = fundName.toLowerCase().replace(/\s+/g, ' ').trim();
  liveReturnsCache.set(normalizedName, {
    returns1Y: returns.returns1Y?.toFixed(1) || 'N/A',
    returns3Y: returns.returns3Y?.toFixed(1) || 'N/A',
    returns5Y: returns.returns5Y?.toFixed(1) || 'N/A',
    dataSource: returns.dataSource,
    syncedAt: new Date()
  });
}

/**
 * Normalize fund name for cache lookup (handles variations in naming)
 */
function normalizeFundName(name: string): string[] {
  const base = name.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Generate multiple variations to improve cache hit rate
  const variations = [base];
  
  // Remove common suffixes
  const withoutSuffixes = base
    .replace(/- regular \(g\)/gi, '')
    .replace(/- direct \(g\)/gi, '')
    .replace(/- growth/gi, '')
    .replace(/regular plan/gi, '')
    .replace(/direct plan/gi, '')
    .trim();
  
  if (withoutSuffixes !== base) variations.push(withoutSuffixes);
  
  return variations;
}

/**
 * Get cached live returns for a fund (tries multiple name variations)
 */
function getCachedLiveReturns(fundName: string): {
  returns1Y: string;
  returns3Y: string;
  returns5Y: string;
  dataSource: string;
} | null {
  const nameVariations = normalizeFundName(fundName);
  
  for (const normalizedName of nameVariations) {
    const cached = liveReturnsCache.get(normalizedName);
    
    if (cached) {
      // Check if cache is fresh (less than 24 hours)
      const hoursSinceSynced = (Date.now() - cached.syncedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSynced < 24) {
        return cached;
      }
    }
    
    // Also try partial matching for common fund names
    for (const [cacheKey, value] of liveReturnsCache.entries()) {
      if (cacheKey.includes(normalizedName) || normalizedName.includes(cacheKey)) {
        const hoursSinceSynced = (Date.now() - value.syncedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceSynced < 24) {
          return value;
        }
      }
    }
  }
  
  return null;
}

/**
 * Sanitize fund data to ensure no 'PENDING' values leak to users
 * First tries cache, then queries database, then falls back to N/A
 */
async function sanitizeFundForDisplayAsync(fund: any): Promise<any> {
  if (!fund) return null;
  
  const sanitized = { ...fund };
  
  // 1. First try to get cached live returns (fast path)
  const cachedReturns = getCachedLiveReturns(fund.name);
  if (cachedReturns) {
    sanitized.returns1Y = cachedReturns.returns1Y;
    sanitized.returns3Y = cachedReturns.returns3Y;
    sanitized.returns5Y = cachedReturns.returns5Y;
    sanitized.dataSource = cachedReturns.dataSource;
    return sanitized;
  }
  
  // 2. Cache miss - query database directly (slower but accurate)
  try {
    const dbResult = await db.select({
      schemeName: mutualFunds.schemeName,
      returns1y: mutualFunds.returns1y,
      returns3y: mutualFunds.returns3y,
      returns5y: mutualFunds.returns5y
    })
    .from(mutualFunds)
    .where(sql`LOWER(${mutualFunds.schemeName}) LIKE LOWER(${'%' + fund.name.split(' ').slice(0, 3).join(' ') + '%'})`)
    .limit(1);
    
    if (dbResult[0] && (dbResult[0].returns1y || dbResult[0].returns3y)) {
      sanitized.returns1Y = dbResult[0].returns1y ? parseFloat(dbResult[0].returns1y as string).toFixed(1) : 'N/A';
      sanitized.returns3Y = dbResult[0].returns3y ? parseFloat(dbResult[0].returns3y as string).toFixed(1) : 'N/A';
      sanitized.returns5Y = dbResult[0].returns5y ? parseFloat(dbResult[0].returns5y as string).toFixed(1) : 'N/A';
      sanitized.dataSource = 'live';
      
      // Update cache for future requests
      updateLiveReturnsCache(fund.name, {
        returns1Y: dbResult[0].returns1y ? parseFloat(dbResult[0].returns1y as string) : null,
        returns3Y: dbResult[0].returns3y ? parseFloat(dbResult[0].returns3y as string) : null,
        returns5Y: dbResult[0].returns5y ? parseFloat(dbResult[0].returns5y as string) : null,
        dataSource: 'live'
      });
      
      return sanitized;
    }
  } catch (error) {
    // Database query failed - continue to fallback
  }
  
  // 3. Fallback: Replace 'PENDING' with 'N/A' for user display
  if (sanitized.returns1Y === 'PENDING') sanitized.returns1Y = 'N/A';
  if (sanitized.returns3Y === 'PENDING') sanitized.returns3Y = 'N/A';
  if (sanitized.returns5Y === 'PENDING') sanitized.returns5Y = 'N/A';
  
  // Add dataSource flag if returns are unavailable
  if (sanitized.returns1Y === 'N/A' && sanitized.returns3Y === 'N/A') {
    sanitized.dataSource = 'unavailable';
    sanitized.returnsNote = 'Live returns sync pending';
  }
  
  return sanitized;
}

/**
 * Sync version for backward compatibility (uses cache only, no DB fallback)
 */
function sanitizeFundForDisplay(fund: any): any {
  if (!fund) return null;
  
  const sanitized = { ...fund };
  
  const cachedReturns = getCachedLiveReturns(fund.name);
  if (cachedReturns) {
    sanitized.returns1Y = cachedReturns.returns1Y;
    sanitized.returns3Y = cachedReturns.returns3Y;
    sanitized.returns5Y = cachedReturns.returns5Y;
    sanitized.dataSource = cachedReturns.dataSource;
    return sanitized;
  }
  
  if (sanitized.returns1Y === 'PENDING') sanitized.returns1Y = 'N/A';
  if (sanitized.returns3Y === 'PENDING') sanitized.returns3Y = 'N/A';
  if (sanitized.returns5Y === 'PENDING') sanitized.returns5Y = 'N/A';
  
  if (sanitized.returns1Y === 'N/A' && sanitized.returns3Y === 'N/A') {
    sanitized.dataSource = 'unavailable';
    sanitized.returnsNote = 'Live returns sync pending';
  }
  
  return sanitized;
}

/**
 * Get funds from category with sanitization (sync access for internal use)
 * Returns funds with PENDING values replaced with N/A
 * NOTE: For async live enrichment, use getFundsFromCategorySanitizedAsync()
 */
function getfundsFromCategorySanitized(category: string, riskProfile: string): any[] {
  const rawFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                   (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
  return rawFunds.map(sanitizeFundForDisplay);
}

/**
 * Get funds from category with async sanitization (queries DB on cache miss)
 * Returns funds with live returns from database when available
 * PREFERRED METHOD for user-facing proposal data
 */
async function getFundsFromCategorySanitizedAsync(category: string, riskProfile: string): Promise<any[]> {
  const rawFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                   (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
  
  // Use Promise.all for parallel database lookups
  const sanitizedFunds = await Promise.all(rawFunds.map(sanitizeFundForDisplayAsync));
  return sanitizedFunds;
}

/**
 * Get funds with LIVE returns from database/MFAPI (async)
 * This is the preferred method for user-facing proposal data
 */
async function getFundsWithLiveReturns(category: string, riskProfile: string): Promise<any[]> {
  const rawFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                   (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
  
  if (rawFunds.length === 0) return [];
  
  // Enrich with live data from DB/MFAPI
  const enriched = await enrichCategoryFundsWithLiveReturns(rawFunds);
  
  return enriched;
}

/**
 * SAFE accessor for fund recommendations - always returns enriched data or unavailable marker
 * Use this instead of directly accessing FUND_RECOMMENDATIONS_BY_CATEGORY
 */
export async function getSafeFundRecommendations(
  category: string,
  riskProfile: string
): Promise<Array<{
  name: string;
  amc: string;
  category: string;
  returns1Y: string;
  returns3Y: string;
  returns5Y: string;
  risk: string;
  dataSource: 'live' | 'mfapi' | 'unavailable';
  [key: string]: any;
}>> {
  const rawFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                   (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
  
  if (rawFunds.length === 0) return [];
  
  // Enrich with live data - returns will be 'N/A' if unavailable
  const enrichedFunds = await enrichCategoryFundsWithLiveReturns(rawFunds);
  
  // Filter out funds with no returns data if strict mode needed
  return enrichedFunds.map(fund => ({
    ...fund,
    // Ensure dataSource is always present for transparency
    dataSource: fund.dataSource || 'unavailable'
  }));
}

// Product categories available for agent selection
export const PRODUCT_CATEGORIES = [
  { id: 'equity', label: 'Equity Mutual Funds', description: 'Large cap, mid cap, small cap, flexi cap funds' },
  { id: 'debt', label: 'Debt Mutual Funds', description: 'Corporate bonds, government securities, short duration' },
  { id: 'hybrid', label: 'Hybrid Funds', description: 'Balanced advantage, aggressive hybrid, multi-asset' },
  { id: 'gold_fof', label: 'Gold FOF', description: 'Gold Fund of Funds for portfolio hedging' },
  { id: 'silver_fof', label: 'Silver FOF', description: 'Silver ETF Fund of Funds' },
  { id: 'index_fund', label: 'Index Funds', description: 'Passive funds tracking Nifty, Sensex indices' },
  { id: 'etf', label: 'ETFs', description: 'Exchange Traded Funds on NSE/BSE (Nifty Bees, Bank Bees, etc.)' },
  { id: 'international', label: 'International FOF', description: 'US equity, global tech, emerging markets funds' },
  { id: 'reit', label: 'REITs', description: 'Embassy, Mindspace, Brookfield real estate trusts' },
  { id: 'invit', label: 'InvITs', description: 'IndiGrid, IRB, PowerGrid infrastructure trusts' },
  { id: 'bonds', label: 'Corporate Bonds/NCDs', description: 'Direct corporate bonds, NCDs, G-Secs' },
  { id: 'mld', label: 'MLDs', description: 'Market Linked Debentures for tax-efficient returns' },
  { id: 'listed_stocks', label: 'Listed Stocks', description: 'Direct equity in NSE/BSE listed companies' },
  { id: 'unlisted_stocks', label: 'Unlisted Stocks', description: 'Pre-IPO & private company shares (Enhanced KYC required)', requiresEnhancedKYC: true },
  { id: 'pms', label: 'PMS', description: 'Portfolio Management Services (Min ₹50L)', minInvestment: 5000000 },
  { id: 'aif', label: 'AIF', description: 'Alternative Investment Funds (Min ₹1Cr)', minInvestment: 10000000 },
];

// Export for API access
export { FUND_RECOMMENDATIONS_BY_CATEGORY };

// Helper function to get recommendations from database with fallback to hardcoded
async function getRecommendationsForCategory(
  category: string,
  riskProfile: string
): Promise<any[]> {
  // Map category names to product types for database lookup
  const categoryToProductType: Record<string, string> = {
    'listed_stocks': 'listed_stock',
    'unlisted_stocks': 'unlisted_stock',
    'reit': 'reit',
    'invit': 'invit',
  };
  
  const productType = categoryToProductType[category];
  
  // Only fetch from database for stocks, REITs, InvITs
  if (productType) {
    try {
      const dbRecommendations = await getRecommendationsByCategory(productType, riskProfile);
      if (dbRecommendations.length > 0) {
        console.log(`[Recommendations] Using ${dbRecommendations.length} ${category} recommendations from database for ${riskProfile}`);
        return dbRecommendations;
      }
    } catch (error) {
      console.error(`[Recommendations] Error fetching ${category} from database:`, error);
    }
  }
  
  // Fallback to hardcoded data
  const hardcodedData = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                        (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
  return hardcodedData;
}

// Preload database recommendations into FUND_RECOMMENDATIONS_BY_CATEGORY
// This allows synchronous access in existing functions while using DB data
async function initializeRecommendationsFromDatabase(): Promise<void> {
  try {
    const dbProducts = await getAllActiveRecommendations();
    
    const productTypeToCategory: Record<string, string> = {
      'listed_stock': 'listed_stocks',
      'unlisted_stock': 'unlisted_stocks',
      'reit': 'reit',
      'invit': 'invit',
    };
    
    let mergedCount = 0;
    
    // Merge database products into FUND_RECOMMENDATIONS_BY_CATEGORY
    for (const [productType, riskProfiles] of Object.entries(dbProducts)) {
      const category = productTypeToCategory[productType];
      if (!category) continue;
      
      // Ensure category exists in FUND_RECOMMENDATIONS_BY_CATEGORY
      if (!(FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]) {
        (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category] = {};
      }
      
      for (const [riskProfile, products] of Object.entries(riskProfiles as Record<string, any[]>)) {
        // Merge with existing (DB products take priority)
        (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category][riskProfile] = products;
        mergedCount += products.length;
      }
    }
    
    if (mergedCount > 0) {
      console.log(`[Recommendations] Loaded ${mergedCount} products from database into recommendation catalog`);
    }
  } catch (error) {
    console.error("[Recommendations] Failed to load from database, using hardcoded data:", error);
  }
}

// Initialize on module load (async, won't block)
initializeRecommendationsFromDatabase().catch(err => {
  console.error("[Recommendations] Initialization failed:", err);
});

// Export for manual refresh
export { initializeRecommendationsFromDatabase };

// Fetch listed stocks by broad sector for AI recommendations
// This queries the enriched listed_stocks table directly

export interface ListedStockRecommendation {
  id: string;
  name: string;
  symbol: string;
  broadSector: string;
  sector: string;
  peRatio?: string;
  currentPrice?: string;
  marketCap?: string;
  dividendYield?: string;
  nseCode?: string;
  bseCode?: string;
  returns1Y?: string;
  returns3Y?: string;
  riskLevel: string;
}

export async function getListedStocksBySector(
  broadSector: string,
  limit: number = 10
): Promise<ListedStockRecommendation[]> {
  try {
    const stocks = await db
      .select({
        id: listedStocks.id,
        name: listedStocks.companyName,
        symbol: listedStocks.symbol,
        broadSector: listedStocks.broadSector,
        sector: listedStocks.sector,
        peRatio: listedStocks.peRatio,
        currentPrice: listedStocks.currentPrice,
        marketCap: listedStocks.marketCap,
        dividendYield: listedStocks.dividendYield,
        nseCode: listedStocks.nseCode,
        bseCode: listedStocks.bseCode,
        returns1Y: listedStocks.returns1Y,
        returns3Y: listedStocks.returns3Y,
      })
      .from(listedStocks)
      .where(
        and(
          eq(listedStocks.broadSector, broadSector),
          eq(listedStocks.isPublished, true)
        )
      )
      .orderBy(desc(listedStocks.marketCap))
      .limit(limit);
    
    return stocks.map(stock => ({
      ...stock,
      name: stock.name || stock.symbol,
      symbol: stock.symbol || '',
      broadSector: stock.broadSector || 'Others',
      sector: stock.sector || 'General',
      riskLevel: determineRiskLevel(stock.marketCap),
    }));
  } catch (error) {
    console.error(`[ListedStocks] Error fetching stocks for sector ${broadSector}:`, error);
    return [];
  }
}

function determineRiskLevel(marketCap?: string | null): string {
  if (!marketCap) return 'Moderate';
  const cap = marketCap.toLowerCase();
  if (cap.includes('large')) return 'Moderate';
  if (cap.includes('mid')) return 'Moderately High';
  if (cap.includes('small')) return 'High';
  return 'Moderate';
}

// Get available broad sectors with stock counts
export async function getAvailableBroadSectors(): Promise<{ sector: string; count: number }[]> {
  try {
    const sectors = await db
      .select({
        sector: listedStocks.broadSector,
        count: sql<number>`count(*)::int`,
      })
      .from(listedStocks)
      .where(
        and(
          eq(listedStocks.isPublished, true),
          isNotNull(listedStocks.broadSector)
        )
      )
      .groupBy(listedStocks.broadSector)
      .orderBy(desc(sql`count(*)`));
    
    return sectors.map(s => ({
      sector: s.sector || 'Others',
      count: s.count,
    }));
  } catch (error) {
    console.error('[ListedStocks] Error fetching available sectors:', error);
    return [];
  }
}

// Get recommended stocks for a risk profile from multiple sectors
export async function getListedStockRecommendations(
  riskProfile: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive',
  preferredSectors?: string[],
  limit: number = 10
): Promise<ListedStockRecommendation[]> {
  try {
    // Default sectors by risk profile if none specified
    const defaultSectorsByRisk = {
      conservative: ['Banking & Finance', 'Infrastructure & Construction', 'Consumer Goods & Retail'],
      moderate: ['Technology', 'Banking & Finance', 'Healthcare & Pharma', 'Manufacturing'],
      aggressive: ['Technology', 'Healthcare & Pharma', 'Chemicals', 'Manufacturing'],
      very_aggressive: ['Technology', 'Real Estate', 'Energy & Utilities', 'Metals & Mining'],
    };
    
    const sectors = preferredSectors && preferredSectors.length > 0 
      ? preferredSectors 
      : defaultSectorsByRisk[riskProfile];
    
    // Fetch stocks from each sector
    const stockPromises = sectors.map(sector => 
      getListedStocksBySector(sector, Math.ceil(limit / sectors.length))
    );
    
    const stockArrays = await Promise.all(stockPromises);
    const allStocks = stockArrays.flat();
    
    // Sort by market cap and return limited results
    return allStocks
      .sort((a, b) => {
        const capOrder: Record<string, number> = { 'Large Cap': 3, 'Mid Cap': 2, 'Small Cap': 1 };
        return (capOrder[b.marketCap || ''] || 0) - (capOrder[a.marketCap || ''] || 0);
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[ListedStocks] Error fetching recommendations:', error);
    return [];
  }
}


// ============== UNLISTED STOCKS / PRE-IPO COMPANIES FOR AI RECOMMENDATIONS ==============

export interface UnlistedStockRecommendation {
  id: string;
  name: string;
  sector: string;
  broadSector: string;
  industry: string;
  currentValuation?: string;
  expectedReturns?: string;
  riskRating?: string;
  investmentTier?: string;
  minimumInvestment?: string;
  ipoStatus?: string;
  expectedIpoDate?: string;
  riskLevel: string;
  requiresEnhancedKyc: boolean;
}

// Sector consolidation mapping for unlisted stocks (reuses same 12 broad sectors)
function mapUnlistedToBroadSector(sector?: string | null): string {
  if (!sector) return 'Others';
  const sectorLower = sector.toLowerCase();
  
  // Technology sector
  if (sectorLower.includes('technology') || sectorLower.includes('software') || 
      sectorLower.includes('it') || sectorLower.includes('tech') ||
      sectorLower.includes('fintech') || sectorLower.includes('saas') ||
      sectorLower.includes('ai') || sectorLower.includes('edtech') ||
      sectorLower.includes('digital') || sectorLower.includes('internet')) {
    return 'Technology';
  }
  
  // Banking & Finance
  if (sectorLower.includes('bank') || sectorLower.includes('financ') || 
      sectorLower.includes('nbfc') || sectorLower.includes('insurance') ||
      sectorLower.includes('lending') || sectorLower.includes('payment')) {
    return 'Banking & Finance';
  }
  
  // Healthcare & Pharma
  if (sectorLower.includes('health') || sectorLower.includes('pharma') || 
      sectorLower.includes('medical') || sectorLower.includes('hospital') ||
      sectorLower.includes('biotech') || sectorLower.includes('diagnostic')) {
    return 'Healthcare & Pharma';
  }
  
  // Consumer Goods & Retail
  if (sectorLower.includes('consumer') || sectorLower.includes('retail') || 
      sectorLower.includes('fmcg') || sectorLower.includes('food') ||
      sectorLower.includes('beverage') || sectorLower.includes('ecommerce') ||
      sectorLower.includes('e-commerce') || sectorLower.includes('d2c')) {
    return 'Consumer Goods & Retail';
  }
  
  // Manufacturing
  if (sectorLower.includes('manufactur') || sectorLower.includes('auto') ||
      sectorLower.includes('industrial') || sectorLower.includes('engineering') ||
      sectorLower.includes('machinery') || sectorLower.includes('electronics')) {
    return 'Manufacturing';
  }
  
  // Infrastructure & Construction
  if (sectorLower.includes('infra') || sectorLower.includes('construct') ||
      sectorLower.includes('road') || sectorLower.includes('cement') ||
      sectorLower.includes('logistics') || sectorLower.includes('transport')) {
    return 'Infrastructure & Construction';
  }
  
  // Energy & Utilities
  if (sectorLower.includes('energy') || sectorLower.includes('power') ||
      sectorLower.includes('electric') || sectorLower.includes('solar') ||
      sectorLower.includes('renewable') || sectorLower.includes('oil') ||
      sectorLower.includes('gas') || sectorLower.includes('ev')) {
    return 'Energy & Utilities';
  }
  
  // Real Estate
  if (sectorLower.includes('real estate') || sectorLower.includes('property') ||
      sectorLower.includes('housing') || sectorLower.includes('realty')) {
    return 'Real Estate';
  }
  
  // Metals & Mining
  if (sectorLower.includes('metal') || sectorLower.includes('mining') ||
      sectorLower.includes('steel') || sectorLower.includes('alumin')) {
    return 'Metals & Mining';
  }
  
  // Chemicals
  if (sectorLower.includes('chemical') || sectorLower.includes('specialty')) {
    return 'Chemicals';
  }
  
  // Services
  if (sectorLower.includes('service') || sectorLower.includes('consult') ||
      sectorLower.includes('bpo') || sectorLower.includes('staffing') ||
      sectorLower.includes('hr') || sectorLower.includes('media') ||
      sectorLower.includes('entertainment') || sectorLower.includes('travel')) {
    return 'Services';
  }
  
  return 'Others';
}

// Fetch unlisted stocks by broad sector
export async function getUnlistedStocksBySector(
  broadSector: string,
  limit: number = 10
): Promise<UnlistedStockRecommendation[]> {
  try {
    const companies = await db
      .select({
        id: preIpoCompanies.id,
        name: preIpoCompanies.companyName,
        sector: preIpoCompanies.sector,
        broadSector: preIpoCompanies.broadSector,
        industry: preIpoCompanies.industry,
        currentValuation: preIpoCompanies.currentValuation,
        expectedReturns: preIpoCompanies.expectedReturns,
        riskRating: preIpoCompanies.riskRating,
        investmentTier: preIpoCompanies.investmentTier,
        minimumInvestment: preIpoCompanies.minimumInvestment,
        ipoStatus: preIpoCompanies.ipoStatus,
        expectedIpoDate: preIpoCompanies.expectedIpoDate,
      })
      .from(preIpoCompanies)
      .where(
        and(
          eq(preIpoCompanies.broadSector, broadSector),
          eq(preIpoCompanies.isAvailableForInvestment, true)
        )
      )
      .orderBy(desc(preIpoCompanies.currentValuation))
      .limit(limit);
    
    return companies.map(company => ({
      id: company.id,
      name: company.name,
      sector: company.sector || 'General',
      broadSector: company.broadSector || 'Others',
      industry: company.industry || 'General',
      currentValuation: company.currentValuation?.toString(),
      expectedReturns: company.expectedReturns?.toString(),
      riskRating: company.riskRating || 'high',
      investmentTier: company.investmentTier,
      minimumInvestment: company.minimumInvestment?.toString(),
      ipoStatus: company.ipoStatus,
      expectedIpoDate: company.expectedIpoDate?.toISOString(),
      riskLevel: determineUnlistedRiskLevel(company.riskRating, company.investmentTier),
      requiresEnhancedKyc: true, // All unlisted stocks require Enhanced KYC
    }));
  } catch (error) {
    console.error(`[UnlistedStocks] Error fetching companies for sector ${broadSector}:`, error);
    return [];
  }
}

function determineUnlistedRiskLevel(riskRating?: string | null, investmentTier?: string | null): string {
  // Unlisted stocks are inherently higher risk due to liquidity constraints
  if (riskRating === 'very_high') return 'Very High';
  if (riskRating === 'high') return 'High';
  if (riskRating === 'medium') return 'Moderately High';
  if (riskRating === 'low') return 'Moderate';
  
  // Fall back to investment tier
  if (investmentTier === 'tier_1') return 'Moderate';
  if (investmentTier === 'tier_2') return 'Moderately High';
  if (investmentTier === 'tier_3') return 'High';
  
  return 'High'; // Default for unlisted stocks
}

// Get available broad sectors for unlisted stocks with counts
export async function getAvailableUnlistedSectors(): Promise<{ sector: string; count: number }[]> {
  try {
    const sectors = await db
      .select({
        sector: preIpoCompanies.broadSector,
        count: sql<number>`count(*)::int`,
      })
      .from(preIpoCompanies)
      .where(
        and(
          eq(preIpoCompanies.isAvailableForInvestment, true),
          isNotNull(preIpoCompanies.broadSector)
        )
      )
      .groupBy(preIpoCompanies.broadSector)
      .orderBy(desc(sql`count(*)`));
    
    return sectors.map(s => ({
      sector: s.sector || 'Others',
      count: s.count,
    }));
  } catch (error) {
    console.error('[UnlistedStocks] Error fetching available sectors:', error);
    return [];
  }
}

// Get unlisted stock recommendations for a risk profile
export async function getUnlistedStockRecommendations(
  riskProfile: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive',
  preferredSectors?: string[],
  limit: number = 5
): Promise<UnlistedStockRecommendation[]> {
  try {
    // Unlisted stocks are only recommended for aggressive/very_aggressive profiles
    // Conservative and moderate get empty results with a note
    if (riskProfile === 'conservative') {
      console.log('[UnlistedStocks] Conservative profile - unlisted stocks not recommended');
      return [];
    }
    
    // Default sectors by risk profile for unlisted stocks
    const defaultSectorsByRisk = {
      conservative: [], // Not recommended
      moderate: ['Technology', 'Healthcare & Pharma'], // Limited exposure
      aggressive: ['Technology', 'Healthcare & Pharma', 'Consumer Goods & Retail', 'Banking & Finance'],
      very_aggressive: ['Technology', 'Healthcare & Pharma', 'Consumer Goods & Retail', 'Energy & Utilities', 'Real Estate'],
    };
    
    const sectors = preferredSectors && preferredSectors.length > 0 
      ? preferredSectors 
      : defaultSectorsByRisk[riskProfile];
    
    if (sectors.length === 0) return [];
    
    // Fetch companies from each sector
    const companyPromises = sectors.map(sector => 
      getUnlistedStocksBySector(sector, Math.ceil(limit / sectors.length))
    );
    
    const companyArrays = await Promise.all(companyPromises);
    const allCompanies = companyArrays.flat();
    
    // Sort by investment tier and expected returns
    return allCompanies
      .sort((a, b) => {
        const tierOrder: Record<string, number> = { 'tier_1': 3, 'tier_2': 2, 'tier_3': 1 };
        return (tierOrder[b.investmentTier || ''] || 0) - (tierOrder[a.investmentTier || ''] || 0);
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[UnlistedStocks] Error fetching recommendations:', error);
    return [];
  }
}

// Populate broad_sector for all unlisted stocks based on existing sector data
export async function populateUnlistedBroadSectors(): Promise<{ updated: number; errors: number }> {
  console.log('[UnlistedStocks] Populating broad sectors...');
  
  const companiesWithoutBroadSector = await db
    .select({ id: preIpoCompanies.id, sector: preIpoCompanies.sector })
    .from(preIpoCompanies)
    .where(
      and(
        sql`${preIpoCompanies.broadSector} IS NULL`,
        sql`${preIpoCompanies.sector} IS NOT NULL`
      )
    );

  let updated = 0;
  let errors = 0;

  for (const company of companiesWithoutBroadSector) {
    try {
      const broadSector = mapUnlistedToBroadSector(company.sector);
      
      await db
        .update(preIpoCompanies)
        .set({ 
          broadSector,
          enrichmentStatus: 'partial'
        })
        .where(eq(preIpoCompanies.id, company.id));
      
      updated++;
    } catch (error) {
      errors++;
      console.error(`[UnlistedStocks] Error updating broad sector for ${company.id}:`, error);
    }
  }

  console.log(`[UnlistedStocks] Broad sector population complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}

// Target allocations by risk profile (expanded with global regions - stocks excluded by default, only in very_aggressive)
const TARGET_ALLOCATIONS = {
  conservative: { equity: 20, debt: 35, hybrid: 15, gold: 10, silver: 0, index: 5, international: 0, us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
  moderate: { equity: 25, debt: 20, hybrid: 10, gold: 5, silver: 0, index: 8, international: 0, us_markets: 5, europe_markets: 2, asia_pacific_markets: 3, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
  aggressive: { equity: 30, debt: 10, hybrid: 5, gold: 3, silver: 2, index: 10, international: 0, us_markets: 8, europe_markets: 4, asia_pacific_markets: 5, emerging_markets: 3, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
  very_aggressive: { equity: 25, debt: 5, hybrid: 5, gold: 2, silver: 3, index: 10, international: 0, us_markets: 10, europe_markets: 5, asia_pacific_markets: 7, emerging_markets: 6, reit: 5, invit: 3, bonds: 2, mld: 0, listed_stocks: 7, unlisted_stocks: 5, pms: 0, aif: 0 }
};

export interface ProspectPortfolioHoldingLot {
  purchaseDate: string;
  transactionType: string;
  units: number;
  nav: number;
  amount: number;
  stampDuty?: number;
  stt?: number;
  grandfatheredValue?: number;
  isGrandfathered?: boolean;
}

export interface ProspectPortfolioHolding {
  // Frontend format (deprecated, for backward compatibility)
  productType?: string;
  productName?: string;
  // Backend format (canonical)
  name?: string;
  assetType?: string;
  // Shared fields
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  averageCost?: number;
  currentNav?: number;
  investedValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  isin?: string;
  symbol?: string;
  folioNumber?: string;
  broker?: string;
  confidenceScore?: number;
  category?: string;
  id?: string;
  addedAt?: string;
  source?: string;
  // Lot-level data for capital gains tracking
  firstPurchaseDate?: string;
  lots?: ProspectPortfolioHoldingLot[];
  holdingTier?: string;
  eligibleForTax?: boolean;
  amc?: string;
}

export interface ProspectRiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short_term' | 'medium_term' | 'long_term';
  primaryGoal: string;
  monthlyIncome?: number;
  existingInvestments?: number;
  liquidityNeeds?: 'low' | 'medium' | 'high';
}

export interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: {
    type: 'warning' | 'suggestion' | 'opportunity';
    message: string;
    action?: string;
  }[];
  topPerformers: ProspectPortfolioHolding[];
  underperformers: ProspectPortfolioHolding[];
}

export interface RebalanceRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' | 'REDUCE' | 'INCREASE' | 'HOLD_COST_FILTER' | 'HOLD_RISK_LIMIT';
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string;
}

export interface FreshInvestmentSuggestion {
  productType: string;
  productName: string;
  productId?: string;
  suggestedAmount: number;
  expectedReturn: string;
  riskLevel: string;
  matchScore: number;
  rationale: string;
  highlights: string[];
}

// Server-side asset type mapping (mirrors frontend mapToAssetType)
function serverMapToAssetType(productType: string): string {
  const assetTypeMap: Record<string, string> = {
    'mutual_fund': 'mutual_fund',
    'equity': 'equity',
    'etf': 'etf',
    'bond': 'bond',
    'fd': 'fd',
    'gold': 'gold',
    'pms': 'other',
    'aif': 'other',
    'insurance': 'other',
    'other': 'other'
  };
  return assetTypeMap[productType] || 'other';
}

// Normalize a holding to canonical format: {name, assetType, productType, ...}
// This ensures consistent field naming regardless of whether data comes from
// frontend (productName/productType) or backend (name/assetType)
function normalizeHolding(raw: any): ProspectPortfolioHolding {
  const name = raw.name || raw.productName || 'Unknown';
  const productType = raw.productType || raw.assetType || 'other';
  const assetType = raw.assetType || serverMapToAssetType(productType);
  
  // Derive purchase date from lots if not explicitly set
  // Priority: purchaseDate > firstPurchaseDate > earliest lot date
  let purchaseDate = raw.purchaseDate;
  if (!purchaseDate && raw.firstPurchaseDate) {
    purchaseDate = raw.firstPurchaseDate;
  }
  if (!purchaseDate && raw.lots && raw.lots.length > 0) {
    // Find earliest lot date
    const lotDates = raw.lots
      .map((lot: any) => {
        const dateStr = lot.transactionDateStr || lot.purchaseDate || lot.transactionDate;
        if (!dateStr) return null;
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return isNaN(d.getTime()) ? null : d.getTime();
      })
      .filter((t: number | null) => t !== null) as number[];
    if (lotDates.length > 0) {
      const earliestTimestamp = Math.min(...lotDates);
      purchaseDate = new Date(earliestTimestamp).toISOString().split('T')[0];
    }
  }
  
  return {
    name,
    productName: name, // Also set productName for frontend compatibility
    assetType,
    productType,
    quantity: raw.quantity ?? 1,
    currentValue: raw.currentValue ?? 0,
    purchasePrice: raw.purchasePrice,
    purchaseDate,
    averageCost: raw.averageCost,
    currentNav: raw.currentNav,
    investedValue: raw.investedValue,
    unrealizedGain: raw.unrealizedGain,
    unrealizedGainPercent: raw.unrealizedGainPercent,
    isin: raw.isin,
    symbol: raw.symbol,
    folioNumber: raw.folioNumber,
    broker: raw.broker,
    confidenceScore: raw.confidenceScore,
    category: raw.category,
    id: raw.id,
    addedAt: raw.addedAt,
    source: raw.source,
    // Lot-level data for capital gains tracking (CRITICAL: preserve from CAS parsing)
    firstPurchaseDate: raw.firstPurchaseDate,
    lots: raw.lots,
    holdingTier: raw.holdingTier,
    eligibleForTax: raw.eligibleForTax,
    amc: raw.amc
  };
}

// Normalize an array of holdings
function normalizeHoldings(holdings: any[]): ProspectPortfolioHolding[] {
  return (holdings || []).map(normalizeHolding);
}

export interface PortfolioMetrics {
  totalValue: number;
  expectedReturn: number;
  volatility: number | null;
  beta: number | null;
  alpha: number | null;
  sharpeRatio: number | null;
  treynorRatio: number | null;
  sortinoRatio: number | null;
  informationRatio: number | null;
  maxDrawdown: number | null;
  diversificationScore: number;
  riskScore: number;
  assetAllocation: {
    equity: number;
    debt: number;
    hybrid: number;
    gold: number;
    silver: number;
    others: number;
  };
}

export interface PortfolioComparison {
  currentPortfolio: PortfolioMetrics;
  proposedPortfolio: PortfolioMetrics;
  improvements: {
    metric: string;
    current: number | null;
    proposed: number | null;
    change: number | null;
    interpretation: string;
    isImprovement: boolean;
  }[];
}

export interface CombinedProposal {
  prospectId: string;
  proposalId: string;
  shareToken: string;
  analysis: PortfolioAnalysis;
  rebalancing: RebalanceRecommendation[];
  freshInvestments: FreshInvestmentSuggestion[];
  totalSellAmount: number;
  totalBuyAmount: number;
  netInvestmentRequired: number;
  projectedValue: number;
  projectedReturn: string;
  executiveSummary: string;
  portfolioComparison?: PortfolioComparison;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'existing_client' | 'existing_prospect';
  existingRecord?: {
    id: string;
    name?: string | null;
    email?: string | null;
    mobile?: string | null;
    pan?: string | null;
    currentAgentId?: string | null;
    currentAgentName?: string | null;
  };
  message?: string;
  canRequestMapping?: boolean;
}

class AgentProspectWizardService {
  // Check for existing client in users table by PAN, email, or mobile
  async checkForExistingClient(pan?: string, email?: string, mobile?: string): Promise<DuplicateCheckResult> {
    if (!pan && !email && !mobile) {
      return { isDuplicate: false };
    }

    // Build conditions for matching
    const conditions = [];
    if (pan) conditions.push(eq(users.panNumber, pan.toUpperCase()));
    if (email) conditions.push(eq(users.email, email.toLowerCase()));
    if (mobile) {
      // Normalize mobile (remove spaces, +91, etc.)
      const normalizedMobile = mobile.replace(/[\s\-+]/g, '').replace(/^91/, '');
      conditions.push(eq(users.mobile, normalizedMobile));
      conditions.push(eq(users.mobile, `+91${normalizedMobile}`));
      conditions.push(eq(users.mobile, mobile));
    }

    if (conditions.length === 0) {
      return { isDuplicate: false };
    }

    // Check users table for existing client
    const [existingUser] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      mobile: users.mobile,
      panNumber: users.panNumber,
      agentId: users.agentId,
    })
    .from(users)
    .where(or(...conditions))
    .limit(1);

    if (existingUser) {
      // Get current agent name if assigned
      let currentAgentName = null;
      if (existingUser.agentId) {
        const [agent] = await db.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, existingUser.agentId))
          .limit(1);
        if (agent) {
          currentAgentName = [agent.firstName, agent.lastName].filter(Boolean).join(' ');
        }
      }

      return {
        isDuplicate: true,
        duplicateType: 'existing_client',
        existingRecord: {
          id: existingUser.id,
          name: [existingUser.firstName, existingUser.lastName].filter(Boolean).join(' ') || null,
          email: existingUser.email,
          mobile: existingUser.mobile,
          pan: existingUser.panNumber,
          currentAgentId: existingUser.agentId,
          currentAgentName
        },
        message: existingUser.agentId 
          ? 'This person is already a client assigned to another agent. You can request admin approval to map them to your portfolio.'
          : 'This person is already registered as a client. You can request admin approval to become their assigned agent.',
        canRequestMapping: true
      };
    }

    return { isDuplicate: false };
  }

  // Check for existing prospect under this agent
  async checkForExistingProspect(agentId: string, pan?: string, email?: string, mobile?: string): Promise<DuplicateCheckResult> {
    if (!pan && !email && !mobile) {
      return { isDuplicate: false };
    }

    const conditions = [];
    if (pan) conditions.push(eq(prospectClients.pan, pan.toUpperCase()));
    if (email) conditions.push(eq(prospectClients.email, email.toLowerCase()));
    if (mobile) {
      const normalizedMobile = mobile.replace(/[\s\-+]/g, '').replace(/^91/, '');
      conditions.push(eq(prospectClients.mobile, normalizedMobile));
      conditions.push(eq(prospectClients.mobile, `+91${normalizedMobile}`));
      conditions.push(eq(prospectClients.mobile, mobile));
    }

    if (conditions.length === 0) {
      return { isDuplicate: false };
    }

    const [existingProspect] = await db.select()
      .from(prospectClients)
      .where(and(eq(prospectClients.agentId, agentId), or(...conditions)))
      .limit(1);

    if (existingProspect) {
      return {
        isDuplicate: true,
        duplicateType: 'existing_prospect',
        existingRecord: {
          id: existingProspect.id,
          name: existingProspect.name,
          email: existingProspect.email,
          mobile: existingProspect.mobile,
          pan: existingProspect.pan
        },
        message: 'You already have this person as a prospect. Please use the existing record.',
        canRequestMapping: false
      };
    }

    return { isDuplicate: false };
  }

  // Request mapping approval from admin
  async requestClientMapping(agentId: string, agentName: string, clientData: {
    clientId?: string;
    pan?: string;
    email?: string;
    mobile?: string;
    name?: string;
    currentAgentId?: string;
    currentAgentName?: string;
    reason?: string;
  }): Promise<{ requestId: string; message: string }> {
    const [request] = await db.insert(agentClientMappingRequests).values({
      agentId,
      agentName,
      clientId: clientData.clientId,
      clientPan: clientData.pan?.toUpperCase(),
      clientEmail: clientData.email?.toLowerCase(),
      clientMobile: clientData.mobile,
      clientName: clientData.name,
      currentAgentId: clientData.currentAgentId,
      currentAgentName: clientData.currentAgentName,
      requestReason: clientData.reason || 'Agent requested client mapping',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({ id: agentClientMappingRequests.id });

    return {
      requestId: request.id,
      message: 'Your request has been submitted to admin for approval. You will be notified once it is processed.'
    };
  }

  // Get pending mapping requests for admin
  async getPendingMappingRequests() {
    return db.select()
      .from(agentClientMappingRequests)
      .where(eq(agentClientMappingRequests.status, 'pending'))
      .orderBy(desc(agentClientMappingRequests.createdAt));
  }

  // Admin approve/reject mapping request
  async processMappingRequest(requestId: string, action: 'approve' | 'reject', adminId: string, rejectionReason?: string) {
    const [request] = await db.select()
      .from(agentClientMappingRequests)
      .where(eq(agentClientMappingRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error('Mapping request not found');
    }

    if (action === 'approve' && request.clientId) {
      // Update client's assigned agent in users table
      await db.update(users)
        .set({ agentId: request.agentId })
        .where(eq(users.id, request.clientId));
    }

    await db.update(agentClientMappingRequests)
      .set({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: action === 'reject' ? rejectionReason : null,
        updatedAt: new Date()
      })
      .where(eq(agentClientMappingRequests.id, requestId));

    return { success: true, message: `Request ${action}d successfully` };
  }

  async createProspect(agentId: string, data: Omit<InsertProspectClient, 'agentId'>): Promise<string | DuplicateCheckResult> {
    // Step 1: Check for existing client in the system
    const clientCheck = await this.checkForExistingClient(data.pan || undefined, data.email || undefined, data.mobile || undefined);
    if (clientCheck.isDuplicate) {
      return clientCheck;
    }

    // Step 2: Check for duplicate prospect under this agent
    const prospectCheck = await this.checkForExistingProspect(agentId, data.pan || undefined, data.email || undefined, data.mobile || undefined);
    if (prospectCheck.isDuplicate) {
      return prospectCheck;
    }

    // Step 3: Create the prospect
    const [prospect] = await db.insert(prospectClients).values({
      ...data,
      pan: data.pan?.toUpperCase(),
      email: data.email?.toLowerCase(),
      agentId,
      state: 'prospect',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({ id: prospectClients.id });
    
    return prospect.id;
  }

  async getProspect(prospectId: string) {
    const [prospect] = await db.select()
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);
    return prospect;
  }

  async getAgentProspects(agentId: string) {
    return db.select()
      .from(prospectClients)
      .where(eq(prospectClients.agentId, agentId))
      .orderBy(desc(prospectClients.createdAt));
  }

  async updateProspectPortfolio(prospectId: string, holdings: ProspectPortfolioHolding[]) {
    // Normalize holdings before persisting to ensure consistent storage format
    const normalizedHoldings = normalizeHoldings(holdings);
    
    await db.update(prospectClients)
      .set({ 
        currentPortfolio: normalizedHoldings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    // Advance readiness status
    await prospectReadinessService.advanceOnHoldingsImport(prospectId);
  }

  async updateProspectRiskProfile(prospectId: string, riskProfile: ProspectRiskProfile) {
    await db.update(prospectClients)
      .set({ 
        indicativeRiskProfile: riskProfile.riskTolerance,
        investmentHorizon: riskProfile.investmentHorizon,
        investmentGoals: riskProfile.primaryGoal,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    // Advance readiness status
    await prospectReadinessService.advanceOnRiskProfileComplete(prospectId);
  }

  async updateProspectTaxProfile(prospectId: string, taxProfile: {
    taxSlabCategory: string;
    residencyStatus: string;
    hasHuf: boolean;
    hasOtherIncome: boolean;
  }) {
    await db.update(prospectClients)
      .set({ 
        taxProfile: {
          ...taxProfile,
          completedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    // Advance readiness status
    await prospectReadinessService.advanceOnTaxProfileComplete(prospectId);
    
    // Evaluate if prospect is now ready for proposal
    return prospectReadinessService.evaluateAndAdvanceToReady(prospectId);
  }

  analyzePortfolio(holdings: ProspectPortfolioHolding[], riskProfile: ProspectRiskProfile): PortfolioAnalysis {
    // Normalize holdings to canonical format at entry point
    const normalizedHoldings = normalizeHoldings(holdings);
    
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    
    const assetAllocation: Record<string, { value: number; percentage: number }> = {};
    normalizedHoldings.forEach(h => {
      // Use productType for categorization (preserved original type for PMS/AIF/insurance)
      const categoryKey = h.productType || h.assetType || 'other';
      if (!assetAllocation[categoryKey]) {
        assetAllocation[categoryKey] = { value: 0, percentage: 0 };
      }
      assetAllocation[categoryKey].value += h.currentValue;
    });
    Object.keys(assetAllocation).forEach(key => {
      assetAllocation[key].percentage = totalValue > 0 
        ? Math.round((assetAllocation[key].value / totalValue) * 100) 
        : 0;
    });

    const numAssetClasses = Object.keys(assetAllocation).length;
    const diversificationScore = Math.min(100, numAssetClasses * 15 + 25);
    
    let riskScore = 50;
    const equityWeight = (assetAllocation['equity']?.percentage || 0) + 
                        (assetAllocation['mutual_fund']?.percentage || 0) * 0.6;
    riskScore = Math.min(100, Math.max(0, 30 + equityWeight));

    const recommendations: PortfolioAnalysis['recommendations'] = [];
    
    if (numAssetClasses < 3) {
      recommendations.push({
        type: 'warning',
        message: 'Portfolio is under-diversified. Consider adding more asset classes.',
        action: 'Diversify'
      });
    }
    
    if (equityWeight > 80 && riskProfile.riskTolerance === 'conservative') {
      recommendations.push({
        type: 'warning',
        message: 'Equity exposure is too high for your risk profile.',
        action: 'Reduce equity allocation'
      });
    }
    
    if (!assetAllocation['bond'] && !assetAllocation['fd']) {
      recommendations.push({
        type: 'suggestion',
        message: 'Consider adding fixed-income instruments for stability.',
        action: 'Add bonds/FDs'
      });
    }

    const sortedByValue = [...normalizedHoldings].sort((a, b) => b.currentValue - a.currentValue);
    
    return {
      totalValue,
      assetAllocation,
      riskScore,
      diversificationScore,
      recommendations,
      topPerformers: sortedByValue.slice(0, 3),
      underperformers: sortedByValue.slice(-3).reverse()
    };
  }

  // Risk-adjusted metrics calculation methods
  private calculateVolatility(holdings: ProspectPortfolioHolding[]): number | null {
    if (holdings.length === 0) return null;
    // Estimate volatility based on asset allocation
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    let weightedVolatility = 0;
    
    holdings.forEach(h => {
      const weight = h.currentValue / totalValue;
      // Support both frontend (productType) and backend (assetType) formats with fallbacks
      const category = (h.category || h.productType || h.assetType || '').toLowerCase();
      const productType = (h.productType || h.assetType || '').toLowerCase();
      // Asset class volatility estimates (annualized)
      let assetVolatility = 15; // default
      // Check for PMS/AIF first (high volatility asset classes)
      if (productType === 'pms' || productType === 'aif') assetVolatility = 25;
      else if (category.includes('small') || category.includes('micro')) assetVolatility = 28;
      else if (category.includes('mid')) assetVolatility = 22;
      else if (category.includes('large') || category.includes('blue')) assetVolatility = 16;
      else if (category.includes('debt') || category.includes('bond')) assetVolatility = 5;
      else if (category.includes('gold') || category.includes('silver')) assetVolatility = 18;
      else if (category.includes('hybrid')) assetVolatility = 12;
      else if (category.includes('liquid') || category.includes('money')) assetVolatility = 2;
      else if (productType === 'insurance') assetVolatility = 8; // Insurance products typically lower volatility
      
      weightedVolatility += weight * assetVolatility;
    });
    
    return weightedVolatility;
  }

  private calculateBeta(holdings: ProspectPortfolioHolding[]): number | null {
    if (holdings.length === 0) return null;
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    let weightedBeta = 0;
    
    holdings.forEach(h => {
      const weight = h.currentValue / totalValue;
      // Support both frontend (productType) and backend (assetType) formats with fallbacks
      const category = (h.category || h.productType || h.assetType || '').toLowerCase();
      const productType = (h.productType || h.assetType || '').toLowerCase();
      // Asset class beta estimates
      let assetBeta = 1.0;
      // Check for PMS/AIF first
      if (productType === 'pms' || productType === 'aif') assetBeta = 1.2;
      else if (category.includes('small')) assetBeta = 1.3;
      else if (category.includes('mid')) assetBeta = 1.15;
      else if (category.includes('large')) assetBeta = 0.95;
      else if (category.includes('debt') || category.includes('bond')) assetBeta = 0.15;
      else if (category.includes('gold')) assetBeta = 0.0; // Gold has near-zero correlation
      else if (category.includes('silver')) assetBeta = 0.1;
      else if (category.includes('hybrid')) assetBeta = 0.65;
      else if (category.includes('index')) assetBeta = 1.0;
      else if (productType === 'insurance') assetBeta = 0.3; // Insurance products lower correlation
      
      weightedBeta += weight * assetBeta;
    });
    
    return weightedBeta;
  }

  private calculateAlpha(portfolioReturn: number, beta: number | null, marketReturn: number = 12): number | null {
    if (beta === null) return null;
    const riskFreeRate = 6; // India 10Y G-Sec benchmark
    const expectedReturn = riskFreeRate + beta * (marketReturn - riskFreeRate);
    return portfolioReturn - expectedReturn;
  }

  private calculateSharpeRatio(returns: number, volatility: number | null): number | null {
    if (!volatility || volatility === 0) return null;
    const riskFreeRate = 6;
    return (returns - riskFreeRate) / volatility;
  }

  private calculateTreynorRatio(portfolioReturn: number, beta: number | null): number | null {
    if (beta === null || beta === 0) return null;
    const riskFreeRate = 6;
    return (portfolioReturn - riskFreeRate) / beta;
  }

  private calculateSortinoRatio(portfolioReturn: number, holdings: ProspectPortfolioHolding[]): number | null {
    // Estimate downside deviation from volatility and asset mix
    const volatility = this.calculateVolatility(holdings);
    if (!volatility) return null;
    
    // Downside deviation is typically 60-80% of total volatility for diversified portfolios
    const downsideDeviation = volatility * 0.7;
    if (downsideDeviation === 0) return null;
    
    const targetReturn = 6;
    return (portfolioReturn - targetReturn) / downsideDeviation;
  }

  private calculateInformationRatio(portfolioReturn: number, benchmarkReturn: number = 12, beta: number | null): number | null {
    if (beta === null) return null;
    // Tracking error approximation
    const marketVolatility = 15;
    const trackingError = Math.abs(1 - beta) * marketVolatility + 2;
    if (trackingError === 0) return null;
    return (portfolioReturn - benchmarkReturn) / trackingError;
  }

  private calculateMaxDrawdown(beta: number | null, volatility: number | null): number | null {
    if (beta === null || volatility === null) return null;
    // Estimated max drawdown: volatility * beta * 2 (rule of thumb)
    return Math.min(volatility * Math.max(beta, 0.5) * 2, 50);
  }

  private calculateAssetAllocationBreakdown(holdings: ProspectPortfolioHolding[]): PortfolioMetrics['assetAllocation'] {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const allocation = { equity: 0, debt: 0, hybrid: 0, gold: 0, silver: 0, others: 0 };
    
    if (totalValue === 0) return allocation;
    
    holdings.forEach(h => {
      const weight = (h.currentValue / totalValue) * 100;
      // Support both frontend (productType) and backend (assetType) formats with fallbacks
      const category = (h.category || h.productType || h.assetType || '').toLowerCase();
      const productType = (h.productType || h.assetType || '').toLowerCase();
      
      // Check for special product types first (PMS/AIF/insurance) that need specific categorization
      if (productType === 'pms' || productType === 'aif') {
        allocation.equity += weight; // PMS/AIF typically equity-like for allocation purposes
      } else if (productType === 'insurance') {
        allocation.others += weight; // Insurance products counted as others
      } else if (category.includes('equity') || category.includes('small') || category.includes('mid') || 
          category.includes('large') || category.includes('flexi') || category.includes('multi')) {
        allocation.equity += weight;
      } else if (category.includes('debt') || category.includes('bond') || category.includes('liquid') || 
                 category.includes('money') || category.includes('corporate') || category.includes('gilt')) {
        allocation.debt += weight;
      } else if (category.includes('hybrid') || category.includes('balanced') || category.includes('multi-asset')) {
        allocation.hybrid += weight;
      } else if (category.includes('gold')) {
        allocation.gold += weight;
      } else if (category.includes('silver')) {
        allocation.silver += weight;
      } else {
        allocation.others += weight;
      }
    });
    
    return allocation;
  }

  calculatePortfolioMetrics(holdings: ProspectPortfolioHolding[], expectedReturn: number): PortfolioMetrics {
    // Normalize holdings to canonical format at entry point
    const normalizedHoldings = normalizeHoldings(holdings);
    
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const volatility = this.calculateVolatility(normalizedHoldings);
    const beta = this.calculateBeta(normalizedHoldings);
    const alpha = this.calculateAlpha(expectedReturn, beta);
    const sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility);
    const treynorRatio = this.calculateTreynorRatio(expectedReturn, beta);
    const sortinoRatio = this.calculateSortinoRatio(expectedReturn, normalizedHoldings);
    const informationRatio = this.calculateInformationRatio(expectedReturn, 12, beta);
    const maxDrawdown = this.calculateMaxDrawdown(beta, volatility);
    const assetAllocation = this.calculateAssetAllocationBreakdown(normalizedHoldings);
    
    const numAssetClasses = Object.values(assetAllocation).filter(v => v > 5).length;
    const diversificationScore = Math.min(100, numAssetClasses * 15 + normalizedHoldings.length * 3 + 20);
    
    const equityWeight = assetAllocation.equity + assetAllocation.hybrid * 0.6;
    const riskScore = Math.min(100, Math.max(0, 30 + equityWeight * 0.7));
    
    return {
      totalValue,
      expectedReturn,
      volatility,
      beta,
      alpha,
      sharpeRatio,
      treynorRatio,
      sortinoRatio,
      informationRatio,
      maxDrawdown,
      diversificationScore,
      riskScore,
      assetAllocation
    };
  }

  calculateProposedPortfolioMetrics(
    freshInvestments: FreshInvestmentSuggestion[], 
    riskProfile: ProspectRiskProfile
  ): PortfolioMetrics {
    // Convert fresh investments to pseudo-holdings for metric calculation
    const pseudoHoldings: ProspectPortfolioHolding[] = freshInvestments.map(inv => ({
      productType: inv.productType,
      productName: inv.productName,
      quantity: 1,
      currentValue: inv.suggestedAmount,
      category: (inv as any).category || inv.productType
    }));
    
    // Calculate weighted expected return
    const totalAmount = freshInvestments.reduce((sum, inv) => sum + inv.suggestedAmount, 0);
    let weightedReturn = 0;
    freshInvestments.forEach(inv => {
      const returnVal = parseFloat(inv.expectedReturn.replace('%', '')) || 12;
      weightedReturn += (inv.suggestedAmount / totalAmount) * returnVal;
    });
    
    return this.calculatePortfolioMetrics(pseudoHoldings, weightedReturn);
  }

  /**
   * Calculate portfolio metrics using real historical data when available
   * Falls back to estimation formulas when historical data is not available
   */
  async calculatePortfolioMetricsWithRealData(
    holdings: ProspectPortfolioHolding[],
    expectedReturn: number
  ): Promise<PortfolioMetrics & { dataSource: 'historical' | 'estimated' }> {
    const normalizedHoldings = normalizeHoldings(holdings);
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    
    if (totalValue === 0) {
      return {
        ...this.calculatePortfolioMetrics(normalizedHoldings, expectedReturn),
        dataSource: 'estimated'
      };
    }
    
    // Attempt to get real metrics for each holding with an ISIN or scheme code
    let realVolatility = 0;
    let realMaxDrawdown = 0;
    let weightedCagr = 0;
    let totalRealWeight = 0;
    let realDataCount = 0;
    
    const metricsPromises = normalizedHoldings.map(async (holding) => {
      const weight = holding.currentValue / totalValue;
      
      // Try to identify scheme code from ISIN or name
      const schemeCode = this.extractSchemeCode(holding);
      
      if (schemeCode) {
        try {
          const metrics = await historicalNavService.calculateMetrics(schemeCode, 'mutual_fund', 5);
          
          if (metrics.calculatedFromRealData && metrics.volatility !== null) {
            return {
              weight,
              volatility: metrics.volatility,
              maxDrawdown: metrics.maxDrawdown || 0,
              cagr: metrics.cagr || 0,
              sharpeRatio: metrics.sharpeRatio,
              sortinoRatio: metrics.sortinoRatio,
              hasRealData: true
            };
          }
        } catch (error) {
          // Fall through to estimation
        }
      }
      
      // Fallback to estimation
      const category = (holding.category || holding.productType || '').toLowerCase();
      let estVolatility = 15;
      let estMaxDrawdown = 20;
      
      if (category.includes('small')) { estVolatility = 25; estMaxDrawdown = 40; }
      else if (category.includes('mid')) { estVolatility = 20; estMaxDrawdown = 35; }
      else if (category.includes('large') || category.includes('equity')) { estVolatility = 15; estMaxDrawdown = 25; }
      else if (category.includes('debt') || category.includes('bond')) { estVolatility = 5; estMaxDrawdown = 5; }
      else if (category.includes('hybrid')) { estVolatility = 12; estMaxDrawdown = 18; }
      
      return {
        weight,
        volatility: estVolatility / 100,
        maxDrawdown: estMaxDrawdown / 100,
        cagr: expectedReturn / 100,
        sharpeRatio: null,
        sortinoRatio: null,
        hasRealData: false
      };
    });
    
    const holdingMetrics = await Promise.all(metricsPromises);
    
    // Aggregate metrics using portfolio weights
    holdingMetrics.forEach(m => {
      realVolatility += m.weight * (m.volatility || 0);
      realMaxDrawdown = Math.max(realMaxDrawdown, m.maxDrawdown || 0);
      weightedCagr += m.weight * (m.cagr || 0);
      if (m.hasRealData) realDataCount++;
    });
    
    const useRealData = realDataCount > 0;
    const dataSource = useRealData && realDataCount >= normalizedHoldings.length / 2 ? 'historical' : 'estimated';
    
    // If we have real data, use it; otherwise fall back to estimation
    const baseMetrics = this.calculatePortfolioMetrics(normalizedHoldings, expectedReturn);
    
    if (useRealData) {
      // Override with real data where available
      const riskFreeRate = 0.065;
      const effectiveReturn = weightedCagr || (expectedReturn / 100);
      const effectiveSharpe = realVolatility > 0 ? (effectiveReturn - riskFreeRate) / realVolatility : null;
      
      return {
        ...baseMetrics,
        volatility: realVolatility * 100, // Convert to percentage
        maxDrawdown: realMaxDrawdown * 100,
        sharpeRatio: effectiveSharpe,
        dataSource
      };
    }
    
    return { ...baseMetrics, dataSource };
  }

  /**
   * Extract scheme code from holding metadata
   */
  private extractSchemeCode(holding: ProspectPortfolioHolding): string | null {
    // Check for direct scheme code
    if ((holding as any).schemeCode) {
      return (holding as any).schemeCode.toString();
    }
    
    // Try to extract from ISIN (not reliable but worth a try)
    if (holding.isin) {
      // ISIN format: INF followed by scheme details
      // We'd need a mapping table for accurate conversion
      return null;
    }
    
    // Could add name-based lookup from assetMetadataCache in future
    return null;
  }

  /**
   * Generate portfolio comparison with real historical data when available
   * Falls back to estimation formulas when historical data is not available
   */
  async generatePortfolioComparisonWithRealData(
    holdings: ProspectPortfolioHolding[],
    freshInvestments: FreshInvestmentSuggestion[],
    riskProfile: ProspectRiskProfile
  ): Promise<PortfolioComparison & { dataSource: 'historical' | 'estimated' }> {
    const normalizedHoldings = normalizeHoldings(holdings);
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    let currentExpectedReturn = 10;
    
    normalizedHoldings.forEach(h => {
      const weight = h.currentValue / totalValue;
      const category = (h.category || '').toLowerCase();
      let assetReturn = 10;
      if (category.includes('small')) assetReturn = 18;
      else if (category.includes('mid')) assetReturn = 15;
      else if (category.includes('large') || category.includes('equity')) assetReturn = 12;
      else if (category.includes('debt') || category.includes('bond')) assetReturn = 7;
      else if (category.includes('gold') || category.includes('silver')) assetReturn = 10;
      else if (category.includes('hybrid')) assetReturn = 11;
      currentExpectedReturn = currentExpectedReturn * (1 - weight) + assetReturn * weight;
    });
    
    // Use real historical data for current portfolio metrics
    const currentMetricsResult = await this.calculatePortfolioMetricsWithRealData(normalizedHoldings, currentExpectedReturn);
    const proposedMetrics = this.calculateProposedPortfolioMetrics(freshInvestments, riskProfile);
    
    const comparison = this.buildComparisonFromMetrics(currentMetricsResult, proposedMetrics);
    
    return {
      ...comparison,
      dataSource: currentMetricsResult.dataSource
    };
  }

  generatePortfolioComparison(
    holdings: ProspectPortfolioHolding[],
    freshInvestments: FreshInvestmentSuggestion[],
    riskProfile: ProspectRiskProfile
  ): PortfolioComparison {
    // Normalize holdings to canonical format
    const normalizedHoldings = normalizeHoldings(holdings);
    
    // Calculate current portfolio expected return based on category
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    let currentExpectedReturn = 10; // Default assumption
    
    // Estimate based on asset mix
    normalizedHoldings.forEach(h => {
      const weight = h.currentValue / totalValue;
      const category = (h.category || '').toLowerCase();
      let assetReturn = 10;
      if (category.includes('small')) assetReturn = 18;
      else if (category.includes('mid')) assetReturn = 15;
      else if (category.includes('large') || category.includes('equity')) assetReturn = 12;
      else if (category.includes('debt') || category.includes('bond')) assetReturn = 7;
      else if (category.includes('gold') || category.includes('silver')) assetReturn = 10;
      else if (category.includes('hybrid')) assetReturn = 11;
      currentExpectedReturn = currentExpectedReturn * (1 - weight) + assetReturn * weight;
    });
    
    const currentMetrics = this.calculatePortfolioMetrics(normalizedHoldings, currentExpectedReturn);
    const proposedMetrics = this.calculateProposedPortfolioMetrics(freshInvestments, riskProfile);
    
    // Generate improvement analysis
    const improvements: PortfolioComparison['improvements'] = [];
    
    const addImprovement = (
      metric: string, 
      current: number | null, 
      proposed: number | null, 
      higherIsBetter: boolean,
      interpretation: string
    ) => {
      const change = (current !== null && proposed !== null) ? proposed - current : null;
      const isImprovement = change !== null ? (higherIsBetter ? change > 0 : change < 0) : false;
      improvements.push({ metric, current, proposed, change, interpretation, isImprovement });
    };
    
    addImprovement('Expected Return (%)', currentMetrics.expectedReturn, proposedMetrics.expectedReturn, true,
      'Higher returns mean more wealth creation over time');
    addImprovement('Alpha (Jensen\'s)', currentMetrics.alpha, proposedMetrics.alpha, true,
      'Positive alpha indicates outperformance vs the market');
    addImprovement('Beta', currentMetrics.beta, proposedMetrics.beta, false,
      'Lower beta means less sensitivity to market swings');
    addImprovement('Sharpe Ratio', currentMetrics.sharpeRatio, proposedMetrics.sharpeRatio, true,
      'Higher Sharpe means better risk-adjusted returns');
    addImprovement('Treynor Ratio', currentMetrics.treynorRatio, proposedMetrics.treynorRatio, true,
      'Higher Treynor means better return per unit of market risk');
    addImprovement('Sortino Ratio', currentMetrics.sortinoRatio, proposedMetrics.sortinoRatio, true,
      'Higher Sortino means better return for downside risk taken');
    addImprovement('Information Ratio', currentMetrics.informationRatio, proposedMetrics.informationRatio, true,
      'Higher IR indicates consistent outperformance vs benchmark');
    addImprovement('Max Drawdown (%)', currentMetrics.maxDrawdown, proposedMetrics.maxDrawdown, false,
      'Lower drawdown means smaller potential losses in bad markets');
    addImprovement('Volatility (%)', currentMetrics.volatility, proposedMetrics.volatility, false,
      'Lower volatility means more stable returns');
    addImprovement('Diversification Score', currentMetrics.diversificationScore, proposedMetrics.diversificationScore, true,
      'Higher score means better spread across asset classes');
    
    return {
      currentPortfolio: currentMetrics,
      proposedPortfolio: proposedMetrics,
      improvements
    };
  }

  /**
   * Helper method to build comparison from metrics objects
   */
  private buildComparisonFromMetrics(
    currentMetrics: PortfolioMetrics,
    proposedMetrics: PortfolioMetrics
  ): PortfolioComparison {
    const improvements: PortfolioComparison['improvements'] = [];
    
    const addImprovement = (
      metric: string, 
      current: number | null, 
      proposed: number | null, 
      higherIsBetter: boolean,
      interpretation: string
    ) => {
      const change = (current !== null && proposed !== null) ? proposed - current : null;
      const isImprovement = change !== null ? (higherIsBetter ? change > 0 : change < 0) : false;
      improvements.push({ metric, current, proposed, change, interpretation, isImprovement });
    };
    
    addImprovement('Expected Return (%)', currentMetrics.expectedReturn, proposedMetrics.expectedReturn, true,
      'Higher returns mean more wealth creation over time');
    addImprovement('Alpha (Jensen\'s)', currentMetrics.alpha, proposedMetrics.alpha, true,
      'Positive alpha indicates outperformance vs the market');
    addImprovement('Beta', currentMetrics.beta, proposedMetrics.beta, false,
      'Lower beta means less sensitivity to market swings');
    addImprovement('Sharpe Ratio', currentMetrics.sharpeRatio, proposedMetrics.sharpeRatio, true,
      'Higher Sharpe means better risk-adjusted returns');
    addImprovement('Treynor Ratio', currentMetrics.treynorRatio, proposedMetrics.treynorRatio, true,
      'Higher Treynor means better return per unit of market risk');
    addImprovement('Sortino Ratio', currentMetrics.sortinoRatio, proposedMetrics.sortinoRatio, true,
      'Higher Sortino means better return for downside risk taken');
    addImprovement('Information Ratio', currentMetrics.informationRatio, proposedMetrics.informationRatio, true,
      'Higher IR indicates consistent outperformance vs benchmark');
    addImprovement('Max Drawdown (%)', currentMetrics.maxDrawdown, proposedMetrics.maxDrawdown, false,
      'Lower drawdown means smaller potential losses in bad markets');
    addImprovement('Volatility (%)', currentMetrics.volatility, proposedMetrics.volatility, false,
      'Lower volatility means more stable returns');
    addImprovement('Diversification Score', currentMetrics.diversificationScore, proposedMetrics.diversificationScore, true,
      'Higher score means better spread across asset classes');
    
    return {
      currentPortfolio: currentMetrics,
      proposedPortfolio: proposedMetrics,
      improvements
    };
  }

  async generateRebalancingRecommendations(
    holdings: ProspectPortfolioHolding[], 
    riskProfile: ProspectRiskProfile,
    analysis: PortfolioAnalysis,
    customAllocations?: { 
      equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number;
      international?: number; reit?: number; invit?: number; bonds?: number; mld?: number; pms?: number; aif?: number;
    },
    freshInvestmentAmount: number = 0,
    selectedCategories?: string[]
  ): Promise<RebalanceRecommendation[]> {
    // Normalize holdings to canonical format at entry point
    const normalizedHoldings = normalizeHoldings(holdings);
    
    const recommendations: RebalanceRecommendation[] = [];
    // Recalculate totalValue from normalized holdings to ensure PMS/AIF/insurance data is correctly accounted
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + h.currentValue, 0) || analysis.totalValue;
    
    if (totalValue === 0) {
      return recommendations;
    }
    
    // Default allocations by risk profile (expanded with new asset classes and global regions)
    const defaultAllocations: Record<string, { 
      equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number; etf: number;
      international: number; us_markets: number; europe_markets: number; asia_pacific_markets: number; emerging_markets: number;
      reit: number; invit: number; bonds: number; mld: number; pms: number; aif: number;
      listed_stocks: number; unlisted_stocks: number;
    }> = {
      conservative: { equity: 20, debt: 32, hybrid: 15, gold: 10, silver: 0, index: 3, etf: 3, international: 0, us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 2, pms: 0, aif: 0, listed_stocks: 0, unlisted_stocks: 0 },
      moderate: { equity: 25, debt: 20, hybrid: 10, gold: 5, silver: 2, index: 5, etf: 5, international: 0, us_markets: 5, europe_markets: 3, asia_pacific_markets: 3, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 2, pms: 0, aif: 0, listed_stocks: 0, unlisted_stocks: 0 },
      aggressive: { equity: 30, debt: 10, hybrid: 5, gold: 3, silver: 2, index: 6, etf: 7, international: 0, us_markets: 8, europe_markets: 4, asia_pacific_markets: 5, emerging_markets: 3, reit: 5, invit: 5, bonds: 5, mld: 2, pms: 0, aif: 0, listed_stocks: 0, unlisted_stocks: 0 },
      very_aggressive: { equity: 21, debt: 5, hybrid: 5, gold: 2, silver: 3, index: 6, etf: 8, international: 0, us_markets: 10, europe_markets: 5, asia_pacific_markets: 7, emerging_markets: 6, reit: 5, invit: 3, bonds: 2, mld: 0, pms: 0, aif: 0, listed_stocks: 7, unlisted_stocks: 5 }
    };
    
    // Use custom allocations if provided
    let targetAllocations = customAllocations && 
      (customAllocations.equity > 0 || customAllocations.debt > 0 || customAllocations.hybrid > 0)
      ? { ...defaultAllocations.moderate, ...customAllocations }
      : defaultAllocations[riskProfile.riskTolerance] || defaultAllocations.moderate;
    
    // Map frontend category IDs to backend allocation keys (including global regions)
    const categoryToAllocationKey: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold_fof: 'gold',
      silver_fof: 'silver',
      index_fund: 'index',
      etf: 'etf',
      international: 'international',
      us_markets: 'us_markets',
      europe_markets: 'europe_markets',
      asia_pacific_markets: 'asia_pacific_markets',
      emerging_markets: 'emerging_markets',
      reit: 'reit',
      invit: 'invit',
      bonds: 'bonds',
      mld: 'mld',
      listed_stocks: 'listed_stocks',
      unlisted_stocks: 'unlisted_stocks',
      pms: 'pms',
      aif: 'aif'
    };
    
    // If selectedCategories is provided, zero out non-selected categories and redistribute proportionally to 100%
    if (selectedCategories && selectedCategories.length > 0) {
      const selectedAllocationKeys = new Set(
        selectedCategories.map(cat => categoryToAllocationKey[cat] || cat)
      );
      
      const newAllocations = { ...targetAllocations };
      let totalSelectedAllocation = 0;
      
      // First pass: zero out non-selected, sum selected
      for (const key of Object.keys(newAllocations)) {
        if (selectedAllocationKeys.has(key)) {
          totalSelectedAllocation += (newAllocations as any)[key] || 0;
        } else {
          (newAllocations as any)[key] = 0;
        }
      }
      
      // Second pass: scale selected categories to sum to 100%, or distribute equally if all are 0
      if (totalSelectedAllocation === 0) {
        const equalAllocation = Math.floor(100 / selectedCategories.length);
        let assigned = 0;
        selectedCategories.forEach((cat, idx) => {
          const allocationKey = categoryToAllocationKey[cat] || cat;
          const value = idx === selectedCategories.length - 1 ? (100 - assigned) : equalAllocation;
          (newAllocations as any)[allocationKey] = value;
          assigned += value;
        });
        console.log('[Rebalancing] No allocations for selected categories, distributed equally');
      } else if (totalSelectedAllocation !== 100) {
        const scaleFactor = 100 / totalSelectedAllocation;
        let assigned = 0;
        const selectedKeys = selectedCategories.map(cat => categoryToAllocationKey[cat] || cat);
        selectedKeys.forEach((key, idx) => {
          if (idx === selectedKeys.length - 1) {
            (newAllocations as any)[key] = 100 - assigned;
          } else {
            const scaled = Math.round(((newAllocations as any)[key] || 0) * scaleFactor);
            (newAllocations as any)[key] = scaled;
            assigned += scaled;
          }
        });
      }
      
      targetAllocations = newAllocations;
      console.log('[Rebalancing] Filtered to selected categories:', 
        selectedCategories.map(c => `${c}: ${(targetAllocations as any)[categoryToAllocationKey[c] || c]}%`).join(', '));
    }
    
    console.log('[Rebalancing] Target allocations:', JSON.stringify(targetAllocations));
    console.log('[Rebalancing] Current portfolio value:', totalValue);
    
    // Map holdings to asset categories (expanded)
    const categorizeHolding = (h: ProspectPortfolioHolding): string => {
      // Support both frontend (productType) and backend (assetType/productType) formats - canonical fields first
      const type = (h.productType || h.assetType || '').toLowerCase();
      const name = (h.name || h.productName || '').toLowerCase();
      const category = (h.category || '').toLowerCase();
      
      // Check for PMS/AIF first (specific product types)
      if (type === 'pms') return 'pms';
      if (type === 'aif') return 'aif';
      
      // Check for REITs/InvITs
      if (type === 'reit' || name.includes('reit') || category.includes('reit')) return 'reit';
      if (type === 'invit' || name.includes('invit') || name.includes('infra trust')) return 'invit';
      
      // Check for MLDs
      if (type === 'mld' || name.includes('mld') || name.includes('market linked')) return 'mld';
      
      // Check for direct bonds/NCDs
      if (type === 'ncd' || name.includes('ncd') || (type === 'bond' && !category.includes('fund'))) return 'bonds';
      
      // Check for international funds
      if (category.includes('international') || category.includes('global') || 
          name.includes('nasdaq') || name.includes('us equity') || name.includes('global')) return 'international';
      
      // Check for gold/silver
      if (name.includes('gold') || category.includes('gold')) return 'gold';
      if (name.includes('silver') || category.includes('silver')) return 'silver';
      
      // Check for hybrid
      if (category.includes('hybrid') || category.includes('balanced') || 
          name.includes('hybrid') || name.includes('balanced')) return 'hybrid';
      
      // Check for index funds
      if (category.includes('index') || name.includes('index') || 
          name.includes('nifty') || name.includes('sensex')) return 'index';
      
      // Check for listed stocks
      if (type === 'stock' || type === 'equity' || type === 'share') return 'listed_stocks';
      
      // Check for unlisted stocks
      if (type === 'unlisted_stock' || type === 'unlisted' || name.includes('unlisted') || 
          name.includes('pre-ipo') || category.includes('unlisted')) return 'unlisted_stocks';
      
      // Check for debt mutual funds
      if (type === 'fd' || 
          category.includes('debt') || category.includes('liquid') || 
          category.includes('gilt') || category.includes('money market')) return 'debt';
      
      // Check for equity
      if (type === 'equity' || type === 'stock' ||
          category.includes('equity') || category.includes('large cap') || 
          category.includes('mid cap') || category.includes('small cap') ||
          category.includes('flexi cap') || category.includes('multi cap')) return 'equity';
      
      // For mutual funds, try to categorize based on name/category
      if (type === 'mutual_fund' || type === 'mf') {
        if (category.includes('debt') || name.includes('debt')) return 'debt';
        if (category.includes('equity') || name.includes('equity')) return 'equity';
        return 'equity'; // Default mutual funds to equity
      }
      
      return 'others';
    };
    
    // Calculate current allocation by category (expanded with stocks)
    const currentByCategory: Record<string, { value: number; holdings: ProspectPortfolioHolding[] }> = {
      equity: { value: 0, holdings: [] },
      debt: { value: 0, holdings: [] },
      hybrid: { value: 0, holdings: [] },
      gold: { value: 0, holdings: [] },
      silver: { value: 0, holdings: [] },
      index: { value: 0, holdings: [] },
      etf: { value: 0, holdings: [] },
      international: { value: 0, holdings: [] },
      reit: { value: 0, holdings: [] },
      invit: { value: 0, holdings: [] },
      bonds: { value: 0, holdings: [] },
      mld: { value: 0, holdings: [] },
      pms: { value: 0, holdings: [] },
      aif: { value: 0, holdings: [] },
      listed_stocks: { value: 0, holdings: [] },
      unlisted_stocks: { value: 0, holdings: [] },
      others: { value: 0, holdings: [] }
    };
    
    normalizedHoldings.forEach(h => {
      const category = categorizeHolding(h);
      if (!currentByCategory[category]) {
        currentByCategory[category] = { value: 0, holdings: [] };
      }
      currentByCategory[category].value += h.currentValue;
      currentByCategory[category].holdings.push(h);
    });
    
    console.log('[Rebalancing] Current by category:', Object.entries(currentByCategory).map(([k, v]) => `${k}: ${v.value}`).join(', '));
    
    // ── Step 0: Fetch governance config from DB ──
    const governanceConfig = await db.select().from(rebalanceGovernanceConfig).where(eq(rebalanceGovernanceConfig.riskProfile, riskProfile.riskTolerance)).limit(1);
    const policy = governanceConfig[0] || { toleranceBandPct: 5, minTradeValueInr: 5000, brokerageRatePct: 0.03, maxTacticalWeightPct: 10, targetVolatilityPct: 15, riskToleranceBandPct: 3, maxCategoriesInBuy: 3 };
    console.log('[Rebalancing] Governance policy loaded:', JSON.stringify({ toleranceBandPct: policy.toleranceBandPct, minTradeValueInr: policy.minTradeValueInr, brokerageRatePct: policy.brokerageRatePct, targetVolatilityPct: policy.targetVolatilityPct }));

    const totalPortfolioValue = totalValue + freshInvestmentAmount;
    const categories = ['equity', 'debt', 'hybrid', 'gold', 'silver', 'index', 'etf', 'international', 'reit', 'invit', 'bonds', 'mld', 'listed_stocks', 'unlisted_stocks', 'pms', 'aif'];

    // ── Step 2: Drift Engine ──
    interface DriftMetric {
      category: string;
      currentValue: number;
      currentPercent: number;
      targetPercent: number;
      targetValue: number;
      drift: number;
      driftPercent: number;
      driftStatus: 'DRIFT_BREACH' | 'WITHIN_BAND';
      holdings: ProspectPortfolioHolding[];
      riskFlag?: string;
      costEstimate?: number;
      costFlag?: string;
      rawAction?: string;
      finalAction?: string;
      changeAmount?: number;
      rationaleCode?: string;
      rationaleDetail?: string;
    }

    const driftMetrics: DriftMetric[] = [];

    for (const category of categories) {
      const targetPercent = targetAllocations[category as keyof typeof targetAllocations] || 0;
      const targetValue = (targetPercent / 100) * totalPortfolioValue;
      const currentValue = currentByCategory[category]?.value || 0;
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const drift = currentPercent - targetPercent;
      const driftPercent = targetPercent > 0 ? drift / targetPercent : 0;
      const driftStatus: 'DRIFT_BREACH' | 'WITHIN_BAND' = Math.abs(drift) > (policy.toleranceBandPct ?? 5) ? 'DRIFT_BREACH' : 'WITHIN_BAND';

      driftMetrics.push({
        category,
        currentValue,
        currentPercent,
        targetPercent,
        targetValue,
        drift,
        driftPercent,
        driftStatus,
        holdings: currentByCategory[category]?.holdings || [],
      });
    }

    console.log('[Rebalancing] Drift Engine results:', driftMetrics.filter(dm => dm.driftStatus === 'DRIFT_BREACH').map(dm => `${dm.category}: drift=${dm.drift.toFixed(2)}% (${dm.driftStatus})`).join(', '));

    // ── Step 2.5: Quant Orchestrator (feature-flag gated) ──
    try {
      const quantInput = {
        assetsData: driftMetrics.filter(dm => dm.targetPercent > 0).map(dm => ({
          category: dm.category,
          returns: [] as number[],
          currentWeight: dm.currentPercent / 100,
        })),
        driftMetrics: driftMetrics.map(dm => ({
          category: dm.category,
          currentPercent: dm.currentPercent,
          targetPercent: dm.targetPercent,
          drift: dm.drift,
        })),
        riskProfile: riskProfile.riskTolerance,
        toleranceBandPct: policy.toleranceBandPct ?? 5,
        portfolioId: `prospect-${prospectId}`,
      };

      const quantResult = await quantOrchestrator.run(quantInput);

      if (quantResult.usedMvo && Object.keys(quantResult.optimizedWeights).length > 0) {
        const quantAllocations = quantOrchestrator.convertWeightsToAllocations(
          quantResult.optimizedWeights, categories
        );
        for (const dm of driftMetrics) {
          if (quantAllocations[dm.category] !== undefined) {
            const newTarget = quantAllocations[dm.category];
            if (newTarget !== dm.targetPercent) {
              console.log(`[Rebalancing][Quant] ${dm.category}: target ${dm.targetPercent}% → ${newTarget}% (quant-optimized)`);
              dm.targetPercent = newTarget;
              dm.targetValue = (newTarget / 100) * totalPortfolioValue;
              dm.drift = dm.currentPercent - newTarget;
              dm.driftPercent = newTarget > 0 ? dm.drift / newTarget : 0;
              dm.driftStatus = Math.abs(dm.drift) > (policy.toleranceBandPct ?? 5) ? 'DRIFT_BREACH' : 'WITHIN_BAND';
            }
          }
        }
        console.log('[Rebalancing] Quant-optimized targets applied. Models:', quantResult.modelVersions.join(', '));
      }

      if (quantResult.preemptiveRebalanceRecommended) {
        console.log('[Rebalancing] Quant preemptive rebalance triggered for:', quantResult.highRiskCategories.join(', '));
        for (const dm of driftMetrics) {
          if (quantResult.highRiskCategories.includes(dm.category) && dm.driftStatus === 'WITHIN_BAND') {
            dm.driftStatus = 'DRIFT_BREACH';
            console.log(`[Rebalancing][Quant] ${dm.category}: preemptive drift breach triggered`);
          }
        }
      }
    } catch (quantError: any) {
      console.warn('[Rebalancing] Quant orchestrator error (non-fatal, using deterministic pipeline):', quantError.message);
    }

    // ── Step 3: Risk Engine ──
    const categoryRiskMap: Record<string, number> = {
      equity: 20, listed_stocks: 22, unlisted_stocks: 25, etf: 15,
      hybrid: 12, gold: 10, silver: 14, index: 13,
      debt: 6, bonds: 7, mld: 8, international: 18,
      reit: 14, invit: 13, pms: 20, aif: 22
    };

    const currentPortfolioVolatility = totalValue > 0
      ? driftMetrics.reduce((sum, dm) => sum + (dm.currentPercent / 100) * (categoryRiskMap[dm.category] || 15), 0)
      : 0;
    console.log('[Rebalancing] Risk Engine: current portfolio volatility estimate =', currentPortfolioVolatility.toFixed(2), '%');

    for (const dm of driftMetrics) {
      const catVol = categoryRiskMap[dm.category] || 15;
      if (dm.drift < 0 && dm.driftStatus === 'DRIFT_BREACH') {
        const additionalWeight = Math.abs(dm.drift) / 100;
        const projectedVol = currentPortfolioVolatility + additionalWeight * catVol;
        dm.riskFlag = projectedVol > ((policy.targetVolatilityPct ?? 15) + (policy.riskToleranceBandPct ?? 3)) ? 'VOL_BREACH' : 'OK';
      } else {
        dm.riskFlag = 'OK';
      }
    }

    console.log('[Rebalancing] Risk flags:', driftMetrics.filter(dm => dm.riskFlag === 'VOL_BREACH').map(dm => `${dm.category}: VOL_BREACH`).join(', ') || 'none');

    // ── Step 4: Transaction Cost Filter ──
    for (const dm of driftMetrics) {
      const changeAmount = Math.abs(dm.currentValue - dm.targetValue);
      const estimatedCost = changeAmount * ((policy.brokerageRatePct ?? 0.03) / 100);
      dm.costEstimate = estimatedCost;
      dm.costFlag = (changeAmount < (policy.minTradeValueInr ?? 5000) || estimatedCost > changeAmount * 0.02) ? 'TOO_EXPENSIVE' : 'ACCEPTABLE';
    }

    console.log('[Rebalancing] Cost filter:', driftMetrics.filter(dm => dm.costFlag === 'TOO_EXPENSIVE').map(dm => `${dm.category}: TOO_EXPENSIVE (change=${Math.abs(dm.currentValue - dm.targetValue).toFixed(0)})`).join(', ') || 'all acceptable');

    // ── Step 5: Action Determination ──
    function determineAction(drift: number, driftStatus: string, riskFlag: string, costFlag: string): string {
      if (costFlag === 'TOO_EXPENSIVE') return 'HOLD_COST_FILTER';
      if (riskFlag === 'VOL_BREACH') return drift > 0 ? 'REDUCE' : 'HOLD_RISK_LIMIT';
      if (driftStatus === 'DRIFT_BREACH') return drift > 0 ? 'REDUCE' : 'INCREASE';
      return 'HOLD';
    }

    for (const dm of driftMetrics) {
      dm.rawAction = determineAction(dm.drift, dm.driftStatus, dm.riskFlag || 'OK', dm.costFlag || 'ACCEPTABLE');
      dm.finalAction = dm.rawAction;
      dm.changeAmount = dm.currentValue - dm.targetValue;

      if (dm.rawAction === 'HOLD' || dm.rawAction === 'HOLD_COST_FILTER' || dm.rawAction === 'HOLD_RISK_LIMIT') {
        dm.rationaleCode = dm.rawAction === 'HOLD_COST_FILTER' ? 'COST_FILTER' : dm.rawAction === 'HOLD_RISK_LIMIT' ? 'RISK_LIMIT' : 'WITHIN_BAND';
      } else if (dm.rawAction === 'REDUCE') {
        dm.rationaleCode = 'OVERWEIGHT_BREACH';
      } else if (dm.rawAction === 'INCREASE') {
        dm.rationaleCode = 'UNDERWEIGHT_BREACH';
      } else {
        dm.rationaleCode = 'NO_ACTION';
      }
      dm.rationaleDetail = `${dm.category}: drift=${dm.drift.toFixed(2)}%, action=${dm.rawAction}, risk=${dm.riskFlag}, cost=${dm.costFlag}`;
    }

    console.log('[Rebalancing] Action determination:', driftMetrics.map(dm => `${dm.category}=${dm.rawAction}`).join(', '));

    // ── Step 6: Protect existing holdings — skip REDUCE for positions user already owns ──
    // User's existing portfolio positions should be retained (HOLD), not recommended for sell/reduce
    const existingHoldingNames = new Set(
      normalizedHoldings.map(h => (h.name || h.productName || '').toLowerCase().trim()).filter(Boolean)
    );
    const existingHoldingIsins = new Set(
      normalizedHoldings.map(h => (h.isin || '').toUpperCase().trim()).filter(Boolean)
    );

    for (const dm of driftMetrics) {
      if (dm.finalAction !== 'REDUCE') continue;

      const excessAmount = dm.currentValue - dm.targetValue;
      if (excessAmount <= 0) continue;

      const holdingsToReduce = [...dm.holdings].sort((a, b) => b.currentValue - a.currentValue);
      let remainingToReduce = excessAmount;

      for (const holding of holdingsToReduce) {
        if (remainingToReduce <= 0) continue;

        const holdingName = (holding.name || holding.productName || '').toLowerCase().trim();
        const holdingIsin = (holding.isin || '').toUpperCase().trim();
        const isExistingHolding = (holdingName && existingHoldingNames.has(holdingName)) ||
                                  (holdingIsin && existingHoldingIsins.has(holdingIsin));

        if (isExistingHolding) {
          const alreadyRecommended = recommendations.find(r => r.productName === (holding.name || holding.productName || 'Unknown'));
          if (!alreadyRecommended) {
            recommendations.push({
              action: 'HOLD',
              productType: holding.productType || holding.assetType || 'other',
              productName: holding.name || holding.productName || 'Unknown',
              currentValue: holding.currentValue,
              suggestedValue: holding.currentValue,
              changeAmount: 0,
              rationale: `[HOLD] Existing portfolio position retained. ${dm.category} overweight by ${dm.drift.toFixed(1)}% but position is protected as it is already in your portfolio.`,
              priority: 'low',
            });
          }
          console.log(`[Rebalancing] Protected existing holding: ${holding.name || holding.productName} — REDUCE suppressed, HOLD retained`);
          continue;
        }

        const reduceAmount = Math.min(holding.currentValue, remainingToReduce);
        if (reduceAmount < 1000) continue;

        const isPartialReduce = reduceAmount < holding.currentValue;

        const taxInfo = await proposalCapitalGainsService.calculateHoldingTaxAsync({
          name: holding.name || holding.productName || 'Unknown',
          productType: holding.productType || holding.assetType || 'mutual_fund',
          category: holding.category,
          isin: holding.isin,
          schemeCode: (holding as any).schemeCode,
          currentValue: reduceAmount,
          investedAmount: (holding as any).investedAmount || (reduceAmount * 0.85),
          purchaseDate: holding.purchaseDate || (holding as any).firstPurchaseDate,
          quantity: holding.quantity
        });

        recommendations.push({
          action: 'REDUCE',
          productType: holding.productType || holding.assetType || 'other',
          productName: holding.name || holding.productName || 'Unknown',
          currentValue: holding.currentValue,
          suggestedValue: isPartialReduce ? holding.currentValue - reduceAmount : 0,
          changeAmount: -reduceAmount,
          rationale: `[REDUCE] ${dm.category} overweight by ${dm.drift.toFixed(1)}% (current: ${dm.currentPercent.toFixed(1)}%, target: ${dm.targetPercent}%). ${isPartialReduce ? 'Partial redemption' : 'Full redemption'} recommended. Drift status: ${dm.driftStatus}, Risk: ${dm.riskFlag}, Cost: ${dm.costFlag}.`,
          priority: Math.abs(dm.drift) > 15 ? 'high' : 'medium',
          taxImplications: {
            taxType: taxInfo.taxType,
            holdingPeriodDays: taxInfo.holdingPeriodDays,
            estimatedGain: taxInfo.unrealizedGain,
            estimatedTax: taxInfo.estimatedTaxWithCess,
            exitLoad: taxInfo.exitLoad,
            totalCost: taxInfo.totalCost,
            taxRate: `${(taxInfo.applicableTaxRate * 100).toFixed(1)}%`,
            grandfatheringApplied: taxInfo.grandfatheringApplied,
            grandfatheringBenefit: taxInfo.grandfatheringBenefit,
            alerts: taxInfo.alerts,
            summary: taxInfo.taxType === 'STCG'
              ? `STCG @${(taxInfo.applicableTaxRate * 100).toFixed(0)}% + 4% cess = ₹${taxInfo.estimatedTaxWithCess.toLocaleString('en-IN')}`
              : `LTCG @${(taxInfo.applicableTaxRate * 100).toFixed(1)}% + 4% cess = ₹${taxInfo.estimatedTaxWithCess.toLocaleString('en-IN')}`
          }
        });

        remainingToReduce -= reduceAmount;
      }
    }

    // ── Generate HOLD recommendations (within-band or filtered) ──
    for (const dm of driftMetrics) {
      if (dm.finalAction !== 'HOLD' && dm.finalAction !== 'HOLD_COST_FILTER' && dm.finalAction !== 'HOLD_RISK_LIMIT') continue;
      if (dm.currentValue === 0 || dm.targetPercent === 0) continue;

      const alreadyHasRec = recommendations.some(r => {
        return dm.holdings.some(h => r.productName === (h.name || h.productName));
      });
      if (alreadyHasRec) continue;

      for (const holding of dm.holdings) {
        if (holding.currentValue < 1000) continue;

        let holdRationale = `${dm.category} allocation is at ${dm.currentPercent.toFixed(1)}% (target: ${dm.targetPercent}%) — within tolerance band (±${policy.toleranceBandPct ?? 5}%). No action needed.`;
        const holdAction: 'HOLD' | 'HOLD_COST_FILTER' | 'HOLD_RISK_LIMIT' = dm.finalAction as any;
        if (dm.finalAction === 'HOLD_COST_FILTER') {
          holdRationale = `${dm.category} drift of ${dm.drift.toFixed(1)}% detected but trade filtered: change amount below ₹${policy.minTradeValueInr ?? 5000} minimum or cost exceeds 2% threshold. Holding position.`;
        } else if (dm.finalAction === 'HOLD_RISK_LIMIT') {
          holdRationale = `${dm.category} is underweight by ${Math.abs(dm.drift).toFixed(1)}% but increasing allocation would breach portfolio volatility limit (${policy.targetVolatilityPct ?? 15}% + ${policy.riskToleranceBandPct ?? 3}% band). Holding position.`;
        }

        recommendations.push({
          action: holdAction,
          productType: holding.productType || holding.assetType || 'mutual_fund',
          productName: holding.name || holding.productName || 'Unknown',
          currentValue: holding.currentValue,
          suggestedValue: holding.currentValue,
          changeAmount: 0,
          rationale: holdRationale,
          priority: 'low',
        });
      }
    }

    // ── Handle non-standard/illiquid assets — protect existing holdings from SELL ──
    for (const h of normalizedHoldings) {
      const type = (h.productType || h.assetType || '').toLowerCase();
      if (!['equity', 'mutual_fund', 'mf', 'bond', 'fd', 'gold', 'etf', 'stock', 'debt'].includes(type)) {
        const existing = recommendations.find(r => r.productName === (h.name || h.productName));
        if (!existing && h.currentValue > 1000) {
          recommendations.push({
            action: 'HOLD',
            productType: h.productType || h.assetType || 'other',
            productName: h.name || h.productName || 'Unknown',
            currentValue: h.currentValue,
            suggestedValue: h.currentValue,
            changeAmount: 0,
            rationale: `[HOLD] Existing portfolio position retained. Non-standard asset protected — no sell recommendation for positions already in your portfolio.`,
            priority: 'low',
          });
        }
      }
    }

    // ── Step 9: SWITCH recommendations for underperformers (preserved) ──
    if (analysis.underperformers && analysis.underperformers.length > 0) {
      const normalizedUnderperformers = normalizeHoldings(analysis.underperformers);

      const switchCategoryMapping: Record<string, string[]> = {
        'equity': ['equity'], 'debt': ['debt'], 'hybrid': ['hybrid'],
        'gold_fof': ['gold'], 'silver_fof': ['silver'], 'index_fund': ['index'],
        'etf': ['etf'], 'international': ['international'], 'reit': ['reit'],
        'invit': ['invit'], 'bonds': ['bonds'], 'mld': ['mld'],
        'listed_stocks': ['listed_stocks'], 'unlisted_stocks': ['unlisted_stocks'],
        'pms': ['pms'], 'aif': ['aif']
      };

      const allowedSwitchCategories = new Set<string>();
      if (selectedCategories && selectedCategories.length > 0) {
        selectedCategories.forEach(cat => {
          const mappedCats = switchCategoryMapping[cat] || [cat];
          mappedCats.forEach(c => allowedSwitchCategories.add(c));
        });
        console.log('[Rebalancing] Filtering SWITCH recs to categories:', Array.from(allowedSwitchCategories));
      }

      for (const underperformer of normalizedUnderperformers.slice(0, 3)) {
        const upName = underperformer.name || underperformer.productName || '';
        const existing = recommendations.find(r => r.productName === upName);
        if (!existing && underperformer.currentValue > 5000) {
          const category = categorizeHolding(underperformer);

          if (selectedCategories && selectedCategories.length > 0 && !allowedSwitchCategories.has(category)) {
            console.log(`[Rebalancing] Skipping SWITCH for ${upName} - category ${category} not in selected categories`);
            continue;
          }

          const targetFunds = await getFundsFromCategorySanitizedAsync(category, riskProfile.riskTolerance);
          const eligibleTargets = await selectEligibleFundsForLumpsum(targetFunds, 1);
          const targetFund = eligibleTargets[0] || null;

          const taxInfo = await proposalCapitalGainsService.calculateHoldingTaxAsync({
            name: underperformer.name || underperformer.productName || 'Unknown',
            productType: underperformer.productType || underperformer.assetType || 'mutual_fund',
            category: underperformer.category,
            isin: underperformer.isin,
            schemeCode: (underperformer as any).schemeCode,
            currentValue: underperformer.currentValue,
            investedAmount: (underperformer as any).investedAmount || (underperformer.currentValue * 0.85),
            purchaseDate: underperformer.purchaseDate || (underperformer as any).firstPurchaseDate,
            quantity: underperformer.quantity
          });

          recommendations.push({
            action: 'SWITCH',
            productType: underperformer.productType || underperformer.assetType || 'other',
            productName: underperformer.name || underperformer.productName || 'Unknown',
            currentValue: underperformer.currentValue,
            suggestedValue: underperformer.currentValue,
            changeAmount: 0,
            switchAmount: underperformer.currentValue,
            targetFund: targetFund ? {
              name: targetFund.name,
              amc: targetFund.amc,
              category: targetFund.category,
              returns1Y: targetFund.returns1Y,
              returns3Y: targetFund.returns3Y,
              risk: targetFund.risk
            } : undefined,
            rationale: targetFund
              ? `Switch to ${targetFund.name} (${targetFund.amc}) with ${targetFund.returns3Y}% 3-year returns. Current fund has underperformed peers by 2-5% annually.`
              : `Consider switching to a better-performing fund in the same category. This fund has underperformed relative to peers.`,
            priority: 'medium',
            taxImplications: {
              taxType: taxInfo.taxType,
              holdingPeriodDays: taxInfo.holdingPeriodDays,
              estimatedGain: taxInfo.unrealizedGain,
              estimatedTax: taxInfo.estimatedTaxWithCess,
              exitLoad: taxInfo.exitLoad,
              totalCost: taxInfo.totalCost,
              taxRate: `${(taxInfo.applicableTaxRate * 100).toFixed(1)}%`,
              grandfatheringApplied: taxInfo.grandfatheringApplied,
              grandfatheringBenefit: taxInfo.grandfatheringBenefit,
              alerts: taxInfo.alerts,
              summary: `Switch triggers ${taxInfo.taxType}: ₹${taxInfo.estimatedTaxWithCess.toLocaleString('en-IN')}`,
              note: 'Switches within same AMC may be tax-neutral if within same fund family'
            }
          });
        }
      }
    }

    // ── Step 7: Trade Netting — aggregate REDUCE proceeds + fresh investment and allocate to INCREASE categories ──
    const netFlows: Record<string, number> = {};
    const totalReduceAmount = recommendations
      .filter(r => r.action === 'REDUCE')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);

    const totalSellAmount = recommendations
      .filter(r => r.action === 'SELL' || r.action === 'REDUCE')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);

    // Total deployable = sell/reduce proceeds + fresh investment amount
    let effectiveFreshInvestment = freshInvestmentAmount;

    // Auto-calculate suggested fresh investment when:
    // 1. No sell proceeds (all holdings protected as HOLD)
    // 2. No explicit fresh investment specified
    // 3. Selected categories exist (agent wants diversification into new asset classes)
    if (totalSellAmount === 0 && freshInvestmentAmount === 0 && selectedCategories && selectedCategories.length > 0) {
      // Calculate suggested amount: sum of target allocation gaps × total portfolio value
      // This ensures each selected underweight category gets a meaningful allocation
      const suggestedAmounts: { category: string; amount: number }[] = [];
      categories.forEach(category => {
        const isSelected = selectedCategories.some(sc => {
          const mappings: Record<string, string[]> = {
            'equity': ['equity'], 'debt': ['debt'], 'hybrid': ['hybrid'],
            'gold_fof': ['gold'], 'silver_fof': ['silver'], 'index_fund': ['index'],
            'etf': ['etf'], 'international': ['international'], 'reit': ['reit'],
            'invit': ['invit'], 'bonds': ['bonds'], 'mld': ['mld'],
            'pms': ['pms'], 'aif': ['aif']
          };
          return (mappings[sc] || [sc]).includes(category);
        });
        if (!isSelected) return;
        const targetPercent = targetAllocations[category as keyof typeof targetAllocations] || 0;
        const currentValue = currentByCategory[category]?.value || 0;
        const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
        const gap = targetPercent - currentPercent;
        if (gap > 2 && targetPercent > 0) {
          const suggestedForCategory = Math.round((gap / 100) * totalValue);
          suggestedAmounts.push({ category, amount: Math.max(suggestedForCategory, 5000) });
        }
      });
      if (suggestedAmounts.length > 0) {
        effectiveFreshInvestment = suggestedAmounts.reduce((sum, s) => sum + s.amount, 0);
        // Minimum ₹10,000 total, maximum 30% of portfolio value
        effectiveFreshInvestment = Math.max(effectiveFreshInvestment, 10000);
        effectiveFreshInvestment = Math.min(effectiveFreshInvestment, totalValue * 0.3);
        console.log('[Rebalancing] Auto-calculated fresh investment for selected categories:', effectiveFreshInvestment, 'from gaps:', JSON.stringify(suggestedAmounts));
      }
    }

    const totalDeployableBudget = totalSellAmount + effectiveFreshInvestment;

    console.log('[Rebalancing] Trade Netting: totalReduceAmount=', totalReduceAmount, ', totalSellAmount=', totalSellAmount, ', freshInvestmentAmount=', freshInvestmentAmount, ', effectiveFresh=', effectiveFreshInvestment, ', totalDeployable=', totalDeployableBudget);

    const increaseMetrics = driftMetrics.filter(dm => dm.finalAction === 'INCREASE');
    const totalIncreaseGap = increaseMetrics.reduce((sum, dm) => sum + Math.abs(dm.drift), 0);

    for (const dm of increaseMetrics) {
      const proportion = totalIncreaseGap > 0 ? Math.abs(dm.drift) / totalIncreaseGap : 0;
      netFlows[dm.category] = totalReduceAmount * proportion;
    }

    console.log('[Rebalancing] Net flows by category:', JSON.stringify(netFlows));

    if (totalDeployableBudget > 2000) {
      const categoryMapping: Record<string, string[]> = {
        'equity': ['equity'], 'debt': ['debt'], 'hybrid': ['hybrid'],
        'gold_fof': ['gold'], 'silver_fof': ['silver'], 'index_fund': ['index'],
        'etf': ['etf'], 'international': ['international'], 'reit': ['reit'],
        'invit': ['invit'], 'bonds': ['bonds'], 'mld': ['mld'],
        'listed_stocks': ['listed_stocks'], 'unlisted_stocks': ['unlisted_stocks'],
        'pms': ['pms'], 'aif': ['aif']
      };

      const allowedCategories = new Set<string>();
      if (selectedCategories && selectedCategories.length > 0) {
        selectedCategories.forEach(cat => {
          const mappedCats = categoryMapping[cat] || [cat];
          mappedCats.forEach(c => allowedCategories.add(c));
        });
        console.log('[Rebalancing] Filtering BUY recs to selected categories:', Array.from(allowedCategories));
      }

      const underweightCategories: { category: string; gap: number; targetPercent: number }[] = [];
      categories.forEach(category => {
        if (selectedCategories && selectedCategories.length > 0 && !allowedCategories.has(category)) return;
        const targetPercent = targetAllocations[category as keyof typeof targetAllocations] || 0;
        const currentValue = currentByCategory[category]?.value || 0;
        const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
        const gap = targetPercent - currentPercent;
        if (gap > 2 && targetPercent > 0) {
          underweightCategories.push({ category, gap, targetPercent });
        }
      });

      underweightCategories.sort((a, b) => b.gap - a.gap);

      let remainingToAllocate = totalDeployableBudget;
      const numCategoriesToFund = Math.min(underweightCategories.length, policy.maxCategoriesInBuy ?? 3);
      const categoriesToFund = underweightCategories.slice(0, numCategoriesToFund);
      const totalGap = categoriesToFund.reduce((sum, c) => sum + c.gap, 0);

      for (const { category, gap, targetPercent } of categoriesToFund) {
        if (remainingToAllocate <= 1000) break;

        const proportion = totalGap > 0 ? gap / totalGap : 1 / numCategoriesToFund;
        const buyAmount = Math.round(totalDeployableBudget * proportion);
        const nettedAmount = netFlows[category] || 0;
        const actualAmount = Math.min(Math.max(buyAmount, nettedAmount), remainingToAllocate);

        if (actualAmount < 2000) continue;

        const categoryFunds = await getFundsFromCategorySanitizedAsync(category, riskProfile.riskTolerance);
        const eligibleForLumpsum = await selectEligibleFundsForLumpsum(categoryFunds, 1);
        const fundToRecommend = eligibleForLumpsum[0] || null;

        if (fundToRecommend) {
          const isAutoCalculated = freshInvestmentAmount === 0 && effectiveFreshInvestment > 0;
          const fundingSource = totalSellAmount > 0 ? 'sell_proceeds' : 'fresh_investment';
          const fundingDescription = totalSellAmount > 0 && effectiveFreshInvestment > 0
            ? `Funded by sell proceeds + ₹${effectiveFreshInvestment.toLocaleString('en-IN')} fresh investment`
            : totalSellAmount > 0
              ? `Funded by ${formatAmount(totalSellAmount)} from REDUCE/SELL recommendations`
              : isAutoCalculated
                ? `Suggested fresh investment of ₹${effectiveFreshInvestment.toLocaleString('en-IN')} to diversify into underweight categories`
                : `Funded by ₹${effectiveFreshInvestment.toLocaleString('en-IN')} fresh investment`;

          recommendations.push({
            action: 'INCREASE',
            productType: fundToRecommend.productType || 'mutual_fund',
            productName: fundToRecommend.name,
            suggestedValue: actualAmount,
            changeAmount: actualAmount,
            fundedBy: fundingSource,
            fundedByDescription: fundingDescription,
            fundMetrics: {
              amc: fundToRecommend.amc,
              category: fundToRecommend.category,
              returns1Y: fundToRecommend.returns1Y,
              returns3Y: fundToRecommend.returns3Y,
              returns5Y: fundToRecommend.returns5Y,
              risk: fundToRecommend.risk
            },
            rationale: `[INCREASE] Deploy ${formatAmount(actualAmount)} ${isAutoCalculated ? 'as suggested fresh investment' : totalSellAmount > 0 ? 'from rebalancing proceeds' : 'from fresh investment'} into ${fundToRecommend.category}. ${fundToRecommend.name} (${fundToRecommend.amc}) offers strong historical performance with ${fundToRecommend.returns3Y}% 3-year CAGR returns and ${fundToRecommend.risk} risk level. This helps achieve your target ${targetPercent}% ${category} allocation, currently underweight by ${gap.toFixed(1)}%.`,
            selectionReason: `Selected based on: (1) ${fundToRecommend.returns3Y}% 3Y returns vs category avg, (2) ${fundToRecommend.risk} risk suitable for ${riskProfile.riskTolerance} profile, (3) Fills ${category} allocation gap of ${gap.toFixed(1)}%`,
            priority: gap > 10 ? 'high' : 'medium'
          });

          remainingToAllocate -= actualAmount;
        }
      }
    }

    // ── Step 8: Audit Log — persist decision trail to rebalance_decision_log ──
    const auditEntries = driftMetrics.map(dm => ({
      proposalId: null as string | null,
      portfolioValue: totalValue,
      instrumentName: dm.category,
      assetCategory: dm.category,
      currentWeightPct: dm.currentPercent,
      targetWeightPct: dm.targetPercent,
      driftPct: dm.drift,
      driftStatus: dm.driftStatus,
      riskFlag: dm.riskFlag || 'OK',
      costEstimate: dm.costEstimate || 0,
      costFlag: dm.costFlag || 'ACCEPTABLE',
      tacticalFlag: null as string | null,
      rawAction: dm.rawAction || 'HOLD',
      finalAction: dm.finalAction || 'HOLD',
      changeAmount: dm.changeAmount || 0,
      rationaleCode: dm.rationaleCode || 'NO_ACTION',
      rationaleDetail: dm.rationaleDetail || null,
      governanceConfigId: governanceConfig[0]?.id || null,
    }));
    try {
      if (auditEntries.length > 0) {
        await db.insert(rebalanceDecisionLog).values(auditEntries);
        console.log('[Rebalancing] Audit log: persisted', auditEntries.length, 'decision entries');
      }
    } catch (e) {
      console.warn('[Rebalancing] Audit log failed:', e);
    }

    console.log('[Rebalancing] Generated', recommendations.length, 'recommendations:', 
      recommendations.map(r => `${r.action}: ${r.productName} (${r.changeAmount})`).join(', '));

    // Signal Orchestration: POTD picks excluded from rebalancing proposals
    // POTD micro-investments (Rs. 110-757 range) are no longer merged into rebalancing
    // to keep proposals focused on portfolio-level adjustments only
    console.log('[Signal Orchestrator] POTD cross-reference skipped — POTD excluded from rebalancing proposals');

    // Calculate comprehensive tax summary for SELL/SWITCH recommendations
    const sellSwitchRecs = recommendations.filter(r => r.action === 'SELL' || r.action === 'SWITCH');
    const taxSummary = this.calculateTaxSummary(sellSwitchRecs);

    // Add tax summary to each recommendation object (for frontend display)
    return {
      recommendations,
      taxSummary,
      effectiveFreshInvestment
    };
  }

  /**
   * Calculate comprehensive tax summary for SELL/SWITCH recommendations
   */
  private calculateTaxSummary(recommendations: any[]): any {
    if (!recommendations || recommendations.length === 0) {
      return null;
    }

    let totalSTCG = 0;
    let totalLTCG = 0;
    let stcgTax = 0;
    let ltcgTax = 0;
    let totalExitLoad = 0;
    let taxLossHarvestingOpportunity = 0;
    let grandfatheringBenefitTotal = 0;
    const alerts: any[] = [];
    const holdingsWithTax: any[] = [];

    for (const rec of recommendations) {
      if (!rec.taxImplications) continue;
      
      const tax = rec.taxImplications;
      holdingsWithTax.push({
        name: rec.productName,
        action: rec.action,
        ...tax
      });

      if (tax.estimatedGain > 0) {
        if (tax.taxType === 'STCG') {
          totalSTCG += tax.estimatedGain;
          stcgTax += tax.estimatedTax || 0;
        } else if (tax.taxType === 'LTCG') {
          totalLTCG += tax.estimatedGain;
          ltcgTax += tax.estimatedTax || 0;
        }
      } else if (tax.estimatedGain < 0) {
        taxLossHarvestingOpportunity += Math.abs(tax.estimatedGain);
      }

      totalExitLoad += tax.exitLoad || 0;
      grandfatheringBenefitTotal += tax.grandfatheringBenefit || 0;

      if (tax.alerts) {
        alerts.push(...tax.alerts);
      }
    }

    // Apply 4% cess on total tax
    const baseTax = stcgTax + ltcgTax;
    const cess = baseTax * 0.04;
    const totalTaxLiability = baseTax + cess;
    const netRebalancingCost = totalTaxLiability + totalExitLoad;

    // Get current FY
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentFY = `FY ${fyYear}-${(fyYear + 1).toString().slice(-2)}`;

    const disclosure = proposalCapitalGainsService.generateTaxDisclosure();

    return {
      totalSTCG: Math.round(totalSTCG),
      totalLTCG: Math.round(totalLTCG),
      stcgTax: Math.round(stcgTax),
      ltcgTax: Math.round(ltcgTax),
      cess: Math.round(cess),
      totalTaxLiability: Math.round(totalTaxLiability),
      totalExitLoad: Math.round(totalExitLoad),
      netRebalancingCost: Math.round(netRebalancingCost),
      taxLossHarvestingOpportunity: Math.round(taxLossHarvestingOpportunity),
      grandfatheringBenefitTotal: Math.round(grandfatheringBenefitTotal),
      holdings: holdingsWithTax,
      alerts: this.deduplicateAlerts(alerts),
      currentFY,
      disclosure
    };
  }

  /**
   * Deduplicate similar alerts
   */
  private deduplicateAlerts(alerts: any[]): any[] {
    const seen = new Set<string>();
    return alerts.filter(alert => {
      const key = `${alert.type}-${alert.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async generateFreshInvestmentSuggestions(
    riskProfile: ProspectRiskProfile,
    investmentAmount: number,
    existingHoldings: ProspectPortfolioHolding[],
    customAllocations?: { 
      equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number;
      international?: number; us_markets?: number; europe_markets?: number; asia_pacific_markets?: number; emerging_markets?: number;
      reit?: number; invit?: number; bonds?: number; mld?: number;
      listed_stocks?: number; unlisted_stocks?: number; pms?: number; aif?: number;
    },
    selectedCategories?: string[]
  ): Promise<FreshInvestmentSuggestion[]> {
    const suggestions: FreshInvestmentSuggestion[] = [];
    
    // Calculate total portfolio value for eligibility checks
    const existingPortfolioValue = existingHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const totalPortfolioValue = existingPortfolioValue + investmentAmount;
    
    // Minimum investment thresholds
    const MIN_PMS = 5000000; // ₹50 Lakhs
    const MIN_AIF = 10000000; // ₹1 Crore
    
    // Default allocations based on risk profile (expanded with global regions)
    const defaultAllocations: Record<string, { 
      equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number; etf: number;
      international: number; us_markets: number; europe_markets: number; asia_pacific_markets: number; emerging_markets: number;
      reit: number; invit: number; bonds: number; mld: number; 
      listed_stocks: number; unlisted_stocks: number; pms: number; aif: number;
    }> = {
      conservative: { equity: 20, debt: 32, hybrid: 15, gold: 10, silver: 0, index: 3, etf: 3, international: 0, us_markets: 0, europe_markets: 0, asia_pacific_markets: 0, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
      moderate: { equity: 25, debt: 20, hybrid: 10, gold: 5, silver: 2, index: 5, etf: 5, international: 0, us_markets: 5, europe_markets: 3, asia_pacific_markets: 3, emerging_markets: 0, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
      aggressive: { equity: 30, debt: 10, hybrid: 5, gold: 3, silver: 2, index: 6, etf: 7, international: 0, us_markets: 8, europe_markets: 4, asia_pacific_markets: 5, emerging_markets: 3, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 0, unlisted_stocks: 0, pms: 0, aif: 0 },
      very_aggressive: { equity: 21, debt: 5, hybrid: 5, gold: 2, silver: 3, index: 6, etf: 8, international: 0, us_markets: 10, europe_markets: 5, asia_pacific_markets: 7, emerging_markets: 6, reit: 5, invit: 3, bonds: 2, mld: 0, listed_stocks: 7, unlisted_stocks: 5, pms: 0, aif: 0 }
    };
    
    // Use custom allocations if provided and has non-zero values, otherwise use defaults
    const hasValidCustomAllocations = customAllocations && 
      (customAllocations.equity > 0 || customAllocations.debt > 0 || customAllocations.hybrid > 0 || 
       customAllocations.gold > 0 || (customAllocations.silver || 0) > 0 || (customAllocations.index || 0) > 0 || (customAllocations.etf || 0) > 0 ||
       (customAllocations.international || 0) > 0 || (customAllocations.us_markets || 0) > 0 || 
       (customAllocations.europe_markets || 0) > 0 || (customAllocations.asia_pacific_markets || 0) > 0 || 
       (customAllocations.emerging_markets || 0) > 0 || (customAllocations.reit || 0) > 0 || (customAllocations.invit || 0) > 0 ||
       (customAllocations.bonds || 0) > 0 || (customAllocations.mld || 0) > 0 || 
       (customAllocations.listed_stocks || 0) > 0 || (customAllocations.unlisted_stocks || 0) > 0 ||
       (customAllocations.pms || 0) > 0 || (customAllocations.aif || 0) > 0);
    
    const allocations = hasValidCustomAllocations 
      ? { ...defaultAllocations.moderate, ...customAllocations }
      : defaultAllocations[riskProfile.riskTolerance] || defaultAllocations.moderate;
    
    // Apply eligibility checks for PMS and AIF
    if (totalPortfolioValue < MIN_PMS && allocations.pms > 0) {
      console.log(`[Agent Wizard] PMS allocation removed - portfolio value ${totalPortfolioValue} < min ${MIN_PMS}`);
      allocations.pms = 0;
    }
    if (totalPortfolioValue < MIN_AIF && allocations.aif > 0) {
      console.log(`[Agent Wizard] AIF allocation removed - portfolio value ${totalPortfolioValue} < min ${MIN_AIF}`);
      allocations.aif = 0;
    }
    
    console.log('[Agent Wizard] Using allocations:', JSON.stringify(allocations), 'Custom:', hasValidCustomAllocations);
    console.log('[Agent Wizard] Total portfolio value:', totalPortfolioValue, 'PMS eligible:', totalPortfolioValue >= MIN_PMS, 'AIF eligible:', totalPortfolioValue >= MIN_AIF);
    
    // Use selected categories if provided with items, otherwise default to main categories
    const hasValidCategories = selectedCategories && selectedCategories.length > 0;
    const categories = hasValidCategories 
      ? selectedCategories 
      : ['equity', 'debt', 'hybrid', 'gold_fof', 'index_fund'];
    
    console.log('[Agent Wizard] Using categories:', categories, 'Custom:', hasValidCategories);
    
    // Map allocation keys to category keys (expanded with stocks and global regions)
    const allocationToCategory: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold: 'gold_fof',
      silver: 'silver_fof',
      index: 'index_fund',
      etf: 'etf',
      international: 'international',
      us_markets: 'us_markets',
      europe_markets: 'europe_markets',
      asia_pacific_markets: 'asia_pacific_markets',
      emerging_markets: 'emerging_markets',
      reit: 'reit',
      invit: 'invit',
      bonds: 'bonds',
      mld: 'mld',
      listed_stocks: 'listed_stocks',
      unlisted_stocks: 'unlisted_stocks',
      pms: 'pms',
      aif: 'aif'
    };
    
    const categoryToAllocation: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold_fof: 'gold',
      silver_fof: 'silver',
      index_fund: 'index',
      etf: 'etf',
      international: 'international',
      us_markets: 'us_markets',
      europe_markets: 'europe_markets',
      asia_pacific_markets: 'asia_pacific_markets',
      emerging_markets: 'emerging_markets',
      reit: 'reit',
      invit: 'invit',
      bonds: 'bonds',
      mld: 'mld',
      listed_stocks: 'listed_stocks',
      unlisted_stocks: 'unlisted_stocks',
      pms: 'pms',
      aif: 'aif'
    };
    
    // Filter allocations to only include selected categories
    let filteredAllocations: { category: string; allocation: number }[] = [];
    let totalAllocation = 0;
    
    for (const category of categories) {
      const allocationKey = categoryToAllocation[category] || category;
      const allocation = (allocations as any)[allocationKey] || 0;
      // Include category even if allocation is 0 - we'll distribute equally if all are 0
      filteredAllocations.push({ category, allocation });
      totalAllocation += allocation;
    }
    
    // If all selected categories have 0% allocation, distribute equally among them
    if (totalAllocation === 0 && filteredAllocations.length > 0) {
      const equalAllocation = Math.floor(100 / filteredAllocations.length);
      filteredAllocations = filteredAllocations.map((a, idx) => ({
        ...a,
        allocation: idx === 0 ? equalAllocation + (100 % filteredAllocations.length) : equalAllocation
      }));
      totalAllocation = 100;
      console.log('[Agent Wizard] No allocations set for selected categories, distributing equally:', 
        filteredAllocations.map(a => `${a.category}: ${a.allocation}%`).join(', '));
    }
    
    // Normalize allocations to sum to 100% if needed
    if (totalAllocation > 0 && totalAllocation !== 100) {
      const scaleFactor = 100 / totalAllocation;
      filteredAllocations = filteredAllocations.map(a => ({
        ...a,
        allocation: Math.round(a.allocation * scaleFactor)
      }));
    }
    
    // Remove categories with 0 allocation after normalization
    filteredAllocations = filteredAllocations.filter(a => a.allocation > 0);
    
    // Generate suggestions for each category based on allocations
    let matchScoreCounter = 95;
    
    for (const { category, allocation } of filteredAllocations) {
      if (allocation === 0) continue;
      
      // Use async sanitized access with DB fallback for live returns
      const categoryFunds = await getFundsFromCategorySanitizedAsync(category, riskProfile.riskTolerance);
      
      if (categoryFunds.length === 0) continue;
      
      // Calculate amount for this category
      const categoryAmount = Math.round((allocation / 100) * investmentAmount);
      
      // Filter out lumpsum-restricted funds and resolve alternatives
      const fundsToUse = await selectEligibleFundsForLumpsum(categoryFunds, 2);
      if (fundsToUse.length === 0) continue;
      const amountPerFund = Math.round(categoryAmount / fundsToUse.length);
      
      fundsToUse.forEach((fund: any, index: number) => {
        const fundAmount = index === fundsToUse.length - 1 
          ? categoryAmount - (amountPerFund * index) // Last fund gets remainder
          : amountPerFund;
        
        if (fundAmount <= 0) return;
        
        suggestions.push({
          productType: fund.productType || 'mutual_fund',
          productName: fund.name,
          suggestedAmount: fundAmount,
          expectedReturn: `${fund.returns3Y}%`,
          riskLevel: fund.risk.toLowerCase(),
          matchScore: matchScoreCounter--,
          rationale: `**Why ${fund.name}?** This ${fund.category} fund from ${fund.amc} demonstrates strong historical performance with ${fund.returns3Y}% 3-year CAGR, outperforming category average. With ${fund.risk} risk rating, it aligns well with your ${riskProfile.riskTolerance} risk profile and ${riskProfile.investmentHorizon.replace('_', ' ')} investment horizon.`,
          highlights: [
            `AMC: ${fund.amc}`,
            `Category: ${fund.category}`,
            `1Y Returns: ${fund.returns1Y}%`,
            `3Y Returns: ${fund.returns3Y}%`,
            `5Y Returns: ${fund.returns5Y}%`,
            `Risk: ${fund.risk}`
          ],
          fundMetrics: {
            amc: fund.amc,
            category: fund.category,
            returns1Y: fund.returns1Y,
            returns3Y: fund.returns3Y,
            returns5Y: fund.returns5Y,
            risk: fund.risk,
            expenseRatio: fund.expenseRatio || 'N/A',
            aum: fund.aum || 'N/A'
          },
          amc: fund.amc,
          category: fund.category,
          returns1Y: fund.returns1Y,
          returns3Y: fund.returns3Y,
          returns5Y: fund.returns5Y,
          riskRating: fund.risk,
          allocationPercentage: Math.round((fundAmount / investmentAmount) * 100),
          recommendedAmount: fundAmount,
          selectionReason: `**Selection Criteria:** (1) ${fund.returns3Y}% 3-year CAGR exceeds category benchmark, (2) ${fund.risk} risk level matches your ${riskProfile.riskTolerance} profile, (3) ${allocation}% ${category} allocation supports ${riskProfile.primaryGoal} goal achievement, (4) ${fund.amc} has strong fund management track record.`
        } as any);
      });
    }
    
    // Fallback: if no suggestions generated but we have selected categories, 
    // try to find ANY funds from those categories regardless of risk profile match
    if (suggestions.length === 0 && categories.length > 0) {
      console.log('[Agent Wizard] No primary suggestions, trying fallback for categories:', categories);
      
      let matchScoreFallback = 90;
      const equalAllocationFallback = Math.floor(100 / categories.length);
      
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const allocation = i === 0 ? equalAllocationFallback + (100 % categories.length) : equalAllocationFallback;
        const categoryAmount = Math.round((allocation / 100) * investmentAmount);
        
        // Try to get funds from this category for any risk level (sanitized - no PENDING values)
        const riskLevels = [riskProfile.riskTolerance, 'moderate', 'conservative', 'aggressive', 'very_aggressive'];
        let fundsToUse: any[] = [];
        
        for (const risk of riskLevels) {
          const categoryFunds = await getFundsFromCategorySanitizedAsync(category, risk);
          const eligible = await selectEligibleFundsForLumpsum(categoryFunds, 2);
          if (eligible.length > 0) {
            fundsToUse = eligible;
            break;
          }
        }
        
        if (fundsToUse.length === 0) continue;
        
        const amountPerFund = Math.round(categoryAmount / fundsToUse.length);
        
        fundsToUse.forEach((fund: any, idx: number) => {
          const fundAmount = idx === fundsToUse.length - 1 
            ? categoryAmount - (amountPerFund * idx) 
            : amountPerFund;
          
          if (fundAmount <= 0) return;
          
          suggestions.push({
            productType: fund.productType || 'mutual_fund',
            productName: fund.name,
            suggestedAmount: fundAmount,
            expectedReturn: `${fund.returns3Y}%`,
            riskLevel: fund.risk.toLowerCase(),
            matchScore: matchScoreFallback--,
            rationale: `Recommended ${fund.category} from ${fund.amc}. Selected from your enabled product categories.`,
            highlights: [
              `AMC: ${fund.amc}`,
              `Category: ${fund.category}`,
              `1Y Returns: ${fund.returns1Y}%`,
              `3Y Returns: ${fund.returns3Y}%`,
              `5Y Returns: ${fund.returns5Y}%`,
              `Risk: ${fund.risk}`
            ],
            amc: fund.amc,
            category: fund.category,
            returns1Y: fund.returns1Y,
            returns3Y: fund.returns3Y,
            returns5Y: fund.returns5Y,
            riskRating: fund.risk,
            allocationPercentage: Math.round((fundAmount / investmentAmount) * 100),
            recommendedAmount: fundAmount,
            selectionReason: `Selected from your enabled ${category} category based on ${riskProfile.riskTolerance} risk profile.`
          } as any);
        });
      }
      
      console.log('[Agent Wizard] Fallback generated', suggestions.length, 'suggestions');
    }
    
    // Final message if still no suggestions (shouldn't happen with proper categories)
    if (suggestions.length === 0) {
      console.log('[Agent Wizard] Warning: No suggestions generated for categories:', categories);
    }

    return suggestions;
  }

  private calculateWeightedReturn(freshInvestments: FreshInvestmentSuggestion[], riskProfile: ProspectRiskProfile): number {
    // Base returns by risk profile
    const baseReturns: Record<string, number> = {
      conservative: 8,
      moderate: 12,
      aggressive: 15,
      very_aggressive: 18
    };
    
    if (freshInvestments.length === 0) {
      return baseReturns[riskProfile.riskTolerance] || 12;
    }

    // Calculate weighted average from fresh investment expected returns
    let totalWeight = 0;
    let weightedSum = 0;
    
    freshInvestments.forEach((inv: any) => {
      const returnStr = inv.expectedReturn || inv.returns3Y || '12';
      const returnVal = parseFloat(returnStr.replace('%', '')) || 12;
      const weight = inv.suggestedAmount || 1;
      
      weightedSum += returnVal * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) {
      return baseReturns[riskProfile.riskTolerance] || 12;
    }

    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  async createCombinedProposal(
    agentId: string,
    prospectId: string,
    prospectData: { name: string; email?: string; mobile?: string; pan?: string },
    holdings: ProspectPortfolioHolding[],
    riskProfile: ProspectRiskProfile,
    freshInvestmentAmount: number,
    customAllocations?: { equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number },
    selectedCategories?: string[],
    globalAdvisorySelections?: Record<string, string[]>,
    proposalSections?: Record<string, boolean>,
    analyticsData?: any,
    investmentGoalsInput?: Array<{ goalType: string; targetAmount: number; timelineYears: number; monthlyContribution: number; priority?: string }>
  ): Promise<CombinedProposal> {
    const analysis = this.analyzePortfolio(holdings, riskProfile);
    const rebalancingResult = await this.generateRebalancingRecommendations(
      holdings, 
      riskProfile, 
      analysis,
      customAllocations,
      freshInvestmentAmount,
      selectedCategories
    );
    
    // Handle both old array format and new object format for backwards compatibility
    const rebalancing = Array.isArray(rebalancingResult) ? rebalancingResult : rebalancingResult.recommendations;
    const taxSummary = Array.isArray(rebalancingResult) ? null : rebalancingResult.taxSummary;
    // Use auto-calculated fresh investment if engine determined one (e.g. when all holdings are HOLD)
    const effectiveFresh = (!Array.isArray(rebalancingResult) && rebalancingResult.effectiveFreshInvestment)
      ? rebalancingResult.effectiveFreshInvestment : freshInvestmentAmount;
    
    // Calculate sell proceeds and how much was already allocated to rebalancing BUY/INCREASE recommendations
    const sellProceeds = rebalancing
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    // BUY recs consume sell proceeds; INCREASE recs consume fresh investment
    const buyAllocatedFromSellProceeds = rebalancing
      .filter(r => r.action === 'BUY')
      .reduce((sum, r) => sum + r.changeAmount, 0);
    const increaseAllocatedFromFresh = rebalancing
      .filter(r => r.action === 'INCREASE')
      .reduce((sum, r) => sum + r.changeAmount, 0);
    
    // Remaining unallocated amounts
    const remainingSellProceeds = Math.max(0, sellProceeds - buyAllocatedFromSellProceeds);
    const remainingFreshInvestment = Math.max(0, effectiveFresh - increaseAllocatedFromFresh);
    const totalDeployableAmount = remainingFreshInvestment + remainingSellProceeds;
    
    console.log(`[Proposal] Fresh: ${freshInvestmentAmount}, EffectiveFresh: ${effectiveFresh}, Sell proceeds: ${sellProceeds}, BUY from sells: ${buyAllocatedFromSellProceeds}, INCREASE from fresh: ${increaseAllocatedFromFresh}, Remaining fresh: ${remainingFreshInvestment}, Remaining sells: ${remainingSellProceeds}, Total deployable for fresh suggestions: ${totalDeployableAmount}`);
    
    // Create funding summary for PDF
    const rebalancingBuyAllocated = buyAllocatedFromSellProceeds + increaseAllocatedFromFresh;
    const fundingSummary = {
      totalSellAmount: sellProceeds,
      rebalancingBuyAmount: rebalancingBuyAllocated,
      freshInvestmentAmount: effectiveFresh,
      remainingSellProceeds,
      totalDeployableAmount
    };
    
    const freshInvestments = await this.generateFreshInvestmentSuggestions(
      riskProfile, 
      totalDeployableAmount, 
      holdings,
      customAllocations,
      selectedCategories
    );

    // Fetch agent details
    const [agent] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      mobile: users.mobile
    }).from(users).where(eq(users.id, agentId)).limit(1);

    const agentName = agent ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim() : null;
    const agentEmail = agent?.email || null;
    const agentMobile = agent?.mobile || null;

    // Generate referral code for onboarding link
    const referralCode = `REF${nanoid(8).toUpperCase()}`;

    const totalSellAmount = rebalancing
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    const totalBuyAmount = rebalancing
      .filter(r => r.action === 'BUY' || r.action === 'INCREASE')
      .reduce((sum, r) => sum + r.changeAmount, 0);
    
    const netInvestmentRequired = totalBuyAmount - totalSellAmount;
    
    // Calculate weighted average return based on recommendations
    const avgReturn = this.calculateWeightedReturn(freshInvestments, riskProfile);
    const years = riskProfile.investmentHorizon === 'short_term' ? 3 : 
                  riskProfile.investmentHorizon === 'medium_term' ? 5 : 10;
    const projectedValue = (analysis.totalValue + netInvestmentRequired) * Math.pow(1 + avgReturn/100, years);

    const shareToken = nanoid(12);
    
    // Get target allocation based on risk profile
    const targetAllocation = TARGET_ALLOCATIONS[riskProfile.riskTolerance] || TARGET_ALLOCATIONS.moderate;
    
    // Generate portfolio comparison with risk-adjusted metrics (using real historical data when available)
    let portfolioComparison: PortfolioComparison | undefined;
    let metricsDataSource: 'historical' | 'estimated' | undefined;
    
    if (holdings.length > 0 && freshInvestments.length > 0) {
      try {
        const comparisonWithData = await this.generatePortfolioComparisonWithRealData(holdings, freshInvestments, riskProfile);
        portfolioComparison = comparisonWithData;
        metricsDataSource = comparisonWithData.dataSource;
        console.log(`[ProposalGen] Portfolio metrics calculated using ${metricsDataSource} data`);
      } catch (error) {
        // Fallback to estimation-based comparison if real data fails
        console.log('[ProposalGen] Using estimation-based metrics (real data unavailable)');
        portfolioComparison = this.generatePortfolioComparison(holdings, freshInvestments, riskProfile);
        metricsDataSource = 'estimated';
      }
    }
    
    // EPIC 6: Generate compliance snapshot
    const complianceSnapshot = complianceSnapshotService.generateSnapshot({
      riskProfile: riskProfile.riskTolerance,
      investmentHorizon: riskProfile.investmentHorizon,
      investmentGoal: riskProfile.primaryGoal,
      proposedAllocations: targetAllocation,
      proposedProducts: freshInvestments.map(f => ({
        name: f.productName,
        riskRating: f.riskLevel || 'moderate',
        category: f.category || 'mutual_fund'
      }))
    });

    // EPIC 2: Generate allocation policy from risk profile
    const allocationPolicy = allocationPolicyService.getDefaultPolicy(riskProfile.riskTolerance);

    const [proposal] = await db.insert(prospectProposals).values({
      shareToken,
      agentId,
      prospectName: prospectData.name,
      prospectEmail: prospectData.email,
      prospectMobile: prospectData.mobile,
      prospectPan: prospectData.pan,
      proposalType: 'sample_portfolio',
      proposalTitle: `Investment Proposal for ${prospectData.name}`,
      clientType: 'individual',
      samplePortfolio: holdings,
      // EPIC 2: Persist allocation policy
      allocationPolicy,
      // EPIC 4: Versioning (v1 for new proposals)
      proposalVersion: 1,
      isLatestVersion: true,
      // EPIC 6: Compliance snapshot
      complianceSnapshot,
      currentAnalysis: JSON.stringify({ ...analysis, portfolioComparison }),
      recommendations: [...rebalancing],
      totalInvestmentAmount: String(netInvestmentRequired),
      projectedValue: String(Math.round(projectedValue)),
      projectedReturns: String(avgReturn),
      riskProfile: riskProfile.riskTolerance,
      investmentGoals: investmentGoalsInput && investmentGoalsInput.length > 0 
        ? { 
            goals: investmentGoalsInput,
            totalMonthlySIP: investmentGoalsInput.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0),
            goalType: riskProfile.primaryGoal, 
            timeHorizon: riskProfile.investmentHorizon,
            riskTolerance: riskProfile.riskTolerance
          }
        : { 
            goalType: riskProfile.primaryGoal, 
            timeHorizon: riskProfile.investmentHorizon,
            riskTolerance: riskProfile.riskTolerance
          },
      globalAdvisorySelections: globalAdvisorySelections || undefined,
      targetAllocation,
      agentName,
      agentEmail,
      agentMobile,
      referralCode,
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, [], riskProfile, globalAdvisorySelections),
      proposalSections: proposalSections || {
        exitLoadCalendar: true,
        capitalGainsSummary: true,
        portfolioHealthScore: true,
        expenseRatioAnalysis: true,
        dividendProjection: true,
        riskHeatmap: true,
        goalGapAnalysis: true,
        benchmarkComparison: true,
        priorityRecommendations: true,
        sipRecommendations: true,
        whatIfSimulator: true,
        executiveSummary: true
      },
      analyticsData: analyticsData || null,
      status: 'draft',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      viewCount: 0
    }).returning();

    await db.insert(prospectProposalEvents).values({
      proposalId: proposal.id,
      eventType: 'created',
      eventData: { prospectId, agentId }
    });

    try {
      await db.insert(proposalVersions).values({
        proposalId: String(proposal.id),
        versionNumber: 1,
        payload: {
          recommendations: [...rebalancing],
          targetAllocation,
          riskProfile: riskProfile.riskTolerance,
          totalInvestmentAmount: netInvestmentRequired,
          projectedValue: Math.round(projectedValue),
        },
        changeReason: 'Initial proposal creation',
        changedSchemes: null,
        createdBy: String(agentId),
      });

      const allFunds = [
        ...rebalancing.map(r => ({ name: r.productName, type: r.action })),
      ];
      for (const fund of allFunds) {
        try {
          const eligibility = await schemeGovernanceService.checkEligibility(fund.name, "name");
          const investmentType = fund.type === 'BUY' ? 'lumpsum' : fund.type.toLowerCase();
          const isAllowed = investmentType === 'lumpsum' ? eligibility.lumpsumAllowed : eligibility.sipAllowed;
          await db.insert(proposalAuditLog).values({
            proposalId: String(proposal.id),
            eventType: 'fund_eligibility_check',
            schemeName: fund.name,
            isin: eligibility.alternativeIsin || null,
            investmentType,
            validationStatus: isAllowed ? 'passed' : 'blocked',
            validationMessage: eligibility.restrictionReason || 'Fund eligible for inclusion',
            metadata: {
              eligible: eligibility.eligible,
              sipAllowed: eligibility.sipAllowed,
              lumpsumAllowed: eligibility.lumpsumAllowed,
              subscriptionStatus: eligibility.subscriptionStatus,
            },
          });
        } catch {
          await db.insert(proposalAuditLog).values({
            proposalId: String(proposal.id),
            eventType: 'fund_eligibility_check',
            schemeName: fund.name,
            investmentType: fund.type === 'BUY' ? 'lumpsum' : fund.type.toLowerCase(),
            validationStatus: 'skipped',
            validationMessage: 'Eligibility check unavailable; using hardcoded fallback',
          });
        }
      }
    } catch (auditError) {
      console.error('[ProposalAudit] Non-critical: Failed to write audit/version records:', auditError);
    }

    const detailedRecommendations = [
      ...rebalancing.filter(r => r.action === 'BUY').map(r => ({
        action: 'BUY',
        productName: r.productName,
        suggestedAmount: r.changeAmount,
        fundedBy: 'sell_proceeds',
        fundMetrics: (r as any).fundMetrics,
        rationale: r.rationale,
        selectionReason: (r as any).selectionReason
      })),
    ];

    return {
      prospectId,
      proposalId: proposal.id,
      shareToken,
      analysis,
      rebalancing,
      freshInvestments: [],
      totalSellAmount,
      totalBuyAmount,
      netInvestmentRequired,
      projectedValue: Math.round(projectedValue),
      projectedReturn: `${avgReturn}% p.a.`,
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, [], riskProfile, globalAdvisorySelections),
      portfolioComparison,
      fundingSummary,
      detailedRecommendations,
      taxSummary
    };
  }

  private generateExecutiveSummary(
    analysis: PortfolioAnalysis,
    rebalancing: RebalanceRecommendation[],
    freshInvestments: FreshInvestmentSuggestion[],
    riskProfile: ProspectRiskProfile,
    globalAdvisorySelections?: Record<string, string[]>
  ): string {
    const sellCount = rebalancing.filter(r => r.action === 'SELL').length;
    const buyCount = rebalancing.filter(r => r.action === 'BUY' || r.action === 'INCREASE').length;
    const totalOpportunities = freshInvestments.length + buyCount;
    
    let summary = `Based on your ${riskProfile.riskTolerance} risk profile and ${riskProfile.investmentHorizon.replace('_', ' ')} investment horizon, ` +
      `we have analyzed your portfolio worth ₹${(analysis.totalValue / 100000).toFixed(1)}L. ` +
      `Your current diversification score is ${analysis.diversificationScore}/100 with a risk score of ${analysis.riskScore}/100. ` +
      `We recommend ${sellCount > 0 ? `rebalancing ${sellCount} positions` : 'no immediate rebalancing'} ` +
      `and ${totalOpportunities} fresh investment opportunities aligned with your ${riskProfile.primaryGoal} goal.`;
    
    if (globalAdvisorySelections && Object.keys(globalAdvisorySelections).length > 0) {
      const marketLabels: Record<string, string> = {
        us: 'US Markets', europe: 'European Markets', china_hk: 'China/Hong Kong',
        japan: 'Japan', other_asia: 'Other Asian Markets'
      };
      const markets = Object.keys(globalAdvisorySelections).map(m => marketLabels[m] || m).join(', ');
      const instrumentCount = Object.values(globalAdvisorySelections).flat().length;
      summary += ` Additionally, we recommend global diversification across ${markets} with ${instrumentCount} instrument categories via LRS ($250K annual limit).`;
    }
    
    return summary;
  }

  async shareProposal(proposalId: string, channel: 'email' | 'whatsapp' | 'sms', agentId: string) {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(eq(prospectProposals.id, proposalId), eq(prospectProposals.agentId, agentId)))
      .limit(1);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const shareUrl = `${process.env.BASE_URL || 'https://fintekpro.replit.app'}/proposal/${proposal.shareToken}`;

    await db.update(prospectProposals)
      .set({
        status: 'shared',
        ...(channel === 'email' ? { sharedViaEmail: true } : {}),
        ...(channel === 'whatsapp' ? { sharedViaWhatsApp: true } : {}),
        updatedAt: new Date()
      })
      .where(eq(prospectProposals.id, proposalId));

    await db.insert(prospectProposalEvents).values({
      proposalId,
      eventType: `shared_${channel}`,
      eventData: { channel, shareUrl }
    });

    return { shareUrl, shareToken: proposal.shareToken };
  }

  async getProposalByToken(shareToken: string) {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, shareToken))
      .limit(1);

    if (proposal) {
      await db.update(prospectProposals)
        .set({
          viewCount: (proposal.viewCount || 0) + 1,
          status: proposal.status === 'shared' ? 'viewed' : proposal.status,
          firstViewedAt: proposal.firstViewedAt || new Date(),
          lastViewedAt: new Date()
        })
        .where(eq(prospectProposals.id, proposal.id));

      await db.insert(prospectProposalEvents).values({
        proposalId: proposal.id,
        eventType: 'viewed'
      });
    }

    return proposal;
  }
}

export const agentProspectWizardService = new AgentProspectWizardService();
