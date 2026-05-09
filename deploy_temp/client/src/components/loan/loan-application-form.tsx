import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calculator, FileText, User, CreditCard } from "lucide-react";

const loanApplicationSchema = z.object({
  portfolioId: z.string().min(1, "Please select a portfolio"),
  requestedAmount: z.string().min(1, "Loan amount is required"),
  purpose: z.string().min(1, "Loan purpose is required"),
  tenure: z.string().min(1, "Loan tenure is required"),
  applicantName: z.string().min(1, "Applicant name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  address: z.string().min(1, "Address is required"),
  panNumber: z.string().min(10, "Please enter a valid PAN number"),
  occupation: z.string().min(1, "Occupation is required"),
  monthlyIncome: z.string().min(1, "Monthly income is required")
});

type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

interface LoanApplicationFormProps {
  onClose?: () => void;
  defaultPortfolioId?: string;
}

export function LoanApplicationForm({ onClose, defaultPortfolioId }: LoanApplicationFormProps) {
  const [eligibilityData, setEligibilityData] = useState<any>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user portfolios
  const { data: portfolios } = useQuery({
    queryKey: ["/api/portfolios/by-pan"],
  });

  const form = useForm<LoanApplicationForm>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      portfolioId: defaultPortfolioId || "",
      requestedAmount: "",
      purpose: "",
      tenure: "12",
      applicantName: "",
      email: "",
      phone: "",
      address: "",
      panNumber: "",
      occupation: "",
      monthlyIncome: ""
    },
  });

  const checkEligibilityMutation = useMutation({
    mutationFn: async (data: { portfolioId: string; requestedAmount: string }) => {
      const response = await fetch("/api/loans/eligibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setEligibilityData(data.data);
      if (!data.data.isEligible) {
        toast({
          title: "Loan Amount Too High",
          description: `Maximum eligible amount is ₹${data.data.maxLoanAmount.toLocaleString()}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Eligible for Loan",
          description: `You can get a loan of up to ₹${data.data.maxLoanAmount.toLocaleString()}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to check loan eligibility",
        variant: "destructive",
      });
    },
  });

  const { user } = useAuth();
  
  const submitLoanMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      const response = await fetch("/api/loans/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          userId: user?.id || "",
          requestedAmount: parseFloat(data.requestedAmount),
          monthlyIncome: parseFloat(data.monthlyIncome),
          applicationDate: new Date().toISOString(),
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Application Submitted",
        description: `Your loan application ${data.data.applicationNumber} has been submitted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      onClose?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to submit loan application",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanApplicationForm) => {
    if (!eligibilityData || !eligibilityData.isEligible) {
      toast({
        title: "Check Eligibility First",
        description: "Please check your loan eligibility before applying",
        variant: "destructive",
      });
      return;
    }
    submitLoanMutation.mutate(data);
  };

  const handleCheckEligibility = () => {
    const portfolioId = form.getValues("portfolioId");
    const requestedAmount = form.getValues("requestedAmount");
    
    if (!portfolioId || !requestedAmount) {
      toast({
        title: "Missing Information",
        description: "Please select a portfolio and enter loan amount",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingEligibility(true);
    checkEligibilityMutation.mutate({ portfolioId, requestedAmount });
    setIsCheckingEligibility(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Loan Against Securities Application
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Loan Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Loan Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="portfolioId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Portfolio</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-portfolio">
                            <SelectValue placeholder="Choose portfolio for collateral" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(portfolios) && portfolios.map((portfolio: any) => (
                            <SelectItem key={portfolio.id} value={portfolio.id}>
                              {portfolio.name}
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
                  name="requestedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-loan-amount"
                          type="number"
                          placeholder="Enter loan amount"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Purpose</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-loan-purpose">
                            <SelectValue placeholder="Select loan purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="business">Business Investment</SelectItem>
                          <SelectItem value="personal">Personal Use</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="medical">Medical Emergency</SelectItem>
                          <SelectItem value="property">Property Purchase</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tenure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Tenure (Months)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-loan-tenure">
                            <SelectValue placeholder="Select tenure" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="6">6 Months</SelectItem>
                          <SelectItem value="12">12 Months</SelectItem>
                          <SelectItem value="18">18 Months</SelectItem>
                          <SelectItem value="24">24 Months</SelectItem>
                          <SelectItem value="36">36 Months</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckEligibility}
                  disabled={isCheckingEligibility || checkEligibilityMutation.isPending}
                  data-testid="button-check-eligibility"
                  className="flex items-center gap-2"
                >
                  {isCheckingEligibility || checkEligibilityMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Check Eligibility
                </Button>
              </div>

              {eligibilityData && (
                <Card className={`${eligibilityData.isEligible ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'}`}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Eligibility</p>
                        <p className={eligibilityData.isEligible ? 'text-green-600' : 'text-red-600'}>
                          {eligibilityData.isEligible ? '✓ Eligible' : '✗ Not Eligible'}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Max Loan Amount</p>
                        <p className="text-blue-600">₹{eligibilityData.maxLoanAmount?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="font-medium">Interest Rate</p>
                        <p className="text-blue-600">{eligibilityData.interestRate}% p.a.</p>
                      </div>
                      <div>
                        <p className="font-medium">Processing Fee</p>
                        <p className="text-blue-600">₹{eligibilityData.processingFee?.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Personal Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="applicantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-applicant-name"
                          placeholder="Enter your full name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-email"
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-phone"
                          placeholder="Enter your phone number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="panNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN Number</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-pan"
                          placeholder="Enter your PAN number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="occupation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-occupation">
                            <SelectValue placeholder="Select your occupation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salaried">Salaried Employee</SelectItem>
                          <SelectItem value="business">Business Owner</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Income (₹)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-monthly-income"
                          type="number"
                          placeholder="Enter your monthly income"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="textarea-address"
                        placeholder="Enter your complete address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
              {onClose && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitLoanMutation.isPending || !eligibilityData?.isEligible}
                data-testid="button-submit-application"
              >
                {submitLoanMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}