import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/LoadingState";
import { Building2, Search, TrendingUp, ShoppingCart, Eye } from "lucide-react";
import type { UnlistedCompany, CompanyRatios, UnlistedPriceHistory } from "@shared/schema";

export default function UnlistedMarketplace() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");

  // Fetch companies
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/companies'],
  });

  // Filter companies
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (company.sector && company.sector.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSector = selectedSector === 'all' || company.sector === selectedSector;
    return matchesSearch && matchesSector && company.status === 'active';
  });

  // Get unique sectors
  const sectors = Array.from(new Set(companies.map(c => c.sector).filter(Boolean))) as string[];

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return '₹0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  if (isLoadingCompanies) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-950 p-6">
        <LoadingState variant="card" count={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 p-4 md:p-6" data-testid="unlisted-marketplace">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Unlisted Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and invest in pre-IPO and unlisted equity opportunities
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 bg-white dark:bg-gray-900">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by company name or sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              {/* Sector Filter */}
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger data-testid="select-sector">
                  <SelectValue placeholder="All Sectors" />
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

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          <Button 
            onClick={() => navigate('/unlisted/sell')}
            data-testid="button-create-sell-listing"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Create Sell Listing
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/unlisted/buy')}
            data-testid="button-create-buy-request"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Create Buy Request
          </Button>
        </div>

        {/* Company Grid */}
        {filteredCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <Card className="bg-white dark:bg-gray-900">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery || selectedSector !== 'all' 
                  ? 'No companies found matching your filters'
                  : 'No companies available at the moment'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ company }: { company: UnlistedCompany }) {
  const [, navigate] = useLocation();

  // Fetch latest ratio data for this company
  const { data: ratios = [] } = useQuery<CompanyRatios[]>({
    queryKey: ['/api/unlisted/companies', company.id, 'ratios'],
  });

  // Fetch price history
  const { data: priceHistory = [] } = useQuery<UnlistedPriceHistory[]>({
    queryKey: ['/api/unlisted/companies', company.id, 'price-history'],
  });

  const latestRatio = ratios[0];
  const lastPrice = priceHistory.find(p => p.sourceType === 'DEAL')?.price;

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return '₹0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
      onClick={() => navigate(`/unlisted/company/${company.id}`)}
      data-testid={`card-company-${company.id}`}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          {company.logo ? (
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-2 truncate" data-testid={`text-company-name-${company.id}`}>
              {company.name}
            </CardTitle>
            {company.sector && (
              <Badge variant="secondary" className="text-xs">
                {company.sector}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Last Price */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Last Price</span>
            <span className="font-semibold text-gray-900 dark:text-white" data-testid={`text-price-${company.id}`}>
              {formatCurrency(lastPrice)}
            </span>
          </div>

          {/* P/E Ratio */}
          {latestRatio?.peRatio && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">P/E Ratio</span>
              <span className="font-semibold text-gray-900 dark:text-white" data-testid={`text-pe-${company.id}`}>
                {Number(latestRatio.peRatio).toFixed(2)}
              </span>
            </div>
          )}

          {/* ROE */}
          {latestRatio?.roe && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">ROE</span>
              <span className="font-semibold text-gray-900 dark:text-white" data-testid={`text-roe-${company.id}`}>
                {(Number(latestRatio.roe) * 100).toFixed(2)}%
              </span>
            </div>
          )}

          {/* Listing Stage */}
          {company.listingStage && (
            <div className="pt-2">
              <Badge variant="outline" className="w-full justify-center capitalize">
                {company.listingStage.replace('_', ' ')}
              </Badge>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/unlisted/company/${company.id}`);
              }}
              data-testid={`button-view-details-${company.id}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
