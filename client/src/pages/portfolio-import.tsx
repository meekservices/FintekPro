import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  investor: {
    name: string;
    pan: string;
    lastSync: string;
  };
  summary: {
    totalInvested: number;
    currentValue: number;
    growth: number;
    equityPercent: number;
    debtPercent: number;
  };
  imported: number;
  skipped: number;
  holdings: Array<{
    fundName: string;
    invested: number;
    currentValue: number;
  }>;
}

interface ExternalHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  quantity: string;
  avgPrice: string;
  currentValue: string;
  source: string;
  lastSyncedAt: string;
}

interface ExternalHoldingsResponse {
  holdings: ExternalHolding[];
  summary: {
    totalHoldings: number;
    totalInvested: number;
    totalCurrentValue: number;
    gainLoss: number;
    gainLossPercent: number;
  };
}

export default function PortfolioImport() {
  const [wealthyUrl, setWealthyUrl] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const { data: existingHoldings, isLoading: holdingsLoading, refetch: refetchHoldings } = useQuery<ExternalHoldingsResponse>({
    queryKey: ['/api/portfolio/external-holdings', 'WEALTHY_IN'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/external-holdings?source=WEALTHY_IN');
      if (!res.ok) throw new Error('Failed to fetch holdings');
      return res.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { url: string; replaceExisting: boolean }) => {
      const res = await apiRequest('POST', '/api/portfolio/import-wealthy', data);
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/external-holdings', 'WEALTHY_IN'] });
      refetchHoldings();
      toast({
        title: "Portfolio Imported",
        description: `Successfully imported ${data.imported} mutual fund holdings`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!wealthyUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please paste your Wealthy.in portfolio URL",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate({ url: wealthyUrl, replaceExisting });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Portfolio</h1>
          <p className="text-muted-foreground">Import your existing portfolio from Wealthy.in</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Wealthy.in
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import from Wealthy.in
          </CardTitle>
          <CardDescription>
            Paste your Wealthy.in portfolio report URL to import your mutual fund holdings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wealthy-url">Portfolio Report URL</Label>
            <Input
              id="wealthy-url"
              data-testid="input-wealthy-url"
              placeholder="https://reports.wealthy.in/?token=..."
              value={wealthyUrl}
              onChange={(e) => setWealthyUrl(e.target.value)}
              disabled={importMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Get this URL from your Wealthy.in account by sharing the portfolio report
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="replace-existing"
              data-testid="switch-replace-existing"
              checked={replaceExisting}
              onCheckedChange={setReplaceExisting}
              disabled={importMutation.isPending}
            />
            <Label htmlFor="replace-existing" className="text-sm">
              Replace existing Wealthy.in holdings (removes previous import)
            </Label>
          </div>

          <Button 
            onClick={handleImport} 
            disabled={importMutation.isPending || !wealthyUrl.trim()}
            className="w-full"
            data-testid="button-import"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Portfolio
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {importResult && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-5 h-5" />
              Import Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Investor</p>
                <p className="font-medium">{importResult.investor.name}</p>
                <p className="text-xs text-muted-foreground">PAN: {importResult.investor.pan}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Sync</p>
                <p className="font-medium">{importResult.investor.lastSync}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-muted-foreground">Invested</p>
                <p className="text-lg font-bold">{formatCurrency(importResult.summary.totalInvested)}</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-lg font-bold">{formatCurrency(importResult.summary.currentValue)}</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
                <p className="text-xs text-muted-foreground">Growth</p>
                <p className={`text-lg font-bold ${importResult.summary.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {importResult.summary.growth >= 0 ? '+' : ''}{importResult.summary.growth.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <Badge variant="secondary">{importResult.imported} holdings imported</Badge>
              {importResult.skipped > 0 && (
                <Badge variant="outline">{importResult.skipped} skipped</Badge>
              )}
              <Badge variant="outline">{importResult.summary.equityPercent}% Equity</Badge>
              <Badge variant="outline">{importResult.summary.debtPercent}% Debt</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Imported Holdings
              </CardTitle>
              <CardDescription>Your mutual fund holdings from Wealthy.in</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchHoldings()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {holdingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : existingHoldings && existingHoldings.holdings.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Total Holdings</p>
                  <p className="text-xl font-bold">{existingHoldings.summary.totalHoldings}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Invested</p>
                  <p className="text-xl font-bold">{formatCurrency(existingHoldings.summary.totalInvested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="text-xl font-bold">{formatCurrency(existingHoldings.summary.totalCurrentValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gain/Loss</p>
                  <p className={`text-xl font-bold flex items-center gap-1 ${existingHoldings.summary.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {existingHoldings.summary.gainLoss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(Math.abs(existingHoldings.summary.gainLoss))}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {existingHoldings.holdings.map((holding, index) => {
                  const invested = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
                  const current = parseFloat(holding.currentValue);
                  const gainLoss = current - invested;
                  const gainLossPercent = invested > 0 ? (gainLoss / invested) * 100 : 0;

                  return (
                    <div 
                      key={holding.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`holding-item-${index}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate" title={holding.name || holding.symbol}>
                            {holding.name || holding.symbol}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{holding.assetType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {parseFloat(holding.quantity).toFixed(2)} units
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(current)}</p>
                          <p className={`text-xs flex items-center justify-end gap-1 ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gainLoss >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No imported holdings yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Import your Wealthy.in portfolio to see your holdings here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How to get your Wealthy.in URL</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <ol className="list-decimal list-inside text-sm space-y-1">
            <li>Log in to your Wealthy.in account</li>
            <li>Go to your portfolio report</li>
            <li>Click on "Share" or copy the report URL</li>
            <li>The URL should look like: <code className="bg-muted px-1 rounded">https://reports.wealthy.in/?token=...</code></li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}
