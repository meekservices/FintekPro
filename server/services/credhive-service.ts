/**
 * Credhive Integration Service
 * 
 * Provides unlisted company intelligence via Credhive API:
 *   POST /v1/company/search          – search by name or CIN
 *   GET  /v1/company/{cin}           – company profile
 *   GET  /v1/company/{cin}/financials – P&L, Balance Sheet, Cash Flow
 *   GET  /v1/company/{cin}/directors  – director information
 *   GET  /v1/company/{cin}/compliance – risk signals & charges
 * 
 * Set CREDHIVE_API_KEY and optionally CREDHIVE_BASE_URL in environment.
 * While the key is absent the service returns graceful "unavailable" responses
 * so the research pipeline continues using DB-cached data.
 */

import axios, { AxiosInstance } from 'axios';
import { guardedExecution, validateCredhiveProfile, validateProspectData } from './guarded-execution';
import { distributedCache } from '../utils/distributed-cache';

const CREDHIVE_API_KEY  = process.env.CREDHIVE_API_KEY  || '';
const CREDHIVE_BASE_URL = process.env.CREDHIVE_BASE_URL || 'https://api.credhive.in/v1';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface CredhiveSearchResult {
  cin: string;
  company_name: string;
  status: string;           // active | strike_off | dissolved
  company_type?: string;    // Private Limited | Public Limited | LLP …
  roc_state?: string;
  date_of_incorporation?: string;
  category?: string;
}

export interface CredhiveCompanyProfile {
  cin: string;
  company_name: string;
  status: string;
  company_type?: string;
  roc_state?: string;
  date_of_incorporation?: string;
  registered_address?: string;
  authorized_capital?: number;
  paid_up_capital?: number;
  face_value?: number;
  total_shares?: number;
  isin?: string;
  sector?: string;
  industry?: string;
  website?: string;
  description?: string;
  email?: string;
  pan?: string;
}

export interface CredhiveFinancialStatement {
  financial_year: string;  // "FY2023-24"
  period_end?: string;     // "2024-03-31"
  revenue?: number;
  ebitda?: number;
  ebit?: number;
  pbt?: number;
  pat?: number;
  net_profit?: number;
  total_assets?: number;
  total_liabilities?: number;
  networth?: number;
  share_capital?: number;
  reserves?: number;
  total_debt?: number;
  long_term_debt?: number;
  short_term_debt?: number;
  cash_and_equivalents?: number;
  operating_cash_flow?: number;
  investing_cash_flow?: number;
  financing_cash_flow?: number;
  free_cash_flow?: number;
  capex?: number;
}

export interface CredhiveDirector {
  din: string;
  name: string;
  designation: string;
  date_of_appointment?: string;
  date_of_cessation?: string;
  is_active: boolean;
}

export interface CredhiveComplianceSignal {
  type: string;             // charge | default | regulatory_action | strike_off_risk
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  date?: string;
  amount?: number;
}

export interface CredhiveComplianceData {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  signals: CredhiveComplianceSignal[];
  charges_count?: number;
  total_charge_amount?: number;
  last_agm_date?: string;
  last_balance_sheet_date?: string;
  active_compliance?: string;
}

