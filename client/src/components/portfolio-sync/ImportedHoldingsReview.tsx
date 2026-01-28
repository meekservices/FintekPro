import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Check,
  X,
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Save,
  Eye,
  FileText
} from "lucide-react";

interface StagedHolding {
  id: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: string;
  quantity: number;
  units?: number;
  averageCost?: number;
  currentPrice?: number;
  currentValue?: number;
  investedValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  folioNumber?: string;
  dematAccountNumber?: string;
  source: string;
  dataSource?: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  originalData?: any;
  modifiedFields?: string[];
  validationErrors?: string[];
}

interface StagingSession {
  id: string;
  userId: string;
  holdings: StagedHolding[];
  totalValue: number;
  createdAt: string;
  status: 'pending_review' | 'partially_approved' | 'fully_approved' | 'synced';
}

interface ImportedHoldingsReviewProps {
  userId: string;
  onSyncComplete?: () => void;
  onCancel?: () => void;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  equity: 'Stocks',
  mutual_fund: 'Mutual Funds',
  bond: 'Bonds',
  etf: 'ETFs',
  pms: 'PMS',
  aif: 'AIF',
  nps: 'NPS',
  epf: 'EPF',
  ppf: 'PPF',
};

const SOURCE_LABELS: Record<string, string> = {
  aa_mf: 'Account Aggregator (MF)',
  aa_demat: 'Account Aggregator (Demat)',
  pdf_cas: 'CAS Statement',
  csv_upload: 'CSV Upload',
  manual: 'Manual Entry',
  cams: 'CAMS',
  kfintech: 'KFinTech',
  nsdl: 'NSDL',
  cdsl: 'CDSL',
};

