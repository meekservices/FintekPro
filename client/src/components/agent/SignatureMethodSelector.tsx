import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileSignature, Fingerprint, Key, Smartphone, 
  Shield as LucideShield, Clock, CheckCircle, AlertTriangle, Info, PenTool, Plus, ArrowLeft, Star
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SignatureCanvas, SignatureData } from '@/components/esign/SignatureCanvas';

export type SignatureMethod = 'zoho_sign' | 'aadhaar_esign' | 'dsc_token' | 'otp' | 'user_signature';

interface UserSignature {
  id: string;
  name: string;
  signatureType: 'upload' | 'draw' | 'type';
  signatureDataUrl: string;
  isDefault: boolean;
}

interface SignatureMethodSelectorProps {
  onSelect: (method: SignatureMethod, signatureDataUrl?: string) => void;
  onCancel?: () => void;
  selectedMethod?: SignatureMethod;
  isLoading?: boolean;
  allowedMethods?: SignatureMethod[];
  participantName?: string;
  requireVisualSignature?: boolean;
}

interface MethodInfo {
  id: SignatureMethod;
  name: string;
  description: string;
  icon: typeof FileSignature;
  legalValidity: 'High' | 'Medium' | 'Standard';
  timeEstimate: string;
  requirements: string[];
  bestFor: string;
  sebiCompliant: boolean;
}

const SIGNATURE_METHODS: MethodInfo[] = [
  {
    id: 'aadhaar_esign',
    name: 'Aadhaar eSign',
    description: 'Authenticate with Aadhaar OTP for legally valid digital signature',
    icon: Fingerprint,
    legalValidity: 'High',
    timeEstimate: '2-3 minutes',
    requirements: ['Aadhaar number linked to mobile', 'OTP verification'],
    bestFor: 'Individuals with Aadhaar-linked mobile',
    sebiCompliant: true,
  },
  {
    id: 'dsc_token',
    name: 'Digital Signature Certificate (DSC)',
    description: 'Use hardware token DSC for highest legal validity',
    icon: Key,
    legalValidity: 'High',
    timeEstimate: '1-2 minutes',
    requirements: ['USB DSC Token', 'Token driver installed', 'PIN'],
    bestFor: 'Companies, HNIs, frequent signers',
    sebiCompliant: true,
  },
  {
    id: 'zoho_sign',
    name: 'Zoho Sign',
    description: 'Electronic signature via email verification',
    icon: FileSignature,
    legalValidity: 'Medium',
    timeEstimate: '1-2 minutes',
    requirements: ['Email access', 'Email verification'],
    bestFor: 'Quick signatures, international clients',
    sebiCompliant: true,
  },
  {
    id: 'otp',
    name: 'OTP Signature',
    description: 'Sign using mobile OTP verification',
    icon: Smartphone,
    legalValidity: 'Standard',
    timeEstimate: '1 minute',
    requirements: ['Registered mobile number'],
    bestFor: 'Simple documents, quick approvals',
    sebiCompliant: true,
  },
  {
    id: 'user_signature',
    name: 'Saved Signature',
    description: 'Use your uploaded, drawn, or typed signature instantly',
    icon: PenTool,
    legalValidity: 'Standard',
    timeEstimate: 'Instant',
    requirements: ['Saved signature in your profile'],
    bestFor: 'Quick internal documents, agreements',
    sebiCompliant: false,
  },
];

const METHODS_REQUIRING_VISUAL_SIGNATURE: SignatureMethod[] = ['zoho_sign', 'otp', 'user_signature'];

