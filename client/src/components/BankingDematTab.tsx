import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, CreditCard, Building2, CheckCircle, AlertCircle, Star, ShieldCheck, XCircle, AlertTriangle, Loader2 } from "lucide-react";

// Bank account form schema
const bankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(9, "Account number must be 9-18 digits").max(18, "Account number must be 9-18 digits").regex(/^[0-9]+$/, "Account number must contain only digits"),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  branchName: z.string().min(1, "Branch name is required"),
  accountType: z.enum(["savings", "current", "nro", "nre", "fcnr"], {
    required_error: "Please select account type"
  }),
  accountHolderName: z.string().min(1, "Account holder name is required"),
});

type BankAccountForm = z.infer<typeof bankAccountSchema>;

interface IFSCDetails {
  ifsc: string;
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  accountHolderName: string;
  isDefaultForMutualFunds: boolean;
  isActive: boolean;
  isVerified: boolean;
  verificationStatus: string;
  verificationAttempts?: number;
  nameMatchScore?: number;
  verifiedAccountHolderName?: string;
  pennyDropTransactionId?: string;
  bankAccountStatus?: string;
  verificationMethod?: string;
}

export function BankingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [ifscDetails, setIfscDetails] = useState<IFSCDetails | null>(null);
  const [isLookingUpIFSC, setIsLookingUpIFSC] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);

  // Fetch bank accounts
  const { data: bankAccounts, isLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const form = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      accountType: "savings",
      accountHolderName: "",
    },
  });

  // Watch IFSC code and auto-fetch bank details
  const ifscCode = form.watch("ifscCode");

  useEffect(() => {
    const lookupIFSC = async () => {
      if (!ifscCode || ifscCode.length !== 11) {
        setIfscDetails(null);
        setIfscError(null);
        return;
      }

      // Validate IFSC format
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode.toUpperCase())) {
        setIfscError("Invalid IFSC format");
        setIfscDetails(null);
        return;
      }

      setIsLookingUpIFSC(true);
      setIfscError(null);

      try {
        const response = await fetch(`/api/ifsc/${ifscCode.toUpperCase()}`);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "IFSC not found");
        }

        const data: IFSCDetails = await response.json();
        setIfscDetails(data);

        // Auto-fill bank name and branch name
        form.setValue("bankName", data.bank);
        form.setValue("branchName", data.branch);

        toast({
          title: "IFSC Verified",
          description: `${data.bank} - ${data.branch}`,
        });
      } catch (error: any) {
        setIfscError(error.message || "Failed to lookup IFSC");
        setIfscDetails(null);
        // Clear auto-filled fields on error
        form.setValue("bankName", "");
        form.setValue("branchName", "");
      } finally {
        setIsLookingUpIFSC(false);
      }
    };

    // Debounce the lookup
    const timeoutId = setTimeout(lookupIFSC, 500);
    return () => clearTimeout(timeoutId);
  }, [ifscCode, form, toast]);

  // Add new bank account mutation
  const addAccountMutation = useMutation({
    mutationFn: (data: BankAccountForm) => apiRequest("/api/bank-accounts", "POST", { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      setIsAddingAccount(false);
      form.reset();
      toast({
        title: "Success",
        description: "Bank account added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add bank account",
        variant: "destructive",
      });
    },
  });

  // Update bank account mutation
  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BankAccountForm }) => 
      apiRequest(`/api/bank-accounts/${id}`, "PUT", { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      setEditingAccountId(null);
      form.reset();
      toast({
        title: "Success",
        description: "Bank account updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update bank account",
        variant: "destructive",
      });
    },
  });

  // Delete bank account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/bank-accounts/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({
        title: "Success",
        description: "Bank account removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove bank account",
        variant: "destructive",
      });
    },
  });

  // Set default account mutation
  const setDefaultMutation = useMutation({
    mutationFn: ({ accountId, defaultType }: { accountId: string; defaultType: 'mutualFunds' }) => 
      apiRequest(`/api/bank-accounts/${accountId}/set-default`, "PUT", { body: { defaultType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({
        title: "Success",
        description: "Default account updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default account",
        variant: "destructive",
      });
    },
  });

  // Penny drop verification mutation
  const verifyAccountMutation = useMutation({
    mutationFn: (accountId: string) => 
      apiRequest("/api/bank-accounts/verify-penny-drop", "POST", { body: { accountId } }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      if (data.verified) {
        toast({
          title: "✅ Account Verified",
          description: `Name match: ${data.nameMatchScore}% - ${data.message}`,
        });
      } else {
        toast({
          title: "⚠️ Verification Issue",
          description: data.message || "Name mismatch detected",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify bank account",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: BankAccountForm) => {
    if (editingAccountId) {
      updateAccountMutation.mutate({ id: editingAccountId, data });
    } else {
      addAccountMutation.mutate(data);
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccountId(account.id);
    setIsAddingAccount(true);
    form.reset({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode,
      branchName: account.branchName,
      accountType: account.accountType as any,
      accountHolderName: account.accountHolderName,
    });
  };

  const handleCancel = () => {
    setIsAddingAccount(false);
    setEditingAccountId(null);
    setIfscDetails(null);
    setIfscError(null);
    form.reset();
  };

  const handleSetDefault = (accountId: string, defaultType: 'mutualFunds') => {
    setDefaultMutation.mutate({ accountId, defaultType });
  };

  const canAddMore = !bankAccounts || bankAccounts.length < 5;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banking Account Management
              </CardTitle>
              <CardDescription>
                Manage up to 5 bank accounts. Set default accounts for mutual fund transactions.
              </CardDescription>
            </div>
            {canAddMore && !isAddingAccount && (
              <Button
                onClick={() => setIsAddingAccount(true)}
                className="flex items-center gap-2"
                data-testid="button-add-account"
              >
                <Plus className="h-4 w-4" />
                Add Bank Account
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Account limit warning */}
      {bankAccounts && bankAccounts.length >= 5 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have reached the maximum limit of 5 bank accounts. Remove an existing account to add a new one.
          </AlertDescription>
        </Alert>
      )}

      {/* Add/Edit Form */}
      {isAddingAccount && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingAccountId ? "Edit Bank Account" : "Add New Bank Account"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="space-y-6">
                {/* Banking Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Bank Account Details</h3>
                  
                  {/* Step 1: Enter IFSC Code */}
                  <FormField
                    control={form.control}
                    name="ifscCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IFSC Code *</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g., HDFC0000123" 
                              data-testid="input-ifsc-code"
                              className="uppercase"
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          {isLookingUpIFSC && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            </div>
                          )}
                        </div>
                        {ifscError && (
                          <p className="text-sm text-red-500 mt-1">{ifscError}</p>
                        )}
                        {ifscDetails && (
                          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            IFSC verified successfully
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Step 2: Auto-filled Bank Details (Read-only) */}
                  {ifscDetails && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                        <p className="text-base font-semibold text-foreground mt-1">{ifscDetails.bank}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Branch Name</label>
                        <p className="text-base font-semibold text-foreground mt-1">{ifscDetails.branch}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Branch Address</label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ifscDetails.address}, {ifscDetails.city}, {ifscDetails.state}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Hidden fields for form validation */}
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input {...field} type="hidden" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="branchName"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input {...field} type="hidden" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Step 3: Account Number and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter account number" data-testid="input-account-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-account-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="savings">Savings</SelectItem>
                              <SelectItem value="current">Current</SelectItem>
                              <SelectItem value="nro">NRO</SelectItem>
                              <SelectItem value="nre">NRE</SelectItem>
                              <SelectItem value="fcnr">FCNR</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Step 4: Account Holder Name (for penny drop) */}
                  <FormField
                    control={form.control}
                    name="accountHolderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name (for verification) *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter name as per bank records" data-testid="input-account-holder" />
                        </FormControl>
                        <p className="text-sm text-muted-foreground mt-1">
                          This will be verified via penny drop (₹1 deposit)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


                {/* Form Actions */}
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    onClick={form.handleSubmit(handleSubmit)}
                    disabled={addAccountMutation.isPending || updateAccountMutation.isPending}
                    data-testid="button-save-account"
                  >
                    {addAccountMutation.isPending || updateAccountMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        {editingAccountId ? "Updating..." : "Adding..."}
                      </>
                    ) : (
                      editingAccountId ? "Update Account" : "Add Account"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Existing Accounts */}
      {bankAccounts && bankAccounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Your Bank Accounts</h3>
          <div className="grid gap-4">
            {bankAccounts.map((account) => (
              <Card key={account.id} className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{account.bankName}</h4>
                          {account.isVerified && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified {account.nameMatchScore ? `(${account.nameMatchScore}%)` : ''}
                            </Badge>
                          )}
                          {account.verificationStatus === 'failed' && (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Verification Failed
                            </Badge>
                          )}
                          {account.verificationStatus === 'pending' && !account.verificationAttempts && (
                            <Badge variant="secondary" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Not Verified
                            </Badge>
                          )}
                          {account.isDefaultForMutualFunds && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default MF
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.accountHolderName} • {account.accountType.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(account)}
                        data-testid={`button-edit-${account.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAccountMutation.mutate(account.id)}
                        disabled={deleteAccountMutation.isPending}
                        data-testid={`button-delete-${account.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium">Account Details</p>
                      <p className="text-sm text-muted-foreground">
                        Account: ****{account.accountNumber.slice(-4)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        IFSC: {account.ifscCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Branch: {account.branchName}
                      </p>
                    </div>
                    
                    {/* Penny Drop Verification Status */}
                    {account.verificationMethod === 'penny_drop' && (
                      <div>
                        <p className="text-sm font-medium mb-2">Verification Info</p>
                        {account.isVerified && (
                          <>
                            <p className="text-sm text-green-600">
                              ✓ Verified via Penny Drop
                            </p>
                            {account.verifiedAccountHolderName && (
                              <p className="text-sm text-muted-foreground">
                                Bank Name: {account.verifiedAccountHolderName}
                              </p>
                            )}
                            {account.nameMatchScore && (
                              <p className="text-sm text-muted-foreground">
                                Match Score: {account.nameMatchScore}%
                              </p>
                            )}
                          </>
                        )}
                        {account.verificationAttempts && account.verificationAttempts > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Attempts: {account.verificationAttempts}/3
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Name Mismatch Warning */}
                  {account.verifiedAccountHolderName && 
                   !account.isVerified && 
                   account.nameMatchScore && 
                   account.nameMatchScore < 80 && (
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Name Mismatch:</strong> Bank shows "{account.verifiedAccountHolderName}" 
                        but you provided "{account.accountHolderName}" (Match: {account.nameMatchScore}%). 
                        Please update the name or contact support.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Max Attempts Warning */}
                  {account.verificationAttempts && account.verificationAttempts >= 3 && !account.isVerified && (
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Maximum verification attempts reached. Please contact support for assistance.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Penny Drop Verification Button */}
                  {!account.isVerified && (!account.verificationAttempts || account.verificationAttempts < 3) && (
                    <div className="mb-4">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => verifyAccountMutation.mutate(account.id)}
                        disabled={verifyAccountMutation.isPending}
                        className="w-full md:w-auto"
                        data-testid={`button-verify-${account.id}`}
                      >
                        {verifyAccountMutation.isPending ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Verify with Penny Drop (₹1)
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        ₹1 will be deposited to verify account. {account.verificationAttempts ? `${3 - account.verificationAttempts} attempts remaining` : '3 attempts available'}
                      </p>
                    </div>
                  )}

                  {/* Default Account Selection */}
                  <div className="flex flex-wrap gap-4 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`mf-default-${account.id}`}
                        checked={account.isDefaultForMutualFunds}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSetDefault(account.id, 'mutualFunds');
                          }
                        }}
                        data-testid={`checkbox-mf-default-${account.id}`}
                      />
                      <label
                        htmlFor={`mf-default-${account.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Default for Mutual Fund transactions
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {bankAccounts && bankAccounts.length === 0 && !isAddingAccount && (
        <Card className="text-center py-12">
          <CardContent>
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Bank Accounts Added</h3>
            <p className="text-muted-foreground mb-4">
              Add your bank accounts to enable mutual fund transactions
            </p>
            <Button onClick={() => setIsAddingAccount(true)} data-testid="button-add-first-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Bank Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}