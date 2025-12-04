import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Loader2, Building2, CheckCircle, 
  AlertCircle, Sprout, TrendingUp, Package
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface UnlistedCompany {
  id: string;
  name: string;
  cin?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  status: string;
  listingStage?: string;
  faceValue?: string;
  totalShares?: number;
  lastSyncedAt?: string;
  createdAt?: string;
}

interface StoreProduct {
  id: string;
  name: string;
  sourceCompanyId?: string;
}

export default function SeedUnlistedPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [publishingCompanyId, setPublishingCompanyId] = useState<string | null>(null);

  const { data: companiesData, isLoading: isLoadingCompanies } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/companies?status=active');
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: storeProductsData } = useQuery<{ products: StoreProduct[] }>({
    queryKey: ['/api/admin/store/products'],
  });

  const companies = companiesData || [];
  const storeProducts = storeProductsData?.products || [];

  const publishedCompanyIds = new Set(
    storeProducts
      .filter(p => p.sourceCompanyId)
      .map(p => p.sourceCompanyId)
  );

  const filteredCompanies = companies.filter(company => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(query) ||
      company.cin?.toLowerCase().includes(query) ||
      company.sector?.toLowerCase().includes(query)
    );
  });

  const availableCompanies = filteredCompanies.filter(c => !publishedCompanyIds.has(c.id));
  const alreadyPublishedCompanies = filteredCompanies.filter(c => publishedCompanyIds.has(c.id));

  const publishMutation = useMutation({
    mutationFn: async (companyId: string) => {
      setPublishingCompanyId(companyId);
      return apiRequest(`/api/unlisted/companies/${companyId}/publish-to-store`, { method: 'POST' });
    },
    onSuccess: (data: any, companyId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/products'] });
      setSelectedCompanies(prev => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
      toast({ 
        title: 'Published to Store', 
        description: data?.data?.message || 'Company is now available in the Store under "Unlisted Stocks"'
      });
      setPublishingCompanyId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Publish failed',
        description: error.message || 'Failed to publish company to store',
        variant: 'destructive'
      });
      setPublishingCompanyId(null);
    }
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (companyIds: string[]) => {
      const results = [];
      for (const id of companyIds) {
        try {
          const result = await apiRequest(`/api/unlisted/companies/${id}/publish-to-store`, { method: 'POST' });
          results.push({ id, success: true, result });
        } catch (error: any) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/products'] });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      setSelectedCompanies(new Set());
      
      if (failCount === 0) {
        toast({ 
          title: 'Bulk Publish Complete', 
          description: `Successfully published ${successCount} companies to the Store`
        });
      } else {
        toast({ 
          title: 'Bulk Publish Partial Success', 
          description: `Published ${successCount} companies, ${failCount} failed`,
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk publish failed',
        description: error.message || 'Failed to publish companies',
        variant: 'destructive'
      });
    }
  });

  const toggleSelectAll = () => {
    if (selectedCompanies.size === availableCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(availableCompanies.map(c => c.id)));
    }
  };

  const toggleSelectCompany = (companyId: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const handleBulkPublish = () => {
    if (selectedCompanies.size === 0) {
      toast({ title: 'No companies selected', variant: 'destructive' });
      return;
    }
    bulkPublishMutation.mutate(Array.from(selectedCompanies));
  };

  const getStageBadgeColor = (stage?: string) => {
    switch (stage) {
      case 'pre_ipo': return 'bg-blue-600/20 text-blue-400';
      case 'growth': return 'bg-purple-600/20 text-purple-400';
      case 'mature': return 'bg-cyan-600/20 text-cyan-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'pre_ipo': return 'Pre-IPO';
      case 'growth': return 'Growth';
      case 'mature': return 'Mature';
      default: return 'Unlisted';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/store-management">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Store Management
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sprout className="w-6 h-6 text-emerald-400" />
              Seed Unlisted Stocks
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Select unlisted companies to publish to the Store
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-blue-400 border-blue-400">
            {availableCompanies.length} Available
          </Badge>
          <Badge variant="outline" className="text-green-400 border-green-400">
            {alreadyPublishedCompanies.length} Already Published
          </Badge>
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Available Companies
              </CardTitle>
              <CardDescription className="text-gray-400">
                Select companies to add to the Store under "Unlisted Stocks" category
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {selectedCompanies.size > 0 && (
                <Button
                  onClick={handleBulkPublish}
                  disabled={bulkPublishMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="button-publish-selected"
                >
                  {bulkPublishMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Publish Selected ({selectedCompanies.size})
                </Button>
              )}
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by company name, CIN, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="input-search-companies"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCompanies ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Loading companies...</span>
            </div>
          ) : availableCompanies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium text-white">All companies are already published!</p>
              <p className="text-sm mt-2">No more unlisted companies available to seed</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCompanies.size === availableCompanies.length && availableCompanies.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="text-gray-400">Company Name</TableHead>
                    <TableHead className="text-gray-400">CIN</TableHead>
                    <TableHead className="text-gray-400">Sector</TableHead>
                    <TableHead className="text-gray-400">Stage</TableHead>
                    <TableHead className="text-gray-400">Last Synced</TableHead>
                    <TableHead className="text-right text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableCompanies.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="border-gray-800 hover:bg-gray-800/50"
                      data-testid={`row-company-${company.id}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedCompanies.has(company.id)}
                          onCheckedChange={() => toggleSelectCompany(company.id)}
                          data-testid={`checkbox-company-${company.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-300">
                        {company.cin || 'N/A'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStageBadgeColor(company.listingStage)}>
                          {getStageLabel(company.listingStage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {company.lastSyncedAt 
                          ? format(new Date(company.lastSyncedAt), 'MMM dd, yyyy')
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishMutation.mutate(company.id)}
                          disabled={publishingCompanyId === company.id || publishMutation.isPending}
                          className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
                          data-testid={`button-publish-${company.id}`}
                        >
                          {publishingCompanyId === company.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <TrendingUp className="w-4 h-4 mr-1" />
                              Publish
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {alreadyPublishedCompanies.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Already Published ({alreadyPublishedCompanies.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              These companies are already available in the Store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Company Name</TableHead>
                    <TableHead className="text-gray-400">Sector</TableHead>
                    <TableHead className="text-gray-400">Stage</TableHead>
                    <TableHead className="text-right text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alreadyPublishedCompanies.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="border-gray-800 hover:bg-gray-800/50"
                    >
                      <TableCell className="font-medium text-gray-400">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStageBadgeColor(company.listingStage)}>
                          {getStageLabel(company.listingStage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
