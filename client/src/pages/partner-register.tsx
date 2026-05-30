import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  User, Building2, FileText, CheckCircle2, ArrowRight, ArrowLeft,
  ShieldCheck, Briefcase, Phone, Mail, MapPin, Hash, GraduationCap,
  Award, AlertCircle
} from "lucide-react";

const PARTNER_TYPES = [
  { value: "ifa", label: "Individual Financial Advisor (IFA)", desc: "Independent advisor selling financial products" },
  { value: "mfd", label: "Mutual Fund Distributor (MFD)", desc: "AMFI-registered MF distributor with ARN" },
  { value: "sub_broker", label: "Sub-Broker", desc: "Equity and derivatives sub-broker" },
  { value: "ca_partner", label: "CA Partner", desc: "Chartered Accountant with distribution license" },
  { value: "corporate_distributor", label: "Corporate Distributor", desc: "Company/firm registered as distributor" },
  { value: "nri_partner", label: "NRI Partner", desc: "NRI-based financial advisor" },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const step1Schema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

const step2Schema = z.object({
  companyName: z.string().min(2, "Company / individual name is required"),
  partnerType: z.string().min(1, "Please select partner type"),
  arnCode: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  isCA: z.boolean().default(false),
  caMembershipNumber: z.string().optional(),
});

const step3Schema = z.object({
  acceptTerms: z.literal(true, { error: "You must accept the terms" }),
  acceptSebi: z.literal(true, { error: "You must confirm SEBI compliance" }),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Business Details", icon: Building2 },
  { id: 3, title: "Declaration", icon: FileText },
];

export default function PartnerRegister() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);
  const [step2Data, setStep2Data] = useState<Step2 | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { firstName: "", lastName: "", email: "", mobile: "" } });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { companyName: "", partnerType: "", arnCode: "", city: "", state: "", isCA: false, caMembershipNumber: "" } });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema) });

  const watchIsCA = form2.watch("isCA");
  const watchPartnerType = form2.watch("partnerType");

  const registerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/partner/register", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => toast({
      title: "Registration failed",
      description: err?.message || "Please try again or contact support.",
      variant: "destructive",
    }),
  });

  const onStep1 = (data: Step1) => { setStep1Data(data); setStep(2); };
  const onStep2 = (data: Step2) => { setStep2Data(data); setStep(3); };
  const onStep3 = () => {
    if (!step1Data || !step2Data) return;
    registerMutation.mutate({ ...step1Data, ...step2Data });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-2xl border-emerald-500/30">
          <CardContent className="pt-10 pb-8 space-y-5">
            <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Application Submitted!</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Your partner registration is under review. Our team will verify your details and reach out on your registered email &amp; mobile within <strong>48–72 business hours</strong>.
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-left space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">What happens next?</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                <li>Admin reviews your application</li>
                <li>KYC &amp; credential verification</li>
                <li>Account activation &amp; login credentials sent</li>
                <li>Onboarding call scheduled</li>
              </ul>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>Go to Main Site</Button>
              <Button className="flex-1" onClick={() => navigate("/auth")}>Sign In</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Become a FintekPro Partner</h1>
          <p className="text-indigo-300 mt-2 text-sm">Distribute India's best financial products with industry-leading commissions</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  done ? "bg-emerald-600 text-white" :
                  active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" :
                  "bg-slate-800 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">{s.id}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 mx-1 ${step > s.id ? "bg-emerald-500" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1 — Personal Info */}
        {step === 1 && (
          <Card className="shadow-2xl border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-indigo-500" /> Personal Information</CardTitle>
              <CardDescription>Tell us who you are — name, email, and mobile</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form1.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input placeholder="Rahul" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form1.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input placeholder="Sharma" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form1.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Address</FormLabel>
                      <FormControl><Input type="email" placeholder="rahul@example.com" {...field} /></FormControl>
                      <FormDescription className="text-xs">This will be your login email after approval</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form1.control} name="mobile" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Mobile Number</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <span className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">+91</span>
                          <Input placeholder="9876543210" maxLength={10} className="rounded-l-none" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="ghost" onClick={() => navigate("/auth")}>Already registered? Sign In</Button>
                    <Button type="submit" className="gap-2">Next <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Business Details */}
        {step === 2 && (
          <Card className="shadow-2xl border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-500" /> Business Details</CardTitle>
              <CardDescription>Your firm / practice details and regulatory credentials</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                  <FormField control={form2.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Company / Individual Name</FormLabel>
                      <FormControl><Input placeholder="Sharma Financial Services" {...field} /></FormControl>
                      <FormDescription className="text-xs">Use your registered firm name, or your full name if individual</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form2.control} name="partnerType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Partner Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select your partner category" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PARTNER_TYPES.map(p => (
                            <SelectItem key={p.value} value={p.value}>
                              <div>
                                <p className="font-medium">{p.label}</p>
                                <p className="text-xs text-muted-foreground">{p.desc}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {(watchPartnerType === "mfd" || watchPartnerType === "ifa") && (
                    <FormField control={form2.control} name="arnCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> ARN Code</FormLabel>
                        <FormControl><Input placeholder="ARN-123456" {...field} /></FormControl>
                        <FormDescription className="text-xs">AMFI Registration Number — leave blank if applying without ARN</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form2.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> City</FormLabel>
                        <FormControl><Input placeholder="Mumbai" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form2.control} name="state" render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Separator />
                  <FormField control={form2.control} name="isCA" render={({ field }) => (
                    <FormItem className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                      </FormControl>
                      <div>
                        <FormLabel className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-800 dark:text-emerald-300">
                          <GraduationCap className="h-4 w-4" /> I am a Chartered Accountant (CA)
                        </FormLabel>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Enables ITR filing, Form 15CA/15CB, CA Management dashboard, and CA support tickets
                        </p>
                      </div>
                    </FormItem>
                  )} />
                  {watchIsCA && (
                    <FormField control={form2.control} name="caMembershipNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ICAI Membership Number</FormLabel>
                        <FormControl><Input placeholder="e.g. 123456" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" className="gap-2">Next <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Declaration */}
        {step === 3 && (
          <Card className="shadow-2xl border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-500" /> Declaration &amp; Consent</CardTitle>
              <CardDescription>Review your application and accept the terms before submitting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Summary */}
              {step1Data && step2Data && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Application Summary</p>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Name: </span><span className="font-medium">{step1Data.firstName} {step1Data.lastName}</span></div>
                    <div><span className="text-muted-foreground">Email: </span><span className="font-medium">{step1Data.email}</span></div>
                    <div><span className="text-muted-foreground">Mobile: </span><span className="font-medium">+91 {step1Data.mobile}</span></div>
                    <div><span className="text-muted-foreground">Type: </span><Badge variant="secondary" className="text-xs">{PARTNER_TYPES.find(p => p.value === step2Data.partnerType)?.label || step2Data.partnerType}</Badge></div>
                    <div><span className="text-muted-foreground">Company: </span><span className="font-medium">{step2Data.companyName}</span></div>
                    <div><span className="text-muted-foreground">Location: </span><span className="font-medium">{step2Data.city}, {step2Data.state}</span></div>
                    {step2Data.arnCode && <div><span className="text-muted-foreground">ARN: </span><span className="font-medium">{step2Data.arnCode}</span></div>}
                    {step2Data.isCA && <div><span className="text-muted-foreground">CA: </span><Badge className="bg-emerald-100 text-emerald-800 text-xs">Chartered Accountant</Badge></div>}
                  </div>
                </div>
              )}
              <Form {...form3}>
                <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4">
                  <FormField control={form3.control} name="acceptTerms" render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                      </FormControl>
                      <div>
                        <FormLabel className="cursor-pointer text-sm">
                          I agree to the <a href="/terms" target="_blank" className="text-indigo-500 underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-indigo-500 underline">Privacy Policy</a>. I confirm that all information provided is accurate.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )} />
                  <FormField control={form3.control} name="acceptSebi" render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                      </FormControl>
                      <div>
                        <FormLabel className="cursor-pointer text-sm">
                          I confirm I hold (or will obtain before activation) all required SEBI/AMFI/IRDA regulatory registrations applicable to my partner type.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )} />
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Your account will be created in <strong>PENDING</strong> status. A FintekPro admin will review and activate your account within 48–72 hours after credential verification.
                    </p>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => setStep(2)}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? (
                        <><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span> Submitting...</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4" /> Submit Application</>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-indigo-400 text-xs mt-6">
          Already a partner? <a href="/auth" className="text-indigo-300 underline">Sign in here</a>
        </p>
      </div>
    </div>
  );
}