export default function SignatureMethodSelector({
  onSelect,
  onCancel,
  selectedMethod,
  isLoading = false,
  allowedMethods = ['zoho_sign', 'aadhaar_esign', 'dsc_token', 'otp', 'user_signature'],
  participantName,
  requireVisualSignature = true,
}: SignatureMethodSelectorProps) {
  const [selected, setSelected] = useState<SignatureMethod | undefined>(selectedMethod);
  const [step, setStep] = useState<'method' | 'signature'>('method');
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [tempSignature, setTempSignature] = useState<string | null>(null);

  const { data: signaturesData, isLoading: signaturesLoading } = useQuery<{ success: boolean; signatures: UserSignature[] }>({
    queryKey: ['/api/user/signatures'],
    enabled: step === 'signature',
  });

  const signatures = signaturesData?.signatures || [];
  const defaultSignature = signatures.find(s => s.isDefault);

  const availableMethods = SIGNATURE_METHODS.filter(m => allowedMethods.includes(m.id));

  const needsVisualSignature = (method: SignatureMethod) => 
    requireVisualSignature && METHODS_REQUIRING_VISUAL_SIGNATURE.includes(method);

  const handleConfirm = () => {
    if (selected) {
      if (needsVisualSignature(selected)) {
        setStep('signature');
        if (defaultSignature) {
          setSelectedSignature(defaultSignature.signatureDataUrl);
        }
      } else {
        onSelect(selected);
      }
    }
  };

  const handleSignatureConfirm = () => {
    if (selected && (selectedSignature || tempSignature)) {
      onSelect(selected, selectedSignature || tempSignature || undefined);
    }
  };

  const handleCreateSignature = (signatureData: SignatureData) => {
    setTempSignature(signatureData.dataUrl);
    setSelectedSignature(null);
    setShowCreateDialog(false);
  };

  if (step === 'signature') {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep('method')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Select Your Signature
                </CardTitle>
                <CardDescription>
                  Choose a saved signature or create a new one
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {signaturesLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : signatures.length === 0 && !tempSignature ? (
              <Alert>
                <PenTool className="h-4 w-4" />
                <AlertDescription>
                  You don't have any saved signatures. Create one to proceed with signing.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {signatures.map((sig) => (
                  <div
                    key={sig.id}
                    onClick={() => {
                      setSelectedSignature(sig.signatureDataUrl);
                      setTempSignature(null);
                    }}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      selectedSignature === sig.signatureDataUrl
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate">{sig.name}</span>
                      {sig.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="border rounded bg-background p-2 flex items-center justify-center min-h-[60px]">
                      <img
                        src={sig.signatureDataUrl}
                        alt={sig.name}
                        className="max-w-full max-h-[50px] object-contain"
                      />
                    </div>
                  </div>
                ))}
                {tempSignature && (
                  <div
                    onClick={() => {
                      setSelectedSignature(null);
                    }}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      !selectedSignature && tempSignature
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">New Signature</span>
                      <Badge variant="outline" className="text-xs">One-time</Badge>
                    </div>
                    <div className="border rounded bg-background p-2 flex items-center justify-center min-h-[60px]">
                      <img
                        src={tempSignature}
                        alt="New signature"
                        className="max-w-full max-h-[50px] object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Signature
            </Button>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSignatureConfirm}
                disabled={!selectedSignature && !tempSignature || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Signing...
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Sign Document
                  </>
                )}
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Signature</DialogTitle>
              <DialogDescription>
                This signature will be used for this document only.
              </DialogDescription>
            </DialogHeader>
            <SignatureCanvas
              onSave={handleCreateSignature}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const getValidityBadge = (validity: 'High' | 'Medium' | 'Standard') => {
    switch (validity) {
      case 'High':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">High Validity</Badge>;
      case 'Medium':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Medium Validity</Badge>;
      case 'Standard':
        return <Badge className="bg-muted text-foreground">Standard Validity</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Select Signature Method
        </CardTitle>
        <CardDescription>
          {participantName 
            ? `Choose how ${participantName} will sign the document`
            : 'Choose your preferred digital signature method'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <LucideShield className="h-4 w-4" />
          <AlertDescription>
            All signature methods are SEBI-compliant and legally binding for investment agreements in India.
          </AlertDescription>
        </Alert>

        <RadioGroup value={selected} onValueChange={(v) => setSelected(v as SignatureMethod)}>
          <div className="grid gap-4">
            {availableMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selected === method.id;

              return (
                <Label
                  key={method.id}
                  htmlFor={method.id}
                  className={`flex cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
                  
                  <div className="flex gap-4 w-full">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{method.name}</span>
                        {getValidityBadge(method.legalValidity)}
                        {method.sebiCompliant && (
                          <Badge variant="outline" className="text-xs">SEBI</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {method.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {method.timeEstimate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {method.bestFor}
                        </span>
                      </div>
                      
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium mb-1">Requirements:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {method.requirements.map((req, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                </Label>
              );
            })}
          </div>
        </RadioGroup>

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleConfirm} 
            disabled={!selected || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Initiating...
              </>
            ) : (
              <>
                <FileSignature className="h-4 w-4 mr-2" />
                Proceed with {selected ? SIGNATURE_METHODS.find(m => m.id === selected)?.name : 'Selected Method'}
              </>
            )}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
