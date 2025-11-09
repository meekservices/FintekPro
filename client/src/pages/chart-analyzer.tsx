import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Download, Save, FolderOpen, Plus, X, Calendar, BarChart3, LineChart as LineChartIcon, Activity } from "lucide-react";
import { format, subMonths, subYears } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type DateRange = {
  startDate: string;
  endDate: string;
};

type AssetSymbol = {
  symbol: string;
  name: string;
  color: string;
};

type ChartDataPoint = {
  date: string;
  [key: string]: number | string;
};

type ChartConfiguration = {
  id: string;
  name: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  chartType?: string;
};

type SavedConfigsResponse = {
  configurations: ChartConfiguration[];
  count: number;
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DATE_PRESETS = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', years: 1 },
  { label: '3Y', years: 3 },
  { label: '5Y', years: 5 },
];

export default function ChartAnalyzer() {
  const { toast } = useToast();
  const [selectedAssets, setSelectedAssets] = useState<AssetSymbol[]>([]);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: format(subYears(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [configName, setConfigName] = useState('');

  // Fetch chart data for comparison using POST
  const { data: chartData, isLoading: isLoadingChart, error: chartError } = useQuery({
    queryKey: ['/api/charts/compare', selectedAssets.map(a => a.symbol), dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/charts/compare', {
        body: {
          symbols: selectedAssets.map(a => a.symbol),
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          rangeType: 'custom',
        },
      });
      return response;
    },
    enabled: selectedAssets.length > 0,
  });

  // Fetch saved configurations
  const { data: savedConfigs } = useQuery({
    queryKey: ['/api/charts/configurations'],
    select: (data) => data as SavedConfigsResponse,
  });

  // Fetch performance metrics using POST
  const { data: performanceMetrics, isLoading: isLoadingMetrics, error: metricsError } = useQuery({
    queryKey: ['/api/charts/performance', selectedAssets.map(a => a.symbol), dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/charts/performance', {
        body: {
          symbols: selectedAssets.map(a => a.symbol),
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          rangeType: 'custom',
        },
      });
      return response;
    },
    enabled: selectedAssets.length > 0,
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (name: string) => {
      const payload = {
        name,
        symbols: selectedAssets.map(a => a.symbol),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        chartType,
      };
      return apiRequest('POST', '/api/charts/configurations', {
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/charts/configurations'] });
      toast({
        title: "Configuration saved",
        description: "Your chart configuration has been saved successfully.",
      });
      setShowSaveDialog(false);
      setConfigName('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save chart configuration.",
        variant: "destructive",
      });
    },
  });

  const addAsset = () => {
    if (!searchSymbol.trim()) return;
    
    const symbol = searchSymbol.toUpperCase().trim();
    
    if (selectedAssets.some(a => a.symbol === symbol)) {
      toast({
        title: "Duplicate asset",
        description: "This asset is already added to the comparison.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAssets.length >= 5) {
      toast({
        title: "Limit reached",
        description: "You can compare up to 5 assets at a time.",
        variant: "destructive",
      });
      return;
    }

    const newAsset: AssetSymbol = {
      symbol,
      name: symbol,
      color: CHART_COLORS[selectedAssets.length],
    };

    setSelectedAssets([...selectedAssets, newAsset]);
    setSearchSymbol('');
  };

  const removeAsset = (symbol: string) => {
    setSelectedAssets(selectedAssets.filter(a => a.symbol !== symbol));
  };

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const endDate = new Date();
    let startDate: Date;

    if (preset.months) {
      startDate = subMonths(endDate, preset.months);
    } else if (preset.years) {
      startDate = subYears(endDate, preset.years);
    } else {
      startDate = endDate;
    }

    setDateRange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
  };

  const loadConfiguration = (config: any) => {
    const assets = config.symbols.map((symbol: string, index: number) => ({
      symbol,
      name: symbol,
      color: CHART_COLORS[index],
    }));
    
    setSelectedAssets(assets);
    setDateRange({
      startDate: config.startDate,
      endDate: config.endDate,
    });
    setChartType(config.chartType || 'line');
    
    toast({
      title: "Configuration loaded",
      description: `Loaded "${config.name}" successfully.`,
    });
  };

  const exportChart = () => {
    toast({
      title: "Export feature",
      description: "Chart export functionality will be available soon.",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interactive Chart Analyzer</h1>
          <p className="text-muted-foreground">
            Compare multiple assets with custom date ranges and advanced analytics
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-save-config">
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Chart Configuration</DialogTitle>
                <DialogDescription>
                  Give your chart configuration a name to save it for later use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="config-name">Configuration Name</Label>
                  <Input
                    id="config-name"
                    data-testid="input-config-name"
                    placeholder="e.g., Tech Stocks Comparison"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  data-testid="button-confirm-save"
                  onClick={() => saveConfigMutation.mutate(configName)}
                  disabled={!configName.trim() || saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={exportChart} data-testid="button-export-chart">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Asset Selection</CardTitle>
            <CardDescription>Add up to 5 assets to compare on the chart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter symbol (e.g., RELIANCE, TCS, INFY)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAsset()}
                data-testid="input-asset-search"
              />
              <Button onClick={addAsset} data-testid="button-add-asset">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
                  style={{ borderColor: asset.color }}
                  data-testid={`tag-asset-${asset.symbol}`}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: asset.color }}
                  />
                  <span className="text-sm font-medium">{asset.symbol}</span>
                  <button
                    onClick={() => removeAsset(asset.symbol)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                    data-testid={`button-remove-${asset.symbol}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
            <CardDescription>Select time period for analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyDatePreset(preset)}
                  data-testid={`button-preset-${preset.label}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Price Comparison Chart</CardTitle>
              <CardDescription>
                Normalized performance comparison across selected assets
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
                data-testid="button-chart-line"
              >
                <LineChartIcon className="h-4 w-4 mr-2" />
                Line
              </Button>
              <Button
                variant={chartType === 'area' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('area')}
                data-testid="button-chart-area"
              >
                <Activity className="h-4 w-4 mr-2" />
                Area
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assets selected</h3>
              <p className="text-muted-foreground max-w-sm">
                Add one or more assets using the search box above to start comparing their performance.
              </p>
            </div>
          ) : isLoadingChart ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          ) : chartData?.data && chartData.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                  <Legend />
                  {selectedAssets.map((asset) => (
                    <Line
                      key={asset.symbol}
                      type="monotone"
                      dataKey={asset.symbol}
                      stroke={asset.color}
                      strokeWidth={2}
                      dot={false}
                      name={asset.name}
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                  <Legend />
                  {selectedAssets.map((asset, index) => (
                    <Area
                      key={asset.symbol}
                      type="monotone"
                      dataKey={asset.symbol}
                      stroke={asset.color}
                      fill={asset.color}
                      fillOpacity={0.2}
                      name={asset.name}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No data available</h3>
              <p className="text-muted-foreground max-w-sm">
                Unable to fetch chart data for the selected assets and date range.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Detailed analysis of asset performance</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground text-sm">Calculating metrics...</p>
              </div>
            ) : performanceMetrics?.metrics ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Asset</th>
                      <th className="text-right py-3 px-4">Total Return</th>
                      <th className="text-right py-3 px-4">Annualized Return</th>
                      <th className="text-right py-3 px-4">Volatility</th>
                      <th className="text-right py-3 px-4">Sharpe Ratio</th>
                      <th className="text-right py-3 px-4">Max Drawdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(performanceMetrics.metrics).map(([symbol, metrics]: [string, any]) => (
                      <tr key={symbol} className="border-b" data-testid={`metrics-row-${symbol}`}>
                        <td className="py-3 px-4 font-medium">{symbol}</td>
                        <td className={`text-right py-3 px-4 ${metrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {metrics.totalReturn?.toFixed(2)}%
                        </td>
                        <td className={`text-right py-3 px-4 ${metrics.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {metrics.annualizedReturn?.toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-4">
                          {metrics.volatility?.toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-4">
                          {metrics.sharpeRatio?.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4 text-red-600">
                          {metrics.maxDrawdown?.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No metrics available
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {savedConfigs?.configurations && savedConfigs.configurations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Configurations</CardTitle>
            <CardDescription>Load your previously saved chart configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {savedConfigs.configurations.map((config: any) => (
                <Button
                  key={config.id}
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => loadConfiguration(config)}
                  data-testid={`button-load-config-${config.id}`}
                >
                  <div className="text-left">
                    <div className="font-medium">{config.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {config.symbols?.join(', ')}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
