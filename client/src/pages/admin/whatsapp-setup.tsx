import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Play,
  Info,
} from 'lucide-react';

interface WhatsAppStatus {
  isReady: boolean;
  hasQrCode: boolean;
  qrDataUrl: string | null;
}

export default function WhatsAppSetupPage() {
  const { toast } = useToast();
  const [polling, setPolling] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<WhatsAppStatus>({
    queryKey: ['/api/admin/whatsapp/status'],
    refetchInterval: polling ? 5000 : false,
  });

  useEffect(() => {
    if (status?.isReady && polling) {
      setPolling(false);
    }
  }, [status?.isReady, polling]);

  const initMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/whatsapp/init', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'WhatsApp initializing', description: 'Starting up — QR code will appear in ~10 seconds.' });
      setPolling(true);
      setTimeout(() => refetch(), 10000);
    },
    onError: (err: any) => {
      toast({ title: 'Initialization failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/admin/whatsapp/status'] });
  };

  const isConnected = status?.isReady;
  const hasQr = status?.hasQrCode;
  const qrImage = status?.qrDataUrl;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Device Setup</h1>
          <p className="text-muted-foreground mt-1">
            Link a WhatsApp account so OTP messages and notifications are delivered via WhatsApp.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Checking status…
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-3">
              <Wifi className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium text-green-600 dark:text-green-400">Connected</p>
                <p className="text-sm text-muted-foreground">WhatsApp is active and ready to send messages.</p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <WifiOff className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Not connected</p>
                <p className="text-sm text-muted-foreground">
                  {hasQr ? 'QR code ready — scan it below.' : 'WhatsApp client is not running.'}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                <AlertCircle className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {!isConnected && !hasQr && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="h-5 w-5" />
              Start WhatsApp
            </CardTitle>
            <CardDescription>
              Initializes the WhatsApp Web client and generates a QR code. Make sure{' '}
              <code className="text-xs bg-muted px-1 rounded">ENABLE_WHATSAPP=true</code> is set in Railway
              environment variables before deploying.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}
              className="bg-[#25d366] hover:bg-[#1ebe57] text-white"
            >
              {initMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              {initMutation.isPending ? 'Starting…' : 'Generate QR Code'}
            </Button>
            {polling && (
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Waiting for QR code… (checking every 5 s)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {hasQr && !isConnected && (
        <Card className="border-[#25d366]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-[#128c7e]">
              <QrCode className="h-5 w-5" />
              Scan to Link Device
            </CardTitle>
            <CardDescription>
              Open WhatsApp on your phone → tap the three-dot menu → <strong>Linked Devices</strong> →{' '}
              <strong>Link a Device</strong> → scan this code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrImage ? (
              <>
                <img
                  src={qrImage}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 border-4 border-[#25d366] rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  QR codes expire after ~60 seconds. Click Refresh if it stops working.
                </p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh QR
                </Button>
              </>
            ) : (
              <div className="text-muted-foreground text-sm">QR image loading… click Refresh.</div>
            )}
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-1">
          <p>
            <strong>Railway setup checklist:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>
              Add <code className="bg-muted px-1 rounded text-xs">ENABLE_WHATSAPP=true</code> to Railway environment
              variables
            </li>
            <li>
              Mount a persistent volume at{' '}
              <code className="bg-muted px-1 rounded text-xs">/whatsapp-sessions</code> and set{' '}
              <code className="bg-muted px-1 rounded text-xs">WHATSAPP_SESSION_PATH=/whatsapp-sessions</code> — this
              keeps you logged in across deploys
            </li>
            <li>Scan the QR once; subsequent deploys will resume the saved session automatically</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
