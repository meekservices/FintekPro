import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
  Legend,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown, PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetClass {
  name: string;
  value: number;
  percentage: number;
  color: string;
  change?: number;
  changePercent?: number;
}

interface AssetAllocationChartProps {
  assets: AssetClass[];
  totalValue: number;
  isLoading?: boolean;
}

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
];

const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
    percent,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        className="drop-shadow-lg"
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius - 2}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 15}
        textAnchor="middle"
        className="fill-slate-900 dark:fill-white text-sm font-semibold"
      >
        {payload.name}
      </text>
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        className="fill-muted-foreground text-xs"
      >
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </text>
      <text
        x={cx}
        y={cy + 25}
        textAnchor="middle"
        className="fill-muted-foreground text-xs"
      >
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = (data.changePercent || 0) >= 0;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-semibold text-foreground">
            {data.name}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground text-sm">Value:</span>
            <span className="font-semibold text-foreground">
              ₹{data.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground text-sm">Allocation:</span>
            <span className="text-muted-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
          {data.changePercent !== undefined && (
            <div className="flex justify-between gap-4 pt-1 border-t border-border">
              <span className="text-muted-foreground text-sm">Returns:</span>
              <span
                className={cn(
                  "font-semibold",
                  isPositive ? "text-green-600" : "text-red-600"
                )}
              >
                {isPositive ? "+" : ""}{data.changePercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function AssetAllocationChart({
  assets,
  totalValue,
  isLoading = false,
}: AssetAllocationChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const chartData = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    return assets.map((asset, index) => ({
      ...asset,
      color: asset.color || COLORS[index % COLORS.length],
    }));
  }, [assets]);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  if (isLoading) {
    return (
      <Card className="border-border" data-testid="asset-allocation-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <Skeleton className="h-[250px] w-[250px] rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <Card className="border-border" data-testid="asset-allocation-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            Asset Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <PieChartIcon className="h-12 w-12 mb-4 text-muted-foreground" />
            <p>No asset allocation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border" data-testid="asset-allocation-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            Asset Allocation
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {assets.length} Asset Classes
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[280px] w-full" data-testid="donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="outline-none cursor-pointer transition-all duration-200 hover:opacity-80"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto" data-testid="asset-list">
            {chartData.map((asset, index) => {
              const isPositive = (asset.changePercent || 0) >= 0;
              return (
                <div
                  key={asset.name}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer",
                    activeIndex === index
                      ? "bg-muted"
                      : "hover:bg-muted dark:hover:bg-card/50"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  data-testid={`asset-item-${asset.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: asset.color }}
                    />
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {asset.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asset.percentage.toFixed(1)}% of portfolio
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground text-sm">
                      ₹{asset.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    {asset.changePercent !== undefined && (
                      <div
                        className={cn(
                          "flex items-center justify-end gap-1 text-xs",
                          isPositive ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>
                          {isPositive ? "+" : ""}{asset.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
            <span className="text-lg font-bold text-foreground">
              ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
