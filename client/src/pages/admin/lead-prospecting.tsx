import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, Star, TrendingUp, Users, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ProspectLead {
  id: string;
  cin?: string;
  companyName: string;
  city?: string;
  state?: string;
  annualRevenue?: string;
  netProfit?: string;
  probe42Score?: number;
  leadScore: number;
  leadQuality: string;
  status: string;
  investableSurplus?: string;
  directors?: any;
}

interface CompanySearchResult {
  cin: string;
  companyName: string;
  city?: string;
  state?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  email?: string;
  phone?: string;
}

export default function LeadProspecting() {
  const { toast } = useToast();
  const [searchCIN, setSearchCIN] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: leads, isLoading } = useQuery<ProspectLead[]>({
    queryKey: ['/api/admin/marketing/leads']
  });

  const [apiError, setApiError] = useState<string | null>(null);
  
  const searchCompaniesMutation = useMutation({
    mutationFn: async (filters: any) => {
      return apiRequest('/api/admin/marketing/leads/search', {
        method: 'POST',
        body: JSON.stringify(filters)
      });
    },
    onSuccess: (data: any) => {
      setSearchResults(data.companies || []);
      if (data.available === false) {
        if (data.usingFallback && data.companies?.length > 0) {
          setApiError(data.fallbackMessage || 'Showing local database results');
          toast({ 
            title: `Found ${data.count || 0} companies from local database`,
            description: 'Probe42 is unavailable. Showing leads from your database instead.',
          });
        } else {
          setApiError(data.error || 'Probe42 API unavailable');
          toast({ 
            title: 'Probe42 API Unavailable',
            description: data.fallbackMessage || 'External company search is currently unavailable.',
            variant: 'destructive'
          });
        }
      } else {
        setApiError(null);
        toast({ title: `Found ${data.count || 0} companies` });
      }
    },
    onError: () => {
      setApiError('Failed to connect to search service');
      toast({ 
        title: 'Search failed',
        description: 'Unable to connect to company search. Try again later or create leads manually.',
        variant: 'destructive'
      });
    }
  });

  const importLeadMutation = useMutation({
    mutationFn: async ({ cin, companyName }: { cin: string; companyName: string }) => {
      return apiRequest('/api/admin/marketing/leads/import', {
        method: 'POST',
        body: JSON.stringify({ cin, companyName })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/leads'] });
      toast({ title: 'Lead imported successfully' });
      setSearchResults([]);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to import lead',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const filters: any = {};
    
    if (formData.get('cin')) filters.cin = formData.get('cin');
    if (formData.get('companyName')) filters.nameStartsWith = formData.get('companyName');
    if (formData.get('city')) filters.city = formData.get('city');
    if (formData.get('state')) filters.state = formData.get('state');
    if (formData.get('minRevenue')) filters.minRevenue = parseInt(formData.get('minRevenue') as string);
    if (formData.get('minProfit')) filters.minProfit = parseInt(formData.get('minProfit') as string);
    if (formData.get('probe42Score')) filters.probe42Score = parseInt(formData.get('probe42Score') as string);

    searchCompaniesMutation.mutate(filters);
  };

  if (isLoading) {
    return <LoadingState variant="list" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Prospecting</h1>
        <p className="text-muted-foreground">
          Search 2.8M Indian companies with Probe42 financial data
        </p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Search Companies</CardTitle>
          <CardDescription>
            Find high-value B2B prospects using financial filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cin">CIN (Company ID)</Label>
                <Input
                  id="cin"
                  name="cin"
                  placeholder="U67120MH2006PTC160511"
                  data-testid="input-cin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Enter company name prefix (e.g., Tata, Reliance)"
                  data-testid="input-company-name"
                />
                <p className="text-xs text-muted-foreground">Required: Enter at least 4 characters (e.g., "Tata", "Reliance")</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Mumbai, Delhi, Bangalore..."
                  data-testid="input-city"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="Maharashtra, Karnataka..."
                  data-testid="input-state"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minRevenue">Min Annual Revenue (₹)</Label>
                <Input
                  id="minRevenue"
                  name="minRevenue"
                  type="number"
                  placeholder="10000000"
                  data-testid="input-min-revenue"
                />
                <p className="text-xs text-muted-foreground">Minimum ₹1 Cr recommended</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minProfit">Min Net Profit (₹)</Label>
                <Input
                  id="minProfit"
                  name="minProfit"
                  type="number"
                  placeholder="1000000"
                  data-testid="input-min-profit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="probe42Score">Probe42 Score (1-5)</Label>
                <Input
                  id="probe42Score"
                  name="probe42Score"
                  type="number"
                  min="1"
                  max="5"
                  placeholder="3"
                  data-testid="input-probe42-score"
                />
                <p className="text-xs text-muted-foreground">Financial health: 5 = Excellent, 1 = Poor</p>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={searchCompaniesMutation.isPending}
              data-testid="button-search"
            >
              <Search className="mr-2 h-4 w-4" />
              {searchCompaniesMutation.isPending ? 'Searching...' : 'Search Companies'}
            </Button>
          </form>

          {/* API Error Alert */}
          {apiError && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Probe42 API Unavailable</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{apiError}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                    You can still create B2B leads manually in the <a href="/admin/prospect-dashboard" className="underline font-medium hover:text-amber-800">Prospect Dashboard</a> or import from Zoho CRM.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="font-semibold">Search Results ({searchResults.length})</h3>
              <div className="space-y-2">
                {searchResults.map((company) => (
                  <div 
                    key={company.cin}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`search-result-${company.cin}`}
                  >
                    <div>
                      <p className="font-medium">{company.companyName}</p>
                      <p className="text-sm text-muted-foreground">
                        CIN: {company.cin} • {company.city}, {company.state}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Capital: ₹{(company.paidUpCapital || 0).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => importLeadMutation.mutate({ cin: company.cin, companyName: company.companyName })}
                      disabled={importLeadMutation.isPending}
                      data-testid={`button-import-${company.cin}`}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Import Lead
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-leads">
              {leads?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-hot-leads">
              {leads?.filter(l => l.leadQuality === 'hot').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-converted-leads">
              {leads?.filter(l => l.status === 'converted').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-score">
              {leads && leads.length > 0
                ? (leads.reduce((sum, l) => sum + l.leadScore, 0) / leads.length).toFixed(0)
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Imported Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Imported Leads</CardTitle>
          <CardDescription>Companies imported from Probe42</CardDescription>
        </CardHeader>
        <CardContent>
          {!leads || leads.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No leads imported yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  data-testid={`lead-${lead.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-full ${
                          lead.leadQuality === 'hot' ? 'bg-orange-100' :
                          lead.leadQuality === 'warm' ? 'bg-yellow-100' :
                          'bg-blue-100'
                        }`}>
                          {lead.leadQuality === 'hot' ? (
                            <Star className="h-5 w-5 text-orange-500" />
                          ) : lead.leadQuality === 'warm' ? (
                            <TrendingUp className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <Users className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold" data-testid={`text-lead-name-${lead.id}`}>
                            {lead.companyName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {lead.city}, {lead.state}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Lead Score</p>
                          <p className="font-semibold">{lead.leadScore}/100</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Probe42 Score</p>
                          <p className="font-semibold">{lead.probe42Score || 'N/A'}/5</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Annual Revenue</p>
                          <p className="font-semibold">
                            {lead.annualRevenue ? `₹${(parseFloat(lead.annualRevenue) / 10000000).toFixed(2)}Cr` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge variant={
                            lead.status === 'converted' ? 'default' :
                            lead.status === 'qualified' ? 'secondary' :
                            'outline'
                          }>
                            {lead.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
