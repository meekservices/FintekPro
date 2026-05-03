import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Share2, Copy, ExternalLink, MessageCircle, Twitter, Check } from 'lucide-react';

export function ProfileShareCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: referralData, isLoading } = useQuery<{ success: boolean; referralCode: string }>({
    queryKey: ['/api/alpaca/social/referral-code'],
  });

  const { data: user } = useQuery<any>({
    queryKey: ['/api/user'],
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest('/api/user/profile/sharing', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Settings Updated',
        description: 'Your profile visibility has been updated.',
      });
    },
  });

  const referralCode = referralData?.referralCode;
  const shareUrl = `${window.location.origin}/profile/p/${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Profile link copied to clipboard.',
    });
  };

  const shareVia = (platform: string) => {
    const message = `Check out my investment profile on FintekPro! 🚀 ${shareUrl}`;
    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  if (isLoading) return <div>Loading sharing settings...</div>;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Social Profile
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Publicly Visible</span>
            <Switch
              checked={user?.shareableProfileEnabled}
              onCheckedChange={(val) => toggleMutation.mutate(val)}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>
        <CardDescription>
          Share your portfolio progress and earn rewards through your unique link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user?.shareableProfileEnabled ? (
          <>
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-sm" />
              <Button size="icon" variant="outline" onClick={copyToClipboard}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2 border-green-500/20 hover:bg-green-500/10 text-green-600"
                onClick={() => shareVia('whatsapp')}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2 border-blue-400/20 hover:bg-blue-400/10 text-blue-500"
                onClick={() => shareVia('twitter')}
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </Button>
            </div>
            <Button variant="link" className="w-full text-xs gap-1" asChild>
              <a href={`/profile/p/${referralCode}`} target="_blank" rel="noreferrer">
                Preview my public profile <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </>
        ) : (
          <div className="bg-muted/50 rounded-lg p-6 text-center border border-dashed">
            <p className="text-sm text-muted-foreground">
              Turn on public visibility to share your investment journey with friends and earn referral bonuses.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
