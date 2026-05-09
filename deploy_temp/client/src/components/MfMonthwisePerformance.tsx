import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MonthlyReturn {
  monthYear: string;
  navStart: number | null;
  navEnd: number | null;
  returnPercent: number | null;
  benchmarkReturn: number | null;
  excessReturn: number | null;
  isPartial: boolean;
}

interface MonthwisePerformanceProps {
  schemeCode: string;
  schemeName?: string;
  months?: number;
}

export function MfMonthwisePerformance({ schemeCode, schemeName, months = 24 }: MonthwisePerformanceProps) {
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    schemeCode: string;
    data: MonthlyReturn[];
    count: number;
  }>({
    queryKey: ["/api/mutual-funds", schemeCode, "monthwise-performance", months],
    queryFn: async () => {
      const response = await fetch(`/api/mutual-funds/${schemeCode}/monthwise-performance?months=${months}`);
      if (!response.ok) throw new Error("Failed to fetch monthwise performance");
      return response.json();
    },
    enabled: !!schemeCode,
    staleTime: 5 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/mutual-funds/${schemeCode}/monthwise-performance/refresh`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mutual-funds", schemeCode, "monthwise-performance", months] });
      toast({
        title: "Performance Data Refreshed",
        description: "Monthly returns have been recalculated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  const getReturnColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground";
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getReturnIcon = (value: number | null) => {
    if (value === null) return <Minus className="h-3 w-3" />;
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const formatReturn = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Unable to load monthly performance data.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const monthlyData = data?.data || [];

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Calculate
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No monthly performance data available yet. Click "Calculate" to generate performance data from historical NAV.
          </p>
        </CardContent>
      </Card>
    );
  }

  const positiveMonths = monthlyData.filter((m) => m.returnPercent !== null && m.returnPercent > 0).length;
  const negativeMonths = monthlyData.filter((m) => m.returnPercent !== null && m.returnPercent < 0).length;
  const avgReturn = monthlyData.reduce((acc, m) => acc + (m.returnPercent || 0), 0) / monthlyData.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Last {monthlyData.length} months | Avg: {formatReturn(avgReturn)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3 mr-1" />
            {positiveMonths} Up
          </Badge>
          <Badge variant="outline" className="text-red-600 dark:text-red-400">
            <TrendingDown className="h-3 w-3 mr-1" />
            {negativeMonths} Down
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">NAV Start</TableHead>
                <TableHead className="text-right">NAV End</TableHead>
                <TableHead className="text-right">Return</TableHead>
                <TableHead className="text-right">Benchmark</TableHead>
                <TableHead className="text-right">Alpha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((month) => (
                <TableRow key={month.monthYear}>
                  <TableCell className="font-medium">
                    {formatMonth(month.monthYear)}
                    {month.isPartial && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Partial
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {month.navStart?.toFixed(2) || "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    {month.navEnd?.toFixed(2) || "N/A"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getReturnColor(month.returnPercent)}`}>
                    <span className="flex items-center justify-end gap-1">
                      {getReturnIcon(month.returnPercent)}
                      {formatReturn(month.returnPercent)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${getReturnColor(month.benchmarkReturn)}`}>
                    {formatReturn(month.benchmarkReturn)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getReturnColor(month.excessReturn)}`}>
                    {formatReturn(month.excessReturn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Benchmark comparison coming soon | Returns calculated from historical NAV data
        </p>
      </CardContent>
    </Card>
  );
}
