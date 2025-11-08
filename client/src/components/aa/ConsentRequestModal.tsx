import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Shield, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// FI Types with labels
const FI_TYPES = [
  { value: 'deposit', label: 'Bank Accounts' },
  { value: 'mutual_funds', label: 'Mutual Funds' },
  { value: 'insurance_policies', label: 'Insurance Policies' },
  { value: 'securities', label: 'Securities' },
  { value: 'term_deposit', label: 'Term Deposits' },
  { value: 'recurring_deposit', label: 'Recurring Deposits' },
  { value: 'sip', label: 'SIP' },
  { value: 'equities', label: 'Equities' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'debentures', label: 'Debentures' },
  { value: 'etf', label: 'ETFs' },
  { value: 'govt_securities', label: 'Government Securities' },
  { value: 'cp', label: 'Commercial Papers' },
  { value: 'idr', label: 'IDR' },
  { value: 'cis', label: 'CIS' },
  { value: 'aif', label: 'AIF' },
] as const;

// Purpose options
const PURPOSES = [
  { value: 'portfolio_sync', label: 'Portfolio Synchronization' },
  { value: 'wealth_management', label: 'Wealth Management' },
  { value: 'loan_application', label: 'Loan Application' },
  { value: 'tax_filing', label: 'Tax Filing' },
  { value: 'insurance_planning', label: 'Insurance Planning' },
] as const;

// Frequency units
const FREQUENCY_UNITS = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
] as const;

// AA Providers
const AA_PROVIDERS = [
  { value: 'anumati', label: 'Anumati (NSDL)' },
  { value: 'finvu', label: 'Finvu' },
  { value: 'onemoney', label: 'OneMoney' },
  { value: 'perfios', label: 'Perfios' },
  { value: 'nadl', label: 'NADL' },
] as const;

const consentFormSchema = z.object({
  purpose: z.enum(['portfolio_sync', 'loan_application', 'wealth_management', 'tax_filing', 'insurance_planning']),
  fiTypes: z.array(z.string()).min(1, 'Select at least one financial information type'),
  dataRangeFrom: z.date({ required_error: 'Start date is required' }),
  dataRangeTo: z.date({ required_error: 'End date is required' }),
  consentExpiry: z.date({ required_error: 'Consent expiry date is required' }),
  frequencyUnit: z.enum(['hour', 'day', 'month', 'year']),
  frequencyValue: z.coerce.number().min(1).max(365),
  aaProvider: z.enum(['anumati', 'finvu', 'onemoney', 'perfios', 'nadl']).optional(),
}).refine((data) => data.dataRangeTo > data.dataRangeFrom, {
  message: 'End date must be after start date',
  path: ['dataRangeTo'],
}).refine((data) => data.consentExpiry > new Date(), {
  message: 'Consent expiry must be in the future',
  path: ['consentExpiry'],
});

type ConsentFormValues = z.infer<typeof consentFormSchema>;

interface ConsentRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsentRequestModal({ open, onOpenChange }: ConsentRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const form = useForm<ConsentFormValues>({
    resolver: zodResolver(consentFormSchema),
    defaultValues: {
      purpose: 'portfolio_sync',
      fiTypes: ['deposit', 'mutual_funds'],
      frequencyUnit: 'month',
      frequencyValue: 1,
      dataRangeFrom: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      dataRangeTo: new Date(),
      consentExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      aaProvider: 'anumati',
    },
  });

  const createConsentMutation = useMutation({
    mutationFn: async (values: ConsentFormValues) => {
      const payload = {
        purpose: values.purpose,
        fiTypes: values.fiTypes,
        dataRangeFrom: values.dataRangeFrom.toISOString(),
        dataRangeTo: values.dataRangeTo.toISOString(),
        consentExpiry: values.consentExpiry.toISOString(),
        frequency: {
          unit: values.frequencyUnit,
          value: values.frequencyValue,
        },
        aaProvider: values.aaProvider,
      };

      return await apiRequest('/api/aa/consent/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consents'] });
      
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        toast({
          title: 'Consent Request Created',
          description: 'Click the link below to approve consent with your AA provider.',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Consent request created successfully.',
        });
        onOpenChange(false);
        form.reset();
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create consent request',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: ConsentFormValues) => {
    createConsentMutation.mutate(values);
  };

  const handleClose = () => {
    if (!createConsentMutation.isPending) {
      onOpenChange(false);
      setRedirectUrl(null);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Request Account Aggregator Consent
          </DialogTitle>
          <DialogDescription>
            Securely fetch your financial data from banks, mutual funds, and insurance providers through RBI-regulated Account Aggregators.
          </DialogDescription>
        </DialogHeader>

        {redirectUrl ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-primary/5">
              <p className="text-sm font-medium mb-2">Consent request created successfully!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to approve this consent with your Account Aggregator provider.
              </p>
              <Button
                onClick={() => window.open(redirectUrl, '_blank')}
                className="w-full"
                data-testid="button-aa-redirect"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Approve Consent with AA Provider
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full"
              data-testid="button-close"
            >
              Done
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Purpose */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      data-testid="select-purpose"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PURPOSES.map((purpose) => (
                          <SelectItem key={purpose.value} value={purpose.value}>
                            {purpose.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Why do you want to access this financial data?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* FI Types */}
              <FormField
                control={form.control}
                name="fiTypes"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Financial Information Types</FormLabel>
                      <FormDescription>
                        Select the types of financial data you want to fetch
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                      {FI_TYPES.map((type) => (
                        <FormField
                          key={type.value}
                          control={form.control}
                          name="fiTypes"
                          render={({ field }) => (
                            <FormItem
                              key={type.value}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type.value)}
                                  onCheckedChange={(checked) => {
                                    const updatedValue = checked
                                      ? [...field.value, type.value]
                                      : field.value?.filter((value) => value !== type.value);
                                    field.onChange(updatedValue);
                                  }}
                                  data-testid={`checkbox-fi-${type.value}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {type.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data Range */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataRangeFrom"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data From</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              data-testid="button-date-from"
                            >
                              {field.value ? (
                                format(field.value, 'PP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataRangeTo"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data To</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              data-testid="button-date-to"
                            >
                              {field.value ? (
                                format(field.value, 'PP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Consent Expiry */}
              <FormField
                control={form.control}
                name="consentExpiry"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Consent Expiry</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                            data-testid="button-consent-expiry"
                          >
                            {field.value ? (
                              format(field.value, 'PP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      How long should this consent be valid?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequencyUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fetch Frequency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        data-testid="select-frequency-unit"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FREQUENCY_UNITS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequencyValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Every</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          placeholder="1"
                          {...field}
                          data-testid="input-frequency-value"
                        />
                      </FormControl>
                      <FormDescription>
                        How often to fetch data
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* AA Provider */}
              <FormField
                control={form.control}
                name="aaProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Aggregator Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      data-testid="select-aa-provider"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AA_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose your preferred AA provider
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createConsentMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createConsentMutation.isPending}
                  data-testid="button-submit"
                >
                  {createConsentMutation.isPending ? 'Creating...' : 'Create Consent Request'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
