import { format, addDays, isWeekend, isSameDay, parseISO, getDay } from 'date-fns';

// Supported exchanges across regions
type IndianExchange = 'NSE' | 'BSE' | 'MCX' | 'NCDEX';
type USExchange = 'NYSE' | 'NASDAQ' | 'CME';
type EUExchange = 'LSE' | 'EURONEXT' | 'XETRA' | 'SIX';
type APACExchange = 'SGX' | 'HKEX' | 'TSE' | 'ASX';
type Exchange = IndianExchange | USExchange | EUExchange | APACExchange;

// Regions for bank and trading holidays
type Region = 'IN' | 'IN-MH' | 'IN-KA' | 'IN-DL' | 'IN-TN' | 'IN-GJ' | 'IN-WB' | 'IN-KL' | 
              'US' | 'UK' | 'EU' | 'SG' | 'HK' | 'JP' | 'AU';

interface MarketHoliday {
  date: string;
  name: string;
  description?: string;
  exchanges: Exchange[];
  type: 'full' | 'partial';
  region?: Region;
  specialSession?: {
    name: string;
    startTime: string;
    endTime: string;
  };
}

interface BankHoliday {
  date: string;
  name: string;
  description?: string;
  regions: Region[];
  type: 'national' | 'state' | 'restricted';
  applicableTo?: string[];
}

interface MarketStatus {
  isOpen: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  holidayName?: string;
  reason: string;
  nextTradingDay: string;
  nextTradingDayName: string;
  specialSession?: {
    name: string;
    startTime: string;
    endTime: string;
  };
  tradingHours?: {
    open: string;
    close: string;
  };
}

interface TradingCalendarDay {
  date: string;
  dayOfWeek: string;
  isTrading: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  holidayName?: string;
  specialSession?: string;
}

class MarketHolidayService {
  private holidays: Map<string, MarketHoliday[]> = new Map();
  private bankHolidays: Map<string, BankHoliday[]> = new Map();
  private internationalHolidays: Map<string, MarketHoliday[]> = new Map();

  constructor() {
    this.initializeHolidays();
    this.initializeBankHolidays();
    this.initializeInternationalHolidays();
  }

