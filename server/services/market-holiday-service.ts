import { format, addDays, isWeekend, isSameDay, parseISO, getDay } from 'date-fns';

interface MarketHoliday {
  date: string;
  name: string;
  description?: string;
  exchanges: ('NSE' | 'BSE' | 'MCX' | 'NCDEX')[];
  type: 'full' | 'partial';
  specialSession?: {
    name: string;
    startTime: string;
    endTime: string;
  };
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

  constructor() {
    this.initializeHolidays();
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

  isHoliday(date: Date | string, exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX' = 'NSE'): boolean {
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
}

export const marketHolidayService = new MarketHolidayService();
