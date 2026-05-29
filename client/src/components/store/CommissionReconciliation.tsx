import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  FileText,
  Link2,
  Unlink,
  TrendingUp,
  TrendingDown,
  Receipt,
  IndianRupee,
  Building2,
  Users,
  Loader2
} from "lucide-react";

interface ZohoSyncStatus {
  connected: boolean;
  pendingSync: {
    mutualFunds: number;
    bonds: number;
    unlisted: number;
    store: number;
    commissions: number;
  };
  lastSyncAt?: string;
}

interface ReconciliationItem {
  id: string;
  transactionType: string;
  productType: string;
  productName: string;
  amount: string;
  status: string;
  createdAt: string;
  zohoSyncedAt?: string;
  zohoInvoiceId?: string;
  zohoBillId?: string;
  zohoSyncStatus?: string;
  matchStatus: 'matched' | 'pending' | 'failed' | 'skipped';
  commissionAmount?: string;
  commissionPaid?: boolean;
}

interface CommissionPayout {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  productType: string;
  transactionId: string;
  transactionDate: string;
  commissionAmount: string;
  tdsAmount: string;
  netAmount: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  zohoBillId?: string;
  payoutDate?: string;
}

const syncStatusColors: Record<string, string> = {
  matched: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  skipped: "bg-muted text-muted-foreground",
  pass_through: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const payoutStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  approved: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  paid: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export function CommissionReconciliation() {
  const { toast } = useToast();
  const [selectedProductType, setSelectedProductType] = useState<string>("all");
  const [selectedSyncStatus, setSelectedSyncStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("transactions");

  const { data: zohoStatus, isLoading: statusLoading } = useQuery<ZohoSyncStatus>({
    queryKey: ['/api/admin/zoho-books/sync/status'],
  });

  const { data: reconciliationData, isLoading: reconciliationLoading } = useQuery<{
    success: boolean;
    items: ReconciliationItem[];
    summary: {
      totalTransactions: number;
      matched: number;
      pending: number;
      failed: number;
      totalAmount: string;
      syncedAmount: string;
    };
  }>({
    queryKey: ['/api/admin/commission-reconciliation', selectedProductType, selectedSyncStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProductType !== "all") params.append('productType', selectedProductType);
      if (selectedSyncStatus !== "all") params.append('syncStatus', selectedSyncStatus);
      const response = await fetch(`/api/admin/commission-reconciliation?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch reconciliation data');
      return response.json();
    },
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery<{
    success: boolean;
    payouts: CommissionPayout[];
    summary: {
      totalPending: string;
      totalApproved: string;
      totalPaid: string;
      pendingCount: number;
    };
  }>({
    queryKey: ['/api/admin/commission-payouts'],
    enabled: activeTab === "payouts",
  });

  const syncAllMutation = useMutation({
    mutationFn: async (productTypes?: string[]) => {
      return apiRequest('/api/admin/zoho-books/sync/all', {
        method: 'POST',
        body: JSON.stringify({ productTypes }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync Complete",
        description: `Synced ${data.successCount} of ${data.totalProcessed} transactions`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/zoho-books/sync/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync transactions",
        variant: "destructive",
      });
    },
  });

  const syncSingleMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const endpoint = type === 'store' 
        ? `/api/admin/zoho-books/sync/store/${id}`
        : `/api/admin/zoho-books/sync/${type}/${id}`;
      return apiRequest(endpoint, { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: "Transaction Synced", description: "Successfully synced to Zoho Books" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-reconciliation'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync transaction",
        variant: "destructive",
      });
    },
  });

  const approvePayoutMutation = useMutation({
    mutationFn: async ({ payoutId, forceLocalApproval = false }: { payoutId: string; forceLocalApproval?: boolean }) => {
      const response = await fetch(`/api/admin/commission-payouts/${payoutId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceLocalApproval })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Approval failed');
      }
      return data;
    },
    onSuccess: (data) => {
      const description = data.zohoBillId 
        ? `Commission payout approved with Zoho Bill ${data.zohoBillId}`
        : data.requiresZohoSync 
          ? "Approved locally - Zoho sync pending"
          : "Commission payout approved successfully";
      toast({ title: "Payout Approved", description });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-payouts'] });
    },
    onError: (error: any) => {
      const errorMsg = error.message || "Failed to approve payout";
      const isZohoError = errorMsg.includes('Zoho');
      toast({
        title: isZohoError ? "Zoho Sync Failed" : "Approval Failed",
        description: isZohoError 
          ? `${errorMsg}. Click "Force Approve" to approve without Zoho sync.`
          : errorMsg,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  if (statusLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!zohoStatus?.connected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Zoho Books is not connected. Please configure the integration to enable commission reconciliation.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{reconciliationData?.summary?.totalTransactions || 0}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Synced to Zoho</p>
                <p className="text-2xl font-bold text-green-600">{reconciliationData?.summary?.matched || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Sync</p>
                <p className="text-2xl font-bold text-yellow-600">{reconciliationData?.summary?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(reconciliationData?.summary?.totalAmount || '0')}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="transactions" data-testid="tab-transactions">
              <FileText className="h-4 w-4 mr-2" />
              Transaction Sync
            </TabsTrigger>
            <TabsTrigger value="payouts" data-testid="tab-payouts">
              <DollarSign className="h-4 w-4 mr-2" />
              Commission Payouts
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => syncAllMutation.mutate(undefined)}
              disabled={syncAllMutation.isPending || !zohoStatus?.connected}
              data-testid="button-sync-all"
            >
              {syncAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync All Pending
            </Button>
          </div>
        </div>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transaction Reconciliation</CardTitle>
                  <CardDescription>Match store transactions with Zoho Books entries</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                    <SelectTrigger className="w-[180px]" data-testid="select-product-type">
                      <SelectValue placeholder="Product Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
                      <SelectItem value="bond">Bonds</SelectItem>
                      <SelectItem value="unlisted">Unlisted Shares</SelectItem>
                      <SelectItem value="ipo">IPO</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedSyncStatus} onValueChange={setSelectedSyncStatus}>
                    <SelectTrigger className="w-[150px]" data-testid="select-sync-status">
                      <SelectValue placeholder="Sync Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="matched">Synced</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="skipped">Skipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reconciliationLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : reconciliationData?.items?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found matching the selected filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Sync Status</TableHead>
                      <TableHead>Zoho Reference</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliationData?.items?.map((item) => (
                      <TableRow key={item.id} data-testid={`row-transaction-${item.id}`}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.transactionType}</span>
                            <span className="text-xs text-muted-foreground block">
                              {item.id.substring(0, 8)}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.productType}</Badge>
                          {item.productName && (
                            <span className="text-xs text-muted-foreground block mt-1">
                              {item.productName.substring(0, 25)}...
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(item.createdAt), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge className={syncStatusColors[item.matchStatus] || syncStatusColors.pending}>
                            {item.matchStatus === 'matched' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {item.matchStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {item.matchStatus === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                            {item.zohoSyncStatus || item.matchStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.zohoInvoiceId ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Link2 className="h-3 w-3 text-green-500" />
                              <span>INV: {item.zohoInvoiceId.substring(0, 10)}...</span>
                            </div>
                          ) : item.zohoBillId ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Link2 className="h-3 w-3 text-blue-500" />
                              <span>BILL: {item.zohoBillId.substring(0, 10)}...</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Unlink className="h-3 w-3" /> Not linked
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.matchStatus === 'pending' && zohoStatus?.connected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncSingleMutation.mutate({ 
                                id: item.id, 
                                type: item.productType === 'mutual_fund' ? 'mutual-fund' : item.productType 
                              })}
                              disabled={syncSingleMutation.isPending}
                              data-testid={`button-sync-${item.id}`}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Sync
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payouts</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {formatCurrency(payoutsData?.summary?.totalPending || '0')}
                    </p>
                  </div>
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(payoutsData?.summary?.totalApproved || '0')}
                    </p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(payoutsData?.summary?.totalPaid || '0')}
                    </p>
                  </div>
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Count</p>
                    <p className="text-xl font-bold">{payoutsData?.summary?.pendingCount || 0}</p>
                  </div>
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Commission Payouts</CardTitle>
              <CardDescription>Agent and partner commission payout reconciliation with Zoho Books</CardDescription>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : payoutsData?.payouts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No commission payouts found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>TDS</TableHead>
                      <TableHead>Net Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Zoho Bill</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutsData?.payouts?.map((payout) => (
                      <TableRow key={payout.id} data-testid={`row-payout-${payout.id}`}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{payout.agentName}</span>
                            <span className="text-xs text-muted-foreground block">{payout.agentRole}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payout.productType}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(payout.commissionAmount)}</TableCell>
                        <TableCell className="text-red-600">
                          -{formatCurrency(payout.tdsAmount)}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(payout.netAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={payoutStatusColors[payout.status]}>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payout.zohoBillId ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Link2 className="h-3 w-3 text-green-500" />
                              <span>{payout.zohoBillId.substring(0, 10)}...</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not created</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approvePayoutMutation.mutate({ payoutId: payout.id, forceLocalApproval: false })}
                                disabled={approvePayoutMutation.isPending}
                                data-testid={`button-approve-${payout.id}`}
                              >
                                {approvePayoutMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : null}
                                Approve
                              </Button>
                              {!zohoStatus?.connected && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs"
                                  onClick={() => approvePayoutMutation.mutate({ payoutId: payout.id, forceLocalApproval: true })}
                                  disabled={approvePayoutMutation.isPending}
                                  data-testid={`button-force-approve-${payout.id}`}
                                >
                                  Force
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CommissionReconciliation;
