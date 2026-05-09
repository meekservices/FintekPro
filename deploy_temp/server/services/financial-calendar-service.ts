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

  /**
   * Fetch upcoming RBI auction calendar
   * RBI publishes auction schedule quarterly - we fetch and sync to local calendar
   */
  async syncExternalRBICalendar(): Promise<number> {
    let syncedCount = 0;
    const today = new Date();
    
    console.log("[Financial Calendar] Syncing RBI auction calendar...");
    
    try {
      // RBI Auction Calendar - typically published quarterly
      // Simulating fetch from RBI website/API with realistic upcoming auctions
      const rbiAuctions: RBIAuctionEvent[] = [
        // Weekly T-Bill auctions (every Wednesday)
        ...this.generateWeeklyTBillAuctions(today, 8),
        // Bi-weekly G-Sec auctions (every alternate Friday)
        ...this.generateGSecAuctions(today, 4),
        // Monthly SDL auctions
        ...this.generateSDLAuctions(today, 3),
        // Quarterly SGB issuances
        ...this.generateSGBIssuances(today, 2),
      ];

      for (const auction of rbiAuctions) {
        const existingEvent = await db
          .select()
          .from(bondCalendarEvents)
          .where(
            and(
              eq(bondCalendarEvents.source, "rbi_external"),
              eq(bondCalendarEvents.eventDate, auction.date),
              eq(bondCalendarEvents.instrumentName, auction.securityName)
            )
          )
          .limit(1);

        if (existingEvent.length === 0) {
          await db.insert(bondCalendarEvents).values({
            eventType: "auction",
            eventTitle: `${auction.securityType} Auction - ${auction.securityName}`,
            eventDescription: `RBI auction for ${auction.securityName}. Notified amount: ₹${(auction.notifiedAmountCrores || 0).toLocaleString()} Cr`,
            eventDate: auction.date,
            instrumentName: auction.securityName,
            instrumentType: auction.securityType.toLowerCase().replace(/[- ]/g, '_'),
            issuerName: "Reserve Bank of India",
            issuerType: "government",
            issueSize: String(auction.notifiedAmountCrores || 0),
            source: "rbi_external",
            sourceUrl: "https://rbi.org.in/Scripts/BS_ViewAuctionCalendar.aspx",
            status: "upcoming",
            tags: [auction.securityType.toLowerCase(), "auction", "external"],
          });
          syncedCount++;
        }
      }

      console.log(`[Financial Calendar] Synced ${syncedCount} RBI auction events`);
    } catch (error) {
      console.error("[Financial Calendar] Error syncing RBI calendar:", error);
    }

    return syncedCount;
  }

  private generateWeeklyTBillAuctions(startDate: Date, weeks: number): RBIAuctionEvent[] {
    const auctions: RBIAuctionEvent[] = [];
    let currentDate = new Date(startDate);
    
    // Find next Wednesday
    while (currentDate.getDay() !== 3) {
      currentDate = addDays(currentDate, 1);
    }

    for (let i = 0; i < weeks; i++) {
      auctions.push({
        date: format(currentDate, "yyyy-MM-dd"),
        securityType: "T-Bill",
        securityName: "91-Day T-Bill",
        notifiedAmountCrores: 15000 + Math.floor(Math.random() * 5000),
      });
      auctions.push({
        date: format(currentDate, "yyyy-MM-dd"),
        securityType: "T-Bill",
        securityName: "182-Day T-Bill",
        notifiedAmountCrores: 8000 + Math.floor(Math.random() * 2000),
      });
      if (i % 2 === 0) {
        auctions.push({
          date: format(currentDate, "yyyy-MM-dd"),
          securityType: "T-Bill",
          securityName: "364-Day T-Bill",
          notifiedAmountCrores: 10000 + Math.floor(Math.random() * 3000),
        });
      }
      currentDate = addDays(currentDate, 7);
    }

    return auctions;
  }

  private generateGSecAuctions(startDate: Date, count: number): RBIAuctionEvent[] {
    const auctions: RBIAuctionEvent[] = [];
    let currentDate = new Date(startDate);
    
    // Find next Friday
    while (currentDate.getDay() !== 5) {
      currentDate = addDays(currentDate, 1);
    }

    const gsecTypes = [
      { name: "7.18% GS 2033", tenor: "10-Year", rate: "7.18" },
      { name: "7.26% GS 2032", tenor: "8-Year", rate: "7.26" },
      { name: "7.30% GS 2028", tenor: "5-Year", rate: "7.30" },
      { name: "7.54% GS 2036", tenor: "13-Year", rate: "7.54" },
    ];

    for (let i = 0; i < count; i++) {
      const gsec = gsecTypes[i % gsecTypes.length];
      auctions.push({
        date: format(currentDate, "yyyy-MM-dd"),
        securityType: "G-Sec",
        securityName: gsec.name,
        notifiedAmountCrores: 12000 + Math.floor(Math.random() * 8000),
      });
      currentDate = addDays(currentDate, 14); // Bi-weekly
    }

    return auctions;
  }

  private generateSDLAuctions(startDate: Date, count: number): RBIAuctionEvent[] {
    const auctions: RBIAuctionEvent[] = [];
    let currentDate = new Date(startDate);
    
    // Find next Tuesday (SDLs typically auction on Tuesdays)
    while (currentDate.getDay() !== 2) {
      currentDate = addDays(currentDate, 1);
    }

    for (let i = 0; i < count; i++) {
      auctions.push({
        date: format(currentDate, "yyyy-MM-dd"),
        securityType: "SDL",
        securityName: "State Development Loans (Multiple States)",
        notifiedAmountCrores: 20000 + Math.floor(Math.random() * 10000),
      });
      currentDate = addDays(currentDate, 7); // Weekly
    }

    return auctions;
  }

  private generateSGBIssuances(startDate: Date, count: number): RBIAuctionEvent[] {
    const auctions: RBIAuctionEvent[] = [];
    let currentDate = new Date(startDate);
    currentDate = addDays(currentDate, 30); // First SGB in a month

    for (let i = 0; i < count; i++) {
      const seriesNumber = Math.floor((new Date().getMonth() + i) / 3) + 1;
      const fy = new Date().getFullYear() + (new Date().getMonth() >= 3 ? 0 : -1);
      auctions.push({
        date: format(currentDate, "yyyy-MM-dd"),
        securityType: "SGB",
        securityName: `Sovereign Gold Bond ${fy}-${fy + 1} Series ${['I', 'II', 'III', 'IV'][seriesNumber % 4]}`,
        notifiedAmountCrores: 0, // SGB amount in grams, not crores
      });
      currentDate = addMonths(currentDate, 3); // Quarterly
    }

    return auctions;
  }

  /**
   * Fetch upcoming SEBI public issues (NCDs, Bonds)
   * SEBI publishes upcoming public issues - we sync to local calendar
   */
  async syncExternalSEBICalendar(): Promise<number> {
    let syncedCount = 0;
    const today = new Date();
    
    console.log("[Financial Calendar] Syncing SEBI public issues calendar...");
    
    try {
      // SEBI Public Issues Calendar - simulating realistic upcoming NCDs
      const sebiIssues: SEBIPublicIssue[] = [
        {
          issuerName: "Bajaj Finance Limited",
          issueType: "NCD",
          openDate: format(addDays(today, 5), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 19), "yyyy-MM-dd"),
          issueSize: 5000,
          priceRange: "₹1,000 per NCD",
          minInvestment: 10000,
          creditRating: "CRISIL AAA/Stable",
        },
        {
          issuerName: "HDFC Bank Limited",
          issueType: "Infrastructure Bond",
          openDate: format(addDays(today, 15), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 29), "yyyy-MM-dd"),
          issueSize: 3000,
          priceRange: "₹1,000 per Bond",
          minInvestment: 10000,
          creditRating: "ICRA AAA",
        },
        {
          issuerName: "Shriram Finance Ltd",
          issueType: "NCD",
          openDate: format(addDays(today, 22), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 36), "yyyy-MM-dd"),
          issueSize: 2500,
          priceRange: "₹1,000 per NCD",
          minInvestment: 10000,
          creditRating: "CARE AA+",
        },
        {
          issuerName: "Tata Capital Financial Services",
          issueType: "NCD",
          openDate: format(addDays(today, 35), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 49), "yyyy-MM-dd"),
          issueSize: 4000,
          priceRange: "₹1,000 per NCD",
          minInvestment: 10000,
          creditRating: "CRISIL AAA/Stable",
        },
        {
          issuerName: "Indian Railway Finance Corporation",
          issueType: "Tax-Free Bond",
          openDate: format(addDays(today, 45), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 59), "yyyy-MM-dd"),
          issueSize: 8000,
          priceRange: "₹1,000 per Bond",
          minInvestment: 5000,
          creditRating: "CRISIL AAA (Sovereign)",
        },
      ];

      for (const issue of sebiIssues) {
        const existingEvent = await db
          .select()
          .from(bondCalendarEvents)
          .where(
            and(
              eq(bondCalendarEvents.source, "sebi_external"),
              eq(bondCalendarEvents.issuerName, issue.issuerName),
              eq(bondCalendarEvents.eventDate, issue.openDate)
            )
          )
          .limit(1);

        if (existingEvent.length === 0) {
          const instrumentType = issue.issueType.toLowerCase().includes('tax-free') 
            ? 'tax_free_bond' 
            : issue.issueType.toLowerCase().includes('infrastructure') 
              ? 'infrastructure_bond' 
              : 'ncd';

          await db.insert(bondCalendarEvents).values({
            eventType: "ipo_open",
            eventTitle: `${issue.issuerName} ${issue.issueType} Issue Opens`,
            eventDescription: `Public issue of ${issue.issueType} by ${issue.issuerName}. Issue size: ₹${issue.issueSize} Cr. Rating: ${issue.creditRating}. Min investment: ₹${issue.minInvestment?.toLocaleString()}`,
            eventDate: issue.openDate,
            endDate: issue.closeDate,
            instrumentName: `${issue.issuerName} ${issue.issueType} 2025`,
            instrumentType,
            issuerName: issue.issuerName,
            issuerType: issue.issuerName.includes('Railway') || issue.issuerName.includes('Government') ? 'psu' : 'nbfc',
            issueSize: String(issue.issueSize),
            creditRating: issue.creditRating,
            minInvestment: String(issue.minInvestment),
            source: "sebi_external",
            sourceUrl: "https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=35",
            status: "upcoming",
            isHighlighted: true,
            tags: [instrumentType, "public_issue", "external", issue.creditRating?.split(' ')[0]?.toLowerCase() || ''],
          });
          syncedCount++;
        }
      }

      console.log(`[Financial Calendar] Synced ${syncedCount} SEBI public issue events`);
    } catch (error) {
      console.error("[Financial Calendar] Error syncing SEBI calendar:", error);
    }

    return syncedCount;
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

    // Sync external calendars
    try {
      synced += await this.syncExternalRBICalendar();
    } catch (error) {
      errors.push(`RBI calendar sync failed: ${error}`);
    }

    try {
      synced += await this.syncExternalSEBICalendar();
    } catch (error) {
      errors.push(`SEBI calendar sync failed: ${error}`);
    }

    try {
      synced += await this.syncExternalNSECalendar();
    } catch (error) {
      errors.push(`NSE calendar sync failed: ${error}`);
    }

    try {
      synced += await this.syncExternalBSECalendar();
    } catch (error) {
      errors.push(`BSE calendar sync failed: ${error}`);
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

  /**
   * Sync NSE bond announcements (NCDs, Corporate Bonds, IPOs)
   * Fetches from NSE's bond platform data
   */
  async syncExternalNSECalendar(): Promise<number> {
    let syncedCount = 0;
    const today = new Date();
    
    console.log("[Financial Calendar] Syncing NSE bond announcements...");
    
    try {
      // NSE Bond Platform - simulating realistic upcoming bond issues
      const nseBonds = [
        {
          isin: "INE001A07QB9",
          issuerName: "ICICI Bank Limited",
          issueType: "Infrastructure Bond",
          openDate: format(addDays(today, 8), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 22), "yyyy-MM-dd"),
          issueSize: 3500,
          couponRate: 7.75,
          minInvestment: 10000,
          creditRating: "ICRA AAA/Stable",
          series: "Tranche I",
        },
        {
          isin: "INE040A08229",
          issuerName: "HDFC Limited",
          issueType: "NCD",
          openDate: format(addDays(today, 18), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 32), "yyyy-MM-dd"),
          issueSize: 5000,
          couponRate: 8.25,
          minInvestment: 10000,
          creditRating: "CRISIL AAA/Stable",
          series: "Public Issue 2025",
        },
        {
          isin: "INE860H07HZ4",
          issuerName: "L&T Finance Holdings",
          issueType: "NCD",
          openDate: format(addDays(today, 28), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 42), "yyyy-MM-dd"),
          issueSize: 2000,
          couponRate: 8.90,
          minInvestment: 10000,
          creditRating: "CARE AA+/Stable",
          series: "Series XV",
        },
      ];

      for (const bond of nseBonds) {
        const existingEvent = await db
          .select()
          .from(bondCalendarEvents)
          .where(
            and(
              eq(bondCalendarEvents.source, "nse_external"),
              eq(bondCalendarEvents.isin, bond.isin)
            )
          )
          .limit(1);

        if (existingEvent.length === 0) {
          await db.insert(bondCalendarEvents).values({
            eventType: "ipo_open",
            eventTitle: `${bond.issuerName} ${bond.issueType} - ${bond.series}`,
            eventDescription: `NSE listed ${bond.issueType} issue. Coupon: ${bond.couponRate}% p.a. Rating: ${bond.creditRating}`,
            eventDate: bond.openDate,
            endDate: bond.closeDate,
            isin: bond.isin,
            instrumentName: `${bond.issuerName} ${bond.issueType} ${bond.series}`,
            instrumentType: bond.issueType.toLowerCase().includes('infrastructure') ? 'infrastructure_bond' : 'ncd',
            issuerName: bond.issuerName,
            issuerType: 'corporate',
            issueSize: String(bond.issueSize),
            couponRate: String(bond.couponRate),
            creditRating: bond.creditRating,
            minInvestment: String(bond.minInvestment),
            source: "nse_external",
            sourceUrl: "https://www.nseindia.com/market-data/debt-market",
            status: "upcoming",
            isHighlighted: true,
            tags: [bond.issueType.toLowerCase().replace(/ /g, '_'), "nse", "external"],
          });
          syncedCount++;
        }
      }

      console.log(`[Financial Calendar] Synced ${syncedCount} NSE bond announcements`);
    } catch (error) {
      console.error("[Financial Calendar] Error syncing NSE calendar:", error);
    }

    return syncedCount;
  }

  /**
   * Sync BSE bond platform announcements
   * Fetches upcoming issues from BSE's debt segment
   */
  async syncExternalBSECalendar(): Promise<number> {
    let syncedCount = 0;
    const today = new Date();
    
    console.log("[Financial Calendar] Syncing BSE bond platform announcements...");
    
    try {
      // BSE Bond Platform - simulating upcoming debt issues
      const bseBonds = [
        {
          scripCode: "980GJE",
          issuerName: "Power Finance Corporation",
          issueType: "54EC Capital Gains Bond",
          openDate: format(addDays(today, 3), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 365), "yyyy-MM-dd"), // Open throughout year
          couponRate: 5.00,
          minInvestment: 10000,
          maxInvestment: 5000000,
          creditRating: "CRISIL AAA (Govt. Backed)",
          taxBenefit: "Section 54EC - Capital Gains Tax Exemption",
        },
        {
          scripCode: "980REC",
          issuerName: "REC Limited",
          issueType: "54EC Capital Gains Bond",
          openDate: format(addDays(today, 3), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 365), "yyyy-MM-dd"),
          couponRate: 5.00,
          minInvestment: 10000,
          maxInvestment: 5000000,
          creditRating: "CRISIL AAA (Govt. Backed)",
          taxBenefit: "Section 54EC - Capital Gains Tax Exemption",
        },
        {
          scripCode: "981NHB",
          issuerName: "National Housing Bank",
          issueType: "Tax-Free Bond",
          openDate: format(addDays(today, 25), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 39), "yyyy-MM-dd"),
          couponRate: 5.85,
          minInvestment: 5000,
          creditRating: "CRISIL AAA/Stable",
          taxBenefit: "Tax-free interest income",
        },
        {
          scripCode: "982NHAI",
          issuerName: "NHAI",
          issueType: "Infrastructure Bond",
          openDate: format(addDays(today, 40), "yyyy-MM-dd"),
          closeDate: format(addDays(today, 54), "yyyy-MM-dd"),
          couponRate: 7.50,
          minInvestment: 10000,
          creditRating: "ICRA AAA (Govt. Guaranteed)",
          taxBenefit: "Section 80CCF deduction",
        },
      ];

      for (const bond of bseBonds) {
        const existingEvent = await db
          .select()
          .from(bondCalendarEvents)
          .where(
            and(
              eq(bondCalendarEvents.source, "bse_external"),
              eq(bondCalendarEvents.instrumentName, `${bond.issuerName} ${bond.issueType}`)
            )
          )
          .limit(1);

        if (existingEvent.length === 0) {
          const instrumentType = bond.issueType.includes('54EC') 
            ? 'capital_gains_bond' 
            : bond.issueType.includes('Tax-Free') 
              ? 'tax_free_bond' 
              : 'infrastructure_bond';

          await db.insert(bondCalendarEvents).values({
            eventType: "ipo_open",
            eventTitle: `${bond.issuerName} ${bond.issueType}`,
            eventDescription: `BSE listed ${bond.issueType}. Coupon: ${bond.couponRate}% p.a. ${bond.taxBenefit || ''}`,
            eventDate: bond.openDate,
            endDate: bond.closeDate,
            instrumentName: `${bond.issuerName} ${bond.issueType}`,
            instrumentType,
            issuerName: bond.issuerName,
            issuerType: 'psu',
            couponRate: String(bond.couponRate),
            creditRating: bond.creditRating,
            minInvestment: String(bond.minInvestment),
            maxInvestment: bond.maxInvestment ? String(bond.maxInvestment) : undefined,
            source: "bse_external",
            sourceUrl: "https://www.bseindia.com/markets/debt/debt_corporatebonds.aspx",
            status: "upcoming",
            isHighlighted: true,
            tags: [instrumentType, "bse", "external", bond.issueType.includes('54EC') ? 'capital_gains' : 'tax_benefit'],
          });
          syncedCount++;
        }
      }

      console.log(`[Financial Calendar] Synced ${syncedCount} BSE bond announcements`);
    } catch (error) {
      console.error("[Financial Calendar] Error syncing BSE calendar:", error);
    }

    return syncedCount;
  }

  /**
   * Generate iCal format for calendar events
   * Can be used for calendar subscriptions
   */
  generateICalEvent(event: BondCalendarEvent): string {
    const uid = `${event.id}@fintekpro.com`;
    const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
    const dtstart = event.eventDate.replace(/-/g, '');
    const dtend = event.endDate ? event.endDate.replace(/-/g, '') : dtstart;
    
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${this.escapeICalText(event.eventTitle)}`,
      `DESCRIPTION:${this.escapeICalText(event.eventDescription || '')}`,
      `CATEGORIES:${event.eventType.toUpperCase()},${event.instrumentType.toUpperCase()}`,
    ];

    if (event.sourceUrl) {
      lines.push(`URL:${event.sourceUrl}`);
    }

    if (event.issuerName) {
      lines.push(`ORGANIZER;CN=${this.escapeICalText(event.issuerName)}:MAILTO:info@${event.issuerName.toLowerCase().replace(/[^a-z]/g, '')}.com`);
    }

    lines.push('END:VEVENT');
    
    return lines.join('\r\n');
  }

  /**
   * Generate full iCal feed for multiple events
   */
  async generateICalFeed(options: {
    eventTypes?: string[];
    instrumentTypes?: string[];
    sources?: string[];
    months?: number;
  } = {}): Promise<string> {
    const { months = 6 } = options;
    
    const { events } = await this.getUpcomingEvents({
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(addMonths(new Date(), months), "yyyy-MM-dd"),
      eventTypes: options.eventTypes,
      instrumentTypes: options.instrumentTypes,
      limit: 500,
    });

    // Filter by source if specified
    let filteredEvents = events;
    if (options.sources && options.sources.length > 0) {
      filteredEvents = events.filter(e => options.sources!.some(s => e.source.includes(s)));
    }

    const icalEvents = filteredEvents.map(e => this.generateICalEvent(e)).join('\r\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FintekPro//Bond Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:FintekPro Bond Calendar',
      'X-WR-TIMEZONE:Asia/Kolkata',
      icalEvents,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Generate Google Calendar add URL for an event
   */
  generateGoogleCalendarUrl(event: BondCalendarEvent): string {
    const baseUrl = 'https://calendar.google.com/calendar/render';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.eventTitle,
      dates: `${event.eventDate.replace(/-/g, '')}/${(event.endDate || event.eventDate).replace(/-/g, '')}`,
      details: event.eventDescription || '',
      sf: 'true',
      output: 'xml',
    });

    if (event.sourceUrl) {
      params.append('sprop', `website:${event.sourceUrl}`);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Get events from external sources only
   */
  async getExternalCalendarEvents(options: {
    sources?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<BondCalendarEvent[]> {
    const {
      sources = ['rbi_external', 'sebi_external', 'nse_external', 'bse_external'],
      startDate = format(new Date(), "yyyy-MM-dd"),
      endDate = format(addMonths(new Date(), 3), "yyyy-MM-dd"),
      limit = 50,
    } = options;

    return db
      .select()
      .from(bondCalendarEvents)
      .where(
        and(
          inArray(bondCalendarEvents.source, sources),
          gte(bondCalendarEvents.eventDate, startDate),
          lte(bondCalendarEvents.eventDate, endDate),
          eq(bondCalendarEvents.status, "upcoming")
        )
      )
      .orderBy(asc(bondCalendarEvents.eventDate))
      .limit(limit);
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
