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
  async getCompanyProfile(cin: string): Promise<CredhiveProfileResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
    }
    try {
      const response = await this.client.get(`/company/${encodeURIComponent(cin)}`);
      const d: any = response.data?.data || response.data;
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
      return { success: true, data: profile };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive profile fetch failed' };
    }
  }

  /**
   * Fetch financial statements (up to 5 years) by CIN
   */
  async getFinancials(cin: string): Promise<CredhiveFinancialsResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
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
      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive financials fetch failed' };
    }
  }

  /**
   * Fetch director information by CIN
   */
  async getDirectors(cin: string): Promise<CredhiveDirectorsResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
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
      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive directors fetch failed' };
    }
  }

  /**
   * Fetch compliance signals and risk flags by CIN
   */
  async getCompliance(cin: string): Promise<CredhiveComplianceResponse> {
    if (!this.available) {
      return { success: false, isApiKeyMissing: true, error: 'CREDHIVE_API_KEY not configured' };
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
      return { success: true, data: compliance };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Credhive compliance fetch failed' };
    }
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
