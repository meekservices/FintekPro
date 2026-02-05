import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Grid3X3, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockExposure {
  stock: string;
  totalExposure: number;
  fundCount: number;
  funds: Array<{
    isin: string;
    name: string;
    contribution: number;
  }>;
}

interface OverlapRiskHeatmapProps {
  stockExposures: StockExposure[];
  maxStocks?: number;
  maxFunds?: number;
}

function getHeatmapColor(exposure: number): string {
  if (exposure === 0) return "bg-gray-100 dark:bg-gray-800";
  if (exposure < 1) return "bg-green-100 dark:bg-green-900/30";
  if (exposure < 2) return "bg-green-300 dark:bg-green-800/50";
  if (exposure < 3) return "bg-yellow-200 dark:bg-yellow-900/40";
  if (exposure < 5) return "bg-amber-300 dark:bg-amber-800/50";
  if (exposure < 7) return "bg-orange-400 dark:bg-orange-700/60";
  return "bg-red-500 dark:bg-red-700/70";
}

function getTextColor(exposure: number): string {
  if (exposure === 0) return "text-gray-400";
  if (exposure < 3) return "text-gray-700 dark:text-gray-200";
  return "text-white";
}

export function OverlapRiskHeatmap({
  stockExposures,
  maxStocks = 10,
  maxFunds = 6,
}: OverlapRiskHeatmapProps) {
  const { stocks, fundNames, matrix } = useMemo(() => {
    // Get top overlapping stocks
    const topStocks = stockExposures
      .filter(s => s.fundCount >= 2)
      .slice(0, maxStocks);

    // Get unique fund names
    const allFunds = new Map<string, string>();
    for (const stock of topStocks) {
      for (const fund of stock.funds) {
        if (!allFunds.has(fund.isin)) {
          allFunds.set(fund.isin, fund.name);
        }
      }
    }
    const fundEntries = Array.from(allFunds.entries()).slice(0, maxFunds);

    // Build matrix: stocks (rows) x funds (columns)
    const matrixData: number[][] = [];
    for (const stock of topStocks) {
      const row: number[] = [];
      for (const [fundIsin] of fundEntries) {
        const fundContribution = stock.funds.find(f => f.isin === fundIsin);
        row.push(fundContribution?.contribution || 0);
      }
      matrixData.push(row);
    }

    return {
      stocks: topStocks.map(s => s.stock),
      fundNames: fundEntries.map(([_, name]) => name),
      matrix: matrixData,
    };
  }, [stockExposures, maxStocks, maxFunds]);

  if (!stocks.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Overlap Risk Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No overlapping stocks detected across funds.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              Overlap Risk Heatmap
            </CardTitle>
            <CardDescription>
              Stock concentration across funds
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Each cell shows portfolio exposure (%) to a stock through a fund.
                  Darker colors = higher concentration risk.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header row with fund names */}
            <div className="flex">
              <div className="w-24 flex-shrink-0" /> {/* Empty corner cell */}
              {fundNames.map((name, idx) => (
                <div
                  key={idx}
                  className="w-16 px-1 text-center"
                  title={name}
                >
                  <span className="text-xs font-medium text-muted-foreground truncate block transform -rotate-45 origin-left translate-x-4 translate-y-2 whitespace-nowrap max-w-[80px] overflow-hidden">
                    {name.length > 12 ? name.substring(0, 12) + "..." : name}
                  </span>
                </div>
              ))}
            </div>

            {/* Spacer for rotated headers */}
            <div className="h-8" />

            {/* Data rows */}
            {stocks.map((stock, rowIdx) => (
              <div key={rowIdx} className="flex items-center">
                <div className="w-24 flex-shrink-0 pr-2 text-right">
                  <span className="text-xs font-medium truncate block" title={stock}>
                    {stock.length > 10 ? stock.substring(0, 10) + "..." : stock}
                  </span>
                </div>
                {matrix[rowIdx].map((value, colIdx) => (
                  <TooltipProvider key={colIdx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-16 h-8 flex items-center justify-center border border-white/50 cursor-pointer transition-transform hover:scale-105",
                            getHeatmapColor(value)
                          )}
                        >
                          {value > 0 && (
                            <span className={cn("text-xs font-medium", getTextColor(value))}>
                              {value.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          <strong>{stock}</strong> via <strong>{fundNames[colIdx]}</strong>
                          <br />
                          Portfolio exposure: {value.toFixed(2)}%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t">
          <span className="text-xs text-muted-foreground">Exposure:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100 border" />
            <span className="text-xs">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-amber-300 border" />
            <span className="text-xs">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 border" />
            <span className="text-xs">High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default OverlapRiskHeatmap;
