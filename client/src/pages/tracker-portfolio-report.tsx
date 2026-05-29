import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Filter
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePortfoliosByPan, useEnhancedPortfolioHoldings } from "@/hooks/use-portfolio";
import { ExternalPortfolioSync } from "@/components/portfolio-sync/ExternalPortfolioSync";

export default function TrackerPortfolioReport() {
  const { user } = useAuth();
  const [showSync, setShowSync] = useState(false);
  
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfoliosByPan();
  const portfolioId = portfolios?.[0]?.id || '';
  
  const { data: holdings, isLoading: holdingsLoading, refetch } = useEnhancedPortfolioHoldings(portfolioId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const isLoading = portfoliosLoading || holdingsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalValue = holdings?.reduce((sum: number, h: any) => sum + parseFloat(h.currentValue || '0'), 0) || 0;
  const totalGainLoss = holdings?.reduce((sum: number, h: any) => sum + parseFloat(h.gainLoss || '0'), 0) || 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Tracker Portfolio Report
          </h1>
          <p className="text-muted-foreground">PAN-level consolidated holdings from all sources</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowSync(!showSync)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync External
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {showSync && (
        <Card>
          <CardHeader>
            <CardTitle>Sync External Holdings</CardTitle>
            <CardDescription>Import holdings from CDSL, NSDL, or upload statements</CardDescription>
          </CardHeader>
          <CardContent>
            <ExternalPortfolioSync />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Total Portfolio Value</div>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Total Gain/Loss</div>
            <div className={`text-2xl font-bold flex items-center gap-2 ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalGainLoss >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {formatCurrency(Math.abs(totalGainLoss))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Holdings Count</div>
            <div className="text-2xl font-bold">{holdings?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Holdings</CardTitle>
          <CardDescription>Complete list of tracked investments</CardDescription>
        </CardHeader>
        <CardContent>
          {holdings && holdings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Gain/Loss</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((holding: any) => (
                  <TableRow key={holding.id}>
                    <TableCell className="font-medium">{holding.symbol || holding.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{holding.assetType}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{holding.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(holding.avgPrice || '0'))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(holding.currentValue || '0'))}</TableCell>
                    <TableCell className={`text-right ${parseFloat(holding.gainLoss || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(parseFloat(holding.gainLoss || '0'))}
                      <span className="text-xs ml-1">({parseFloat(holding.gainLossPercent || '0').toFixed(2)}%)</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{holding.source || 'FINTEKPRO'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No holdings found</p>
              <p className="text-sm">Sync your external holdings to see consolidated view</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
