import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Package, FolderTree, Search, Loader2, ChevronRight, ChevronDown, 
  AlertTriangle, History, Eye, EyeOff, FileText, RefreshCw,
  Plus, Edit, Trash2, ArrowLeft, Shield as LucideShield, ShieldAlert, Sparkles, Award, Sprout
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
}

interface Product {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  name: string;
  shortDescription?: string;
  description?: string;
  productType?: string;
  planType?: 'direct' | 'regular';
  expenseRatio?: string;
  trailCommission?: string;
  amfiCode?: string;
  isinCode?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  beforeValue?: any;
  afterValue?: any;
  timestamp: string;
}

interface PortfolioAIF {
  id: number;
  clientId: number;
  schemeId: number | null;
  schemeName: string;
  amcName: string;
  category: string | null;
  subCategory: string | null;
  commitmentAmount: string;
  capitalCalled: string;
  capitalUncalled: string;
  currentNav: string | null;
  currentValue: string | null;
  unrealizedGainLoss: string | null;
  lockInEndDate: string | null;
  fundStartDate: string | null;
  investmentDate: string | null;
  entryStatus: string;
  notes: string | null;
  documents: any | null;
  createdAt: string;
  type: "aif";
  client?: { id: number; name: string; email: string };
}

interface PortfolioPMS {
  id: number;
  clientId: number;
  schemeId: number | null;
  schemeName: string;
  amcName: string;
  strategy: string | null;
  initialInvestment: string;
  additionalInfusions: string | null;
  totalInvested: string;
  corpusValue: string | null;
  currentValue: string | null;
  unrealizedGainLoss: string | null;
  cagr: string | null;
  startDate: string | null;
  entryStatus: string;
  notes: string | null;
  documents: any | null;
  createdAt: string;
  type: "pms";
  client?: { id: number; name: string; email: string };
}

interface PortfolioMLD {
  id: string;
  clientId: string;
  isin: string | null;
  mldName: string;
  issuer: string | null;
  payoffType: string | null;
  quantity: number;
  purchasePrice: string;
  faceValue: string | null;
  totalInvested: string | null;
  currentValue: string | null;
  maturityDate: string | null;
  purchaseDate: string | null;
  entryStatus: string;
  notes: string | null;
  createdAt: string;
  type: "mld";
  client?: { id: string; name: string; email: string };
}

