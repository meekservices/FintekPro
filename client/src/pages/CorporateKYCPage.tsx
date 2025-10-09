import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Search,
  Loader2,
  UserPlus,
  Shield
} from "lucide-react";

// Entity Type Schema
const entityTypeSchema = z.object({
  entityType: z.enum(["company", "partnership", "trust", "llp", "huf", "society", "cooperative"], {
    required_error: "Please select entity type",
  }),
});

// Company Verification Schema
const companyVerificationSchema = z.object({
  cin: z.string().regex(/^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, "Invalid CIN format"),
  companyPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
  tan: z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, "Invalid TAN format").optional().or(z.literal("")),
  companyName: z.string().min(1, "Company name is required"),
  dateOfIncorporation: z.string().optional(),
  registeredAddress: z.string().optional(),
});

// Director Schema
const directorSchema = z.object({
  din: z.string().regex(/^[0-9]{8}$/, "DIN must be 8 digits"),
  name: z.string().min(1, "Director name is required"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  designation: z.string().min(1, "Designation is required"),
  shareholding: z.string().optional(),
});

// Beneficial Owner Schema
const beneficialOwnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  ownershipPercentage: z.string().regex(/^[0-9]{1,3}(\.[0-9]{1,2})?$/, "Invalid percentage"),
  address: z.string().min(1, "Address is required"),
});

type EntityType = z.infer<typeof entityTypeSchema>["entityType"];

