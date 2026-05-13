import { FileText, Wallet, Building2, Briefcase, Home, TrendingUp, Globe, Receipt, Shield as LucideShield, Calculator, IndianRupee, CheckCircle, BarChart3, Users, Scale } from "lucide-react";
import { Step } from "./types";

export const ASSESSMENT_YEARS = ["2026-27", "2025-26", "2024-25", "2023-24"];

export const STEPS: Step[] = [
  { id: "basic", title: "Basic Info", icon: FileText, description: "Your PAN and assessment year" },
  { id: "sources", title: "Income Sources", icon: Wallet, description: "Select applicable income types" },
  { id: "entity_profile", title: "Entity Profile", icon: Building2, description: "Firm/company/trust details and partners" },
  { id: "salary", title: "Salary", icon: Briefcase, description: "Salary and employment details" },
  { id: "property", title: "House Property", icon: Home, description: "Rental and home loan details" },
  { id: "business", title: "Business / Profession", icon: Building2, description: "Business income, P&L, presumptive" },
  { id: "financials", title: "Financial Statements", icon: BarChart3, description: "Balance Sheet, P&L, depreciation" },
  { id: "capital", title: "Capital Gains", icon: TrendingUp, description: "Investment gains and losses" },
  { id: "foreign", title: "Foreign Income", icon: Globe, description: "Global stocks, DTAA relief, Schedule FA" },
  { id: "other", title: "Other Income", icon: Receipt, description: "Interest, dividends, and more" },
  { id: "disclosures", title: "Disclosures", icon: LucideShield, description: "Director, unlisted shares, loss carry-forward" },
  { id: "trust_income", title: "Trust / Exemptions", icon: Scale, description: "Corpus, voluntary contributions, exemptions" },
  { id: "deductions", title: "Deductions", icon: Calculator, description: "Tax-saving investments" },
  { id: "schedule_al", title: "Schedule AL", icon: Scale, description: "Assets & liabilities disclosure" },
  { id: "loss_adjustment", title: "Loss Adjustment", icon: Scale, description: "CYLA, BFLA, CFL set-off schedules" },
  { id: "schedule_si_ei", title: "Special / Exempt", icon: LucideShield, description: "Schedule SI & EI — special rate and exempt income" },
  { id: "schedule_spi", title: "Schedule SPI", icon: Users, description: "Spousal/minor income clubbing (Sec 64)" },
  { id: "schedule_5a", title: "Schedule 5A", icon: Scale, description: "Portuguese Civil Code apportionment" },
  { id: "schedule_if", title: "Schedule IF", icon: Building2, description: "Income from partnership firms" },
  { id: "mat_amt", title: "MAT / AMT", icon: Calculator, description: "Minimum Alternate Tax & credits" },
  { id: "tds_schedules", title: "TDS Schedules", icon: FileText, description: "TDS1, TDS2, TCS details" },
  { id: "tax_payments", title: "Tax Payments", icon: IndianRupee, description: "TDS, advance tax, self-assessment" },
  { id: "review", title: "Review & File", icon: CheckCircle, description: "Verify and submit" }
];

export const DEDUCTION_LIMITS: Record<string, { max: number; label: string }> = {
  section80C: { max: 150000, label: "Section 80C" },
  section80D: { max: 100000, label: "Section 80D" },
  section80TTA: { max: 10000, label: "Section 80TTA" },
};

export const MANUAL_ASSET_TYPES = [
  { value: 'shares', label: 'Shares / Debentures', icon: '📈', holdingPeriod: '12 months for listed equity', hint: 'Equity shares, preference shares, debentures traded on recognized exchange' },
  { value: 'mutual_funds', label: 'Mutual Funds', icon: '💰', holdingPeriod: '12 months for equity MF, 24-36 months for debt MF', hint: 'Redemption of mutual fund units including SIP investments' },
  { value: 'esop_rsu', label: 'Stock Options / RSUs', icon: '🏢', holdingPeriod: '12 months from exercise date', hint: 'Employee Stock Options, Restricted Stock Units from employer' },
  { value: 'property', label: 'Land or Building (Property)', icon: '🏠', holdingPeriod: '24 months', hint: 'Sale of residential/commercial property, plots, agricultural land (non-exempt)' },
  { value: 'bonds', label: 'Bonds / NCDs', icon: '📄', holdingPeriod: '12-36 months depending on type', hint: 'Corporate bonds, government securities, NCDs' },
  { value: 'gold', label: 'Gold / Silver / Jewellery', icon: '✨', holdingPeriod: '24 months', hint: 'Physical gold, sovereign gold bonds, gold ETFs' },
  { value: 'vda', label: 'Virtual Digital Assets (Crypto)', icon: '₿', holdingPeriod: 'Flat 30% tax, no threshold', hint: 'Cryptocurrency, NFTs. Taxed at flat 30% under Section 115BBH' },
  { value: 'other_assets', label: 'Any Other Capital Assets', icon: '📦', holdingPeriod: '36 months for unlisted', hint: 'Unlisted shares, collectibles, paintings, archaeological items' },
  { value: 'deemed_cg', label: 'Deemed Capital Gains', icon: '⚖️', holdingPeriod: 'As per section', hint: 'Capital gains under Sec 45(2), 45(3), 45(4), 50C, 50CA, 56(2)(x)' },
] as const;