function PortfolioApprovalsTab() {
  const { toast } = useToast();
  const [approvalType, setApprovalType] = useState<"aif" | "pms" | "mld">("aif");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const { data: portfolioData, isLoading } = useQuery<{ 
    aif: PortfolioAIF[]; 
    pms: PortfolioPMS[];
    mld: PortfolioMLD[];
    summary: { totalAifHoldings: number; totalPmsHoldings: number; totalMldHoldings: number; pendingApproval: number };
  }>({
    queryKey: ['/api/store/portfolio/admin/all'],
  });

  const aifHoldings = portfolioData?.aif || [];
  const pmsHoldings = portfolioData?.pms || [];
  const mldHoldings = portfolioData?.mld || [];

  const approveMutation = useMutation({
    mutationFn: ({ type, id, action }: { type: 'aif' | 'pms' | 'mld'; id: number | string; action: 'approve' | 'reject' }) =>
      apiRequest(`/api/store/portfolio/admin/approve/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/store/portfolio/admin/all'] });
      toast({
        title: variables.action === 'approve' ? "Entry Approved" : "Entry Rejected",
        description: `The ${variables.type.toUpperCase()} entry has been ${variables.action === 'approve' ? 'approved' : 'rejected'}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update approval status",
        variant: "destructive"
      });
    }
  });

  const filteredAIF = statusFilter === 'all' 
    ? aifHoldings 
    : aifHoldings.filter(h => h.entryStatus === statusFilter);

  const filteredPMS = statusFilter === 'all' 
    ? pmsHoldings 
    : pmsHoldings.filter(h => h.entryStatus === statusFilter);

  const filteredMLD = statusFilter === 'all' 
    ? mldHoldings 
    : mldHoldings.filter(h => h.entryStatus === statusFilter);

  const pendingAIFCount = aifHoldings.filter(h => h.entryStatus === 'pending').length;
  const pendingPMSCount = pmsHoldings.filter(h => h.entryStatus === 'pending').length;
  const pendingMLDCount = mldHoldings.filter(h => h.entryStatus === 'pending').length;

  const formatCurrency = (value: string | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(parseFloat(value));
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Portfolio Approvals</span>
          <div className="flex items-center gap-2">
            {pendingAIFCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {pendingAIFCount} AIF Pending
              </Badge>
            )}
            {pendingPMSCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {pendingPMSCount} PMS Pending
              </Badge>
            )}
            {pendingMLDCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {pendingMLDCount} MLD Pending
              </Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Review and approve client-submitted AIF, PMS, and MLD holdings for portfolio analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={approvalType === "aif" ? "default" : "outline"}
              size="sm"
              onClick={() => setApprovalType("aif")}
              className={approvalType === "aif" ? "bg-blue-600 hover:bg-blue-700" : "border-border"}
              data-testid="button-filter-aif"
            >
              AIF Holdings
            </Button>
            <Button
              variant={approvalType === "pms" ? "default" : "outline"}
              size="sm"
              onClick={() => setApprovalType("pms")}
              className={approvalType === "pms" ? "bg-purple-600 hover:bg-purple-700" : "border-border"}
              data-testid="button-filter-pms"
            >
              PMS Holdings
            </Button>
            <Button
              variant={approvalType === "mld" ? "default" : "outline"}
              size="sm"
              onClick={() => setApprovalType("mld")}
              className={approvalType === "mld" ? "bg-teal-600 hover:bg-teal-700" : "border-border"}
              data-testid="button-filter-mld"
            >
              MLD Holdings
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className={statusFilter === "pending" ? "bg-amber-600 hover:bg-amber-700" : "border-border"}
              data-testid="button-filter-pending"
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("approved")}
              className={statusFilter === "approved" ? "bg-green-600 hover:bg-green-700" : "border-border"}
              data-testid="button-filter-approved"
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("rejected")}
              className={statusFilter === "rejected" ? "bg-red-600 hover:bg-red-700" : "border-border"}
              data-testid="button-filter-rejected"
            >
              Rejected
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={statusFilter === "all" ? "bg-muted hover:bg-muted" : "border-border"}
              data-testid="button-filter-all"
            >
              All
            </Button>
          </div>
        </div>

        {approvalType === "aif" ? (
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-muted-foreground">Loading AIF holdings...</span>
            </div>
          ) : filteredAIF.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LucideShield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No {statusFilter === 'all' ? '' : statusFilter} AIF entries found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="text-foreground font-semibold">Client</TableHead>
                    <TableHead className="text-foreground font-semibold">Scheme</TableHead>
                    <TableHead className="text-foreground font-semibold">AMC</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Commitment</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Called</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Current Value</TableHead>
                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAIF.map((holding) => (
                    <TableRow key={holding.id} className="border-border hover:bg-muted/20" data-testid={`row-aif-${holding.id}`}>
                      <TableCell className="text-foreground">
                        <div>
                          <p className="font-medium">{holding.client?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{holding.client?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{holding.schemeName}</TableCell>
                      <TableCell className="text-foreground">{holding.amcName}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.commitmentAmount)}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.capitalCalled)}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.currentValue)}</TableCell>
                      <TableCell>
                        <Badge className={
                          holding.entryStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                          holding.entryStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }>
                          {holding.entryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {holding.entryStatus === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 text-green-400 hover:bg-green-600/20"
                              onClick={() => approveMutation.mutate({ type: 'aif', id: holding.id, action: 'approve' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-aif-${holding.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-400 hover:bg-red-600/20"
                              onClick={() => approveMutation.mutate({ type: 'aif', id: holding.id, action: 'reject' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-reject-aif-${holding.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )
        ) : approvalType === "pms" ? (
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="ml-2 text-muted-foreground">Loading PMS holdings...</span>
            </div>
          ) : filteredPMS.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LucideShield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No {statusFilter === 'all' ? '' : statusFilter} PMS entries found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="text-foreground font-semibold">Client</TableHead>
                    <TableHead className="text-foreground font-semibold">Scheme</TableHead>
                    <TableHead className="text-foreground font-semibold">AMC</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Total Invested</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Corpus Value</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">CAGR</TableHead>
                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPMS.map((holding) => (
                    <TableRow key={holding.id} className="border-border hover:bg-muted/20" data-testid={`row-pms-${holding.id}`}>
                      <TableCell className="text-foreground">
                        <div>
                          <p className="font-medium">{holding.client?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{holding.client?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{holding.schemeName}</TableCell>
                      <TableCell className="text-foreground">{holding.amcName}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.totalInvested)}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.corpusValue)}</TableCell>
                      <TableCell className="text-right">
                        <span className={parseFloat(holding.cagr || '0') >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {holding.cagr ? `${parseFloat(holding.cagr).toFixed(2)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          holding.entryStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                          holding.entryStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }>
                          {holding.entryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {holding.entryStatus === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 text-green-400 hover:bg-green-600/20"
                              onClick={() => approveMutation.mutate({ type: 'pms', id: holding.id, action: 'approve' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-pms-${holding.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-400 hover:bg-red-600/20"
                              onClick={() => approveMutation.mutate({ type: 'pms', id: holding.id, action: 'reject' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-reject-pms-${holding.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )
        ) : approvalType === "mld" ? (
          isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              <span className="ml-2 text-muted-foreground">Loading MLD holdings...</span>
            </div>
          ) : filteredMLD.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LucideShield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No {statusFilter === 'all' ? '' : statusFilter} MLD entries found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30">
                    <TableHead className="text-foreground font-semibold">Client</TableHead>
                    <TableHead className="text-foreground font-semibold">MLD Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Issuer</TableHead>
                    <TableHead className="text-foreground font-semibold">Payoff Type</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Quantity</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Total Invested</TableHead>
                    <TableHead className="text-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMLD.map((holding) => (
                    <TableRow key={holding.id} className="border-border hover:bg-muted/20" data-testid={`row-mld-${holding.id}`}>
                      <TableCell className="text-foreground">
                        <div>
                          <p className="font-medium">{holding.client?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{holding.client?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{holding.mldName}</TableCell>
                      <TableCell className="text-foreground">{holding.issuer || '-'}</TableCell>
                      <TableCell>
                        <Badge className="bg-teal-500/20 text-teal-400">
                          {holding.payoffType || 'Digital'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-foreground">{holding.quantity}</TableCell>
                      <TableCell className="text-right text-foreground">{formatCurrency(holding.totalInvested)}</TableCell>
                      <TableCell>
                        <Badge className={
                          holding.entryStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                          holding.entryStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }>
                          {holding.entryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {holding.entryStatus === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 text-green-400 hover:bg-green-600/20"
                              onClick={() => approveMutation.mutate({ type: 'mld', id: holding.id, action: 'approve' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-mld-${holding.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-400 hover:bg-red-600/20"
                              onClick={() => approveMutation.mutate({ type: 'mld', id: holding.id, action: 'reject' })}
                              disabled={approveMutation.isPending}
                              data-testid={`button-reject-mld-${holding.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function StoreManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hierarchy");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'category' | 'subcategory' | 'product';
    item: any;
    action: 'enable' | 'disable';
  } | null>(null);

  // Fetch categories with subcategories
  const { data: categoriesData, isLoading: isLoadingCategories, isError: isCategoriesError, error: categoriesError, refetch: refetchCategories } = useQuery<{ categories: Category[] }>({
    queryKey: ['/api/admin/store/categories'],
  });

  // Debug: Log categories data
  console.log('[StoreManagement] Categories data:', categoriesData, 'isLoading:', isLoadingCategories, 'isError:', isCategoriesError, 'error:', categoriesError);

  // Fetch all products
  const { data: productsData, isLoading: isLoadingProducts, isError: isProductsError } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/admin/store/products'],
  });

  // Fetch audit logs
  const { data: auditLogsData, isLoading: isLoadingAuditLogs } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ['/api/admin/store/audit-logs'],
  });

  const categories: Category[] = categoriesData?.categories || [];
  const products: Product[] = productsData?.products || [];
  const auditLogs: AuditLog[] = auditLogsData?.logs || [];

  // Toggle category with cascade
  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/categories/${id}/toggle`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Category Updated",
        description: data?.message || "Category and all children updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  // Toggle subcategory with cascade
  const toggleSubcategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/subcategories/${id}/toggle`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Subcategory Updated",
        description: data?.message || "Subcategory and products updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory",
        variant: "destructive",
      });
    },
  });

  // Toggle single product
  const toggleProductMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/products/${id}/toggle`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Product Updated",
        description: "Product visibility updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const toggleExpanded = (type: 'category' | 'subcategory', id: string) => {
    if (type === 'category') {
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } else {
      setExpandedSubcategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }
  };

  const handleToggle = (type: 'category' | 'subcategory' | 'product', item: any, newState: boolean) => {
    // For disabling, show confirmation dialog
    if (!newState && (type === 'category' || type === 'subcategory')) {
      setConfirmDialog({
        open: true,
        type,
        item,
        action: 'disable',
      });
    } else if (newState && (type === 'category' || type === 'subcategory')) {
      // For enabling categories/subcategories, show confirmation too
      setConfirmDialog({
        open: true,
        type,
        item,
        action: 'enable',
      });
    } else {
      // For products, toggle directly
      toggleProductMutation.mutate({ id: item.id, isActive: newState });
    }
  };

  const confirmToggle = () => {
    if (!confirmDialog) return;
    
    const isActive = confirmDialog.action === 'enable';
    
    if (confirmDialog.type === 'category') {
      toggleCategoryMutation.mutate({ id: confirmDialog.item.id, isActive });
    } else if (confirmDialog.type === 'subcategory') {
      toggleSubcategoryMutation.mutate({ id: confirmDialog.item.id, isActive });
    }
  };

  const getProductsForSubcategory = (subcategoryId: string) => {
    return products.filter(p => p.subcategoryId === subcategoryId);
  };

  const getProductsForCategoryDirectly = (categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId && !p.subcategoryId);
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'toggle': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cascade_toggle': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'create': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'update': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'delete': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted/20 text-muted-foreground border-border';
    }
  };

  // SEBI Licensing badges for mutual fund categories
  const getLicenseBadge = (categoryId: string, categoryName: string) => {
    if (categoryId === 'cat-mutual-funds' || categoryName.includes('Regular Schemes')) {
      return {
        type: 'ARN',
        label: 'ARN Licensed',
        description: 'Distribution license active',
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: LucideShield,
        authorized: true
      };
    }
    if (categoryId === 'cat-mf-direct' || categoryName.includes('Direct Schemes')) {
      return {
        type: 'RIA',
        label: 'RIA Required',
        description: 'Advisory license pending',
        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: ShieldAlert,
        authorized: false
      };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-store-management">Store Management</h1>
          <p className="text-muted-foreground mt-1">Control product and category visibility across all portals</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchCategories()}
          className="border-border hover:bg-muted"
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-card border-border">
          <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">
            <FolderTree className="w-4 h-4 mr-2" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="w-4 h-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="portfolio-approvals" data-testid="tab-portfolio-approvals">
            <LucideShield className="w-4 h-4 mr-2" />
            Portfolio Approvals
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Hierarchy Tab - Category/Subcategory/Product Tree */}
        <TabsContent value="hierarchy">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center justify-between">
                <span>Category Hierarchy</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-400 border-blue-400">
                    {categories.length} Categories
                  </Badge>
                  <Badge variant="outline" className="text-purple-400 border-purple-400">
                    {products.length} Products
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your store hierarchy. Disabling a category will cascade to all subcategories and products.
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-border text-foreground"
                  data-testid="input-search-hierarchy"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCategories || isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="ml-2 text-muted-foreground">Loading hierarchy...</span>
                </div>
              ) : isCategoriesError ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="text-red-400 font-medium">Failed to load categories</p>
                  <p className="text-sm mt-2">{(categoriesError as any)?.message || 'An error occurred while fetching categories'}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => refetchCategories()} 
                    className="mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderTree className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No categories found</p>
                  <p className="text-sm mt-2">Create categories to organize your store products</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {filteredCategories.map((category) => (
                      <div key={category.id} className="border border-border rounded-lg overflow-hidden">
                        {/* Category Row */}
                        <div 
                          className="flex items-center justify-between p-4 bg-muted/50"
                          data-testid={`row-category-${category.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleExpanded('category', category.id)}
                              className="p-1 hover:bg-muted rounded"
                              data-testid={`expand-category-${category.id}`}
                            >
                              {expandedCategories.has(category.id) ? (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex items-center gap-2">
                              <FolderTree className="w-5 h-5 text-blue-400" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">
                                    {category.name}
                                  </p>
                                  {/* SEBI Licensing Badge */}
                                  {(() => {
                                    const licenseBadge = getLicenseBadge(category.id, category.name);
                                    if (licenseBadge) {
                                      const IconComponent = licenseBadge.icon;
                                      return (
                                        <Badge 
                                          className={`text-xs ${licenseBadge.color}`}
                                          title={licenseBadge.description}
                                        >
                                          <IconComponent className="w-3 h-3 mr-1" />
                                          {licenseBadge.label}
                                        </Badge>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                {category.description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-md">
                                    {category.description}
                                  </p>
                                )}
                                {/* RIA Warning for Direct Schemes */}
                                {(category.id === 'cat-mf-direct' || category.name.includes('Direct Schemes')) && (
                                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3" />
                                    Enable when RIA authorization is obtained. Requires client advisory subscription.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="hidden md:flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-xs whitespace-nowrap text-muted-foreground border-border">
                                {(category.subcategories || []).length} subs
                              </Badge>
                              <Badge variant="outline" className="text-xs whitespace-nowrap text-muted-foreground border-border">
                                {getProductsForCategoryDirectly(category.id).length + 
                                  (category.subcategories || []).reduce((acc, sub) => 
                                    acc + getProductsForSubcategory(sub.id).length, 0
                                  )} items
                              </Badge>
                            </div>
                            <Badge
                              className={`whitespace-nowrap flex-shrink-0 ${category.isActive 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
                            >
                              {category.isActive ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                              {category.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                            {/* Seed button for all categories */}
                            {(() => {
                              const getSeedRoute = (cat: Category) => {
                                const slug = cat.slug || cat.id;
                                if (slug === 'unlisted' || slug === 'unlisted-stocks' || cat.name === 'Unlisted Shares') {
                                  return '/admin/unlisted/seed';
                                }
                                if (slug === 'fixed-income' || cat.name === 'Fixed Income') {
                                  return '/admin/bond-seed';
                                }
                                if (slug === 'mf-regular' || slug === 'mf-direct' || cat.name.includes('Mutual Funds')) {
                                  return '/admin/mutual-funds';
                                }
                                if (slug === 'mld' || slug === 'structured-products' || cat.name.includes('MLD') || cat.name.includes('Market Linked')) {
                                  return '/admin/mld-seed';
                                }
                                if (slug === 'stocks' || slug === 'listed-stocks' || slug === 'equities' || cat.name.includes('Listed Stocks') || cat.name.includes('Equities')) {
                                  return '/admin/listed-stocks-seed';
                                }
                                if (slug === 'global-markets' || slug === 'global' || slug === 'global-stocks' || slug === 'international' || cat.name.includes('Global Markets') || cat.name.includes('International')) {
                                  return '/admin/global-seed';
                                }
                                if (slug === 'reits' || slug === 'invits' || slug === 'reits-invits' || slug === 'real-estate' || cat.name.includes('REIT') || cat.name.includes('InvIT') || cat.name.includes('Real Estate')) {
                                  return '/admin/reits-invits-seed';
                                }
                                if (slug === 'tax' || cat.name.includes('Tax Services')) {
                                  return '/admin/store/seed/services';
                                }
                                return `/admin/store/seed/${slug}`;
                              };
                              
                              const getSubcategorySeedRoute = (sub: Subcategory) => {
                                const slug = sub.slug || sub.id;
                                if (slug === 'us-market' || sub.name.includes('US Market')) {
                                  return '/admin/global-seed?market=US';
                                }
                                if (slug === 'uk-europe-market' || sub.name.includes('UK') || sub.name.includes('Europe')) {
                                  return '/admin/global-seed?market=UK';
                                }
                                if (slug === 'japan-market' || sub.name.includes('Japan')) {
                                  return '/admin/global-seed?market=JP';
                                }
                                if (slug === 'china-hk-market' || sub.name.includes('China') || sub.name.includes('Hong Kong')) {
                                  return '/admin/global-seed?market=HK';
                                }
                                if (slug === 'other-markets' || sub.name.includes('Other')) {
                                  return '/admin/global-seed?market=SG';
                                }
                                return null;
                              };
                              return (
                                <Link href={getSeedRoute(category)}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
                                    data-testid={`button-seed-${category.slug || category.id}`}
                                  >
                                    <Sprout className="w-4 h-4 mr-1" />
                                    Seed
                                  </Button>
                                </Link>
                              );
                            })()}
                            <Switch
                              checked={category.isActive}
                              onCheckedChange={(checked) => handleToggle('category', category, checked)}
                              disabled={toggleCategoryMutation.isPending}
                              data-testid={`toggle-category-${category.id}`}
                            />
                          </div>
                        </div>

                        {/* Expanded Category Content */}
                        {expandedCategories.has(category.id) && (
                          <div className="border-t border-border bg-card/30">
                            {/* Subcategories */}
                            {(category.subcategories || []).map((subcategory) => (
                              <div key={subcategory.id}>
                                <div 
                                  className="flex items-center justify-between p-3 pl-12 border-b border-border/50 bg-muted/30"
                                  data-testid={`row-subcategory-${subcategory.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => toggleExpanded('subcategory', subcategory.id)}
                                      className="p-1 hover:bg-muted rounded"
                                      data-testid={`expand-subcategory-${subcategory.id}`}
                                    >
                                      {expandedSubcategories.has(subcategory.id) ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </button>
                                    <div className="flex items-center gap-2">
                                      <FolderTree className="w-4 h-4 text-purple-400" />
                                      <span className="text-foreground">
                                        {subcategory.name}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <Badge variant="outline" className="text-xs">
                                      {getProductsForSubcategory(subcategory.id).length} products
                                    </Badge>
                                    {!category.isActive && (
                                      <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                        Parent Disabled
                                      </Badge>
                                    )}
                                    {/* Seed button for global market subcategories */}
                                    {(category.slug === 'global-markets' || category.name.includes('Global Markets')) && (() => {
                                      const getMarketCode = (sub: Subcategory) => {
                                        const slug = sub.slug || sub.id;
                                        if (slug === 'us-market' || sub.name.includes('US')) return 'US';
                                        if (slug === 'uk-europe-market' || sub.name.includes('UK') || sub.name.includes('Europe')) return 'EU';
                                        if (slug === 'japan-market' || sub.name.includes('Japan')) return 'JP';
                                        if (slug === 'china-hk-market' || sub.name.includes('China') || sub.name.includes('Hong Kong')) return 'CN';
                                        if (slug === 'other-markets') return 'SG';
                                        return null;
                                      };
                                      const marketCode = getMarketCode(subcategory);
                                      if (marketCode) {
                                        return (
                                          <Link href={`/admin/global-seed?market=${marketCode}`}>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
                                              data-testid={`button-seed-${subcategory.slug || subcategory.id}`}
                                            >
                                              <Sprout className="w-3 h-3 mr-1" />
                                              Seed
                                            </Button>
                                          </Link>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <Switch
                                      checked={subcategory.isActive}
                                      onCheckedChange={(checked) => handleToggle('subcategory', subcategory, checked)}
                                      disabled={!category.isActive || toggleSubcategoryMutation.isPending}
                                      data-testid={`toggle-subcategory-${subcategory.id}`}
                                    />
                                  </div>
                                </div>

                                {/* Products in Subcategory */}
                                {expandedSubcategories.has(subcategory.id) && (
                                  <div className="pl-20 py-2 space-y-1">
                                    {getProductsForSubcategory(subcategory.id).map((product) => (
                                      <div 
                                        key={product.id}
                                        className="flex items-center justify-between p-2 rounded bg-muted/20"
                                        data-testid={`row-product-${product.id}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Package className="w-3 h-3 text-green-400" />
                                          <span className="text-sm text-foreground">
                                            {product.name}
                                          </span>
                                          {product.productType && (
                                            <Badge variant="outline" className="text-xs">
                                              {product.productType}
                                            </Badge>
                                          )}
                                          {product.planType && (
                                            <Badge 
                                              className={`text-xs ${
                                                product.planType === 'direct' 
                                                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                                                  : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                              }`}
                                            >
                                              {product.planType === 'direct' ? 'Direct' : 'Regular'}
                                            </Badge>
                                          )}
                                          {product.expenseRatio && (
                                            <span className="text-xs text-muted-foreground">
                                              TER: {(parseFloat(product.expenseRatio) * 100).toFixed(2)}%
                                            </span>
                                          )}
                                          {product.trailCommission && (
                                            <span className="text-xs text-yellow-400 font-medium" title="SEBI Disclosure: This Regular plan includes distributor commission">
                                              Trail: {(parseFloat(product.trailCommission) * 100).toFixed(2)}%
                                            </span>
                                          )}
                                          {product.planType === 'regular' && (
                                            <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30" title="SEBI Regulation: Commission is paid by AMC to distributor">
                                              SEBI Disclosed
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {(!category.isActive || !subcategory.isActive) && (
                                            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                              Parent Disabled
                                            </Badge>
                                          )}
                                          <Switch
                                            checked={product.isActive}
                                            onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                            disabled={!category.isActive || !subcategory.isActive || toggleProductMutation.isPending}
                                            data-testid={`toggle-product-${product.id}`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                    {getProductsForSubcategory(subcategory.id).length === 0 && (
                                      <p className="text-xs text-muted-foreground py-2">No products in this subcategory</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Direct Products (no subcategory) */}
                            {getProductsForCategoryDirectly(category.id).length > 0 && (
                              <div className="border-t border-border/50 pl-12 py-2">
                                <p className="text-xs text-muted-foreground mb-2 px-3">Direct Products (no subcategory)</p>
                                {getProductsForCategoryDirectly(category.id).map((product) => (
                                  <div 
                                    key={product.id}
                                    className={`flex items-center justify-between p-2 px-3 rounded ${
                                      product.isActive && category.isActive 
                                        ? 'bg-muted/20' 
                                        : 'bg-card/30'
                                    }`}
                                    data-testid={`row-product-${product.id}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3 h-3 text-green-400" />
                                      <span className="text-sm text-foreground">
                                        {product.name}
                                      </span>
                                    </div>
                                    <Switch
                                      checked={product.isActive}
                                      onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                      disabled={!category.isActive || toggleProductMutation.isPending}
                                      data-testid={`toggle-product-${product.id}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {(category.subcategories || []).length === 0 && 
                              getProductsForCategoryDirectly(category.id).length === 0 && (
                              <p className="text-muted-foreground text-center py-4">
                                No subcategories or products in this category
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab - Flat List */}
        <TabsContent value="products">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center justify-between">
                <span>All Products</span>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  {products.filter(p => p.isActive).length} / {products.length} Active
                </Badge>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                View and manage all products across all categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                  <span className="ml-2 text-muted-foreground">Loading products...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border bg-muted/30">
                        <TableHead className="text-foreground font-semibold">Product</TableHead>
                        <TableHead className="text-foreground font-semibold">Type</TableHead>
                        <TableHead className="text-foreground font-semibold">Plan</TableHead>
                        <TableHead className="text-foreground font-semibold">Category</TableHead>
                        <TableHead className="text-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-foreground font-semibold text-right">Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const category = categories.find(c => c.id === product.categoryId);
                        const subcategory = category?.subcategories?.find(s => s.id === product.subcategoryId);
                        const isParentDisabled = !category?.isActive || (subcategory && !subcategory.isActive);
                        
                        return (
                          <TableRow 
                            key={product.id} 
                            className="border-border hover:bg-muted/20"
                            data-testid={`row-product-${product.id}`}
                          >
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <Package className={`w-4 h-4 ${product.isActive ? 'text-green-400' : 'text-muted-foreground'}`} />
                                {product.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs text-foreground border-border">
                                {product.productType || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {product.planType ? (
                                <div className="flex flex-col gap-1">
                                  <Badge 
                                    className={`text-xs font-medium ${
                                      product.planType === 'direct' 
                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
                                        : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                    }`}
                                  >
                                    {product.planType === 'direct' ? 'Direct' : 'Regular'}
                                  </Badge>
                                  {product.expenseRatio && (
                                    <span className="text-xs text-muted-foreground">
                                      TER: {(parseFloat(product.expenseRatio) * 100).toFixed(2)}%
                                    </span>
                                  )}
                                  {product.trailCommission && (
                                    <span className="text-xs text-yellow-400 font-medium" title="SEBI Disclosure: Distributor commission included">
                                      Trail: {(parseFloat(product.trailCommission) * 100).toFixed(2)}%
                                    </span>
                                  )}
                                  {product.planType === 'regular' && (
                                    <Badge variant="outline" className="text-xs text-amber-300 border-amber-500/40 font-medium" title="Commission paid by AMC to distributor as per SEBI regulations">
                                      SEBI Disclosed
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-foreground">
                              <div className="flex flex-col">
                                <span>{category?.name || 'Unknown'}</span>
                                {subcategory && (
                                  <span className="text-xs text-muted-foreground">→ {subcategory.name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={product.isActive 
                                    ? 'bg-green-500/20 text-green-300 font-medium' 
                                    : 'bg-red-500/20 text-red-300 font-medium'}
                                >
                                  {product.isActive ? 'Active' : 'Disabled'}
                                </Badge>
                                {isParentDisabled && (
                                  <Badge variant="outline" className="text-xs text-yellow-300 border-yellow-500/40 font-medium">
                                    Parent Off
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={product.isActive}
                                onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                disabled={isParentDisabled || toggleProductMutation.isPending}
                                data-testid={`toggle-product-${product.id}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portfolio Approvals Tab - AIF/PMS Holdings */}
        <TabsContent value="portfolio-approvals">
          <PortfolioApprovalsTab />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center justify-between">
                <span>Audit Log</span>
                <Badge variant="outline" className="text-amber-400 border-amber-400">
                  {auditLogs.length} Records
                </Badge>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Track all store management changes for compliance (7-year retention)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAuditLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs yet</p>
                  <p className="text-sm mt-2">Changes to store items will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border bg-muted/30">
                        <TableHead className="text-foreground font-semibold">Timestamp</TableHead>
                        <TableHead className="text-foreground font-semibold">Admin</TableHead>
                        <TableHead className="text-foreground font-semibold">Action</TableHead>
                        <TableHead className="text-foreground font-semibold">Target</TableHead>
                        <TableHead className="text-foreground font-semibold">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="border-border hover:bg-muted/20"
                          data-testid={`row-audit-${log.id}`}
                        >
                          <TableCell className="text-foreground whitespace-nowrap">
                            {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {log.adminEmail}
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs text-foreground border-border">
                                {log.targetType}
                              </Badge>
                              <span className="text-foreground">{log.targetName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                                  <FileText className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-card border-border max-w-lg">
                                <DialogHeader>
                                  <DialogTitle className="text-foreground">Audit Log Details</DialogTitle>
                                  <DialogDescription className="text-muted-foreground">
                                    Change details for {log.targetName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-1">Before</p>
                                    <pre className="bg-muted p-3 rounded text-xs text-muted-foreground overflow-auto max-h-32">
                                      {JSON.stringify(log.beforeValue, null, 2) || 'N/A'}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-1">After</p>
                                    <pre className="bg-muted p-3 rounded text-xs text-muted-foreground overflow-auto max-h-32">
                                      {JSON.stringify(log.afterValue, null, 2) || 'N/A'}
                                    </pre>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Confirm {confirmDialog?.action === 'enable' ? 'Enable' : 'Disable'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                {confirmDialog?.action === 'disable' ? (
                  <>
                    <p>Disabling <strong className="text-foreground">{confirmDialog?.item?.name}</strong> will also disable:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {confirmDialog?.type === 'category' && (
                        <>
                          <li>All subcategories under this category</li>
                          <li>All products under this category and its subcategories</li>
                        </>
                      )}
                      {confirmDialog?.type === 'subcategory' && (
                        <li>All products under this subcategory</li>
                      )}
                    </ul>
                    <p className="mt-3 text-yellow-400">Customers will see an inquiry form instead of these items.</p>
                  </>
                ) : (
                  <>
                    <p>Enabling <strong className="text-foreground">{confirmDialog?.item?.name}</strong> will make it visible to customers.</p>
                    {confirmDialog?.type === 'category' && (
                      <p className="mt-2">Note: Subcategories and products will need to be enabled individually.</p>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmToggle}
              className={confirmDialog?.action === 'disable' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'}
              disabled={toggleCategoryMutation.isPending || toggleSubcategoryMutation.isPending}
            >
              {(toggleCategoryMutation.isPending || toggleSubcategoryMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {confirmDialog?.action === 'enable' ? 'Enable' : 'Disable'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
