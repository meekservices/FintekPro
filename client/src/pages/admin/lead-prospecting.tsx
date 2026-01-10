import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, Star, TrendingUp, Users, Download, Calendar, MapPin, Globe, Mail, Phone, Briefcase, IndianRupee, CheckCircle2, AlertTriangle, Shield, CreditCard, Scale, UserCheck, FileWarning, Landmark } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ProspectLead {
  id: string;
  cin?: string;
  companyName: string;
  city?: string;
  state?: string;
  paidUpCapital?: string;
  authorizedCapital?: string;
  annualRevenue?: string;
  netProfit?: string;
  probe42Score?: number;
  leadScore: number;
  leadQuality: string;
  status: string;
  investableSurplus?: string;
  directors?: Array<{
    din?: string;
    name?: string;
    designation?: string;
    email?: string;
    phone?: string;
    otherCompaniesCount?: number;
  }>;
  // Probe42 v2 enrichment fields
  employeeCount?: number;
  gstStatus?: string;
  gstNumber?: string;
  creditRating?: string;
  creditRatingAgency?: string;
  creditRatingOutlook?: string;
  openChargesCount?: number;
  totalChargesAmount?: string;
  chargeHolders?: string[];
  suitFiledCasesCount?: number;
  activeLegalCases?: number;
  riskIndicators?: string[];
  enrichmentScore?: number;
  enrichmentSources?: string[];
  enrichedAt?: string;
  incorporationDate?: string;
  companyType?: string;
  companyClass?: string;
}