  private initializeHolidays() {
    const allHolidays: MarketHoliday[] = [
      // 2024 NSE/BSE Holidays
      { date: '2024-01-26', name: 'Republic Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2024-03-08', name: 'Mahashivratri', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-03-25', name: 'Holi', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-03-26', name: 'Holi (Dhuleti)', exchanges: ['MCX', 'NCDEX'], type: 'full' },
      { date: '2024-03-29', name: 'Good Friday', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2024-04-11', name: 'Id-Ul-Fitr (Ramadan Eid)', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-04-14', name: 'Dr. Ambedkar Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-04-17', name: 'Ram Navami', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-04-21', name: 'Mahavir Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-05-01', name: 'Maharashtra Day', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-05-23', name: 'Buddha Purnima', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-06-17', name: 'Bakrid / Eid ul-Adha', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2024-07-17', name: 'Muharram', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-08-15', name: 'Independence Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2024-10-02', name: 'Mahatma Gandhi Jayanti', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2024-10-12', name: 'Dussehra', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-11-01', name: 'Diwali (Laxmi Pujan)', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'partial', specialSession: { name: 'Muhurat Trading', startTime: '18:15', endTime: '19:15' } },
      { date: '2024-11-02', name: 'Diwali Balipratipada', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-11-15', name: 'Guru Nanak Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2024-12-25', name: 'Christmas', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },

      // 2025 NSE/BSE Holidays
      { date: '2025-01-26', name: 'Republic Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-02-26', name: 'Mahashivratri', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-03-14', name: 'Holi', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-03-31', name: 'Id-Ul-Fitr (Ramadan Eid)', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-04-10', name: 'Mahavir Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-04-14', name: 'Dr. Ambedkar Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-04-18', name: 'Good Friday', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-05-01', name: 'Maharashtra Day', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-05-12', name: 'Buddha Purnima', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-06-07', name: 'Bakrid / Eid ul-Adha', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-07-06', name: 'Muharram', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-08-15', name: 'Independence Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-08-16', name: 'Parsi New Year', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-08-27', name: 'Janmashtami', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-10-02', name: 'Mahatma Gandhi Jayanti / Dussehra', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2025-10-21', name: 'Diwali (Laxmi Pujan)', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'partial', specialSession: { name: 'Muhurat Trading', startTime: '18:15', endTime: '19:15' } },
      { date: '2025-10-22', name: 'Diwali Balipratipada', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-11-05', name: 'Guru Nanak Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2025-12-25', name: 'Christmas', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },

      // 2026 NSE/BSE Holidays (Tentative based on patterns)
      { date: '2026-01-26', name: 'Republic Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-02-17', name: 'Mahashivratri', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-03-03', name: 'Holi', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-03-20', name: 'Id-Ul-Fitr (Ramadan Eid)', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-03-30', name: 'Mahavir Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-04-03', name: 'Good Friday', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-05-01', name: 'Maharashtra Day / Buddha Purnima', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-05-27', name: 'Bakrid / Eid ul-Adha', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-06-25', name: 'Muharram', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-08-15', name: 'Independence Day', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-08-25', name: 'Milad-un-Nabi', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
      { date: '2026-10-20', name: 'Dussehra', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-11-08', name: 'Diwali (Laxmi Pujan)', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'partial', specialSession: { name: 'Muhurat Trading', startTime: '18:15', endTime: '19:15' } },
      { date: '2026-11-09', name: 'Diwali Balipratipada', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-11-25', name: 'Guru Nanak Jayanti', exchanges: ['NSE', 'BSE'], type: 'full' },
      { date: '2026-12-25', name: 'Christmas', exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX'], type: 'full' },
    ];

    for (const holiday of allHolidays) {
      const year = holiday.date.substring(0, 4);
      if (!this.holidays.has(year)) {
        this.holidays.set(year, []);
      }
      this.holidays.get(year)!.push(holiday);
    }

    console.log('📅 Market Holiday Service initialized with', allHolidays.length, 'holidays');
  }

  private initializeBankHolidays() {
    const allBankHolidays: BankHoliday[] = [
      // 2025 RBI National Holidays (applicable across all India)
      { date: '2025-01-26', name: 'Republic Day', regions: ['IN'], type: 'national' },
      { date: '2025-03-14', name: 'Holi', regions: ['IN'], type: 'national' },
      { date: '2025-04-14', name: 'Dr. Ambedkar Jayanti', regions: ['IN'], type: 'national' },
      { date: '2025-04-18', name: 'Good Friday', regions: ['IN'], type: 'national' },
      { date: '2025-08-15', name: 'Independence Day', regions: ['IN'], type: 'national' },
      { date: '2025-10-02', name: 'Gandhi Jayanti', regions: ['IN'], type: 'national' },
      { date: '2025-11-05', name: 'Guru Nanak Jayanti', regions: ['IN'], type: 'national' },
      { date: '2025-12-25', name: 'Christmas', regions: ['IN'], type: 'national' },
      
      // 2025 Maharashtra State Bank Holidays
      { date: '2025-01-14', name: 'Makar Sankranti', regions: ['IN-MH', 'IN-GJ'], type: 'state' },
      { date: '2025-02-19', name: 'Shivaji Jayanti', regions: ['IN-MH'], type: 'state' },
      { date: '2025-05-01', name: 'Maharashtra Day', regions: ['IN-MH'], type: 'state' },
      { date: '2025-08-27', name: 'Ganesh Chaturthi', regions: ['IN-MH'], type: 'state' },
      
      // 2025 Karnataka State Bank Holidays
      { date: '2025-11-01', name: 'Karnataka Rajyotsava', regions: ['IN-KA'], type: 'state' },
      { date: '2025-04-10', name: 'Ugadi', regions: ['IN-KA', 'IN-TN'], type: 'state' },
      
      // 2025 Gujarat State Bank Holidays
      { date: '2025-01-14', name: 'Uttarayan', regions: ['IN-GJ'], type: 'state' },
      { date: '2025-10-24', name: 'Bhai Dooj', regions: ['IN-GJ'], type: 'state' },
      
      // 2025 West Bengal State Bank Holidays
      { date: '2025-01-23', name: 'Netaji Subhas Chandra Bose Jayanti', regions: ['IN-WB'], type: 'state' },
      { date: '2025-05-09', name: 'Rabindra Jayanti', regions: ['IN-WB'], type: 'state' },
      
      // 2025 Tamil Nadu State Bank Holidays
      { date: '2025-01-15', name: 'Pongal', regions: ['IN-TN'], type: 'state' },
      { date: '2025-01-16', name: 'Thiruvalluvar Day', regions: ['IN-TN'], type: 'state' },
      
      // 2025 Kerala State Bank Holidays
      { date: '2025-08-28', name: 'Onam', regions: ['IN-KL'], type: 'state' },
      { date: '2025-09-02', name: 'Thiruvonam', regions: ['IN-KL'], type: 'state' },
      
      // 2025 Delhi Bank Holidays
      { date: '2025-10-20', name: 'Dussehra', regions: ['IN-DL'], type: 'state' },
      
      // 2026 RBI National Holidays
      { date: '2026-01-26', name: 'Republic Day', regions: ['IN'], type: 'national' },
      { date: '2026-03-03', name: 'Holi', regions: ['IN'], type: 'national' },
      { date: '2026-04-03', name: 'Good Friday', regions: ['IN'], type: 'national' },
      { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', regions: ['IN'], type: 'national' },
      { date: '2026-08-15', name: 'Independence Day', regions: ['IN'], type: 'national' },
      { date: '2026-10-02', name: 'Gandhi Jayanti', regions: ['IN'], type: 'national' },
      { date: '2026-11-25', name: 'Guru Nanak Jayanti', regions: ['IN'], type: 'national' },
      { date: '2026-12-25', name: 'Christmas', regions: ['IN'], type: 'national' },
    ];

    for (const holiday of allBankHolidays) {
      const year = holiday.date.substring(0, 4);
      if (!this.bankHolidays.has(year)) {
        this.bankHolidays.set(year, []);
      }
      this.bankHolidays.get(year)!.push(holiday);
    }

    console.log('🏦 Bank Holiday Service initialized with', allBankHolidays.length, 'holidays');
  }

  private initializeInternationalHolidays() {
    const allInternationalHolidays: MarketHoliday[] = [
      // 2025 US Holidays (NYSE, NASDAQ, CME)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-01-20', name: 'Martin Luther King Jr. Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-02-17', name: 'Presidents\' Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-04-18', name: 'Good Friday', exchanges: ['NYSE', 'NASDAQ'], type: 'full', region: 'US' },
      { date: '2025-05-26', name: 'Memorial Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-06-19', name: 'Juneteenth', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-07-04', name: 'Independence Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-09-01', name: 'Labor Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-11-27', name: 'Thanksgiving Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2025-12-25', name: 'Christmas Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      
      // 2025 UK Holidays (LSE)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['LSE'], type: 'full', region: 'UK' },
      { date: '2025-04-18', name: 'Good Friday', exchanges: ['LSE', 'EURONEXT'], type: 'full', region: 'UK' },
      { date: '2025-04-21', name: 'Easter Monday', exchanges: ['LSE', 'EURONEXT', 'XETRA'], type: 'full', region: 'UK' },
      { date: '2025-05-05', name: 'Early May Bank Holiday', exchanges: ['LSE'], type: 'full', region: 'UK' },
      { date: '2025-05-26', name: 'Spring Bank Holiday', exchanges: ['LSE'], type: 'full', region: 'UK' },
      { date: '2025-08-25', name: 'Summer Bank Holiday', exchanges: ['LSE'], type: 'full', region: 'UK' },
      { date: '2025-12-25', name: 'Christmas Day', exchanges: ['LSE', 'EURONEXT', 'XETRA', 'SIX'], type: 'full', region: 'UK' },
      { date: '2025-12-26', name: 'Boxing Day', exchanges: ['LSE'], type: 'full', region: 'UK' },
      
      // 2025 EU Holidays (EURONEXT, XETRA, SIX)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['EURONEXT', 'XETRA', 'SIX'], type: 'full', region: 'EU' },
      { date: '2025-05-01', name: 'Labour Day', exchanges: ['EURONEXT', 'XETRA'], type: 'full', region: 'EU' },
      { date: '2025-12-26', name: 'St. Stephen\'s Day', exchanges: ['EURONEXT', 'XETRA', 'SIX'], type: 'full', region: 'EU' },
      
      // 2025 Singapore Holidays (SGX)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-01-29', name: 'Chinese New Year', exchanges: ['SGX', 'HKEX'], type: 'full', region: 'SG' },
      { date: '2025-01-30', name: 'Chinese New Year Day 2', exchanges: ['SGX', 'HKEX'], type: 'full', region: 'SG' },
      { date: '2025-04-18', name: 'Good Friday', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-05-01', name: 'Labour Day', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-05-12', name: 'Vesak Day', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-08-09', name: 'National Day', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-10-20', name: 'Deepavali', exchanges: ['SGX'], type: 'full', region: 'SG' },
      { date: '2025-12-25', name: 'Christmas Day', exchanges: ['SGX'], type: 'full', region: 'SG' },
      
      // 2025 Hong Kong Holidays (HKEX)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-04-04', name: 'Ching Ming Festival', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-05-05', name: 'Buddha\'s Birthday', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-06-02', name: 'Tuen Ng Festival', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-07-01', name: 'Hong Kong SAR Establishment Day', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-10-01', name: 'National Day', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-10-07', name: 'Day after Mid-Autumn Festival', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-10-29', name: 'Chung Yeung Festival', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-12-25', name: 'Christmas Day', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      { date: '2025-12-26', name: 'Boxing Day', exchanges: ['HKEX'], type: 'full', region: 'HK' },
      
      // 2025 Japan Holidays (TSE)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-01-02', name: 'Bank Holiday', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-01-03', name: 'Bank Holiday', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-01-13', name: 'Coming of Age Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-02-11', name: 'National Foundation Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-02-24', name: 'Emperor\'s Birthday', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-03-20', name: 'Vernal Equinox Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-04-29', name: 'Showa Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-05-03', name: 'Constitution Memorial Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-05-04', name: 'Greenery Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-05-05', name: 'Children\'s Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-07-21', name: 'Marine Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-08-11', name: 'Mountain Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-09-15', name: 'Respect for the Aged Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-09-23', name: 'Autumnal Equinox Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-10-13', name: 'Sports Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-11-03', name: 'Culture Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-11-24', name: 'Labour Thanksgiving Day', exchanges: ['TSE'], type: 'full', region: 'JP' },
      { date: '2025-12-31', name: 'Bank Holiday', exchanges: ['TSE'], type: 'full', region: 'JP' },
      
      // 2025 Australia Holidays (ASX)
      { date: '2025-01-01', name: 'New Year\'s Day', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-01-27', name: 'Australia Day', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-04-18', name: 'Good Friday', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-04-21', name: 'Easter Monday', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-04-25', name: 'Anzac Day', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-06-09', name: 'Queen\'s Birthday', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-12-25', name: 'Christmas Day', exchanges: ['ASX'], type: 'full', region: 'AU' },
      { date: '2025-12-26', name: 'Boxing Day', exchanges: ['ASX'], type: 'full', region: 'AU' },
      
      // 2026 US Holidays
      { date: '2026-01-01', name: 'New Year\'s Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-01-19', name: 'Martin Luther King Jr. Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-02-16', name: 'Presidents\' Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-04-03', name: 'Good Friday', exchanges: ['NYSE', 'NASDAQ'], type: 'full', region: 'US' },
      { date: '2026-05-25', name: 'Memorial Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-06-19', name: 'Juneteenth', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-07-03', name: 'Independence Day (Observed)', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-09-07', name: 'Labor Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-11-26', name: 'Thanksgiving Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
      { date: '2026-12-25', name: 'Christmas Day', exchanges: ['NYSE', 'NASDAQ', 'CME'], type: 'full', region: 'US' },
    ];

    for (const holiday of allInternationalHolidays) {
      const year = holiday.date.substring(0, 4);
      if (!this.internationalHolidays.has(year)) {
        this.internationalHolidays.set(year, []);
      }
      this.internationalHolidays.get(year)!.push(holiday);
    }

    console.log('🌍 International Holiday Service initialized with', allInternationalHolidays.length, 'holidays');
  }

  isHoliday(date: Date | string, exchange: Exchange = 'NSE'): boolean {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const year = dateStr.substring(0, 4);
    const yearHolidays = this.holidays.get(year) || [];
    
    return yearHolidays.some(h => 
      h.date === dateStr && 
      h.exchanges.includes(exchange) && 
      h.type === 'full'
    );
  }

  getHoliday(date: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): MarketHoliday | null {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const year = dateStr.substring(0, 4);
    const yearHolidays = this.holidays.get(year) || [];
    
    return yearHolidays.find(h => 
      h.date === dateStr && 
      h.exchanges.includes(exchange)
    ) || null;
  }

  isWeekendDay(date: Date | string): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const day = getDay(d);
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  isTradingDay(date: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    
    if (this.isWeekendDay(d)) {
      return false;
    }
    
    const holiday = this.getHoliday(d, exchange);
    if (holiday) {
      // Both full and partial holidays are not regular trading days
      // Partial holidays have special sessions (like Muhurat trading) but normal trading is closed
      return false;
    }
    
    return true;
  }

  getNextTradingDay(date: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): Date {
    let nextDay = typeof date === 'string' ? parseISO(date) : new Date(date);
    nextDay = addDays(nextDay, 1);
    
    let maxIterations = 30;
    while (!this.isTradingDay(nextDay, exchange) && maxIterations > 0) {
      nextDay = addDays(nextDay, 1);
      maxIterations--;
    }
    
    return nextDay;
  }

  getPreviousTradingDay(date: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): Date {
    let prevDay = typeof date === 'string' ? parseISO(date) : new Date(date);
    prevDay = addDays(prevDay, -1);
    
    let maxIterations = 30;
    while (!this.isTradingDay(prevDay, exchange) && maxIterations > 0) {
      prevDay = addDays(prevDay, -1);
      maxIterations--;
    }
    
    return prevDay;
  }

  getMarketStatus(exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): MarketStatus {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayStr = format(istTime, 'yyyy-MM-dd');
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 60 + minutes;

    const tradingHours = this.getTradingHours(exchange);
    const holiday = this.getHoliday(todayStr, exchange);
    const isWeekendToday = this.isWeekendDay(istTime);
    const nextTradingDay = this.getNextTradingDay(istTime, exchange);
    const nextTradingDayStr = format(nextTradingDay, 'yyyy-MM-dd');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const nextTradingDayName = dayNames[getDay(nextTradingDay)];

    if (isWeekendToday) {
      return {
        isOpen: false,
        isHoliday: false,
        isWeekend: true,
        reason: 'Weekend - Market Closed',
        nextTradingDay: nextTradingDayStr,
        nextTradingDayName,
        tradingHours
      };
    }

    if (holiday && holiday.type === 'full') {
      return {
        isOpen: false,
        isHoliday: true,
        isWeekend: false,
        holidayName: holiday.name,
        reason: `Holiday - ${holiday.name}`,
        nextTradingDay: nextTradingDayStr,
        nextTradingDayName,
        tradingHours
      };
    }

    if (holiday && holiday.type === 'partial' && holiday.specialSession) {
      const sessionStart = this.parseTime(holiday.specialSession.startTime);
      const sessionEnd = this.parseTime(holiday.specialSession.endTime);
      const isInSession = currentTime >= sessionStart && currentTime <= sessionEnd;

      return {
        isOpen: isInSession,
        isHoliday: true,
        isWeekend: false,
        holidayName: holiday.name,
        reason: isInSession 
          ? `${holiday.specialSession.name} in Progress` 
          : `${holiday.specialSession.name} - ${holiday.specialSession.startTime} to ${holiday.specialSession.endTime}`,
        nextTradingDay: nextTradingDayStr,
        nextTradingDayName,
        specialSession: holiday.specialSession,
        tradingHours
      };
    }

    const openTime = this.parseTime(tradingHours.open);
    const closeTime = this.parseTime(tradingHours.close);
    const isWithinTradingHours = currentTime >= openTime && currentTime <= closeTime;

    return {
      isOpen: isWithinTradingHours,
      isHoliday: false,
      isWeekend: false,
      reason: isWithinTradingHours ? 'Market Open' : 'Outside Trading Hours',
      nextTradingDay: isWithinTradingHours ? todayStr : nextTradingDayStr,
      nextTradingDayName: isWithinTradingHours ? dayNames[getDay(istTime)] : nextTradingDayName,
      tradingHours
    };
  }

  private getTradingHours(exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX'): { open: string; close: string } {
    switch (exchange) {
      case 'MCX':
        return { open: '09:00', close: '23:30' };
      case 'NCDEX':
        return { open: '10:00', close: '17:00' };
      case 'NSE':
      case 'BSE':
      default:
        return { open: '09:15', close: '15:30' };
    }
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  getHolidaysForYear(year: number, exchange?: 'NSE' | 'BSE' | 'MCX' | 'NCDEX'): MarketHoliday[] {
    const yearHolidays = this.holidays.get(year.toString()) || [];
    
    if (exchange) {
      return yearHolidays.filter(h => h.exchanges.includes(exchange));
    }
    
    return yearHolidays;
  }

  getUpcomingHolidays(count: number = 10, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): MarketHoliday[] {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const currentYear = now.getFullYear();
    
    const allHolidays: MarketHoliday[] = [];
    
    for (let year = currentYear; year <= currentYear + 2; year++) {
      const yearHolidays = this.getHolidaysForYear(year, exchange);
      allHolidays.push(...yearHolidays);
    }
    
    return allHolidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, count);
  }

  getTradingCalendar(startDate: string, endDate: string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): TradingCalendarDay[] {
    const calendar: TradingCalendarDay[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let currentDate = parseISO(startDate);
    const end = parseISO(endDate);
    
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const isWeekendDay = this.isWeekendDay(currentDate);
      const holiday = this.getHoliday(dateStr, exchange);
      const isHolidayDay = holiday?.type === 'full';
      
      calendar.push({
        date: dateStr,
        dayOfWeek: dayNames[getDay(currentDate)],
        isTrading: !isWeekendDay && !isHolidayDay,
        isHoliday: !!holiday,
        isWeekend: isWeekendDay,
        holidayName: holiday?.name,
        specialSession: holiday?.specialSession?.name
      });
      
      currentDate = addDays(currentDate, 1);
    }
    
    return calendar;
  }

  getTradingDaysCount(startDate: string, endDate: string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): number {
    const calendar = this.getTradingCalendar(startDate, endDate, exchange);
    return calendar.filter(day => day.isTrading).length;
  }

  getScheduledOrderDate(preferredDate: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): string {
    const date = typeof preferredDate === 'string' ? parseISO(preferredDate) : preferredDate;
    
    if (this.isTradingDay(date, exchange)) {
      return format(date, 'yyyy-MM-dd');
    }
    
    const nextTrading = this.getNextTradingDay(date, exchange);
    return format(nextTrading, 'yyyy-MM-dd');
  }

  // =====================================================
  // BANK HOLIDAY METHODS
  // =====================================================

  getBankHoliday(date: Date | string, region: Region = 'IN'): BankHoliday | null {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const year = dateStr.substring(0, 4);
    const yearHolidays = this.bankHolidays.get(year) || [];
    
    return yearHolidays.find(h => 
      h.date === dateStr && 
      (h.regions.includes(region) || (region.startsWith('IN-') && h.regions.includes('IN')))
    ) || null;
  }

  isBankHoliday(date: Date | string, region: Region = 'IN'): boolean {
    return this.getBankHoliday(date, region) !== null;
  }

  getBankHolidaysForYear(year: number, region?: Region): BankHoliday[] {
    const yearHolidays = this.bankHolidays.get(year.toString()) || [];
    
    if (!region) {
      return yearHolidays;
    }
    
    return yearHolidays.filter(h => 
      h.regions.includes(region) || 
      (region.startsWith('IN-') && h.regions.includes('IN'))
    );
  }

  getUpcomingBankHolidays(count: number = 10, region: Region = 'IN'): BankHoliday[] {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const currentYear = now.getFullYear();
    
    const allHolidays: BankHoliday[] = [];
    
    for (let year = currentYear; year <= currentYear + 2; year++) {
      const yearHolidays = this.getBankHolidaysForYear(year, region);
      allHolidays.push(...yearHolidays);
    }
    
    return allHolidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, count);
  }

  // =====================================================
  // INTERNATIONAL TRADING HOLIDAY METHODS
  // =====================================================

  getInternationalHoliday(date: Date | string, exchange: Exchange): MarketHoliday | null {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const year = dateStr.substring(0, 4);
    const yearHolidays = this.internationalHolidays.get(year) || [];
    
    return yearHolidays.find(h => 
      h.date === dateStr && 
      h.exchanges.includes(exchange)
    ) || null;
  }

  isInternationalHoliday(date: Date | string, exchange: Exchange): boolean {
    return this.getInternationalHoliday(date, exchange) !== null;
  }

  getInternationalHolidaysForYear(year: number, region?: Region): MarketHoliday[] {
    const yearHolidays = this.internationalHolidays.get(year.toString()) || [];
    
    if (!region) {
      return yearHolidays;
    }
    
    return yearHolidays.filter(h => h.region === region);
  }

  getUpcomingInternationalHolidays(count: number = 10, region?: Region): MarketHoliday[] {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const currentYear = now.getFullYear();
    
    const allHolidays: MarketHoliday[] = [];
    
    for (let year = currentYear; year <= currentYear + 2; year++) {
      const yearHolidays = this.getInternationalHolidaysForYear(year, region);
      allHolidays.push(...yearHolidays);
    }
    
    return allHolidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, count);
  }

  // =====================================================
  // COMBINED CALENDAR METHODS
  // =====================================================

  getAllHolidaysForMonth(year: number, month: number, options?: { 
    includeTrading?: boolean; 
    includeBank?: boolean; 
    includeInternational?: boolean;
    region?: Region;
  }): Array<{ date: string; name: string; type: string; category: string; region?: Region }> {
    const { 
      includeTrading = true, 
      includeBank = true, 
      includeInternational = true,
      region 
    } = options || {};

    const holidays: Array<{ date: string; name: string; type: string; category: string; region?: Region }> = [];
    const monthStr = month.toString().padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;

    if (includeTrading) {
      const yearHolidays = this.holidays.get(year.toString()) || [];
      yearHolidays
        .filter(h => h.date >= startDate && h.date <= endDate)
        .forEach(h => {
          holidays.push({
            date: h.date,
            name: h.name,
            type: h.type,
            category: 'trading',
            region: 'IN'
          });
        });
    }

    if (includeBank) {
      const bankYearHolidays = this.getBankHolidaysForYear(year, region);
      bankYearHolidays
        .filter(h => h.date >= startDate && h.date <= endDate)
        .forEach(h => {
          holidays.push({
            date: h.date,
            name: h.name,
            type: h.type,
            category: 'bank',
            region: h.regions[0]
          });
        });
    }

    if (includeInternational) {
      const intlHolidays = this.getInternationalHolidaysForYear(year, region);
      intlHolidays
        .filter(h => h.date >= startDate && h.date <= endDate)
        .forEach(h => {
          holidays.push({
            date: h.date,
            name: h.name,
            type: h.type,
            category: 'international',
            region: h.region
          });
        });
    }

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  }

  getRegions(): { code: Region; name: string; type: 'country' | 'state' }[] {
    return [
      { code: 'IN', name: 'India (National)', type: 'country' },
      { code: 'IN-MH', name: 'Maharashtra', type: 'state' },
      { code: 'IN-KA', name: 'Karnataka', type: 'state' },
      { code: 'IN-DL', name: 'Delhi', type: 'state' },
      { code: 'IN-TN', name: 'Tamil Nadu', type: 'state' },
      { code: 'IN-GJ', name: 'Gujarat', type: 'state' },
      { code: 'IN-WB', name: 'West Bengal', type: 'state' },
      { code: 'IN-KL', name: 'Kerala', type: 'state' },
      { code: 'US', name: 'United States', type: 'country' },
      { code: 'UK', name: 'United Kingdom', type: 'country' },
      { code: 'EU', name: 'European Union', type: 'country' },
      { code: 'SG', name: 'Singapore', type: 'country' },
      { code: 'HK', name: 'Hong Kong', type: 'country' },
      { code: 'JP', name: 'Japan', type: 'country' },
      { code: 'AU', name: 'Australia', type: 'country' },
    ];
  }

  getExchangesByRegion(region: Region): Exchange[] {
    const exchangeMap: Record<Region, Exchange[]> = {
      'IN': ['NSE', 'BSE', 'MCX', 'NCDEX'],
      'IN-MH': ['NSE', 'BSE', 'MCX', 'NCDEX'],
      'IN-KA': ['NSE', 'BSE'],
      'IN-DL': ['NSE', 'BSE'],
      'IN-TN': ['NSE', 'BSE'],
      'IN-GJ': ['NSE', 'BSE'],
      'IN-WB': ['NSE', 'BSE'],
      'IN-KL': ['NSE', 'BSE'],
      'US': ['NYSE', 'NASDAQ', 'CME'],
      'UK': ['LSE'],
      'EU': ['EURONEXT', 'XETRA', 'SIX'],
      'SG': ['SGX'],
      'HK': ['HKEX'],
      'JP': ['TSE'],
      'AU': ['ASX'],
    };
    return exchangeMap[region] || [];
  }
}

export const marketHolidayService = new MarketHolidayService();
export type { MarketHoliday, BankHoliday, MarketStatus, TradingCalendarDay, Region, Exchange };
