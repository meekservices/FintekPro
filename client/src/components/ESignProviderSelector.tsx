import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Smartphone, 
  Usb, 
  ShieldCheck, 
  Clock, 
  Wifi, 
  WifiOff,
  Info,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { DSCSigningModal } from './DSCSigningModal';
import { useNetworkState } from '@/hooks/use-network-state';

type ESignMethod = 'aadhaar_otp' | 'dsc_token';

interface ESignProviderSelectorProps {
  documentType: 'itr_verification' | 'form_15ca' | 'form_15cb' | 'investment_agreement' | 'kyc_consent' | 'mandate' | 'other';
  documentName: string;
  documentHash: string;
  documentUrl?: string;
  signerName: string;
  signerAadhaar?: string;
  onMethodSelected?: (method: ESignMethod) => void;
  onAadhaarSigningInitiate?: () => void;
  onSigningComplete?: (result: {
    success: boolean;
    method: ESignMethod;
    transactionId?: string;
    certificateId?: string;
    signedAt?: Date;
  }) => void;
}

export function ESignProviderSelector({
  documentType,
  documentName,
  documentHash,
  documentUrl,
  signerName,
  signerAadhaar,
  onMethodSelected,
  onAadhaarSigningInitiate,
  onSigningComplete,
}: ESignProviderSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<ESignMethod>('aadhaar_otp');
  const [showDSCModal, setShowDSCModal] = useState(false);
  
  const { status } = useNetworkState();
  const isOfflineOrSlow = status === 'offline' || status === 'slow';

  const handleMethodChange = (value: string) => {
    const method = value as ESignMethod;
    setSelectedMethod(method);
    onMethodSelected?.(method);
  };

  const handleProceed = () => {
    if (selectedMethod === 'dsc_token') {
      setShowDSCModal(true);
    } else {
      onAadhaarSigningInitiate?.();
    }
  };

  const handleDSCSigningComplete = (result: {
    success: boolean;
    transactionId?: string;
    certificateId?: string;
    signedAt?: Date;
  }) => {
    setShowDSCModal(false);
    onSigningComplete?.({
      ...result,
      method: 'dsc_token',
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Choose Signing Method
          </CardTitle>
          <CardDescription>
            Select how you want to digitally sign this document
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedMethod} onValueChange={handleMethodChange}>
            <div className="space-y-4">
              <div 
                className={`flex items-start space-x-4 p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedMethod === 'aadhaar_otp' 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-muted-foreground/50'
                }`}
                onClick={() => handleMethodChange('aadhaar_otp')}
                data-testid="option-aadhaar-otp"
              >
                <RadioGroupItem value="aadhaar_otp" id="aadhaar_otp" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="aadhaar_otp" className="text-base font-medium cursor-pointer">
                      Aadhaar eSign (OTP)
                    </Label>
                    <Badge variant="secondary">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign using OTP sent to your Aadhaar-linked mobile number
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Smartphone className="h-3 w-3" />
                      <span>Mobile OTP</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>2-3 minutes</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wifi className="h-3 w-3" />
                      <span>Requires internet</span>
                    </div>
                  </div>
                  {!signerAadhaar && (
                    <Alert className="mt-3">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        You'll need to provide your Aadhaar number for OTP verification
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <Smartphone className="h-8 w-8 text-primary" />
              </div>

              <div 
                className={`flex items-start space-x-4 p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedMethod === 'dsc_token' 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-muted-foreground/50'
                }`}
                onClick={() => handleMethodChange('dsc_token')}
                data-testid="option-dsc-token"
              >
                <RadioGroupItem value="dsc_token" id="dsc_token" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dsc_token" className="text-base font-medium cursor-pointer">
                      DSC Token (Hardware)
                    </Label>
                    <Badge variant="outline">Class 2/3</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign using your USB DSC token or smart card
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Usb className="h-3 w-3" />
                      <span>USB Token</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Instant</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <WifiOff className="h-3 w-3" />
                      <span>Works offline*</span>
                    </div>
                  </div>
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Requires DSC token software installed. Signing works offline but submission requires internet.
                    </AlertDescription>
                  </Alert>
                </div>
                <Usb className="h-8 w-8 text-primary" />
              </div>
            </div>
          </RadioGroup>

          {isOfflineOrSlow && (
            <Alert variant="destructive">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You are currently {status}. 
                {selectedMethod === 'aadhaar_otp' 
                  ? ' Aadhaar OTP requires internet connectivity.' 
                  : ' DSC signing works locally but submission will be queued until online.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-2">
            <Button 
              onClick={handleProceed}
              className="w-full"
              disabled={isOfflineOrSlow && selectedMethod === 'aadhaar_otp'}
              data-testid="button-proceed-esign"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Proceed with {selectedMethod === 'aadhaar_otp' ? 'Aadhaar OTP' : 'DSC Token'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2">
            <p>
              Both methods are legally valid under IT Act 2000 and SEBI regulations.
              <br />
              Your digital signature is as valid as a handwritten signature.
            </p>
          </div>
        </CardContent>
      </Card>

      <DSCSigningModal
        open={showDSCModal}
        onClose={() => setShowDSCModal(false)}
        documentType={documentType}
        documentName={documentName}
        documentHash={documentHash}
        documentUrl={documentUrl}
        signerName={signerName}
        onSigningComplete={handleDSCSigningComplete}
      />
    </>
  );
}

export default ESignProviderSelector;