export interface CredhiveSearchResponse {
  success: boolean;
  data?: CredhiveSearchResult[];
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface CredhiveProfileResponse {
  success: boolean;
  data?: CredhiveCompanyProfile;
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface CredhiveFinancialsResponse {
  success: boolean;
  data?: CredhiveFinancialStatement[];
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface CredhiveDirectorsResponse {
  success: boolean;
  data?: CredhiveDirector[];
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface CredhiveComplianceResponse {
  success: boolean;
  data?: CredhiveComplianceData;
  error?: string;
  isApiKeyMissing?: boolean;
}

// ─── Service Class ────────────────────────────────────────────────────────────

class CredhiveService {
  private client: AxiosInstance;
  private available: boolean;

  constructor() {
    this.available = !!CREDHIVE_API_KEY;
    this.client = axios.create({
      baseURL: CREDHIVE_BASE_URL,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${CREDHIVE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Search companies by name, CIN, or PAN
   */
  async searchCompanies(query: string): Promise<CredhiveSearchResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured', data: [] };
    }
    try {
      const isCin = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(query.toUpperCase().trim());
      const response = await this.client.post('/company/search', {
        query: query.trim(),
        search_type: isCin ? 'cin' : 'name',
        limit: 10,
      });
      const rows: any[] = response.data?.data || response.data?.results || response.data || [];
      const mapped: CredhiveSearchResult[] = rows.map((r: any) => ({
        cin: r.cin || r.company_cin || '',
        company_name: r.company_name || r.name || '',
        status: r.company_status || r.status || 'unknown',
        company_type: r.company_type || r.company_category,
        roc_state: r.roc_state || r.roc_code,
        date_of_incorporation: r.date_of_incorporation || r.incorporation_date,
        category: r.company_category || r.category,
      }));
      return { success: true, data: mapped };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        return { success: false, error: 'Invalid CREDHIVE_API_KEY — check your credentials', isApiKeyMissing: true };
      }
      return { success: false, error: err?.message || 'Credhive search failed' };
    }
  }

  /**
   * Fetch full company profile by CIN
   */
  async getCompanyProfile(cin: string, forceRefresh = false): Promise<CredhiveProfileResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
    }

    const cacheKey = `credhive:profile:${cin}`;
    if (!forceRefresh) {
      const cached = await distributedCache.getJson<CredhiveCompanyProfile>(cacheKey);
      if (cached) {
        console.log(`[CredhiveService] Serving cached profile for ${cin}`);
        return { success: true, data: cached };
      }
    }

    return guardedExecution(
      async () => {
        const response = await this.client.get(`/company/${encodeURIComponent(cin)}`);
        const d: any = response.data?.data || response.data;

        // Schema validation: ensure API response still has expected shape
        validateCredhiveProfile(d, cin);

        const profile: CredhiveCompanyProfile = {
          cin: d.cin || cin,
          company_name: d.company_name || d.name || '',
          status: d.company_status || d.status || 'unknown',
          company_type: d.company_type || d.company_category,
          roc_state: d.roc_state || d.roc_code,
          date_of_incorporation: d.date_of_incorporation || d.incorporation_date,
          registered_address: d.registered_address
            ? (typeof d.registered_address === 'string'
                ? d.registered_address
                : [d.registered_address.address_line, d.registered_address.city, d.registered_address.state, d.registered_address.pincode].filter(Boolean).join(', '))
            : undefined,
          authorized_capital: this._num(d.authorized_capital),
          paid_up_capital: this._num(d.paid_up_capital),
          face_value: this._num(d.face_value),
          total_shares: this._num(d.total_shares),
          isin: d.isin,
          sector: d.sector || d.industry_class,
          industry: d.industry || d.sub_industry,
          website: d.website || d.url,
          description: d.description || d.business_description,
          email: d.email || d.email_id,
          pan: d.pan,
        };

        // Validate required prospect fields
        validateProspectData(
          { cin: profile.cin, company_name: profile.company_name, status: profile.status },
          ['cin', 'company_name', 'status'],
          'Credhive company profile',
        );

        // Cache for 24 hours
        await distributedCache.setJson(cacheKey, profile, 86400);

        return { success: true, data: profile };
      },
      {
        module: 'prospect_engine',
        operation: 'credhive_company_profile',
        input: { cin },
        fallback: { success: false, error: 'Credhive profile fetch failed — using fallback' } as CredhiveProfileResponse,
        code: `Credhive API → /company/${cin}`,
      },
    );
  }

  /**
   * Fetch financial statements (up to 5 years) by CIN
   */
  async getFinancials(cin: string, forceRefresh = false): Promise<CredhiveFinancialsResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
    }

    const cacheKey = `credhive:financials:${cin}`;
    if (!forceRefresh) {
      const cached = await distributedCache.getJson<CredhiveFinancialStatement[]>(cacheKey);
      if (cached) {
        console.log(`[CredhiveService] Serving cached financials for ${cin}`);
        return { success: true, data: cached };
      }
    }

    try {
      const response = await this.client.get(`/company/${encodeURIComponent(cin)}/financials`);
      const raw: any[] = response.data?.data || response.data?.financials || response.data || [];
      const mapped: CredhiveFinancialStatement[] = raw.map((r: any) => ({
        financial_year: r.financial_year || r.fy || '',
        period_end: r.period_end || r.balance_sheet_date,
        revenue: this._num(r.revenue || r.total_revenue || r.net_sales),
        ebitda: this._num(r.ebitda || r.operating_profit),
        ebit: this._num(r.ebit || r.operating_income),
        pbt: this._num(r.pbt || r.profit_before_tax),
        pat: this._num(r.pat || r.profit_after_tax),
        net_profit: this._num(r.net_profit || r.profit_after_tax),
        total_assets: this._num(r.total_assets),
        total_liabilities: this._num(r.total_liabilities),
        networth: this._num(r.networth || r.shareholders_equity || r.net_worth),
        share_capital: this._num(r.share_capital || r.equity_share_capital),
        reserves: this._num(r.reserves || r.reserves_and_surplus),
        total_debt: this._num(r.total_debt || r.total_borrowings),
        long_term_debt: this._num(r.long_term_debt || r.long_term_borrowings),
        short_term_debt: this._num(r.short_term_debt || r.short_term_borrowings),
        cash_and_equivalents: this._num(r.cash_and_equivalents || r.cash_and_bank_balances),
        operating_cash_flow: this._num(r.operating_cash_flow || r.cash_from_operations),
        investing_cash_flow: this._num(r.investing_cash_flow || r.cash_from_investing),
        financing_cash_flow: this._num(r.financing_cash_flow || r.cash_from_financing),
        free_cash_flow: this._num(r.free_cash_flow),
        capex: this._num(r.capex || r.capital_expenditure),
      }));

      // Cache for 24 hours
      await distributedCache.setJson(cacheKey, mapped, 86400);

      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive financials fetch failed' };
    }
  }

  /**
   * Fetch director information by CIN
   */
  async getDirectors(cin: string, forceRefresh = false): Promise<CredhiveDirectorsResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
    }

