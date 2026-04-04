/**
 * Real-time Alpaca Event Feed
 * Connects to the /api/us-trading/events/stream SSE endpoint and displays
 * live trade fills, account status changes, journal completions, and transfer updates.
 */
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Wifi, WifiOff, Trash2, Circle } from "lucide-react";

interface LiveEvent {
  id: string;
  type: string;
  event: string;
  data: any;
  receivedAt: string;
}

interface AlpacaEventFeedProps {
  alpacaAccountId?: string;
  maxEvents?: number;
}

const EVENT_COLORS: Record<string, string> = {
  fill: "text-green-600",
  partial_fill: "text-green-500",
  canceled: "text-red-500",
  rejected: "text-red-600",
  new: "text-blue-500",
  pending_new: "text-blue-400",
  account_updates: "text-purple-600",
  journal_updates: "text-amber-600",
  transfer_updates: "text-cyan-600",
};

export default function AlpacaEventFeed({ alpacaAccountId, maxEvents = 100 }: AlpacaEventFeedProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = alpacaAccountId
      ? `/api/us-trading/events/stream?account_id=${alpacaAccountId}`
      : "/api/us-trading/events/stream";

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
      setError(null);
    });

    const eventTypes = ["trade_updates", "account_updates", "journal_updates", "transfer_updates",
      "fill", "partial_fill", "canceled", "rejected", "new", "pending_new"];

    eventTypes.forEach(type => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const event: LiveEvent = {
            id: crypto.randomUUID(),
            type,
            event: data.event || type,
            data,
            receivedAt: new Date().toISOString(),
          };
          setEvents(prev => [event, ...prev].slice(0, maxEvents));
        } catch {
          // ignore parse errors
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost — reconnecting…");
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [alpacaAccountId]);

  function formatData(data: any): string {
    if (!data) return "";
    const { event, symbol, side, qty, notional, order_status, price, amount, status, ...rest } = data;
    const parts = [
      symbol && `${symbol}`,
      side && `${side.toUpperCase()}`,
      qty && `${qty} shares`,
      notional && `$${parseFloat(notional).toFixed(2)}`,
      price && `@ $${parseFloat(price).toFixed(2)}`,
      order_status && `[${order_status}]`,
      amount && `$${parseFloat(amount).toFixed(2)}`,
      status && !order_status && `[${status}]`,
    ].filter(Boolean);
    return parts.join(" ");
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Live Event Feed
            <span className="flex items-center gap-1 ml-1">
              {connected ? (
                <><Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
                  <span className="text-xs text-green-600 font-normal">Connected</span></>
              ) : (
                <><Circle className="h-2 w-2 fill-red-500 text-red-500" />
                  <span className="text-xs text-red-500 font-normal">Disconnected</span></>
              )}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{events.length} events</Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEvents([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-2 px-2">
            <WifiOff className="h-3.5 w-3.5" /> {error}
          </div>
        )}
        <ScrollArea className="h-72" ref={scrollRef as any}>
          {events.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Wifi className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              Waiting for events…
              <br />
              <span className="text-xs">Place an order or change account status to see live events here.</span>
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 py-1.5 border-b border-muted/40 last:border-0">
                  <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">{fmtTime(ev.receivedAt)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-xs px-1.5 py-0 ${EVENT_COLORS[ev.event] || "text-foreground"}`}>
                        {ev.event}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ev.type}</span>
                    </div>
                    {formatData(ev.data) && (
                      <div className="text-xs mt-0.5 font-medium truncate">{formatData(ev.data)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
