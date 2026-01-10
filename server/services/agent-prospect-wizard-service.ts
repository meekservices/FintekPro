import { db } from "../db";
import { 
  prospectClients, 
  prospectProposals,
  prospectProposalEvents,
  InsertProspectClient,
  users,
  onboardingInvitations,
  agentClientMappingRequests
} from "@shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { aiInvestmentOrchestrator } from "./ai-investment-orchestrator";
import { aiResponseCacheService } from "./ai-response-cache-service";

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
const FUND_RECOMMENDATIONS_BY_CATEGORY = {
  equity: {
    conservative: [
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: '17.2', returns3Y: '18.8', returns5Y: '18.5', risk: 'Moderately High' },
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
      { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: '21.2', returns3Y: '22.8', returns5Y: '20.5', risk: 'High' },
    ],
    aggressive: [
      { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: '27.2', returns3Y: '33.5', returns5Y: '30.8', risk: 'Very High' },
      { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: '25.5', returns3Y: '31.2', returns5Y: '27.5', risk: 'Very High' },
      { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: '19.2', returns3Y: '21.5', returns5Y: '20.2', risk: 'High' },
      { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: '15.8', returns3Y: '17.2', returns5Y: '16.1', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Active Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: '31.2', returns3Y: '36.5', returns5Y: '34.2', risk: 'Very High' },
      { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: '28.8', returns3Y: '34.8', returns5Y: '31.5', risk: 'Very High' },
      { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: '27.5', returns3Y: '32.8', returns5Y: '29.2', risk: 'Very High' },
      { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: '23.2', returns3Y: '27.5', returns5Y: '24.0', risk: 'High' },
      { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: '21.2', returns3Y: '24.8', returns5Y: '23.5', risk: 'Very High' },
    ]
  },
  debt: {
    conservative: [
      { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Corporate Bond', returns1Y: '7.2', returns3Y: '7.6', returns5Y: '7.9', risk: 'Low' },
      { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt - Medium Duration', returns1Y: '6.8', returns3Y: '7.2', returns5Y: '7.5', risk: 'Low' },
      { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt - Banking & PSU', returns1Y: '7.0', returns3Y: '7.4', returns5Y: '7.5', risk: 'Low' },
    ],
    moderate: [
      { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Corporate Bond', returns1Y: '7.1', returns3Y: '7.5', returns5Y: '7.8', risk: 'Low' },
      { name: 'HDFC Short Term Debt Fund - Regular (G)', amc: 'HDFC', category: 'Debt - Short Duration', returns1Y: '6.9', returns3Y: '7.3', returns5Y: '7.4', risk: 'Low' },
    ],
    aggressive: [
      { name: 'ICICI Pru Credit Risk Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Credit Risk', returns1Y: '7.5', returns3Y: '7.8', returns5Y: '8.0', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'SBI Dynamic Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Dynamic Bond', returns1Y: '7.3', returns3Y: '7.7', returns5Y: '7.9', risk: 'Moderate' },
    ]
  },
  hybrid: {
    conservative: [
      { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Balanced Advantage', returns1Y: '11.8', returns3Y: '13.5', returns5Y: '13.1', risk: 'Moderate' },
      { name: 'ICICI Pru Equity & Debt Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Aggressive', returns1Y: '12.5', returns3Y: '14.2', returns5Y: '13.8', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Aggressive', returns1Y: '14.0', returns3Y: '14.8', returns5Y: '13.5', risk: 'Moderate' },
      { name: 'Kotak Equity Hybrid Fund - Regular (G)', amc: 'Kotak', category: 'Hybrid - Aggressive', returns1Y: '13.5', returns3Y: '14.5', returns5Y: '13.2', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'ICICI Pru Multi Asset Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Multi Asset', returns1Y: '15.2', returns3Y: '15.8', returns5Y: '14.5', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Multi Asset Fund - Regular (G)', amc: 'Quant', category: 'Hybrid - Multi Asset', returns1Y: '18.5', returns3Y: '19.2', returns5Y: '17.8', risk: 'Moderately High' },
    ]
  },
  gold_fof: {
    conservative: [
      { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: '14.2', returns3Y: '12.8', returns5Y: '11.5', risk: 'Moderate' },
      { name: 'HDFC Gold Fund - Regular (G)', amc: 'HDFC', category: 'FOF - Gold', returns1Y: '13.8', returns3Y: '12.5', returns5Y: '11.2', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: '14.0', returns3Y: '12.6', returns5Y: '11.3', risk: 'Moderate' },
      { name: 'Axis Gold Fund - Regular (G)', amc: 'Axis', category: 'FOF - Gold', returns1Y: '13.9', returns3Y: '12.4', returns5Y: '11.1', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: '14.1', returns3Y: '12.7', returns5Y: '11.4', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: '13.7', returns3Y: '12.3', returns5Y: '11.0', risk: 'Moderate' },
    ]
  },
  silver_fof: {
    conservative: [
      { name: 'ICICI Pru Silver ETF FOF - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Silver', returns1Y: '18.5', returns3Y: '15.2', returns5Y: '12.8', risk: 'High' },
    ],
    moderate: [
      { name: 'Nippon India Silver ETF FOF - Regular (G)', amc: 'Nippon India', category: 'FOF - Silver', returns1Y: '18.2', returns3Y: '15.0', returns5Y: '12.5', risk: 'High' },
    ],
    aggressive: [
      { name: 'Aditya Birla Sun Life Silver ETF FOF - Regular (G)', amc: 'Aditya Birla', category: 'FOF - Silver', returns1Y: '18.8', returns3Y: '15.5', returns5Y: '13.0', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Kotak Silver ETF FOF - Regular (G)', amc: 'Kotak', category: 'FOF - Silver', returns1Y: '19.0', returns3Y: '15.8', returns5Y: '13.2', risk: 'High' },
    ]
  },
  index_fund: {
    conservative: [
      { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large Cap', returns1Y: '13.5', returns3Y: '14.8', returns5Y: '13.8', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Index Fund - Nifty 50 Plan - Regular (G)', amc: 'HDFC', category: 'Index Fund - Large Cap', returns1Y: '13.4', returns3Y: '14.7', returns5Y: '13.7', risk: 'Moderate' },
      { name: 'UTI Nifty Next 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large & Mid Cap', returns1Y: '22.5', returns3Y: '18.2', returns5Y: '15.8', risk: 'High' },
    ],
    aggressive: [
      { name: 'Motilal Oswal Nifty Midcap 150 Index Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Index Fund - Mid Cap', returns1Y: '28.5', returns3Y: '22.8', returns5Y: '18.5', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Nippon India Nifty Smallcap 250 Index Fund - Regular (G)', amc: 'Nippon India', category: 'Index Fund - Small Cap', returns1Y: '32.5', returns3Y: '26.8', returns5Y: '21.5', risk: 'Very High' },
    ]
  },
  international: {
    conservative: [
      { name: 'Motilal Oswal Nasdaq 100 FOF - Regular (G)', amc: 'Motilal Oswal', category: 'FOF - International', returns1Y: '18.5', returns3Y: '16.2', returns5Y: '18.8', risk: 'High' },
    ],
    moderate: [
      { name: 'PGIM India Global Equity Opp Fund - Regular (G)', amc: 'PGIM India', category: 'FOF - International', returns1Y: '22.5', returns3Y: '18.8', returns5Y: '20.2', risk: 'High' },
      { name: 'Franklin India Feeder - Franklin US Opp Fund - Regular (G)', amc: 'Franklin', category: 'FOF - International', returns1Y: '19.2', returns3Y: '17.5', returns5Y: '18.5', risk: 'High' },
    ],
    aggressive: [
      { name: 'Nippon India US Equity Opp Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - International', returns1Y: '24.8', returns3Y: '20.5', returns5Y: '22.0', risk: 'High' },
      { name: 'Kotak Nasdaq 100 FOF - Regular (G)', amc: 'Kotak', category: 'FOF - International', returns1Y: '20.2', returns3Y: '17.8', returns5Y: '19.5', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Edelweiss Greater China Equity Off-shore Fund - Regular (G)', amc: 'Edelweiss', category: 'FOF - International', returns1Y: '28.5', returns3Y: '22.8', returns5Y: '24.5', risk: 'Very High' },
      { name: 'DSP Global Innovation FOF - Regular (G)', amc: 'DSP', category: 'FOF - International', returns1Y: '26.2', returns3Y: '21.5', returns5Y: '23.0', risk: 'Very High' },
    ]
  },
  reit: {
    conservative: [
      { name: 'Embassy Office Parks REIT', amc: 'Embassy Group', category: 'REIT - Office', returns1Y: '8.5', returns3Y: '9.2', returns5Y: '10.5', risk: 'Moderate', productType: 'reit' },
    ],
    moderate: [
      { name: 'Mindspace Business Parks REIT', amc: 'K Raheja Corp', category: 'REIT - Office', returns1Y: '9.2', returns3Y: '10.1', returns5Y: '11.2', risk: 'Moderate', productType: 'reit' },
      { name: 'Brookfield India Real Estate Trust', amc: 'Brookfield', category: 'REIT - Office', returns1Y: '8.8', returns3Y: '9.5', returns5Y: '10.8', risk: 'Moderate', productType: 'reit' },
    ],
    aggressive: [
      { name: 'Nexus Select Trust REIT', amc: 'Blackstone', category: 'REIT - Retail', returns1Y: '10.5', returns3Y: '11.2', returns5Y: '12.5', risk: 'Moderately High', productType: 'reit' },
    ],
    very_aggressive: [
      { name: 'Embassy Office Parks REIT', amc: 'Embassy Group', category: 'REIT - Office', returns1Y: '8.5', returns3Y: '9.2', returns5Y: '10.5', risk: 'Moderate', productType: 'reit' },
    ]
  },
  invit: {
    conservative: [
      { name: 'IndiGrid InvIT', amc: 'IndiGrid', category: 'InvIT - Power Transmission', returns1Y: '10.2', returns3Y: '11.5', returns5Y: '12.0', risk: 'Low', productType: 'invit' },
    ],
    moderate: [
      { name: 'PowerGrid Infrastructure Investment Trust', amc: 'PGCIL', category: 'InvIT - Power Transmission', returns1Y: '11.5', returns3Y: '12.2', returns5Y: '12.8', risk: 'Low', productType: 'invit' },
      { name: 'India Grid Trust', amc: 'Sterlite Power', category: 'InvIT - Power Transmission', returns1Y: '10.8', returns3Y: '11.8', returns5Y: '12.3', risk: 'Low', productType: 'invit' },
    ],
    aggressive: [
      { name: 'IRB InvIT Fund', amc: 'IRB Infrastructure', category: 'InvIT - Roads', returns1Y: '12.5', returns3Y: '13.2', returns5Y: '14.0', risk: 'Moderate', productType: 'invit' },
    ],
    very_aggressive: [
      { name: 'National Highways Infra Trust', amc: 'NHAI', category: 'InvIT - Roads', returns1Y: '11.8', returns3Y: '12.5', returns5Y: '13.2', risk: 'Moderate', productType: 'invit' },
    ]
  },
  bonds: {
    conservative: [
      { name: 'REC Limited NCD - 7.5% 2028', amc: 'REC', category: 'Corporate Bond - PSU', returns1Y: '7.5', returns3Y: '7.5', returns5Y: '7.5', risk: 'Low', productType: 'bond' },
      { name: 'NHAI 54EC Bonds', amc: 'NHAI', category: 'Tax-Free Bond', returns1Y: '5.25', returns3Y: '5.25', returns5Y: '5.25', risk: 'Very Low', productType: 'bond' },
    ],
    moderate: [
      { name: 'PFC Limited NCD - 7.75% 2029', amc: 'PFC', category: 'Corporate Bond - PSU', returns1Y: '7.75', returns3Y: '7.75', returns5Y: '7.75', risk: 'Low', productType: 'bond' },
      { name: 'HDFC Ltd NCD - 8.0% 2027', amc: 'HDFC', category: 'Corporate Bond - NBFC', returns1Y: '8.0', returns3Y: '8.0', returns5Y: '8.0', risk: 'Low', productType: 'bond' },
    ],
    aggressive: [
      { name: 'Tata Capital NCD - 8.25% 2028', amc: 'Tata Capital', category: 'Corporate Bond - NBFC', returns1Y: '8.25', returns3Y: '8.25', returns5Y: '8.25', risk: 'Moderate', productType: 'bond' },
    ],
    very_aggressive: [
      { name: 'Shriram Transport Finance NCD - 9.0% 2027', amc: 'Shriram Transport', category: 'Corporate Bond - NBFC', returns1Y: '9.0', returns3Y: '9.0', returns5Y: '9.0', risk: 'Moderate', productType: 'bond' },
    ]
  },
  mld: {
    conservative: [
      { name: 'HDFC MLD - Principal Protected Nifty Linked', amc: 'HDFC', category: 'MLD - Principal Protected', returns1Y: '9.5', returns3Y: '10.2', returns5Y: '10.8', risk: 'Low', productType: 'mld' },
    ],
    moderate: [
      { name: 'ICICI Securities MLD - Equity Linked', amc: 'ICICI Securities', category: 'MLD - Equity Linked', returns1Y: '11.2', returns3Y: '12.5', returns5Y: '13.0', risk: 'Moderate', productType: 'mld' },
      { name: 'Kotak Mahindra MLD - Multi Asset', amc: 'Kotak', category: 'MLD - Multi Asset', returns1Y: '10.8', returns3Y: '11.8', returns5Y: '12.5', risk: 'Moderate', productType: 'mld' },
    ],
    aggressive: [
      { name: 'JM Financial MLD - Nifty Booster', amc: 'JM Financial', category: 'MLD - Nifty Linked', returns1Y: '13.5', returns3Y: '14.2', returns5Y: '14.8', risk: 'Moderately High', productType: 'mld' },
    ],
    very_aggressive: [
      { name: 'Axis Securities MLD - Aggressive Growth', amc: 'Axis Securities', category: 'MLD - Equity Linked', returns1Y: '15.2', returns3Y: '16.0', returns5Y: '16.5', risk: 'High', productType: 'mld' },
    ]
  },
  pms: {
    conservative: [
      { name: 'HDFC AMC PMS - Balanced', amc: 'HDFC AMC', category: 'PMS - Balanced', returns1Y: '12.5', returns3Y: '14.2', returns5Y: '13.8', risk: 'Moderate', productType: 'pms', minInvestment: 5000000 },
    ],
    moderate: [
      { name: 'Motilal Oswal PMS - Value Strategy', amc: 'Motilal Oswal', category: 'PMS - Value', returns1Y: '18.5', returns3Y: '20.2', returns5Y: '18.8', risk: 'Moderately High', productType: 'pms', minInvestment: 5000000 },
      { name: 'Kotak PMS - Special Situations', amc: 'Kotak', category: 'PMS - Special Situations', returns1Y: '22.5', returns3Y: '24.8', returns5Y: '22.0', risk: 'High', productType: 'pms', minInvestment: 5000000 },
    ],
    aggressive: [
      { name: 'ASK Investment PMS - Growth Portfolio', amc: 'ASK Investment', category: 'PMS - Growth', returns1Y: '25.2', returns3Y: '28.5', returns5Y: '26.0', risk: 'High', productType: 'pms', minInvestment: 5000000 },
    ],
    very_aggressive: [
      { name: 'Marcellus PMS - Consistent Compounders', amc: 'Marcellus', category: 'PMS - Quality', returns1Y: '28.5', returns3Y: '32.0', returns5Y: '30.5', risk: 'High', productType: 'pms', minInvestment: 5000000 },
      { name: 'Alchemy Capital PMS - High Growth', amc: 'Alchemy Capital', category: 'PMS - High Growth', returns1Y: '32.0', returns3Y: '35.5', returns5Y: '33.0', risk: 'Very High', productType: 'pms', minInvestment: 5000000 },
    ]
  },
  aif: {
    conservative: [
      { name: 'ICICI Prudential Credit AIF - Category II', amc: 'ICICI Prudential', category: 'AIF - Credit', returns1Y: '11.5', returns3Y: '12.8', returns5Y: '12.0', risk: 'Moderate', productType: 'aif', minInvestment: 10000000 },
    ],
    moderate: [
      { name: 'Kotak Special Situations AIF - Category II', amc: 'Kotak', category: 'AIF - Special Situations', returns1Y: '16.5', returns3Y: '18.2', returns5Y: '17.5', risk: 'Moderately High', productType: 'aif', minInvestment: 10000000 },
      { name: 'HDFC Ventures AIF - Category II', amc: 'HDFC', category: 'AIF - Growth', returns1Y: '18.2', returns3Y: '20.5', returns5Y: '19.0', risk: 'High', productType: 'aif', minInvestment: 10000000 },
    ],
    aggressive: [
      { name: 'Edelweiss Pre-IPO AIF - Category I', amc: 'Edelweiss', category: 'AIF - Pre-IPO', returns1Y: '25.5', returns3Y: '28.0', returns5Y: '26.5', risk: 'High', productType: 'aif', minInvestment: 10000000 },
    ],
    very_aggressive: [
      { name: 'True North AIF - Category II', amc: 'True North', category: 'AIF - Private Equity', returns1Y: '32.0', returns3Y: '35.5', returns5Y: '34.0', risk: 'Very High', productType: 'aif', minInvestment: 10000000 },
      { name: 'Multiples PE AIF - Category II', amc: 'Multiples', category: 'AIF - Growth Equity', returns1Y: '30.5', returns3Y: '33.8', returns5Y: '32.0', risk: 'Very High', productType: 'aif', minInvestment: 10000000 },
    ]
  },
  listed_stocks: {
    conservative: [
      { name: 'Reliance Industries Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap', returns1Y: '12.5', returns3Y: '18.2', returns5Y: '16.8', risk: 'Moderate', productType: 'stock', ticker: 'RELIANCE' },
      { name: 'HDFC Bank Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Banking', returns1Y: '8.2', returns3Y: '12.5', returns5Y: '11.8', risk: 'Moderate', productType: 'stock', ticker: 'HDFCBANK' },
      { name: 'Tata Consultancy Services Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap IT', returns1Y: '15.5', returns3Y: '14.8', returns5Y: '18.2', risk: 'Moderate', productType: 'stock', ticker: 'TCS' },
    ],
    moderate: [
      { name: 'Infosys Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap IT', returns1Y: '14.2', returns3Y: '16.5', returns5Y: '17.8', risk: 'Moderate', productType: 'stock', ticker: 'INFY' },
      { name: 'ICICI Bank Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Banking', returns1Y: '18.5', returns3Y: '22.8', returns5Y: '20.5', risk: 'Moderate', productType: 'stock', ticker: 'ICICIBANK' },
      { name: 'Bharti Airtel Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Telecom', returns1Y: '35.2', returns3Y: '28.5', returns5Y: '22.0', risk: 'Moderately High', productType: 'stock', ticker: 'BHARTIARTL' },
      { name: 'Larsen & Toubro Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Infrastructure', returns1Y: '25.8', returns3Y: '32.5', returns5Y: '28.0', risk: 'Moderately High', productType: 'stock', ticker: 'LT' },
    ],
    aggressive: [
      { name: 'Bajaj Finance Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap NBFC', returns1Y: '22.5', returns3Y: '28.2', returns5Y: '32.5', risk: 'High', productType: 'stock', ticker: 'BAJFINANCE' },
      { name: 'Tata Motors Ltd', amc: 'NSE/BSE', category: 'Stock - Large Cap Auto', returns1Y: '45.2', returns3Y: '52.8', returns5Y: '35.0', risk: 'High', productType: 'stock', ticker: 'TATAMOTORS' },
      { name: 'SBI Cards Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap Financial', returns1Y: '18.5', returns3Y: '22.0', returns5Y: '24.5', risk: 'High', productType: 'stock', ticker: 'SBICARD' },
      { name: 'Persistent Systems Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap IT', returns1Y: '38.5', returns3Y: '45.2', returns5Y: '42.0', risk: 'High', productType: 'stock', ticker: 'PERSISTENT' },
    ],
    very_aggressive: [
      { name: 'Zomato Ltd', amc: 'NSE/BSE', category: 'Stock - New Age Tech', returns1Y: '85.2', returns3Y: '45.0', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'ZOMATO' },
      { name: 'Paytm (One97 Communications)', amc: 'NSE/BSE', category: 'Stock - Fintech', returns1Y: '-25.5', returns3Y: '-15.0', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'PAYTM' },
      { name: 'Tata Elxsi Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap IT Services', returns1Y: '28.5', returns3Y: '48.2', returns5Y: '55.0', risk: 'Very High', productType: 'stock', ticker: 'TATAELXSI' },
      { name: 'Dixon Technologies Ltd', amc: 'NSE/BSE', category: 'Stock - Mid Cap Electronics', returns1Y: '65.2', returns3Y: '72.5', returns5Y: '85.0', risk: 'Very High', productType: 'stock', ticker: 'DIXON' },
      { name: 'Happiest Minds Technologies', amc: 'NSE/BSE', category: 'Stock - Small Cap IT', returns1Y: '32.5', returns3Y: '38.0', returns5Y: 'N/A', risk: 'Very High', productType: 'stock', ticker: 'HAPPSTMNDS' },
    ]
  },
  unlisted_stocks: {
    conservative: [
      { name: 'NSE India Ltd', amc: 'Unlisted', category: 'Unlisted - Exchange', returns1Y: '18.5', returns3Y: '22.0', returns5Y: '25.5', risk: 'Moderate', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    moderate: [
      { name: 'HDB Financial Services Ltd', amc: 'Unlisted', category: 'Unlisted - NBFC', returns1Y: '15.2', returns3Y: '18.5', returns5Y: '20.0', risk: 'Moderate', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Tata Technologies Ltd', amc: 'Unlisted', category: 'Unlisted - Engineering', returns1Y: '25.5', returns3Y: '28.0', returns5Y: '32.5', risk: 'Moderately High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    aggressive: [
      { name: 'Swiggy (Bundl Technologies)', amc: 'Unlisted', category: 'Unlisted - Food Tech', returns1Y: '35.2', returns3Y: '42.0', returns5Y: '48.5', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'PhonePe (PhonePe Pvt Ltd)', amc: 'Unlisted', category: 'Unlisted - Fintech', returns1Y: '28.5', returns3Y: '35.0', returns5Y: '42.0', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Lenskart Solutions Pvt Ltd', amc: 'Unlisted', category: 'Unlisted - E-commerce', returns1Y: '32.0', returns3Y: '38.5', returns5Y: '45.0', risk: 'High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ],
    very_aggressive: [
      { name: 'OfBusiness (OFB Tech Pvt Ltd)', amc: 'Unlisted', category: 'Unlisted - B2B Commerce', returns1Y: '42.5', returns3Y: '55.0', returns5Y: '65.0', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Pine Labs Pvt Ltd', amc: 'Unlisted', category: 'Unlisted - Payment Tech', returns1Y: '38.2', returns3Y: '48.5', returns5Y: '58.0', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'Pharmeasy (API Holdings)', amc: 'Unlisted', category: 'Unlisted - Health Tech', returns1Y: '-15.0', returns3Y: '25.0', returns5Y: '35.0', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
      { name: 'ixigo (Le Travenues Technology)', amc: 'Unlisted', category: 'Unlisted - Travel Tech', returns1Y: '45.0', returns3Y: '52.0', returns5Y: '48.5', risk: 'Very High', productType: 'unlisted_stock', requiresEnhancedKYC: true },
    ]
  }
};

// Legacy format for backward compatibility
const REAL_FUND_RECOMMENDATIONS = {
  conservative: [
    { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: '11.8', returns3Y: '13.5', returns5Y: '13.1', risk: 'Moderate' },
    { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt', returns1Y: '7.2', returns3Y: '7.6', returns5Y: '7.9', risk: 'Low' },
    { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: '6.8', returns3Y: '7.2', returns5Y: '7.5', risk: 'Low' },
    { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt', returns1Y: '7.0', returns3Y: '7.4', returns5Y: '7.5', risk: 'Low' },
    { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: '14.2', returns3Y: '12.8', returns5Y: '11.5', risk: 'Moderate' },
  ],
  moderate: [
    { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: '17.2', returns3Y: '18.8', returns5Y: '18.5', risk: 'Moderately High' },
    { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
    { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: '21.2', returns3Y: '22.8', returns5Y: '20.5', risk: 'High' },
    { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: '14.0', returns3Y: '14.8', returns5Y: '13.5', risk: 'Moderate' },
    { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: '7.1', returns3Y: '7.5', returns5Y: '7.8', risk: 'Low' },
    { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: '14.0', returns3Y: '12.6', returns5Y: '11.3', risk: 'Moderate' },
  ],
  aggressive: [
    { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: '27.2', returns3Y: '33.5', returns5Y: '30.8', risk: 'Very High' },
    { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: '25.5', returns3Y: '31.2', returns5Y: '27.5', risk: 'Very High' },
    { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: '19.2', returns3Y: '21.5', returns5Y: '20.2', risk: 'High' },
    { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: '15.8', returns3Y: '17.2', returns5Y: '16.1', risk: 'Moderately High' },
    { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund', returns1Y: '13.5', returns3Y: '14.8', returns5Y: '13.8', risk: 'Moderate' },
    { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: '14.1', returns3Y: '12.7', returns5Y: '11.4', risk: 'Moderate' },
  ],
  very_aggressive: [
    { name: 'Quant Active Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: '31.2', returns3Y: '36.5', returns5Y: '34.2', risk: 'Very High' },
    { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: '28.8', returns3Y: '34.8', returns5Y: '31.5', risk: 'Very High' },
    { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: '27.5', returns3Y: '32.8', returns5Y: '29.2', risk: 'Very High' },
    { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: '23.2', returns3Y: '27.5', returns5Y: '24.0', risk: 'High' },
    { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: '21.2', returns3Y: '24.8', returns5Y: '23.5', risk: 'Very High' },
    { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: '13.7', returns3Y: '12.3', returns5Y: '11.0', risk: 'Moderate' },
  ]
};

// Product categories available for agent selection
export const PRODUCT_CATEGORIES = [
  { id: 'equity', label: 'Equity Mutual Funds', description: 'Large cap, mid cap, small cap, flexi cap funds' },
  { id: 'debt', label: 'Debt Mutual Funds', description: 'Corporate bonds, government securities, short duration' },
  { id: 'hybrid', label: 'Hybrid Funds', description: 'Balanced advantage, aggressive hybrid, multi-asset' },
  { id: 'gold_fof', label: 'Gold FOF', description: 'Gold Fund of Funds for portfolio hedging' },
  { id: 'silver_fof', label: 'Silver FOF', description: 'Silver ETF Fund of Funds' },
  { id: 'index_fund', label: 'Index Funds', description: 'Passive funds tracking Nifty, Sensex indices' },
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

// Target allocations by risk profile (expanded with new asset classes including stocks)
const TARGET_ALLOCATIONS = {
  conservative: { equity: 18, debt: 32, hybrid: 15, gold: 8, silver: 0, index: 5, international: 2, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 5, unlisted_stocks: 0, pms: 0, aif: 0 },
  moderate: { equity: 25, debt: 18, hybrid: 10, gold: 7, silver: 0, index: 8, international: 5, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 8, unlisted_stocks: 2, pms: 0, aif: 0 },
  aggressive: { equity: 32, debt: 6, hybrid: 6, gold: 5, silver: 2, index: 8, international: 7, reit: 5, invit: 5, bonds: 4, mld: 2, listed_stocks: 12, unlisted_stocks: 6, pms: 0, aif: 0 },
  very_aggressive: { equity: 30, debt: 4, hybrid: 4, gold: 4, silver: 2, index: 8, international: 8, reit: 4, invit: 4, bonds: 4, mld: 3, listed_stocks: 15, unlisted_stocks: 10, pms: 0, aif: 0 }
};

export interface ProspectPortfolioHolding {
  productType: string;
  productName: string;
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  isin?: string;
  category?: string;
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
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
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
    await db.update(prospectClients)
      .set({ 
        currentPortfolio: holdings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));
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
  }

  analyzePortfolio(holdings: ProspectPortfolioHolding[], riskProfile: ProspectRiskProfile): PortfolioAnalysis {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    
    const assetAllocation: Record<string, { value: number; percentage: number }> = {};
    holdings.forEach(h => {
      if (!assetAllocation[h.productType]) {
        assetAllocation[h.productType] = { value: 0, percentage: 0 };
      }
      assetAllocation[h.productType].value += h.currentValue;
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

    const sortedByValue = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
    
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
      const category = (h.category || h.productType || '').toLowerCase();
      // Asset class volatility estimates (annualized)
      let assetVolatility = 15; // default
      if (category.includes('small') || category.includes('micro')) assetVolatility = 28;
      else if (category.includes('mid')) assetVolatility = 22;
      else if (category.includes('large') || category.includes('blue')) assetVolatility = 16;
      else if (category.includes('debt') || category.includes('bond')) assetVolatility = 5;
      else if (category.includes('gold') || category.includes('silver')) assetVolatility = 18;
      else if (category.includes('hybrid')) assetVolatility = 12;
      else if (category.includes('liquid') || category.includes('money')) assetVolatility = 2;
      
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
      const category = (h.category || h.productType || '').toLowerCase();
      // Asset class beta estimates
      let assetBeta = 1.0;
      if (category.includes('small')) assetBeta = 1.3;
      else if (category.includes('mid')) assetBeta = 1.15;
      else if (category.includes('large')) assetBeta = 0.95;
      else if (category.includes('debt') || category.includes('bond')) assetBeta = 0.15;
      else if (category.includes('gold')) assetBeta = 0.0; // Gold has near-zero correlation
      else if (category.includes('silver')) assetBeta = 0.1;
      else if (category.includes('hybrid')) assetBeta = 0.65;
      else if (category.includes('index')) assetBeta = 1.0;
      
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
      const category = (h.category || h.productType || '').toLowerCase();
      
      if (category.includes('equity') || category.includes('small') || category.includes('mid') || 
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
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const volatility = this.calculateVolatility(holdings);
    const beta = this.calculateBeta(holdings);
    const alpha = this.calculateAlpha(expectedReturn, beta);
    const sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility);
    const treynorRatio = this.calculateTreynorRatio(expectedReturn, beta);
    const sortinoRatio = this.calculateSortinoRatio(expectedReturn, holdings);
    const informationRatio = this.calculateInformationRatio(expectedReturn, 12, beta);
    const maxDrawdown = this.calculateMaxDrawdown(beta, volatility);
    const assetAllocation = this.calculateAssetAllocationBreakdown(holdings);
    
    const numAssetClasses = Object.values(assetAllocation).filter(v => v > 5).length;
    const diversificationScore = Math.min(100, numAssetClasses * 15 + holdings.length * 3 + 20);
    
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

  generatePortfolioComparison(
    holdings: ProspectPortfolioHolding[],
    freshInvestments: FreshInvestmentSuggestion[],
    riskProfile: ProspectRiskProfile
  ): PortfolioComparison {
    // Calculate current portfolio expected return based on category
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    let currentExpectedReturn = 10; // Default assumption
    
    // Estimate based on asset mix
    holdings.forEach(h => {
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
    
    const currentMetrics = this.calculatePortfolioMetrics(holdings, currentExpectedReturn);
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

  generateRebalancingRecommendations(
    holdings: ProspectPortfolioHolding[], 
    riskProfile: ProspectRiskProfile,
    analysis: PortfolioAnalysis,
    customAllocations?: { 
      equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number;
      international?: number; reit?: number; invit?: number; bonds?: number; mld?: number; pms?: number; aif?: number;
    },
    freshInvestmentAmount: number = 0
  ): RebalanceRecommendation[] {
    const recommendations: RebalanceRecommendation[] = [];
    const totalValue = analysis.totalValue;
    
    if (totalValue === 0) {
      return recommendations;
    }
    
    // Default allocations by risk profile (expanded with new asset classes)
    const defaultAllocations: Record<string, { 
      equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number;
      international: number; reit: number; invit: number; bonds: number; mld: number; pms: number; aif: number;
    }> = {
      conservative: { equity: 20, debt: 35, hybrid: 15, gold: 8, silver: 0, index: 5, international: 2, reit: 5, invit: 5, bonds: 5, mld: 0, pms: 0, aif: 0 },
      moderate: { equity: 30, debt: 20, hybrid: 12, gold: 8, silver: 0, index: 8, international: 5, reit: 5, invit: 5, bonds: 5, mld: 2, pms: 0, aif: 0 },
      aggressive: { equity: 40, debt: 8, hybrid: 8, gold: 6, silver: 3, index: 10, international: 8, reit: 5, invit: 5, bonds: 4, mld: 3, pms: 0, aif: 0 },
      very_aggressive: { equity: 45, debt: 5, hybrid: 5, gold: 5, silver: 3, index: 10, international: 10, reit: 5, invit: 5, bonds: 4, mld: 3, pms: 0, aif: 0 }
    };
    
    // Use custom allocations if provided
    const targetAllocations = customAllocations && 
      (customAllocations.equity > 0 || customAllocations.debt > 0 || customAllocations.hybrid > 0)
      ? { ...defaultAllocations.moderate, ...customAllocations }
      : defaultAllocations[riskProfile.riskTolerance] || defaultAllocations.moderate;
    
    console.log('[Rebalancing] Target allocations:', JSON.stringify(targetAllocations));
    console.log('[Rebalancing] Current portfolio value:', totalValue);
    
    // Map holdings to asset categories (expanded)
    const categorizeHolding = (h: ProspectPortfolioHolding): string => {
      const type = h.productType?.toLowerCase() || '';
      const name = h.productName?.toLowerCase() || '';
      const category = h.category?.toLowerCase() || '';
      
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
    
    // Calculate current allocation by category (expanded)
    const currentByCategory: Record<string, { value: number; holdings: ProspectPortfolioHolding[] }> = {
      equity: { value: 0, holdings: [] },
      debt: { value: 0, holdings: [] },
      hybrid: { value: 0, holdings: [] },
      gold: { value: 0, holdings: [] },
      silver: { value: 0, holdings: [] },
      index: { value: 0, holdings: [] },
      international: { value: 0, holdings: [] },
      reit: { value: 0, holdings: [] },
      invit: { value: 0, holdings: [] },
      bonds: { value: 0, holdings: [] },
      mld: { value: 0, holdings: [] },
      pms: { value: 0, holdings: [] },
      aif: { value: 0, holdings: [] },
      others: { value: 0, holdings: [] }
    };
    
    holdings.forEach(h => {
      const category = categorizeHolding(h);
      if (!currentByCategory[category]) {
        currentByCategory[category] = { value: 0, holdings: [] };
      }
      currentByCategory[category].value += h.currentValue;
      currentByCategory[category].holdings.push(h);
    });
    
    console.log('[Rebalancing] Current by category:', Object.entries(currentByCategory).map(([k, v]) => `${k}: ${v.value}`).join(', '));
    
    // Calculate total portfolio after fresh investment
    const totalPortfolioValue = totalValue + freshInvestmentAmount;
    
    // Calculate target values and compare with current (expanded categories including stocks)
    const categories = ['equity', 'debt', 'hybrid', 'gold', 'silver', 'index', 'international', 'reit', 'invit', 'bonds', 'mld', 'listed_stocks', 'unlisted_stocks', 'pms', 'aif'];
    
    categories.forEach(category => {
      const targetPercent = targetAllocations[category as keyof typeof targetAllocations] || 0;
      const targetValue = (targetPercent / 100) * totalPortfolioValue;
      const currentValue = currentByCategory[category]?.value || 0;
      const currentPercent = (currentValue / totalValue) * 100;
      
      const difference = currentValue - targetValue;
      const percentDiff = currentPercent - targetPercent;
      
      // Only generate sell if overweight by more than 5% AND the excess is significant (>5000)
      if (percentDiff > 5 && difference > 5000) {
        const holdingsToSell = currentByCategory[category]?.holdings || [];
        
        // Sort by value (largest first) for selling
        holdingsToSell.sort((a, b) => b.currentValue - a.currentValue);
        
        let remainingToSell = difference;
        
        holdingsToSell.forEach(holding => {
          if (remainingToSell <= 0) return;
          
          // Don't sell more than the holding value or what we need
          const sellAmount = Math.min(holding.currentValue, remainingToSell);
          
          // Only suggest sell if it's a meaningful amount (>1000)
          if (sellAmount > 1000) {
            const isPartialSell = sellAmount < holding.currentValue;
            
            recommendations.push({
              action: 'SELL',
              productType: holding.productType,
              productName: holding.productName,
              currentValue: holding.currentValue,
              suggestedValue: isPartialSell ? holding.currentValue - sellAmount : 0,
              changeAmount: -sellAmount,
              rationale: `Reduce ${category} allocation from ${currentPercent.toFixed(1)}% to target ${targetPercent}%. ${isPartialSell ? 'Partial redemption recommended.' : 'Full redemption recommended.'}`,
              priority: percentDiff > 15 ? 'high' : 'medium',
              taxImplications: category === 'equity' ? 'LTCG tax @12.5% if held >1 year, STCG @20% otherwise' : 
                              category === 'debt' ? 'Taxed as per income slab' : undefined
            });
            
            remainingToSell -= sellAmount;
          }
        });
      }
    });
    
    // Handle non-standard/illiquid assets
    holdings.forEach(h => {
      const type = h.productType?.toLowerCase() || '';
      if (!['equity', 'mutual_fund', 'mf', 'bond', 'fd', 'gold', 'etf', 'stock', 'debt'].includes(type)) {
        // Check if we already have a recommendation for this holding
        const existing = recommendations.find(r => r.productName === h.productName);
        if (!existing && h.currentValue > 1000) {
          recommendations.push({
            action: 'SELL',
            productType: h.productType,
            productName: h.productName,
            currentValue: h.currentValue,
            changeAmount: -h.currentValue,
            rationale: 'Consider switching to regulated products (mutual funds, bonds) for better liquidity, transparency, and professional management.',
            priority: 'low',
            taxImplications: 'Tax treatment depends on holding period and asset type'
          });
        }
      }
    });
    
    // Add SWITCH recommendations for underperformers (if analysis has them)
    if (analysis.underperformers && analysis.underperformers.length > 0) {
      analysis.underperformers.slice(0, 3).forEach(underperformer => {
        // Check if not already in recommendations
        const existing = recommendations.find(r => r.productName === underperformer.productName);
        if (!existing && underperformer.currentValue > 5000) {
          // Find a better performing fund in the same category
          const category = categorizeHolding(underperformer);
          const targetFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile.riskTolerance] || 
                             (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
          const targetFund = targetFunds[0];
          
          recommendations.push({
            action: 'SWITCH',
            productType: underperformer.productType,
            productName: underperformer.productName,
            currentValue: underperformer.currentValue,
            suggestedValue: underperformer.currentValue, // Switch maintains the value
            changeAmount: 0, // Net zero - switch is value-neutral
            switchAmount: underperformer.currentValue, // Track actual switch value for display
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
            priority: 'medium'
          });
        }
      });
    }
    
    // Add BUY recommendations for underweight categories using freed capital from sells
    const totalSellAmount = recommendations
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    // Add BUY recommendations for underweight categories using freed capital from sells
    // Only if we have meaningful sell proceeds (>2000)
    if (totalSellAmount > 2000) {
      // Find underweight categories
      const underweightCategories: { category: string; gap: number; targetPercent: number }[] = [];
      
      categories.forEach(category => {
        const targetPercent = targetAllocations[category as keyof typeof targetAllocations] || 0;
        const currentValue = currentByCategory[category]?.value || 0;
        const currentPercent = (currentValue / totalValue) * 100;
        const gap = targetPercent - currentPercent;
        
        // Only add if underweight by more than 2%
        if (gap > 2 && targetPercent > 0) {
          underweightCategories.push({ category, gap, targetPercent });
        }
      });
      
      // Sort by gap (largest first) and allocate sell proceeds
      underweightCategories.sort((a, b) => b.gap - a.gap);
      
      let remainingToAllocate = totalSellAmount;
      const numCategoriesToFund = Math.min(underweightCategories.length, 3);
      
      // Ensure at least one category gets funded if we have underweight categories
      underweightCategories.slice(0, numCategoriesToFund).forEach(({ category, gap, targetPercent }, index) => {
        if (remainingToAllocate <= 1000) return; // Lower threshold to ensure deployment
        
        // Allocate proportionally to gap
        const totalGap = underweightCategories.slice(0, numCategoriesToFund).reduce((sum, c) => sum + c.gap, 0);
        const proportion = totalGap > 0 ? gap / totalGap : 1 / numCategoriesToFund;
        const buyAmount = Math.round(totalSellAmount * proportion);
        const actualAmount = Math.min(buyAmount, remainingToAllocate);
        
        // Lower minimum threshold to ₹2000 to ensure funds get allocated
        if (actualAmount < 2000) return;
        
        // Get recommended fund for this category
        const categoryFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile.riskTolerance] ||
                             (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
        const fundToRecommend = categoryFunds[0];
        
        if (fundToRecommend) {
          recommendations.push({
            action: 'BUY',
            productType: fundToRecommend.productType || 'mutual_fund',
            productName: fundToRecommend.name,
            suggestedValue: actualAmount,
            changeAmount: actualAmount,
            rationale: `Deploy ${formatAmount(actualAmount)} from rebalancing into ${fundToRecommend.category}. ${fundToRecommend.name} offers ${fundToRecommend.returns3Y}% 3-year returns with ${fundToRecommend.risk} risk, helping achieve target ${targetPercent}% ${category} allocation.`,
            priority: gap > 10 ? 'high' : 'medium'
          });
          
          remainingToAllocate -= actualAmount;
        }
      });
    }
    
    console.log('[Rebalancing] Generated', recommendations.length, 'recommendations:', 
      recommendations.map(r => `${r.action}: ${r.productName} (${r.changeAmount})`).join(', '));

    return recommendations;
  }

  async generateFreshInvestmentSuggestions(
    riskProfile: ProspectRiskProfile,
    investmentAmount: number,
    existingHoldings: ProspectPortfolioHolding[],
    customAllocations?: { 
      equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number;
      international?: number; reit?: number; invit?: number; bonds?: number; mld?: number;
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
    
    // Default allocations based on risk profile (expanded with stocks)
    const defaultAllocations: Record<string, { 
      equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number;
      international: number; reit: number; invit: number; bonds: number; mld: number; 
      listed_stocks: number; unlisted_stocks: number; pms: number; aif: number;
    }> = {
      conservative: { equity: 18, debt: 32, hybrid: 15, gold: 8, silver: 0, index: 5, international: 2, reit: 5, invit: 5, bonds: 5, mld: 0, listed_stocks: 5, unlisted_stocks: 0, pms: 0, aif: 0 },
      moderate: { equity: 25, debt: 18, hybrid: 10, gold: 7, silver: 0, index: 8, international: 5, reit: 5, invit: 5, bonds: 5, mld: 2, listed_stocks: 8, unlisted_stocks: 2, pms: 0, aif: 0 },
      aggressive: { equity: 32, debt: 6, hybrid: 6, gold: 5, silver: 2, index: 8, international: 7, reit: 5, invit: 5, bonds: 4, mld: 2, listed_stocks: 12, unlisted_stocks: 6, pms: 0, aif: 0 },
      very_aggressive: { equity: 30, debt: 4, hybrid: 4, gold: 4, silver: 2, index: 8, international: 8, reit: 4, invit: 4, bonds: 4, mld: 3, listed_stocks: 15, unlisted_stocks: 10, pms: 0, aif: 0 }
    };
    
    // Use custom allocations if provided and has non-zero values, otherwise use defaults
    const hasValidCustomAllocations = customAllocations && 
      (customAllocations.equity > 0 || customAllocations.debt > 0 || customAllocations.hybrid > 0 || 
       customAllocations.gold > 0 || (customAllocations.silver || 0) > 0 || (customAllocations.index || 0) > 0 ||
       (customAllocations.international || 0) > 0 || (customAllocations.reit || 0) > 0 || (customAllocations.invit || 0) > 0 ||
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
    
    // Map allocation keys to category keys (expanded with stocks)
    const allocationToCategory: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold: 'gold_fof',
      silver: 'silver_fof',
      index: 'index_fund',
      international: 'international',
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
      international: 'international',
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
      
      const categoryFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile.riskTolerance] || 
                            (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
      
      if (categoryFunds.length === 0) continue;
      
      // Calculate amount for this category
      const categoryAmount = Math.round((allocation / 100) * investmentAmount);
      
      // Distribute among funds in this category
      const fundsToUse = categoryFunds.slice(0, 2); // Max 2 funds per category
      const amountPerFund = Math.round(categoryAmount / fundsToUse.length);
      
      fundsToUse.forEach((fund: any, index: number) => {
        const fundAmount = index === fundsToUse.length - 1 
          ? categoryAmount - (amountPerFund * index) // Last fund gets remainder
          : amountPerFund;
        
        if (fundAmount <= 0) return;
        
        suggestions.push({
          productType: 'mutual_fund',
          productName: fund.name,
          suggestedAmount: fundAmount,
          expectedReturn: `${fund.returns3Y}%`,
          riskLevel: fund.risk.toLowerCase(),
          matchScore: matchScoreCounter--,
          rationale: `Recommended ${fund.category} fund from ${fund.amc} with strong ${fund.returns3Y}% 3-year returns. Suitable for ${riskProfile.investmentHorizon.replace('_', ' ')} horizon.`,
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
          selectionReason: `Selected based on ${riskProfile.riskTolerance} risk profile, ${allocation}% ${category} allocation, and ${fund.returns3Y}% historical 3-year CAGR performance.`
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
        
        // Try to get funds from this category for any risk level
        const categoryData = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category];
        if (!categoryData) continue;
        
        // Try current risk profile first, then fallback to any available
        const riskLevels = [riskProfile.riskTolerance, 'moderate', 'conservative', 'aggressive', 'very_aggressive'];
        let fundsToUse: any[] = [];
        
        for (const risk of riskLevels) {
          if (categoryData[risk] && categoryData[risk].length > 0) {
            fundsToUse = categoryData[risk].slice(0, 2);
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
    globalAdvisorySelections?: Record<string, string[]>
  ): Promise<CombinedProposal> {
    const analysis = this.analyzePortfolio(holdings, riskProfile);
    const rebalancing = this.generateRebalancingRecommendations(
      holdings, 
      riskProfile, 
      analysis,
      customAllocations,
      freshInvestmentAmount
    );
    
    // Calculate sell proceeds and how much was already allocated to rebalancing BUY recommendations
    const sellProceeds = rebalancing
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    const rebalancingBuyAllocated = rebalancing
      .filter(r => r.action === 'BUY')
      .reduce((sum, r) => sum + r.changeAmount, 0);
    
    // Only include UNALLOCATED sell proceeds in fresh investment budget
    // Rebalancing BUY recommendations already consumed part of the sell proceeds
    const remainingSellProceeds = Math.max(0, sellProceeds - rebalancingBuyAllocated);
    const totalDeployableAmount = freshInvestmentAmount + remainingSellProceeds;
    
    console.log(`[Proposal] Fresh: ${freshInvestmentAmount}, Sell proceeds: ${sellProceeds}, Rebalancing BUYs: ${rebalancingBuyAllocated}, Remaining: ${remainingSellProceeds}, Total deployable: ${totalDeployableAmount}`);
    
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
    
    const totalBuyAmount = freshInvestments.reduce((sum, s) => sum + s.suggestedAmount, 0) +
      rebalancing.filter(r => r.action === 'BUY').reduce((sum, r) => sum + r.changeAmount, 0);
    
    const netInvestmentRequired = totalBuyAmount - totalSellAmount;
    
    // Calculate weighted average return based on recommendations
    const avgReturn = this.calculateWeightedReturn(freshInvestments, riskProfile);
    const years = riskProfile.investmentHorizon === 'short_term' ? 3 : 
                  riskProfile.investmentHorizon === 'medium_term' ? 5 : 10;
    const projectedValue = (analysis.totalValue + netInvestmentRequired) * Math.pow(1 + avgReturn/100, years);

    const shareToken = nanoid(12);
    
    // Get target allocation based on risk profile
    const targetAllocation = TARGET_ALLOCATIONS[riskProfile.riskTolerance] || TARGET_ALLOCATIONS.moderate;
    
    // Generate portfolio comparison with risk-adjusted metrics
    const portfolioComparison = holdings.length > 0 && freshInvestments.length > 0
      ? this.generatePortfolioComparison(holdings, freshInvestments, riskProfile)
      : undefined;
    
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
      currentAnalysis: JSON.stringify({ ...analysis, portfolioComparison }),
      recommendations: [...rebalancing, ...freshInvestments],
      totalInvestmentAmount: String(netInvestmentRequired),
      projectedValue: String(Math.round(projectedValue)),
      projectedReturns: String(avgReturn),
      riskProfile: riskProfile.riskTolerance,
      investmentGoals: { 
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
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, freshInvestments, riskProfile, globalAdvisorySelections),
      status: 'draft',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      viewCount: 0
    }).returning();

    await db.insert(prospectProposalEvents).values({
      proposalId: proposal.id,
      eventType: 'created',
      eventData: { prospectId, agentId }
    });

    return {
      prospectId,
      proposalId: proposal.id,
      shareToken,
      analysis,
      rebalancing,
      freshInvestments,
      totalSellAmount,
      totalBuyAmount,
      netInvestmentRequired,
      projectedValue: Math.round(projectedValue),
      projectedReturn: `${avgReturn}% p.a.`,
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, freshInvestments, riskProfile, globalAdvisorySelections),
      portfolioComparison
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
    const buyCount = rebalancing.filter(r => r.action === 'BUY').length;
    
    let summary = `Based on your ${riskProfile.riskTolerance} risk profile and ${riskProfile.investmentHorizon.replace('_', ' ')} investment horizon, ` +
      `we have analyzed your portfolio worth ₹${(analysis.totalValue / 100000).toFixed(1)}L. ` +
      `Your current diversification score is ${analysis.diversificationScore}/100 with a risk score of ${analysis.riskScore}/100. ` +
      `We recommend ${sellCount > 0 ? `rebalancing ${sellCount} positions` : 'no immediate rebalancing'} ` +
      `and ${freshInvestments.length} fresh investment opportunities aligned with your ${riskProfile.primaryGoal} goal.`;
    
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
