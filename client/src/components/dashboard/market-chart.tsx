import { useStockCandles, type CandleData } from "@/hooks/use-market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

interface ProcessedCandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface MarketStats {
  open: number;
  high: number;
  low: number;
  volume?: number;
  change: number;
  changePercent: number;
}

interface MarketChartProps {
  symbol?: string;
}

export function MarketChart({ symbol = "^NSEI" }: MarketChartProps) {
  const [timeframe, setTimeframe] = useState("1D");
  const [chartData, setChartData] = useState<ProcessedCandleData[]>([]);
  
  const { data: candles, isLoading, error } = useStockCandles(symbol, "D");

  useEffect(() => {
    if (candles && candles.s === 'ok') {
      // Process candle data for chart
      const processedData = candles.t.map((timestamp: number, index: number) => ({
        time: new Date(timestamp * 1000).toLocaleDateString(),
        open: candles.o[index],
        high: candles.h[index],
        low: candles.l[index],
        close: candles.c[index],
        volume: candles.v?.[index]
      }));
      setChartData(processedData);
    }
  }, [candles]);

  const timeframes = [
    { label: "1D", value: "1D" },
    { label: "1W", value: "1W" },
    { label: "1M", value: "1M" },
    { label: "1Y", value: "1Y" },
  ];

  const getMarketStats = (): MarketStats | null => {
    if (!chartData || chartData.length === 0) return null;
    
    const latest = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    
    return {
      open: latest.open,
      high: Math.max(...chartData.slice(-1).map((d: any) => d.high)),
      low: Math.min(...chartData.slice(-1).map((d: any) => d.low)),
      volume: latest.volume,
      change: latest.close - (previous?.close || latest.close),
      changePercent: previous ? ((latest.close - previous.close) / previous.close) * 100 : 0
    };
  };

  const stats = getMarketStats();

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <div className="flex space-x-2">
              {timeframes.map((tf) => (
                <Skeleton key={tf.value} className="h-8 w-12" />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full mb-6" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-4 w-12 mx-auto mb-2" />
                <Skeleton className="h-6 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="lg:col-span-2">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center" data-testid="chart-error">
            <p className="text-red-500 mb-2">Error loading market data</p>
            <p className="text-muted-foreground text-sm">Please check your connection and try again</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2" data-testid="market-chart">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-bold text-foreground" data-testid="chart-title">
            Market Overview
          </CardTitle>
          <div className="flex space-x-2">
            {timeframes.map((tf) => (
              <Button
                key={tf.value}
                variant={timeframe === tf.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf.value)}
                data-testid={`timeframe-${tf.value}`}
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart Container - Using placeholder for now */}
        <div className="h-80 bg-muted rounded-lg flex items-center justify-center mb-6" data-testid="chart-container">
          {chartData ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Market Chart</p>
              <p className="text-2xl font-bold text-finance-blue">
                {symbol} - {(chartData[chartData.length - 1]?.close ?? 0).toFixed(2)}
              </p>
              <p className={`text-sm ${(stats?.change ?? 0) >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                {(stats?.change ?? 0) >= 0 ? '+' : ''}{(stats?.change ?? 0).toFixed(2)} ({(stats?.changePercent ?? 0).toFixed(2)}%)
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No chart data available</p>
          )}
        </div>

        {/* Market Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4" data-testid="market-stats">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="font-bold text-foreground" data-testid="stat-open">
                {stats.open?.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">High</p>
              <p className="font-bold text-finance-green" data-testid="stat-high">
                {stats.high?.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Low</p>
              <p className="font-bold text-finance-red" data-testid="stat-low">
                {stats.low?.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Volume</p>
              <p className="font-bold text-foreground" data-testid="stat-volume">
                {stats.volume ? (stats.volume / 1000000).toFixed(2) + 'M' : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
