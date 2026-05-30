import { Router } from "express";
import { financialCalendarService } from "../services/financial-calendar-service";
import { marketHolidayService, type Region } from "../services/market-holiday-service";
import { insertBondCalendarEventSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventTypes,
      instrumentTypes,
      status,
      limit = "50",
      offset = "0",
    } = req.query;

    const options = {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      eventTypes: eventTypes ? (eventTypes as string).split(",") : undefined,
      instrumentTypes: instrumentTypes ? (instrumentTypes as string).split(",") : undefined,
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const result = await financialCalendarService.getUpcomingEvents(options);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch calendar events",
    });
  }
});

router.get("/events/month/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const events = await financialCalendarService.getEventsByMonth(
      parseInt(year, 10),
      parseInt(month, 10)
    );

    res.json({
      success: true,
      events,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });
  } catch (error) {
    console.error("Error fetching monthly events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch monthly events",
    });
  }
});

router.get("/events/highlighted", async (req, res) => {
  try {
    const events = await financialCalendarService.getHighlightedEvents();
    
    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Error fetching highlighted events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch highlighted events",
    });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await financialCalendarService.getCalendarStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching calendar stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch calendar stats",
    });
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const event = await financialCalendarService.getEventById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    res.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch event",
    });
  }
});

router.post("/events", async (req, res) => {
  try {
    const validated = insertBondCalendarEventSchema.parse(req.body);
    const event = await financialCalendarService.createEvent(validated);
    
    res.status(201).json({
      success: true,
      event,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.issues,
      });
    }
    console.error("Error creating event:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create event",
    });
  }
});

router.patch("/events/:id", async (req, res) => {
  try {
    const event = await financialCalendarService.updateEvent(req.params.id, req.body);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    res.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update event",
    });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const deleted = await financialCalendarService.deleteEvent(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete event",
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const result = await financialCalendarService.refreshCalendar();
    
    res.json({
      success: true,
      message: `Calendar refreshed. ${result.synced} events synced.`,
      ...result,
    });
  } catch (error) {
    console.error("Error refreshing calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh calendar",
    });
  }
});

router.post("/initialize", async (req, res) => {
  try {
    await financialCalendarService.initialize();
    
    res.json({
      success: true,
      message: "Calendar initialized with sample data",
    });
  } catch (error) {
    console.error("Error initializing calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize calendar",
    });
  }
});

router.post("/sync/rbi", async (req, res) => {
  try {
    const count = await financialCalendarService.syncExternalRBICalendar();
    
    res.json({
      success: true,
      message: `Synced ${count} events from RBI auction calendar`,
      synced: count,
      source: "rbi",
    });
  } catch (error) {
    console.error("Error syncing RBI calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync RBI calendar",
    });
  }
});

router.post("/sync/sebi", async (req, res) => {
  try {
    const count = await financialCalendarService.syncExternalSEBICalendar();
    
    res.json({
      success: true,
      message: `Synced ${count} events from SEBI public issues calendar`,
      synced: count,
      source: "sebi",
    });
  } catch (error) {
    console.error("Error syncing SEBI calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync SEBI calendar",
    });
  }
});

router.post("/sync/external", async (req, res) => {
  try {
    const rbiCount = await financialCalendarService.syncExternalRBICalendar();
    const sebiCount = await financialCalendarService.syncExternalSEBICalendar();
    const nseCount = await financialCalendarService.syncExternalNSECalendar();
    const bseCount = await financialCalendarService.syncExternalBSECalendar();
    
    res.json({
      success: true,
      message: `Synced ${rbiCount + sebiCount + nseCount + bseCount} events from external calendars`,
      synced: {
        rbi: rbiCount,
        sebi: sebiCount,
        nse: nseCount,
        bse: bseCount,
        total: rbiCount + sebiCount + nseCount + bseCount,
      },
    });
  } catch (error) {
    console.error("Error syncing external calendars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync external calendars",
    });
  }
});

router.post("/sync/nse", async (req, res) => {
  try {
    const count = await financialCalendarService.syncExternalNSECalendar();
    
    res.json({
      success: true,
      message: `Synced ${count} events from NSE bond platform`,
      synced: count,
      source: "nse",
    });
  } catch (error) {
    console.error("Error syncing NSE calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync NSE calendar",
    });
  }
});

router.post("/sync/bse", async (req, res) => {
  try {
    const count = await financialCalendarService.syncExternalBSECalendar();
    
    res.json({
      success: true,
      message: `Synced ${count} events from BSE bond platform`,
      synced: count,
      source: "bse",
    });
  } catch (error) {
    console.error("Error syncing BSE calendar:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync BSE calendar",
    });
  }
});

router.get("/export/ical", async (req, res) => {
  try {
    const { eventTypes, instrumentTypes, sources, months } = req.query;
    
    const icalFeed = await financialCalendarService.generateICalFeed({
      eventTypes: eventTypes ? (eventTypes as string).split(",") : undefined,
      instrumentTypes: instrumentTypes ? (instrumentTypes as string).split(",") : undefined,
      sources: sources ? (sources as string).split(",") : undefined,
      months: months ? parseInt(months as string, 10) : 6,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=fintekpro-bond-calendar.ics");
    res.send(icalFeed);
  } catch (error) {
    console.error("Error generating iCal feed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate iCal feed",
    });
  }
});

router.get("/events/:id/google-calendar", async (req, res) => {
  try {
    const event = await financialCalendarService.getEventById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    const googleCalendarUrl = financialCalendarService.generateGoogleCalendarUrl(event);
    
    res.json({
      success: true,
      url: googleCalendarUrl,
      event: {
        id: event.id,
        title: event.eventTitle,
      },
    });
  } catch (error) {
    console.error("Error generating Google Calendar URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate Google Calendar URL",
    });
  }
});

