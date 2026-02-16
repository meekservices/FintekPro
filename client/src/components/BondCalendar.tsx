import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Calendar, 
  CalendarDays,
  TrendingUp, 
  IndianRupee, 
  Building2, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Star,
  Bell,
  ExternalLink,
  Landmark,
  Coins,
  FileText,
  AlertCircle,
  Banknote,
  RefreshCw,
  Globe,
  Download,
  CalendarPlus
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, isAfter, isBefore } from "date-fns";

interface BondCalendarEvent {
  id: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string | null;
  eventDate: string;
  eventTime: string | null;
  endDate: string | null;
  isin: string | null;
  instrumentName: string;
  instrumentType: string;
  issuerName: string | null;
  issuerType: string | null;
  faceValue: string | null;
  issueSize: string | null;
  couponRate: string | null;
  yieldIndicative: string | null;
  creditRating: string | null;
  minInvestment: string | null;
  maxInvestment: string | null;
  lotSize: number | null;
  retailQuota: string | null;
  source: string;
  sourceUrl: string | null;
  status: string;
  isHighlighted: boolean;
  tags: string[];
}

interface CalendarStats {
  upcomingAuctions: number;
  upcomingIssuances: number;
  upcomingMaturities: number;
  upcomingCoupons: number;
  highlightedEvents: number;
}

