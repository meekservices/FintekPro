import { NseIndia } from 'stock-nse-india';
import axios from 'axios';
import { db } from '../db';
import { listedStocks } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const nse = new NseIndia();

interface BseScripData {
  symbol: string;
  bseCode: string;
  companyName: string;
  isin?: string;
  industry?: string;
  group?: string;
}

export interface ExchangeStockData {
  symbol: string;
  companyName: string;
  isin?: string;
  exchange: 'NSE' | 'BSE';
  sector?: string;
  industry?: string;
  marketCap?: string;
  marketCapValue?: number;
  currentPrice?: number;
  previousClose?: number;
  dayChange?: number;
  dayChangePercent?: number;
  weekHigh52?: number;
  weekLow52?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  eps?: number;
  returns1Y?: number;
  returns3Y?: number;
  analystRating?: string;
  bseCode?: string;
  nseCode?: string;
}

export interface SyncProgress {
  exchange: 'NSE' | 'BSE';
  status: 'idle' | 'fetching_symbols' | 'fetching_details' | 'saving' | 'complete' | 'error';
  total: number;
  processed: number;
  added: number;
  updated: number;
  errors: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

class ExchangeStockService {
  private nseProgress: SyncProgress = { exchange: 'NSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
  private bseProgress: SyncProgress = { exchange: 'BSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  getSyncProgress(exchange: 'NSE' | 'BSE'): SyncProgress {
    return exchange === 'NSE' ? { ...this.nseProgress } : { ...this.bseProgress };
  }

  async getAllNSESymbols(): Promise<string[]> {
    const cacheKey = 'nse_symbols';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const symbols = await nse.getAllStockSymbols();
      this.cache.set(cacheKey, { data: symbols, timestamp: Date.now() });
      return symbols;
    } catch (error) {
      console.error('[Exchange Service] Failed to fetch NSE symbols:', error);
      throw error;
    }
  }

