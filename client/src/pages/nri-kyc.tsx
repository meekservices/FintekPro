import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Shield,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plane
} from "lucide-react";

type WizardStep = 'pan_verification' | 'passport_verification' | 'oci_pio_card' | 'overseas_address' | 'bank_details' | 'fema_compliance' | 'completed';

export default function NRIKYCWizard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('pan_verification');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authentication guard
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please login to access NRI KYC onboarding",
        variant: "destructive"
      });
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation, toast]);

  // PAN Verification
  const [panNumber, setPanNumber] = useState('');
  const [panFullName, setPanFullName] = useState('');
  const [panDob, setPanDob] = useState('');
  const [panVerified, setPanVerified] = useState(false);

  // Passport Details
  const [passportNumber, setPassportNumber] = useState('');
  const [passportCountry, setPassportCountry] = useState('');
  const [passportIssueDate, setPassportIssueDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [passportVerified, setPassportVerified] = useState(false);

  // OCI/PIO Card
  const [hasOciPio, setHasOciPio] = useState<string>('');
  const [ociPioCardType, setOciPioCardType] = useState<string>('');
  const [ociPioNumber, setOciPioNumber] = useState('');
  const [ociPioIssueDate, setOciPioIssueDate] = useState('');

  // Overseas Address
  const [overseasAddress1, setOverseasAddress1] = useState('');
  const [overseasAddress2, setOverseasAddress2] = useState('');
  const [overseasCity, setOverseasCity] = useState('');
  const [overseasState, setOverseasState] = useState('');
  const [overseasCountry, setOverseasCountry] = useState('');
  const [overseasZipCode, setOverseasZipCode] = useState('');
  const [taxResidencyCountry, setTaxResidencyCountry] = useState('');

  // Bank Details
  const [bankAccountType, setBankAccountType] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');

  // FEMA Compliance
  const [femaCompliant, setFemaCompliant] = useState(false);
  const [fatcaDeclaration, setFatcaDeclaration] = useState(false);
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState('');

  const steps: { key: WizardStep; title: string; description: string }[] = [
    { key: 'pan_verification', title: 'PAN Verification', description: 'Verify your Indian PAN card' },
    { key: 'passport_verification', title: 'Passport Details', description: 'Verify your passport information' },
    { key: 'oci_pio_card', title: 'OCI/PIO Card', description: 'OCI or PIO card details (if applicable)' },
    { key: 'overseas_address', title: 'Overseas Address', description: 'Your current residential address abroad' },
    { key: 'bank_details', title: 'Bank Details', description: 'NRE/NRO bank account information' },
    { key: 'fema_compliance', title: 'FEMA Compliance', description: 'FEMA and FATCA declarations' },
    { key: 'completed', title: 'Completed', description: 'KYC submission complete' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handlePanVerification = async () => {
    if (!panNumber || !panFullName || !panDob) {
      toast({
        title: "Missing Information",
        description: "Please fill in all PAN details",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setPanVerified(true);
      setCurrentStep('passport_verification');
      setIsSubmitting(false);
      toast({
        title: "PAN Verified",
        description: "Your PAN has been successfully verified",
      });
    }, 1500);
  };

  const handlePassportVerification = () => {
    if (!passportNumber || !passportCountry || !passportIssueDate || !passportExpiryDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all passport details",
        variant: "destructive"
      });
      return;
    }

    setPassportVerified(true);
    setCurrentStep('oci_pio_card');
    toast({
      title: "Passport Details Saved",
      description: "Your passport information has been recorded",
    });
  };

  const handleOciPioSubmit = () => {
    if (hasOciPio === 'yes' && (!ociPioCardType || !ociPioNumber)) {
      toast({
        title: "Missing Information",
        description: "Please fill in OCI/PIO card details",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep('overseas_address');
    toast({
      title: "OCI/PIO Information Saved",
      description: "Proceeding to overseas address",
    });
  };

  const handleOverseasAddressSubmit = () => {
    if (!overseasAddress1 || !overseasCity || !overseasCountry || !taxResidencyCountry) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required address fields",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep('bank_details');
  };

  const handleBankDetailsSubmit = () => {
    if (!bankAccountType || !bankName || !bankAccountNumber || !bankIfscCode) {
      toast({
        title: "Missing Information",
        description: "Please fill in all bank details",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep('fema_compliance');
  };

  const handleFinalSubmit = async () => {
    if (!femaCompliant || !fatcaDeclaration) {
      toast({
        title: "Declarations Required",
        description: "Please accept all compliance declarations",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate final submission
    setTimeout(() => {
      setCurrentStep('completed');
      setIsSubmitting(false);
      toast({
        title: "NRI KYC Submitted",
        description: "Your NRI KYC application has been submitted for verification",
      });
    }, 2000);
  };

  const goBack = () => {
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-finance-blue" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Globe className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NRI KYC Wizard</h1>
            <p className="text-gray-600">Smart Mode - Step-by-step NRI verification</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{steps[currentStepIndex]?.title}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* AI Assistant Banner */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">AI-Assisted NRI KYC</AlertTitle>
        <AlertDescription className="text-blue-700">
          This wizard is optimized for Non-Resident Indians with passport verification, OCI/PIO validation, and FEMA compliance
        </AlertDescription>
      </Alert>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 'completed' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Shield className="h-5 w-5 text-blue-600" />
            )}
            {steps[currentStepIndex]?.title}
          </CardTitle>
          <CardDescription>{steps[currentStepIndex]?.description}</CardDescription>
        </CardHeader>

        <CardContent>
          {/* PAN Verification Step */}
          {currentStep === 'pan_verification' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="pan">PAN Number *</Label>
                <Input
                  id="pan"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  maxLength={10}
                  data-testid="input-pan-number"
                />
              </div>

              <div>
                <Label htmlFor="pan-name">Full Name (as per PAN) *</Label>
                <Input
                  id="pan-name"
                  placeholder="Full name"
                  value={panFullName}
                  onChange={(e) => setPanFullName(e.target.value)}
                  data-testid="input-pan-name"
                />
              </div>

              <div>
                <Label htmlFor="pan-dob">Date of Birth *</Label>
                <Input
                  id="pan-dob"
                  type="date"
                  value={panDob}
                  onChange={(e) => setPanDob(e.target.value)}
                  data-testid="input-pan-dob"
                />
              </div>

              <Button 
                onClick={handlePanVerification}
                disabled={isSubmitting}
                className="w-full"
                data-testid="button-verify-pan"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify PAN
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Passport Verification Step */}
          {currentStep === 'passport_verification' && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Plane className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  Enter your valid passport details for NRI verification
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="passport-number">Passport Number *</Label>
                <Input
                  id="passport-number"
                  placeholder="A1234567"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                  data-testid="input-passport-number"
                />
              </div>

              <div>
                <Label htmlFor="passport-country">Country of Issue *</Label>
                <Input
                  id="passport-country"
                  placeholder="e.g., USA, UK, Canada"
                  value={passportCountry}
                  onChange={(e) => setPassportCountry(e.target.value)}
                  data-testid="input-passport-country"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passport-issue">Issue Date *</Label>
                  <Input
                    id="passport-issue"
                    type="date"
                    value={passportIssueDate}
                    onChange={(e) => setPassportIssueDate(e.target.value)}
                    data-testid="input-passport-issue"
                  />
                </div>

                <div>
                  <Label htmlFor="passport-expiry">Expiry Date *</Label>
                  <Input
                    id="passport-expiry"
                    type="date"
                    value={passportExpiryDate}
                    onChange={(e) => setPassportExpiryDate(e.target.value)}
                    data-testid="input-passport-expiry"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handlePassportVerification} className="flex-1" data-testid="button-next-passport">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* OCI/PIO Card Step */}
          {currentStep === 'oci_pio_card' && (
            <div className="space-y-4">
              <div>
                <Label>Do you have an OCI or PIO card? *</Label>
                <Select value={hasOciPio} onValueChange={setHasOciPio}>
                  <SelectTrigger data-testid="select-has-oci-pio">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasOciPio === 'yes' && (
                <>
                  <div>
                    <Label>Card Type *</Label>
                    <Select value={ociPioCardType} onValueChange={setOciPioCardType}>
                      <SelectTrigger data-testid="select-card-type">
                        <SelectValue placeholder="Select card type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oci">OCI (Overseas Citizen of India)</SelectItem>
                        <SelectItem value="pio">PIO (Person of Indian Origin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="oci-number">Card Number *</Label>
                    <Input
                      id="oci-number"
                      placeholder="Enter OCI/PIO card number"
                      value={ociPioNumber}
                      onChange={(e) => setOciPioNumber(e.target.value)}
                      data-testid="input-oci-number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="oci-issue">Issue Date *</Label>
                    <Input
                      id="oci-issue"
                      type="date"
                      value={ociPioIssueDate}
                      onChange={(e) => setOciPioIssueDate(e.target.value)}
                      data-testid="input-oci-issue"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleOciPioSubmit} className="flex-1" data-testid="button-next-oci">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Overseas Address Step */}
          {currentStep === 'overseas_address' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="address1">Address Line 1 *</Label>
                <Input
                  id="address1"
                  placeholder="Street address"
                  value={overseasAddress1}
                  onChange={(e) => setOverseasAddress1(e.target.value)}
                  data-testid="input-address1"
                />
              </div>

              <div>
                <Label htmlFor="address2">Address Line 2</Label>
                <Input
                  id="address2"
                  placeholder="Apartment, suite, etc."
                  value={overseasAddress2}
                  onChange={(e) => setOverseasAddress2(e.target.value)}
                  data-testid="input-address2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={overseasCity}
                    onChange={(e) => setOverseasCity(e.target.value)}
                    data-testid="input-city"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={overseasState}
                    onChange={(e) => setOverseasState(e.target.value)}
                    data-testid="input-state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={overseasCountry}
                    onChange={(e) => setOverseasCountry(e.target.value)}
                    data-testid="input-country"
                  />
                </div>

                <div>
                  <Label htmlFor="zipcode">ZIP/Postal Code</Label>
                  <Input
                    id="zipcode"
                    value={overseasZipCode}
                    onChange={(e) => setOverseasZipCode(e.target.value)}
                    data-testid="input-zipcode"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tax-country">Tax Residency Country *</Label>
                <Input
                  id="tax-country"
                  placeholder="Country where you pay taxes"
                  value={taxResidencyCountry}
                  onChange={(e) => setTaxResidencyCountry(e.target.value)}
                  data-testid="input-tax-country"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleOverseasAddressSubmit} className="flex-1" data-testid="button-next-address">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Bank Details Step */}
          {currentStep === 'bank_details' && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  Provide your NRE (Non-Resident External) or NRO (Non-Resident Ordinary) account details
                </AlertDescription>
              </Alert>

              <div>
                <Label>Account Type *</Label>
                <Select value={bankAccountType} onValueChange={setBankAccountType}>
                  <SelectTrigger data-testid="select-account-type">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nre">NRE (Non-Resident External)</SelectItem>
                    <SelectItem value="nro">NRO (Non-Resident Ordinary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bank-name">Bank Name *</Label>
                <Input
                  id="bank-name"
                  placeholder="e.g., ICICI Bank, HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  data-testid="input-bank-name"
                />
              </div>

              <div>
                <Label htmlFor="account-number">Account Number *</Label>
                <Input
                  id="account-number"
                  placeholder="Enter account number"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  data-testid="input-account-number"
                />
              </div>

              <div>
                <Label htmlFor="ifsc">IFSC Code *</Label>
                <Input
                  id="ifsc"
                  placeholder="e.g., ICIC0000001"
                  value={bankIfscCode}
                  onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                  data-testid="input-ifsc"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleBankDetailsSubmit} className="flex-1" data-testid="button-next-bank">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* FEMA Compliance Step */}
          {currentStep === 'fema_compliance' && (
            <div className="space-y-4">
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-900">FEMA & FATCA Compliance</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  As an NRI investor, you must comply with Foreign Exchange Management Act (FEMA) regulations and FATCA reporting
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="tin">Tax Identification Number (TIN) *</Label>
                <Input
                  id="tin"
                  placeholder="Enter your TIN from tax residency country"
                  value={taxIdentificationNumber}
                  onChange={(e) => setTaxIdentificationNumber(e.target.value)}
                  data-testid="input-tin"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="fema"
                    checked={femaCompliant}
                    onCheckedChange={(checked) => setFemaCompliant(checked as boolean)}
                    data-testid="checkbox-fema"
                  />
                  <Label htmlFor="fema" className="text-sm leading-relaxed cursor-pointer">
                    I hereby declare that I comply with FEMA regulations and my investments will be made in accordance with RBI guidelines for NRI investors
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="fatca"
                    checked={fatcaDeclaration}
                    onCheckedChange={(checked) => setFatcaDeclaration(checked as boolean)}
                    data-testid="checkbox-fatca"
                  />
                  <Label htmlFor="fatca" className="text-sm leading-relaxed cursor-pointer">
                    I confirm that I am compliant with FATCA (Foreign Account Tax Compliance Act) requirements and authorize disclosure of account information to tax authorities
                  </Label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                  data-testid="button-submit-nri-kyc"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit NRI KYC
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Completion Step */}
          {currentStep === 'completed' && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="p-4 bg-green-100 rounded-full">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">NRI KYC Submitted Successfully!</h3>
                <p className="text-gray-600">
                  Your NRI KYC application has been submitted for verification. You will be notified once the verification is complete.
                </p>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  Verification typically takes 2-3 business days. You can track the status in your KYC Dashboard.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setLocation('/kyc-dashboard')} className="flex-1">
                  View KYC Dashboard
                </Button>
                <Button onClick={() => setLocation('/')} className="flex-1">
                  Go to Home
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