    const cacheKey = `credhive:directors:${cin}`;
    if (!forceRefresh) {
      const cached = await distributedCache.getJson<CredhiveDirector[]>(cacheKey);
      if (cached) {
        console.log(`[CredhiveService] Serving cached directors for ${cin}`);
        return { success: true, data: cached };
      }
    }

    try {
      const response = await this.client.get(`/company/${encodeURIComponent(cin)}/directors`);
      const raw: any[] = response.data?.data || response.data?.directors || response.data || [];
      const mapped: CredhiveDirector[] = raw.map((r: any) => ({
        din: r.din || r.director_identification_number || '',
        name: r.name || r.director_name || '',
        designation: r.designation || r.director_designation || 'Director',
        date_of_appointment: r.date_of_appointment || r.begin_date,
        date_of_cessation: r.date_of_cessation || r.end_date,
        is_active: r.is_active !== false && !r.date_of_cessation && !r.end_date,
      }));

      // Cache for 24 hours
      await distributedCache.setJson(cacheKey, mapped, 86400);

      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive directors fetch failed' };
    }
  }

  /**
   * Fetch compliance signals and risk flags by CIN
   */
  async getCompliance(cin: string, forceRefresh = false): Promise<CredhiveComplianceResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
    }

    const cacheKey = `credhive:compliance:${cin}`;
    if (!forceRefresh) {
      const cached = await distributedCache.getJson<CredhiveComplianceData>(cacheKey);
      if (cached) {
        console.log(`[CredhiveService] Serving cached compliance for ${cin}`);
        return { success: true, data: cached };
      }
    }

    try {
      const response = await this.client.get(`/company/${encodeURIComponent(cin)}/compliance`);
      const d: any = response.data?.data || response.data;
      const signals: CredhiveComplianceSignal[] = (d?.signals || d?.risk_signals || []).map((s: any) => ({
        type: s.type || s.signal_type || 'unknown',
        description: s.description || s.details || '',
        severity: s.severity || 'medium',
        date: s.date || s.signal_date,
        amount: this._num(s.amount),
      }));
      const compliance: CredhiveComplianceData = {
        overall_risk: d?.overall_risk || this._inferRisk(signals),
        signals,
        charges_count: this._num(d?.charges_count),
        total_charge_amount: this._num(d?.total_charge_amount),
        last_agm_date: d?.last_agm_date,
        last_balance_sheet_date: d?.last_balance_sheet_date,
        active_compliance: d?.active_compliance,
      };

      // Cache for 24 hours
      await distributedCache.setJson(cacheKey, compliance, 86400);

      return { success: true, data: compliance };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive compliance fetch failed' };
    }
  }

  // ─── Compatibility / Batch helpers ─────────────────────────────────────────

  /**
   * Alias: search by name or CIN (maps to searchCompanies)
   */
  async searchCompanyByNameOrCIN(query: string): Promise<CredhiveSearchResult[]> {
    const r = await this.searchCompanies(query);
    return r.data || [];
  }

  /**
   * Search companies by name, returning a credhive-compatible shape.
   * Accepts a string or a CompanySearchFilters object.
   */
  async searchCompany(nameOrFilters: string | Record<string, any>): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const query = typeof nameOrFilters === 'string'
      ? nameOrFilters
      : nameOrFilters.nameStartsWith || nameOrFilters.query || '';
    if (!query) return { success: false, error: 'Query required', data: [] };
    const r = await this.searchCompanies(query);
    const mapped = (r.data || []).map(c => ({
      cin: c.cin,
      companyName: c.company_name,
      registrationNumber: c.cin,
      status: c.status,
      category: c.category,
    }));
    return { success: r.success, data: mapped, error: r.error };
  }

  /**
   * Get company details in credhive-compatible shape.
   */
  async getCompanyDetails(cin: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const r = await this.getCompanyProfile(cin);
    if (!r.success || !r.data) return { success: false, error: r.error };
    const d = r.data;
    return {
      success: true,
      data: {
        cin: d.cin,
        companyName: d.company_name,
        registrationNumber: d.cin,
        status: d.status,
        companyType: d.company_type,
        category: d.company_type,
        registeredAddress: d.registered_address,
        authorizedCapital: d.authorized_capital,
        paidUpCapital: d.paid_up_capital,
        isin: d.isin,
        sector: d.sector,
        industry: d.industry,
        email: d.email,
        website: d.website,
        pan: d.pan,
      }
    };
  }

  /**
   * Get financials in credhive-compatible shape.
   */
  async getCompanyFinancials(cin: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const r = await this.getFinancials(cin);
    if (!r.success || !r.data || r.data.length === 0) return { success: false, error: r.error };
    const latest = r.data[0];
    return {
      success: true,
      data: {
        revenue: latest.revenue,
        netProfit: latest.net_profit ?? latest.pat,
        ebitda: latest.ebitda,
        totalAssets: latest.total_assets,
        networth: latest.networth,
        totalDebt: latest.total_debt,
        roe: latest.networth && latest.net_profit ? (latest.net_profit / latest.networth) * 100 : undefined,
        roce: undefined,
        debtToEquityRatio: latest.total_debt && latest.networth ? latest.total_debt / latest.networth : undefined,
        operatingCashFlow: latest.operating_cash_flow,
      }
    };
  }

  /**
   * Batch fetch company profiles — returns Map<cin, profileData|null>
   */
  async batchGetCompanyDetails(cins: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const CONCURRENCY = 5;
    for (let i = 0; i < cins.length; i += CONCURRENCY) {
      const batch = cins.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async cin => {
        const r = await this.getCompanyDetails(cin);
        result.set(cin, r.success ? r.data : null);
      }));
    }
    return result;
  }

  /**
   * Batch fetch financials — returns Map<cin, financialData[]|null>
   */
  async batchGetCompanyFinancials(cins: string[], _years?: number): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();
    const CONCURRENCY = 5;
    for (let i = 0; i < cins.length; i += CONCURRENCY) {
      const batch = cins.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async cin => {
        const r = await this.getFinancials(cin);
        result.set(cin, r.success && r.data ? r.data : []);
      }));
    }
    return result;
  }

  /**
   * Full enrichment: combines profile + financials + directors + compliance.
   * Returns a merged object compatible with the credhive enrichment shape.
   */
  async getFullEnrichment(cin: string): Promise<{
    baseDetails: any | null;
    financials: CredhiveFinancialStatement[];
    directors: CredhiveDirector[];
    compliance: CredhiveComplianceData | null;
    available: boolean;
  }> {
    const [profileRes, financialsRes, directorsRes, complianceRes] = await Promise.allSettled([
      this.getCompanyProfile(cin),
      this.getFinancials(cin),
      this.getDirectors(cin),
      this.getCompliance(cin),
    ]);

    const profile = profileRes.status === 'fulfilled' && profileRes.value.success ? profileRes.value.data : null;
    const financials = financialsRes.status === 'fulfilled' && financialsRes.value.success ? financialsRes.value.data || [] : [];
    const directors = directorsRes.status === 'fulfilled' && directorsRes.value.success ? directorsRes.value.data || [] : [];
    const compliance = complianceRes.status === 'fulfilled' && complianceRes.value.success ? complianceRes.value.data || null : null;

    const baseDetails = profile ? {
      cin: profile.cin,
      companyName: profile.company_name,
      registrationNumber: profile.cin,
      status: profile.status,
      companyType: profile.company_type,
      registeredAddress: profile.registered_address,
      authorizedCapital: profile.authorized_capital,
      paidUpCapital: profile.paid_up_capital,
      isin: profile.isin,
      sector: profile.sector,
      industry: profile.industry,
      email: profile.email,
      website: profile.website,
      pan: profile.pan,
      incorporationDate: profile.date_of_incorporation,
      financials: financials.map(f => ({
        revenue: f.revenue,
        netProfit: f.net_profit ?? f.pat,
        ebitda: f.ebitda,
        totalAssets: f.total_assets,
        networth: f.networth,
        roe: f.networth && f.net_profit ? (f.net_profit / f.networth) * 100 : undefined,
        debtToEquityRatio: f.total_debt && f.networth ? f.total_debt / f.networth : undefined,
      })),
      directors,
      probe42Score: null,
    } : null;

    return {
      baseDetails,
      financials,
      directors,
      compliance,
      available: this.available,
    };
  }

  /**
   * Extract a flat enrichment data object from a full enrichment result.
   */
  extractEnrichmentData(enrichment: Awaited<ReturnType<CredhiveService['getFullEnrichment']>>): {
    directors: CredhiveDirector[];
    authorizedSignatories: any[];
    companyStatus: string;
    entityType: string;
    paidUpCapital: number | undefined;
    authorizedCapital: number | undefined;
    employeeCount: number | undefined;
    gstStatus: string | undefined;
    gstNumber: string | undefined;
    creditRating: string | undefined;
    creditRatingAgency: string | undefined;
    creditRatingOutlook: string | undefined;
    riskIndicators: string[];
    enrichmentScore: number;
    apiAccessIssues: string[];
    dataNotAvailable: string[];
  } {
    const base = enrichment.baseDetails;
    const compliance = enrichment.compliance;

    const riskIndicators: string[] = [];
    if (compliance?.signals) {
      compliance.signals.filter(s => s.severity === 'high' || s.severity === 'critical').forEach(s => {
        riskIndicators.push(s.description);
      });
    }

    let enrichmentScore = 0;
    if (base) enrichmentScore += 20;
    if (enrichment.financials.length > 0) enrichmentScore += 30;
    if (enrichment.directors.length > 0) enrichmentScore += 20;
    if (compliance) enrichmentScore += 10;

    return {
      directors: enrichment.directors || [],
      authorizedSignatories: [],
      companyStatus: base?.status || 'Unknown',
      entityType: base?.companyType || 'Unknown',
      paidUpCapital: base?.paidUpCapital,
      authorizedCapital: base?.authorizedCapital,
      employeeCount: undefined,
      gstStatus: undefined,
      gstNumber: undefined,
      creditRating: undefined,
      creditRatingAgency: undefined,
      creditRatingOutlook: undefined,
      riskIndicators,
      enrichmentScore,
      apiAccessIssues: [],
      dataNotAvailable: [],
    };
  }

  /**
   * Search companies with complex filters (credhive-compatible signature).
   */
  async searchByFilters(filters: {
    nameStartsWith?: string;
    cin?: string;
    city?: string;
    state?: string;
    limit?: number;
    minRevenue?: number;
    minProfit?: number;
    credhiveScore?: number;
    probe42Score?: number;
    minEbitda?: number;
    riskLevel?: string;
    [key: string]: any;
  }): Promise<{ companies: any[]; error?: string; available: boolean }> {
    if (!this.available) {
      return { companies: [], available: false, error: 'CREDHIVE_API_KEY not configured' };
    }
    const query = filters.cin || filters.nameStartsWith || filters.query || '';
    if (!query || query.length < 2) {
      return { companies: [], available: true, error: 'Query too short' };
    }
    const r = await this.searchCompanies(query);
    const mapped = (r.data || []).map(c => ({
      cin: c.cin,
      companyName: c.company_name,
      registrationNumber: c.cin,
      status: c.status,
      category: c.category,
      state: c.roc_state,
      incorporationDate: c.date_of_incorporation,
    }));
    return { companies: mapped, available: r.success, error: r.error };
  }

  /**
   * Search and enrich — search then fetch financials for filtering.
   */
  async searchAndEnrich(filters: {
    nameStartsWith?: string;
    cin?: string;
    limit?: number;
    minRevenue?: number;
    minProfit?: number;
    credhiveScore?: number;
    probe42Score?: number;
    minEbitda?: number;
    riskLevel?: string;
    [key: string]: any;
  }): Promise<{ companies: any[]; available: boolean; error?: string; enrichedCount: number; filteredCount: number }> {
    const searchResult = await this.searchByFilters(filters);
    if (!searchResult.available || searchResult.companies.length === 0) {
      return { companies: [], available: searchResult.available, error: searchResult.error, enrichedCount: 0, filteredCount: 0 };
    }

    const toEnrich = searchResult.companies.slice(0, 20);
    const enriched: any[] = [];

    const CONCURRENCY = 5;
    for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
      const batch = toEnrich.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async company => {
        const [profileRes, finRes] = await Promise.allSettled([
          this.getCompanyProfile(company.cin),
          this.getFinancials(company.cin),
        ]);
        const profile = profileRes.status === 'fulfilled' && profileRes.value.success ? profileRes.value.data : null;
        const fins = finRes.status === 'fulfilled' && finRes.value.success ? finRes.value.data || [] : [];
        const latestFin = fins[0];
        enriched.push({
          ...company,
          ...(profile ? { email: profile.email, website: profile.website, pan: profile.pan } : {}),
          financials: fins.map(f => ({
            revenue: f.revenue,
            netProfit: f.net_profit ?? f.pat,
            ebitda: f.ebitda,
            totalAssets: f.total_assets,
            networth: f.networth,
          })),
          latestRevenue: latestFin?.revenue,
          latestNetProfit: latestFin?.net_profit ?? latestFin?.pat,
          latestEbitda: latestFin?.ebitda,
        });
      }));
    }

    let filtered = enriched;
    if (filters.minRevenue) filtered = filtered.filter(c => (c.latestRevenue || 0) >= filters.minRevenue!);
    if (filters.minProfit) filtered = filtered.filter(c => (c.latestNetProfit || 0) >= filters.minProfit!);
    if (filters.minEbitda) filtered = filtered.filter(c => (c.latestEbitda || 0) >= filters.minEbitda!);

    return {
      companies: filtered.slice(0, filters.limit || 50),
      available: true,
      enrichedCount: enriched.length,
      filteredCount: filtered.length,
    };
  }

  /**
   * Verify a client by CIN — uses profile + compliance.
   */
  async verifyClient(cin: string): Promise<{
    verified: boolean;
    companyDetails: any | null;
    riskFlags: string[];
  }> {
    const [profileRes, complianceRes] = await Promise.allSettled([
      this.getCompanyProfile(cin),
      this.getCompliance(cin),
    ]);

    const profile = profileRes.status === 'fulfilled' && profileRes.value.success ? profileRes.value.data : null;
    const compliance = complianceRes.status === 'fulfilled' && complianceRes.value.success ? complianceRes.value.data : null;

    const riskFlags: string[] = [];
    if (compliance?.signals) {
      compliance.signals.filter(s => s.severity === 'high' || s.severity === 'critical').forEach(s => {
        riskFlags.push(s.description);
      });
    }

    return {
      verified: !!profile,
      companyDetails: profile ? { ...profile, probe42Score: null, riskLevel: compliance?.overall_risk || 'medium' } : null,
      riskFlags,
    };
  }

  /**
   * Enrich a company for director context — profile + financials.
   */
  async enrichDirectorCompanyData(cin: string): Promise<any | null> {
    const [profileRes, finRes] = await Promise.allSettled([
      this.getCompanyProfile(cin),
      this.getFinancials(cin),
    ]);
    const profile = profileRes.status === 'fulfilled' && profileRes.value.success ? profileRes.value.data : null;
    if (!profile) return null;
    const fins = finRes.status === 'fulfilled' && finRes.value.success ? finRes.value.data || [] : [];
    const lf = fins[0];
    return {
      cin: profile.cin,
      companyName: profile.company_name,
      status: profile.status,
      paidUpCapital: profile.paid_up_capital,
      authorizedCapital: profile.authorized_capital,
      revenue: lf?.revenue,
      netProfit: lf?.net_profit ?? lf?.pat,
      ebitda: lf?.ebitda,
    };
  }

  /**
   * Director search by name — Credhive does not support this; always returns not-available.
   */
  async searchDirectorsByName(_name: string, _options?: any): Promise<{
    directors: any[];
    available: boolean;
    error?: string;
  }> {
    return { directors: [], available: false, error: 'Director search by name is not supported by Credhive' };
  }

  /**
   * Simple lead score (0–100) based on company financial data.
   */
  calculateLeadScore(company: any): number {
    let score = 20;
    const fin = Array.isArray(company?.financials) ? company.financials[0] : null;
    if (company?.paidUpCapital && company.paidUpCapital > 5000000) score += 15;
    if (fin?.revenue && fin.revenue > 50000000) score += 20;
    if (fin?.netProfit && fin.netProfit > 0) score += 15;
    if (company?.isin) score += 10;
    if (company?.website) score += 5;
    if (company?.email) score += 5;
    return Math.min(100, score);
  }

  /**
   * Lead quality bucket from numeric score.
   */
  getLeadQuality(score: number): string {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }

  /**
   * Estimate investable surplus from a financial year record.
   */
  calculateInvestableSurplus(financial: any): number {
    if (!financial) return 0;
    const netProfit = financial.netProfit ?? financial.net_profit ?? financial.pat ?? 0;
    const operatingCF = financial.operatingCashFlow ?? financial.operating_cash_flow ?? 0;
    const capex = financial.capex ?? 0;
    const fcf = operatingCF - capex;
    return Math.max(0, Math.min(netProfit, fcf > 0 ? fcf : netProfit * 0.4));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _num(v: any): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : undefined;
  }

  private _inferRisk(signals: CredhiveComplianceSignal[]): 'low' | 'medium' | 'high' | 'critical' {
    if (signals.some(s => s.severity === 'critical')) return 'critical';
    if (signals.some(s => s.severity === 'high')) return 'high';
    if (signals.length > 3) return 'medium';
    return signals.length > 0 ? 'medium' : 'low';
  }
}

