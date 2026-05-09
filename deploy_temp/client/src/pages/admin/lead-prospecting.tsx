import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, Building2, Star, TrendingUp, Users, Download, Calendar, MapPin, Globe, Mail, Phone, Briefcase, IndianRupee, CheckCircle2, AlertTriangle, Shield, CreditCard, Scale, UserCheck, FileWarning, Landmark, Eye, Building, FileText, User, Network, Loader2 } from 'lucide-react';
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
  credhiveScore?: number;
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
  // Credhive enrichment fields
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
  // Credhive KYC Extended Fields
  sumOfCharges?: string;
  activeCompliance?: string;
  listingStatus?: string;
  entityType?: string;
  companyStatus?: string;
  rocCode?: string;
  numberOfMembers?: number;
  lastAgmDate?: string;
  lastBalanceSheetDate?: string;
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
  sumOfCharges?: number;
  activeCompliance?: string;
  listingStatus?: string;
  entityType?: string;
  isEnriched?: boolean;
  openChargesCount?: number;
  totalChargesAmount?: number;
  suitFiledCasesCount?: number;
  creditRating?: string;
  creditRatingAgency?: string;
  gstStatus?: string;
  gstNumber?: string;
  enrichmentScore?: number;
  enrichmentSources?: string[];
  apiAccessIssues?: string[];
}

interface DirectorCompany {
  cin: string;
  legalName: string;
  companyStatus: string;
  paidUpCapital: number;
  authorizedCapital?: number;
  sumOfCharges: number;
  incorporationDate: string;
  designation: string;
  dateOfAppointment: string;
  dateOfAppointmentForCurrentDesignation?: string;
  dateOfCessation?: string;
  activeCompliance?: string;
  listingStatus?: string;
  entityType?: string;
  city?: string;
  state?: string;
  pincode?: string;
  registeredAddress?: string;
  email?: string;
  phone?: string;
  website?: string;
  companyClass?: string;
  companyCategory?: string;
  isEnriched?: boolean;
}

interface DirectorSearchResult {
  din: string;
  name: string;
  companies: DirectorCompany[];
}

