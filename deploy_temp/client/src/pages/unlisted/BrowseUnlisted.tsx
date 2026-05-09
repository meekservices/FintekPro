import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Search, TrendingUp, BarChart3, Eye, ShoppingCart } from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { CartBadge } from '@/components/UnlistedCart';
import { Link } from 'wouter';

type UnlistedCompany = {
  id: string;
  name: string;
  cin?: string;
  sector?: string;
  status: 'active' | 'inactive' | 'delisted';
  lastSyncedAt?: string;
};

export default function BrowseUnlisted() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sectorFilter, setSectorFilter] = useState('all');

  // Fetch companies
  const { data: companies, isLoading } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/companies', { status: statusFilter !== 'all' ? statusFilter : undefined, sector: sectorFilter !== 'all' ? sectorFilter : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (sectorFilter !== 'all') params.append('sector', sectorFilter);
      
      const response = await fetch(`/api/unlisted/companies?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
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
    return <LoadingState />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Unlisted Companies Marketplace</h1>
          <p className="text-muted-foreground">
            Browse and trade shares of unlisted companies with verified financial data
          </p>
        </div>
        <Link href="/unlisted/cart">
          <Button variant="outline" className="relative" data-testid="button-view-cart">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            <CartBadge />
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or CIN"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="delisted">Delisted</SelectItem>
              </SelectContent>
            </Select>

            {/* Sector Filter */}
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger data-testid="select-sector-filter">
                <SelectValue placeholder="Filter by sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(sector => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {filteredCompanies.length} {filteredCompanies.length === 1 ? 'Company' : 'Companies'}
          </h2>
        </div>

        {filteredCompanies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies found"
            description="Try adjusting your filters or search query"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map((company) => (
              <Card 
                key={company.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                data-testid={`card-company-${company.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-2 text-lg" data-testid={`text-company-name-${company.id}`}>
                        {company.name}
                      </CardTitle>
                      {company.cin && (
                        <CardDescription className="text-xs mt-1">
                          CIN: {company.cin}
                        </CardDescription>
                      )}
                    </div>
                    <Badge 
                      variant={company.status === 'active' ? 'default' : 'secondary'}
                      className="shrink-0"
                      data-testid={`badge-status-${company.id}`}
                    >
                      {company.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {company.sector && (
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {company.sector}
                        </span>
                      </div>
                    )}

                    {company.lastSyncedAt && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">
                          Data synced from Credhive
                        </span>
                      </div>
                    )}

                    <Button 
                      className="w-full mt-2"
                      onClick={() => setLocation(`/unlisted/company/${company.id}`)}
                      data-testid={`button-view-details-${company.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