export default function CorporateKYCPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<'entity' | 'verification' | 'directors' | 'beneficial-owners' | 'review'>('entity');
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [directors, setDirectors] = useState<any[]>([]);
  const [beneficialOwners, setBeneficialOwners] = useState<any[]>([]);

  // Entity Type Form
  const entityForm = useForm<z.infer<typeof entityTypeSchema>>({
    resolver: zodResolver(entityTypeSchema),
  });

  // Company Verification Form
  const companyForm = useForm<z.infer<typeof companyVerificationSchema>>({
    resolver: zodResolver(companyVerificationSchema),
  });

  // Director Form
  const directorForm = useForm<z.infer<typeof directorSchema>>({
    resolver: zodResolver(directorSchema),
  });

  // Beneficial Owner Form
  const beneficialOwnerForm = useForm<z.infer<typeof beneficialOwnerSchema>>({
    resolver: zodResolver(beneficialOwnerSchema),
  });

  // Verify Company Mutation
  const verifyCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyVerificationSchema>) => {
      const response = await fetch('/api/corporate-kyc/verify-entity', {
        method: 'POST',
        body: JSON.stringify({
          entityType: selectedEntityType,
          cin: data.cin,
          pan: data.companyPan,
          gstin: data.gstin || undefined,
          tan: data.tan || undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setVerificationResult(data);
      toast({
        title: "Verification Complete",
        description: data.verified ? "Entity verified successfully" : "Verification completed with some issues",
      });
      
      // Auto-populate directors from MCA data if available
      if (data.details?.mca?.directors) {
        setDirectors(data.details.mca.directors.map((d: any) => ({
          din: d.din,
          name: d.name,
          designation: d.designation,
          pan: '', // User needs to add this
          shareholding: '',
        })));
      }
      
      setCurrentStep('directors');
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit Corporate KYC Mutation
  const submitKYCMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/corporate-kyc/submit', {
        method: 'POST',
        body: JSON.stringify({
          entityType: selectedEntityType,
          verificationResult,
          directors,
          beneficialOwners,
          companyDetails: companyForm.getValues(),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "KYC Submitted Successfully",
        description: "Your corporate KYC application has been submitted for review",
      });
    },
  });

  const onEntityTypeSubmit = (data: z.infer<typeof entityTypeSchema>) => {
    setSelectedEntityType(data.entityType);
    setCurrentStep('verification');
  };

  const onCompanyVerificationSubmit = (data: z.infer<typeof companyVerificationSchema>) => {
    verifyCompanyMutation.mutate(data);
  };

  const addDirector = (data: z.infer<typeof directorSchema>) => {
    setDirectors([...directors, data]);
    directorForm.reset();
    toast({ title: "Director Added", description: `${data.name} has been added` });
  };

  const addBeneficialOwner = (data: z.infer<typeof beneficialOwnerSchema>) => {
    setBeneficialOwners([...beneficialOwners, data]);
    beneficialOwnerForm.reset();
    toast({ title: "Beneficial Owner Added", description: `${data.name} has been added` });
  };

  const getProgressPercentage = () => {
    const steps = ['entity', 'verification', 'directors', 'beneficial-owners', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Corporate KYC Verification
          </h1>
          <p className="text-muted-foreground mt-2">
            Complete KYC verification for non-individual entities using government-authorized data sources
          </p>
        </div>

        {/* Progress Indicator */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(getProgressPercentage())}%</span>
              </div>
              <Progress value={getProgressPercentage()} />
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Entity Type Selection */}
        {currentStep === 'entity' && (
          <Card>
            <CardHeader>
              <CardTitle>Select Entity Type</CardTitle>
              <CardDescription>Choose the type of organization for KYC verification</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...entityForm}>
                <form onSubmit={entityForm.handleSubmit(onEntityTypeSubmit)} className="space-y-6">
                  <FormField
                    control={entityForm.control}
                    name="entityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entity Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-entity-type">
                              <SelectValue placeholder="Select entity type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">Private/Public Limited Company</SelectItem>
                            <SelectItem value="partnership">Partnership Firm</SelectItem>
                            <SelectItem value="trust">Trust</SelectItem>
                            <SelectItem value="llp">Limited Liability Partnership (LLP)</SelectItem>
                            <SelectItem value="huf">Hindu Undivided Family (HUF)</SelectItem>
                            <SelectItem value="society">Society/NGO</SelectItem>
                            <SelectItem value="cooperative">Cooperative Society</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" data-testid="button-continue-entity">
                    Continue to Verification
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Entity Verification */}
        {currentStep === 'verification' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Entity Verification
              </CardTitle>
              <CardDescription>
                Verify {selectedEntityType} details using government databases (MCA, GSTIN, PAN)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...companyForm}>
                <form onSubmit={companyForm.handleSubmit(onCompanyVerificationSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={companyForm.control}
                      name="cin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CIN/LLPIN *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="U12345AB1234ABC123456" data-testid="input-cin" />
                          </FormControl>
                          <FormDescription>21-character Corporate ID</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="companyPan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Corporate PAN *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="AAACT1234F" data-testid="input-company-pan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GSTIN (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="22AAAAA0000A1Z5" data-testid="input-gstin" />
                          </FormControl>
                          <FormDescription>GST registration number</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="tan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TAN (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ABCD12345E" data-testid="input-tan" />
                          </FormControl>
                          <FormDescription>Tax Deduction Account Number</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={companyForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company/Entity Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABC Private Limited" data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep('entity')}
                      data-testid="button-back-entity"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={verifyCompanyMutation.isPending}
                      data-testid="button-verify-entity"
                    >
                      {verifyCompanyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Verify Entity
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Verification Results */}
              {verificationResult && (
                <div className="mt-6 space-y-4">
                  <Separator />
                  <Alert variant={verificationResult.verified ? "default" : "destructive"}>
                    {verificationResult.verified ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>Verification Result</AlertTitle>
                    <AlertDescription>
                      {verificationResult.verified
                        ? "Entity verified successfully from government databases"
                        : "Verification completed with issues. Please review below."}
                    </AlertDescription>
                  </Alert>

                  {verificationResult.details?.mca && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">MCA Verification</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div><strong>Company:</strong> {verificationResult.details.mca.companyName}</div>
                        <div><strong>Status:</strong> <Badge>{verificationResult.details.mca.companyStatus}</Badge></div>
                        <div><strong>Incorporation:</strong> {verificationResult.details.mca.dateOfIncorporation}</div>
                        <div><strong>Directors:</strong> {verificationResult.details.mca.directors?.length || 0}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Directors/Partners */}
        {currentStep === 'directors' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Directors/Partners/Authorized Persons
              </CardTitle>
              <CardDescription>Add KYC details for all authorized persons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Directors */}
              {directors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Added Directors ({directors.length})</h3>
                  {directors.map((dir, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{dir.name}</div>
                        <div className="text-sm text-muted-foreground">DIN: {dir.din} | {dir.designation}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDirectors(directors.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Separator />
                </div>
              )}

              {/* Add Director Form */}
              <Form {...directorForm}>
                <form onSubmit={directorForm.handleSubmit(addDirector)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={directorForm.control}
                      name="din"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>DIN *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="01234567" data-testid="input-director-din" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={directorForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Doe" data-testid="input-director-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={directorForm.control}
                      name="pan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ABCDE1234F" data-testid="input-director-pan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={directorForm.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Managing Director" data-testid="input-director-designation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" variant="outline" className="w-full" data-testid="button-add-director">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Director
                  </Button>
                </form>
              </Form>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('verification')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setCurrentStep('beneficial-owners')}
                  disabled={directors.length === 0}
                  data-testid="button-continue-directors"
                >
                  Continue to Beneficial Owners
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Beneficial Owners */}
        {currentStep === 'beneficial-owners' && (
          <Card>
            <CardHeader>
              <CardTitle>Beneficial Ownership Declaration</CardTitle>
              <CardDescription>Declare ultimate beneficial owners (25% or more ownership)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {beneficialOwners.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Declared Beneficial Owners ({beneficialOwners.length})</h3>
                  {beneficialOwners.map((owner, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{owner.name}</div>
                        <div className="text-sm text-muted-foreground">
                          PAN: {owner.pan} | Ownership: {owner.ownershipPercentage}%
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBeneficialOwners(beneficialOwners.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Separator />
                </div>
              )}

              <Form {...beneficialOwnerForm}>
                <form onSubmit={beneficialOwnerForm.handleSubmit(addBeneficialOwner)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={beneficialOwnerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Jane Doe" data-testid="input-ubo-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={beneficialOwnerForm.control}
                      name="pan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ABCDE1234F" data-testid="input-ubo-pan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={beneficialOwnerForm.control}
                      name="ownershipPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ownership % *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="25.00" data-testid="input-ubo-percentage" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={beneficialOwnerForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Complete address" data-testid="input-ubo-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" variant="outline" className="w-full" data-testid="button-add-ubo">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Beneficial Owner
                  </Button>
                </form>
              </Form>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep('directors')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setCurrentStep('review')}
                  data-testid="button-continue-ubo"
                >
                  Review & Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review & Submit */}
        {currentStep === 'review' && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Submit</CardTitle>
              <CardDescription>Review all information before submitting KYC application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Entity Details</h3>
                  <div className="text-sm space-y-1">
                    <div>Type: <Badge>{selectedEntityType}</Badge></div>
                    <div>Name: {verificationResult?.details?.mca?.companyName || companyForm.getValues().companyName}</div>
                    <div>PAN: {companyForm.getValues().companyPan}</div>
                    <div>CIN: {companyForm.getValues().cin}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Directors/Authorized Persons ({directors.length})</h3>
                  {directors.map((dir, idx) => (
                    <div key={idx} className="text-sm py-1">
                      {dir.name} - {dir.designation}
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Beneficial Owners ({beneficialOwners.length})</h3>
                  {beneficialOwners.map((owner, idx) => (
                    <div key={idx} className="text-sm py-1">
                      {owner.name} - {owner.ownershipPercentage}%
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Declaration</AlertTitle>
                <AlertDescription>
                  I hereby declare that all information provided is true and accurate. I understand that providing false information may result in rejection of this application.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentStep('beneficial-owners')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => submitKYCMutation.mutate()}
                  disabled={submitKYCMutation.isPending}
                  data-testid="button-submit-corporate-kyc"
                >
                  {submitKYCMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Submit KYC Application
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
