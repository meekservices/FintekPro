import { memo, useId } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartDataPoint {
  [key: string]: string | number;
}

interface MemoizedAreaChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  gradient?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
}

export const MemoizedAreaChart = memo(function MemoizedAreaChart({
  data,
  dataKey,
  xAxisKey = "name",
  height = 300,
  color = "hsl(var(--primary))",
  gradient = true,
  showGrid = true,
  showTooltip = true,
  showXAxis = true,
  showYAxis = true,
}: MemoizedAreaChartProps) {
  const id = useId();
  const gradientId = `gradient-${dataKey}-${id}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        {showXAxis && <XAxis dataKey={xAxisKey} className="text-xs" />}
        {showYAxis && <YAxis className="text-xs" />}
        {showTooltip && <Tooltip />}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={gradient ? `url(#${gradientId})` : color}
          fillOpacity={gradient ? 1 : 0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

interface MemoizedBarChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showLegend?: boolean;
}

export const MemoizedBarChart = memo(function MemoizedBarChart({
  data,
  dataKey,
  xAxisKey = "name",
  height = 300,
  color = "hsl(var(--primary))",
  showGrid = true,
  showTooltip = true,
  showXAxis = true,
  showYAxis = true,
  showLegend = false,
}: MemoizedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        {showXAxis && <XAxis dataKey={xAxisKey} className="text-xs" />}
        {showYAxis && <YAxis className="text-xs" />}
        {showTooltip && <Tooltip />}
        {showLegend && <Legend />}
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

interface MemoizedLineChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  xAxisKey?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showDots?: boolean;
}

export const MemoizedLineChart = memo(function MemoizedLineChart({
  data,
  dataKey,
  xAxisKey = "name",
  height = 300,
  color = "hsl(var(--primary))",
  showGrid = true,
  showTooltip = true,
  showXAxis = true,
  showYAxis = true,
  showDots = true,
}: MemoizedLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        {showXAxis && <XAxis dataKey={xAxisKey} className="text-xs" />}
        {showYAxis && <YAxis className="text-xs" />}
        {showTooltip && <Tooltip />}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={showDots}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

interface PieDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface MemoizedPieChartProps {
  data: PieDataPoint[];
  height?: number;
  colors?: string[];
  showTooltip?: boolean;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const MemoizedPieChart = memo(function MemoizedPieChart({
  data,
  height = 300,
  colors = DEFAULT_COLORS,
  showTooltip = true,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
}: MemoizedPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        {showTooltip && <Tooltip />}
        {showLegend && <Legend />}
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || colors[index % colors.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
});

interface MultiLineChartProps {
  data: ChartDataPoint[];
  lines: Array<{
    dataKey: string;
    color: string;
    name?: string;
  }>;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showLegend?: boolean;
}

export const MemoizedMultiLineChart = memo(function MemoizedMultiLineChart({
  data,
  lines,
  xAxisKey = "name",
  height = 300,
  showGrid = true,
  showTooltip = true,
  showXAxis = true,
  showYAxis = true,
  showLegend = true,
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        {showXAxis && <XAxis dataKey={xAxisKey} className="text-xs" />}
        {showYAxis && <YAxis className="text-xs" />}
        {showTooltip && <Tooltip />}
        {showLegend && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.color}
            name={line.name || line.dataKey}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
});
