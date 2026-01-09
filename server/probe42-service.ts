/**
 * Probe42 API Service (v2)
 * 
 * Corporate data intelligence platform for India providing:
 * - Company verification and financial data
 * - Director information and authorized signatories
 * - Credit assessment and risk scoring
 * - Lead prospecting with financial filters
 * - KYC, GST, EPFO, Credit Ratings, Legal History
 * 
 * API Documentation: https://apiportal.probe42.in/v2/
 * Base URL: https://api.probe42.in/probe_data_api/
 */

import axios, { AxiosInstance } from 'axios';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMinutes: number = 10) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

interface Probe42Config {
  apiKey: string;
  apiVersion?: string;
  baseUrl?: string;
}

const PROBE42_V2_BASE_URL = 'https://api.probe42.in/probe_data_api';
const PROBE42_API_VERSION = '1.0';

interface CompanySearchFilters {
  nameStartsWith?: string;
  cin?: string;
  city?: string;
  state?: string;
  pincode?: string;
  industrySegment?: string;
  
  // Financial filters
  minRevenue?: number;
  maxRevenue?: number;
  minProfit?: number;
  maxProfit?: number;
  minEbitda?: number;
  probe42Score?: number; // 1-5
  
  // Classification
  companyCategory?: 'msme' | 'mid_market' | 'large_enterprise';
  riskLevel?: 'low' | 'medium' | 'high';
  
  // Pagination
  page?: number;
  limit?: number;
}

interface CompanyBasicInfo {
  cin: string;
  companyName: string;
  registrationNumber: string;
  incorporationDate?: string;
  companyClass?: string;
  companyCategory?: string;
  companySubCategory?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
}

interface FinancialData {
  year: string;
  revenue: number;
  netProfit: number;
  ebitda?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  shareholderFunds?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  
  // Ratios
  debtToEquityRatio?: number;
  currentRatio?: number;
  roe?: number; // Return on Equity
  roa?: number; // Return on Assets
  netMargin?: number;
}

interface DirectorInfo {
  din: string;
  name: string;
  designation?: string;
  appointmentDate?: string;
  cessationDate?: string;
  pan?: string;
  address?: string;
  otherCompanies?: Array<{
    cin: string;
    companyName: string;
    designation: string;
  }>;
}

interface Probe42Score {
  score: number; // 1-5
  rating: string; // 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
  factors: {
    profitability?: number;
    liquidity?: number;
    solvency?: number;
    efficiency?: number;
    growth?: number;
  };
}

interface CompanyDetails extends CompanyBasicInfo {
  financials?: FinancialData[];
  directors?: DirectorInfo[];
  authorizedSignatories?: DirectorInfo[];
  probe42Score?: Probe42Score;
  charges?: Array<{
    chargeId: string;
    chargeHolder: string;
    chargeAmount: number;
    chargeDate: string;
    status: string;
  }>;
  legalCases?: Array<{
    caseNumber: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
  }>;
}

interface LeadScoringCriteria {
  minRevenue?: number;
  minProfit?: number;
  minScore?: number;
  maxRiskLevel?: 'low' | 'medium' | 'high';
  hasInvestableSurplus?: boolean;
}

export class Probe42Service {
  private client: AxiosInstance;
  private apiKey: string;
  private companyCache: LRUCache<CompanyDetails>;
  private maxConcurrency: number = 3;
  private activeCalls: number = 0;

  constructor(config: Probe42Config) {
    this.apiKey = config.apiKey;
    this.companyCache = new LRUCache<CompanyDetails>(200, 15);
    
    this.client = axios.create({
      baseURL: config.baseUrl || PROBE42_V2_BASE_URL,
      timeout: 30000,
      headers: {
        'x-api-key': this.apiKey,
        'x-api-version': PROBE42_API_VERSION,
        'Content-Type': 'application/json'
      }
    });
  }

  private async withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    while (this.activeCalls >= this.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeCalls++;
    try {
      return await fn();
    } finally {
      this.activeCalls--;
    }
  }