const eventTypeConfig: Record<string, { label: string; icon: typeof Calendar; color: string; bgColor: string }> = {
  issuance: { label: "New Issue", icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  ipo_open: { label: "IPO Opens", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
  ipo_close: { label: "IPO Closes", icon: Clock, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  auction: { label: "Auction", icon: Landmark, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  maturity: { label: "Maturity", icon: Coins, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  coupon_payment: { label: "Coupon", icon: Banknote, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  listing_date: { label: "Listing", icon: Building2, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  allotment_date: { label: "Allotment", icon: FileText, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
};

const instrumentTypeConfig: Record<string, { label: string; color: string }> = {
  gsec: { label: "G-Sec", color: "bg-blue-500" },
  g_sec: { label: "G-Sec", color: "bg-blue-500" },
  tbill: { label: "T-Bill", color: "bg-sky-500" },
  t_bill: { label: "T-Bill", color: "bg-sky-500" },
  sdl: { label: "SDL", color: "bg-indigo-500" },
  sgb: { label: "SGB", color: "bg-amber-500" },
  corporate_bond: { label: "Corporate", color: "bg-purple-500" },
  ncd: { label: "NCD", color: "bg-orange-500" },
  infrastructure_bond: { label: "Infra Bond", color: "bg-teal-500" },
  tax_free_bond: { label: "Tax-Free", color: "bg-green-500" },
  capital_gains_bond: { label: "54EC Bond", color: "bg-rose-500" },
};

const sourceConfig: Record<string, { label: string; color: string; icon: string }> = {
  rbi: { label: "RBI", color: "bg-blue-600", icon: "RBI" },
  rbi_external: { label: "RBI", color: "bg-blue-600", icon: "RBI" },
  sebi: { label: "SEBI", color: "bg-green-600", icon: "SEBI" },
  sebi_external: { label: "SEBI", color: "bg-green-600", icon: "SEBI" },
  nse: { label: "NSE", color: "bg-orange-600", icon: "NSE" },
  nse_external: { label: "NSE", color: "bg-orange-600", icon: "NSE" },
  bse: { label: "BSE", color: "bg-red-600", icon: "BSE" },
  bse_external: { label: "BSE", color: "bg-red-600", icon: "BSE" },
  internal: { label: "Internal", color: "bg-muted", icon: "INT" },
};

function SourceBadge({ source }: { source: string }) {
  const srcConfig = sourceConfig[source] || { label: source, color: "bg-muted", icon: source };
  const isExternal = source.includes('external');
  
  return (
    <Badge className={`${srcConfig.color} text-foreground text-xs flex items-center gap-1`}>
      {isExternal && <Globe className="h-2.5 w-2.5" />}
      {srcConfig.label}
    </Badge>
  );
}

function EventCard({ event, compact = false }: { event: BondCalendarEvent; compact?: boolean }) {
  const config = eventTypeConfig[event.eventType] || { 
    label: event.eventType, 
    icon: Calendar, 
    color: "text-muted-foreground", 
    bgColor: "bg-muted" 
  };
  const Icon = config.icon;
  const instrConfig = instrumentTypeConfig[event.instrumentType] || { label: event.instrumentType, color: "bg-muted" };

  if (compact) {
    return (
      <div className={`p-2 rounded-lg ${config.bgColor} border cursor-pointer hover:shadow-md transition-shadow`}>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          <span className="text-xs font-medium truncate">{event.eventTitle.slice(0, 20)}</span>
          {event.isHighlighted && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" data-testid={`event-card-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm truncate">{event.eventTitle}</h4>
              {event.isHighlighted && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground mb-2">{event.instrumentName}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">{config.label}</Badge>
              <Badge className={`${instrConfig.color} text-foreground text-xs`}>{instrConfig.label}</Badge>
              {event.creditRating && (
                <Badge variant="secondary" className="text-xs">{event.creditRating}</Badge>
              )}
              <SourceBadge source={event.source} />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium">{format(parseISO(event.eventDate), "MMM d")}</p>
            <p className="text-xs text-muted-foreground">{format(parseISO(event.eventDate), "yyyy")}</p>
            {event.couponRate && (
              <p className="text-xs font-medium text-green-600 mt-1">{parseFloat(event.couponRate).toFixed(2)}%</p>
            )}
          </div>
        </div>
        
        {(event.issueSize || event.minInvestment || event.issuerName) && (
          <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
            {event.issueSize && parseFloat(event.issueSize) > 0 && (
              <span className="flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                {parseFloat(event.issueSize).toLocaleString()} Cr
              </span>
            )}
            {event.minInvestment && (
              <span>Min: ₹{parseFloat(event.minInvestment).toLocaleString()}</span>
            )}
            {event.issuerName && (
              <span className="flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" />
                {event.issuerName}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventDetailDialog({ event, children }: { event: BondCalendarEvent; children: React.ReactNode }) {
  const config = eventTypeConfig[event.eventType] || { label: event.eventType, icon: Calendar, color: "text-muted-foreground", bgColor: "bg-muted" };
  const Icon = config.icon;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {event.eventTitle}
                {event.isHighlighted && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
              </DialogTitle>
              <DialogDescription>{event.instrumentName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Event Date</p>
              <p className="font-medium">{format(parseISO(event.eventDate), "MMMM d, yyyy")}</p>
              {event.endDate && (
                <p className="text-sm text-muted-foreground">to {format(parseISO(event.endDate), "MMM d, yyyy")}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <Badge variant="outline">{config.label}</Badge>
            </div>
          </div>

          {event.eventDescription && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{event.eventDescription}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {event.issuerName && (
              <div>
                <p className="text-xs text-muted-foreground">Issuer</p>
                <p className="font-medium text-sm">{event.issuerName}</p>
              </div>
            )}
            {event.creditRating && (
              <div>
                <p className="text-xs text-muted-foreground">Credit Rating</p>
                <Badge variant="secondary">{event.creditRating}</Badge>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {event.couponRate && (
              <div>
                <p className="text-xs text-muted-foreground">Coupon Rate</p>
                <p className="font-semibold text-green-600">{parseFloat(event.couponRate).toFixed(2)}%</p>
              </div>
            )}
            {event.yieldIndicative && (
              <div>
                <p className="text-xs text-muted-foreground">Indicative Yield</p>
                <p className="font-semibold text-blue-600">{parseFloat(event.yieldIndicative).toFixed(2)}%</p>
              </div>
            )}
            {event.faceValue && (
              <div>
                <p className="text-xs text-muted-foreground">Face Value</p>
                <p className="font-medium">₹{parseFloat(event.faceValue).toLocaleString()}</p>
              </div>
            )}
          </div>

          {(event.minInvestment || event.issueSize || event.retailQuota) && (
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              {event.issueSize && (
                <div>
                  <p className="text-xs text-muted-foreground">Issue Size</p>
                  <p className="font-medium">₹{parseFloat(event.issueSize).toLocaleString()} Cr</p>
                </div>
              )}
              {event.minInvestment && (
                <div>
                  <p className="text-xs text-muted-foreground">Min Investment</p>
                  <p className="font-medium">₹{parseFloat(event.minInvestment).toLocaleString()}</p>
                </div>
              )}
              {event.retailQuota && (
                <div>
                  <p className="text-xs text-muted-foreground">Retail Quota</p>
                  <p className="font-medium">{parseFloat(event.retailQuota).toFixed(0)}%</p>
                </div>
              )}
            </div>
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {event.sourceUrl && (
            <div className="pt-2 border-t">
              <a 
                href={event.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                View Official Announcement <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalendarGrid({ 
  currentDate, 
  events 
}: { 
  currentDate: Date; 
  events: BondCalendarEvent[] 
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, BondCalendarEvent[]>();
    events.forEach(event => {
      const dateKey = event.eventDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="min-h-[100px] border-t border-l bg-muted/30" />
        ))}
        {days.map(day => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isCurrentDay = isToday(day);

          return (
            <div 
              key={dateKey}
              className={`min-h-[100px] border-t border-l p-1 ${
                isCurrentDay ? "bg-blue-50 dark:bg-blue-950" : ""
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentDay 
                  ? "text-blue-600 font-bold" 
                  : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <EventDetailDialog key={event.id} event={event}>
                    <div>
                      <EventCard event={event} compact />
                    </div>
                  </EventDetailDialog>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HighlightedEventsCard({ events }: { events: BondCalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          Featured Opportunities
        </CardTitle>
        <CardDescription>Don't miss these highlighted investment opportunities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map(event => (
          <EventDetailDialog key={event.id} event={event}>
            <div>
              <EventCard event={event} />
            </div>
          </EventDetailDialog>
        ))}
      </CardContent>
    </Card>
  );
}

function StatsCards({ stats }: { stats: CalendarStats }) {
  const items = [
    { label: "Upcoming Auctions", value: stats.upcomingAuctions, icon: Landmark, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
    { label: "New Issuances", value: stats.upcomingIssuances, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
    { label: "Maturities", value: stats.upcomingMaturities, icon: Coins, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
    { label: "Coupon Payments", value: stats.upcomingCoupons, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(item => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BondCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [instrumentTypeFilter, setInstrumentTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [view, setView] = useState<"calendar" | "list">("list");
  const { toast } = useToast();

  const handleExportIcal = () => {
    const url = "/api/bond-calendar/export/ical";
    window.open(url, "_blank");
    toast({
      title: "Calendar Export",
      description: "Downloading iCal file. You can import it into your calendar app.",
    });
  };

  const handleAddToGoogleCalendar = async (eventId: string) => {
    try {
      const res = await fetch(`/api/bond-calendar/events/${eventId}/google-calendar`);
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate Google Calendar link",
        variant: "destructive",
      });
    }
  };

  const handleDownloadEventIcal = (eventId: string) => {
    window.open(`/api/bond-calendar/events/${eventId}/ical`, "_blank");
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: CalendarStats }>({
    queryKey: ["/api/bond-calendar/stats"],
  });

  const { data: highlightedData, isLoading: highlightedLoading } = useQuery<{ success: boolean; events: BondCalendarEvent[] }>({
    queryKey: ["/api/bond-calendar/events/highlighted"],
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ success: boolean; events: BondCalendarEvent[]; year: number; month: number }>({
    queryKey: ["/api/bond-calendar/events/month", year, month],
  });

  const syncExternalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/bond-calendar/sync/external", { method: "POST" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "External Calendars Synced",
        description: `Synced ${data.synced?.total || 0} events from RBI and SEBI calendars`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bond-calendar"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync external calendars",
        variant: "destructive",
      });
    },
  });

  const filteredEvents = useMemo(() => {
    if (!eventsData?.events) return [];
    
    return eventsData.events.filter(event => {
      if (eventTypeFilter !== "all" && event.eventType !== eventTypeFilter) return false;
      if (instrumentTypeFilter !== "all" && event.instrumentType !== instrumentTypeFilter) return false;
      if (sourceFilter !== "all") {
        if (sourceFilter === "external" && !event.source.includes("external")) return false;
        if (sourceFilter === "internal" && event.source.includes("external")) return false;
        if (sourceFilter !== "external" && sourceFilter !== "internal" && !event.source.includes(sourceFilter)) return false;
      }
      return true;
    });
  }, [eventsData?.events, eventTypeFilter, instrumentTypeFilter, sourceFilter]);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-6">
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : statsData?.stats && (
        <StatsCards stats={statsData.stats} />
      )}

      {!highlightedLoading && highlightedData?.events && highlightedData.events.length > 0 && (
        <HighlightedEventsCard events={highlightedData.events} />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Bond Financial Calendar</CardTitle>
                <CardDescription>Track upcoming issuances, auctions, maturities, and coupon payments</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => syncExternalMutation.mutate()}
                disabled={syncExternalMutation.isPending}
                data-testid="button-sync-external"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${syncExternalMutation.isPending ? "animate-spin" : ""}`} />
                {syncExternalMutation.isPending ? "Syncing..." : "Sync External"}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export-calendar">
                    <Download className="h-4 w-4 mr-1.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportIcal} data-testid="menu-export-ical">
                    <Download className="h-4 w-4 mr-2" />
                    Download iCal (.ics)
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/bond-calendar/export/ical`);
                      toast({
                        title: "Calendar URL Copied",
                        description: "Subscribe to this URL in your calendar app for live updates",
                      });
                    }}
                    data-testid="menu-copy-subscription"
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Copy Subscription URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex items-center gap-1 border-l pl-2 ml-1">
                <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(currentDate, "MMMM yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-event-type">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="auction">Auctions</SelectItem>
                <SelectItem value="issuance">New Issues</SelectItem>
                <SelectItem value="ipo_open">IPO Opens</SelectItem>
                <SelectItem value="maturity">Maturities</SelectItem>
                <SelectItem value="coupon_payment">Coupon Payments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={instrumentTypeFilter} onValueChange={setInstrumentTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-instrument-type">
                <SelectValue placeholder="Instrument Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instruments</SelectItem>
                <SelectItem value="gsec">G-Sec</SelectItem>
                <SelectItem value="tbill">T-Bill</SelectItem>
                <SelectItem value="sdl">SDL</SelectItem>
                <SelectItem value="sgb">SGB</SelectItem>
                <SelectItem value="ncd">NCD</SelectItem>
                <SelectItem value="corporate_bond">Corporate Bond</SelectItem>
                <SelectItem value="infrastructure_bond">Infrastructure Bond</SelectItem>
                <SelectItem value="capital_gains_bond">54EC Capital Gains</SelectItem>
                <SelectItem value="tax_free_bond">Tax-Free Bond</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-source">
                <SelectValue placeholder="Data Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="external">External Only</SelectItem>
                <SelectItem value="internal">Internal Only</SelectItem>
                <SelectItem value="rbi">RBI</SelectItem>
                <SelectItem value="sebi">SEBI</SelectItem>
                <SelectItem value="nse">NSE</SelectItem>
                <SelectItem value="bse">BSE</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={view} onValueChange={(v) => setView(v as "calendar" | "list")} className="ml-auto">
              <TabsList>
                <TabsTrigger value="list" data-testid="tab-list-view">List</TabsTrigger>
                <TabsTrigger value="calendar" data-testid="tab-calendar-view">Calendar</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {eventsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : view === "calendar" ? (
            <CalendarGrid currentDate={currentDate} events={filteredEvents} />
          ) : (
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No events found for this period</p>
                  <p className="text-sm">Try adjusting your filters or selecting a different month</p>
                </div>
              ) : (
                filteredEvents.map(event => (
                  <EventDetailDialog key={event.id} event={event}>
                    <div>
                      <EventCard event={event} />
                    </div>
                  </EventDetailDialog>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function BondCalendarWidget() {
  const { data, isLoading } = useQuery<{ success: boolean; events: BondCalendarEvent[] }>({
    queryKey: ["/api/bond-calendar/events/highlighted"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  const events = data?.events || [];
  if (events.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Bond Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.slice(0, 3).map(event => {
          const config = eventTypeConfig[event.eventType] || { label: event.eventType, icon: Calendar, color: "text-muted-foreground", bgColor: "bg-muted" };
          const Icon = config.icon;
          
          return (
            <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className={`p-1.5 rounded ${config.bgColor}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.eventTitle}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(event.eventDate), "MMM d, yyyy")}</p>
              </div>
              {event.isHighlighted && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
