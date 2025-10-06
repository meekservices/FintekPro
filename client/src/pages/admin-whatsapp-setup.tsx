import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Smartphone, QrCode } from "lucide-react";
import QRCode from "react-qr-code";

interface WhatsAppStatus {
  isReady: boolean;
  hasQrCode: boolean;
  qrCode?: string;
  message: string;
}

export default function AdminWhatsAppSetup() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Query for WhatsApp QR code and status
  const { data, isLoading, error, refetch } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/admin/whatsapp/qr"],
    refetchInterval: autoRefresh ? 3000 : false, // Refresh every 3 seconds when autoRefresh is true
    retry: 2,
  });

  // Stop auto-refresh when authenticated
  useEffect(() => {
    if (data?.isReady) {
      setAutoRefresh(false);
    }
  }, [data?.isReady]);

  const handleManualRefresh = () => {
    refetch();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-whatsapp-setup">
          WhatsApp Setup
        </h1>
        <p className="text-muted-foreground">
          Configure WhatsApp authentication for your FintekPro platform
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load WhatsApp status. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Current WhatsApp service status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Service Status:</span>
                  {data?.isReady ? (
                    <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-connected">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : data?.hasQrCode ? (
                    <Badge variant="secondary" data-testid="badge-waiting">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Waiting for Scan
                    </Badge>
                  ) : (
                    <Badge variant="outline" data-testid="badge-initializing">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Initializing
                    </Badge>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {data?.message}
                  </p>
                </div>

                {data?.isReady && (
                  <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      WhatsApp is connected and ready to send verification codes!
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isLoading}
                    className="flex-1"
                    data-testid="button-refresh"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant={autoRefresh ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    disabled={data?.isReady}
                    className="flex-1"
                    data-testid="button-auto-refresh"
                  >
                    {autoRefresh ? "Auto-Refresh On" : "Auto-Refresh Off"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code
            </CardTitle>
            <CardDescription>
              Scan with WhatsApp to authenticate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : data?.isReady ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
                <p className="text-center text-sm text-muted-foreground">
                  WhatsApp is already authenticated. No QR code needed.
                </p>
              </div>
            ) : data?.qrCode ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border">
                  <QRCode
                    value={data.qrCode}
                    size={200}
                    data-testid="qr-code"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">Scan with WhatsApp</p>
                  <ol className="text-xs text-muted-foreground text-left space-y-1">
                    <li>1. Open WhatsApp on your phone</li>
                    <li>2. Tap Menu or Settings → Linked Devices</li>
                    <li>3. Tap "Link a Device"</li>
                    <li>4. Scan this QR code</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  Generating QR code... Please wait.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Why do I need to scan the QR code?</h3>
            <p className="text-sm text-muted-foreground">
              WhatsApp requires authentication before the service can send verification codes to users. 
              By scanning this QR code, you're linking this FintekPro instance to a WhatsApp account 
              that will be used to send authentication messages.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">What happens after scanning?</h3>
            <p className="text-sm text-muted-foreground">
              Once authenticated, the WhatsApp service will be able to send verification codes to users 
              logging in via WhatsApp. The connection will persist across server restarts, so you only 
              need to scan once unless you disconnect the device from WhatsApp.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Security Note</h3>
            <p className="text-sm text-muted-foreground">
              This QR code is only visible to admin users. Make sure you're scanning it with a secure 
              WhatsApp account dedicated to business use.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