export const formScheduleMap: Record<string, string[]> = {
  "ITR-1": ["Part A: Personal Details", "Part B: Gross Total Income (Salary, HP, Other)", "Part C: Deductions & Taxable Income", "Part D: Tax Computation", "Schedule TDS"],
  "ITR-2": ["Schedule S (Salary)", "Schedule HP", "Schedule CG (Capital Gains — STT/Non-STT split)", "Schedule OS", "Schedule CYLA/BFLA/CFL", "Schedule SI (Special Rate)", "Schedule FA (Foreign Assets)", "Schedule FSI", "Schedule AL (Assets & Liabilities)"],
  "ITR-3": ["All ITR-2 Schedules", "Schedule BP (Business/Profession)", "Part A-BS (Balance Sheet)", "Part A-P&L", "Schedule DEP (Depreciation)", "Schedule ESR (Tax Audit 44AB)"],
  "ITR-4": ["Part A (Personal Info)", "Schedule BP (Presumptive 44AD/44ADA/44AE)", "Part B-TI (Total Income)", "Part B-TTI (Tax Computation)"],
  "ITR-5": ["Part A-GEN (Firm/LLP)", "Schedule IF (Partner Details)", "Part A-BS", "Part A-P&L", "Schedule CG", "Schedule OS", "Schedule BP"],
  "ITR-6": ["Part A-GEN (Company)", "Part A-BS", "Part A-P&L", "Schedule MAT (115JB)", "Schedule CG", "Schedule OS", "Schedule BP"],
  "ITR-7": ["Part A-GEN (Trust)", "Schedule VC (Voluntary Contributions)", "Schedule-J (Investments)", "Schedule AI (Aggregate Income)", "Part B-TI", "Part B-TTI", "Section 11/12/13 Exemptions"],
};

export const DTAA_COUNTRIES = [
  { code: "US", name: "United States", article: "Article 10/11/13" },
  { code: "UK", name: "United Kingdom", article: "Article 10/11/13" },
  { code: "SG", name: "Singapore", article: "Article 10/11/13" },
  { code: "AE", name: "UAE", article: "Article 11/13" },
  { code: "CA", name: "Canada", article: "Article 10/11/13" },
  { code: "AU", name: "Australia", article: "Article 10/11/13" },
  { code: "DE", name: "Germany", article: "Article 10/11/13" },
  { code: "JP", name: "Japan", article: "Article 10/11/13" },
  { code: "HK", name: "Hong Kong", article: "Article 10/11/13" },
  { code: "NL", name: "Netherlands", article: "Article 10/11/13" },
  { code: "FR", name: "France", article: "Article 10/11/13" },
  { code: "CH", name: "Switzerland", article: "Article 10/11/13" },
  { code: "OTHER", name: "Other Country", article: "See DTAA treaty" },
];

export const ASSET_TYPES_FA = [
  { value: "equity", label: "Foreign Equity Shares (US stocks, ETFs)" },
  { value: "mutual_fund", label: "Foreign Mutual Funds / ETFs" },
  { value: "bank_account", label: "Foreign Bank Account" },
  { value: "custodial", label: "Foreign Custodial Account (Schwab, IBKR)" },
  { value: "bonds", label: "Foreign Bonds / Securities" },
  { value: "real_estate", label: "Foreign Immovable Property" },
  { value: "other", label: "Other Foreign Capital Asset" },
];

export const CURRENCY_CODES = [
  { code: "USD", symbol: "$", name: "US Dollar", defaultRate: 83.5 },
  { code: "GBP", symbol: "£", name: "British Pound", defaultRate: 105.5 },
  { code: "EUR", symbol: "€", name: "Euro", defaultRate: 90.5 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", defaultRate: 62.0 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", defaultRate: 22.7 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", defaultRate: 54.0 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", defaultRate: 61.5 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", defaultRate: 0.56 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", defaultRate: 10.7 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", defaultRate: 94.0 },
];
