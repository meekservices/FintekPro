export const ASSET_TYPES = {
  EQUITY: 'equity',
  DEBT: 'debt',
  GOLD: 'gold',
  REAL_ESTATE: 'real_estate',
  ALTERNATIVE: 'alternative',
} as const;

export const ASSET_TYPE_LABELS = {
  [ASSET_TYPES.EQUITY]: 'Equity',
  [ASSET_TYPES.DEBT]: 'Debt',
  [ASSET_TYPES.GOLD]: 'Gold',
  [ASSET_TYPES.REAL_ESTATE]: 'Real Estate',
  [ASSET_TYPES.ALTERNATIVE]: 'Alternative',
} as const;

export const ASSET_COLORS = {
  [ASSET_TYPES.EQUITY]: '#3b82f6',
  [ASSET_TYPES.DEBT]: '#10b981',
  [ASSET_TYPES.GOLD]: '#f59e0b',
  [ASSET_TYPES.REAL_ESTATE]: '#ef4444',
  [ASSET_TYPES.ALTERNATIVE]: '#8b5cf6',
} as const;

export const GLOBAL_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
  { symbol: '^IXIC', name: 'NASDAQ', region: 'US' },
  { symbol: '^DJI', name: 'Dow Jones', region: 'US' },
  { symbol: '^NSEI', name: 'Nifty 50', region: 'India' },
  { symbol: '^BSESN', name: 'BSE Sensex', region: 'India' },
  { symbol: '^N225', name: 'Nikkei 225', region: 'Japan' },
  { symbol: '^HSI', name: 'Hang Seng', region: 'Hong Kong' },
  { symbol: '^FTSE', name: 'FTSE 100', region: 'UK' },
  { symbol: '^GDAXI', name: 'DAX', region: 'Germany' },
  { symbol: '^FCHI', name: 'CAC 40', region: 'France' },
] as const;

export const RISK_PROFILES = {
  CONSERVATIVE: {
    name: 'Conservative',
    equity: 40,
    debt: 50,
    gold: 5,
    alternative: 5,
    color: '#10b981'
  },
  MODERATE: {
    name: 'Moderate',
    equity: 65,
    debt: 25,
    gold: 5,
    alternative: 5,
    color: '#3b82f6'
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    equity: 80,
    debt: 15,
    gold: 3,
    alternative: 2,
    color: '#ef4444'
  }
} as const;

export const FINANCIAL_SERVICES = [
  {
    id: 'unlisted-shares',
    name: 'Unlisted Shares',
    description: 'Invest in pre-IPO companies and high-growth startups',
    icon: 'fas fa-chart-line',
    color: 'blue',
    stats: ['Available: 245+ companies', 'Min Investment: ₹50,000'],
    cta: 'Explore →'
  },
  {
    id: 'ipo',
    name: 'IPO',
    description: 'Apply for upcoming IPOs and track live applications',
    icon: 'fas fa-bullhorn',
    color: 'green',
    stats: ['Upcoming: 8 IPOs', 'This Month: ₹15,000Cr'],
    cta: 'View IPOs →'
  },
  {
    id: 'mutual-funds',
    name: 'Mutual Funds',
    description: 'Direct mutual funds with zero commission',
    icon: 'fas fa-coins',
    color: 'purple',
    stats: ['Funds: 2000+', 'SIP from: ₹500'],
    cta: 'Start SIP →'
  },
  {
    id: 'bonds',
    name: 'Bonds & NCDs',
    description: 'Fixed income investments with guaranteed returns',
    icon: 'fas fa-certificate',
    color: 'yellow',
    stats: ['Yield: 7-12% p.a.', 'Min: ₹10,000'],
    cta: 'Browse →'
  },
  {
    id: 'pms',
    name: 'PMS',
    description: 'Portfolio Management Services by experts',
    icon: 'fas fa-user-tie',
    color: 'indigo',
    stats: ['Min: ₹50 Lakhs', 'Managers: 25+'],
    cta: 'Learn More →'
  },
  {
    id: 'aif',
    name: 'AIF',
    description: 'Alternative Investment Funds for HNI clients',
    icon: 'fas fa-landmark',
    color: 'red',
    stats: ['Min: ₹1 Crore', 'Funds: 150+'],
    cta: 'Explore →'
  },
  {
    id: 'loans',
    name: 'Personal Loans',
    description: 'Quick personal loans at competitive rates',
    icon: 'fas fa-hand-holding-usd',
    color: 'teal',
    stats: ['Rate: 10.5% onwards', 'Up to: ₹40 Lakhs'],
    cta: 'Apply →'
  },
  {
    id: 'sme-funding',
    name: 'SME Funding',
    description: 'Business loans and project funding solutions',
    icon: 'fas fa-building',
    color: 'orange',
    stats: ['Up to: ₹50 Crores', 'Rate: 9.5% onwards'],
    cta: 'Get Quote →'
  }
] as const;
