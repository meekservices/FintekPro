import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Search, RefreshCw, ArrowLeft, Plus, Loader2, TrendingUp, BarChart3, History, Activity, Download, CheckCircle, XCircle, AlertCircle, Trash2, CheckSquare, IndianRupee, Power, Upload, ArrowRightCircle, FileSpreadsheet } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { UnlistedCompany, CompanyFinancials, CompanyRatios, UnlistedPriceHistory } from '@shared/schema';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface CredhiveSearchResult {
  company_id: string;
  name: string;
  cin: string;
  roc_state?: string;
  incorporation_date?: string;
  status?: string;
}

export default function UnlistedCompaniesAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCredhiveDialogOpen, setIsCredhiveDialogOpen] = useState(false);
  const [credhiveSearchQuery, setCredhiveSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('companies');
  const [isMoneyControlDialogOpen, setIsMoneyControlDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNSDLDialogOpen, setIsNSDLDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [isListingTransitionDialogOpen, setIsListingTransitionDialogOpen] = useState(false);

  // Check admin access
  if (authLoading) {
    return <LoadingState />;
  }

  if (!user || !user.roles?.includes('admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="bg-card border-border max-w-md">
          <CardHeader>
            <CardTitle className="text-foreground text-center">Access Denied</CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              You do not have permission to access this page. Admin privileges required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (selectedCompanyId) {
    return <CompanyDetailsView companyId={selectedCompanyId} onBack={() => setSelectedCompanyId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Unlisted Marketplace Management</h1>
          <p className="text-muted-foreground mt-1">Manage companies, listings, and buy requests</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkImportDialogOpen} onOpenChange={setIsBulkImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20" data-testid="button-bulk-import">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-card border-border">
              <BulkImportDialog onClose={() => setIsBulkImportDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isListingTransitionDialogOpen} onOpenChange={setIsListingTransitionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-amber-600 text-amber-400 hover:bg-amber-600/20" data-testid="button-listing-transition">
                <ArrowRightCircle className="w-4 h-4 mr-2" />
                Listing Transition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
              <ListingTransitionDialog onClose={() => setIsListingTransitionDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isNSDLDialogOpen} onOpenChange={setIsNSDLDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-600/20" data-testid="button-nsdl-isin-search">
                <Search className="w-4 h-4 mr-2" />
                Find ISIN
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
              <NSDLISINSearchDialog onClose={() => setIsNSDLDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isMoneyControlDialogOpen} onOpenChange={setIsMoneyControlDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-600 text-green-400 hover:bg-green-600/20" data-testid="button-moneycontrol-import">
                <Download className="w-4 h-4 mr-2" />
                Import Prices
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-card border-border">
              <MoneyControlImportDialog onClose={() => setIsMoneyControlDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20" data-testid="button-delete-company">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Company
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-border">
              <DeleteCompanyDialog onClose={() => setIsDeleteDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isCredhiveDialogOpen} onOpenChange={setIsCredhiveDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-company">
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-card border-border">
              <CredhiveSearchDialog onClose={() => setIsCredhiveDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted border-border">
          <TabsTrigger value="companies" className="data-[state=active]:bg-blue-600">
            <Building2 className="w-4 h-4 mr-2" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="listings" className="data-[state=active]:bg-blue-600">
            <TrendingUp className="w-4 h-4 mr-2" />
            Sell Listings
          </TabsTrigger>
          <TabsTrigger value="buy-requests" className="data-[state=active]:bg-blue-600">
            <BarChart3 className="w-4 h-4 mr-2" />
            Buy Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <CompanyListView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sectorFilter={sectorFilter}
            setSectorFilter={setSectorFilter}
            onSelectCompany={setSelectedCompanyId}
          />
        </TabsContent>

        <TabsContent value="listings">
          <AllListingsView />
        </TabsContent>

        <TabsContent value="buy-requests">
          <AllBuyRequestsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyListView({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sectorFilter,
  setSectorFilter,
  onSelectCompany,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  sectorFilter: string;
  setSectorFilter: (s: string) => void;
  onSelectCompany: (id: string) => void;
}) {
  const { toast } = useToast();
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [isBulkPriceDialogOpen, setIsBulkPriceDialogOpen] = useState(false);
  const [bulkPriceValue, setBulkPriceValue] = useState('');
  const [bulkPricePercentage, setBulkPricePercentage] = useState('');
  const [bulkPriceMode, setBulkPriceMode] = useState<'fixed' | 'percentage'>('percentage');

  // Fetch companies with filters (admin endpoint - no KYC requirement)
  const { data: companies, isLoading } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/admin/companies', { status: statusFilter !== 'all' ? statusFilter : undefined, sector: sectorFilter !== 'all' ? sectorFilter : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (sectorFilter !== 'all') params.append('sector', sectorFilter);
      
      const response = await fetch(`/api/unlisted/admin/companies?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
  });

  // Sync mutation with per-company loading state
  const syncMutation = useMutation({
    mutationFn: async (companyId: string) => {
      setSyncingCompanyId(companyId);
      return apiRequest(`/api/unlisted/credhive/sync/${companyId}`, { method: 'POST' });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      
      // Show detailed sync result including ISIN info
      let message = result?.data?.message || 'Sync completed';
      const isinInfo = result?.data?.isin;
      if (isinInfo?.autoPopulated && isinInfo?.source) {
        const sourceLabel = isinInfo.source === 'moneycontrol' ? 'MoneyControl' : 'NSDL';
        message = `${message}. ISIN auto-populated from ${sourceLabel} (${Math.round(isinInfo.matchScore)}% match)`;
      }
      
      toast({ 
        title: 'Company synced successfully', 
        description: message
      });
      setSyncingCompanyId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync company data',
        variant: 'destructive'
      });
      setSyncingCompanyId(null);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest(`/api/unlisted/companies/${companyId}`, { method: 'DELETE' });
    },
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({ title: 'Company deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete company',
        variant: 'destructive'
      });
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ companyId, status }: { companyId: string; status: string }) => {
      setUpdatingStatusId(companyId);
      return apiRequest(`/api/unlisted/companies/${companyId}`, { 
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({ title: 'Status updated', description: `Company status changed to ${status}` });
      setUpdatingStatusId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update status',
        variant: 'destructive'
      });
      setUpdatingStatusId(null);
    }
  });

  // Bulk sync mutation
  const bulkSyncMutation = useMutation({
    mutationFn: async ({ onlyUnsynced }: { onlyUnsynced: boolean }) => {
      setIsBulkSyncing(true);
      return apiRequest('/api/unlisted/credhive/sync-all', { 
        method: 'POST',
        body: JSON.stringify({ onlyUnsynced })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({ 
        title: 'Bulk Sync Complete', 
        description: data.message || `Synced ${data.successCount} companies` 
      });
      setIsBulkSyncing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk sync failed',
        description: error.message || 'Failed to sync companies',
        variant: 'destructive'
      });
      setIsBulkSyncing(false);
    }
  });

  // Update listing stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ companyId, listingStage }: { companyId: string; listingStage: string }) => {
      setUpdatingStageId(companyId);
      return apiRequest(`/api/unlisted/companies/${companyId}`, { 
        method: 'PATCH',
        body: JSON.stringify({ listingStage })
      });
    },
    onSuccess: (_, { listingStage }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      const stageLabels: Record<string, string> = {
        unlisted: 'Unlisted',
        pre_ipo: 'Pre-IPO',
        growth: 'Growth',
        mature: 'Mature'
      };
      toast({ title: 'Stage updated', description: `Company stage changed to ${stageLabels[listingStage] || listingStage}` });
      setUpdatingStageId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update stage',
        variant: 'destructive'
      });
      setUpdatingStageId(null);
    }
  });

  // Bulk status update mutation (publish/suspend)
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ companyIds, status }: { companyIds: string[]; status: string }) => {
      return apiRequest('/api/unlisted/admin/bulk-status', { 
        method: 'POST',
        body: JSON.stringify({ companyIds, status })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      setSelectedCompanyIds(new Set());
      toast({ 
        title: 'Bulk status update complete', 
        description: data.data?.message || `Updated ${data.data?.successCount || 0} companies` 
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk update failed',
        description: error.message || 'Failed to update companies',
        variant: 'destructive'
      });
    }
  });

  // Bulk price update mutation
  const bulkPriceMutation = useMutation({
    mutationFn: async ({ companyIds, priceChange }: { companyIds: string[]; priceChange: { mode: 'fixed' | 'percentage'; value: number } }) => {
      return apiRequest('/api/unlisted/admin/bulk-price', { 
        method: 'POST',
        body: JSON.stringify({ companyIds, priceChange })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      setSelectedCompanyIds(new Set());
      setIsBulkPriceDialogOpen(false);
      setBulkPriceValue('');
      setBulkPricePercentage('');
      toast({ 
        title: 'Bulk price update complete', 
        description: data.data?.message || `Updated prices for ${data.data?.successCount || 0} companies` 
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk price update failed',
        description: error.message || 'Failed to update prices',
        variant: 'destructive'
      });
    }
  });

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedCompanyIds.size === filteredCompanies.length) {
      setSelectedCompanyIds(new Set());
    } else {
      setSelectedCompanyIds(new Set(filteredCompanies.map(c => c.id)));
    }
  };

  const toggleSelectCompany = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedCompanyIds);
    if (newSelection.has(companyId)) {
      newSelection.delete(companyId);
    } else {
      newSelection.add(companyId);
    }
    setSelectedCompanyIds(newSelection);
  };

  const handleBulkPriceSubmit = () => {
    const value = bulkPriceMode === 'fixed' 
      ? parseFloat(bulkPriceValue)
      : parseFloat(bulkPricePercentage);
    
    if (isNaN(value)) {
      toast({ title: 'Invalid value', description: 'Please enter a valid number', variant: 'destructive' });
      return;
    }

    bulkPriceMutation.mutate({
      companyIds: Array.from(selectedCompanyIds),
      priceChange: { mode: bulkPriceMode, value }
    });
  };

  // Filter companies by search query
  const filteredCompanies = companies?.filter(company => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return company.name.toLowerCase().includes(query) || 
           company.cin?.toLowerCase().includes(query);
  }) || [];

  // Get unique sectors for filter
  const sectors = Array.from(new Set(companies?.map(c => c.sector).filter(Boolean))) as string[];

  if (isLoading) {
    return <LoadingState variant="table" />;
  }

  return (
    <>
      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name or CIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted border-border text-foreground"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="delisted">Delisted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-sector-filter">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedCompanyIds.size > 0 && (
        <Card className="bg-blue-950 border-blue-800">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-400" />
                <span className="text-foreground font-medium">{selectedCompanyIds.size} companies selected</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkStatusMutation.mutate({ companyIds: Array.from(selectedCompanyIds), status: 'active' })}
                  disabled={bulkStatusMutation.isPending}
                  className="border-green-600 text-green-400 hover:bg-green-600/20"
                  data-testid="button-bulk-publish"
                >
                  {bulkStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Publish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkStatusMutation.mutate({ companyIds: Array.from(selectedCompanyIds), status: 'inactive' })}
                  disabled={bulkStatusMutation.isPending}
                  className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                  data-testid="button-bulk-suspend"
                >
                  {bulkStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Power className="w-4 h-4 mr-2" />}
                  Suspend
                </Button>
                <Dialog open={isBulkPriceDialogOpen} onOpenChange={setIsBulkPriceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                      data-testid="button-bulk-price"
                    >
                      <IndianRupee className="w-4 h-4 mr-2" />
                      Batch Price Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Batch Price Update</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Update prices for {selectedCompanyIds.size} selected companies
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant={bulkPriceMode === 'percentage' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBulkPriceMode('percentage')}
                          className={bulkPriceMode === 'percentage' ? 'bg-blue-600' : ''}
                        >
                          Percentage Change
                        </Button>
                        <Button
                          variant={bulkPriceMode === 'fixed' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBulkPriceMode('fixed')}
                          className={bulkPriceMode === 'fixed' ? 'bg-blue-600' : ''}
                        >
                          Fixed Price
                        </Button>
                      </div>
                      {bulkPriceMode === 'percentage' ? (
                        <div>
                          <Label className="text-muted-foreground">Percentage Change (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5 for +5%, -10 for -10%"
                            value={bulkPricePercentage}
                            onChange={(e) => setBulkPricePercentage(e.target.value)}
                            className="bg-muted border-border text-foreground"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Use positive values for increase, negative for decrease</p>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-muted-foreground">New Fixed Price (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter new price"
                            value={bulkPriceValue}
                            onChange={(e) => setBulkPriceValue(e.target.value)}
                            className="bg-muted border-border text-foreground"
                          />
                        </div>
                      )}
                      <Button
                        onClick={handleBulkPriceSubmit}
                        disabled={bulkPriceMutation.isPending}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {bulkPriceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Apply Price Update
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCompanyIds(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies Table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Companies ({filteredCompanies.length})</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select companies for bulk actions or click to view details
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkSyncMutation.mutate({ onlyUnsynced: true })}
              disabled={isBulkSyncing}
              className="bg-muted border-border text-foreground hover:bg-muted"
              data-testid="button-sync-unsynced"
            >
              {isBulkSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Unsynced
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => bulkSyncMutation.mutate({ onlyUnsynced: false })}
              disabled={isBulkSyncing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-sync-all"
            >
              {isBulkSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredCompanies.length > 0 && selectedCompanyIds.size === filteredCompanies.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-border"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="text-muted-foreground">Company Name</TableHead>
                  <TableHead className="text-muted-foreground">CIN</TableHead>
                  <TableHead className="text-muted-foreground">Sector</TableHead>
                  <TableHead className="text-muted-foreground">Stage</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Last Synced</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No companies found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow
                      key={company.id}
                      className={`border-border hover:bg-muted/50 cursor-pointer ${selectedCompanyIds.has(company.id) ? 'bg-blue-950/30' : ''}`}
                      onClick={() => onSelectCompany(company.id)}
                      data-testid={`row-company-${company.id}`}
                    >
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedCompanyIds.has(company.id)}
                          onCheckedChange={() => {
                            const newSelection = new Set(selectedCompanyIds);
                            if (newSelection.has(company.id)) {
                              newSelection.delete(company.id);
                            } else {
                              newSelection.add(company.id);
                            }
                            setSelectedCompanyIds(newSelection);
                          }}
                          className="border-border"
                          data-testid={`checkbox-company-${company.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground" data-testid={`text-name-${company.id}`}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground" data-testid={`text-cin-${company.id}`}>
                        {company.cin || 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-sector-${company.id}`}>
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={company.listingStage || 'unlisted'}
                          onValueChange={(value) => {
                            updateStageMutation.mutate({ companyId: company.id, listingStage: value });
                          }}
                          disabled={updatingStageId === company.id}
                        >
                          <SelectTrigger 
                            className={`w-28 h-8 text-xs border-0 ${
                              updatingStageId === company.id ? 'opacity-50' :
                              company.listingStage === 'pre_ipo' ? 'bg-blue-600/20 text-blue-400' :
                              company.listingStage === 'growth' ? 'bg-purple-600/20 text-purple-400' :
                              company.listingStage === 'mature' ? 'bg-cyan-600/20 text-cyan-400' :
                              'bg-muted/20 text-muted-foreground'
                            }`}
                            data-testid={`select-stage-${company.id}`}
                          >
                            {updatingStageId === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="unlisted" className="text-muted-foreground">Unlisted</SelectItem>
                            <SelectItem value="pre_ipo" className="text-blue-400">Pre-IPO</SelectItem>
                            <SelectItem value="growth" className="text-purple-400">Growth</SelectItem>
                            <SelectItem value="mature" className="text-cyan-400">Mature</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={company.status || 'active'}
                          onValueChange={(value) => {
                            updateStatusMutation.mutate({ companyId: company.id, status: value });
                          }}
                          disabled={updatingStatusId === company.id}
                        >
                          <SelectTrigger 
                            className={`w-28 h-8 text-xs border-0 ${
                              updatingStatusId === company.id ? 'opacity-50' :
                              company.status === 'active' ? 'bg-green-600/20 text-green-400' :
                              company.status === 'inactive' ? 'bg-yellow-600/20 text-yellow-400' :
                              company.status === 'delisted' ? 'bg-red-600/20 text-red-400' :
                              'bg-muted/20 text-muted-foreground'
                            }`}
                            data-testid={`select-status-${company.id}`}
                          >
                            {updatingStatusId === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="active" className="text-green-400">Active</SelectItem>
                            <SelectItem value="inactive" className="text-yellow-400">Inactive</SelectItem>
                            <SelectItem value="delisted" className="text-red-400">Delisted</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-lastSynced-${company.id}`}>
                        {company.lastSyncedAt ? format(new Date(company.lastSyncedAt), 'MMM dd, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!company.probe42CompanyId) {
                                toast({
                                  title: 'Cannot sync',
                                  description: 'This company has no Credhive ID. It may have been added manually.',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              syncMutation.mutate(company.id);
                            }}
                            disabled={syncingCompanyId === company.id}
                            className={company.probe42CompanyId ? 'text-blue-400 hover:text-blue-300' : 'text-muted-foreground'}
                            title={company.probe42CompanyId ? 'Sync from Credhive' : 'No Credhive ID available'}
                            data-testid={`button-sync-${company.id}`}
                          >
                            {syncingCompanyId === company.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                title="Delete company"
                                data-testid={`button-delete-${company.id}`}
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border" onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">Delete Company</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  Are you sure you want to delete <span className="font-semibold text-foreground">{company.name}</span>? 
                                  This will also delete all related financials, price history, listings, and buy requests. 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(company.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                  data-testid={`button-confirm-delete-${company.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ===================================================================
// ALL LISTINGS VIEW (Admin)
// ===================================================================
function AllListingsView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/unlisted/admin/all-listings', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/unlisted/admin/all-listings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch listings');
      const result = await response.json();
      return result.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/unlisted/admin/listings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/all-listings'] });
      toast({ title: 'Listing status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const listings = data?.listings || [];

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      cancelled: 'bg-muted',
      suspended: 'bg-yellow-500',
      expired: 'bg-red-500',
      completed: 'bg-blue-500',
    };
    return colors[status] || 'bg-muted';
  };

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-foreground">Sell Listings ({listings.length})</CardTitle>
            <CardDescription className="text-muted-foreground">Manage all sell listings across companies</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-muted border-border text-foreground">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Company</TableHead>
                <TableHead className="text-muted-foreground">Seller</TableHead>
                <TableHead className="text-muted-foreground">Quantity</TableHead>
                <TableHead className="text-muted-foreground">Ask Price</TableHead>
                <TableHead className="text-muted-foreground">Landing Price</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No sell listings found
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((listing: any) => (
                  <TableRow key={listing.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      <div>
                        <p>{listing.companyName}</p>
                        <p className="text-xs text-muted-foreground">{listing.companySector}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>
                        <p>{listing.sellerName}</p>
                        <p className="text-xs text-muted-foreground">{listing.sellerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{listing.quantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(listing.askPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(listing.landingPrice)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(listing.status)}>{listing.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {listing.createdAt ? format(new Date(listing.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={listing.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: listing.id, status: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-muted border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspend</SelectItem>
                          <SelectItem value="cancelled">Cancel</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================================================================
// ALL BUY REQUESTS VIEW (Admin)
// ===================================================================
function AllBuyRequestsView() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/unlisted/admin/all-buy-requests', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/unlisted/admin/all-buy-requests?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch buy requests');
      const result = await response.json();
      return result.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/unlisted/admin/buy-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/all-buy-requests'] });
      toast({ title: 'Buy request status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const buyRequests = data?.buyRequests || [];

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      cancelled: 'bg-muted',
      suspended: 'bg-yellow-500',
      expired: 'bg-red-500',
      matched: 'bg-blue-500',
    };
    return colors[status] || 'bg-muted';
  };

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-foreground">Buy Requests ({buyRequests.length})</CardTitle>
            <CardDescription className="text-muted-foreground">Manage all buy requests across companies</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-muted border-border text-foreground">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Company</TableHead>
                <TableHead className="text-muted-foreground">Buyer</TableHead>
                <TableHead className="text-muted-foreground">Quantity</TableHead>
                <TableHead className="text-muted-foreground">Max Price</TableHead>
                <TableHead className="text-muted-foreground">Target Price</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyRequests.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No buy requests found
                  </TableCell>
                </TableRow>
              ) : (
                buyRequests.map((request: any) => (
                  <TableRow key={request.id} className="border-border hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      <div>
                        <p>{request.companyName}</p>
                        <p className="text-xs text-muted-foreground">{request.companySector}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>
                        <p>{request.buyerName}</p>
                        <p className="text-xs text-muted-foreground">{request.buyerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{request.quantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(request.maxPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{request.targetPrice ? formatCurrency(request.targetPrice) : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(request.status)}>{request.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={request.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: request.id, status: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-muted border-border text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspend</SelectItem>
                          <SelectItem value="cancelled">Cancel</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface NSDLISINResult {
  isin: string;
  issuerName: string;
  securityDescription: string;
  securityType: 'equity' | 'debt' | 'preference' | 'warrant' | 'other';
  matchScore: number;
}

function NSDLISINSearchDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NSDLISINResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [securityType, setSecurityType] = useState<string>('equity');

  const handleSearch = async () => {
    if (searchQuery.length < 3) {
      toast({
        title: 'Query too short',
        description: 'Please enter at least 3 characters',
        variant: 'destructive'
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/unlisted/nsdl/search-isin?name=${encodeURIComponent(searchQuery)}&securityType=${securityType}&limit=15`
      );
      if (!response.ok) throw new Error('Search failed');
      const result = await response.json();
      setSearchResults(result.data?.results || []);
      
      if (result.data?.results?.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try a different company name or check the spelling',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Search failed',
        description: error.message || 'Failed to search ISIN',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (isin: string) => {
    navigator.clipboard.writeText(isin);
    toast({
      title: 'Copied!',
      description: `ISIN ${isin} copied to clipboard`,
    });
  };

  const getSecurityTypeBadge = (type: string) => {
    switch (type) {
      case 'equity': return 'bg-green-600/20 text-green-400 border-green-600';
      case 'debt': return 'bg-blue-600/20 text-blue-400 border-blue-600';
      case 'preference': return 'bg-purple-600/20 text-purple-400 border-purple-600';
      case 'warrant': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600';
      default: return 'bg-muted/20 text-muted-foreground border-border';
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground">Search ISIN from NSDL</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Enter the full company name to find the ISIN code from NSDL database
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter full company name (e.g., Reliance Industries Limited)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-muted border-border text-foreground"
            data-testid="input-nsdl-search"
          />
          <Select value={securityType} onValueChange={setSecurityType}>
            <SelectTrigger className="w-32 bg-muted border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="debt">Debt</SelectItem>
              <SelectItem value="preference">Preference</SelectItem>
              <SelectItem value="all">All Types</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={isSearching} data-testid="button-nsdl-search">
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">ISIN</TableHead>
                  <TableHead className="text-muted-foreground">Company Name</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Match</TableHead>
                  <TableHead className="text-right text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((result, index) => (
                  <TableRow key={`${result.isin}-${index}`} className="border-border" data-testid={`row-isin-${result.isin}`}>
                    <TableCell className="font-mono text-sm text-blue-400">{result.isin}</TableCell>
                    <TableCell className="font-medium text-foreground max-w-xs truncate" title={result.issuerName}>
                      {result.issuerName}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSecurityTypeBadge(result.securityType)}>
                        {result.securityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${result.matchScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{result.matchScore}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.isin)}
                        className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                        data-testid={`button-copy-${result.isin}`}
                      >
                        Copy ISIN
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Data source: NSDL (National Securities Depository Limited) daily updated ISIN registry
        </p>
      </div>
    </>
  );
}

function CredhiveSearchDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CredhiveSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; cin?: string; probe42CompanyId: string }) => {
      return apiRequest('/api/unlisted/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    },
    onSuccess: async (result) => {
      const companyId = result.data?.id;
      if (companyId) {
        // Auto-trigger sync
        try {
          const syncResult = await apiRequest(`/api/unlisted/credhive/sync/${companyId}`, { method: 'POST' });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
          
          // Show sync result including ISIN info
          const isinInfo = (syncResult as any)?.data?.isin;
          let description = 'Company data synced from Credhive';
          if (isinInfo?.autoPopulated && isinInfo?.source) {
            const sourceLabel = isinInfo.source === 'moneycontrol' ? 'MoneyControl' : 'NSDL';
            description = `${description}. ISIN auto-populated from ${sourceLabel} (${Math.round(isinInfo.matchScore)}% match)`;
          }
          
          toast({ title: 'Company linked and synced successfully', description });
          onClose();
        } catch (error: any) {
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
          toast({
            title: 'Company linked but sync failed',
            description: error.message,
            variant: 'destructive'
          });
          onClose();
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'An error occurred';
      if (errorMessage.includes('CIN already exists')) {
        toast({
          title: 'Company already exists',
          description: 'This company is already in your database. You can find it in the Companies list.',
        });
      } else {
        toast({
          title: 'Failed to link company',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  });

  const handleSearch = async () => {
    if (searchQuery.length < 3) {
      toast({
        title: 'Query too short',
        description: 'Please enter at least 3 characters',
        variant: 'destructive'
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/unlisted/credhive/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      const result = await response.json();
      setSearchResults(result.data || []);
    } catch (error: any) {
      toast({
        title: 'Search failed',
        description: error.message || 'Failed to search companies',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkAndSync = (result: CredhiveSearchResult) => {
    createCompanyMutation.mutate({
      name: result.name,
      cin: result.cin,
      probe42CompanyId: result.company_id,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground">Search Credhive Companies</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Search for companies by name or CIN to link and sync data
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter company name or CIN (min 3 characters)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="bg-muted border-border text-foreground"
            data-testid="input-credhive-search"
          />
          <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search">
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">CIN</TableHead>
                  <TableHead className="text-muted-foreground">ROC State</TableHead>
                  <TableHead className="text-muted-foreground">Incorporation Date</TableHead>
                  <TableHead className="text-right text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((result) => (
                  <TableRow key={result.company_id} className="border-border" data-testid={`row-result-${result.company_id}`}>
                    <TableCell className="font-medium text-foreground">{result.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{result.cin}</TableCell>
                    <TableCell className="text-muted-foreground">{result.roc_state || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {result.incorporation_date ? format(new Date(result.incorporation_date), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleLinkAndSync(result)}
                        disabled={createCompanyMutation.isPending}
                        data-testid={`button-link-${result.company_id}`}
                      >
                        {createCompanyMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Link & Sync
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

function CompanyDetailsView({ companyId, onBack }: { companyId: string; onBack: () => void }) {
  const { data: company, isLoading: companyLoading } = useQuery<UnlistedCompany>({
    queryKey: ['/api/unlisted/companies', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch company');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: financials } = useQuery<CompanyFinancials[]>({
    queryKey: ['/api/unlisted/companies', companyId, 'financials'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}/financials`);
      if (!response.ok) throw new Error('Failed to fetch financials');
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: ratios } = useQuery<CompanyRatios[]>({
    queryKey: ['/api/unlisted/companies', companyId, 'ratios'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}/ratios`);
      if (!response.ok) throw new Error('Failed to fetch ratios');
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: priceHistory } = useQuery<UnlistedPriceHistory[]>({
    queryKey: ['/api/unlisted/companies', companyId, 'price-history'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}/price-history`);
      if (!response.ok) throw new Error('Failed to fetch price history');
      const result = await response.json();
      return result.data || [];
    },
  });

  if (companyLoading) {
    return <LoadingState />;
  }

  if (!company) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Company not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
          <p className="text-muted-foreground mt-1">{company.cin}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-muted" data-testid="tab-overview">
            <Building2 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financials" className="data-[state=active]:bg-muted" data-testid="tab-financials">
            <TrendingUp className="w-4 h-4 mr-2" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="ratios" className="data-[state=active]:bg-muted" data-testid="tab-ratios">
            <BarChart3 className="w-4 h-4 mr-2" />
            Ratios
          </TabsTrigger>
          <TabsTrigger value="price-history" className="data-[state=active]:bg-muted" data-testid="tab-price-history">
            <History className="w-4 h-4 mr-2" />
            Price History
          </TabsTrigger>
          <TabsTrigger value="sync-status" className="data-[state=active]:bg-muted" data-testid="tab-sync-status">
            <Activity className="w-4 h-4 mr-2" />
            Sync Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab company={company} />
        </TabsContent>

        <TabsContent value="financials">
          <FinancialsTab financials={financials || []} />
        </TabsContent>

        <TabsContent value="ratios">
          <RatiosTab ratios={ratios || []} />
        </TabsContent>

        <TabsContent value="price-history">
          <PriceHistoryTab priceHistory={priceHistory || []} />
        </TabsContent>

        <TabsContent value="sync-status">
          <SyncStatusTab company={company} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ company }: { company: UnlistedCompany }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-muted-foreground">Company Name</Label>
            <p className="text-foreground font-medium">{company.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">CIN</Label>
            <p className="text-foreground font-mono">{company.cin || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">ISIN</Label>
            <p className="text-foreground font-mono">{company.isin || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">ROC State</Label>
            <p className="text-foreground">{company.rocState || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Incorporation Date</Label>
            <p className="text-foreground">
              {company.incorporationDate ? format(new Date(company.incorporationDate), 'MMM dd, yyyy') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Website</Label>
            <p className="text-blue-400">
              {company.website ? (
                <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a>
              ) : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Capital Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-muted-foreground">Paid-Up Capital</Label>
            <p className="text-foreground font-medium">
              ₹{company.paidUpCapital ? Number(company.paidUpCapital).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Authorized Capital</Label>
            <p className="text-foreground font-medium">
              ₹{company.authorizedCapital ? Number(company.authorizedCapital).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Face Value</Label>
            <p className="text-foreground">
              ₹{company.faceValue ? Number(company.faceValue).toFixed(2) : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Total Shares</Label>
            <p className="text-foreground">
              {company.totalShares ? Number(company.totalShares).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Sector</Label>
            <p className="text-foreground">{company.sector || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Industry</Label>
            <p className="text-foreground">{company.industry || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      {company.description && (
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{company.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FinancialsTab({ financials }: { financials: CompanyFinancials[] }) {
  if (financials.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No financial data available</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by financial year
  const sortedFinancials = [...financials].sort((a, b) => 
    a.financialYear.localeCompare(b.financialYear)
  );

  // Prepare chart data
  const chartData = sortedFinancials.map(f => ({
    fy: f.financialYear,
    revenue: Number(f.revenue) / 10000000 || 0, // Convert to Crores
    ebitda: Number(f.ebitda) / 10000000 || 0,
    pat: Number(f.pat) / 10000000 || 0,
    networth: Number(f.networth) / 10000000 || 0,
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Financial Trends</CardTitle>
          <CardDescription className="text-muted-foreground">Revenue, EBITDA, PAT, and Networth (₹ Crores)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="fy" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3B82F6" name="Revenue" />
              <Line type="monotone" dataKey="ebitda" stroke="#10B981" name="EBITDA" />
              <Line type="monotone" dataKey="pat" stroke="#F59E0B" name="PAT" />
              <Line type="monotone" dataKey="networth" stroke="#8B5CF6" name="Networth" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Financial Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">FY</TableHead>
                  <TableHead className="text-muted-foreground text-right">Revenue</TableHead>
                  <TableHead className="text-muted-foreground text-right">EBITDA</TableHead>
                  <TableHead className="text-muted-foreground text-right">PAT</TableHead>
                  <TableHead className="text-muted-foreground text-right">Networth</TableHead>
                  <TableHead className="text-muted-foreground text-right">Total Assets</TableHead>
                  <TableHead className="text-muted-foreground text-right">Total Debt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFinancials.map((fin) => (
                  <TableRow key={fin.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{fin.financialYear}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.revenue ? (Number(fin.revenue) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.ebitda ? (Number(fin.ebitda) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.pat ? (Number(fin.pat) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.networth ? (Number(fin.networth) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.totalAssets ? (Number(fin.totalAssets) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{fin.totalDebt ? (Number(fin.totalDebt) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RatiosTab({ ratios }: { ratios: CompanyRatios[] }) {
  if (ratios.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No ratio data available</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by financial year
  const sortedRatios = [...ratios].sort((a, b) => 
    a.financialYear.localeCompare(b.financialYear)
  );

  // Prepare chart data
  const chartData = sortedRatios.map(r => ({
    fy: r.financialYear,
    roe: Number(r.roe) * 100 || 0,
    roce: Number(r.roce) * 100 || 0,
    roa: Number(r.roa) * 100 || 0,
    ebitdaMargin: Number(r.marginEbitda) * 100 || 0,
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Profitability Trends</CardTitle>
          <CardDescription className="text-muted-foreground">ROE, ROCE, ROA, and EBITDA Margin (%)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="fy" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend />
              <Bar dataKey="roe" fill="#3B82F6" name="ROE %" />
              <Bar dataKey="roce" fill="#10B981" name="ROCE %" />
              <Bar dataKey="roa" fill="#F59E0B" name="ROA %" />
              <Bar dataKey="ebitdaMargin" fill="#8B5CF6" name="EBITDA Margin %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">FY</TableHead>
                  <TableHead className="text-muted-foreground text-right">P/E</TableHead>
                  <TableHead className="text-muted-foreground text-right">P/B</TableHead>
                  <TableHead className="text-muted-foreground text-right">ROE %</TableHead>
                  <TableHead className="text-muted-foreground text-right">ROCE %</TableHead>
                  <TableHead className="text-muted-foreground text-right">D/E</TableHead>
                  <TableHead className="text-muted-foreground text-right">Current Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRatios.map((ratio) => (
                  <TableRow key={ratio.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{ratio.financialYear}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.peRatio ? Number(ratio.peRatio).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.pbRatio ? Number(ratio.pbRatio).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.roe ? (Number(ratio.roe) * 100).toFixed(2) : 'N/A'}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.roce ? (Number(ratio.roce) * 100).toFixed(2) : 'N/A'}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.debtEquity ? Number(ratio.debtEquity).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ratio.currentRatio ? Number(ratio.currentRatio).toFixed(2) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriceHistoryTab({ priceHistory }: { priceHistory: UnlistedPriceHistory[] }) {
  if (priceHistory.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No price history available</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by date
  const sortedHistory = [...priceHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Prepare chart data
  const chartData = sortedHistory.map(p => ({
    date: format(new Date(p.date), 'MMM dd, yyyy'),
    price: Number(p.price),
    volume: Number(p.volume) || 0,
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Price Chart</CardTitle>
          <CardDescription className="text-muted-foreground">Historical price movements</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#3B82F6" name="Price (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Price</TableHead>
                  <TableHead className="text-muted-foreground text-right">Volume</TableHead>
                  <TableHead className="text-muted-foreground">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((price) => (
                  <TableRow key={price.id} className="border-border">
                    <TableCell className="text-foreground">
                      {format(new Date(price.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-medium">
                      ₹{Number(price.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {price.volume ? Number(price.volume).toLocaleString('en-IN') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground border-border">
                        {price.sourceType}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncStatusTab({ company }: { company: UnlistedCompany }) {
  const { toast } = useToast();
  
  const enrichMCAMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/unlisted/admin/companies/${company.id}/enrich-mca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response as { data: { financialsStored: number; message: string } };
    },
    onSuccess: (response) => {
      toast({
        title: 'MCA Enrichment Complete',
        description: response.data?.message || `Fetched financial data from MCA/Credhive`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies', company.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies', company.id, 'financials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies', company.id, 'ratios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies', company.id, 'price-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Enrichment Failed',
        description: error.message || 'Failed to enrich company with MCA data',
        variant: 'destructive'
      });
    }
  });
  
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-foreground">Credhive Sync Status</CardTitle>
          {company.cin && (
            <Button 
              onClick={() => enrichMCAMutation.mutate()}
              disabled={enrichMCAMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-enrich-mca"
            >
              {enrichMCAMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Enrich MCA Data
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-muted-foreground">Credhive Company ID</Label>
            <p className="text-foreground font-mono">{company.probe42CompanyId || 'Not linked'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Last Synced</Label>
            <p className="text-foreground">
              {company.lastSyncedAt ? format(new Date(company.lastSyncedAt), 'MMM dd, yyyy HH:mm') : 'Never'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Integration Status</Label>
            <Badge
              variant={company.probe42CompanyId ? 'default' : 'secondary'}
              className={company.probe42CompanyId ? 'bg-green-500' : 'bg-muted'}
            >
              {company.probe42CompanyId ? 'Linked' : 'Not Linked'}
            </Badge>
          </div>
          <div>
            <Label className="text-muted-foreground">Data Source</Label>
            <p className="text-foreground">Credhive</p>
          </div>
          <div>
            <Label className="text-muted-foreground">CIN (for MCA lookup)</Label>
            <p className="text-foreground font-mono">{company.cin || 'Not available'}</p>
          </div>
        </div>

        {!company.cin && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-500 text-sm">
              MCA enrichment requires a CIN. Link this company to Credhive to obtain the CIN first.
            </p>
          </div>
        )}
        
        {!company.probe42CompanyId && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-500 text-sm">
              This company is not linked to Credhive. Use the "Add Company" feature to search and link from Credhive.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MoneyControlMatchResult {
  total: number;
  matched: number;
  imported: number;
  skipped: number;
  errors: string[];
  matchedCompanies: {
    moneyControlName: string;
    isin: string;
    matchedTo: string;
    matchedById: string;
    price: number;
    matchType: 'isin' | 'name';
  }[];
  unmatchedCompanies: {
    name: string;
    isin: string;
    price: number;
  }[];
  message?: string;
}

interface AddCompanyResult {
  companyId: string;
  companyName: string;
  credhiveFound: boolean;
  credhiveData: {
    cin?: string;
    sector?: string;
    industry?: string;
    financialsSynced: number;
    ratiosSynced: number;
  } | null;
  priceImported: boolean;
  importedPrice?: number;
}

function MoneyControlImportDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [previewData, setPreviewData] = useState<MoneyControlMatchResult | null>(null);
  const [addingCompanyIsin, setAddingCompanyIsin] = useState<string | null>(null);
  const [addedCompanies, setAddedCompanies] = useState<Map<string, AddCompanyResult>>(new Map());

  const addCompanyMutation = useMutation({
    mutationFn: async (company: { name: string; isin: string; price: number }) => {
      const response = await apiRequest('/api/unlisted/moneycontrol/add-company', {
        method: 'POST',
        body: JSON.stringify(company),
        headers: { 'Content-Type': 'application/json' }
      });
      return response as { data: AddCompanyResult };
    },
    onSuccess: (response, variables) => {
      const result = response.data;
      setAddedCompanies(prev => new Map(prev).set(variables.isin, result));
      
      // Remove from unmatched and add to matched
      if (previewData) {
        const updatedUnmatched = previewData.unmatchedCompanies.filter(c => c.isin !== variables.isin);
        const addedCompany = previewData.unmatchedCompanies.find(c => c.isin === variables.isin);
        if (addedCompany) {
          const newMatched = {
            moneyControlName: addedCompany.name,
            isin: addedCompany.isin,
            matchedTo: result.companyName,
            matchedById: result.companyId,
            price: addedCompany.price,
            matchType: 'isin' as const
          };
          setPreviewData({
            ...previewData,
            matched: previewData.matched + 1,
            matchedCompanies: [...previewData.matchedCompanies, newMatched],
            unmatchedCompanies: updatedUnmatched
          });
        }
      }
      
      toast({
        title: 'Company Added',
        description: result.credhiveFound
          ? `${result.companyName} added with Credhive data (${result.credhiveData?.financialsSynced || 0} financials synced)`
          : `${result.companyName} added (Credhive data not found)`,
      });
      setAddingCompanyIsin(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Add Company',
        description: error.message || 'Failed to add company',
        variant: 'destructive'
      });
      setAddingCompanyIsin(null);
    }
  });

  const handleAddCompany = (company: { name: string; isin: string; price: number }) => {
    setAddingCompanyIsin(company.isin);
    addCompanyMutation.mutate(company);
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/unlisted/moneycontrol/preview');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to preview import');
      }
      const result = await response.json();
      return result.data as MoneyControlMatchResult;
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to fetch data from MoneyControl',
        variant: 'destructive'
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/unlisted/moneycontrol/import', { method: 'POST' });
      return response as MoneyControlMatchResult;
    },
    onSuccess: (data) => {
      toast({
        title: 'Import Successful',
        description: `Imported ${data.imported} prices from MoneyControl`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import prices',
        variant: 'destructive'
      });
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <Download className="w-5 h-5 text-green-400" />
          Import Prices from MoneyControl
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Fetch the latest unlisted share prices from MoneyControl and import them into your marketplace.
          Companies are matched by ISIN code or name.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {!previewData && !previewMutation.isPending && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-blue-400 text-sm mb-4">
              Click "Preview Import" to see which companies from MoneyControl can be matched to your existing unlisted companies.
            </p>
            <Button
              onClick={() => previewMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-preview-moneycontrol"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Preview Import
            </Button>
          </div>
        )}

        {previewMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
            <p className="text-muted-foreground">Fetching data from MoneyControl...</p>
          </div>
        )}

        {previewData && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-muted border-border">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-foreground">{previewData.total}</div>
                  <div className="text-sm text-muted-foreground">Total Found</div>
                </CardContent>
              </Card>
              <Card className="bg-muted border-border">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-400">{previewData.matched}</div>
                  <div className="text-sm text-muted-foreground">Matched</div>
                </CardContent>
              </Card>
              <Card className="bg-muted border-border">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-400">{previewData.unmatchedCompanies.length}</div>
                  <div className="text-sm text-muted-foreground">Unmatched</div>
                </CardContent>
              </Card>
              <Card className="bg-muted border-border">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-400">{previewData.imported}</div>
                  <div className="text-sm text-muted-foreground">To Import</div>
                </CardContent>
              </Card>
            </div>

            {previewData.matchedCompanies.length > 0 && (
              <Card className="bg-muted border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Matched Companies ({previewData.matchedCompanies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground text-xs">MoneyControl Name</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Matched To</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Match Type</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.matchedCompanies.map((match, idx) => (
                          <TableRow key={idx} className="border-border">
                            <TableCell className="text-foreground text-sm py-2">{match.moneyControlName}</TableCell>
                            <TableCell className="text-muted-foreground text-sm py-2">{match.matchedTo}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className={match.matchType === 'isin' ? 'border-green-500 text-green-400' : 'border-yellow-500 text-yellow-400'}>
                                {match.matchType === 'isin' ? 'ISIN' : 'Name'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-green-400 font-medium text-sm py-2">
                              ₹{match.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {previewData.unmatchedCompanies.length > 0 && (
              <Card className="bg-muted border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    Unmatched Companies ({previewData.unmatchedCompanies.length})
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    These companies from MoneyControl don't match any in your database. Click "Add" to create them with Credhive data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground text-xs">Company Name</TableHead>
                          <TableHead className="text-muted-foreground text-xs">ISIN</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-right">Price</TableHead>
                          <TableHead className="text-muted-foreground text-xs text-center w-24">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.unmatchedCompanies.map((company, idx) => (
                          <TableRow key={idx} className="border-border">
                            <TableCell className="text-muted-foreground text-sm py-2">{company.name}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs py-2">{company.isin}</TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm py-2">
                              ₹{company.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-blue-500 text-blue-400 hover:bg-blue-500/20"
                                onClick={() => handleAddCompany(company)}
                                disabled={addingCompanyIsin === company.isin}
                                data-testid={`button-add-company-${company.isin}`}
                              >
                                {addingCompanyIsin === company.isin ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || previewData.matched === 0}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-execute-moneycontrol-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import {previewData.matched} Prices
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DeleteCompanyDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [confirmText, setConfirmText] = useState('');

  const { data: companies, isLoading } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/companies');
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
  });

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest(`/api/unlisted/companies/${companyId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({ title: 'Company deleted successfully' });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete company',
        variant: 'destructive'
      });
    }
  });

  const canDelete = selectedCompanyId && confirmText === 'DELETE';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          Delete Company
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Select a company to delete. This action will permanently remove the company and all associated data including financials, price history, listings, and buy requests.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Select Company</Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading companies...
            </div>
          ) : (
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-delete-company">
                <SelectValue placeholder="Choose a company to delete..." />
              </SelectTrigger>
              <SelectContent>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name} ({company.cin || 'No CIN'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedCompany && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Warning: This action cannot be undone</p>
                <p className="text-muted-foreground text-sm mt-1">
                  You are about to delete <span className="text-foreground font-semibold">{selectedCompany.name}</span> and all its associated data.
                </p>
                <div className="mt-3">
                  <Label className="text-muted-foreground text-sm">Type "DELETE" to confirm</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="mt-1 bg-muted border-border text-foreground"
                    data-testid="input-confirm-delete"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">
          Cancel
        </Button>
        <Button
          onClick={() => deleteMutation.mutate(selectedCompanyId)}
          disabled={!canDelete || deleteMutation.isPending}
          className="bg-red-600 hover:bg-red-700 disabled:bg-muted"
          data-testid="button-confirm-delete-company"
        >
          {deleteMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Company
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function BulkImportDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState('');
  const [parsedCompanies, setParsedCompanies] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string) => {
    setParseError(null);
    try {
      const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''));
      if (lines.length < 2) {
        setParseError('CSV must have at least a header row and one data row');
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
      const companies: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          console.warn(`Row ${i + 1} has ${values.length} values, expected ${headers.length}`);
          continue;
        }

        const company: Record<string, string> = {};
        headers.forEach((header, idx) => {
          company[header] = values[idx].replace(/^["']|["']$/g, '');
        });
        companies.push(company);
      }

      setParsedCompanies(companies);
    } catch (error: any) {
      setParseError(error.message);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/unlisted/admin/bulk-import-csv', {
        method: 'POST',
        body: JSON.stringify({ companies: parsedCompanies }),
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({
        title: 'Import Complete',
        description: `Imported ${result.data?.imported || 0} of ${result.data?.total || 0} companies`,
      });
      if (result.data?.errors?.length > 0) {
        console.log('Import errors:', result.data.errors);
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to import companies',
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <Upload className="w-5 h-5 text-cyan-400" />
          Bulk Import Unlisted Companies
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Upload a CSV file to import multiple unlisted companies at once. Download the template for the correct format.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label className="text-muted-foreground">Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mt-1 bg-muted border-border text-foreground"
              data-testid="input-csv-file"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                const template = `name,cin,isin,sector,industry,rocState,paidUpCapital,faceValue,totalShares,status,listingStage
"Example Company Ltd","U72200MH2020PTC123456","INE123A01234","Technology","Software","Maharashtra","10000000","10","1000000","active","unlisted"`;
                const blob = new Blob([template], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'unlisted_import_template.csv';
                a.click();
              }}
              className="border-border text-muted-foreground"
              data-testid="button-download-template"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </div>

        {parseError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              {parseError}
            </div>
          </div>
        )}

        {parsedCompanies.length > 0 && (
          <Card className="bg-muted/50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                {parsedCompanies.length} Companies Ready to Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">CIN</TableHead>
                      <TableHead className="text-muted-foreground">Sector</TableHead>
                      <TableHead className="text-muted-foreground">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedCompanies.slice(0, 10).map((company, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-foreground">{company.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{company.cin || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{company.sector || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {company.listingstage || company.listing_stage || 'unlisted'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedCompanies.length > 10 && (
                  <p className="text-muted-foreground text-sm mt-2">
                    ... and {parsedCompanies.length - 10} more companies
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">
          Cancel
        </Button>
        <Button
          onClick={() => importMutation.mutate()}
          disabled={parsedCompanies.length === 0 || importMutation.isPending}
          className="bg-cyan-600 hover:bg-cyan-700"
          data-testid="button-execute-bulk-import"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import {parsedCompanies.length} Companies
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function ListingTransitionDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [targetStage, setTargetStage] = useState('');
  const [exchange, setExchange] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [ipoPrice, setIpoPrice] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [listingDate, setListingDate] = useState('');

  const { data: companies, isLoading } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/companies');
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: validation } = useQuery({
    queryKey: ['/api/unlisted/admin/transition/validate', selectedCompanyId, targetStage],
    queryFn: async () => {
      if (!selectedCompanyId || !targetStage) return null;
      const response = await fetch(`/api/unlisted/admin/transition/validate?companyId=${selectedCompanyId}&targetStage=${targetStage}`);
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedCompanyId && !!targetStage,
  });

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  const transitionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/unlisted/admin/transition', {
        method: 'POST',
        body: JSON.stringify({
          companyId: selectedCompanyId,
          targetStage,
          exchange: exchange || undefined,
          stockSymbol: stockSymbol || undefined,
          ipoPrice: ipoPrice || undefined,
          listPrice: listPrice || undefined,
          lotSize: lotSize || undefined,
          listingDate: listingDate || undefined,
        }),
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      toast({
        title: 'Transition Complete',
        description: result.data?.message || `Company transitioned to ${targetStage}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Transition failed',
        description: error.message || 'Failed to execute transition',
        variant: 'destructive',
      });
    },
  });

  const stageOptions = [
    { value: 'unlisted', label: 'Unlisted' },
    { value: 'pre_ipo', label: 'Pre-IPO' },
    { value: 'ipo_announced', label: 'IPO Announced' },
    { value: 'ipo_open', label: 'IPO Open' },
    { value: 'listed', label: 'Listed' },
    { value: 'delisted', label: 'Delisted' },
  ];

  const showExchangeFields = targetStage === 'listed';
  const showIpoFields = ['ipo_announced', 'ipo_open', 'listed'].includes(targetStage);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          <ArrowRightCircle className="w-5 h-5 text-amber-400" />
          Listing Stage Transition
        </DialogTitle>
        <DialogDescription className="text-muted-foreground">
          Change a company's listing stage. When transitioning to "Listed", the company will be added to the stocks table and portfolio holdings will be migrated.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Select Company</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-transition-company">
                  <SelectValue placeholder="Choose a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.listingStage || 'unlisted'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Target Stage</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-target-stage">
                <SelectValue placeholder="Select target stage..." />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCompany && targetStage && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Stage:</span>
              <Badge variant="outline">{selectedCompany.listingStage || 'unlisted'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target Stage:</span>
              <Badge className="bg-amber-600">{targetStage}</Badge>
            </div>
            {validation && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valid Transition:</span>
                {validation.isValid ? (
                  <Badge className="bg-green-600">Yes</Badge>
                ) : (
                  <Badge className="bg-red-600">No</Badge>
                )}
              </div>
            )}
          </div>
        )}

        {showIpoFields && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">IPO Price (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={ipoPrice}
                onChange={(e) => setIpoPrice(e.target.value)}
                placeholder="Enter IPO price"
                className="bg-muted border-border text-foreground"
                data-testid="input-ipo-price"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Lot Size</Label>
              <Input
                type="number"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                placeholder="Enter lot size"
                className="bg-muted border-border text-foreground"
                data-testid="input-lot-size"
              />
            </div>
          </div>
        )}

        {showExchangeFields && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Exchange</Label>
                <Select value={exchange} onValueChange={setExchange}>
                  <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-exchange">
                    <SelectValue placeholder="Select exchange..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NSE">NSE</SelectItem>
                    <SelectItem value="BSE">BSE</SelectItem>
                    <SelectItem value="NSE_BSE">NSE & BSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Stock Symbol</Label>
                <Input
                  value={stockSymbol}
                  onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., RELIANCE"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-stock-symbol"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">List Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="Enter listing price"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-list-price"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Listing Date</Label>
                <Input
                  type="date"
                  value={listingDate}
                  onChange={(e) => setListingDate(e.target.value)}
                  className="bg-muted border-border text-foreground"
                  data-testid="input-listing-date"
                />
              </div>
            </div>
          </>
        )}

        {validation && !validation.isValid && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              Invalid transition. Valid transitions from "{selectedCompany?.listingStage || 'unlisted'}": {validation.validTransitions?.join(', ')}
            </div>
          </div>
        )}

        {targetStage === 'listed' && validation?.transactionRules && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-green-400 text-sm">Transaction Rules After Listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trading Type:</span>
                <Badge className="bg-green-600">{validation.transactionRules.tradingType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Settlement:</span>
                <span className="text-foreground">T+{validation.transactionRules.settlementDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min KYC Level:</span>
                <span className="text-foreground">{validation.transactionRules.minKycLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow Required:</span>
                <span className="text-foreground">{validation.transactionRules.escrowRequired ? 'Yes' : 'No'}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">
          Cancel
        </Button>
        <Button
          onClick={() => transitionMutation.mutate()}
          disabled={!selectedCompanyId || !targetStage || !validation?.isValid || transitionMutation.isPending}
          className="bg-amber-600 hover:bg-amber-700"
          data-testid="button-execute-transition"
        >
          {transitionMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Transitioning...
            </>
          ) : (
            <>
              <ArrowRightCircle className="w-4 h-4 mr-2" />
              Execute Transition
            </>
          )}
        </Button>
      </div>
    </>
  );
}
