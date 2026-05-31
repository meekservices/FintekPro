import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  GraduationCap,
  Building2,
  MapPin,
  Clock,
  FileCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Award,
  User,
  Phone,
  Mail,
  Shield as LucideShield,
  IndianRupee
} from 'lucide-react';

const CA_SPECIALIZATIONS = [
  { value: 'itr_filing', label: 'ITR Filing (All Forms)' },
  { value: 'gst', label: 'GST Returns & Compliance' },
  { value: 'audit', label: 'Statutory & Tax Audit' },
  { value: 'form15', label: 'Form 15CA/15CB (International Remittance)' },
  { value: 'tax_notices', label: 'Tax Notices & Assessment' },
  { value: 'company_law', label: 'Company Law & ROC Compliance' },
  { value: 'tds', label: 'TDS Returns & Compliance' },
  { value: 'transfer_pricing', label: 'Transfer Pricing' },
  { value: 'startup', label: 'Startup Advisory & Compliance' },
  { value: 'nri_taxation', label: 'NRI Taxation' },
];

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry'
];

const caRegistrationSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().length(10, 'Mobile number must be 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  
  icaiMembershipNumber: z.string().min(5, 'ICAI membership number is required'),
  membershipType: z.enum(['ACA', 'FCA'], { error: 'Select membership type' }),
  copNumber: z.string().optional(),
  qualificationYear: z.coerce.number().min(1970).max(new Date().getFullYear()),
  experienceYears: z.coerce.number().min(0).max(50),
  
  firmName: z.string().optional(),
  firmRegistrationNumber: z.string().optional(),
  
  specializations: z.array(z.string()).min(1, 'Select at least one specialization'),
  
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  
  maxCasesPerMonth: z.coerce.number().min(5).max(200).default(50),
  responseTime: z.enum(['4h', '12h', '24h', '48h']).default('24h'),
  
  baseFeeItr1: z.coerce.number().min(0).default(500),
  baseFeeItr2: z.coerce.number().min(0).default(1500),
  baseFeeItr3: z.coerce.number().min(0).default(3000),
  baseFeeItr4: z.coerce.number().min(0).default(2000),
  
  panNumber: z.string().length(10, 'PAN must be 10 characters'),
  bankAccountNumber: z.string().min(8, 'Bank account number is required'),
  ifscCode: z.string().length(11, 'IFSC code must be 11 characters'),
  bankAccountHolderName: z.string().min(3, 'Account holder name is required'),
  
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  
  termsAccepted: z.literal(true, { error: "You must accept the terms" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type CARegistrationForm = z.infer<typeof caRegistrationSchema>;

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User },
  { id: 2, title: 'Professional', icon: GraduationCap },
  { id: 3, title: 'Specializations', icon: Briefcase },
  { id: 4, title: 'Capacity & Fees', icon: IndianRupee },
  { id: 5, title: 'Banking', icon: Building2 },
  { id: 6, title: 'Review', icon: FileCheck },
];

export default function CARegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<CARegistrationForm, any, CARegistrationForm>({
    resolver: zodResolver(caRegistrationSchema) as any,
    defaultValues: {
      fullName: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      icaiMembershipNumber: '',
      membershipType: undefined,
      copNumber: '',
      qualificationYear: new Date().getFullYear() - 5,
      experienceYears: 5,
      firmName: '',
      firmRegistrationNumber: '',
      specializations: [],
      city: '',
      state: '',
      maxCasesPerMonth: 50,
      responseTime: '24h',
      baseFeeItr1: 500,
      baseFeeItr2: 1500,
      baseFeeItr3: 3000,
      baseFeeItr4: 2000,
      panNumber: '',
      bankAccountNumber: '',
      ifscCode: '',
      bankAccountHolderName: '',
      bio: '',
      termsAccepted: false as any,
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: async (data: CARegistrationForm) => {
      const response = await apiRequest('/api/ca/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Registration Submitted',
        description: 'Your CA registration is under review. We will notify you once approved.',
      });
      setLocation('/ca-registration-success');
    },
    onError: (error: any) => {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  const onSubmit = (data: CARegistrationForm) => {
    setIsSubmitting(true);
    registerMutation.mutate(data);
  };
  
  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const getFieldsForStep = (step: number): string[] => {
    switch (step) {
      case 1:
        return ['fullName', 'email', 'mobile', 'password', 'confirmPassword'];
      case 2:
        return ['icaiMembershipNumber', 'membershipType', 'qualificationYear', 'experienceYears'];
      case 3:
        return ['specializations', 'city', 'state'];
      case 4:
        return ['maxCasesPerMonth', 'responseTime', 'baseFeeItr1', 'baseFeeItr2', 'baseFeeItr3', 'baseFeeItr4'];
      case 5:
        return ['panNumber', 'bankAccountNumber', 'ifscCode', 'bankAccountHolderName'];
      case 6:
        return ['termsAccepted'];
      default:
        return [];
    }
  };
  
  const progress = (currentStep / STEPS.length) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LucideShield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">CA Partner Registration</h1>
          </div>
          <p className="text-muted-foreground">
            Join FintekPro as a Chartered Accountant partner and grow your practice
          </p>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  step.id === currentStep
                    ? 'text-blue-600'
                    : step.id < currentStep
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    step.id === currentStep
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                      : step.id < currentStep
                      ? 'border-green-600 bg-green-50 dark:bg-green-950/30'
                      : 'border-border bg-card'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
            <CardDescription>
              Step {currentStep} of {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name (as per ICAI records)</FormLabel>
                          <FormControl>
                            <Input placeholder="CA John Doe" {...field} data-testid="input-fullname" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="ca@example.com" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="mobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile Number</FormLabel>
                            <FormControl>
                              <Input placeholder="9876543210" {...field} data-testid="input-mobile" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} data-testid="input-confirm-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="icaiMembershipNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ICAI Membership Number</FormLabel>
                            <FormControl>
                              <Input placeholder="123456" {...field} data-testid="input-icai-number" />
                            </FormControl>
                            <FormDescription>Your 6-digit ICAI membership number</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="membershipType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Membership Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-membership-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ACA">ACA (Associate)</SelectItem>
                                <SelectItem value="FCA">FCA (Fellow)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="copNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Certificate of Practice Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="COP Number" {...field} data-testid="input-cop" />
                          </FormControl>
                          <FormDescription>Required if you have a Certificate of Practice</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="qualificationYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year of Qualification</FormLabel>
                            <FormControl>
                              <Input type="number" min={1970} max={new Date().getFullYear()} {...field} data-testid="input-qual-year" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="experienceYears"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years of Experience</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={50} {...field} data-testid="input-experience" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <h4 className="font-medium">Firm Details (Optional)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firmName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Firm Name</FormLabel>
                              <FormControl>
                                <Input placeholder="ABC & Associates" {...field} data-testid="input-firm-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="firmRegistrationNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Firm Registration Number (FRN)</FormLabel>
                              <FormControl>
                                <Input placeholder="FRN Number" {...field} data-testid="input-frn" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="specializations"
                      render={() => (
                        <FormItem>
                          <FormLabel>Areas of Expertise</FormLabel>
                          <FormDescription>Select all areas where you provide services</FormDescription>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                            {CA_SPECIALIZATIONS.map((spec) => (
                              <FormField
                                key={spec.value}
                                control={form.control}
                                name="specializations"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(spec.value)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, spec.value])
                                            : field.onChange(
                                                field.value?.filter((value: string) => value !== spec.value)
                                              );
                                        }}
                                        data-testid={`checkbox-spec-${spec.value}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer flex-1">
                                      {spec.label}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Mumbai" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STATES.map((state) => (
                                  <SelectItem key={state} value={state}>{state}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="maxCasesPerMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Cases per Month</FormLabel>
                            <FormControl>
                              <Input type="number" min={5} max={200} {...field} data-testid="input-max-cases" />
                            </FormControl>
                            <FormDescription>How many cases can you handle monthly?</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="responseTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Typical Response Time</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-response-time">
                                  <SelectValue placeholder="Select response time" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="4h">Within 4 hours</SelectItem>
                                <SelectItem value="12h">Within 12 hours</SelectItem>
                                <SelectItem value="24h">Within 24 hours</SelectItem>
                                <SelectItem value="48h">Within 48 hours</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-medium mb-4">Fee Structure (Your Base Fees)</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Set your base fees for different ITR types. FintekPro adds a platform fee on top.
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="baseFeeItr1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ITR-1 Fee (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} data-testid="input-fee-itr1" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="baseFeeItr2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ITR-2 Fee (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} data-testid="input-fee-itr2" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="baseFeeItr3"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ITR-3 Fee (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} data-testid="input-fee-itr3" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="baseFeeItr4"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ITR-4 Fee (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} {...field} data-testid="input-fee-itr4" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <Alert>
                      <LucideShield className="h-4 w-4" />
                      <AlertDescription>
                        Banking details are required for commission payouts. All information is encrypted and secure.
                      </AlertDescription>
                    </Alert>
                    
                    <FormField
                      control={form.control}
                      name="panNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="ABCDE1234F" {...field} className="uppercase" data-testid="input-pan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bankAccountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Account Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Account number" {...field} data-testid="input-account" />
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
                            <FormLabel>IFSC Code</FormLabel>
                            <FormControl>
                              <Input placeholder="HDFC0001234" {...field} className="uppercase" data-testid="input-ifsc" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="bankAccountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Name as per bank records" {...field} data-testid="input-holder-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <div className="bg-muted p-4 rounded-lg space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Personal Details
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Name:</span>
                        <span>{form.watch('fullName')}</span>
                        <span className="text-muted-foreground">Email:</span>
                        <span>{form.watch('email')}</span>
                        <span className="text-muted-foreground">Mobile:</span>
                        <span>{form.watch('mobile')}</span>
                      </div>
                    </div>
                    
                    <div className="bg-muted p-4 rounded-lg space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Professional Details
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">ICAI Number:</span>
                        <span>{form.watch('icaiMembershipNumber')}</span>
                        <span className="text-muted-foreground">Membership:</span>
                        <span>{form.watch('membershipType')}</span>
                        <span className="text-muted-foreground">Experience:</span>
                        <span>{form.watch('experienceYears')} years</span>
                        <span className="text-muted-foreground">Location:</span>
                        <span>{form.watch('city')}, {form.watch('state')}</span>
                      </div>
                    </div>
                    
                    <div className="bg-muted p-4 rounded-lg space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Specializations
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {form.watch('specializations')?.map((spec: string) => (
                          <Badge key={spec} variant="secondary">
                            {CA_SPECIALIZATIONS.find(s => s.value === spec)?.label || spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Short Bio (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell clients about yourself, your expertise, and approach..."
                              className="h-24"
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <FormDescription>Max 500 characters</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="termsAccepted"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-terms"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I agree to the Terms of Service and Partner Agreement
                            </FormLabel>
                            <FormDescription>
                              By registering, you agree to our platform policies, revenue sharing terms, and professional conduct guidelines.
                            </FormDescription>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                <div className="flex justify-between pt-6">
                  {currentStep > 1 && (
                    <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                  )}
                  
                  {currentStep < STEPS.length ? (
                    <Button type="button" onClick={nextStep} className="ml-auto" data-testid="button-next">
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting || registerMutation.isPending}
                      className="ml-auto"
                      data-testid="button-submit"
                    >
                      {registerMutation.isPending ? 'Submitting...' : 'Submit Registration'}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <a href="/auth" className="text-blue-600 hover:underline">
            Sign in to your CA Portal
          </a>
        </div>
      </div>
    </div>
  );
}
