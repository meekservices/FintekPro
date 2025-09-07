import { useState } from "react";
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
import { Plus, Edit, Trash2, CreditCard, Building2, CheckCircle, AlertCircle, Star } from "lucide-react";

// Bank account form schema
const bankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(8, "Account number must be at least 8 digits").max(20, "Account number is too long"),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  branchName: z.string().min(1, "Branch name is required"),
  accountType: z.enum(["savings", "current", "nro", "nre", "fcnr"], {
    required_error: "Please select account type"
  }),
  accountHolderName: z.string().min(1, "Account holder name is required"),
  // Demat account details
  dematAccountNumber: z.string().optional(),
  dematDpId: z.string().optional(),
  dematDpName: z.string().optional(),
  depositoryType: z.enum(["NSDL", "CDSL"]).optional(),
  nsdlClientId: z.string().optional(),
  cdslBoId: z.string().optional(),
});

type BankAccountForm = z.infer<typeof bankAccountSchema>;

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  accountHolderName: string;
  isDefaultForMutualFunds: boolean;
  isDefaultForDematTransactions: boolean;
  isActive: boolean;
  isVerified: boolean;
  verificationStatus: string;
  // Demat details
  dematAccountNumber?: string;
  dematDpId?: string;
  dematDpName?: string;
  depositoryType?: string;
  nsdlClientId?: string;
  cdslBoId?: string;
}

export function BankingDematTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

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
      dematAccountNumber: "",
      dematDpId: "",
      dematDpName: "",
      depositoryType: "NSDL",
      nsdlClientId: "",
      cdslBoId: "",
    },
  });

  // Add new bank account mutation
  const addAccountMutation = useMutation({
    mutationFn: (data: BankAccountForm) => apiRequest("POST", "/api/bank-accounts", data),
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
      apiRequest("PUT", `/api/bank-accounts/${id}`, data),
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
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bank-accounts/${id}`),
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
    mutationFn: ({ accountId, defaultType }: { accountId: string; defaultType: 'mutualFunds' | 'demat' }) => 
      apiRequest("PUT", `/api/bank-accounts/${accountId}/set-default`, { defaultType }),
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
      dematAccountNumber: account.dematAccountNumber || "",
      dematDpId: account.dematDpId || "",
      dematDpName: account.dematDpName || "",
      depositoryType: (account.depositoryType as any) || "NSDL",
      nsdlClientId: account.nsdlClientId || "",
      cdslBoId: account.cdslBoId || "",
    });
  };

  const handleCancel = () => {
    setIsAddingAccount(false);
    setEditingAccountId(null);
    form.reset();
  };

  const handleSetDefault = (accountId: string, defaultType: 'mutualFunds' | 'demat') => {
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
                Banking & Demat Account Management
              </CardTitle>
              <CardDescription>
                Manage up to 5 bank accounts and their associated demat account details. Set default accounts for mutual fund and demat transactions.
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
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Banking Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Bank Account Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., HDFC Bank" data-testid="input-bank-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="As per bank records" data-testid="input-account-holder" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      name="ifscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., HDFC0000123" data-testid="input-ifsc-code" />
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

                  <FormField
                    control={form.control}
                    name="branchName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Mumbai Main Branch" data-testid="input-branch-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Demat Account Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Demat Account Details (Optional)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="depositoryType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Depository Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-depository-type">
                                <SelectValue placeholder="Select depository" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="NSDL">NSDL</SelectItem>
                              <SelectItem value="CDSL">CDSL</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dematDpId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DP ID</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="8-digit DP ID" data-testid="input-dp-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dematAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Demat Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Client ID/BO ID" data-testid="input-demat-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dematDpName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DP Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Depository Participant name" data-testid="input-dp-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch("depositoryType") === "NSDL" && (
                      <FormField
                        control={form.control}
                        name="nsdlClientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NSDL Client ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="8-digit client ID" data-testid="input-nsdl-client-id" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {form.watch("depositoryType") === "CDSL" && (
                      <FormField
                        control={form.control}
                        name="cdslBoId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CDSL BO ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="16-digit BO ID" data-testid="input-cdsl-bo-id" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center gap-2">
                  <Button 
                    type="submit" 
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
              </form>
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{account.bankName}</h4>
                          {account.isVerified && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {account.isDefaultForMutualFunds && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default MF
                            </Badge>
                          )}
                          {account.isDefaultForDematTransactions && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Default Demat
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
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
                      <p className="text-sm text-gray-600">
                        Account: ****{account.accountNumber.slice(-4)}
                      </p>
                      <p className="text-sm text-gray-600">
                        IFSC: {account.ifscCode}
                      </p>
                      <p className="text-sm text-gray-600">
                        Branch: {account.branchName}
                      </p>
                    </div>
                    {account.dematAccountNumber && (
                      <div>
                        <p className="text-sm font-medium">Demat Details</p>
                        <p className="text-sm text-gray-600">
                          {account.depositoryType}: {account.dematAccountNumber}
                        </p>
                        {account.dematDpId && (
                          <p className="text-sm text-gray-600">
                            DP ID: {account.dematDpId}
                          </p>
                        )}
                        {account.dematDpName && (
                          <p className="text-sm text-gray-600">
                            DP: {account.dematDpName}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

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
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`demat-default-${account.id}`}
                        checked={account.isDefaultForDematTransactions}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSetDefault(account.id, 'demat');
                          }
                        }}
                        data-testid={`checkbox-demat-default-${account.id}`}
                      />
                      <label
                        htmlFor={`demat-default-${account.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Default for Demat transactions
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
            <CreditCard className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Bank Accounts Added</h3>
            <p className="text-gray-600 mb-4">
              Add your bank accounts to enable mutual fund and demat transactions
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