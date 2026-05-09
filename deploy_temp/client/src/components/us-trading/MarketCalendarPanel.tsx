/**
 * Market Calendar Panel
 * Shows upcoming NYSE trading days, early closes, and market holidays.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, RefreshCw, CheckCircle2, Clock } from "lucide-react";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MarketCalendarPanel() {
  const today = new Date();
  const in60 = new Date(today);
  in60.setDate(today.getDate() + 60);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; calendar: any[] }>({
    queryKey: ["/api/us-trading/broker/calendar"],
    queryFn: () =>
      fetch(`/api/us-trading/broker/calendar?start=${toISO(today)}&end=${toISO(in60)}`).then(r => r.json()),
    staleTime: 3_600_000, // 1 hour
  });

  const calendar = data?.calendar ?? [];

  // Find any early-close days (where close < 16:00)
  function isEarlyClose(day: any) {
    const close = day.close || day.session_close;
    return close && close < "16:00";
  }

  function dayType(day: any) {
    if (isEarlyClose(day)) return "early_close";
    return "normal";
  }

  function fmtDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  if (isLoading) {
    return <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">NYSE Market Calendar — Next 60 Days</h3>
          <p className="text-xs text-muted-foreground">All times Eastern (ET). India is 9.5–10.5 hrs ahead.</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* India-time reference */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
        <CardContent className="py-3 px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: "Pre-Market opens", et: "4:00 AM ET", ist: "2:30 PM IST / 1:30 PM IST (DST)" },
              { label: "Regular session opens", et: "9:30 AM ET", ist: "8:00 PM IST / 7:00 PM IST (DST)" },
              { label: "Regular session closes", et: "4:00 PM ET", ist: "2:30 AM IST / 1:30 AM IST (DST)" },
              { label: "After-hours closes", et: "8:00 PM ET", ist: "6:30 AM IST / 5:30 AM IST (DST)" },
            ].map(({ label, et, ist }) => (
              <div key={label}>
                <div className="font-medium text-foreground">{label}</div>
                <div className="text-muted-foreground">{et}</div>
                <div className="text-blue-600 dark:text-blue-400">{ist}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {calendar.slice(0, 30).map((day: any) => {
          const type = dayType(day);
          const dateStr = day.date;
          const isToday = dateStr === toISO(today);
          return (
            <div
              key={dateStr}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                isToday ? "border-primary bg-primary/5" :
                type === "early_close" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" :
                "border-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                {isToday ? (
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                ) : type === "early_close" ? (
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
                <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{fmtDate(dateStr)}</span>
              </div>
              <div className="flex items-center gap-1">
                {isToday && <Badge className="text-xs px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Today</Badge>}
                {type === "early_close" && (
                  <Badge className="text-xs px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300">
                    Early Close {day.close || day.session_close}
                  </Badge>
                )}
                {type === "normal" && (
                  <span className="text-muted-foreground">
                    {(day.open || day.session_open) ? `${day.open || day.session_open} – ${day.close || day.session_close}` : "Open"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {calendar.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No calendar data. Alpaca Broker API credentials may not be configured.
        </div>
      )}
    </div>
  );
}
