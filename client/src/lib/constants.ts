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
    id: 'markets',
    name: 'Live Market Data',
    description: 'Real-time stock prices, global indices and market data',
    icon: 'fas fa-chart-line',
    color: 'blue',
    stats: ['Global stocks', 'Real-time quotes', 'Market news'],
    cta: 'View Markets →'
  },
  {
    id: 'portfolio',
    name: 'Portfolio Manager',
    description: 'Track, analyze, and optimize your investment portfolio',
    icon: 'fas fa-briefcase',
    color: 'green', 
    stats: ['Asset allocation', 'Performance tracking', 'Rebalancing'],
    cta: 'Manage Portfolio →'
  },
  {
    id: 'mutual-funds',
    name: 'Mutual Funds',
    description: 'Complete MF Central integration with NAV history and analytics',
    icon: 'fas fa-coins',
    color: 'purple',
    stats: ['Portfolio import', 'NAV tracking', 'SIP calculator'],
    cta: 'Start SIP →'
  },
  {
    id: 'nsdl-services',
    name: 'NSDL Securities',
    description: 'Complete depository services - demat accounts, eDIS, margin pledge',
    icon: 'fas fa-shield-alt',
    color: 'red',
    stats: ['410M+ accounts', '₹503L Cr custody', 'Digital LAS'],
    cta: 'Access Services →'
  },
  {
    id: 'cdsl-services',
    name: 'CDSL Services',
    description: 'Advanced depository services - BO accounts, eLAS, e-voting',
    icon: 'fas fa-database',
    color: 'red',
    stats: ['6.5Cr+ accounts', '₹75L Cr custody', 'e-Voting platform'],
    cta: 'Access CDSL →'
  },
  {
    id: 'ipo',
    name: 'IPO Center',
    description: 'Apply for upcoming IPOs and track live applications',
    icon: 'fas fa-bullhorn',
    color: 'orange',
    stats: ['Upcoming IPOs', 'Application tracking', 'Market insights'],
    cta: 'View IPOs →'
  },
  {
    id: 'unlisted',
    name: 'Unlisted Securities',
    description: 'Exclusive access to pre-IPO and unlisted equity investments',
    icon: 'fas fa-gem',
    color: 'yellow',
    stats: ['Pre-IPO access', 'High growth potential', 'Exclusive deals'],
    cta: 'Explore Unlisted →'
  },
  {
    id: 'loans',
    name: 'Loans & LAS',
    description: 'Personal loans and Loan Against Securities facility',
    icon: 'fas fa-hand-holding-usd',
    color: 'teal',
    stats: ['LAS facility', 'Digital processing', 'Instant approval'],
    cta: 'Apply Loan →'
  },
  {
    id: 'sme-funding',
    name: 'SME Funding',
    description: 'Business loans and project funding solutions',
    icon: 'fas fa-building',
    color: 'indigo',
    stats: ['Up to: ₹50 Crores', 'Rate: 9.5% onwards', 'Quick disbursement'],
    cta: 'Get Quote →'
  }
] as const;