export function ImportedHoldingsReview({ userId, onSyncComplete, onCancel }: ImportedHoldingsReviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedHoldings, setSelectedHoldings] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<StagedHolding | null>(null);
  const [editForm, setEditForm] = useState<Partial<StagedHolding>>({});

  const { data: stagingSession, isLoading, refetch } = useQuery<StagingSession>({
    queryKey: ['/api/portfolio/staging', userId],
    enabled: !!userId,
  });

  const holdings = stagingSession?.holdings || [];

  const filteredHoldings = useMemo(() => {
    return holdings.filter(holding => {
      const matchesSearch = !searchTerm || 
        holding.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holding.isin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        holding.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAssetType = assetTypeFilter === 'all' || holding.assetType === assetTypeFilter;
      const matchesSource = sourceFilter === 'all' || holding.source === sourceFilter;
      
      return matchesSearch && matchesAssetType && matchesSource;
    });
  }, [holdings, searchTerm, assetTypeFilter, sourceFilter]);

  const assetTypes = useMemo(() => {
    const types = new Set(holdings.map(h => h.assetType));
    return Array.from(types);
  }, [holdings]);

  const sources = useMemo(() => {
    const srcs = new Set(holdings.map(h => h.source));
    return Array.from(srcs);
  }, [holdings]);

  const summary = useMemo(() => {
    const approved = holdings.filter(h => h.status === 'approved').length;
    const rejected = holdings.filter(h => h.status === 'rejected').length;
    const pending = holdings.filter(h => h.status === 'pending').length;
    const modified = holdings.filter(h => h.status === 'modified').length;
    const totalValue = holdings
      .filter(h => h.status !== 'rejected')
      .reduce((sum, h) => sum + (h.currentValue || 0), 0);
    
    return { approved, rejected, pending, modified, totalValue, total: holdings.length };
  }, [holdings]);

  const approveHoldingsMutation = useMutation({
    mutationFn: async (holdingIds: string[]) => {
      return apiRequest('/api/portfolio/staging/approve', {
        method: 'POST',
        body: JSON.stringify({ userId, holdingIds })
      });
    },
    onSuccess: () => {
      toast({ title: "Holdings Approved", description: "Selected holdings marked for sync" });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const rejectHoldingsMutation = useMutation({
    mutationFn: async (holdingIds: string[]) => {
      return apiRequest('/api/portfolio/staging/reject', {
        method: 'POST',
        body: JSON.stringify({ userId, holdingIds })
      });
    },
    onSuccess: () => {
      toast({ title: "Holdings Rejected", description: "Selected holdings will not be synced" });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateHoldingMutation = useMutation({
    mutationFn: async (update: { holdingId: string; data: Partial<StagedHolding> }) => {
      return apiRequest('/api/portfolio/staging/update', {
        method: 'PATCH',
        body: JSON.stringify({ userId, holdingId: update.holdingId, data: update.data })
      });
    },
    onSuccess: () => {
      toast({ title: "Holding Updated", description: "Changes saved successfully" });
      setEditDialogOpen(false);
      setEditingHolding(null);
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const finalSyncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/portfolio/staging/sync', {
        method: 'POST',
        body: JSON.stringify({ userId, sessionId: stagingSession?.id })
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Portfolio Synced!", 
        description: `Successfully synced ${data.syncedCount} holdings to your portfolio` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/staging', userId] });
      onSyncComplete?.();
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    }
  });

  const toggleSelectAll = () => {
    if (selectedHoldings.size === filteredHoldings.length) {
      setSelectedHoldings(new Set());
    } else {
      setSelectedHoldings(new Set(filteredHoldings.map(h => h.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedHoldings);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedHoldings(newSelection);
  };

  const handleApproveSelected = () => {
    if (selectedHoldings.size === 0) return;
    approveHoldingsMutation.mutate(Array.from(selectedHoldings));
    setSelectedHoldings(new Set());
  };

  const handleRejectSelected = () => {
    if (selectedHoldings.size === 0) return;
    rejectHoldingsMutation.mutate(Array.from(selectedHoldings));
    setSelectedHoldings(new Set());
  };

  const handleEdit = (holding: StagedHolding) => {
    setEditingHolding(holding);
    setEditForm({
      name: holding.name,
      quantity: holding.quantity,
      units: holding.units,
      averageCost: holding.averageCost,
      currentPrice: holding.currentPrice,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingHolding) return;
    updateHoldingMutation.mutate({
      holdingId: editingHolding.id,
      data: editForm
    });
  };

  const handleFinalSync = () => {
    const approvedCount = holdings.filter(h => h.status === 'approved' || h.status === 'modified').length;
    if (approvedCount === 0) {
      toast({ 
        title: "No Holdings Selected", 
        description: "Please approve at least one holding before syncing", 
        variant: "destructive" 
      });
      return;
    }
    finalSyncMutation.mutate();
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | undefined, decimals = 2) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString('en-IN', { maximumFractionDigits: decimals });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'modified':
        return <Badge className="bg-blue-100 text-blue-800"><Edit2 className="w-3 h-3 mr-1" />Modified</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600"><Eye className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-gray-600">Loading imported holdings...</span>
        </CardContent>
      </Card>
    );
  }

  if (!stagingSession || holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Holdings to Review</h3>
            <p className="text-gray-500 mt-2">
              Import your portfolio via Account Aggregator or upload a CAS statement to see holdings here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
              Review Imported Holdings
            </CardTitle>
            <CardDescription>
              Review and approve holdings before syncing to your portfolio
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{summary.total} Holdings</Badge>
            <Badge className="bg-green-100 text-green-800">{summary.approved} Approved</Badge>
            {summary.rejected > 0 && (
              <Badge className="bg-red-100 text-red-800">{summary.rejected} Rejected</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, ISIN, or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Asset Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assetTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {ASSET_TYPE_LABELS[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(src => (
                  <SelectItem key={src} value={src}>
                    {SOURCE_LABELS[src] || src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleApproveSelected}
              disabled={selectedHoldings.size === 0 || approveHoldingsMutation.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve ({selectedHoldings.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectSelected}
              disabled={selectedHoldings.size === 0 || rejectHoldingsMutation.isPending}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-1" />
              Reject ({selectedHoldings.size})
            </Button>
          </div>
        </div>

        {holdings.some(h => h.validationErrors?.length) && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Some holdings have validation issues. Review and correct before syncing.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedHoldings.size === filteredHoldings.length && filteredHoldings.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name / ISIN</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty/Units</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHoldings.map(holding => (
                <TableRow 
                  key={holding.id} 
                  className={holding.status === 'rejected' ? 'opacity-50' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedHoldings.has(holding.id)}
                      onCheckedChange={() => toggleSelect(holding.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {holding.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {holding.isin || holding.symbol || '-'}
                        {holding.folioNumber && ` | Folio: ${holding.folioNumber}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {ASSET_TYPE_LABELS[holding.assetType] || holding.assetType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(holding.units || holding.quantity)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(holding.averageCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(holding.currentValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {holding.gainLoss !== undefined && (
                      <div className={holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <span className="font-mono">{formatCurrency(holding.gainLoss)}</span>
                        {holding.gainLossPercent !== undefined && (
                          <span className="text-xs ml-1">
                            ({holding.gainLossPercent >= 0 ? '+' : ''}{holding.gainLossPercent.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">
                      {SOURCE_LABELS[holding.source] || holding.source}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(holding.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(holding)}
                        disabled={holding.status === 'rejected'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <Separator />

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm text-gray-500">Total Portfolio Value (Approved)</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.totalValue)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-500">Ready to Sync</div>
                <div className="text-lg font-semibold">
                  {summary.approved + summary.modified} of {summary.total} holdings
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              approveHoldingsMutation.mutate(holdings.filter(h => h.status === 'pending').map(h => h.id));
            }}
            disabled={summary.pending === 0 || approveHoldingsMutation.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approve All Pending
          </Button>
          <Button
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            onClick={handleFinalSync}
            disabled={finalSyncMutation.isPending || (summary.approved + summary.modified) === 0}
          >
            {finalSyncMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sync to Portfolio ({summary.approved + summary.modified})
          </Button>
        </div>
      </CardFooter>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Holding</DialogTitle>
            <DialogDescription>
              Modify holding details before syncing
            </DialogDescription>
          </DialogHeader>

          {editingHolding && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {editingHolding.assetType === 'mutual_fund' ? 'Units' : 'Quantity'}
                  </label>
                  <Input
                    type="number"
                    value={editForm.units || editForm.quantity || ''}
                    onChange={(e) => setEditForm({ 
                      ...editForm, 
                      [editingHolding.assetType === 'mutual_fund' ? 'units' : 'quantity']: parseFloat(e.target.value) 
                    })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Average Cost</label>
                  <Input
                    type="number"
                    value={editForm.averageCost || ''}
                    onChange={(e) => setEditForm({ ...editForm, averageCost: parseFloat(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Price</label>
                <Input
                  type="number"
                  value={editForm.currentPrice || ''}
                  onChange={(e) => setEditForm({ ...editForm, currentPrice: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>

              {editingHolding.validationErrors?.length && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <ul className="list-disc list-inside">
                      {editingHolding.validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateHoldingMutation.isPending}
            >
              {updateHoldingMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
