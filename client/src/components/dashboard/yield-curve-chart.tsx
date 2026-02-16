import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, Info, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface YieldDataPoint {
  maturity: string;
  maturityYears: number;
  currentYield: number;
  historicalYield: number;
  change: number;
  benchmark: string;
}

interface YieldCurveData {
  currentDate: string;
  historicalDate: string;
  data: YieldDataPoint[];
  summary: {
    shortTermAvg: number;
    longTermAvg: number;
    spread: number;
    curveShape: 'normal' | 'inverted' | 'flat';
  };
}

const defaultYieldCurveData: YieldCurveData = {
  currentDate: new Date().toISOString().split('T')[0],
  historicalDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  data: [],
  summary: {
    shortTermAvg: 0,
    longTermAvg: 0,
    spread: 0,
    curveShape: 'normal'
  }
};

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export function YieldCurveChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [showHistorical, setShowHistorical] = useState(true);

  const { data: yieldData, isLoading } = useQuery<YieldCurveData>({
    queryKey: ['/api/bonds/yield-curve/public', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/bonds/yield-curve/public?timeRange=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch yield curve data');
      return res.json();
    },
    staleTime: 60000,
  });

  const chartData = yieldData || defaultYieldCurveData;

  const curveShapeColor = useMemo(() => {
    switch (chartData.summary.curveShape) {
      case 'normal': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'inverted': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'flat': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  }, [chartData.summary.curveShape]);

  const curveShapeLabel = useMemo(() => {
    switch (chartData.summary.curveShape) {
      case 'normal': return 'Normal Curve';
      case 'inverted': return 'Inverted Curve';
      case 'flat': return 'Flat Curve';
      default: return 'Unknown';
    }
  }, [chartData.summary.curveShape]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card p-4 rounded-lg shadow-lg border border-border">
          <p className="font-semibold text-foreground mb-2">
            {data.benchmark}
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Current Yield:</span>
              <span className="font-medium text-blue-600">{data.currentYield.toFixed(2)}%</span>
            </div>
            {showHistorical && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Historical:</span>
                <span className="font-medium text-muted-foreground">{data.historicalYield.toFixed(2)}%</span>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-1 border-t border-border">
              <span className="text-muted-foreground">Change:</span>
              <span className={`font-medium flex items-center gap-1 ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="yield-curve-chart">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Government Securities Yield Curve
            </CardTitle>
            <CardDescription className="mt-1">
              Compare current yields against historical data across maturities
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={curveShapeColor}>
              {curveShapeLabel}
            </Badge>
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20">
              Spread: {chartData.summary.spread.toFixed(2)}%
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-sm text-muted-foreground">Historical Period:</span>
          {(['1W', '1M', '3M', '6M', '1Y'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
              data-testid={`yield-range-${range}`}
            >
              {range}
            </Button>
          ))}
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistorical(!showHistorical)}
              className={showHistorical ? 'text-blue-600' : 'text-muted-foreground'}
              data-testid="yield-toggle-historical"
            >
              <Calendar className="h-4 w-4 mr-1" />
              {showHistorical ? 'Hide' : 'Show'} Historical
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData.data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="currentYieldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="historicalYieldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="maturity" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis 
                domain={['dataMin - 0.3', 'dataMax + 0.3']}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {showHistorical && (
                <Area
                  type="monotone"
                  dataKey="historicalYield"
                  name={`Historical (${chartData.historicalDate})`}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="url(#historicalYieldGradient)"
                  dot={{ r: 3, fill: '#9ca3af' }}
                  activeDot={{ r: 5, fill: '#9ca3af' }}
                />
              )}
              
              <Area
                type="monotone"
                dataKey="currentYield"
                name={`Current (${chartData.currentDate})`}
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#currentYieldGradient)"
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
              />
              
              <ReferenceLine 
                y={7} 
                stroke="#22c55e" 
                strokeDasharray="3 3"
                label={{ value: "RBI Repo Rate 7%", position: "right", fontSize: 11, fill: '#22c55e' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Short-Term Avg</p>
            <p className="text-xl font-bold text-foreground">
              {chartData.summary.shortTermAvg.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">91D - 1Y</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Long-Term Avg</p>
            <p className="text-xl font-bold text-foreground">
              {chartData.summary.longTermAvg.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">10Y - 30Y</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Yield Spread</p>
            <p className="text-xl font-bold text-green-600">
              +{chartData.summary.spread.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">30Y vs 91D</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">10Y Benchmark</p>
            <p className="text-xl font-bold text-blue-600">
              {chartData.data.find(d => d.maturity === '10Y')?.currentYield.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">G-Sec 10Y</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Yield Curve Analysis:</strong> A {chartData.summary.curveShape} yield curve indicates 
              {chartData.summary.curveShape === 'normal' && ' healthy economic conditions with higher returns for longer-term investments.'}
              {chartData.summary.curveShape === 'inverted' && ' potential economic slowdown with short-term yields exceeding long-term yields.'}
              {chartData.summary.curveShape === 'flat' && ' economic uncertainty with similar yields across maturities.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