  async getAllBSESymbols(): Promise<BseScripData[]> {
    const cacheKey = 'bse_symbols';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      console.log('[Exchange Service] Fetching BSE equity list from BSE India API...');
      
      const response = await axios.get('https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w', {
        params: {
          Group: 'A,B,T,S,TS,Z,P,F,M,X,IF,ST,IP,IG,OF,XT,MF,XD,XC,IT,ND,EQ',
          Atea: '',
          scripcode: ''
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.bseindia.com/'
        },
        timeout: 30000
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.warn('[Exchange Service] BSE API returned unexpected format, using fallback');
        return this.getExtendedBSEStocks();
      }

      const scrips: BseScripData[] = response.data
        .filter((item: any) => item.scrip_cd && item.SCRIP_NAME)
        .map((item: any) => ({
          symbol: (item.scrip_id || item.SCRIP_NAME || '').replace(/\s+/g, '').toUpperCase(),
          bseCode: String(item.scrip_cd),
          companyName: item.LONG_NAME || item.SCRIP_NAME || '',
          isin: item.ISIN_NUMBER || item.isin_code,
          industry: item.Industry || item.INDUSTRY,
          group: item.Scrip_grp || item.GROUP_NAME
        }));

      console.log(`[Exchange Service] Fetched ${scrips.length} BSE scrips from API`);
      this.cache.set(cacheKey, { data: scrips, timestamp: Date.now() });
      return scrips;
    } catch (error) {
      console.warn('[Exchange Service] BSE API failed, using extended fallback list:', error);
      const fallback = this.getExtendedBSEStocks();
      this.cache.set(cacheKey, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  private getExtendedBSEStocks(): BseScripData[] {
    return [
      { symbol: 'RELIANCE', bseCode: '500325', companyName: 'Reliance Industries Ltd.' },
      { symbol: 'TCS', bseCode: '532540', companyName: 'Tata Consultancy Services Ltd.' },
      { symbol: 'HDFCBANK', bseCode: '500180', companyName: 'HDFC Bank Ltd.' },
      { symbol: 'INFY', bseCode: '500209', companyName: 'Infosys Ltd.' },
      { symbol: 'ICICIBANK', bseCode: '532174', companyName: 'ICICI Bank Ltd.' },
      { symbol: 'HINDUNILVR', bseCode: '500696', companyName: 'Hindustan Unilever Ltd.' },
      { symbol: 'ITC', bseCode: '500875', companyName: 'ITC Ltd.' },
      { symbol: 'SBIN', bseCode: '500112', companyName: 'State Bank of India' },
      { symbol: 'BHARTIARTL', bseCode: '532454', companyName: 'Bharti Airtel Ltd.' },
      { symbol: 'KOTAKBANK', bseCode: '500247', companyName: 'Kotak Mahindra Bank Ltd.' },
      { symbol: 'LT', bseCode: '500510', companyName: 'Larsen & Toubro Ltd.' },
      { symbol: 'AXISBANK', bseCode: '532215', companyName: 'Axis Bank Ltd.' },
      { symbol: 'BAJFINANCE', bseCode: '500034', companyName: 'Bajaj Finance Ltd.' },
      { symbol: 'ASIANPAINT', bseCode: '500820', companyName: 'Asian Paints Ltd.' },
      { symbol: 'MARUTI', bseCode: '532500', companyName: 'Maruti Suzuki India Ltd.' },
      { symbol: 'HCLTECH', bseCode: '532281', companyName: 'HCL Technologies Ltd.' },
      { symbol: 'WIPRO', bseCode: '507685', companyName: 'Wipro Ltd.' },
      { symbol: 'SUNPHARMA', bseCode: '524715', companyName: 'Sun Pharmaceutical Industries Ltd.' },
      { symbol: 'ULTRACEMCO', bseCode: '532538', companyName: 'UltraTech Cement Ltd.' },
      { symbol: 'TITAN', bseCode: '500114', companyName: 'Titan Company Ltd.' },
      { symbol: 'NTPC', bseCode: '532555', companyName: 'NTPC Ltd.' },
      { symbol: 'ONGC', bseCode: '500312', companyName: 'Oil and Natural Gas Corporation Ltd.' },
      { symbol: 'POWERGRID', bseCode: '532898', companyName: 'Power Grid Corporation of India Ltd.' },
      { symbol: 'TECHM', bseCode: '532755', companyName: 'Tech Mahindra Ltd.' },
      { symbol: 'M&M', bseCode: '500520', companyName: 'Mahindra & Mahindra Ltd.' },
      { symbol: 'NESTLEIND', bseCode: '500790', companyName: 'Nestle India Ltd.' },
      { symbol: 'TATAMOTORS', bseCode: '500570', companyName: 'Tata Motors Ltd.' },
      { symbol: 'JSWSTEEL', bseCode: '500228', companyName: 'JSW Steel Ltd.' },
      { symbol: 'TATASTEEL', bseCode: '500470', companyName: 'Tata Steel Ltd.' },
      { symbol: 'INDUSINDBK', bseCode: '532187', companyName: 'IndusInd Bank Ltd.' },
      { symbol: 'ADANIENT', bseCode: '512599', companyName: 'Adani Enterprises Ltd.' },
      { symbol: 'BAJAJFINSV', bseCode: '532978', companyName: 'Bajaj Finserv Ltd.' },
      { symbol: 'COALINDIA', bseCode: '533278', companyName: 'Coal India Ltd.' },
      { symbol: 'GRASIM', bseCode: '500300', companyName: 'Grasim Industries Ltd.' },
      { symbol: 'DIVISLAB', bseCode: '532488', companyName: 'Divis Laboratories Ltd.' },
      { symbol: 'CIPLA', bseCode: '500087', companyName: 'Cipla Ltd.' },
      { symbol: 'DRREDDY', bseCode: '500124', companyName: 'Dr. Reddys Laboratories Ltd.' },
      { symbol: 'BRITANNIA', bseCode: '500825', companyName: 'Britannia Industries Ltd.' },
      { symbol: 'EICHERMOT', bseCode: '505200', companyName: 'Eicher Motors Ltd.' },
      { symbol: 'BPCL', bseCode: '500547', companyName: 'Bharat Petroleum Corporation Ltd.' },
      { symbol: 'HEROMOTOCO', bseCode: '500182', companyName: 'Hero MotoCorp Ltd.' },
      { symbol: 'APOLLOHOSP', bseCode: '508869', companyName: 'Apollo Hospitals Enterprise Ltd.' },
      { symbol: 'TATACONSUM', bseCode: '500800', companyName: 'Tata Consumer Products Ltd.' },
      { symbol: 'SBILIFE', bseCode: '540719', companyName: 'SBI Life Insurance Company Ltd.' },
      { symbol: 'HINDALCO', bseCode: '500440', companyName: 'Hindalco Industries Ltd.' },
      { symbol: 'ADANIPORTS', bseCode: '532921', companyName: 'Adani Ports and Special Economic Zone Ltd.' },
      { symbol: 'HDFCLIFE', bseCode: '540777', companyName: 'HDFC Life Insurance Company Ltd.' },
      { symbol: 'BAJAJ-AUTO', bseCode: '532977', companyName: 'Bajaj Auto Ltd.' },
      { symbol: 'SHREECEM', bseCode: '500387', companyName: 'Shree Cement Ltd.' },
      { symbol: 'UPL', bseCode: '512070', companyName: 'UPL Ltd.' },
      { symbol: 'AMBUJACEM', bseCode: '500425', companyName: 'Ambuja Cements Ltd.' },
      { symbol: 'BANKBARODA', bseCode: '532134', companyName: 'Bank of Baroda' },
      { symbol: 'BERGEPAINT', bseCode: '509480', companyName: 'Berger Paints India Ltd.' },
      { symbol: 'BIOCON', bseCode: '532523', companyName: 'Biocon Ltd.' },
      { symbol: 'BOSCHLTD', bseCode: '500530', companyName: 'Bosch Ltd.' },
      { symbol: 'CHOLAFIN', bseCode: '511243', companyName: 'Cholamandalam Investment and Finance Company Ltd.' },
      { symbol: 'COLPAL', bseCode: '500830', companyName: 'Colgate-Palmolive (India) Ltd.' },
      { symbol: 'CONCOR', bseCode: '531344', companyName: 'Container Corporation of India Ltd.' },
      { symbol: 'DABUR', bseCode: '500096', companyName: 'Dabur India Ltd.' },
      { symbol: 'DLF', bseCode: '532868', companyName: 'DLF Ltd.' },
      { symbol: 'GAIL', bseCode: '532155', companyName: 'GAIL (India) Ltd.' },
      { symbol: 'GODREJCP', bseCode: '532424', companyName: 'Godrej Consumer Products Ltd.' },
      { symbol: 'HAVELLS', bseCode: '517354', companyName: 'Havells India Ltd.' },
      { symbol: 'ICICIGI', bseCode: '540716', companyName: 'ICICI Lombard General Insurance Company Ltd.' },
      { symbol: 'ICICIPRULI', bseCode: '540133', companyName: 'ICICI Prudential Life Insurance Company Ltd.' },
      { symbol: 'INDHOTEL', bseCode: '500850', companyName: 'The Indian Hotels Company Ltd.' },
      { symbol: 'INDUSTOWER', bseCode: '534816', companyName: 'Indus Towers Ltd.' },
      { symbol: 'IOC', bseCode: '530965', companyName: 'Indian Oil Corporation Ltd.' },
      { symbol: 'IRCTC', bseCode: '542830', companyName: 'Indian Railway Catering and Tourism Corporation Ltd.' },
      { symbol: 'JINDALSTEL', bseCode: '532286', companyName: 'Jindal Steel & Power Ltd.' },
      { symbol: 'LICI', bseCode: '543526', companyName: 'Life Insurance Corporation of India' },
      { symbol: 'LUPIN', bseCode: '500257', companyName: 'Lupin Ltd.' },
      { symbol: 'MARICO', bseCode: '531642', companyName: 'Marico Ltd.' },
      { symbol: 'MCDOWELL-N', bseCode: '532432', companyName: 'United Spirits Ltd.' },
      { symbol: 'MUTHOOTFIN', bseCode: '533398', companyName: 'Muthoot Finance Ltd.' },
      { symbol: 'NAUKRI', bseCode: '532777', companyName: 'Info Edge (India) Ltd.' },
      { symbol: 'NMDC', bseCode: '526371', companyName: 'NMDC Ltd.' },
      { symbol: 'PAGEIND', bseCode: '532827', companyName: 'Page Industries Ltd.' },
      { symbol: 'PEL', bseCode: '500302', companyName: 'Piramal Enterprises Ltd.' },
      { symbol: 'PETRONET', bseCode: '532522', companyName: 'Petronet LNG Ltd.' },
      { symbol: 'PFC', bseCode: '532810', companyName: 'Power Finance Corporation Ltd.' },
      { symbol: 'PIDILITIND', bseCode: '500331', companyName: 'Pidilite Industries Ltd.' },
      { symbol: 'PIIND', bseCode: '523642', companyName: 'PI Industries Ltd.' },
      { symbol: 'PNB', bseCode: '532461', companyName: 'Punjab National Bank' },
      { symbol: 'RECLTD', bseCode: '532955', companyName: 'REC Ltd.' },
      { symbol: 'SRF', bseCode: '503806', companyName: 'SRF Ltd.' },
      { symbol: 'TATAPOWER', bseCode: '500400', companyName: 'Tata Power Company Ltd.' },
      { symbol: 'TORNTPHARM', bseCode: '500420', companyName: 'Torrent Pharmaceuticals Ltd.' },
      { symbol: 'TRENT', bseCode: '500251', companyName: 'Trent Ltd.' },
      { symbol: 'VEDL', bseCode: '500295', companyName: 'Vedanta Ltd.' },
      { symbol: 'ETERNAL', bseCode: '543320', companyName: 'Eternal Ltd.' },
      { symbol: 'DMART', bseCode: '540376', companyName: 'Avenue Supermarts Ltd.' },
      { symbol: 'ADANIGREEN', bseCode: '541450', companyName: 'Adani Green Energy Ltd.' },
      { symbol: 'ADANITRANS', bseCode: '539254', companyName: 'Adani Transmission Ltd.' },
      { symbol: 'ATGL', bseCode: '542066', companyName: 'Adani Total Gas Ltd.' },
      { symbol: 'HAL', bseCode: '541154', companyName: 'Hindustan Aeronautics Ltd.' },
      { symbol: 'BEL', bseCode: '500049', companyName: 'Bharat Electronics Ltd.' },
      { symbol: 'NHPC', bseCode: '533098', companyName: 'NHPC Ltd.' },
      { symbol: 'IRFC', bseCode: '543257', companyName: 'Indian Railway Finance Corporation Ltd.' },
      { symbol: 'PAYTM', bseCode: '543396', companyName: 'One 97 Communications Ltd.' },
      { symbol: 'NYKAA', bseCode: '543384', companyName: 'FSN E-Commerce Ventures Ltd.' },
      { symbol: 'POLICYBZR', bseCode: '543390', companyName: 'PB Fintech Ltd.' },
      { symbol: 'CARTRADE', bseCode: '543356', companyName: 'CarTrade Tech Ltd.' },
      { symbol: 'STARHEALTH', bseCode: '543412', companyName: 'Star Health and Allied Insurance Company Ltd.' },
      { symbol: 'MOTHERSON', bseCode: '517334', companyName: 'Motherson Sumi Systems Ltd.' },
      { symbol: 'AUBANK', bseCode: '540611', companyName: 'AU Small Finance Bank Ltd.' },
      { symbol: 'BANDHANBNK', bseCode: '541153', companyName: 'Bandhan Bank Ltd.' },
      { symbol: 'FEDERALBNK', bseCode: '500469', companyName: 'Federal Bank Ltd.' },
      { symbol: 'IDFCFIRSTB', bseCode: '539437', companyName: 'IDFC First Bank Ltd.' },
      { symbol: 'RBLBANK', bseCode: '540065', companyName: 'RBL Bank Ltd.' },
      { symbol: 'YESBANK', bseCode: '532648', companyName: 'Yes Bank Ltd.' },
      { symbol: 'CANBK', bseCode: '532483', companyName: 'Canara Bank' },
      { symbol: 'UNIONBANK', bseCode: '532477', companyName: 'Union Bank of India' },
      { symbol: 'INDIANB', bseCode: '532814', companyName: 'Indian Bank' },
      { symbol: 'IOB', bseCode: '532388', companyName: 'Indian Overseas Bank' },
      { symbol: 'BANKINDIA', bseCode: '532149', companyName: 'Bank of India' },
      { symbol: 'CENTRALBK', bseCode: '532885', companyName: 'Central Bank of India' },
      { symbol: 'IDBI', bseCode: '500116', companyName: 'IDBI Bank Ltd.' },
      { symbol: 'MAHABANK', bseCode: '532525', companyName: 'Bank of Maharashtra' },
      { symbol: 'PSB', bseCode: '533295', companyName: 'Punjab & Sind Bank' },
      { symbol: 'UCOBANK', bseCode: '532505', companyName: 'UCO Bank' },
      { symbol: 'J&KBANK', bseCode: '532209', companyName: 'Jammu & Kashmir Bank Ltd.' },
      { symbol: 'SOUTHBANK', bseCode: '532218', companyName: 'South Indian Bank Ltd.' },
      { symbol: 'KARURVYSYA', bseCode: '590003', companyName: 'Karur Vysya Bank Ltd.' },
      { symbol: 'DCBBANK', bseCode: '532772', companyName: 'DCB Bank Ltd.' },
      { symbol: 'CUB', bseCode: '532210', companyName: 'City Union Bank Ltd.' },
      { symbol: 'TMB', bseCode: '543483', companyName: 'Tamilnad Mercantile Bank Ltd.' },
      { symbol: 'EQUITASBNK', bseCode: '543243', companyName: 'Equitas Small Finance Bank Ltd.' },
      { symbol: 'UJJIVANSFB', bseCode: '542904', companyName: 'Ujjivan Small Finance Bank Ltd.' },
      { symbol: 'ESAFSFB', bseCode: '543561', companyName: 'ESAF Small Finance Bank Ltd.' },
      { symbol: 'ADANIPOWER', bseCode: '533096', companyName: 'Adani Power Ltd.' },
      { symbol: 'TATAELXSI', bseCode: '500408', companyName: 'Tata Elxsi Ltd.' },
      { symbol: 'PERSISTENT', bseCode: '533179', companyName: 'Persistent Systems Ltd.' },
      { symbol: 'LTTS', bseCode: '540115', companyName: 'L&T Technology Services Ltd.' },
      { symbol: 'COFORGE', bseCode: '532541', companyName: 'Coforge Ltd.' },
      { symbol: 'MPHASIS', bseCode: '526299', companyName: 'Mphasis Ltd.' },
      { symbol: 'MINDTREE', bseCode: '532819', companyName: 'Mindtree Ltd.' },
      { symbol: 'LTIM', bseCode: '540005', companyName: 'LTIMindtree Ltd.' },
      { symbol: 'HAPPSTMNDS', bseCode: '543227', companyName: 'Happiest Minds Technologies Ltd.' },
      { symbol: 'ROUTE', bseCode: '543228', companyName: 'Route Mobile Ltd.' },
      { symbol: 'KPITTECH', bseCode: '542651', companyName: 'KPIT Technologies Ltd.' },
      { symbol: 'CYIENT', bseCode: '532175', companyName: 'Cyient Ltd.' },
      { symbol: 'TATACOMM', bseCode: '500483', companyName: 'Tata Communications Ltd.' },
      { symbol: 'SYNGENE', bseCode: '539268', companyName: 'Syngene International Ltd.' },
      { symbol: 'ALKEM', bseCode: '539523', companyName: 'Alkem Laboratories Ltd.' },
      { symbol: 'AUROPHARMA', bseCode: '524804', companyName: 'Aurobindo Pharma Ltd.' },
      { symbol: 'ABBOTINDIA', bseCode: '500488', companyName: 'Abbott India Ltd.' },
      { symbol: 'TORNTPOWER', bseCode: '532779', companyName: 'Torrent Power Ltd.' },
      { symbol: 'CUMMINSIND', bseCode: '500480', companyName: 'Cummins India Ltd.' },
      { symbol: 'ABB', bseCode: '500002', companyName: 'ABB India Ltd.' },
      { symbol: 'SIEMENS', bseCode: '500550', companyName: 'Siemens Ltd.' },
      { symbol: 'HONAUT', bseCode: '517174', companyName: 'Honeywell Automation India Ltd.' },
      { symbol: 'BHEL', bseCode: '500103', companyName: 'Bharat Heavy Electricals Ltd.' },
      { symbol: 'THERMAX', bseCode: '500411', companyName: 'Thermax Ltd.' },
      { symbol: 'VOLTAS', bseCode: '500575', companyName: 'Voltas Ltd.' },
      { symbol: 'BLUESTARCO', bseCode: '500067', companyName: 'Blue Star Ltd.' },
      { symbol: 'CROMPTON', bseCode: '539876', companyName: 'Crompton Greaves Consumer Electricals Ltd.' },
      { symbol: 'WHIRLPOOL', bseCode: '500238', companyName: 'Whirlpool of India Ltd.' },
      { symbol: 'DIXON', bseCode: '540699', companyName: 'Dixon Technologies (India) Ltd.' },
      { symbol: 'KAYNES', bseCode: '543664', companyName: 'Kaynes Technology India Ltd.' },
      { symbol: 'AMBER', bseCode: '540902', companyName: 'Amber Enterprises India Ltd.' },
      { symbol: 'AFFLE', bseCode: '542752', companyName: 'Affle (India) Ltd.' },
      { symbol: 'BHARATFORG', bseCode: '500493', companyName: 'Bharat Forge Ltd.' },
      { symbol: 'SUNTV', bseCode: '532733', companyName: 'Sun TV Network Ltd.' },
      { symbol: 'PVRINOX', bseCode: '532689', companyName: 'PVR INOX Ltd.' },
      { symbol: 'APLLTD', bseCode: '506590', companyName: 'Alembic Pharmaceuticals Ltd.' },
      { symbol: 'IPCALAB', bseCode: '524494', companyName: 'Ipca Laboratories Ltd.' },
      { symbol: 'LAURUSLABS', bseCode: '540222', companyName: 'Laurus Labs Ltd.' },
      { symbol: 'NATCOPHARM', bseCode: '524816', companyName: 'Natco Pharma Ltd.' },
      { symbol: 'GLENMARK', bseCode: '532296', companyName: 'Glenmark Pharmaceuticals Ltd.' },
      { symbol: 'ZYDUSLIFE', bseCode: '532321', companyName: 'Zydus Lifesciences Ltd.' },
      { symbol: 'METROPOLIS', bseCode: '542650', companyName: 'Metropolis Healthcare Ltd.' },
      { symbol: 'LALPATHLAB', bseCode: '539524', companyName: 'Dr. Lal PathLabs Ltd.' },
      { symbol: 'MAXHEALTH', bseCode: '543220', companyName: 'Max Healthcare Institute Ltd.' },
      { symbol: 'FORTIS', bseCode: '532843', companyName: 'Fortis Healthcare Ltd.' },
      { symbol: 'NARAYANA', bseCode: '539551', companyName: 'Narayana Hrudayalaya Ltd.' },
      { symbol: 'AAVAS', bseCode: '541988', companyName: 'Aavas Financiers Ltd.' },
      { symbol: 'CANFINHOME', bseCode: '511196', companyName: 'Can Fin Homes Ltd.' },
      { symbol: 'LICHSGFIN', bseCode: '500253', companyName: 'LIC Housing Finance Ltd.' },
      { symbol: 'PNBHOUSING', bseCode: '540173', companyName: 'PNB Housing Finance Ltd.' },
      { symbol: 'SBICARD', bseCode: '543066', companyName: 'SBI Cards and Payment Services Ltd.' },
      { symbol: 'MANAPPURAM', bseCode: '531213', companyName: 'Manappuram Finance Ltd.' },
      { symbol: 'MAHLIFE', bseCode: '532313', companyName: 'Mahindra Lifespace Developers Ltd.' },
      { symbol: 'GODREJPROP', bseCode: '533150', companyName: 'Godrej Properties Ltd.' },
      { symbol: 'OBEROIRLTY', bseCode: '533273', companyName: 'Oberoi Realty Ltd.' },
      { symbol: 'PRESTIGE', bseCode: '533274', companyName: 'Prestige Estates Projects Ltd.' },
      { symbol: 'SOBHA', bseCode: '532784', companyName: 'Sobha Ltd.' },
      { symbol: 'BRIGADE', bseCode: '532929', companyName: 'Brigade Enterprises Ltd.' },
      { symbol: 'PHOENIXLTD', bseCode: '503100', companyName: 'The Phoenix Mills Ltd.' },
      { symbol: 'UNITDSPR', bseCode: '543340', companyName: 'United Spirits Ltd.' },
      { symbol: 'VBL', bseCode: '500295', companyName: 'Varun Beverages Ltd.' },
      { symbol: 'JUBLFOOD', bseCode: '533155', companyName: 'Jubilant Foodworks Ltd.' },
      { symbol: 'DEVYANI', bseCode: '543330', companyName: 'Devyani International Ltd.' },
      { symbol: 'SAPPHIRE', bseCode: '543331', companyName: 'Sapphire Foods India Ltd.' },
      { symbol: 'RAJESHEXPO', bseCode: '531500', companyName: 'Rajesh Exports Ltd.' },
      { symbol: 'TITAN', bseCode: '500114', companyName: 'Titan Company Ltd.' },
      { symbol: 'KALYAN', bseCode: '543278', companyName: 'Kalyan Jewellers India Ltd.' },
      { symbol: 'SENCO', bseCode: '543305', companyName: 'Senco Gold Ltd.' },
      { symbol: 'VAIBHAVGBL', bseCode: '532156', companyName: 'Vaibhav Global Ltd.' },
      { symbol: 'BATAINDIA', bseCode: '500043', companyName: 'Bata India Ltd.' },
      { symbol: 'RELAXO', bseCode: '530517', companyName: 'Relaxo Footwears Ltd.' },
      { symbol: 'METROBRAND', bseCode: '543426', companyName: 'Metro Brands Ltd.' },
      { symbol: 'CAMPUS', bseCode: '543523', companyName: 'Campus Activewear Ltd.' },
      { symbol: 'AIAENG', bseCode: '532683', companyName: 'AIA Engineering Ltd.' },
      { symbol: 'CARBORUNIV', bseCode: '513375', companyName: 'Carborundum Universal Ltd.' },
      { symbol: 'GRINDWELL', bseCode: '506076', companyName: 'Grindwell Norton Ltd.' },
      { symbol: 'KEI', bseCode: '517569', companyName: 'KEI Industries Ltd.' },
      { symbol: 'POLYCAB', bseCode: '542652', companyName: 'Polycab India Ltd.' },
      { symbol: 'FINOLEX', bseCode: '500144', companyName: 'Finolex Cables Ltd.' },
      { symbol: 'ASTRAL', bseCode: '532830', companyName: 'Astral Ltd.' },
      { symbol: 'SUPREMEIND', bseCode: '517240', companyName: 'Supreme Industries Ltd.' },
      { symbol: 'PRINCEPIPE', bseCode: '542907', companyName: 'Prince Pipes and Fittings Ltd.' },
      { symbol: 'APLAPOLLO', bseCode: '533758', companyName: 'APL Apollo Tubes Ltd.' },
      { symbol: 'JKCEMENT', bseCode: '532644', companyName: 'JK Cement Ltd.' },
      { symbol: 'RAMCOCEM', bseCode: '500260', companyName: 'The Ramco Cements Ltd.' },
      { symbol: 'ACC', bseCode: '500410', companyName: 'ACC Ltd.' },
      { symbol: 'DALBHARAT', bseCode: '542216', companyName: 'Dalmia Bharat Ltd.' },
      { symbol: 'JKPAPER', bseCode: '532162', companyName: 'JK Paper Ltd.' },
      { symbol: 'CENTURYPLY', bseCode: '532548', companyName: 'Century Plyboards (India) Ltd.' },
      { symbol: 'GREENPANEL', bseCode: '542827', companyName: 'Greenpanel Industries Ltd.' },
      { symbol: 'DEEPAKFERT', bseCode: '500645', companyName: 'Deepak Fertilizers and Petrochemicals Corporation Ltd.' },
      { symbol: 'GNFC', bseCode: '500670', companyName: 'Gujarat Narmada Valley Fertilizers & Chemicals Ltd.' },
      { symbol: 'COROMANDEL', bseCode: '506395', companyName: 'Coromandel International Ltd.' },
      { symbol: 'CHAMBAL', bseCode: '500085', companyName: 'Chambal Fertilizers and Chemicals Ltd.' },
      { symbol: 'ATUL', bseCode: '500027', companyName: 'Atul Ltd.' },
      { symbol: 'BASF', bseCode: '500042', companyName: 'BASF India Ltd.' },
      { symbol: 'NAVINFLUOR', bseCode: '532504', companyName: 'Navin Fluorine International Ltd.' },
      { symbol: 'AARTIIND', bseCode: '524208', companyName: 'Aarti Industries Ltd.' },
      { symbol: 'DEEPAKNTR', bseCode: '506401', companyName: 'Deepak Nitrite Ltd.' },
      { symbol: 'VINATIORGA', bseCode: '542626', companyName: 'Vinati Organics Ltd.' },
      { symbol: 'CLEAN', bseCode: '542066', companyName: 'Clean Science and Technology Ltd.' },
      { symbol: 'FINEORG', bseCode: '541557', companyName: 'Fine Organic Industries Ltd.' },
      { symbol: 'ALKYLAMINE', bseCode: '506767', companyName: 'Alkyl Amines Chemicals Ltd.' },
      { symbol: 'BALRAMCHIN', bseCode: '500038', companyName: 'Balrampur Chini Mills Ltd.' },
      { symbol: 'RENUKA', bseCode: '532670', companyName: 'Shree Renuka Sugars Ltd.' },
      { symbol: 'EIDPARRY', bseCode: '500125', companyName: 'E.I.D. Parry (India) Ltd.' },
      { symbol: 'DWARIKESH', bseCode: '532610', companyName: 'Dwarikesh Sugar Industries Ltd.' },
      { symbol: 'TRIVENI', bseCode: '532356', companyName: 'Triveni Engineering & Industries Ltd.' },
      { symbol: 'ASHOKLEY', bseCode: '500477', companyName: 'Ashok Leyland Ltd.' },
      { symbol: 'EXIDEIND', bseCode: '500086', companyName: 'Exide Industries Ltd.' },
      { symbol: 'AMARAJABAT', bseCode: '500008', companyName: 'Amara Raja Batteries Ltd.' },
      { symbol: 'BALKRISIND', bseCode: '502355', companyName: 'Balkrishna Industries Ltd.' },
      { symbol: 'APOLLOTYRE', bseCode: '500877', companyName: 'Apollo Tyres Ltd.' },
      { symbol: 'CEAT', bseCode: '500878', companyName: 'CEAT Ltd.' },
      { symbol: 'MRF', bseCode: '500290', companyName: 'MRF Ltd.' },
      { symbol: 'JKTYRE', bseCode: '530007', companyName: 'JK Tyre & Industries Ltd.' },
      { symbol: 'SCHAEFFLER', bseCode: '505790', companyName: 'Schaeffler India Ltd.' },
      { symbol: 'SKFINDIA', bseCode: '500472', companyName: 'SKF India Ltd.' },
      { symbol: 'TIMKEN', bseCode: '522113', companyName: 'Timken India Ltd.' },
      { symbol: 'FIVESTAR', bseCode: '543337', companyName: 'Five-Star Business Finance Ltd.' },
      { symbol: 'CREDITACC', bseCode: '541770', companyName: 'CreditAccess Grameen Ltd.' },
      { symbol: 'SPANDANA', bseCode: '542759', companyName: 'Spandana Sphoorty Financial Ltd.' },
      { symbol: 'UJJIVAN', bseCode: '539874', companyName: 'Ujjivan Financial Services Ltd.' },
      { symbol: 'L&TFH', bseCode: '533519', companyName: 'L&T Finance Holdings Ltd.' },
      { symbol: 'SUNDARAM', bseCode: '590071', companyName: 'Sundaram Finance Ltd.' },
      { symbol: 'SHRIRAMFIN', bseCode: '511218', companyName: 'Shriram Finance Ltd.' },
      { symbol: 'MASFIN', bseCode: '540749', companyName: 'MAS Financial Services Ltd.' },
      { symbol: 'POONAWALLA', bseCode: '543285', companyName: 'Poonawalla Fincorp Ltd.' },
      { symbol: 'MOTILALOFS', bseCode: '532892', companyName: 'Motilal Oswal Financial Services Ltd.' },
      { symbol: 'ANGEL', bseCode: '543235', companyName: 'Angel One Ltd.' },
      { symbol: 'FINCABLES', bseCode: '500144', companyName: 'Finolex Cables Ltd.' },
      { symbol: 'HINDCOPPER', bseCode: '513599', companyName: 'Hindustan Copper Ltd.' },
      { symbol: 'NATIONALUM', bseCode: '532234', companyName: 'National Aluminium Company Ltd.' },
      { symbol: 'MOIL', bseCode: '533286', companyName: 'MOIL Ltd.' },
      { symbol: 'GMRINFRA', bseCode: '532754', companyName: 'GMR Airports Infrastructure Ltd.' },
      { symbol: 'IRCON', bseCode: '541956', companyName: 'Ircon International Ltd.' },
      { symbol: 'RVNL', bseCode: '542649', companyName: 'Rail Vikas Nigam Ltd.' },
      { symbol: 'NBCC', bseCode: '534309', companyName: 'NBCC (India) Ltd.' },
      { symbol: 'ENGINERSIN', bseCode: '532178', companyName: 'Engineers India Ltd.' },
      { symbol: 'NCC', bseCode: '500294', companyName: 'NCC Ltd.' },
      { symbol: 'PNCINFRA', bseCode: '539150', companyName: 'PNC Infratech Ltd.' },
      { symbol: 'IRB', bseCode: '532947', companyName: 'IRB Infrastructure Developers Ltd.' },
      { symbol: 'KEC', bseCode: '532714', companyName: 'KEC International Ltd.' },
      { symbol: 'KALPATPOWR', bseCode: '522287', companyName: 'Kalpataru Projects International Ltd.' },
      { symbol: 'COCHINSHIP', bseCode: '540678', companyName: 'Cochin Shipyard Ltd.' },
      { symbol: 'GRSE', bseCode: '542011', companyName: 'Garden Reach Shipbuilders & Engineers Ltd.' },
      { symbol: 'MAZAGON', bseCode: '543237', companyName: 'Mazagon Dock Shipbuilders Ltd.' },
      { symbol: 'DATAPATTER', bseCode: '543428', companyName: 'Data Patterns (India) Ltd.' },
      { symbol: 'PARAS', bseCode: '543417', companyName: 'Paras Defence and Space Technologies Ltd.' },
      { symbol: 'BEML', bseCode: '500048', companyName: 'BEML Ltd.' },
      { symbol: 'BDL', bseCode: '541143', companyName: 'Bharat Dynamics Ltd.' },
      { symbol: 'MIDHANI', bseCode: '541195', companyName: 'Mishra Dhatu Nigam Ltd.' },
      { symbol: 'SJVN', bseCode: '533206', companyName: 'SJVN Ltd.' },
      { symbol: 'NLCINDIA', bseCode: '513683', companyName: 'NLC India Ltd.' },
      { symbol: 'HUDCO', bseCode: '540530', companyName: 'Housing and Urban Development Corporation Ltd.' },
      { symbol: 'GSPL', bseCode: '532702', companyName: 'Gujarat State Petronet Ltd.' },
      { symbol: 'IGL', bseCode: '532514', companyName: 'Indraprastha Gas Ltd.' },
      { symbol: 'MGL', bseCode: '539957', companyName: 'Mahanagar Gas Ltd.' },
      { symbol: 'GUJGASLTD', bseCode: '539336', companyName: 'Gujarat Gas Ltd.' }
    ];
  }

  async getNSEStockDetails(symbol: string): Promise<ExchangeStockData | null> {
    try {
      const details = await nse.getEquityDetails(symbol) as any;
      if (!details) return null;

      const info = details.info || {};
      const priceInfo = details.priceInfo || {};
      const metadata = details.metadata || {};
      const securityInfo = details.securityInfo || {};

      const issuedSize = parseFloat(String(securityInfo.issuedSize || securityInfo.issuedCap || 0));
      const lastPrice = parseFloat(String(priceInfo.lastPrice || 0));
      const marketCapValue = issuedSize * lastPrice;
      const marketCapStr = this.determineMarketCapCategory(marketCapValue);

      return {
        symbol: info.symbol || symbol,
        companyName: info.companyName || metadata.companyName || info.name || symbol,
        isin: metadata.isin || info.isin,
        exchange: 'NSE',
        sector: metadata.industry || info.industry,
        industry: metadata.industry,
        marketCap: marketCapStr,
        marketCapValue: marketCapValue / 10000000, // in crores
        currentPrice: lastPrice,
        previousClose: parseFloat(String(priceInfo.previousClose || 0)),
        dayChange: parseFloat(String(priceInfo.change || 0)),
        dayChangePercent: parseFloat(String(priceInfo.pChange || 0)),
        weekHigh52: parseFloat(String(priceInfo.weekHighLow?.max || 0)),
        weekLow52: parseFloat(String(priceInfo.weekHighLow?.min || 0)),
        peRatio: undefined, // Will be populated from other sources if available
        pbRatio: undefined,
        dividendYield: undefined,
        nseCode: 'EQ',
      };
    } catch (error) {
      console.warn(`[Exchange Service] Failed to fetch NSE details for ${symbol}:`, error);
      return null;
    }
  }

  async getBSEStockDetails(bseCode: string, symbol?: string): Promise<ExchangeStockData | null> {
    try {
      // Use Yahoo Finance with .BO suffix for BSE stocks
      const tickerSymbol = symbol ? `${symbol}.BO` : bseCode;
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${tickerSymbol}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const result = response.data?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};

      return {
        symbol: symbol || meta.symbol?.replace('.BO', ''),
        companyName: meta.shortName || meta.longName || symbol || '',
        exchange: 'BSE',
        bseCode: bseCode,
        currentPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose || meta.chartPreviousClose,
        dayChange: meta.regularMarketPrice - (meta.previousClose || 0),
        dayChangePercent: ((meta.regularMarketPrice - (meta.previousClose || 0)) / (meta.previousClose || 1)) * 100,
        weekHigh52: meta.fiftyTwoWeekHigh,
        weekLow52: meta.fiftyTwoWeekLow,
        marketCap: this.determineMarketCapCategory(meta.marketCap),
        marketCapValue: meta.marketCap ? meta.marketCap / 10000000 : undefined, // in crores
      };
    } catch (error) {
      console.warn(`[Exchange Service] Failed to fetch BSE details for ${bseCode}:`, error);
      return null;
    }
  }

  private determineMarketCapCategory(marketCapInCr?: number): string {
    if (!marketCapInCr) return 'Unknown';
    const mcapCr = marketCapInCr / 10000000; // Convert to crores if in raw value
    if (mcapCr >= 20000) return 'Large Cap';
    if (mcapCr >= 5000) return 'Mid Cap';
    return 'Small Cap';
  }

  async syncNSEStocks(options: { limit?: number; topOnly?: boolean } = {}): Promise<SyncProgress> {
    if (this.nseProgress.status !== 'idle' && this.nseProgress.status !== 'complete' && this.nseProgress.status !== 'error') {
      return this.nseProgress;
    }

    this.nseProgress = {
      exchange: 'NSE',
      status: 'fetching_symbols',
      total: 0,
      processed: 0,
      added: 0,
      updated: 0,
      errors: 0,
      startedAt: new Date()
    };

    try {
      console.log('[Exchange Service] Starting NSE stock sync...');
      
      let targetSymbols: string[];

      // If topOnly, use curated list directly without fetching all symbols
      if (options.topOnly) {
        targetSymbols = this.getTopNSESymbols();
      } else {
        // Fetch all NSE symbols only when not using top-only mode
        targetSymbols = await this.getAllNSESymbols();
      }

      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        targetSymbols = targetSymbols.slice(0, options.limit);
      }

      this.nseProgress.total = targetSymbols.length;
      this.nseProgress.status = 'fetching_details';

      console.log(`[Exchange Service] Syncing ${targetSymbols.length} NSE stocks...`);

      // Process in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < targetSymbols.length; i += batchSize) {
        const batch = targetSymbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            const stockData = await this.getNSEStockDetails(symbol);
            if (stockData) {
              const result = await this.upsertStock(stockData);
              if (result === 'added') {
                this.nseProgress.added++;
              } else {
                this.nseProgress.updated++;
              }
            }
          } catch (error) {
            console.warn(`[Exchange Service] Error processing ${symbol}:`, error);
            this.nseProgress.errors++;
          }
          this.nseProgress.processed++;
        }));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < targetSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      this.nseProgress.status = 'complete';
      this.nseProgress.completedAt = new Date();
      console.log(`[Exchange Service] NSE sync complete. Added/Updated: ${this.nseProgress.added}, Errors: ${this.nseProgress.errors}`);
      