export default function LeadProspecting() {
  const { toast } = useToast();
  const [searchCIN, setSearchCIN] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('company-search');
  const [directorName, setDirectorName] = useState('');
  const [directorResults, setDirectorResults] = useState<DirectorSearchResult[]>([]);
  const [directorApiError, setDirectorApiError] = useState<string | null>(null);

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
            description: 'Credhive is unavailable. Showing leads from your database instead.',
          });
        } else {
          setApiError(data.error || 'Credhive API unavailable');
          toast({ 
            title: 'Credhive API Unavailable',
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
      setDirectorResults([]);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to import lead',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const enrichPreviewMutation = useMutation({
    mutationFn: async ({ cin, companyName }: { cin: string; companyName: string }) => {
      return apiRequest('/api/admin/marketing/leads/enrich-preview', {
        method: 'POST',
        body: JSON.stringify({ cin, companyName })
      });
    },
    onSuccess: (data: any) => {
      setSelectedCompany(data as CompanySearchResult);
      setShowDetailsDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to fetch company details',
        description: error.message || 'Unable to enrich company data. Try importing directly.',
        variant: 'destructive'
      });
    }
  });

  const handleViewDetails = (company: CompanySearchResult | DirectorCompany) => {
    enrichPreviewMutation.mutate({ 
      cin: company.cin, 
      companyName: 'legalName' in company ? company.legalName : company.companyName 
    });
  };

  const searchDirectorsMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('/api/admin/marketing/leads/director-search', {
        method: 'POST',
        body: JSON.stringify({ directorName: name })
      });
    },
    onSuccess: (data: any) => {
      setDirectorResults(data.directors || []);
      if (data.available === false) {
        setDirectorApiError(data.error || 'Director search unavailable');
        toast({ 
          title: 'Director Search Unavailable',
          description: data.error || 'External director search is currently unavailable.',
          variant: 'destructive'
        });
      } else {
        setDirectorApiError(null);
        const totalCompanies = data.directors?.reduce((sum: number, d: DirectorSearchResult) => sum + d.companies.length, 0) || 0;
        toast({ 
          title: `Found ${data.count || 0} directors`,
          description: `Associated with ${totalCompanies} companies (${data.enrichedCompanies || 0} fully enriched)`
        });
        if (data.warning) {
          toast({
            title: 'Partial Enrichment',
            description: data.warning,
            variant: 'default'
          });
        }
      }
    },
    onError: () => {
      setDirectorApiError('Failed to connect to director search service');
      toast({ 
        title: 'Director search failed',
        description: 'Unable to connect to director search. Try again later.',
        variant: 'destructive'
      });
    }
  });

  const handleDirectorSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (directorName.trim().length < 3) {
      toast({
        title: 'Invalid search',
        description: 'Director name must be at least 3 characters',
        variant: 'destructive'
      });
      return;
    }
    setDirectorApiError(null);
    setDirectorResults([]);
    searchDirectorsMutation.mutate(directorName.trim());
  };

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
    if (formData.get('credhiveScore')) {
      filters.credhiveScore = parseInt(formData.get('credhiveScore') as string);
    }

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
          Search 2.8M Indian companies with Credhive financial data
        </p>
      </div>

      {/* Search Section with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Search Prospects</CardTitle>
          <CardDescription>
            Find high-value B2B prospects by company name or director network
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="company-search" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Search
              </TabsTrigger>
              <TabsTrigger value="director-lookup" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Director Lookup
              </TabsTrigger>
            </TabsList>

            {/* Company Search Tab */}
            <TabsContent value="company-search">
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
                <Label htmlFor="credhiveScore">Credhive Score (1-5)</Label>
                <Input
                  id="credhiveScore"
                  name="credhiveScore"
                  type="number"
                  min="1"
                  max="5"
                  placeholder="3"
                  data-testid="input-credhive-score"
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
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Credhive API Unavailable</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{apiError}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                    You can still create B2B leads manually in the <a href="/admin/prospect-dashboard" className="underline font-medium hover:text-amber-800 dark:text-amber-200">Prospect Dashboard</a> or import from Zoho CRM.
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(company)}
                          disabled={enrichPreviewMutation.isPending}
                          data-testid={`button-details-${company.cin}`}
                        >
                          {enrichPreviewMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="mr-2 h-4 w-4" />
                          )}
                          {enrichPreviewMutation.isPending ? 'Loading...' : 'View Details'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => importLeadMutation.mutate({ cin: company.cin, companyName: company.companyName })}
                          disabled={importLeadMutation.isPending}
                          data-testid={`button-import-${company.cin}`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Import
                        </Button>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
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
            </TabsContent>

            {/* Director Lookup Tab */}
            <TabsContent value="director-lookup">
              <form onSubmit={handleDirectorSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="directorName">Director Name <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      id="directorName"
                      value={directorName}
                      onChange={(e) => setDirectorName(e.target.value)}
                      placeholder="Enter director name (e.g., Ratan Tata, Mukesh Ambani)"
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      disabled={searchDirectorsMutation.isPending}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      {searchDirectorsMutation.isPending ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search for directors to discover their company associations with financial data
                  </p>
                </div>
              </form>

              {/* Loading State */}
              {searchDirectorsMutation.isPending && (
                <div className="mt-6 flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                  <p className="text-muted-foreground">Searching directors and enriching company data...</p>
                  <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
                </div>
              )}

              {/* Director API Error Alert */}
              {directorApiError && !searchDirectorsMutation.isPending && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-800 dark:text-amber-200">Director Search Unavailable</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{directorApiError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Director Search Results */}
              {directorResults.length > 0 && !searchDirectorsMutation.isPending && (
                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold">
                    Found {directorResults.length} Directors 
                    <span className="text-muted-foreground font-normal ml-2">
                      ({directorResults.reduce((sum, d) => sum + d.companies.length, 0)} associated companies)
                    </span>
                  </h3>
                  
                  <Accordion type="multiple" className="w-full space-y-2">
                    {directorResults.map((director, idx) => (
                      <AccordionItem key={director.din || idx} value={director.din || `director-${idx}`} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex items-center gap-3 text-left">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{director.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {director.din && <span className="font-mono">DIN: {director.din} • </span>}
                                {director.companies.length} {director.companies.length === 1 ? 'company' : 'companies'}
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pb-4">
                            {director.companies.map((company, compIdx) => (
                              <div 
                                key={company.cin || compIdx}
                                className="p-4 border rounded-lg bg-muted/30 hover:border-primary/50 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="font-semibold">{company.legalName}</h5>
                                      <Badge variant={company.companyStatus === 'Active' ? 'default' : 'secondary'} className="text-xs">
                                        {company.companyStatus}
                                      </Badge>
                                      {company.listingStatus && company.listingStatus !== 'Unlisted' && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                          {company.listingStatus}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono mt-1">CIN: {company.cin}</p>
                                  </div>
                                  <div className="flex gap-2 items-center">
                                    {!company.isEnriched && (
                                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:border-amber-700">
                                        Limited Data
                                      </Badge>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewDetails(company)}
                                      disabled={enrichPreviewMutation.isPending}
                                    >
                                      {enrichPreviewMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Eye className="mr-2 h-4 w-4" />
                                      )}
                                      {enrichPreviewMutation.isPending ? 'Loading...' : 'Details'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => importLeadMutation.mutate({ cin: company.cin, companyName: company.legalName })}
                                      disabled={importLeadMutation.isPending}
                                    >
                                      <Download className="mr-2 h-4 w-4" />
                                      Import
                                    </Button>
                                  </div>
                                </div>

                                {/* Company Details Grid */}
                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm">
                                  {/* Director Role */}
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Briefcase className="h-4 w-4 text-purple-600" />
                                    <span><strong>Role:</strong> {company.designation || 'Director'}</span>
                                  </div>

                                  {/* Appointment Date */}
                                  {company.dateOfAppointment && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4 text-blue-600" />
                                      <span>
                                        <strong>Appointed:</strong> {new Date(company.dateOfAppointment).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  )}

                                  {/* Cessation Date */}
                                  {company.dateOfCessation && (
                                    <div className="flex items-center gap-2 text-red-600">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span>
                                        <strong>Ceased:</strong> {new Date(company.dateOfCessation).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  )}

                                  {/* Paid-up Capital */}
                                  {company.paidUpCapital > 0 && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <IndianRupee className="h-4 w-4 text-green-600" />
                                      <span>
                                        <strong>Paid-up:</strong> ₹{company.paidUpCapital.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  )}

                                  {/* Sum of Charges */}
                                  {company.sumOfCharges > 0 && (
                                    <div className="flex items-center gap-2 text-amber-600">
                                      <CreditCard className="h-4 w-4" />
                                      <span>
                                        <strong>Charges:</strong> ₹{company.sumOfCharges.toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  )}

                                  {/* Compliance */}
                                  {company.activeCompliance && (
                                    <div className="flex items-center gap-2">
                                      {company.activeCompliance === 'Yes' ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                      )}
                                      <span className={company.activeCompliance === 'Yes' ? 'text-green-600' : 'text-red-600'}>
                                        <strong>Compliance:</strong> {company.activeCompliance}
                                      </span>
                                    </div>
                                  )}

                                  {/* Location */}
                                  {(company.city || company.state) && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <MapPin className="h-4 w-4 text-red-500" />
                                      <span>{[company.city, company.state].filter(Boolean).join(', ')}</span>
                                    </div>
                                  )}

                                  {/* Incorporation Date */}
                                  {company.incorporationDate && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <span>
                                        <strong>Since:</strong> {new Date(company.incorporationDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </TabsContent>
          </Tabs>
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
          <CardDescription>Companies imported from Credhive</CardDescription>
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
                        lead.leadQuality === 'hot' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        lead.leadQuality === 'warm' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        'bg-blue-100 dark:bg-blue-900/30'
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
                          <div className="flex items-center gap-1">
                            <strong>Status:</strong>
                            <Badge 
                              variant={lead.listingStatus === 'Listed' ? 'default' : 'secondary'} 
                              className="text-xs ml-1"
                            >
                              {lead.listingStatus}
                            </Badge>
                          </div>
                        )}
                        {lead.activeCompliance && (
                          <div className="flex items-center gap-1">
                            <strong>Compliance:</strong>
                            <Badge 
                              variant={lead.activeCompliance?.toLowerCase().includes('compliant') && !lead.activeCompliance?.toLowerCase().includes('non') ? 'default' : 'destructive'} 
                              className="text-xs ml-1"
                            >
                              {lead.activeCompliance}
                            </Badge>
                          </div>
                        )}
                        {lead.entityType && (
                          <p className="text-xs text-muted-foreground truncate" title={lead.entityType}>
                            {lead.entityType.length > 30 ? lead.entityType.substring(0, 30) + '...' : lead.entityType}
                          </p>
                        )}
                        <div className="flex items-center gap-1">
                          <strong>GST:</strong> 
                          {lead.gstStatus ? (
                            <Badge 
                              variant={lead.gstStatus === 'Active' ? 'default' : lead.gstStatus === 'Not Registered' ? 'secondary' : 'destructive'} 
                              className="text-xs ml-1"
                            >
                              {lead.gstStatus}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs ml-1">Unknown</span>}
                        </div>
                      </div>
                    </div>

                    {/* Credit & Charges */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Credit
                      </h4>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
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
                        </div>
                        {lead.creditRatingAgency && <p className="text-xs text-muted-foreground">{lead.creditRatingAgency}</p>}
                        <div className="flex items-center gap-1"><strong>Charges:</strong> {(lead.openChargesCount || 0) === 0 ? 
                          <Badge variant="secondary" className="text-xs ml-1">None</Badge> : 
                          <Badge variant="destructive" className="text-xs ml-1">{lead.openChargesCount} open</Badge>}
                        </div>
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
                        <div className="flex items-center gap-1">
                          <strong>Legal Cases:</strong>
                          {(lead.activeLegalCases || 0) > 0 ? (
                            <Badge variant="destructive" className="text-xs ml-1">{lead.activeLegalCases} active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs ml-1">None</Badge>
                          )}
                        </div>
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
                          <div key={idx} className="text-xs p-2 bg-card rounded border">
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

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Details
            </DialogTitle>
            <DialogDescription>
              Review all available information before importing
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Quick Summary Card */}
                <div className="p-4 bg-gradient-to-r from-background to-muted rounded-lg border">
                  <h3 className="font-semibold text-lg mb-3">{selectedCompany.companyName}</h3>
                  
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {/* Enrichment Score */}
                    <div className="text-center p-2 bg-card rounded border">
                      <div className={`text-xl font-bold ${
                        (selectedCompany.enrichmentScore || 0) >= 70 ? 'text-green-600' :
                        (selectedCompany.enrichmentScore || 0) >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selectedCompany.enrichmentScore || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Data Score</div>
                    </div>
                    
                    {/* Total Debt/Charges */}
                    {selectedCompany.totalChargesAmount && selectedCompany.totalChargesAmount > 0 ? (
                      <div className="text-center p-2 bg-card rounded border">
                        <div className="text-xl font-bold text-amber-600">
                          ₹{(selectedCompany.totalChargesAmount / 10000000).toFixed(0)} Cr
                        </div>
                        <div className="text-xs text-muted-foreground">Total Debt</div>
                      </div>
                    ) : (
                      <div className="text-center p-2 bg-card rounded border">
                        <div className="text-xl font-bold text-green-600">₹0</div>
                        <div className="text-xs text-muted-foreground">Total Debt</div>
                      </div>
                    )}
                    
                    {/* Open Charges */}
                    <div className="text-center p-2 bg-card rounded border">
                      <div className={`text-xl font-bold ${(selectedCompany.openChargesCount || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {selectedCompany.openChargesCount || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Open Charges</div>
                    </div>
                    
                    {/* Legal Cases */}
                    <div className="text-center p-2 bg-card rounded border">
                      <div className={`text-xl font-bold ${(selectedCompany.suitFiledCasesCount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedCompany.suitFiledCasesCount || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Legal Cases</div>
                    </div>
                  </div>

                  {/* Risk Indicator */}
                  {((selectedCompany.totalChargesAmount && selectedCompany.totalChargesAmount > 1000000000) || 
                    (selectedCompany.suitFiledCasesCount && selectedCompany.suitFiledCasesCount > 0)) && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-red-700 dark:text-red-300 font-medium">
                        High Risk: {selectedCompany.totalChargesAmount && selectedCompany.totalChargesAmount > 1000000000 ? 'Large debt exposure' : ''} 
                        {selectedCompany.suitFiledCasesCount && selectedCompany.suitFiledCasesCount > 0 ? ` • ${selectedCompany.suitFiledCasesCount} legal case(s)` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Limited Data Warning */}
                {selectedCompany.isEnriched === false && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Limited data available. Full financial details will be fetched upon import.</span>
                    </div>
                  </div>
                )}
                
                {/* Company Identity */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company Identity
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">CIN:</span>
                      <span className="font-mono text-muted-foreground text-xs">{selectedCompany.cin}</span>
                    </div>
                    {selectedCompany.status && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <Badge variant={selectedCompany.status === 'Active' ? 'default' : 'destructive'} className="text-xs">
                          {selectedCompany.status}
                        </Badge>
                      </div>
                    )}
                    {selectedCompany.companyType && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Type:</span>
                        <span className="text-muted-foreground">{selectedCompany.companyType}</span>
                      </div>
                    )}
                    {selectedCompany.companyClass && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Class:</span>
                        <span className="text-muted-foreground">{selectedCompany.companyClass}</span>
                      </div>
                    )}
                    {selectedCompany.companyCategory && (
                      <div className="flex items-center gap-2 col-span-2">
                        <span className="font-medium">Category:</span>
                        <span className="text-muted-foreground">{selectedCompany.companyCategory}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Financial Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Financial Information
                  </h4>
                  <div className="grid gap-2 text-sm">
                    {selectedCompany.authorizedCapital && selectedCompany.authorizedCapital > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Authorized Capital:</span>
                        <span className="text-muted-foreground">₹{selectedCompany.authorizedCapital.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedCompany.paidUpCapital && selectedCompany.paidUpCapital > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Paid-up Capital:</span>
                        <span className="text-muted-foreground">₹{selectedCompany.paidUpCapital.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedCompany.totalChargesAmount && selectedCompany.totalChargesAmount > 0 && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-amber-600" />
                        <span className="font-medium">Total Charges/Debt:</span>
                        <span className="text-amber-600 font-semibold">₹{selectedCompany.totalChargesAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedCompany.openChargesCount !== undefined && selectedCompany.openChargesCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Open Charges:</span>
                        <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700">{selectedCompany.openChargesCount} active</Badge>
                      </div>
                    )}
                    {selectedCompany.creditRating && (
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">Credit Rating:</span>
                        <Badge variant="default">{selectedCompany.creditRating}</Badge>
                        {selectedCompany.creditRatingAgency && (
                          <span className="text-muted-foreground text-xs">({selectedCompany.creditRatingAgency})</span>
                        )}
                      </div>
                    )}
                    {(!selectedCompany.authorizedCapital || selectedCompany.authorizedCapital === 0) && 
                     (!selectedCompany.paidUpCapital || selectedCompany.paidUpCapital === 0) &&
                     (!selectedCompany.totalChargesAmount || selectedCompany.totalChargesAmount === 0) && (
                      <p className="text-muted-foreground italic">Financial data will be fetched upon import</p>
                    )}
                  </div>
                </div>

                {/* Risk & Legal Section */}
                {(selectedCompany.suitFiledCasesCount !== undefined && selectedCompany.suitFiledCasesCount > 0) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Risk & Legal
                      </h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FileWarning className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Suit Filed Cases:</span>
                          <Badge variant="destructive">{selectedCompany.suitFiledCasesCount} cases</Badge>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Compliance Section - Only show if any compliance data is available */}
                {(selectedCompany.listingStatus || selectedCompany.activeCompliance || selectedCompany.entityType) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Compliance & Entity
                      </h4>
                      <div className="grid gap-2 text-sm">
                        {selectedCompany.listingStatus && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Listing Status:</span>
                            <Badge variant={selectedCompany.listingStatus === 'Listed' ? 'default' : 'secondary'}>
                              {selectedCompany.listingStatus}
                            </Badge>
                          </div>
                        )}
                        {selectedCompany.activeCompliance && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Active Compliance:</span>
                            <Badge variant={(() => {
                              const compliance = selectedCompany.activeCompliance?.toLowerCase() || '';
                              return compliance.includes('yes') || compliance.includes('compliant') ? 'default' : 'destructive';
                            })()}>
                              {selectedCompany.activeCompliance}
                            </Badge>
                          </div>
                        )}
                        {selectedCompany.entityType && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Entity Type:</span>
                            <span className="text-muted-foreground">{selectedCompany.entityType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Registration Details */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Registration Details
                  </h4>
                  <div className="grid gap-2 text-sm">
                    {selectedCompany.incorporationDate && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Incorporation Date:</span>
                        <span className="text-muted-foreground">
                          {new Date(selectedCompany.incorporationDate).toLocaleDateString('en-IN', { 
                            year: 'numeric', month: 'long', day: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Contact & Location */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Contact & Location
                  </h4>
                  <div className="grid gap-2 text-sm">
                    {(selectedCompany.city || selectedCompany.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Location:</span>
                        <span className="text-muted-foreground">
                          {[selectedCompany.city, selectedCompany.state, selectedCompany.pincode].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedCompany.registeredAddress && (
                      <div className="flex items-start gap-2">
                        <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Registered Address:</span>
                          <p className="text-muted-foreground mt-1">{selectedCompany.registeredAddress}</p>
                        </div>
                      </div>
                    )}
                    {selectedCompany.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <a href={`mailto:${selectedCompany.email}`} className="text-primary hover:underline">
                          {selectedCompany.email}
                        </a>
                      </div>
                    )}
                    {selectedCompany.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>
                        <span className="text-muted-foreground">{selectedCompany.phone}</span>
                      </div>
                    )}
                    {selectedCompany.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Website:</span>
                        <a 
                          href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedCompany.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Quality & Enrichment */}
                {(selectedCompany.enrichmentScore !== undefined || 
                  (selectedCompany.apiAccessIssues && selectedCompany.apiAccessIssues.length > 0)) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Data Quality
                      </h4>
                      <div className="space-y-3">
                        {selectedCompany.enrichmentScore !== undefined && (
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-sm">Enrichment Score:</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    selectedCompany.enrichmentScore >= 70 ? 'bg-green-500' :
                                    selectedCompany.enrichmentScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${selectedCompany.enrichmentScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{selectedCompany.enrichmentScore}%</span>
                            </div>
                          </div>
                        )}
                        {selectedCompany.enrichmentSources && selectedCompany.enrichmentSources.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {selectedCompany.enrichmentSources.map((source, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {source.replace(/-/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {selectedCompany.apiAccessIssues && selectedCompany.apiAccessIssues.length > 0 && (
                          <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-amber-700 dark:text-amber-300">Some data unavailable:</span>
                                <ul className="mt-1 text-amber-600 dark:text-amber-400 space-y-0.5">
                                  {selectedCompany.apiAccessIssues.slice(0, 3).map((issue, idx) => (
                                    <li key={idx}>{issue.replace(/&amp;/g, '&')}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedCompany) {
                  importLeadMutation.mutate({ cin: selectedCompany.cin, companyName: selectedCompany.companyName });
                  setShowDetailsDialog(false);
                }
              }}
              disabled={importLeadMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              Import Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
