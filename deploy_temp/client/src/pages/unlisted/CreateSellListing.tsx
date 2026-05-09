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
import { LoadingState } from "@/components/LoadingState";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, TrendingUp, Shield, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UnlistedCompany, User } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Standalone schema — avoids circular-dependency TDZ crash in production bundles
const sellListingFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  askPrice: z.string().min(1, "Ask price is required"),
  landingPrice: z.string().min(1, "Landing price is required"),
  floorPrice: z.string().min(1, "Floor price is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  lockInPeriod: z.number().optional(),
  minimumLotSize: z.number().optional(),
  notes: z.string().optional(),
  autoRenew: z.boolean().optional(),
}).refine(
  (data) => Number(data.landingPrice) <= Number(data.askPrice),
  {
    message: "Landing price must be less than or equal to ask price",
    path: ["landingPrice"],
  }
).refine(
  (data) => Number(data.floorPrice) <= Number(data.landingPrice),
  {
    message: "Floor price must be less than or equal to landing price",
    path: ["floorPrice"],
  }
);

type SellListingFormData = z.infer<typeof sellListingFormSchema>;

export default function CreateSellListing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Get pre-selected company from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedCompanyId = urlParams.get('company') || "";

  // Fetch companies
  const { data: companiesResponse, isLoading: isLoadingCompanies } = useQuery<{ data: UnlistedCompany[] }>({
    queryKey: ['/api/unlisted/companies'],
  });
  const companies = companiesResponse?.data || [];

  // Check KYC tier
  const kycTier = (user as any)?.kycTier || 'basic';
  const isKycEligible = kycTier === 'enhanced' || kycTier === 'accredited_investor';

  const form = useForm<SellListingFormData>({
    resolver: zodResolver(sellListingFormSchema),
    defaultValues: {
      companyId: preSelectedCompanyId,
      quantity: 0,
      askPrice: "0",
      landingPrice: "0",
      floorPrice: "0",
      validUntil: "",
      lockInPeriod: 0,
      minimumLotSize: 0,
      notes: "",
      autoRenew: false,
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: SellListingFormData) => {
      const response = await apiRequest('/api/unlisted/listings', {
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
        title: "Sell Listing Created",
        description: "Your sell listing has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/listings'] });
      navigate('/unlisted/browse');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sell listing",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SellListingFormData) => {
    if (!isKycEligible) {
      toast({
        title: "KYC Upgrade Required",
        description: "Please upgrade your KYC to Enhanced or Accredited Investor tier",
        variant: "destructive",
      });
      return;
    }
    createListingMutation.mutate(data);
  };

  if (isLoadingCompanies) {
    return (
      <div className="min-h-screen bg-background p-6">
        <LoadingState variant="form" count={8} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="create-sell-listing">
      <div className="max-w-3xl mx-auto">
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
              <TrendingUp className="h-6 w-6" />
              Create Sell Listing
            </CardTitle>
            <CardDescription>
              List your unlisted shares for sale on the marketplace
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
                  Please upgrade your KYC to create sell listings.
                </AlertDescription>
              </Alert>
            )}

            {/* Form */}
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
                        Number of shares you want to sell
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ask Price */}
                <FormField
                  control={form.control}
                  name="askPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ask Price (₹) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Initial asking price per share"
                          {...field}
                          disabled={!isKycEligible}
                          data-testid="input-ask-price"
                        />
                      </FormControl>
                      <FormDescription>
                        Your initial asking price per share
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Landing Price */}
                <FormField
                  control={form.control}
                  name="landingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landing Price (₹) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Target acceptable price per share"
                          {...field}
                          disabled={!isKycEligible}
                          data-testid="input-landing-price"
                        />
                      </FormControl>
                      <FormDescription>
                        Must be ≤ ask price
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Floor Price */}
                <FormField
                  control={form.control}
                  name="floorPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Floor Price (₹) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Minimum acceptable price per share"
                          {...field}
                          disabled={!isKycEligible}
                          data-testid="input-floor-price"
                        />
                      </FormControl>
                      <FormDescription>
                        Must be ≤ landing price
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
                        Listing expiry date
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Lock-in Period */}
                <FormField
                  control={form.control}
                  name="lockInPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lock-in Period (days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          disabled={!isKycEligible}
                          data-testid="input-lock-in-period"
                        />
                      </FormControl>
                      <FormDescription>
                        Lock-in period in days (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Minimum Lot Size */}
                <FormField
                  control={form.control}
                  name="minimumLotSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Lot Size</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          disabled={!isKycEligible}
                          data-testid="input-minimum-lot-size"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum number of shares per transaction (optional)
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
                          placeholder="Additional details about your listing..."
                          className="resize-none"
                          rows={4}
                          {...field}
                          value={field.value ?? ''}
                          disabled={!isKycEligible}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormDescription>
                        Optional notes for buyers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!isKycEligible || createListingMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit"
                  >
                    {createListingMutation.isPending ? "Creating..." : "Create Listing"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