      return this.nseProgress;
    } catch (error) {
      this.nseProgress.status = 'error';
      this.nseProgress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Exchange Service] NSE sync failed:', error);
      return this.nseProgress;
    }
  }

  async syncBSEStocks(options: { limit?: number; topOnly?: boolean } = {}): Promise<SyncProgress> {
    if (this.bseProgress.status !== 'idle' && this.bseProgress.status !== 'complete' && this.bseProgress.status !== 'error') {
      return this.bseProgress;
    }

    this.bseProgress = {
      exchange: 'BSE',
      status: 'fetching_symbols',
      total: 0,
      processed: 0,
      added: 0,
      updated: 0,
      errors: 0,
      startedAt: new Date()
    };

    try {
      console.log('[Exchange Service] Starting BSE stock sync...');
      
      let targetSymbols: BseScripData[];

      // If topOnly, use curated SENSEX/BSE 100 list; otherwise fetch all BSE scrips
      if (options.topOnly) {
        targetSymbols = this.getTopBSEStocks().map(s => ({
          symbol: s.symbol,
          bseCode: s.bseCode,
          companyName: s.symbol
        }));
      } else {
        // Fetch all BSE scrips from BSE API or extended fallback
        targetSymbols = await this.getAllBSESymbols();
      }

      if (options.limit && options.limit > 0) {
        targetSymbols = targetSymbols.slice(0, options.limit);
      }

      this.bseProgress.total = targetSymbols.length;
      this.bseProgress.status = 'fetching_details';

      console.log(`[Exchange Service] Syncing ${targetSymbols.length} BSE stocks...`);

      // Process in batches with rate limiting for Yahoo Finance
      const batchSize = 3;
      for (let i = 0; i < targetSymbols.length; i += batchSize) {
        const batch = targetSymbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (scrip) => {
          try {
            const stockData = await this.getBSEStockDetails(scrip.bseCode, scrip.symbol);
            if (stockData) {
              // Use company name from catalogue if available
              if (scrip.companyName && scrip.companyName !== scrip.symbol) {
                stockData.companyName = scrip.companyName;
              }
              if (scrip.isin) {
                stockData.isin = scrip.isin;
              }
              if (scrip.industry) {
                stockData.sector = scrip.industry;
                stockData.industry = scrip.industry;
              }
              const result = await this.upsertStock(stockData);
              if (result === 'added') {
                this.bseProgress.added++;
              } else {
                this.bseProgress.updated++;
              }
            }
          } catch (error) {
            console.warn(`[Exchange Service] Error processing BSE ${scrip.symbol}:`, error);
            this.bseProgress.errors++;
          }
          this.bseProgress.processed++;
        }));

        // Delay between batches to avoid rate limiting
        if (i + batchSize < targetSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.bseProgress.status = 'complete';
      this.bseProgress.completedAt = new Date();
      console.log(`[Exchange Service] BSE sync complete. Added/Updated: ${this.bseProgress.added}, Errors: ${this.bseProgress.errors}`);
      
      return this.bseProgress;
    } catch (error) {
      this.bseProgress.status = 'error';
      this.bseProgress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Exchange Service] BSE sync failed:', error);
      return this.bseProgress;
    }
  }

  async lookupAndAddStock(query: string): Promise<{ found: boolean; action?: 'added' | 'updated'; stock?: ExchangeStockData }> {
    const symbol = query.trim().toUpperCase().replace(/[^A-Z0-9&\-]/g, '');
    if (!symbol || symbol.length < 2) return { found: false };

    try {
      console.log(`[Exchange Service] Auto-lookup: "${symbol}" (from query: "${query}")`);

      // Try NSE first
      let stockData = await this.getNSEStockDetails(symbol);

      // If NSE fails and query looks like a name (has spaces or >8 chars), try BSE via Yahoo Finance
      if (!stockData && (query.includes(' ') || query.length > 8)) {
        stockData = await this.getBSEStockDetails('', symbol).catch(() => null);
      }

      if (!stockData) {
        console.log(`[Exchange Service] Auto-lookup: "${symbol}" not found on NSE/BSE`);
        return { found: false };
      }

      const action = await this.upsertStock(stockData);

      // Publish auto-added stocks so they appear in all searches
      if (action === 'added') {
        await db.execute(sql`UPDATE listed_stocks SET is_published = true WHERE symbol = ${stockData.symbol}`);
      }

      // Mirror into screener_stocks
      await db.execute(sql`
        INSERT INTO screener_stocks (symbol, company_name, exchange, isin, sector, industry, market_cap_category, country, currency, is_active, current_price, market_cap_value, data_source, created_at, updated_at)
        VALUES (
          ${stockData.symbol},
          ${stockData.companyName},
          ${stockData.exchange || 'NSE'},
          ${stockData.isin || null},
          ${stockData.sector || null},
          ${stockData.industry || null},
          ${stockData.marketCap || null},
          'IN', 'INR', true,
          ${stockData.currentPrice || null},
          ${stockData.marketCapValue || null},
          'auto_lookup',
          NOW(), NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          current_price = EXCLUDED.current_price,
          market_cap_value = EXCLUDED.market_cap_value,
          sector = COALESCE(EXCLUDED.sector, screener_stocks.sector),
          updated_at = NOW()
      `);

      console.log(`[Exchange Service] Auto-lookup: "${symbol}" ${action} in database`);
      return { found: true, action, stock: stockData };
    } catch (err: any) {
      console.warn(`[Exchange Service] Auto-lookup failed for "${query}":`, err.message);
      return { found: false };
    }
  }

  private async upsertStock(data: ExchangeStockData): Promise<'added' | 'updated'> {
    const existing = await db.select().from(listedStocks).where(eq(listedStocks.symbol, data.symbol)).limit(1);

    const stockRecord = {
      symbol: data.symbol,
      companyName: data.companyName,
      isin: data.isin,
      bseCode: data.bseCode,
      nseCode: data.nseCode,
      sector: data.sector,
      industry: data.industry,
      marketCap: data.marketCap,
      marketCapValue: data.marketCapValue?.toString(),
      currentPrice: data.currentPrice?.toString(),
      previousClose: data.previousClose?.toString(),
      dayChange: data.dayChange?.toString(),
      dayChangePercent: data.dayChangePercent?.toString(),
      weekHigh52: data.weekHigh52?.toString(),
      weekLow52: data.weekLow52?.toString(),
      peRatio: data.peRatio?.toString(),
      pbRatio: data.pbRatio?.toString(),
      dividendYield: data.dividendYield?.toString(),
      eps: data.eps?.toString(),
      returns1Y: data.returns1Y?.toString(),
      returns3Y: data.returns3Y?.toString(),
      analystRating: data.analystRating,
      lastUpdated: new Date(),
    };

    if (existing.length > 0) {
      await db.update(listedStocks)
        .set(stockRecord)
        .where(eq(listedStocks.symbol, data.symbol));
      return 'updated';
    } else {
      // Auto-publish stocks that arrive with valid price data.
      // Only stocks with no price are held as unpublished for admin review.
      const hasValidPrice = data.currentPrice != null && data.currentPrice > 50;
      await db.insert(listedStocks).values({
        ...stockRecord,
        isPublished: hasValidPrice,
      });
      return 'added';
    }
  }

  getTopNSESymbols(): string[] {
    // NIFTY 50 + NIFTY Next 50 stocks
    return [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
      'LT', 'AXISBANK', 'BAJFINANCE', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'WIPRO', 'SUNPHARMA', 'ULTRACEMCO', 'TITAN',
      'NTPC', 'ONGC', 'POWERGRID', 'TECHM', 'M&M', 'NESTLEIND', 'TATAMOTORS', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT',
      'COALINDIA', 'BAJAJFINSV', 'GRASIM', 'DIVISLAB', 'CIPLA', 'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'BPCL', 'INDUSINDBK',
      'HEROMOTOCO', 'APOLLOHOSP', 'TATACONSUM', 'SBILIFE', 'HINDALCO', 'ADANIPORTS', 'HDFCLIFE', 'BAJAJ-AUTO', 'SHREECEM', 'UPL',
      // NIFTY Next 50
      'AMBUJACEM', 'BANKBARODA', 'BERGEPAINT', 'BIOCON', 'BOSCHLTD', 'CHOLAFIN', 'COLPAL', 'CONCOR', 'DABUR', 'DLF',
      'GAIL', 'GODREJCP', 'HAVELLS', 'ICICIGI', 'ICICIPRULI', 'INDHOTEL', 'INDUSTOWER', 'IOC', 'IRCTC', 'JINDALSTEL',
      'LICI', 'LUPIN', 'MARICO', 'MCDOWELL-N', 'MUTHOOTFIN', 'NAUKRI', 'NMDC', 'PAGEIND', 'PEL', 'PETRONET',
      'PFC', 'PIDILITIND', 'PIIND', 'PNB', 'RECLTD', 'SRF', 'TATAPOWER', 'TORNTPHARM', 'TRENT', 'VEDL',
      'ETERNAL', 'DMART', 'ADANIGREEN', 'ADANITRANS', 'ATGL', 'LODHA', 'HAL', 'BEL', 'NHPC', 'IRFC'
    ];
  }

  getTopBSEStocks(): { symbol: string; bseCode: string }[] {
    // SENSEX 30 + additional top BSE stocks with their BSE codes
    return [
      { symbol: 'RELIANCE', bseCode: '500325' },
      { symbol: 'TCS', bseCode: '532540' },
      { symbol: 'HDFCBANK', bseCode: '500180' },
      { symbol: 'INFY', bseCode: '500209' },
      { symbol: 'ICICIBANK', bseCode: '532174' },
      { symbol: 'HINDUNILVR', bseCode: '500696' },
      { symbol: 'ITC', bseCode: '500875' },
      { symbol: 'SBIN', bseCode: '500112' },
      { symbol: 'BHARTIARTL', bseCode: '532454' },
      { symbol: 'KOTAKBANK', bseCode: '500247' },
      { symbol: 'LT', bseCode: '500510' },
      { symbol: 'AXISBANK', bseCode: '532215' },
      { symbol: 'BAJFINANCE', bseCode: '500034' },
      { symbol: 'ASIANPAINT', bseCode: '500820' },
      { symbol: 'MARUTI', bseCode: '532500' },
      { symbol: 'HCLTECH', bseCode: '532281' },
      { symbol: 'WIPRO', bseCode: '507685' },
      { symbol: 'SUNPHARMA', bseCode: '524715' },
      { symbol: 'ULTRACEMCO', bseCode: '532538' },
      { symbol: 'TITAN', bseCode: '500114' },
      { symbol: 'NTPC', bseCode: '532555' },
      { symbol: 'ONGC', bseCode: '500312' },
      { symbol: 'POWERGRID', bseCode: '532898' },
      { symbol: 'TECHM', bseCode: '532755' },
      { symbol: 'M&M', bseCode: '500520' },
      { symbol: 'NESTLEIND', bseCode: '500790' },
      { symbol: 'TATAMOTORS', bseCode: '500570' },
      { symbol: 'JSWSTEEL', bseCode: '500228' },
      { symbol: 'TATASTEEL', bseCode: '500470' },
      { symbol: 'INDUSINDBK', bseCode: '532187' },
    ];
  }

  resetProgress(exchange: 'NSE' | 'BSE'): void {
    if (exchange === 'NSE') {
      this.nseProgress = { exchange: 'NSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
    } else {
      this.bseProgress = { exchange: 'BSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
    }
  }
}

export const exchangeStockService = new ExchangeStockService();
