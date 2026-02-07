import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  ArrowRight,
  RefreshCw,
  Zap,
  Target,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SIPSchedule {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: string;
  status: "upcoming" | "due_today" | "overdue";
}

interface DividendSchedule {
  id: string;
  stockName: string;
  symbol: string;
  amount: number;
  exDate: string;
  paymentDate: string;
  type: "dividend" | "bonus";
}

interface PortfolioAlert {
  id: string;
  type: "price_target" | "stop_loss" | "rebalance" | "news" | "dividend";
  title: string;
  message: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
  read: boolean;
}

interface QuickInsightsProps {
  upcomingSIPs?: SIPSchedule[];
  upcomingDividends?: DividendSchedule[];
  alerts?: PortfolioAlert[];
  isLoading?: boolean;
  onViewAll?: (section: string) => void;
}

const defaultSIPs: SIPSchedule[] = [
  {
    id: "1",
    name: "Axis Bluechip Fund",
    amount: 5000,
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    frequency: "Monthly",
    status: "upcoming",
  },
  {
    id: "2",
    name: "HDFC Mid-Cap Fund",
    amount: 3000,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    frequency: "Monthly",
    status: "upcoming",
  },
  {
    id: "3",
    name: "ICICI Pru Nifty 50",
    amount: 2500,
    dueDate: new Date().toISOString(),
    frequency: "Monthly",
    status: "due_today",
  },
];

const defaultDividends: DividendSchedule[] = [
  {
    id: "1",
    stockName: "Infosys Ltd",
    symbol: "INFY",
    amount: 18.5,
    exDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    paymentDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    type: "dividend",
  },
  {
    id: "2",
    stockName: "TCS",
    symbol: "TCS",
    amount: 22,
    exDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    paymentDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    type: "dividend",
  },
];

const defaultAlerts: PortfolioAlert[] = [
  {
    id: "1",
    type: "price_target",
    title: "Price Target Hit",
    message: "RELIANCE crossed your target of ₹2,900",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    priority: "high",
    read: false,
  },
  {
    id: "2",
    type: "rebalance",
    title: "Rebalancing Suggested",
    message: "Equity allocation drifted by 5%. Consider rebalancing.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    priority: "medium",
    read: false,
  },
  {
    id: "3",
    type: "dividend",
    title: "Dividend Credited",
    message: "₹1,850 dividend from HDFC Bank credited to your account",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    priority: "low",
    read: true,
  },
];

function getAlertIcon(type: PortfolioAlert["type"]) {
  switch (type) {
    case "price_target":
      return <Target className="h-4 w-4 text-green-500" />;
    case "stop_loss":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "rebalance":
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    case "news":
      return <Zap className="h-4 w-4 text-amber-500" />;
    case "dividend":
      return <Coins className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

function getPriorityColor(priority: PortfolioAlert["priority"]) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusColor(status: SIPSchedule["status"]) {
  switch (status) {
    case "due_today":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "upcoming":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function QuickInsights({
  upcomingSIPs = defaultSIPs,
  upcomingDividends = defaultDividends,
  alerts = defaultAlerts,
  isLoading = false,
  onViewAll,
}: QuickInsightsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="quick-insights-loading">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="quick-insights">
      <Card className="border-border" data-testid="upcoming-sips-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-blue-600" />
              Upcoming SIPs
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {upcomingSIPs.length} scheduled
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[180px] pr-2">
            <div className="space-y-3">
              {upcomingSIPs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <PiggyBank className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="text-sm">No upcoming SIPs</p>
                </div>
              ) : (
                upcomingSIPs.map((sip) => (
                  <div
                    key={sip.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`sip-item-${sip.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {sip.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(sip.dueDate), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground text-sm">
                        ₹{sip.amount.toLocaleString("en-IN")}
                      </p>
                      <Badge className={cn("text-xs mt-1", getStatusColor(sip.status))}>
                        {sip.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {upcomingSIPs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => onViewAll?.("sips")}
              data-testid="view-all-sips"
            >
              View All SIPs
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="upcoming-dividends-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-purple-600" />
              Upcoming Dividends
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {upcomingDividends.length} expected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[180px] pr-2">
            <div className="space-y-3">
              {upcomingDividends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Coins className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="text-sm">No upcoming dividends</p>
                </div>
              ) : (
                upcomingDividends.map((dividend) => (
                  <div
                    key={dividend.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`dividend-item-${dividend.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {dividend.stockName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {dividend.symbol}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Ex: {new Date(dividend.exDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-purple-600 text-sm">
                        ₹{dividend.amount}/share
                      </p>
                      <Badge className="text-xs mt-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {dividend.type}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {upcomingDividends.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              onClick={() => onViewAll?.("dividends")}
              data-testid="view-all-dividends"
            >
              View All Dividends
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="alerts-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-amber-600" />
              Alerts & Notifications
            </CardTitle>
            {alerts.filter((a) => !a.read).length > 0 && (
              <Badge className="bg-red-500 text-white text-xs">
                {alerts.filter((a) => !a.read).length} new
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[180px] pr-2">
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-green-400" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg",
                      alert.read
                        ? "bg-muted/30"
                        : "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30"
                    )}
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm truncate">
                          {alert.title}
                        </p>
                        {!alert.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge className={cn("text-xs shrink-0", getPriorityColor(alert.priority))}>
                      {alert.priority}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => onViewAll?.("alerts")}
              data-testid="view-all-alerts"
            >
              View All Alerts
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
