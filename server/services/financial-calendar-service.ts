import { db } from "../db";
import { bondCalendarEvents, governmentSecurities, corporateBonds, bondCatalog } from "@shared/schema";
import type { BondCalendarEvent, InsertBondCalendarEvent } from "@shared/schema";
import { eq, gte, lte, and, or, sql, desc, asc, inArray } from "drizzle-orm";
import { format, addDays, addMonths, parseISO, isAfter, isBefore, startOfMonth, endOfMonth } from "date-fns";

interface RBIAuctionEvent {
  date: string;
  securityType: string;
  securityName: string;
  notifiedAmount?: number;
  notifiedAmountCrores?: number;
}

interface SEBIPublicIssue {
  issuerName: string;
  issueType: string;
  openDate: string;
  closeDate: string;
  issueSize?: number;
  priceRange?: string;
  minInvestment?: number;
  creditRating?: string;
}

class FinancialCalendarService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    console.log("🗓️ Initializing Financial Calendar Service...");
    
    try {
      await this.syncMaturityDatesFromBonds();
      await this.syncCouponDatesFromBonds();
      await this.seedSampleRBIAuctions();
      await this.seedSampleNCDIssuances();
      
      this.isInitialized = true;
      console.log("✅ Financial Calendar Service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Financial Calendar Service:", error);
    }
  }

  async getUpcomingEvents(options: {
    startDate?: string;
    endDate?: string;
    eventTypes?: string[];
    instrumentTypes?: string[];
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ events: BondCalendarEvent[]; total: number }> {
    const {
      startDate = format(new Date(), "yyyy-MM-dd"),
      endDate = format(addMonths(new Date(), 3), "yyyy-MM-dd"),
      eventTypes,
      instrumentTypes,
      status = "upcoming",
      limit = 50,
      offset = 0,
    } = options;

    const conditions = [
      gte(bondCalendarEvents.eventDate, startDate),
      lte(bondCalendarEvents.eventDate, endDate),
    ];

    if (status) {
      conditions.push(eq(bondCalendarEvents.status, status));
    }

    if (eventTypes && eventTypes.length > 0) {
      conditions.push(inArray(bondCalendarEvents.eventType, eventTypes));
    }

    if (instrumentTypes && instrumentTypes.length > 0) {
      conditions.push(inArray(bondCalendarEvents.instrumentType, instrumentTypes));
    }

    const [events, countResult] = await Promise.all([
      db
        .select()
        .from(bondCalendarEvents)
        .where(and(...conditions))
        .orderBy(asc(bondCalendarEvents.eventDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bondCalendarEvents)
        .where(and(...conditions)),
    ]);

    return {
      events,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getEventsByMonth(year: number, month: number): Promise<BondCalendarEvent[]> {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    return db
      .select()
      .from(bondCalendarEvents)
      .where(
        and(
          gte(bondCalendarEvents.eventDate, format(startDate, "yyyy-MM-dd")),
          lte(bondCalendarEvents.eventDate, format(endDate, "yyyy-MM-dd"))
        )
      )
      .orderBy(asc(bondCalendarEvents.eventDate));
  }

  async getHighlightedEvents(): Promise<BondCalendarEvent[]> {
    const today = format(new Date(), "yyyy-MM-dd");
    const threeMonthsLater = format(addMonths(new Date(), 3), "yyyy-MM-dd");

    return db
      .select()
      .from(bondCalendarEvents)
      .where(
        and(
          eq(bondCalendarEvents.isHighlighted, true),
          gte(bondCalendarEvents.eventDate, today),
          lte(bondCalendarEvents.eventDate, threeMonthsLater),
          eq(bondCalendarEvents.status, "upcoming")
        )
      )
      .orderBy(asc(bondCalendarEvents.eventDate))
      .limit(10);
  }

  async getEventById(id: string): Promise<BondCalendarEvent | null> {
    const [event] = await db
      .select()
      .from(bondCalendarEvents)
      .where(eq(bondCalendarEvents.id, id))
      .limit(1);

    return event || null;
  }

  async createEvent(event: InsertBondCalendarEvent): Promise<BondCalendarEvent> {
    const [created] = await db
      .insert(bondCalendarEvents)
      .values(event)
      .returning();

    return created;
  }

  async updateEvent(id: string, updates: Partial<InsertBondCalendarEvent>): Promise<BondCalendarEvent | null> {
    const [updated] = await db
      .update(bondCalendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bondCalendarEvents.id, id))
      .returning();

    return updated || null;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db
      .delete(bondCalendarEvents)
      .where(eq(bondCalendarEvents.id, id))
      .returning({ id: bondCalendarEvents.id });

    return result.length > 0;
  }

  async syncMaturityDatesFromBonds(): Promise<number> {
    let syncedCount = 0;

    try {
      const gsecs = await db
        .select()
        .from(governmentSecurities)
        .where(sql`${governmentSecurities.maturityDate} IS NOT NULL`);

      for (const gsec of gsecs) {
        if (gsec.maturityDate) {
          const existingEvent = await db
            .select()
            .from(bondCalendarEvents)
            .where(
              and(
                eq(bondCalendarEvents.isin, gsec.isin),
                eq(bondCalendarEvents.eventType, "maturity")
              )
            )
            .limit(1);

          if (existingEvent.length === 0) {
            await db.insert(bondCalendarEvents).values({
              eventType: "maturity",
              eventTitle: `${gsec.securityName} Maturity`,
              eventDescription: `Maturity date for ${gsec.securityName}`,
              eventDate: gsec.maturityDate,
              isin: gsec.isin,
              instrumentName: gsec.securityName,
              instrumentType: gsec.securityType,
              issuerName: "Government of India",
              issuerType: "government",
              faceValue: gsec.faceValue,
              couponRate: gsec.couponRate,
              source: "internal",
              status: "upcoming",
              tags: ["sovereign", "maturity"],
            });
            syncedCount++;
          }
        }
      }

      const corporates = await db
        .select()
        .from(corporateBonds)
        .where(sql`${corporateBonds.maturityDate} IS NOT NULL`);

      for (const bond of corporates) {
        if (bond.maturityDate) {
          const existingEvent = await db
            .select()
            .from(bondCalendarEvents)
            .where(
              and(
                eq(bondCalendarEvents.isin, bond.isin),
                eq(bondCalendarEvents.eventType, "maturity")
              )
            )
            .limit(1);

          if (existingEvent.length === 0) {
            await db.insert(bondCalendarEvents).values({
              eventType: "maturity",
              eventTitle: `${bond.bondName} Maturity`,
              eventDescription: `Maturity date for ${bond.bondName}`,
              eventDate: bond.maturityDate,
              isin: bond.isin,
              instrumentName: bond.bondName,
              instrumentType: bond.bondType,
              issuerName: bond.issuer,
              issuerType: "corporate",
              faceValue: bond.faceValue,
              couponRate: bond.couponRate,
              creditRating: bond.creditRating,
              source: "internal",
              status: "upcoming",
              tags: ["corporate", "maturity"],
            });
            syncedCount++;
          }
        }
      }
    } catch (error) {
      console.error("Error syncing maturity dates:", error);
    }

    return syncedCount;
  }

  async syncCouponDatesFromBonds(): Promise<number> {
    let syncedCount = 0;

    try {
      const gsecs = await db
        .select()
        .from(governmentSecurities)
        .where(
          and(
            sql`${governmentSecurities.couponRate} IS NOT NULL`,
            sql`${governmentSecurities.couponRate} > 0`
          )
        );

      const today = new Date();
      const sixMonthsLater = addMonths(today, 6);

      for (const gsec of gsecs) {
        if (gsec.maturityDate) {
          const maturityDate = parseISO(gsec.maturityDate);
          let couponMonth = maturityDate.getMonth();
          
          for (let i = 0; i < 2; i++) {
            const couponDate = new Date(today.getFullYear(), couponMonth, maturityDate.getDate());
            
            if (isAfter(couponDate, today) && isBefore(couponDate, sixMonthsLater)) {
              const existingEvent = await db
                .select()
                .from(bondCalendarEvents)
                .where(
                  and(
                    eq(bondCalendarEvents.isin, gsec.isin),
                    eq(bondCalendarEvents.eventType, "coupon_payment"),
                    eq(bondCalendarEvents.eventDate, format(couponDate, "yyyy-MM-dd"))
                  )
                )
                .limit(1);

              if (existingEvent.length === 0) {
                await db.insert(bondCalendarEvents).values({
                  eventType: "coupon_payment",
                  eventTitle: `${gsec.securityName} Coupon Payment`,
                  eventDescription: `Semi-annual coupon payment at ${gsec.couponRate}% p.a.`,
                  eventDate: format(couponDate, "yyyy-MM-dd"),
                  isin: gsec.isin,
                  instrumentName: gsec.securityName,
                  instrumentType: gsec.securityType,
                  issuerName: "Government of India",
                  issuerType: "government",
                  couponRate: gsec.couponRate,
                  source: "internal",
                  status: "upcoming",
                  tags: ["sovereign", "coupon"],
                });
                syncedCount++;
              }
            }
            couponMonth = (couponMonth + 6) % 12;
          }
        }
      }
    } catch (error) {
      console.error("Error syncing coupon dates:", error);
    }

    return syncedCount;
  }

  async seedSampleRBIAuctions(): Promise<number> {
    const existingAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(bondCalendarEvents)
      .where(eq(bondCalendarEvents.source, "rbi"));

    if (Number(existingAuctions[0]?.count ?? 0) > 0) {
      return 0;
    }

    const today = new Date();
    const sampleAuctions: InsertBondCalendarEvent[] = [
      {
        eventType: "auction",
        eventTitle: "G-Sec Auction - 7.18% 2033",
        eventDescription: "RBI auction for 10-year Government Security bearing 7.18% coupon maturing in 2033",
        eventDate: format(addDays(today, 7), "yyyy-MM-dd"),
        instrumentName: "7.18% GS 2033",
        instrumentType: "gsec",
        issuerName: "Reserve Bank of India",
        issuerType: "government",
        faceValue: "100",
        issueSize: "15000",
        couponRate: "7.180",
        source: "rbi",
        sourceUrl: "https://rbi.org.in/scripts/GSSecAuction.aspx",
        status: "upcoming",
        isHighlighted: true,
        tags: ["gsec", "auction", "10-year"],
      },
      {
        eventType: "auction",
        eventTitle: "T-Bill Auction - 91 Days",
        eventDescription: "Weekly auction for 91-day Treasury Bills",
        eventDate: format(addDays(today, 3), "yyyy-MM-dd"),
        instrumentName: "91-Day T-Bill",
        instrumentType: "tbill",
        issuerName: "Reserve Bank of India",
        issuerType: "government",
        faceValue: "100",
        issueSize: "20000",
        source: "rbi",
        sourceUrl: "https://rbi.org.in/scripts/GSSecAuction.aspx",
        status: "upcoming",
        tags: ["tbill", "auction", "short-term"],
      },
      {
        eventType: "auction",
        eventTitle: "SDL Auction - State Development Loans",
        eventDescription: "Auction for State Development Loans from multiple states",
        eventDate: format(addDays(today, 10), "yyyy-MM-dd"),
        instrumentName: "State Development Loans",
        instrumentType: "sdl",
        issuerName: "Various State Governments",
        issuerType: "government",
        issueSize: "25000",
        source: "rbi",
        sourceUrl: "https://rbi.org.in/scripts/GSSecAuction.aspx",
        status: "upcoming",
        tags: ["sdl", "auction", "state"],
      },
      {
        eventType: "issuance",
        eventTitle: "Sovereign Gold Bond Series IV 2024-25",
        eventDescription: "Sovereign Gold Bond issuance - Series IV of FY 2024-25. Invest in gold-backed government securities.",
        eventDate: format(addDays(today, 14), "yyyy-MM-dd"),
        endDate: format(addDays(today, 18), "yyyy-MM-dd"),
        instrumentName: "Sovereign Gold Bond 2024-25 Series IV",
        instrumentType: "sgb",
        issuerName: "Reserve Bank of India",
        issuerType: "government",
        faceValue: "6500",
        minInvestment: "6500",
        maxInvestment: "2600000",
        lotSize: 1,
        source: "rbi",
        sourceUrl: "https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx",
        status: "upcoming",
        isHighlighted: true,
        tags: ["sgb", "gold", "sovereign"],
      },
    ];

    for (const auction of sampleAuctions) {
      await db.insert(bondCalendarEvents).values(auction);
    }

    return sampleAuctions.length;
  }

  async seedSampleNCDIssuances(): Promise<number> {
    const existingNCDs = await db
      .select({ count: sql<number>`count(*)` })
      .from(bondCalendarEvents)
      .where(
        and(
          eq(bondCalendarEvents.source, "sebi"),
          eq(bondCalendarEvents.eventType, "ipo_open")
        )
      );

    if (Number(existingNCDs[0]?.count ?? 0) > 0) {
      return 0;
    }

    const today = new Date();
    const sampleNCDs: InsertBondCalendarEvent[] = [
      {
        eventType: "ipo_open",
        eventTitle: "Bajaj Finance NCD Issue Opens",
        eventDescription: "Public issue of Secured Redeemable Non-Convertible Debentures by Bajaj Finance Ltd. AAA rated with attractive yields.",
        eventDate: format(addDays(today, 5), "yyyy-MM-dd"),
        endDate: format(addDays(today, 19), "yyyy-MM-dd"),
        instrumentName: "Bajaj Finance NCD Jan 2025",
        instrumentType: "ncd",
        issuerName: "Bajaj Finance Limited",
        issuerType: "nbfc",
        faceValue: "1000",
        issueSize: "5000",
        couponRate: "8.850",
        yieldIndicative: "8.9500",
        creditRating: "CRISIL AAA/Stable",
        minInvestment: "10000",
        lotSize: 10,
        retailQuota: "30.00",
        source: "sebi",
        sourceUrl: "https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=35",
        status: "upcoming",
        isHighlighted: true,
        tags: ["ncd", "ipo", "aaa-rated", "nbfc"],
      },
      {
        eventType: "ipo_open",
        eventTitle: "Muthoot Finance NCD Issue",
        eventDescription: "Public issue of Secured NCDs by Muthoot Finance. Gold loan leader offering competitive rates.",
        eventDate: format(addDays(today, 12), "yyyy-MM-dd"),
        endDate: format(addDays(today, 26), "yyyy-MM-dd"),
        instrumentName: "Muthoot Finance NCD Feb 2025",
        instrumentType: "ncd",
        issuerName: "Muthoot Finance Ltd",
        issuerType: "nbfc",
        faceValue: "1000",
        issueSize: "3000",
        couponRate: "9.100",
        yieldIndicative: "9.2000",
        creditRating: "CRISIL AA+/Stable",
        minInvestment: "10000",
        lotSize: 10,
        retailQuota: "35.00",
        source: "sebi",
        status: "upcoming",
        isHighlighted: true,
        tags: ["ncd", "ipo", "aa-rated", "nbfc"],
      },
      {
        eventType: "ipo_open",
        eventTitle: "IRFC Tax-Free Bond Issue",
        eventDescription: "Indian Railway Finance Corporation Tax-Free Bond issue. Government-backed with tax-free interest income.",
        eventDate: format(addDays(today, 20), "yyyy-MM-dd"),
        endDate: format(addDays(today, 34), "yyyy-MM-dd"),
        instrumentName: "IRFC Tax-Free Bonds 2025",
        instrumentType: "infrastructure_bond",
        issuerName: "Indian Railway Finance Corporation",
        issuerType: "psu",
        faceValue: "1000",
        issueSize: "10000",
        couponRate: "5.750",
        creditRating: "CRISIL AAA/Stable",
        minInvestment: "5000",
        lotSize: 5,
        retailQuota: "40.00",
        source: "sebi",
        status: "upcoming",
        isHighlighted: true,
        tags: ["tax-free", "infrastructure", "psu", "railway"],
      },
    ];

    for (const ncd of sampleNCDs) {
      await db.insert(bondCalendarEvents).values(ncd);
    }

    return sampleNCDs.length;
  }

  async refreshCalendar(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      synced += await this.syncMaturityDatesFromBonds();
    } catch (error) {
      errors.push(`Maturity sync failed: ${error}`);
    }

    try {
      synced += await this.syncCouponDatesFromBonds();
    } catch (error) {
      errors.push(`Coupon sync failed: ${error}`);
    }

    await db
      .update(bondCalendarEvents)
      .set({ 
        status: "completed",
        updatedAt: new Date()
      })
      .where(
        and(
          sql`${bondCalendarEvents.eventDate} < CURRENT_DATE`,
          eq(bondCalendarEvents.status, "upcoming")
        )
      );

    return { synced, errors };
  }

  async getCalendarStats(): Promise<{
    upcomingAuctions: number;
    upcomingIssuances: number;
    upcomingMaturities: number;
    upcomingCoupons: number;
    highlightedEvents: number;
  }> {
    const today = format(new Date(), "yyyy-MM-dd");
    const threeMonths = format(addMonths(new Date(), 3), "yyyy-MM-dd");

    const baseConditions = [
      gte(bondCalendarEvents.eventDate, today),
      lte(bondCalendarEvents.eventDate, threeMonths),
      eq(bondCalendarEvents.status, "upcoming"),
    ];

    const [auctions, issuances, maturities, coupons, highlighted] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(bondCalendarEvents)
        .where(and(...baseConditions, eq(bondCalendarEvents.eventType, "auction"))),
      db.select({ count: sql<number>`count(*)` }).from(bondCalendarEvents)
        .where(and(...baseConditions, or(eq(bondCalendarEvents.eventType, "issuance"), eq(bondCalendarEvents.eventType, "ipo_open")))),
      db.select({ count: sql<number>`count(*)` }).from(bondCalendarEvents)
        .where(and(...baseConditions, eq(bondCalendarEvents.eventType, "maturity"))),
      db.select({ count: sql<number>`count(*)` }).from(bondCalendarEvents)
        .where(and(...baseConditions, eq(bondCalendarEvents.eventType, "coupon_payment"))),
      db.select({ count: sql<number>`count(*)` }).from(bondCalendarEvents)
        .where(and(...baseConditions, eq(bondCalendarEvents.isHighlighted, true))),
    ]);

    return {
      upcomingAuctions: Number(auctions[0]?.count ?? 0),
      upcomingIssuances: Number(issuances[0]?.count ?? 0),
      upcomingMaturities: Number(maturities[0]?.count ?? 0),
      upcomingCoupons: Number(coupons[0]?.count ?? 0),
      highlightedEvents: Number(highlighted[0]?.count ?? 0),
    };
  }
}

export const financialCalendarService = new FinancialCalendarService();
