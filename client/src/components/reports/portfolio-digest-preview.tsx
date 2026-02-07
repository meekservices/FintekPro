import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUp, 
  ArrowDown,
  Calendar,
  PieChart,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface PortfolioDigestPreviewProps {
  userName?: string;
  period?: 'weekly' | 'monthly';
}

export function PortfolioDigestPreview({ userName = 'Investor', period = 'weekly' }: PortfolioDigestPreviewProps) {
  const mockData = {
    portfolioValue: 1245000,
    change: 32500,
    changePercent: 2.68,
    topGainers: [
      { symbol: 'INFY', change: 8.5 },
      { symbol: 'HDFCBANK', change: 5.2 },
      { symbol: 'TCS', change: 3.8 }
    ],
    topLosers: [
      { symbol: 'TATAMOTORS', change: -4.2 },
      { symbol: 'TATASTEEL', change: -2.1 }
    ],
    dividendsReceived: 3500,
    sipExecuted: 25000,
    alerts: [
      'RELIANCE has reached your target price',
      'Large Cap allocation drifted 6% from target'
    ],
    nextSipDate: 'Jan 5, 2025'
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card className="max-w-2xl mx-auto border-2" data-testid="portfolio-digest-preview">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground p-6 rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100">Your {period === 'weekly' ? 'Weekly' : 'Monthly'} Portfolio Digest</p>
            <h2 className="text-2xl font-bold">Hello, {userName}!</h2>
          </div>
          <Badge variant="secondary" className="bg-card/20 text-foreground border-0">
            <Calendar className="h-3 w-3 mr-1" />
            Dec 26, 2024
          </Badge>
        </div>
      </div>

      <CardContent className="pt-6 space-y-6">
        <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Portfolio Value</p>
          <p className="text-4xl font-bold">{formatCurrency(mockData.portfolioValue)}</p>
          <div className={`flex items-center justify-center gap-2 mt-2 ${mockData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {mockData.change >= 0 ? (
              <ArrowUp className="h-5 w-5" />
            ) : (
              <ArrowDown className="h-5 w-5" />
            )}
            <span className="font-semibold">
              {mockData.change >= 0 ? '+' : ''}{formatCurrency(mockData.change)} ({mockData.changePercent}%)
            </span>
            <span className="text-muted-foreground">this {period}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Top Gainers</h3>
            </div>
            <div className="space-y-2">
              {mockData.topGainers.map((stock, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{stock.symbol}</span>
                  <span className="text-green-600 font-medium">+{stock.change}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold">Top Losers</h3>
            </div>
            <div className="space-y-2">
              {mockData.topLosers.map((stock, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{stock.symbol}</span>
                  <span className="text-red-600 font-medium">{stock.change}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Dividends Received</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(mockData.dividendsReceived)}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">SIP Executed</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(mockData.sipExecuted)}</p>
          </div>
        </div>

        {mockData.alerts.length > 0 && (
          <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800 dark:text-orange-200">Action Required</h3>
            </div>
            <ul className="space-y-2">
              {mockData.alerts.map((alert, idx) => (
                <li key={idx} className="text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2">
                  <span>•</span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Next SIP: {mockData.nextSipDate}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">Ensure sufficient balance in your account</p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          <p>This is a preview of your {period} portfolio digest.</p>
          <p className="mt-1">
            Manage your preferences in{' '}
            <a href="/notification-preferences" className="text-blue-600 hover:underline">
              Notification Settings
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
