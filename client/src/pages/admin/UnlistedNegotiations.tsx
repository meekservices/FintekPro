import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, TrendingUp, Eye, CheckCircle, ArrowRight, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/LoadingState';
import { format } from 'date-fns';
import { Slider } from '@/components/ui/slider';

interface Negotiation {
  id: string;
  company: {
    id: string;
    name: string;
    cin: string;
    sector: string;
  };
  sellListing: {
    id: string;
    sellerUserId: string;
    quantity: number;
    landingPrice: string;
    floorPrice: string;
    askPrice: string;
  };
  buyRequest: {
    id: string;
    buyerUserId: string;
    quantity: number;
    maxPrice: string;
    targetPrice: string | null;
  };
  matchingBuyRequestsCount: number;
  suggestedMidpoint: number;
  matchScore: number;
  confidence: 'high' | 'medium' | 'low';
  ratios: {
    roe: string;
    roce: string;
    debtToEquity: string;
    currentRatio: string;
    peRatio: string;
  } | null;
  lastDealPrice: string | null;
  lastDealDate: string | null;
}

interface NegotiationsResponse {
  negotiations: Negotiation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function UnlistedNegotiations() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Filter states
  const [companySearch, setCompanySearch] = useState('');
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch negotiations - must be before conditional returns
  const { data, isLoading, error } = useQuery<NegotiationsResponse>({
    queryKey: ['/api/unlisted/admin/negotiations', { 
      page,
      companySearch: companySearch || undefined,
      minMatchScore: minMatchScore > 0 ? minMatchScore : undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (companySearch) params.append('companySearch', companySearch);
      if (minMatchScore > 0) params.append('minMatchScore', minMatchScore.toString());
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);
      
      const res = await fetch(`/api/unlisted/admin/negotiations?${params}`);
      if (!res.ok) throw new Error('Failed to fetch negotiations');
      return res.json();
    },
    enabled: !!user && user.roles?.includes('admin'),
  });

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

  const handleViewDetails = (companyId: string) => {
    window.location.href = `/admin/unlisted/companies?id=${companyId}`;
  };