export const credhiveService = new CredhiveService();

// ─── Standalone utility exports (previously in credhive-service) ─────────────

/**
 * Identity confidence scoring for Indian companies.
 * Pure function — no external API call.
 */
export function computeIdentityConfidence(company: {
  cin?: string | null;
  isin?: string | null;
  companyName?: string | null;
  legalName?: string | null;
  pan?: string | null;
}): {
  score: number;
  status: 'high' | 'medium' | 'review' | 'blocked';
  breakdown: {
    cin: { present: boolean; score: number };
    isin: { present: boolean; score: number };
    legalName: { present: boolean; quality: 'complete' | 'partial' | 'missing'; score: number };
    pan: { present: boolean; score: number };
  };
  enrichmentAllowed: boolean;
  enrichmentBlockReason?: string;
} {
  const breakdown = {
    cin: { present: false, score: 0, valid: false },
    isin: { present: false, score: 0, valid: false },
    legalName: { present: false, quality: 'missing' as 'complete' | 'partial' | 'missing', score: 0 },
    pan: { present: false, score: 0, valid: false },
  };

  if (company.cin && /^[A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(company.cin)) {
    breakdown.cin = { present: true, score: 0.3, valid: true };
  } else if (company.cin && company.cin.length > 0) {
    breakdown.cin = { present: true, score: 0, valid: false };
  }

  if (company.isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(company.isin)) {
    breakdown.isin = { present: true, score: 0.3, valid: true };
  } else if (company.isin && company.isin.length > 0) {
    breakdown.isin = { present: true, score: 0, valid: false };
  }

  const nameToCheck = company.legalName || company.companyName;
  if (nameToCheck) {
    const wordCount = nameToCheck.trim().split(/\s+/).length;
    const hasLegalSuffix = /\b(pvt|private|ltd|limited|llp|inc|corp|plc)\b/i.test(nameToCheck);
    if (wordCount >= 2 && hasLegalSuffix) {
      breakdown.legalName = { present: true, quality: 'complete', score: 0.2 };
    } else {
      breakdown.legalName = { present: true, quality: 'partial', score: 0 };
    }
  }

  if (company.pan && /^[A-Z]{5}\d{4}[A-Z]$/.test(company.pan)) {
    breakdown.pan = { present: true, score: 0.2, valid: true };
  } else if (company.pan && company.pan.length > 0) {
    breakdown.pan = { present: true, score: 0, valid: false };
  }

  const totalScore = breakdown.cin.score + breakdown.isin.score + breakdown.legalName.score + breakdown.pan.score;

  let status: 'high' | 'medium' | 'review' | 'blocked';
  let enrichmentAllowed = true;
  let enrichmentBlockReason: string | undefined;

  if (totalScore >= 0.8) {
    status = 'high';
  } else if (totalScore >= 0.5) {
    status = 'medium';
  } else if (totalScore >= 0.2) {
    status = 'review';
  } else {
    status = 'blocked';
    enrichmentAllowed = false;
    enrichmentBlockReason = 'Insufficient identity data — provide CIN, ISIN, or valid legal name';
  }

  return {
    score: Math.round(totalScore * 100) / 100,
    status,
    breakdown: {
      cin: { present: breakdown.cin.present, score: breakdown.cin.score },
      isin: { present: breakdown.isin.present, score: breakdown.isin.score },
      legalName: { present: breakdown.legalName.present, quality: breakdown.legalName.quality, score: breakdown.legalName.score },
      pan: { present: breakdown.pan.present, score: breakdown.pan.score },
    },
    enrichmentAllowed,
    enrichmentBlockReason,
  };
}

/**
 * Normalize a Credhive company profile to a standard flat result.
 */
export function normalizeCompanyResult(profile: CredhiveCompanyProfile | null): {
  cin: string;
  companyName: string;
  registrationNumber: string;
  incorporationDate?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  registeredAddress?: string;
  email?: string;
  website?: string;
  pan?: string;
  revenue?: number;
  netProfit?: number;
} {
  if (!profile) return { cin: '', companyName: '', registrationNumber: '' };
  return {
    cin: profile.cin,
    companyName: profile.company_name,
    registrationNumber: profile.cin,
    incorporationDate: profile.date_of_incorporation,
    authorizedCapital: profile.authorized_capital,
    paidUpCapital: profile.paid_up_capital,
    registeredAddress: profile.registered_address,
    email: profile.email,
    website: profile.website,
    pan: profile.pan,
  };
}

/** @deprecated Use credhiveService directly */
export function getCredhiveService() { return credhiveService; }
