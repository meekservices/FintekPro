import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Landmark, ArrowUpCircle, RefreshCw, Plus, ShieldCheck } from 'lucide-react';
import { usePlaidLink } from 'react-plaid-link';

export function USFundingCard() {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/user'],
  });

  // 1. Mutation to create link token
  const linkTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/alpaca/funding/plaid/link-token', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.linkToken;
    },
    onSuccess: (token) => {
      setLinkToken(token);
    },
  });

  // 2. Mutation to exchange token and link bank
  const linkBankMutation = useMutation({
    mutationFn: async ({ publicToken, metadata }: { publicToken: string, metadata: any }) => {
      const res = await apiRequest('/api/alpaca/funding/bank/link', {
        method: 'POST',
        body: JSON.stringify({
          publicToken,
          accountId: metadata.accounts[0].id,
          bankName: metadata.institution.name
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Bank Linked!',
        description: 'Your bank account has been successfully linked via Plaid.',
      });
    },
  });

  const onPlaidSuccess = useCallback((public_token: string, metadata: any) => {
    linkBankMutation.mutate({ publicToken: public_token, metadata });
  }, [linkBankMutation]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest('/api/alpaca/funding/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Transfer Initiated',
        description: `$${amount} deposit is being processed via ACH.`,
      });
      setAmount('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Deposit Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleDeposit = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast({ title: 'Invalid Amount', variant: 'destructive' });
      return;
    }
    depositMutation.mutate(val);
  };

  const startLinking = () => {
    if (linkToken) {
      open();
    } else {
      linkTokenMutation.mutate();
    }
  };

  // Automatically open link when token is received
  if (linkToken && ready && linkTokenMutation.isSuccess) {
    open();
    // Reset so it doesn't keep opening
    linkTokenMutation.reset();
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          US Dollar Funding
        </CardTitle>
        <CardDescription>Fund your US brokerage account via ACH transfer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user?.alpacaAccountId ? (
          <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between border border-dashed border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Linked Bank</p>
                <p className="font-semibold">Connected via Plaid</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={startLinking}>
              <RefreshCw className="h-3 w-3" /> Reconnect
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full h-16 border-dashed gap-3 hover:bg-primary/5 hover:border-primary/50"
            onClick={startLinking}
            disabled={linkTokenMutation.isPending}
          >
            <Plus className="h-5 w-5 text-primary" />
            <div className="text-left">
              <p className="font-semibold">Link Bank Account</p>
              <p className="text-xs text-muted-foreground">Secure connection via Plaid</p>
            </div>
          </Button>
        )}

        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Deposit Amount (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">$</span>
            <Input
              id="deposit-amount"
              type="number"
              placeholder="0.00"
              className="pl-7 h-12 text-lg"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full h-12 text-lg font-bold gap-2" 
          onClick={handleDeposit}
          disabled={depositMutation.isPending || !user?.alpacaAccountId}
        >
          <ArrowUpCircle className="h-5 w-5" />
          Transfer Now
        </Button>
      </CardFooter>
    </Card>
  );
}