  const handleApproveDeal = (negotiationId: string) => {
    toast({
      title: 'Deal Approval',
      description: 'Deal approval workflow will be implemented soon',
    });
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-muted/20 text-muted-foreground border-border',
    };
    return colors[confidence as keyof typeof colors] || colors.low;
  };

  const getMatchScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (score >= 50) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Unlisted Negotiations Console</h1>
          <p className="text-muted-foreground mt-1">Loading active negotiations...</p>
        </div>
        <LoadingState variant="table" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Unlisted Negotiations Console</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage active marketplace negotiations</p>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-red-400">Error loading negotiations: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const negotiations = data?.negotiations || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Unlisted Negotiations Console</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage active marketplace negotiations</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">{pagination?.total || 0}</div>
          <div className="text-sm text-muted-foreground">Active Negotiations</div>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-foreground">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Advanced Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Search */}
          <div>
            <Label htmlFor="companySearch" className="text-muted-foreground">Search Company</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="companySearch"
                placeholder="Search by company name or CIN..."
                value={companySearch}
                onChange={(e) => {
                  setCompanySearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-muted border-border text-foreground"
                data-testid="input-company-search"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <>
              {/* Match Score Threshold */}
              <div>
                <Label className="text-muted-foreground">
                  Minimum Match Score: {minMatchScore}%
                </Label>
                <Slider
                  value={[minMatchScore]}
                  onValueChange={(value) => {
                    setMinMatchScore(value[0]);
                    setPage(1);
                  }}
                  min={0}
                  max={100}
                  step={5}
                  className="mt-2"
                  data-testid="slider-match-score"
                />
              </div>

              {/* Price Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minPrice" className="text-muted-foreground">Min Price (₹)</Label>
                  <Input
                    id="minPrice"
                    type="number"
                    placeholder="0"
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      setPage(1);
                    }}
                    className="mt-1 bg-muted border-border text-foreground"
                    data-testid="input-min-price"
                  />
                </div>
                <div>
                  <Label htmlFor="maxPrice" className="text-muted-foreground">Max Price (₹)</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    placeholder="No limit"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      setPage(1);
                    }}
                    className="mt-1 bg-muted border-border text-foreground"
                    data-testid="input-max-price"
                  />
                </div>
              </div>

              {/* Clear Filters */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCompanySearch('');
                  setMinMatchScore(0);
                  setMinPrice('');
                  setMaxPrice('');
                  setPage(1);
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Negotiations Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Active Negotiations</CardTitle>
          <CardDescription className="text-muted-foreground">
            Showing {negotiations.length} of {pagination?.total || 0} negotiations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {negotiations.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No active negotiations found</p>
              <p className="text-muted-foreground text-sm mt-2">
                Try adjusting your filters or check back later
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Company</TableHead>
                    <TableHead className="text-muted-foreground text-right">Seller Landing</TableHead>
                    <TableHead className="text-muted-foreground text-right">Buyer Max</TableHead>
                    <TableHead className="text-muted-foreground text-right">Suggested Mid</TableHead>
                    <TableHead className="text-muted-foreground">Ratios</TableHead>
                    <TableHead className="text-muted-foreground text-right">Last Deal</TableHead>
                    <TableHead className="text-muted-foreground text-center">Match</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negotiations.map((negotiation) => (
                    <TableRow 
                      key={negotiation.id} 
                      className="border-border"
                      data-testid={`row-negotiation-${negotiation.id}`}
                    >
                      {/* Company */}
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{negotiation.company.name}</div>
                          <div className="text-xs text-muted-foreground">{negotiation.company.cin}</div>
                          {negotiation.company.sector && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {negotiation.company.sector}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Seller Landing Price */}
                      <TableCell className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatCurrency(negotiation.sellListing.landingPrice)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {negotiation.sellListing.quantity.toLocaleString()} shares
                        </div>
                      </TableCell>

                      {/* Buyer Max Price */}
                      <TableCell className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatCurrency(negotiation.buyRequest.maxPrice)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {negotiation.matchingBuyRequestsCount} buyer{negotiation.matchingBuyRequestsCount !== 1 ? 's' : ''}
                        </div>
                      </TableCell>

                      {/* Suggested Midpoint */}
                      <TableCell className="text-right">
                        <div className="font-semibold text-blue-400">
                          {formatCurrency(negotiation.suggestedMidpoint)}
                        </div>
                        <Badge variant="outline" className={`mt-1 text-xs ${getConfidenceBadge(negotiation.confidence)}`}>
                          {negotiation.confidence} confidence
                        </Badge>
                      </TableCell>

                      {/* Key Ratios */}
                      <TableCell>
                        {negotiation.ratios ? (
                          <div className="space-y-1 text-xs">
                            <div className="text-muted-foreground">
                              ROE: <span className="text-foreground">{parseFloat(negotiation.ratios.roe).toFixed(2)}%</span>
                            </div>
                            <div className="text-muted-foreground">
                              ROCE: <span className="text-foreground">{parseFloat(negotiation.ratios.roce).toFixed(2)}%</span>
                            </div>
                            <div className="text-muted-foreground">
                              D/E: <span className="text-foreground">{parseFloat(negotiation.ratios.debtToEquity).toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No data</span>
                        )}
                      </TableCell>

                      {/* Last Deal Price */}
                      <TableCell className="text-right">
                        {negotiation.lastDealPrice ? (
                          <div>
                            <div className="font-medium text-foreground">
                              {formatCurrency(negotiation.lastDealPrice)}
                            </div>
                            {negotiation.lastDealDate && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(negotiation.lastDealDate), 'MMM d, yyyy')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No deals</span>
                        )}
                      </TableCell>

                      {/* Match Score */}
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={`${getMatchScoreBadge(negotiation.matchScore)} font-semibold`}
                        >
                          {negotiation.matchScore}%
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(negotiation.company.id)}
                            data-testid={`button-view-${negotiation.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveDeal(negotiation.id)}
                            disabled={negotiation.matchScore < 50}
                            data-testid={`button-approve-${negotiation.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