router.get("/events/:id/ical", async (req, res) => {
  try {
    const event = await financialCalendarService.getEventById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found",
      });
    }

    const icalEvent = financialCalendarService.generateICalEvent(event);
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FintekPro//Bond Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      icalEvent,
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=event-${event.id}.ics`);
    res.send(icalContent);
  } catch (error) {
    console.error("Error generating iCal event:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate iCal event",
    });
  }
});

router.get("/external", async (req, res) => {
  try {
    const { sources, startDate, endDate, limit } = req.query;
    
    const events = await financialCalendarService.getExternalCalendarEvents({
      sources: sources ? (sources as string).split(",") : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    res.json({
      success: true,
      events,
      total: events.length,
      sources: ['rbi_external', 'sebi_external', 'nse_external', 'bse_external'],
    });
  } catch (error) {
    console.error("Error fetching external calendar events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch external calendar events",
    });
  }
});

// =====================================================
// HOLIDAY CALENDAR ROUTES (Bank + Trading Holidays)
// =====================================================

router.get("/holidays/regions", async (_req, res) => {
  try {
    const regions = marketHolidayService.getRegions();
    res.json({
      success: true,
      regions,
    });
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({ success: false, error: "Failed to fetch regions" });
  }
});

router.get("/holidays/bank", async (req, res) => {
  try {
    const { region = 'IN', count = '20' } = req.query;
    const holidays = marketHolidayService.getUpcomingBankHolidays(
      parseInt(count as string, 10),
      region as Region
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      region,
    });
  } catch (error) {
    console.error("Error fetching bank holidays:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bank holidays" });
  }
});

router.get("/holidays/bank/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const { region } = req.query;
    
    const holidays = marketHolidayService.getBankHolidaysForYear(
      parseInt(year, 10),
      region as Region | undefined
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      year: parseInt(year, 10),
      region: region || 'all',
    });
  } catch (error) {
    console.error("Error fetching bank holidays for year:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bank holidays" });
  }
});

router.get("/holidays/trading", async (req, res) => {
  try {
    const { region, count = '20' } = req.query;
    const holidays = marketHolidayService.getUpcomingInternationalHolidays(
      parseInt(count as string, 10),
      region as Region | undefined
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      region: region || 'all',
    });
  } catch (error) {
    console.error("Error fetching trading holidays:", error);
    res.status(500).json({ success: false, error: "Failed to fetch trading holidays" });
  }
});

router.get("/holidays/trading/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const { region } = req.query;
    
    const holidays = marketHolidayService.getInternationalHolidaysForYear(
      parseInt(year, 10),
      region as Region | undefined
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      year: parseInt(year, 10),
      region: region || 'all',
    });
  } catch (error) {
    console.error("Error fetching trading holidays for year:", error);
    res.status(500).json({ success: false, error: "Failed to fetch trading holidays" });
  }
});

router.get("/holidays/indian-markets", async (req, res) => {
  try {
    const { exchange = 'NSE', count = '20' } = req.query;
    const holidays = marketHolidayService.getUpcomingHolidays(
      parseInt(count as string, 10),
      exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX'
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      exchange,
    });
  } catch (error) {
    console.error("Error fetching Indian market holidays:", error);
    res.status(500).json({ success: false, error: "Failed to fetch Indian market holidays" });
  }
});

router.get("/holidays/month/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const { 
      includeTrading = 'true', 
      includeBank = 'true', 
      includeInternational = 'true',
      region 
    } = req.query;
    
    const holidays = marketHolidayService.getAllHolidaysForMonth(
      parseInt(year, 10),
      parseInt(month, 10),
      {
        includeTrading: includeTrading === 'true',
        includeBank: includeBank === 'true',
        includeInternational: includeInternational === 'true',
        region: region as Region | undefined,
      }
    );
    
    res.json({
      success: true,
      holidays,
      total: holidays.length,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });
  } catch (error) {
    console.error("Error fetching holidays for month:", error);
    res.status(500).json({ success: false, error: "Failed to fetch holidays for month" });
  }
});

router.get("/holidays/check/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { region = 'IN', exchange = 'NSE' } = req.query;
    
    const bankHoliday = marketHolidayService.getBankHoliday(date, region as Region);
    const tradingHoliday = marketHolidayService.getHoliday(date, exchange as any);
    const intlHoliday = marketHolidayService.getInternationalHoliday(date, exchange as any);
    const isWeekend = marketHolidayService.isWeekendDay(date);
    
    res.json({
      success: true,
      date,
      isWeekend,
      isBankHoliday: !!bankHoliday,
      isTradingHoliday: !!tradingHoliday || !!intlHoliday,
      bankHoliday: bankHoliday || null,
      tradingHoliday: tradingHoliday || intlHoliday || null,
      region,
      exchange,
    });
  } catch (error) {
    console.error("Error checking holiday:", error);
    res.status(500).json({ success: false, error: "Failed to check holiday" });
  }
});

router.get("/holidays/exchanges/:region", async (req, res) => {
  try {
    const { region } = req.params;
    const exchanges = marketHolidayService.getExchangesByRegion(region as Region);
    
    res.json({
      success: true,
      region,
      exchanges,
    });
  } catch (error) {
    console.error("Error fetching exchanges:", error);
    res.status(500).json({ success: false, error: "Failed to fetch exchanges" });
  }
});

export default router;
