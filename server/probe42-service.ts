/**
 * @deprecated Probe42 API Service (v2) — DEPRECATED
 *
 * This service has been superseded by Credhive (server/services/credhive-service.ts).
 * All new unlisted company intelligence flows use Credhive via:
 *   - server/services/vendor-adapters/credhive.adapter.ts
 *   - server/services/unified-company-data-service.ts
 *
 * This file is retained for backward compatibility only. The Probe42 routes
 * (/api/unlisted/probe42/*) remain for legacy clients but internally delegate
 * to Credhive. DB columns (probe42CompanyId, probe42_score, etc.) are unchanged.
 *
 * Original Probe42 API Documentation: https://apiportal.probe42.in/v2/
 * Original Base URL: https://api.probe42.in/probe_data_api/
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
  companyType?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
  status?: string;
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
      if (!filters.nameStartsWith && !filters.cin) {
        return {
          companies: [],
          available: true,
          error: 'Please enter a company name to search. Probe42 v2 requires a name prefix for searching.'
        };
      }

      if (filters.nameStartsWith && filters.nameStartsWith.length < 4) {
        return {
          companies: [],
          available: true,
          error: 'Company name must be at least 4 characters long.'
        };
      }

      const searchBody: any = {
        limit: Math.min((filters.limit || 50) * 2, 100)
      };

      if (filters.nameStartsWith) {
        searchBody.nameStartsWith = filters.nameStartsWith;
      }
      if (filters.cin) {
        searchBody.identifier = filters.cin;
      }

      console.log('🔍 Probe42 v2 search request:', JSON.stringify(searchBody));
      const response = await this.client.post('/search-entities', searchBody);
      console.log('📦 Probe42 v2 search response status:', response.status);
      
      // v2 API returns: { data: { companies: [...], llps: [...] } }
      const responseData = response.data?.data || response.data;
      const companiesList = responseData?.companies || responseData?.entities || [];
      const llpsList = responseData?.llps || [];
      
      console.log(`📦 Probe42 v2 found ${companiesList.length} companies, ${llpsList.length} LLPs`);
      
      // Log first entity to see the actual field structure
      if (companiesList.length > 0) {
        console.log('📋 Probe42 v2 sample entity keys:', Object.keys(companiesList[0]));
        console.log('📋 Probe42 v2 sample entity:', JSON.stringify(companiesList[0]).substring(0, 500));
      }
      
      let companies: CompanyBasicInfo[] = Array.isArray(companiesList) 
        ? companiesList.map((entity: any) => {
            // v2 API returns registered_address as nested object: {address_line, city, state, pincode}
            const regAddr = entity.registered_address || entity.registeredAddress;
            const isNestedAddr = regAddr && typeof regAddr === 'object';
            
            return {
              cin: entity.identifier || entity.cin || entity.id,
              companyName: entity.legal_name || entity.legalName || entity.companyName || entity.name,
              registrationNumber: entity.identifier || entity.registrationNumber || entity.cin,
              incorporationDate: entity.date_of_incorporation || entity.incorporationDate || entity.dateOfIncorporation,
              companyClass: entity.company_class || entity.companyClass || entity.class,
              companyCategory: entity.company_category || entity.companyCategory || entity.category,
              companySubCategory: entity.company_sub_category || entity.companySubCategory,
              authorizedCapital: entity.authorized_capital || entity.authorizedCapital,
              paidUpCapital: entity.paid_up_capital || entity.paidUpCapital,
              registeredAddress: isNestedAddr 
                ? `${regAddr.address_line || ''}, ${regAddr.city || ''}, ${regAddr.state || ''} ${regAddr.pincode || ''}`.trim()
                : (typeof regAddr === 'string' ? regAddr : undefined),
              city: isNestedAddr ? regAddr.city : (entity.city || this.extractCityFromAddress(regAddr)),
              state: isNestedAddr ? regAddr.state : (entity.state || this.extractStateFromAddress(regAddr)),
              pincode: isNestedAddr ? regAddr.pincode : entity.pincode,
              email: entity.email || entity.email_id,
              phone: entity.phone || entity.mobile,
              website: entity.website,
              status: entity.status || 'Active',
              companyType: entity.company_type || entity.companyType,
            };
          })
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

      // Dedupe by CIN (some companies appear multiple times with different names)
      const uniqueCompanies = new Map<string, CompanyBasicInfo>();
      for (const company of companies) {
        if (company.cin && !uniqueCompanies.has(company.cin)) {
          uniqueCompanies.set(company.cin, company);
        }
      }
      companies = Array.from(uniqueCompanies.values()).slice(0, filters.limit || 50);

      console.log(`✅ Probe42 v2 search found ${companies.length} companies (after filtering & deduplication)`);
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

  private extractPincodeFromAddress(address?: string): string | undefined {
    if (!address) return undefined;
    // Match 6-digit Indian pincode pattern
    const pincodeMatch = address.match(/\b[1-9][0-9]{5}\b/);
    return pincodeMatch ? pincodeMatch[0] : undefined;
  }

  /**
   * Get basic company information by CIN (v2 API)
   * GET /entities/{identifier}/base-details
   */
  async getCompanyDetails(cin: string): Promise<CompanyDetails | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/base-details`);
      const data = response.data?.data || response.data;
      
      // Log the full response to understand v2 structure
      console.log(`📋 Probe42 v2 base-details raw response for ${cin}:`, JSON.stringify(data, null, 2));
      console.log(`💰 Capital fields in response: authorized_capital=${data.authorized_capital}, paid_up_capital=${data.paid_up_capital}, authorizedCapital=${data.authorizedCapital}, paidUpCapital=${data.paidUpCapital}`);
      console.log(`📦 All response keys:`, Object.keys(data || {}));
      
      // Handle v2 API nested registered_address object
      const regAddr = data.registered_address || data.registeredAddress || data.address;
      const isNestedAddress = regAddr && typeof regAddr === 'object' && !Array.isArray(regAddr);
      
      // Extract address fields from nested object or parse from string
      let addressString: string | undefined;
      let city: string | undefined;
      let state: string | undefined;
      let pincode: string | undefined;
      
      if (isNestedAddress) {
        // v2 API returns: { address_line, city, pincode, state }
        addressString = regAddr.address_line || regAddr.addressLine || regAddr.full_address;
        city = regAddr.city;
        state = regAddr.state;
        pincode = regAddr.pincode || regAddr.pin_code;
        
        // Build full address string for display
        const addrParts = [addressString, city, state, pincode].filter(Boolean);
        addressString = addrParts.join(', ');
        
        console.log(`📍 Parsed nested address: city=${city}, state=${state}, pincode=${pincode}`);
      } else if (typeof regAddr === 'string') {
        // Legacy: address is a plain string, extract fields
        addressString = regAddr;
        city = this.extractCityFromAddress(regAddr);
        state = this.extractStateFromAddress(regAddr);
        pincode = this.extractPincodeFromAddress(regAddr);
      }
      
      // v2 API field mapping (snake_case to camelCase)
      const baseDetails: CompanyDetails = {
        cin: data.cin || data.identifier || cin,
        companyName: data.legal_name || data.legalName || data.company_name || data.companyName || data.name,
        registrationNumber: data.registration_number || data.registrationNumber || data.identifier || data.cin,
        incorporationDate: data.date_of_incorporation || data.dateOfIncorporation || data.incorporationDate,
        companyClass: data.company_class || data.companyClass || data.class,
        companyCategory: data.company_category || data.companyCategory || data.category,
        companySubCategory: data.company_sub_category || data.companySubCategory,
        authorizedCapital: data.authorized_capital || data.authorizedCapital,
        paidUpCapital: data.paid_up_capital || data.paidUpCapital,
        registeredAddress: addressString,
        city: data.city || city,
        state: data.state || state,
        pincode: data.pincode || data.pin_code || pincode,
        email: data.email || data.email_id || data.contact_email,
        phone: data.phone || data.phone_number || data.contact_phone || data.mobile,
        website: data.website || data.web_url
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
      
      // Handle v2 API nested registered_address object
      const regAddr = data.registered_address || data.registeredAddress || data.address;
      const isNestedAddress = regAddr && typeof regAddr === 'object' && !Array.isArray(regAddr);
      
      let addressString: string | undefined;
      let city: string | undefined;
      let state: string | undefined;
      let pincode: string | undefined;
      
      if (isNestedAddress) {
        addressString = regAddr.address_line || regAddr.addressLine || regAddr.full_address;
        city = regAddr.city;
        state = regAddr.state;
        pincode = regAddr.pincode || regAddr.pin_code;
        const addrParts = [addressString, city, state, pincode].filter(Boolean);
        addressString = addrParts.join(', ');
      } else if (typeof regAddr === 'string') {
        addressString = regAddr;
        city = this.extractCityFromAddress(regAddr);
        state = this.extractStateFromAddress(regAddr);
        pincode = this.extractPincodeFromAddress(regAddr);
      }
      
      return {
        cin: data.cin || data.identifier || cin,
        companyName: data.legal_name || data.legalName || data.companyName || data.name,
        registrationNumber: data.registration_number || data.registrationNumber || data.cin,
        incorporationDate: data.date_of_incorporation || data.dateOfIncorporation || data.incorporationDate,
        companyClass: data.company_class || data.companyClass || data.class,
        companyCategory: data.company_category || data.companyCategory || data.category,
        companySubCategory: data.company_sub_category || data.companySubCategory,
        authorizedCapital: data.authorized_capital || data.authorizedCapital,
        paidUpCapital: data.paid_up_capital || data.paidUpCapital,
        registeredAddress: addressString,
        city: data.city || city,
        state: data.state || state,
        pincode: data.pincode || data.pin_code || pincode,
        email: data.email || data.email_id,
        phone: data.phone || data.phone_number,
        website: data.website || data.web_url
      };
    } catch (error: any) {
      console.error(`❌ Probe42 v2 basic info error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get full company KYC data (v2 API)
   * GET /entities/{identifier}/kyc
   * Returns: paid_up_capital, sum_of_charges, active_compliance, listing_status, type_of_entity, directors, financials
   */
  async getCompanyKYC(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/kyc`);
      const kycData = response.data?.data || response.data;
      
      // Log KYC response structure for debugging
      if (kycData && typeof kycData === 'object') {
        const availableFields = Object.keys(kycData);
        console.log(`📋 Probe42 KYC fields for ${cin}:`, availableFields.join(', '));
        
        // Log key values for prospecting
        if (kycData.paid_up_capital) console.log(`   💰 Paid-up Capital: ₹${kycData.paid_up_capital}`);
        if (kycData.sum_of_charges) console.log(`   📊 Sum of Charges: ₹${kycData.sum_of_charges}`);
        if (kycData.active_compliance) console.log(`   ✅ Compliance: ${kycData.active_compliance}`);
        if (kycData.listing_status) console.log(`   📈 Listing Status: ${kycData.listing_status}`);
        if (kycData.type_of_entity) console.log(`   🏢 Entity Type: ${kycData.type_of_entity}`);
      }
      
      return kycData;
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
   * Get director network by DIN (v2 API)
   * GET /director/{din}/director-network
   */
  async getDirectorNetworkByDIN(din: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/director/${din}/director-network`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 director network by DIN error for ${din}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Search directors by name and get their company associations (v2 API)
   * POST /search-directors with JSON body
   * 
   * Returns list of directors with their associated companies including:
   * - CIN, company name, status, paid_up_capital, sum_of_charges
   * - Director's designation, appointment/cessation dates
   */
  async searchDirectorsByName(directorName: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<{
    directors: Array<{
      din: string;
      name: string;
      companies: Array<{
        cin: string;
        legalName: string;
        companyStatus: string;
        paidUpCapital: number;
        sumOfCharges: number;
        incorporationDate: string;
        designation: string;
        dateOfAppointment: string;
        dateOfAppointmentForCurrentDesignation?: string;
        dateOfCessation?: string;
      }>;
    }>;
    error?: string;
    available: boolean;
  }> {
    try {
      if (!directorName || directorName.length < 3) {
        return {
          directors: [],
          available: true,
          error: 'Director name must be at least 3 characters long.'
        };
      }

      const searchBody = {
        nameStartsWith: directorName,
        page: options?.page || 1,
        limit: options?.limit || 50
      };

      console.log('🔍 Probe42 v2 director search request:', JSON.stringify(searchBody));
      const response = await this.client.post('/search-directors', searchBody);
      console.log('📦 Probe42 v2 director search response status:', response.status);
      
      const responseData = response.data?.data || response.data;
      const directorsList = responseData?.directors || responseData?.entities || [];
      
      console.log(`📦 Probe42 v2 found ${directorsList.length} directors`);
      
      if (directorsList.length > 0) {
        console.log('📋 Probe42 v2 sample director keys:', Object.keys(directorsList[0]));
      }

      const directors = Array.isArray(directorsList) 
        ? directorsList.map((director: any) => {
            const companies = (director.companies || director.associated_companies || []).map((comp: any) => ({
              cin: comp.cin || comp.identifier,
              legalName: comp.legal_name || comp.legalName || comp.company_name || comp.companyName,
              companyStatus: comp.company_status || comp.companyStatus || comp.status || 'Unknown',
              paidUpCapital: comp.paid_up_capital || comp.paidUpCapital || 0,
              sumOfCharges: comp.sum_of_charges || comp.sumOfCharges || 0,
              incorporationDate: comp.incorporation_date || comp.incorporationDate || comp.date_of_incorporation || '',
              designation: comp.designation || director.designation || '',
              dateOfAppointment: comp.date_of_appointment || comp.dateOfAppointment || '',
              dateOfAppointmentForCurrentDesignation: comp.date_of_appointment_for_current_designation || '',
              dateOfCessation: comp.date_of_cessation || comp.dateOfCessation || undefined
            }));

            return {
              din: director.din || director.identifier || '',
              name: director.name || director.director_name || director.legal_name || '',
              companies
            };
          })
        : [];

      console.log(`✅ Probe42 v2 director search found ${directors.length} directors`);
      return { directors, available: true };
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unknown error';
      
      console.error('❌ Probe42 v2 director search error:', { status, message });
      
      if (status === 404) {
        return { 
          directors: [], 
          available: false, 
          error: 'Director search endpoint not available. Your API subscription may not include this feature.' 
        };
      } else if (status === 401 || status === 403) {
        return { 
          directors: [], 
          available: false, 
          error: 'Probe42 API authentication failed.' 
        };
      } else if (status === 429) {
        return { 
          directors: [], 
          available: false, 
          error: 'API rate limit exceeded. Please try again later.' 
        };
      }
      
      return { 
        directors: [], 
        available: false, 
        error: `Director search error: ${message}` 
      };
    }
  }

  /**
   * Get comprehensive company details for director search results
   * Enriches company data with financial and compliance information
   */
  async enrichDirectorCompanyData(cin: string): Promise<{
    cin: string;
    companyName: string;
    paidUpCapital?: number;
    authorizedCapital?: number;
    sumOfCharges?: number;
    companyStatus: string;
    activeCompliance?: string;
    listingStatus?: string;
    entityType?: string;
    incorporationDate?: string;
    registeredAddress?: string;
    city?: string;
    state?: string;
    pincode?: string;
    email?: string;
    phone?: string;
    website?: string;
    companyClass?: string;
    companyCategory?: string;
  } | null> {
    try {
      const [baseDetails, kyc] = await Promise.all([
        this.getCompanyDetails(cin),
        this.getCompanyKYC(cin)
      ]);

      if (!baseDetails && !kyc) {
        console.log(`⚠️ No data available for CIN ${cin}`);
        return null;
      }

      const kycData = kyc || {};
      const base = baseDetails || {};

      const paidUp = kycData.paid_up_capital || kycData.paidUpCapital || base.paidUpCapital;
      const authCap = base.authorizedCapital || kycData.authorized_capital;
      const charges = kycData.sum_of_charges || kycData.sumOfCharges;

      let registeredAddress = base.registeredAddress;
      if (!registeredAddress && (base.city || base.state || base.pincode)) {
        registeredAddress = [base.city, base.state, base.pincode].filter(Boolean).join(', ');
      }

      return {
        cin,
        companyName: base.companyName || kycData.legal_name || kycData.legalName || '',
        paidUpCapital: paidUp && paidUp > 0 ? paidUp : undefined,
        authorizedCapital: authCap && authCap > 0 ? authCap : undefined,
        sumOfCharges: charges && charges > 0 ? charges : undefined,
        companyStatus: kycData.company_status || kycData.companyStatus || base.status || 'Unknown',
        activeCompliance: kycData.active_compliance || kycData.activeCompliance || undefined,
        listingStatus: kycData.listing_status || kycData.listingStatus || undefined,
        entityType: kycData.type_of_entity || kycData.entityType || base.companyType || undefined,
        incorporationDate: base.incorporationDate || kycData.incorporation_date || undefined,
        registeredAddress,
        city: base.city,
        state: base.state,
        pincode: base.pincode,
        email: base.email,
        phone: base.phone,
        website: base.website,
        companyClass: base.companyClass,
        companyCategory: base.companyCategory
      };
    } catch (error: any) {
      console.error(`❌ Error enriching company ${cin}:`, error?.message);
      return null;
    }
  }

  /**
   * Get company EPFO details (v2 API) - Employee count indicator
   * GET /entities/{identifier}/epfo
   */
  async getCompanyEPFO(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/epfo`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 EPFO error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company suit filed cases (v2 API) - Active legal cases
   * GET /entities/{identifier}/suit-filed-cases
   */
  async getCompanySuitFiledCases(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/suit-filed-cases`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 suit filed cases error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get company data status (v2 API) - Data freshness timestamps
   * GET /entities/{identifier}/data-status
   */
  async getCompanyDataStatus(cin: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/entities/${cin}/data-status`);
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`❌ Probe42 v2 data status error for CIN ${cin}:`, error?.response?.status, error?.message);
      return null;
    }
  }

  /**
   * Get full company enrichment - fetches all available data in parallel
   * This is the comprehensive data fetch for lead import
   */
  async getFullEnrichment(cin: string): Promise<{
    baseDetails: CompanyDetails | null;
    kyc: any | null;
    gst: any | null;
    creditRatings: any | null;
    legalHistory: any | null;
    suitFiledCases: any | null;
    openCharges: any | null;
    epfo: any | null;
    directorNetwork: any | null;
    dataStatus: any | null;
    enrichedAt: string;
    enrichmentSources: string[];
  }> {
    console.log(`🔍 Starting full enrichment for CIN: ${cin}`);
    const startTime = Date.now();
    
    // Fetch all data sources in parallel
    const [
      baseDetails,
      kyc,
      gst,
      creditRatings,
      legalHistory,
      suitFiledCases,
      openCharges,
      epfo,
      directorNetwork,
      dataStatus
    ] = await Promise.all([
      this.getCompanyDetails(cin),
      this.getCompanyKYC(cin),
      this.getCompanyGST(cin),
      this.getCompanyCreditRatings(cin),
      this.getCompanyLegalHistory(cin),
      this.getCompanySuitFiledCases(cin),
      this.getCompanyCharges(cin),
      this.getCompanyEPFO(cin),
      this.getDirectorNetwork(cin),
      this.getCompanyDataStatus(cin)
    ]);

    // Track which sources returned data
    const enrichmentSources: string[] = [];
    if (baseDetails) enrichmentSources.push('base-details');
    if (kyc) enrichmentSources.push('kyc');
    if (gst) enrichmentSources.push('gst-details');
    if (creditRatings) enrichmentSources.push('credit-ratings');
    if (legalHistory) enrichmentSources.push('legal-history');
    if (suitFiledCases) enrichmentSources.push('suit-filed-cases');
    if (openCharges) enrichmentSources.push('open-charges');
    if (epfo) enrichmentSources.push('epfo');
    if (directorNetwork) enrichmentSources.push('director-network');
    if (dataStatus) enrichmentSources.push('data-status');

    const duration = Date.now() - startTime;
    console.log(`✅ Full enrichment completed for ${cin} in ${duration}ms (${enrichmentSources.length}/10 sources)`);

    return {
      baseDetails,
      kyc,
      gst,
      creditRatings,
      legalHistory,
      suitFiledCases,
      openCharges,
      epfo,
      directorNetwork,
      dataStatus,
      enrichedAt: new Date().toISOString(),
      enrichmentSources
    };
  }

  /**
   * Extract structured enrichment data for storage
   * Normalizes data from all sources into a consistent format
   * Handles both structured responses and text messages from Probe42 v2 API
   */
  extractEnrichmentData(enrichment: Awaited<ReturnType<typeof this.getFullEnrichment>>): {
    employeeCount?: number;
    gstStatus?: string;
    gstNumber?: string;
    creditRating?: string;
    creditRatingAgency?: string;
    creditRatingOutlook?: string;
    activeLegalCases?: number;
    suitFiledCases?: number;
    openChargesCount?: number;
    totalChargesAmount?: number;
    chargeHolders?: string[];
    directors?: Array<{
      din: string;
      name: string;
      designation?: string;
      email?: string;
      phone?: string;
      otherCompaniesCount?: number;
    }>;
    riskIndicators: string[];
    enrichmentScore: number;
    apiAccessIssues: string[];
    dataNotAvailable: string[];
  } {
    const riskIndicators: string[] = [];
    const apiAccessIssues: string[] = [];
    const dataNotAvailable: string[] = [];
    let enrichmentScore = 0;

    // Helper to check if response is a "not available" message
    const isNotAvailableMessage = (data: any): boolean => {
      if (typeof data === 'string') {
        const noDataPhrases = [
          'does not have', 'do not have', 'not available', 'no records',
          'as per our records', 'not appear to have', 'neither pending nor disposed'
        ];
        return noDataPhrases.some(phrase => data.toLowerCase().includes(phrase.toLowerCase()));
      }
      return false;
    };

    // EPFO - Employee count
    let employeeCount: number | undefined;
    if (enrichment.epfo === null) {
      apiAccessIssues.push('EPFO (Employee data) - API access denied');
    } else if (isNotAvailableMessage(enrichment.epfo)) {
      dataNotAvailable.push('Employee count');
    } else if (enrichment.epfo && typeof enrichment.epfo === 'object') {
      employeeCount = enrichment.epfo?.employee_count || 
                      enrichment.epfo?.employeeCount ||
                      enrichment.epfo?.total_employees;
      if (employeeCount) enrichmentScore += 10;
    }

    // GST Status - handle string responses
    let gstStatus: string | undefined;
    let gstNumber: string | undefined;
    if (isNotAvailableMessage(enrichment.gst)) {
      gstStatus = 'Not Registered';
      dataNotAvailable.push('GST');
      enrichmentScore += 5; // We know status even if negative
    } else if (enrichment.gst && typeof enrichment.gst === 'object') {
      gstStatus = enrichment.gst?.status || enrichment.gst?.gst_status;
      gstNumber = enrichment.gst?.gstin || enrichment.gst?.gst_number;
      if (gstNumber) enrichmentScore += 10;
      if (gstStatus === 'Cancelled' || gstStatus === 'Suspended') {
        riskIndicators.push(`GST ${gstStatus}`);
      }
    }

    // Credit Ratings - handle string responses
    let creditRating: string | undefined;
    let creditRatingAgency: string | undefined;
    let creditRatingOutlook: string | undefined;
    if (isNotAvailableMessage(enrichment.creditRatings)) {
      creditRating = 'Not Rated';
      dataNotAvailable.push('Credit Rating');
      enrichmentScore += 5; // We know there's no rating
    } else if (enrichment.creditRatings && typeof enrichment.creditRatings === 'object') {
      creditRating = enrichment.creditRatings?.rating || 
                     enrichment.creditRatings?.credit_rating ||
                     (Array.isArray(enrichment.creditRatings) && enrichment.creditRatings[0]?.rating);
      creditRatingAgency = enrichment.creditRatings?.agency ||
                           enrichment.creditRatings?.rating_agency ||
                           (Array.isArray(enrichment.creditRatings) && enrichment.creditRatings[0]?.agency);
      creditRatingOutlook = enrichment.creditRatings?.outlook ||
                            (Array.isArray(enrichment.creditRatings) && enrichment.creditRatings[0]?.outlook);
      if (creditRating) enrichmentScore += 15;
      if (creditRatingOutlook === 'Negative') {
        riskIndicators.push('Credit outlook negative');
      }
    }

    // KYC/Director data - check for access issues
    if (enrichment.kyc === null) {
      apiAccessIssues.push('KYC (Financials & Directors) - API access denied');
    }
    if (enrichment.directorNetwork === null) {
      apiAccessIssues.push('Director Network - API access denied');
    }

    // Legal History - handle string responses
    let activeLegalCases = 0;
    if (isNotAvailableMessage(enrichment.legalHistory)) {
      dataNotAvailable.push('Legal History');
      enrichmentScore += 5; // Clean record
    } else {
      const legalCases = Array.isArray(enrichment.legalHistory) 
        ? enrichment.legalHistory 
        : enrichment.legalHistory?.cases || [];
      activeLegalCases = legalCases.filter((c: any) => 
        c.status === 'Active' || c.status === 'Pending'
      ).length;
      if (activeLegalCases > 0) {
        riskIndicators.push(`${activeLegalCases} active legal cases`);
      }
    }

    // Suit Filed Cases - handle string responses
    let suitFiledCases = 0;
    if (isNotAvailableMessage(enrichment.suitFiledCases)) {
      dataNotAvailable.push('Suit Filed Cases');
      enrichmentScore += 5; // Clean record
    } else {
      const suitCases = Array.isArray(enrichment.suitFiledCases)
        ? enrichment.suitFiledCases
        : enrichment.suitFiledCases?.cases || [];
      suitFiledCases = suitCases.length;
      if (suitFiledCases > 3) {
        riskIndicators.push(`${suitFiledCases} suit filed cases`);
      }
    }

    // Open Charges
    let openChargesCount = 0;
    let totalChargesAmount = 0;
    let chargeHolders: string[] = [];
    if (Array.isArray(enrichment.openCharges) && enrichment.openCharges.length > 0) {
      const charges = enrichment.openCharges;
      openChargesCount = charges.length;
      totalChargesAmount = charges.reduce((sum: number, c: any) => 
        sum + (c.charge_amount || c.chargeAmount || c.amount || 0), 0
      );
      chargeHolders = [...new Set(charges.map((c: any) => 
        c.charge_holder || c.chargeHolder || c.holder
      ).filter(Boolean))] as string[];
      if (openChargesCount > 0) enrichmentScore += 10;
    } else if (enrichment.openCharges && typeof enrichment.openCharges === 'object' && !Array.isArray(enrichment.openCharges)) {
      const charges = enrichment.openCharges?.charges || [];
      openChargesCount = charges.length;
    }

    // Directors from KYC or base details
    const directorsList = enrichment.kyc?.directors || 
                          enrichment.directorNetwork?.directors ||
                          enrichment.baseDetails?.directors || [];
    const directors = directorsList.map((d: any) => ({
      din: d.din || d.DIN,
      name: d.name || d.director_name || d.directorName,
      designation: d.designation,
      email: d.email || d.email_id,
      phone: d.phone || d.mobile,
      otherCompaniesCount: d.other_companies?.length || d.otherCompanies?.length || 0
    }));
    if (directors.length > 0) enrichmentScore += 15;

    // Extract financials from KYC first, then fallback to baseDetails
    const paidUpCapital = enrichment.kyc?.paid_up_capital || 
                          enrichment.kyc?.paidUpCapital ||
                          enrichment.baseDetails?.paidUpCapital || 
                          enrichment.baseDetails?.paid_up_capital;
    const authorizedCapital = enrichment.kyc?.authorized_capital ||
                              enrichment.kyc?.authorizedCapital ||
                              enrichment.baseDetails?.authorizedCapital || 
                              enrichment.baseDetails?.authorized_capital;
    
    // New KYC fields for comprehensive lead prospecting
    const sumOfCharges = enrichment.kyc?.sum_of_charges || enrichment.kyc?.sumOfCharges;
    const activeCompliance = enrichment.kyc?.active_compliance || enrichment.kyc?.activeCompliance;
    const listingStatus = enrichment.kyc?.listing_status || enrichment.kyc?.listingStatus;
    const entityType = enrichment.kyc?.type_of_entity || enrichment.kyc?.typeOfEntity || enrichment.kyc?.entity_type;
    
    // Additional KYC fields
    const companyStatus = enrichment.kyc?.company_status || enrichment.kyc?.status;
    const rocCode = enrichment.kyc?.roc_code || enrichment.kyc?.rocCode;
    const numberOfMembers = enrichment.kyc?.number_of_members || enrichment.kyc?.numberOfMembers;
    const lastAgmDate = enrichment.kyc?.last_agm_date || enrichment.kyc?.lastAgmDate;
    const lastBalanceSheetDate = enrichment.kyc?.last_balance_sheet_date || enrichment.kyc?.lastBalanceSheetDate;

    // Risk assessment from KYC data
    if (activeCompliance && activeCompliance.toLowerCase().includes('non-compliant')) {
      riskIndicators.push('Non-compliant with regulations');
    }
    if (listingStatus === 'Unlisted' && sumOfCharges && parseFloat(sumOfCharges) > 1000000000) {
      riskIndicators.push('High debt for unlisted company');
    }

    // Base details scoring
    if (enrichment.baseDetails) enrichmentScore += 20;
    if (enrichment.baseDetails?.email) enrichmentScore += 5;
    if (enrichment.baseDetails?.phone) enrichmentScore += 5;
    if (paidUpCapital) enrichmentScore += 10;
    if (sumOfCharges) enrichmentScore += 5;
    if (activeCompliance) enrichmentScore += 5;
    if (listingStatus) enrichmentScore += 5;
    if (entityType) enrichmentScore += 5;

    return {
      employeeCount,
      gstStatus,
      gstNumber,
      creditRating,
      creditRatingAgency,
      creditRatingOutlook,
      activeLegalCases,
      suitFiledCases,
      openChargesCount,
      totalChargesAmount,
      chargeHolders,
      directors,
      riskIndicators,
      apiAccessIssues,
      dataNotAvailable,
      enrichmentScore: Math.min(100, enrichmentScore),
      paidUpCapital,
      authorizedCapital,
      // New KYC fields
      sumOfCharges,
      activeCompliance,
      listingStatus,
      entityType,
      companyStatus,
      rocCode,
      numberOfMembers,
      lastAgmDate,
      lastBalanceSheetDate
    };
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

/**
 * Enrich an unlisted company with MCA financial data
 * Fetches financials, charges, credit ratings and stores in companyFinancials table
 */
export async function enrichUnlistedCompanyWithMCAData(
  companyId: string,
  cin: string
): Promise<{
  success: boolean;
  enrichedData?: {
    financials: any[];
    charges: any;
    creditRatings: any;
    legalCases: any;
    directors: any[];
  };
  financialsStored?: number;
  message: string;
}> {
  try {
    const probe42 = getProbe42Service();
    
    console.log(`🔄 Enriching unlisted company ${companyId} (CIN: ${cin}) with MCA data...`);
    
    // Fetch comprehensive data from Probe42
    const enrichment = await probe42.getFullEnrichment(cin);
    
    if (!enrichment.baseDetails && !enrichment.kyc) {
      return {
        success: false,
        message: 'Failed to fetch company data from MCA/Probe42'
      };
    }
    
    // Extract enrichment data
    const extractedData = probe42.extractEnrichmentData(enrichment);
    
    // Get financials from KYC endpoint
    const financials = enrichment.kyc?.financials || [];
    const directors = enrichment.kyc?.directors || extractedData?.directors || [];
    
    // Store financials in database
    const { db } = await import('./db');
    const { companyFinancials, unlistedCompanies } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    let financialsStored = 0;
    
    for (const financial of financials) {
      const financialYear = financial.year || financial.financial_year || 'Unknown';
      
      // Check if record exists
      const [existing] = await db.select()
        .from(companyFinancials)
        .where(eq(companyFinancials.companyId, companyId))
        .limit(1);
      
      const financialData = {
        companyId,
        financialYear,
        revenue: financial.revenue?.toString() || financial.total_income?.toString() || null,
        ebitda: financial.ebitda?.toString() || null,
        pat: financial.netProfit?.toString() || financial.profit_after_tax?.toString() || null,
        netProfit: financial.netProfit?.toString() || financial.profit_after_tax?.toString() || null,
        pbt: financial.profit_before_tax?.toString() || null,
        totalAssets: financial.totalAssets?.toString() || financial.total_assets?.toString() || null,
        totalLiabilities: financial.totalLiabilities?.toString() || financial.total_liabilities?.toString() || null,
        networth: financial.shareholderFunds?.toString() || financial.net_worth?.toString() || null,
        totalDebt: (
          (parseFloat(financial.long_term_borrowings || '0') + 
           parseFloat(financial.short_term_borrowings || '0')) || null
        )?.toString(),
        longTermDebt: financial.long_term_borrowings?.toString() || null,
        shortTermDebt: financial.short_term_borrowings?.toString() || null,
        shareCapital: financial.share_capital?.toString() || null,
        reserves: financial.reserves?.toString() || null,
        dataSource: 'probe42',
        verified: true,
        confidenceScore: '0.95',
        aiAllowed: true,
        executionAllowed: true,
      };
      
      if (existing) {
        await db.update(companyFinancials)
          .set({ ...financialData, updatedAt: new Date() })
          .where(eq(companyFinancials.id, existing.id));
      } else {
        await db.insert(companyFinancials).values(financialData);
      }
      financialsStored++;
    }
    
    // Update unlisted company with enriched data
    await db.update(unlistedCompanies)
      .set({
        lastSyncedAt: new Date(),
        directors: directors,
        probe42RawResponse: enrichment,
        identityConfidence: '0.95',
        identityStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(unlistedCompanies.id, companyId));
    
    console.log(`✅ Enriched ${companyId} with ${financialsStored} financial records`);
    
    return {
      success: true,
      enrichedData: {
        financials,
        charges: enrichment.openCharges,
        creditRatings: enrichment.creditRatings,
        legalCases: enrichment.suitFiledCases,
        directors,
      },
      financialsStored,
      message: `Successfully enriched with ${financialsStored} financial records`
    };
  } catch (error: any) {
    console.error(`❌ Failed to enrich unlisted company ${companyId}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to enrich company data'
    };
  }
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
