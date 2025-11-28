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
import { Building2, Search, RefreshCw, ArrowLeft, Plus, Loader2, TrendingUp, BarChart3, History, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { UnlistedCompany, CompanyFinancials, CompanyRatios, UnlistedPriceHistory } from '@shared/schema';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface Probe42SearchResult {
  id: string;
  name: string;
  cin: string;
  rocState?: string;
  incorporationDate?: string;
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

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest(`/api/unlisted/probe42/sync/${companyId}`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
      toast({ title: 'Company synced successfully with Probe42' });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync company data',
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
                        {company.probe42CompanyId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              syncMutation.mutate(company.id);
                            }}
                            disabled={syncMutation.isPending}
                            data-testid={`button-sync-${company.id}`}
                          >
                            {syncMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                        )}
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
          await apiRequest(`/api/unlisted/probe42/sync/${companyId}`, { method: 'POST' });
          queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
          toast({ title: 'Company linked and synced successfully' });
          onClose();
        } catch (error: any) {
          toast({
            title: 'Company linked but sync failed',
            description: error.message,
            variant: 'destructive'
          });
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to link company',
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
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
      probe42CompanyId: result.id,
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
                  <TableRow key={result.id} className="border-gray-800" data-testid={`row-result-${result.id}`}>
                    <TableCell className="font-medium text-white">{result.name}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-300">{result.cin}</TableCell>
                    <TableCell className="text-gray-300">{result.rocState || 'N/A'}</TableCell>
                    <TableCell className="text-gray-300">
                      {result.incorporationDate ? format(new Date(result.incorporationDate), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleLinkAndSync(result)}
                        disabled={createCompanyMutation.isPending}
                        data-testid={`button-link-${result.id}`}
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
