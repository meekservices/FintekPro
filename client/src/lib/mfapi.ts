export interface MutualFundData {
  scheme_code: string;
  scheme_name: string;
  nav: string;
  date: string;
  fund_house?: string;
  category?: string;
}

export interface MutualFundList {
  scheme_code: string;
  scheme_name: string;
}

const MF_API_BASE = 'https://api.mfapi.in';

export async function fetchAllMutualFunds(): Promise<MutualFundList[]> {
  try {
    const response = await fetch(`${MF_API_BASE}/mf`);
    if (!response.ok) {
      throw new Error(`MFAPI error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching all mutual funds:', error);
    throw error;
  }
}

export async function fetchMutualFundDetails(schemeCode: string): Promise<MutualFundData> {
  try {
    const response = await fetch(`${MF_API_BASE}/mf/${schemeCode}`);
    if (!response.ok) {
      throw new Error(`MFAPI error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return {
      scheme_code: schemeCode,
      scheme_name: data.meta?.scheme_name || 'Unknown Fund',
      nav: data.data?.[0]?.nav || '0',
      date: data.data?.[0]?.date || new Date().toISOString().split('T')[0],
      fund_house: data.meta?.fund_house || 'Unknown AMC',
      category: data.meta?.scheme_category || 'Unknown Category'
    };
  } catch (error) {
    console.error(`Error fetching mutual fund ${schemeCode}:`, error);
    throw error;
  }
}

export async function fetchMutualFundHistorical(schemeCode: string): Promise<Array<{date: string, nav: string}>> {
  try {
    const response = await fetch(`${MF_API_BASE}/mf/${schemeCode}`);
    if (!response.ok) {
      throw new Error(`MFAPI error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching historical data for ${schemeCode}:`, error);
    throw error;
  }
}

// Popular mutual fund scheme codes for quick access
export const POPULAR_MF_SCHEMES = [
  { code: '120503', name: 'SBI Bluechip Fund - Direct Growth' },
  { code: '119551', name: 'ICICI Prudential Bluechip Fund - Direct Growth' },
  { code: '118989', name: 'Axis Bluechip Fund - Direct Growth' },
  { code: '120716', name: 'Mirae Asset Large Cap Fund - Direct Growth' },
  { code: '146802', name: 'Parag Parikh Long Term Equity Fund - Direct Growth' },
  { code: '120503', name: 'SBI Small Cap Fund - Direct Growth' },
  { code: '119226', name: 'Kotak Small Cap Fund - Direct Growth' },
  { code: '118834', name: 'DSP Tax Saver Fund - Direct Growth' },
  { code: '119785', name: 'Axis Long Term Equity Fund - Direct Growth' },
  { code: '118525', name: 'SBI Long Term Equity Fund - Direct Growth' }
];

// Categories for filtering
export const MF_CATEGORIES = [
  'Equity',
  'Debt',
  'Hybrid',
  'Solution Oriented',
  'Other',
  'ELSS',
  'Index Fund',
  'ETF'
];