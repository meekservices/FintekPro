import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/LoadingState";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ShoppingCart, Shield, AlertCircle, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertBuyRequestSchema, type UnlistedCompany, type SellListing, type User } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Extended validation schema
const buyRequestFormSchema = insertBuyRequestSchema.extend({
  validUntil: z.string().min(1, "Valid until date is required"),
});

type BuyRequestFormData = z.infer<typeof buyRequestFormSchema>;

export default function CreateBuyRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("browse");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");

  // Get pre-selected company from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedCompanyId = urlParams.get('company') || "";

  // Fetch companies
  const { data: companiesResponse, isLoading: isLoadingCompanies } = useQuery<{ data: UnlistedCompany[] }>({
    queryKey: ['/api/unlisted/companies'],
  });
  const companies = companiesResponse?.data || [];

  // Fetch all sell listings
  const { data: listingsResponse, isLoading: isLoadingListings } = useQuery<{ data: SellListing[] }>({
    queryKey: ['/api/unlisted/all-listings'],
    enabled: activeTab === 'browse',
  });
  const allListings = listingsResponse?.data || [];

  // Check KYC tier
  const kycTier = (user as any)?.kycTier || 'basic';
  const isKycEligible = kycTier === 'enhanced' || kycTier === 'accredited_investor';

  const form = useForm<BuyRequestFormData>({
    resolver: zodResolver(buyRequestFormSchema),
    defaultValues: {
      companyId: preSelectedCompanyId,
      quantity: 0,
      maxPrice: "0",
      targetPrice: "0",
      validUntil: "",
      preferredLotSize: 0,
      notes: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: BuyRequestFormData) => {
      const response = await apiRequest('/api/unlisted/buy-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          validUntil: new Date(data.validUntil).toISOString(),
        }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Buy Request Created",
        description: "Your buy request has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/buy-requests'] });
      navigate('/unlisted/browse');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create buy request",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BuyRequestFormData) => {
    if (!isKycEligible) {
      toast({
        title: "KYC Upgrade Required",
        description: "Please upgrade your KYC to Enhanced or Accredited Investor tier",
        variant: "destructive",
      });
      return;
    }
    createRequestMutation.mutate(data);
  };

  // Filter listings by company
  const filteredListings = selectedCompanyFilter === 'all' 
    ? allListings 
    : allListings.filter(l => l.companyId === selectedCompanyFilter);

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return '₹0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const formatNumber = (num: number | string | null | undefined) => {
    if (!num) return '0';
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return n.toLocaleString('en-IN');
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  if (isLoadingCompanies) {
    return (
      <div className="min-h-screen bg-background p-6">
        <LoadingState variant="form" count={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="create-buy-request">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/unlisted/browse')} 
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Marketplace
        </Button>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Create Buy Request
            </CardTitle>
            <CardDescription>
              Browse available sell listings or create a custom buy request
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* KYC Status */}
            <div className="mb-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="font-medium">KYC Tier:</span>
                  <Badge 
                    variant={isKycEligible ? "default" : "secondary"}
                    data-testid="badge-kyc-tier"
                  >
                    {kycTier.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                {!isKycEligible && (
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/kyc-dashboard')}
                    data-testid="button-upgrade-kyc"
                  >
                    Upgrade KYC
                  </Button>
                )}
              </div>
            </div>

            {/* KYC Warning */}
            {!isKycEligible && (
              <Alert className="mb-6 border-yellow-500 dark:border-yellow-700">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Unlisted share trading requires Enhanced or Accredited Investor KYC. 
                  Please upgrade your KYC to place buy requests.
                </AlertDescription>
              </Alert>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse" data-testid="tab-browse-listings">
                  Browse Sell Listings
                </TabsTrigger>
                <TabsTrigger value="create" data-testid="tab-create-request">
                  Create Custom Request
                </TabsTrigger>
              </TabsList>

              {/* Browse Listings Tab */}
              <TabsContent value="browse" className="space-y-4">
                {/* Company Filter */}
                <div className="flex items-center gap-4">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                    <SelectTrigger className="w-64" data-testid="select-company-filter">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Listings Table */}
                {isLoadingListings ? (
                  <LoadingState variant="table" count={5} />
                ) : filteredListings.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Landing Price</TableHead>
                          <TableHead>Floor Price</TableHead>
                          <TableHead>Valid Until</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredListings.map((listing) => (
                          <TableRow key={listing.id} data-testid={`row-listing-${listing.id}`}>
                            <TableCell className="font-medium">
                              {getCompanyName(listing.companyId)}
                            </TableCell>
                            <TableCell>{formatNumber(listing.quantityRemaining)}</TableCell>
                            <TableCell className="text-green-600 dark:text-green-400 font-semibold">
                              {formatCurrency(listing.landingPrice)}
                            </TableCell>
                            <TableCell className="text-blue-600 dark:text-blue-400">
                              {formatCurrency(listing.floorPrice)}
                            </TableCell>
                            <TableCell>
                              {listing.validUntil 
                                ? new Date(listing.validUntil).toLocaleDateString() 
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  if (!isKycEligible) {
                                    toast({
                                      title: "KYC Required",
                                      description: "Please upgrade your KYC tier",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  // Pre-fill form with listing data
                                  form.setValue('companyId', listing.companyId);
                                  form.setValue('maxPrice', listing.landingPrice.toString());
                                  form.setValue('targetPrice', listing.floorPrice.toString());
                                  setActiveTab('create');
                                }}
                                disabled={!isKycEligible}
                                data-testid={`button-buy-${listing.id}`}
                              >
                                Place Buy Request
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        No sell listings available for the selected company
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Create Request Tab */}
              <TabsContent value="create" className="space-y-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Company Selector */}
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company *</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={!isKycEligible}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-company">
                                <SelectValue placeholder="Select a company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Quantity */}
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Number of shares"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              disabled={!isKycEligible}
                              data-testid="input-quantity"
                            />
                          </FormControl>
                          <FormDescription>
                            Number of shares you want to buy
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Price */}
                    <FormField
                      control={form.control}
                      name="maxPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Price (₹) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="Maximum price per share you're willing to pay"
                              {...field}
                              disabled={!isKycEligible}
                              data-testid="input-max-price"
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum price you're willing to pay per share
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Target Price */}
                    <FormField
                      control={form.control}
                      name="targetPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Price (₹)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="Your preferred price per share"
                              {...field}
                              value={field.value ?? ''}
                              disabled={!isKycEligible}
                              data-testid="input-target-price"
                            />
                          </FormControl>
                          <FormDescription>
                            Your preferred price per share (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Valid Until */}
                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until *</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              {...field}
                              min={new Date().toISOString().split('T')[0]}
                              disabled={!isKycEligible}
                              data-testid="input-valid-until"
                            />
                          </FormControl>
                          <FormDescription>
                            Request expiry date
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Preferred Lot Size */}
                    <FormField
                      control={form.control}
                      name="preferredLotSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Lot Size</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="0"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              disabled={!isKycEligible}
                              data-testid="input-preferred-lot-size"
                            />
                          </FormControl>
                          <FormDescription>
                            Preferred number of shares per transaction (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional details about your buy request..."
                              className="resize-none"
                              rows={4}
                              {...field}
                              value={field.value ?? ''}
                              disabled={!isKycEligible}
                              data-testid="textarea-notes"
                            />
                          </FormControl>
                          <FormDescription>
                            Optional notes for sellers
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Submit Button */}
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={!isKycEligible || createRequestMutation.isPending}
                        className="flex-1"
                        data-testid="button-submit"
                      >
                        {createRequestMutation.isPending ? "Creating..." : "Create Buy Request"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/unlisted/browse')}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
