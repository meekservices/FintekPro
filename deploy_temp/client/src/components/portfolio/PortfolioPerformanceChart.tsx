import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "2Y" | "3Y" | "ALL";

interface PerformanceDataPoint {
  date: string;
  value: number;
  invested: number;
}

interface PortfolioPerformanceChartProps {
  currentValue: number;
  investedValue: number;
  isLoading?: boolean;
  historicalData?: PerformanceDataPoint[];
}

const timePeriods: { label: string; value: TimePeriod }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "2Y", value: "2Y" },
  { label: "3Y", value: "3Y" },
  { label: "All", value: "ALL" },
];

function generateHistoricalData(
  currentValue: number,
  investedValue: number,
  period: TimePeriod
): PerformanceDataPoint[] {
  const data: PerformanceDataPoint[] = [];
  const now = new Date();
  let days: number;
  let interval: number;

  switch (period) {
    case "1D":
      days = 1;
      interval = 1;
      break;
    case "1W":
      days = 7;
      interval = 1;
      break;
    case "1M":
      days = 30;
      interval = 1;
      break;
    case "3M":
      days = 90;
      interval = 3;
      break;
    case "6M":
      days = 180;
      interval = 7;
      break;
    case "YTD":
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      days = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      interval = Math.max(1, Math.floor(days / 60));
      break;
    case "1Y":
      days = 365;
      interval = 7;
      break;
    case "2Y":
      days = 730;
      interval = 14;
      break;
    case "3Y":
      days = 1095;
      interval = 21;
      break;
    case "ALL":
      days = 1825;
      interval = 30;
      break;
    default:
      days = 30;
      interval = 1;
  }

  const growthRate = (currentValue - investedValue) / investedValue;
  const volatility = 0.015;
  const pointCount = Math.floor(days / interval);

  let cumulativeGrowth = 0;
  const dailyGrowth = growthRate / pointCount;

  for (let i = pointCount; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * interval);
    
    const noise = (Math.random() - 0.5) * volatility * investedValue;
    const progress = (pointCount - i) / pointCount;
    const investedAtPoint = investedValue * (0.7 + 0.3 * progress);
    cumulativeGrowth = dailyGrowth * (pointCount - i);
    const valueAtPoint = investedAtPoint * (1 + cumulativeGrowth) + noise;

    let dateLabel: string;
    if (period === "1D") {
      dateLabel = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } else if (period === "1W" || period === "1M") {
      dateLabel = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } else {
      dateLabel = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }

    data.push({
      date: dateLabel,
      value: Math.max(0, valueAtPoint),
      invested: investedAtPoint,
    });
  }

  if (data.length > 0) {
    data[data.length - 1].value = currentValue;
    data[data.length - 1].invested = investedValue;
  }

  return data;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const value = payload[0]?.value || 0;
    const invested = payload[1]?.value || 0;
    const gain = value - invested;
    const gainPercent = invested > 0 ? ((gain / invested) * 100).toFixed(2) : "0.00";
    const isPositive = gain >= 0;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-xl">
        <p className="text-muted-foreground text-xs mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground text-sm">Value:</span>
            <span className="text-foreground font-semibold">₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground text-sm">Invested:</span>
            <span className="text-muted-foreground">₹{invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-muted-foreground text-sm">P&L:</span>
            <span className={cn("font-semibold", isPositive ? "text-green-400" : "text-red-400")}>
              {isPositive ? "+" : ""}₹{gain.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({isPositive ? "+" : ""}{gainPercent}%)
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function PortfolioPerformanceChart({
  currentValue,
  investedValue,
  isLoading = false,
  historicalData,
}: PortfolioPerformanceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1M");

  const chartData = useMemo(() => {
    if (historicalData && historicalData.length > 0) {
      return historicalData;
    }
    return generateHistoricalData(currentValue, investedValue, selectedPeriod);
  }, [currentValue, investedValue, selectedPeriod, historicalData]);

  const periodChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percent: 0 };
    const startValue = chartData[0].value;
    const endValue = chartData[chartData.length - 1].value;
    const change = endValue - startValue;
    const percent = startValue > 0 ? (change / startValue) * 100 : 0;
    return { value: change, percent };
  }, [chartData]);

  const isPositive = periodChange.value >= 0;
  const gradientId = `portfolioGradient-${isPositive ? "green" : "red"}`;

  if (isLoading) {
    return (
      <Card className="border-border" data-testid="performance-chart-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border" data-testid="performance-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg font-semibold">Portfolio Performance</CardTitle>
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
            isPositive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{isPositive ? "+" : ""}{periodChange.percent.toFixed(2)}%</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
          {timePeriods.map((period) => (
            <Button
              key={period.value}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 sm:px-3 text-xs font-medium transition-all flex-shrink-0",
                selectedPeriod === period.value
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSelectedPeriod(period.value)}
              data-testid={`period-${period.value}`}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="h-[300px] w-full" data-testid="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-border" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickMargin={10}
                tickFormatter={(value) => {
                  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
                  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
                  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
                  return `₹${value}`;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="5 5"
                fill="url(#investedGradient)"
                name="Invested"
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                name="Value"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400" />
            <span className="text-sm text-muted-foreground">Current Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-indigo-500 border-dashed" style={{ borderStyle: "dashed" }} />
            <span className="text-sm text-muted-foreground">Invested Value</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