  /**
   * Search companies with name prefix (v2 API)
   * POST /search-entities with JSON body
   * 
   * Note: v2 API only supports nameStartsWith filter.
   * City/state/pincode filters are applied as post-filtering on results.
   * Financial filters (minRevenue, minProfit, probe42Score) are NOT applied
   * as they would require fetching details for each company (API-intensive).
   */
  async searchCompanies(filters: CompanySearchFilters): Promise<{ companies: CompanyBasicInfo[]; error?: string; available: boolean }> {
    try {
      const searchBody: any = {
        limit: Math.min((filters.limit || 50) * 2, 100)
      };

      if (filters.nameStartsWith) {
        searchBody.nameStartsWith = filters.nameStartsWith;
      }
      if (filters.cin) {
        searchBody.identifier = filters.cin;
      }

      const response = await this.client.post('/search-entities', searchBody);
      
      const entities = response.data?.entities || response.data?.data || response.data || [];
      
      let companies: CompanyBasicInfo[] = Array.isArray(entities) 
        ? entities.map((entity: any) => ({
            cin: entity.cin || entity.identifier || entity.id,
            companyName: entity.legalName || entity.companyName || entity.name,
            registrationNumber: entity.registrationNumber || entity.cin,
            incorporationDate: entity.incorporationDate || entity.dateOfIncorporation,
            companyClass: entity.companyClass || entity.class,
            companyCategory: entity.companyCategory || entity.category,
            companySubCategory: entity.companySubCategory,
            authorizedCapital: entity.authorizedCapital,
            paidUpCapital: entity.paidUpCapital,
            registeredAddress: entity.registeredAddress || entity.address,
            city: entity.city || this.extractCityFromAddress(entity.registeredAddress),
            state: entity.state || this.extractStateFromAddress(entity.registeredAddress),
            pincode: entity.pincode,
            email: entity.email,
            phone: entity.phone,
            website: entity.website
          }))
        : [];

      if (filters.city) {
        const cityLower = filters.city.toLowerCase();
        companies = companies.filter(c => 
          c.city?.toLowerCase().includes(cityLower) ||
          c.registeredAddress?.toLowerCase().includes(cityLower)
        );
      }

      if (filters.state) {
        const stateLower = filters.state.toLowerCase();
        companies = companies.filter(c => 
          c.state?.toLowerCase().includes(stateLower) ||
          c.registeredAddress?.toLowerCase().includes(stateLower)
        );
      }

      if (filters.pincode) {
        companies = companies.filter(c => 
          c.pincode?.includes(filters.pincode!) ||
          c.registeredAddress?.includes(filters.pincode!)
        );
      }

      companies = companies.slice(0, filters.limit || 50);

      console.log(`✅ Probe42 v2 search found ${companies.length} companies (after filtering)`);
      return { companies, available: true };
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unknown error';
      
      console.error('❌ Probe42 v2 search error:', { status, message, url: '/search-entities' });
      
      if (status === 404) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 company search endpoint not available. Please verify your API subscription includes company search access.' 
        };
      } else if (status === 401 || status === 403) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 API authentication failed. Please verify your API key is valid and active.' 
        };
      } else if (status === 429) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 API rate limit or credits exceeded. Please try again later or purchase more credits.' 
        };
      }
      
      return { 
        companies: [], 
        available: false, 
        error: `Probe42 API error: ${message}` 
      };
    }
  }

  private extractCityFromAddress(address?: string): string | undefined {
    if (!address) return undefined;
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli', 'Mysore', 'Tiruchirappalli', 'Bareilly', 'Aligarh', 'Tiruppur', 'Moradabad', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai', 'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer', 'Akola', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi', 'Ulhasnagar', 'Jammu', 'Sangli', 'Erode', 'Mangalore', 'Belgaum', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Udaipur', 'Maheshtala', 'Davanagere', 'Kozhikode', 'Kurnool', 'Rajpur', 'Rajahmundry', 'Bokaro', 'Bellary', 'Patiala', 'Gopalpur', 'Agartala', 'Bhagalpur', 'Muzaffarnagar', 'Bhatpara', 'Panihati', 'Latur', 'Dhule', 'Tirupati', 'Rohtak', 'Korba', 'Bhilwara', 'Berhampur', 'Muzaffarpur', 'Ahmednagar', 'Mathura', 'Kollam', 'Avadi', 'Kadapa', 'Anantapur', 'Kamarhati', 'Bilaspur', 'Sambalpur', 'Shahjahanpur', 'Satara', 'Bijapur', 'Rampur', 'Shimoga', 'Chandrapur', 'Junagadh', 'Thrissur', 'Alwar', 'Bardhaman', 'Kulti', 'Kakinada', 'Nizamabad', 'Parbhani', 'Tumkur', 'Khammam', 'Ozhukarai', 'Bihar', 'Panipat', 'Darbhanga', 'Bally', 'Aizawl', 'Dewas', 'Ichalkaranji', 'Karnal', 'Bathinda', 'Jalna', 'Eluru', 'Kirari', 'Brahmapur', 'Barasat', 'Purnia', 'Satna', 'Mau', 'Sonipat', 'Farrukhabad', 'Sagar', 'Rourkela', 'Durg', 'Imphal', 'Ratlam', 'Hapur', 'Arrah', 'Anantapur', 'Karimnagar', 'Ramagundam', 'Etawah', 'Mirzapur', 'Chapra', 'Fatehpur', 'Dindigul', 'Katihar', 'Bharatpur', 'Nadiad', 'Gurgaon', 'Gurugram'];
    for (const city of cities) {
      if (address.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }
    return undefined;
  }

  private extractStateFromAddress(address?: string): string | undefined {
    if (!address) return undefined;
    const states = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat', 'West Bengal', 'Telangana', 'Andhra Pradesh', 'Rajasthan', 'Kerala', 'Madhya Pradesh', 'Bihar', 'Punjab', 'Haryana', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Assam', 'Uttarakhand', 'Goa', 'Himachal Pradesh', 'Tripura', 'Meghalaya', 'Manipur', 'Nagaland', 'Arunachal Pradesh', 'Mizoram', 'Sikkim', 'Delhi', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Andaman and Nicobar Islands', 'Lakshadweep', 'Dadra and Nagar Haveli', 'Daman and Diu'];
    for (const state of states) {
      if (address.toLowerCase().includes(state.toLowerCase())) {
        return state;
      }
    }
    return undefined;
  }

  /**
   * Get basic company information by CIN (v2 API)
   * GET /entities/{identifier}/base-details
   */
  async getCompanyDetails(cin: string): Promise<CompanyDetails | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/base-details`);
      const data = response.data?.data || response.data;
      
      const baseDetails: CompanyDetails = {
        cin: data.cin || data.identifier || cin,
        companyName: data.legalName || data.companyName || data.name,
        registrationNumber: data.registrationNumber || data.cin,
        incorporationDate: data.dateOfIncorporation || data.incorporationDate,
        companyClass: data.companyClass || data.class,
        companyCategory: data.companyCategory || data.category,
        companySubCategory: data.companySubCategory,
        authorizedCapital: data.authorizedCapital,
        paidUpCapital: data.paidUpCapital,
        registeredAddress: data.registeredAddress || data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        email: data.email,
        phone: data.phone,
        website: data.website
      };

      const [kycData, creditRatings, legalHistory, charges] = await Promise.allSettled([
        this.getCompanyKYC(cin),
        this.getCompanyCreditRatings(cin),
        this.getCompanyLegalHistory(cin),
        this.getCompanyCharges(cin)
      ]);

      if (kycData.status === 'fulfilled' && kycData.value) {
        baseDetails.financials = kycData.value.financials;
        baseDetails.directors = kycData.value.directors;
        baseDetails.authorizedSignatories = kycData.value.authorizedSignatories;
      }

      if (creditRatings.status === 'fulfilled' && creditRatings.value) {
        baseDetails.probe42Score = {
          score: creditRatings.value.score || 3,
          rating: creditRatings.value.rating || 'Fair',
          factors: {
            profitability: creditRatings.value.profitability,
            liquidity: creditRatings.value.liquidity,
            solvency: creditRatings.value.solvency,
            efficiency: creditRatings.value.efficiency,
            growth: creditRatings.value.growth
          }
        };
      }

      if (legalHistory.status === 'fulfilled' && legalHistory.value) {
        baseDetails.legalCases = legalHistory.value.cases || legalHistory.value;
      }

      if (charges.status === 'fulfilled' && charges.value) {
        baseDetails.charges = charges.value.charges || charges.value;
      }

      return baseDetails;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 company details error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get basic company info only (without enrichment)
   * For fast lookups when full details aren't needed
   */
  async getCompanyBasicInfo(cin: string): Promise<CompanyBasicInfo | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/base-details`);
      const data = response.data?.data || response.data;
      
      return {
        cin: data.cin || data.identifier || cin,
        companyName: data.legalName || data.companyName || data.name,
        registrationNumber: data.registrationNumber || data.cin,
        incorporationDate: data.dateOfIncorporation || data.incorporationDate,
        companyClass: data.companyClass || data.class,
        companyCategory: data.companyCategory || data.category,
        companySubCategory: data.companySubCategory,
        authorizedCapital: data.authorizedCapital,
        paidUpCapital: data.paidUpCapital,
        registeredAddress: data.registeredAddress || data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        email: data.email,
        phone: data.phone,
        website: data.website
      };
    } catch (error: any) {
      console.error(`❌ Probe42 v2 basic info error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get full company KYC data (v2 API)
   * GET /entities/{identifier}/kyc
   */
  async getCompanyKYC(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/kyc`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 KYC error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company GST details (v2 API)
   * GET /entities/{identifier}/gst-details
   */
  async getCompanyGST(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/gst-details`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 GST error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company credit ratings (v2 API)
   * GET /entities/{identifier}/credit-ratings
   */
  async getCompanyCreditRatings(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/credit-ratings`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 credit ratings error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company legal history (v2 API)
   * GET /entities/{identifier}/legal-history
   */
  async getCompanyLegalHistory(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/legal-history`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 legal history error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company open charges (v2 API)
   * GET /entities/{identifier}/open-charges
   */
  async getCompanyCharges(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/open-charges`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 charges error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get director network (v2 API)
   * GET /entities/{identifier}/director-network
   */
  async getDirectorNetwork(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/director-network`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 director network error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company financials (uses KYC endpoint for financial data)
   */
  async getCompanyFinancials(cin: string): Promise<FinancialData[]> {
    try {
      const kycData = await this.getCompanyKYC(cin);
      return kycData?.financials || [];
    } catch (error) {
      console.error(`❌ Probe42 v2 financials error for CIN ${cin}:`, error);
      return [];
    }
  }

  /**
   * Get company directors (uses KYC endpoint for director data)
   */
  async getCompanyDirectors(cin: string): Promise<DirectorInfo[]> {
    try {
      const kycData = await this.getCompanyKYC(cin);
      return kycData?.directors || [];
    } catch (error) {
      console.error(`❌ Probe42 v2 directors error for CIN ${cin}:`, error);
      return [];
    }
  }

  /**
   * Get Probe42 Score (uses credit ratings endpoint)
   */
  async getProbe42Score(cin: string): Promise<Probe42Score | null> {
    try {
      const ratings = await this.getCompanyCreditRatings(cin);
      if (!ratings) return null;
      
      return {
        score: ratings.score || 3,
        rating: ratings.rating || 'Fair',
        factors: {
          profitability: ratings.profitability,
          liquidity: ratings.liquidity,
          solvency: ratings.solvency,
          efficiency: ratings.efficiency,
          growth: ratings.growth
        }
      };
    } catch (error) {
      console.error(`❌ Probe42 v2 score error for CIN ${cin}:`, error);
      return null;
    }
  }

  /**
   * Search director by PAN or name (uses director network)
   */
  async searchDirector(criteria: { pan?: string; name?: string; din?: string }): Promise<DirectorInfo[]> {
    try {
      if (criteria.din) {
        const response = await this.client.get(`/entities/${criteria.din}/director-network`);
        return response.data?.directors || [];
      }
      console.warn('Probe42 v2 director search requires DIN. PAN/name search not directly supported.');
      return [];
    } catch (error) {
      console.error('❌ Probe42 v2 director search error:', error);
      return [];
    }
  }

  /**
   * Search and enrich companies with full v2 data including financial filtering
   * This is the main orchestrator for lead prospecting with v2 API
   */
  async searchAndEnrich(filters: CompanySearchFilters): Promise<{ 
    companies: CompanyDetails[]; 
    error?: string; 
    available: boolean;
    enrichedCount: number;
    filteredCount: number;
  }> {
    const searchResult = await this.searchCompanies(filters);
    
    if (!searchResult.available || searchResult.companies.length === 0) {
      return { 
        companies: [], 
        available: searchResult.available, 
        error: searchResult.error,
        enrichedCount: 0,
        filteredCount: 0
      };
    }

    const maxEnrich = Math.min(searchResult.companies.length, 20);
    const toEnrich = searchResult.companies.slice(0, maxEnrich);
    
    console.log(`🔄 Enriching ${toEnrich.length} companies with financial data...`);
    
    const enrichedCompanies: CompanyDetails[] = [];
    const enrichPromises = toEnrich.map(company => 
      this.withConcurrencyLimit(async () => {
        const cached = this.companyCache.get(company.cin);
        if (cached) {
          console.log(`📦 Cache hit for ${company.cin}`);
          return cached;
        }
        
        const details = await this.getCompanyDetails(company.cin);
        if (details) {
          this.companyCache.set(company.cin, details);
        }
        return details;
      })
    );
    
    const results = await Promise.allSettled(enrichPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        enrichedCompanies.push(result.value);
      }
    }
    
    console.log(`✅ Enriched ${enrichedCompanies.length} companies`);
    
    let filteredCompanies = enrichedCompanies;
    
    if (filters.minRevenue || filters.minProfit || filters.probe42Score || filters.minEbitda) {
      filteredCompanies = enrichedCompanies.filter(company => {
        const latestFinancial = company.financials?.[0];
        
        if (filters.minRevenue && (!latestFinancial || latestFinancial.revenue < filters.minRevenue)) {
          return false;
        }
        if (filters.minProfit && (!latestFinancial || latestFinancial.netProfit < filters.minProfit)) {
          return false;
        }
        if (filters.minEbitda && (!latestFinancial || (latestFinancial.ebitda || 0) < filters.minEbitda)) {
          return false;
        }
        if (filters.probe42Score && (!company.probe42Score || company.probe42Score.score < filters.probe42Score)) {
          return false;
        }
        
        return true;
      });
      
      console.log(`📊 Filtered to ${filteredCompanies.length} companies meeting financial criteria`);
    }
    
    if (filters.riskLevel) {
      filteredCompanies = filteredCompanies.filter(company => {
        const score = company.probe42Score?.score || 0;
        if (filters.riskLevel === 'low' && score < 4) return false;
        if (filters.riskLevel === 'medium' && score < 3) return false;
        return true;
      });
    }
    
    return { 
      companies: filteredCompanies.slice(0, filters.limit || 50), 
      available: true,
      enrichedCount: enrichedCompanies.length,
      filteredCount: filteredCompanies.length
    };
  }

  /**
   * Find high-value leads based on financial criteria using v2 enrichment
   */
  async findHighValueLeads(criteria: LeadScoringCriteria): Promise<{ companies: CompanyDetails[]; error?: string; available: boolean }> {
    const filters: CompanySearchFilters = {
      minRevenue: criteria.minRevenue || 10000000,
      minProfit: criteria.minProfit || 1000000,
      probe42Score: criteria.minScore || 3,
      limit: 50
    };

    if (criteria.maxRiskLevel === 'low') {
      filters.riskLevel = 'low';
    } else if (criteria.maxRiskLevel === 'medium') {
      filters.riskLevel = 'medium';
    }

    console.log('🔍 Finding high-value leads with v2 enrichment...');
    const result = await this.searchAndEnrich(filters);
    
    return {
      companies: result.companies,
      error: result.error,
      available: result.available
    };
  }

  /**
   * Calculate estimated investable surplus
   * Simplified calculation: Current Assets - Current Liabilities - Working Capital Buffer
   */
  calculateInvestableSurplus(financial: FinancialData): number {
    if (!financial.currentAssets || !financial.currentLiabilities) {
      return 0;
    }

    const workingCapital = financial.currentAssets - financial.currentLiabilities;
    const workingCapitalBuffer = financial.currentAssets * 0.3; // Keep 30% as buffer
    
    const surplus = Math.max(0, workingCapital - workingCapitalBuffer);
    return Math.round(surplus);
  }

  /**
   * Calculate custom lead score (0-100)
   * Based on: Probe42 score, profitability, growth, risk level
   */
  calculateLeadScore(company: CompanyDetails): number {
    let score = 0;

    // Probe42 Score (0-25 points)
    if (company.probe42Score) {
      score += (company.probe42Score.score / 5) * 25;
    }

    // Latest financials (0-50 points)
    if (company.financials && company.financials.length > 0) {
      const latest = company.financials[0];
      
      // Profitability (0-20 points)
      if (latest.netMargin) {
        if (latest.netMargin > 0.15) score += 20; // >15% margin
        else if (latest.netMargin > 0.10) score += 15;
        else if (latest.netMargin > 0.05) score += 10;
        else if (latest.netMargin > 0) score += 5;
      }

      // Revenue scale (0-15 points)
      if (latest.revenue > 500000000) score += 15; // >₹50 Cr
      else if (latest.revenue > 100000000) score += 12; // >₹10 Cr
      else if (latest.revenue > 10000000) score += 8; // >₹1 Cr
      else if (latest.revenue > 0) score += 3;

      // Liquidity (0-15 points)
      if (latest.currentRatio) {
        if (latest.currentRatio > 2) score += 15;
        else if (latest.currentRatio > 1.5) score += 10;
        else if (latest.currentRatio > 1) score += 5;
      }
    }

    // No legal cases bonus (0-10 points)
    if (!company.legalCases || company.legalCases.length === 0) {
      score += 10;
    }

    // Director diversity bonus (0-15 points)
    if (company.directors && company.directors.length >= 3) {
      score += 15;
    } else if (company.directors && company.directors.length >= 2) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Determine lead quality based on score
   */
  getLeadQuality(leadScore: number): 'hot' | 'warm' | 'cold' {
    if (leadScore >= 75) return 'hot';
    if (leadScore >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Extract contact information from director details
   */
  extractContactInfo(directors: DirectorInfo[]): {
    emails: string[];
    phones: string[];
  } {
    const emails: string[] = [];
    const phones: string[] = [];

    // This is placeholder - real implementation would need additional data enrichment
    // Probe42 may not directly provide email/phone in director data
    // Typically requires separate contact discovery services

    return { emails, phones };
  }

  /**
   * Verify an existing client's company data
   */
  async verifyClient(cin: string): Promise<{
    verified: boolean;
    companyDetails: CompanyDetails | null;
    riskFlags: string[];
  }> {
    const companyDetails = await this.getCompanyDetails(cin);
    const riskFlags: string[] = [];

    if (!companyDetails) {
      return {
        verified: false,
        companyDetails: null,
        riskFlags: ['Company not found in Probe42 database']
      };
    }

    // Check for risk indicators
    if (companyDetails.legalCases && companyDetails.legalCases.length > 0) {
      riskFlags.push(`${companyDetails.legalCases.length} active legal cases`);
    }

    if (companyDetails.probe42Score && companyDetails.probe42Score.score <= 2) {
      riskFlags.push('Low financial health score');
    }

    if (companyDetails.financials && companyDetails.financials.length > 0) {
      const latest = companyDetails.financials[0];
      if (latest.netProfit && latest.netProfit < 0) {
        riskFlags.push('Negative profitability');
      }
      if (latest.debtToEquityRatio && latest.debtToEquityRatio > 2) {
        riskFlags.push('High debt-to-equity ratio');
      }
    }

    return {
      verified: true,
      companyDetails,
      riskFlags
    };
  }
}

export interface NormalizedCompanyResult {
  cin: string;
  companyName: string;
  registrationNumber: string;
  incorporationDate?: string;
  companyClass?: string;
  companyCategory?: string;
  companySubCategory?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
  revenue?: number;
  netProfit?: number;
  probe42Score?: number;
}

export function normalizeCompanyResult(company: CompanyBasicInfo | CompanyDetails): NormalizedCompanyResult {
  const hasFinancials = 'financials' in company && Array.isArray((company as any).financials);
  const hasScore = 'probe42Score' in company && (company as any).probe42Score;
  
  const latestFinancial = hasFinancials ? (company as CompanyDetails).financials?.[0] : undefined;
  const scoreValue = hasScore ? (company as CompanyDetails).probe42Score?.score : undefined;
  
  return {
    cin: company.cin,
    companyName: company.companyName,
    registrationNumber: company.registrationNumber || company.cin,
    incorporationDate: company.incorporationDate,
    companyClass: company.companyClass,
    companyCategory: company.companyCategory,
    companySubCategory: company.companySubCategory,
    authorizedCapital: company.authorizedCapital,
    paidUpCapital: company.paidUpCapital,
    registeredAddress: company.registeredAddress,
    city: company.city,
    state: company.state,
    pincode: company.pincode,
    email: company.email,
    phone: company.phone,
    website: company.website,
    revenue: latestFinancial?.revenue,
    netProfit: latestFinancial?.netProfit,
    probe42Score: scoreValue
  };
}

// Singleton instance
let probe42Service: Probe42Service | null = null;

export function getProbe42Service(): Probe42Service {
  if (!probe42Service) {
    const apiKey = process.env.PROBE42_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ PROBE42_API_KEY not configured. Probe42 service will not be available.');
      throw new Error('Probe42 API key not configured');
    }

    probe42Service = new Probe42Service({ apiKey });
    console.log(`✅ Probe42 service initialized (v2 API)`);
    console.log(`   Base URL: ${PROBE42_V2_BASE_URL}`);
    console.log(`   API Version: ${PROBE42_API_VERSION}`);
  }

  return probe42Service;
}
