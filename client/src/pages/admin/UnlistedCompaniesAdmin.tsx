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
import { Building2, Search, RefreshCw, ArrowLeft, Plus, Loader2, TrendingUp, BarChart3, History, Activity, Download, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { UnlistedCompany, CompanyFinancials, CompanyRatios, UnlistedPriceHistory } from '@shared/schema';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface Probe42SearchResult {
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
  const [isProbe42DialogOpen, setIsProbe42DialogOpen] = useState(false);
  const [probe42SearchQuery, setProbe42SearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('companies');
  const [isMoneyControlDialogOpen, setIsMoneyControlDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isNSDLDialogOpen, setIsNSDLDialogOpen] = useState(false);

  // Check admin access
  if (authLoading) {
    return <LoadingState />;
  }

  if (!user || !user.roles?.includes('admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <Card className="bg-gray-900 border-gray-800 max-w-md">
          <CardHeader>
            <CardTitle className="text-white text-center">Access Denied</CardTitle>
            <CardDescription className="text-gray-400 text-center">
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
          <h1 className="text-3xl font-bold text-white">Unlisted Marketplace Management</h1>
          <p className="text-gray-400 mt-1">Manage companies, listings, and buy requests</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isNSDLDialogOpen} onOpenChange={setIsNSDLDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-600/20" data-testid="button-nsdl-isin-search">
                <Search className="w-4 h-4 mr-2" />
                Find ISIN
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-800">
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
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-800">
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
            <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
              <DeleteCompanyDialog onClose={() => setIsDeleteDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isProbe42DialogOpen} onOpenChange={setIsProbe42DialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-company">
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-gray-900 border-gray-800">
              <Probe42SearchDialog onClose={() => setIsProbe42DialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800 border-gray-700">
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
      return apiRequest(`/api/unlisted/probe42/sync/${companyId}`, { method: 'POST' });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      
      // Show detailed sync result including ISIN info
      const message = result?.data?.message || 'Sync completed';
      
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
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by company name or CIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-800 border-gray-700 text-white"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-status-filter">
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
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-sector-filter">
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

      {/* Companies Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Companies ({filteredCompanies.length})</CardTitle>
          <CardDescription className="text-gray-400">
            Click on a company to view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-gray-800/50">
                  <TableHead className="text-gray-400">Company Name</TableHead>
                  <TableHead className="text-gray-400">CIN</TableHead>
                  <TableHead className="text-gray-400">Sector</TableHead>
                  <TableHead className="text-gray-400">Stage</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Last Synced</TableHead>
                  <TableHead className="text-right text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow className="border-gray-800">
                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                      No companies found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow
                      key={company.id}
                      className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => onSelectCompany(company.id)}
                      data-testid={`row-company-${company.id}`}
                    >
                      <TableCell className="font-medium text-white" data-testid={`text-name-${company.id}`}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-300" data-testid={`text-cin-${company.id}`}>
                        {company.cin || 'N/A'}
                      </TableCell>
                      <TableCell className="text-gray-300" data-testid={`text-sector-${company.id}`}>
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell className="text-gray-300" data-testid={`text-stage-${company.id}`}>
                        {company.listingStage || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={company.status === 'active' ? 'default' : 'secondary'}
                          className={company.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
                          data-testid={`badge-status-${company.id}`}
                        >
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400" data-testid={`text-lastSynced-${company.id}`}>
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
                                  description: 'This company has no Probe42 ID. It may have been added manually.',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              syncMutation.mutate(company.id);
                            }}
                            disabled={syncingCompanyId === company.id}
                            className={company.probe42CompanyId ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500'}
                            title={company.probe42CompanyId ? 'Sync from Probe42' : 'No Probe42 ID available'}
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
                            <AlertDialogContent className="bg-gray-900 border-gray-800" onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Delete Company</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Are you sure you want to delete <span className="font-semibold text-white">{company.name}</span>? 
                                  This will also delete all related financials, price history, listings, and buy requests. 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
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
      cancelled: 'bg-gray-500',
      suspended: 'bg-yellow-500',
      expired: 'bg-red-500',
      completed: 'bg-blue-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-white">Sell Listings ({listings.length})</CardTitle>
            <CardDescription className="text-gray-400">Manage all sell listings across companies</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
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
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">Company</TableHead>
                <TableHead className="text-gray-400">Seller</TableHead>
                <TableHead className="text-gray-400">Quantity</TableHead>
                <TableHead className="text-gray-400">Ask Price</TableHead>
                <TableHead className="text-gray-400">Landing Price</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Created</TableHead>
                <TableHead className="text-right text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    No sell listings found
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((listing: any) => (
                  <TableRow key={listing.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">
                      <div>
                        <p>{listing.companyName}</p>
                        <p className="text-xs text-gray-400">{listing.companySector}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div>
                        <p>{listing.sellerName}</p>
                        <p className="text-xs text-gray-400">{listing.sellerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">{listing.quantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-gray-300">{formatCurrency(listing.askPrice)}</TableCell>
                    <TableCell className="text-gray-300">{formatCurrency(listing.landingPrice)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(listing.status)}>{listing.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {listing.createdAt ? format(new Date(listing.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={listing.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: listing.id, status: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-gray-800 border-gray-700 text-xs">
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
      cancelled: 'bg-gray-500',
      suspended: 'bg-yellow-500',
      expired: 'bg-red-500',
      matched: 'bg-blue-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-white">Buy Requests ({buyRequests.length})</CardTitle>
            <CardDescription className="text-gray-400">Manage all buy requests across companies</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
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
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">Company</TableHead>
                <TableHead className="text-gray-400">Buyer</TableHead>
                <TableHead className="text-gray-400">Quantity</TableHead>
                <TableHead className="text-gray-400">Max Price</TableHead>
                <TableHead className="text-gray-400">Target Price</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Created</TableHead>
                <TableHead className="text-right text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyRequests.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                    No buy requests found
                  </TableCell>
                </TableRow>
              ) : (
                buyRequests.map((request: any) => (
                  <TableRow key={request.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">
                      <div>
                        <p>{request.companyName}</p>
                        <p className="text-xs text-gray-400">{request.companySector}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div>
                        <p>{request.buyerName}</p>
                        <p className="text-xs text-gray-400">{request.buyerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">{request.quantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-gray-300">{formatCurrency(request.maxPrice)}</TableCell>
                    <TableCell className="text-gray-300">{request.targetPrice ? formatCurrency(request.targetPrice) : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(request.status)}>{request.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={request.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: request.id, status: value })}
                      >
                        <SelectTrigger className="w-28 h-8 bg-gray-800 border-gray-700 text-xs">
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
      default: return 'bg-gray-600/20 text-gray-400 border-gray-600';
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">Search ISIN from NSDL</DialogTitle>
        <DialogDescription className="text-gray-400">
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
            className="bg-gray-800 border-gray-700 text-white"
            data-testid="input-nsdl-search"
          />
          <Select value={securityType} onValueChange={setSecurityType}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
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
          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">ISIN</TableHead>
                  <TableHead className="text-gray-400">Company Name</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Match</TableHead>
                  <TableHead className="text-right text-gray-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((result, index) => (
                  <TableRow key={`${result.isin}-${index}`} className="border-gray-800" data-testid={`row-isin-${result.isin}`}>
                    <TableCell className="font-mono text-sm text-blue-400">{result.isin}</TableCell>
                    <TableCell className="font-medium text-white max-w-xs truncate" title={result.issuerName}>
                      {result.issuerName}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSecurityTypeBadge(result.securityType)}>
                        {result.securityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${result.matchScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{result.matchScore}%</span>
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

        <p className="text-xs text-gray-500">
          Data source: NSDL (National Securities Depository Limited) daily updated ISIN registry
        </p>
      </div>
    </>
  );
}

function Probe42SearchDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Probe42SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; cin?: string; probe42CompanyId: string }) => {
      return apiRequest('/api/unlisted/companies', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: async (result) => {
      const companyId = result.data?.id;
      if (companyId) {
        // Auto-trigger sync
        try {
          const syncResult = await apiRequest(`/api/unlisted/probe42/sync/${companyId}`, { method: 'POST' });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
          
          // Show sync result including ISIN info
          const isinInfo = (syncResult as any)?.data?.isin;
          let description = 'Company data synced from Probe42';
          if (isinInfo?.autoPopulated) {
            description = `${description}. ISIN auto-populated from NSDL (${isinInfo.matchScore}% match)`;
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
      const response = await fetch(`/api/unlisted/probe42/search?q=${encodeURIComponent(searchQuery)}`);
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

  const handleLinkAndSync = (result: Probe42SearchResult) => {
    createCompanyMutation.mutate({
      name: result.name,
      cin: result.cin,
      probe42CompanyId: result.company_id,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-white">Search Probe42 Companies</DialogTitle>
        <DialogDescription className="text-gray-400">
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
            className="bg-gray-800 border-gray-700 text-white"
            data-testid="input-probe42-search"
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
          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Name</TableHead>
                  <TableHead className="text-gray-400">CIN</TableHead>
                  <TableHead className="text-gray-400">ROC State</TableHead>
                  <TableHead className="text-gray-400">Incorporation Date</TableHead>
                  <TableHead className="text-right text-gray-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((result) => (
                  <TableRow key={result.company_id} className="border-gray-800" data-testid={`row-result-${result.company_id}`}>
                    <TableCell className="font-medium text-white">{result.name}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-300">{result.cin}</TableCell>
                    <TableCell className="text-gray-300">{result.roc_state || 'N/A'}</TableCell>
                    <TableCell className="text-gray-300">
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
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="text-center py-8">
          <p className="text-gray-400">Company not found</p>
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
          <h1 className="text-3xl font-bold text-white">{company.name}</h1>
          <p className="text-gray-400 mt-1">{company.cin}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700" data-testid="tab-overview">
            <Building2 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="financials" className="data-[state=active]:bg-gray-700" data-testid="tab-financials">
            <TrendingUp className="w-4 h-4 mr-2" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="ratios" className="data-[state=active]:bg-gray-700" data-testid="tab-ratios">
            <BarChart3 className="w-4 h-4 mr-2" />
            Ratios
          </TabsTrigger>
          <TabsTrigger value="price-history" className="data-[state=active]:bg-gray-700" data-testid="tab-price-history">
            <History className="w-4 h-4 mr-2" />
            Price History
          </TabsTrigger>
          <TabsTrigger value="sync-status" className="data-[state=active]:bg-gray-700" data-testid="tab-sync-status">
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
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-gray-400">Company Name</Label>
            <p className="text-white font-medium">{company.name}</p>
          </div>
          <div>
            <Label className="text-gray-400">CIN</Label>
            <p className="text-white font-mono">{company.cin || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-gray-400">ISIN</Label>
            <p className="text-white font-mono">{company.isin || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-gray-400">ROC State</Label>
            <p className="text-white">{company.rocState || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-gray-400">Incorporation Date</Label>
            <p className="text-white">
              {company.incorporationDate ? format(new Date(company.incorporationDate), 'MMM dd, yyyy') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Website</Label>
            <p className="text-blue-400">
              {company.website ? (
                <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a>
              ) : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Capital Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-gray-400">Paid-Up Capital</Label>
            <p className="text-white font-medium">
              ₹{company.paidUpCapital ? Number(company.paidUpCapital).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Authorized Capital</Label>
            <p className="text-white font-medium">
              ₹{company.authorizedCapital ? Number(company.authorizedCapital).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Face Value</Label>
            <p className="text-white">
              ₹{company.faceValue ? Number(company.faceValue).toFixed(2) : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Total Shares</Label>
            <p className="text-white">
              {company.totalShares ? Number(company.totalShares).toLocaleString('en-IN') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Sector</Label>
            <p className="text-white">{company.sector || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-gray-400">Industry</Label>
            <p className="text-white">{company.industry || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      {company.description && (
        <Card className="bg-gray-900 border-gray-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">{company.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FinancialsTab({ financials }: { financials: CompanyFinancials[] }) {
  if (financials.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="text-center py-8">
          <p className="text-gray-400">No financial data available</p>
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
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Financial Trends</CardTitle>
          <CardDescription className="text-gray-400">Revenue, EBITDA, PAT, and Networth (₹ Crores)</CardDescription>
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

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Financial Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-800 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">FY</TableHead>
                  <TableHead className="text-gray-400 text-right">Revenue</TableHead>
                  <TableHead className="text-gray-400 text-right">EBITDA</TableHead>
                  <TableHead className="text-gray-400 text-right">PAT</TableHead>
                  <TableHead className="text-gray-400 text-right">Networth</TableHead>
                  <TableHead className="text-gray-400 text-right">Total Assets</TableHead>
                  <TableHead className="text-gray-400 text-right">Total Debt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFinancials.map((fin) => (
                  <TableRow key={fin.id} className="border-gray-800">
                    <TableCell className="font-medium text-white">{fin.financialYear}</TableCell>
                    <TableCell className="text-right text-gray-300">
                      ₹{fin.revenue ? (Number(fin.revenue) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      ₹{fin.ebitda ? (Number(fin.ebitda) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      ₹{fin.pat ? (Number(fin.pat) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      ₹{fin.networth ? (Number(fin.networth) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      ₹{fin.totalAssets ? (Number(fin.totalAssets) / 10000000).toFixed(2) : 'N/A'} Cr
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
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
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="text-center py-8">
          <p className="text-gray-400">No ratio data available</p>
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
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Profitability Trends</CardTitle>
          <CardDescription className="text-gray-400">ROE, ROCE, ROA, and EBITDA Margin (%)</CardDescription>
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

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-800 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">FY</TableHead>
                  <TableHead className="text-gray-400 text-right">P/E</TableHead>
                  <TableHead className="text-gray-400 text-right">P/B</TableHead>
                  <TableHead className="text-gray-400 text-right">ROE %</TableHead>
                  <TableHead className="text-gray-400 text-right">ROCE %</TableHead>
                  <TableHead className="text-gray-400 text-right">D/E</TableHead>
                  <TableHead className="text-gray-400 text-right">Current Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRatios.map((ratio) => (
                  <TableRow key={ratio.id} className="border-gray-800">
                    <TableCell className="font-medium text-white">{ratio.financialYear}</TableCell>
                    <TableCell className="text-right text-gray-300">
                      {ratio.peRatio ? Number(ratio.peRatio).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {ratio.pbRatio ? Number(ratio.pbRatio).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {ratio.roe ? (Number(ratio.roe) * 100).toFixed(2) : 'N/A'}%
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {ratio.roce ? (Number(ratio.roce) * 100).toFixed(2) : 'N/A'}%
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {ratio.debtEquity ? Number(ratio.debtEquity).toFixed(2) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
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
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="text-center py-8">
          <p className="text-gray-400">No price history available</p>
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
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Price Chart</CardTitle>
          <CardDescription className="text-gray-400">Historical price movements</CardDescription>
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

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400 text-right">Price</TableHead>
                  <TableHead className="text-gray-400 text-right">Volume</TableHead>
                  <TableHead className="text-gray-400">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((price) => (
                  <TableRow key={price.id} className="border-gray-800">
                    <TableCell className="text-white">
                      {format(new Date(price.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-gray-300 font-medium">
                      ₹{Number(price.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {price.volume ? Number(price.volume).toLocaleString('en-IN') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-gray-300 border-gray-700">
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
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Probe42 Sync Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-gray-400">Probe42 Company ID</Label>
            <p className="text-white font-mono">{company.probe42CompanyId || 'Not linked'}</p>
          </div>
          <div>
            <Label className="text-gray-400">Last Synced</Label>
            <p className="text-white">
              {company.lastSyncedAt ? format(new Date(company.lastSyncedAt), 'MMM dd, yyyy HH:mm') : 'Never'}
            </p>
          </div>
          <div>
            <Label className="text-gray-400">Integration Status</Label>
            <Badge
              variant={company.probe42CompanyId ? 'default' : 'secondary'}
              className={company.probe42CompanyId ? 'bg-green-500' : 'bg-gray-500'}
            >
              {company.probe42CompanyId ? 'Linked' : 'Not Linked'}
            </Badge>
          </div>
          <div>
            <Label className="text-gray-400">Data Source</Label>
            <p className="text-white">Probe42</p>
          </div>
        </div>

        {!company.probe42CompanyId && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-500 text-sm">
              This company is not linked to Probe42. Use the "Add Company" feature to search and link from Probe42.
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
  probe42Found: boolean;
  probe42Data: {
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
        description: result.probe42Found 
          ? `${result.companyName} added with Probe42 data (${result.probe42Data?.financialsSynced || 0} financials synced)`
          : `${result.companyName} added (Probe42 data not found)`,
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
        <DialogTitle className="text-white flex items-center gap-2">
          <Download className="w-5 h-5 text-green-400" />
          Import Prices from MoneyControl
        </DialogTitle>
        <DialogDescription className="text-gray-400">
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
            <p className="text-gray-400">Fetching data from MoneyControl...</p>
          </div>
        )}

        {previewData && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-white">{previewData.total}</div>
                  <div className="text-sm text-gray-400">Total Found</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-400">{previewData.matched}</div>
                  <div className="text-sm text-gray-400">Matched</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-400">{previewData.unmatchedCompanies.length}</div>
                  <div className="text-sm text-gray-400">Unmatched</div>
                </CardContent>
              </Card>
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-400">{previewData.imported}</div>
                  <div className="text-sm text-gray-400">To Import</div>
                </CardContent>
              </Card>
            </div>

            {previewData.matchedCompanies.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Matched Companies ({previewData.matchedCompanies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead className="text-gray-400 text-xs">MoneyControl Name</TableHead>
                          <TableHead className="text-gray-400 text-xs">Matched To</TableHead>
                          <TableHead className="text-gray-400 text-xs">Match Type</TableHead>
                          <TableHead className="text-gray-400 text-xs text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.matchedCompanies.map((match, idx) => (
                          <TableRow key={idx} className="border-gray-700">
                            <TableCell className="text-white text-sm py-2">{match.moneyControlName}</TableCell>
                            <TableCell className="text-gray-300 text-sm py-2">{match.matchedTo}</TableCell>
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
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    Unmatched Companies ({previewData.unmatchedCompanies.length})
                  </CardTitle>
                  <CardDescription className="text-gray-500 text-xs">
                    These companies from MoneyControl don't match any in your database. Click "Add" to create them with Probe42 data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead className="text-gray-400 text-xs">Company Name</TableHead>
                          <TableHead className="text-gray-400 text-xs">ISIN</TableHead>
                          <TableHead className="text-gray-400 text-xs text-right">Price</TableHead>
                          <TableHead className="text-gray-400 text-xs text-center w-24">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.unmatchedCompanies.map((company, idx) => (
                          <TableRow key={idx} className="border-gray-700">
                            <TableCell className="text-gray-300 text-sm py-2">{company.name}</TableCell>
                            <TableCell className="text-gray-400 font-mono text-xs py-2">{company.isin}</TableCell>
                            <TableCell className="text-right text-gray-300 text-sm py-2">
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

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
              <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300">
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
        <DialogTitle className="text-white flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          Delete Company
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          Select a company to delete. This action will permanently remove the company and all associated data including financials, price history, listings, and buy requests.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label className="text-gray-300">Select Company</Label>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading companies...
            </div>
          ) : (
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white" data-testid="select-delete-company">
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
                <p className="text-gray-400 text-sm mt-1">
                  You are about to delete <span className="text-white font-semibold">{selectedCompany.name}</span> and all its associated data.
                </p>
                <div className="mt-3">
                  <Label className="text-gray-300 text-sm">Type "DELETE" to confirm</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type DELETE"
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                    data-testid="input-confirm-delete"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
        <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300">
          Cancel
        </Button>
        <Button
          onClick={() => deleteMutation.mutate(selectedCompanyId)}
          disabled={!canDelete || deleteMutation.isPending}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600"
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