interface CompanySearchResult {
  cin: string;
  companyName: string;
  city?: string;
  state?: string;
  pincode?: string;
  registeredAddress?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  email?: string;
  phone?: string;
  website?: string;
  incorporationDate?: string;
  companyClass?: string;
  companyCategory?: string;
  companyType?: string;
  status?: string;
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
              <div className="space-y-3">
                {searchResults.map((company) => (
                  <div 
                    key={company.cin}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                    data-testid={`search-result-${company.cin}`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-lg">{company.companyName}</h4>
                          {company.status && (
                            <Badge variant={company.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                              {company.status}
                            </Badge>
                          )}
                          {company.companyType && (
                            <Badge variant="outline" className="text-xs">
                              {company.companyType}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono mt-1">CIN: {company.cin}</p>
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

                    {/* Details Grid */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
                      {/* Capital Info */}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IndianRupee className="h-4 w-4 text-green-600" />
                        <span>
                          <strong>Paid-up:</strong> ₹{(company.paidUpCapital || 0).toLocaleString('en-IN')}
                          {company.authorizedCapital ? ` | Auth: ₹${company.authorizedCapital.toLocaleString('en-IN')}` : ''}
                        </span>
                      </div>

                      {/* Incorporation Date */}
                      {company.incorporationDate && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span>
                            <strong>Since:</strong> {new Date(company.incorporationDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}

                      {/* Category/Class */}
                      {(company.companyCategory || company.companyClass) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-4 w-4 text-purple-600" />
                          <span className="truncate">
                            {company.companyCategory || company.companyClass}
                          </span>
                        </div>
                      )}

                      {/* Location */}
                      {(company.city || company.state) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-red-500" />
                          <span>
                            {[company.city, company.state, company.pincode].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Email */}
                      {company.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 text-orange-500" />
                          <span className="truncate">{company.email}</span>
                        </div>
                      )}

                      {/* Phone */}
                      {company.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 text-teal-600" />
                          <span>{company.phone}</span>
                        </div>
                      )}

                      {/* Website */}
                      {company.website && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe className="h-4 w-4 text-indigo-500" />
                          <a 
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate"
                          >
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Address (if available and different from city/state) */}
                    {company.registeredAddress && company.registeredAddress.length > 30 && (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                        <p className="text-xs"><strong>Registered Address:</strong> {company.registeredAddress}</p>
                      </div>
                    )}
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
                  className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  data-testid={`lead-${lead.id}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg" data-testid={`text-lead-name-${lead.id}`}>
                            {lead.companyName}
                          </h3>
                          {lead.companyType && (
                            <Badge variant="outline" className="text-xs">{lead.companyType}</Badge>
                          )}
                          <Badge variant={lead.status === 'converted' ? 'default' : lead.status === 'qualified' ? 'secondary' : 'outline'}>
                            {lead.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          CIN: {lead.cin} {lead.city && lead.state && `• ${lead.city}, ${lead.state}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{lead.leadScore}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                      <p className="text-xs text-muted-foreground">Lead Score</p>
                    </div>
                  </div>

                  {/* Risk Indicators */}
                  {lead.riskIndicators && lead.riskIndicators.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">Risk Indicators</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lead.riskIndicators.map((risk, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">{risk}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Metrics Grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                    {/* Financial */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" /> Financial
                      </h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Revenue:</strong> {lead.annualRevenue ? `₹${(parseFloat(lead.annualRevenue) / 10000000).toFixed(2)}Cr` : 'N/A'}</p>
                        <p><strong>Paid-up:</strong> {lead.paidUpCapital ? `₹${(parseFloat(lead.paidUpCapital) / 10000000).toFixed(2)}Cr` : 'N/A'}</p>
                        <p><strong>Net Profit:</strong> {lead.netProfit ? `₹${(parseFloat(lead.netProfit) / 10000000).toFixed(2)}Cr` : 'N/A'}</p>
                        {lead.sumOfCharges && (
                          <p><strong>Total Debt:</strong> <span className="text-orange-600">₹{(parseFloat(lead.sumOfCharges) / 10000000).toFixed(2)}Cr</span></p>
                        )}
                      </div>
                    </div>

                    {/* Entity & Compliance */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Entity & Compliance
                      </h4>
                      <div className="text-sm space-y-1">
                        {lead.listingStatus && (
                          <p className="flex items-center gap-1">
                            <strong>Status:</strong>
                            <Badge 
                              variant={lead.listingStatus === 'Listed' ? 'default' : 'secondary'} 
                              className="text-xs ml-1"
                            >
                              {lead.listingStatus}
                            </Badge>
                          </p>
                        )}
                        {lead.activeCompliance && (
                          <p className="flex items-center gap-1">
                            <strong>Compliance:</strong>
                            <Badge 
                              variant={lead.activeCompliance?.toLowerCase().includes('compliant') && !lead.activeCompliance?.toLowerCase().includes('non') ? 'default' : 'destructive'} 
                              className="text-xs ml-1"
                            >
                              {lead.activeCompliance}
                            </Badge>
                          </p>
                        )}
                        {lead.entityType && (
                          <p className="text-xs text-muted-foreground truncate" title={lead.entityType}>
                            {lead.entityType.length > 30 ? lead.entityType.substring(0, 30) + '...' : lead.entityType}
                          </p>
                        )}
                        <p className="flex items-center gap-1">
                          <strong>GST:</strong> 
                          {lead.gstStatus ? (
                            <Badge 
                              variant={lead.gstStatus === 'Active' ? 'default' : lead.gstStatus === 'Not Registered' ? 'secondary' : 'destructive'} 
                              className="text-xs ml-1"
                            >
                              {lead.gstStatus}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs ml-1">Unknown</span>}
                        </p>
                      </div>
                    </div>

                    {/* Credit & Charges */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Credit
                      </h4>
                      <div className="text-sm space-y-1">
                        <p className="flex items-center gap-1">
                          <strong>Rating:</strong> 
                          {lead.creditRating ? (
                            <>
                              <Badge 
                                variant={lead.creditRating === 'Not Rated' ? 'secondary' : 'default'} 
                                className="text-xs ml-1"
                              >
                                {lead.creditRating}
                              </Badge>
                              {lead.creditRatingOutlook && (
                                <span className={`text-xs ${lead.creditRatingOutlook === 'Positive' ? 'text-green-600' : lead.creditRatingOutlook === 'Negative' ? 'text-red-600' : ''}`}>
                                  ({lead.creditRatingOutlook})
                                </span>
                              )}
                            </>
                          ) : <span className="text-muted-foreground text-xs ml-1">Unknown</span>}
                        </p>
                        {lead.creditRatingAgency && <p className="text-xs text-muted-foreground">{lead.creditRatingAgency}</p>}
                        <p><strong>Charges:</strong> {(lead.openChargesCount || 0) === 0 ? 
                          <Badge variant="secondary" className="text-xs ml-1">None</Badge> : 
                          <Badge variant="destructive" className="text-xs ml-1">{lead.openChargesCount} open</Badge>}
                        </p>
                        {lead.totalChargesAmount && parseFloat(lead.totalChargesAmount) > 0 && (
                          <p className="text-xs">₹{(parseFloat(lead.totalChargesAmount) / 10000000).toFixed(2)}Cr</p>
                        )}
                      </div>
                    </div>

                    {/* Legal & Size */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Scale className="h-3 w-3" /> Legal & Size
                      </h4>
                      <div className="text-sm space-y-1">
                        <p className="flex items-center gap-1">
                          <strong>Legal Cases:</strong>
                          {(lead.activeLegalCases || 0) > 0 ? (
                            <Badge variant="destructive" className="text-xs ml-1">{lead.activeLegalCases} active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs ml-1">None</Badge>
                          )}
                        </p>
                        {lead.suitFiledCasesCount !== undefined && lead.suitFiledCasesCount > 0 && (
                          <p className="text-xs text-muted-foreground">{lead.suitFiledCasesCount} suits filed</p>
                        )}
                        <p><strong>Employees:</strong> {lead.employeeCount ? lead.employeeCount.toLocaleString() : 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Director Network Section */}
                  {lead.directors && lead.directors.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                        <Users className="h-3 w-3" /> Board of Directors ({lead.directors.length})
                      </h4>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {lead.directors.slice(0, 6).map((director, idx) => (
                          <div key={idx} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                            <p className="font-medium truncate">{director.name || 'Unknown'}</p>
                            {director.designation && (
                              <p className="text-muted-foreground">{director.designation}</p>
                            )}
                            {director.din && (
                              <p className="text-muted-foreground font-mono">DIN: {director.din}</p>
                            )}
                            {(director.email || director.phone) && (
                              <div className="mt-1 flex items-center gap-2">
                                {director.email && (
                                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Mail className="h-3 w-3" /> {director.email}
                                  </span>
                                )}
                                {director.phone && (
                                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <Phone className="h-3 w-3" /> {director.phone}
                                  </span>
                                )}
                              </div>
                            )}
                            {director.otherCompaniesCount && director.otherCompaniesCount > 0 && (
                              <p className="mt-1 text-orange-600 dark:text-orange-400">
                                +{director.otherCompaniesCount} other companies
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {lead.directors.length > 6 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          +{lead.directors.length - 6} more directors
                        </p>
                      )}
                    </div>
                  )}

                  {/* Enrichment Footer */}
                  {lead.enrichmentScore && (
                    <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          Data Quality: {lead.enrichmentScore}%
                        </span>
                        {lead.enrichmentSources && (
                          <span>{lead.enrichmentSources.length}/10 sources</span>
                        )}
                      </div>
                      {lead.enrichedAt && (
                        <span>Enriched: {new Date(lead.enrichedAt).toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
