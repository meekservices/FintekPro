import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Building2, Award, BarChart3, Link2, Share2, Copy, CheckCircle,
  Camera, Globe, Linkedin, Twitter, Phone, Mail, MapPin, Star,
  Shield as LucideShield, FileText, Calendar, TrendingUp, Users, Briefcase, Plus, X,
  ExternalLink, QrCode, Eye, EyeOff, IndianRupee, Clock, Sparkles,
} from "lucide-react";

const SPECIALISATION_OPTIONS = [
  "Mutual Funds", "Equity & Stocks", "Insurance", "Fixed Deposits",
  "Bonds", "Portfolio Management (PMS)", "Alternative Investments (AIF)",
  "NRI Wealth Management", "Retirement Planning", "Tax Planning",
  "Goal-Based Investing", "Estate Planning", "Pre-IPO / Unlisted Stocks",
  "Loan Advisory", "Real Estate",
];

const LANGUAGE_OPTIONS = [
  "English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada",
  "Malayalam", "Bengali", "Gujarati", "Punjabi", "Odia", "Urdu",
];

interface BrandProfile {
  fullName: string; email: string; phone: string; photoUrl: string | null;
  firmName: string | null; firmLogoUrl: string | null; tagline: string | null; bio: string | null;
  arnCode: string | null; arnExpiryDate: string | null; euinNumber: string | null;
  sebiRegNumber: string | null; irdaiRegNumber: string | null;
  nismCertNumber: string | null; nismCertExpiry: string | null;
  cfpNumber: string | null; cfpExpiry: string | null;
  yearsExperience: number; aumManaged: number; activeClients: number;
  totalClients: number; city: string | null; state: string | null;
  specializations: string[]; languagesSpoken: string[];
  linkedinUrl: string | null; whatsappBusiness: string | null;
  websiteUrl: string | null; twitterUrl: string | null;
  referralCode: string | null; referralCount: number;
  profilePublic: boolean; joiningDate: string | null;
  marketingName: string | null; marketingDesignation: string | null;
  marketingEmail: string | null; marketingPhone: string | null;
}

const empty: BrandProfile = {
  fullName: "", email: "", phone: "", photoUrl: null,
  firmName: null, firmLogoUrl: null, tagline: null, bio: null,
  arnCode: null, arnExpiryDate: null, euinNumber: null,
  sebiRegNumber: null, irdaiRegNumber: null,
  nismCertNumber: null, nismCertExpiry: null, cfpNumber: null, cfpExpiry: null,
  yearsExperience: 0, aumManaged: 0, activeClients: 0, totalClients: 0,
  city: null, state: null, specializations: [], languagesSpoken: [],
  linkedinUrl: null, whatsappBusiness: null, websiteUrl: null, twitterUrl: null,
  referralCode: null, referralCount: 0, profilePublic: false, joiningDate: null,
  marketingName: null, marketingDesignation: null, marketingEmail: null, marketingPhone: null,
};

function str(v: string | null | undefined) { return v ?? ""; }

export default function AdvisorBrandProfile() {
  const { toast } = useToast();
  const [form, setForm] = useState<BrandProfile>(empty);
  const [codeCopied, setCodeCopied] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: profileData, isLoading } = useQuery<BrandProfile>({
    queryKey: ["/api/agent/advisor-brand-profile"],
  });

  useEffect(() => {
    if (profileData) setForm({ ...empty, ...profileData });
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: (payload: BrandProfile) =>
      apiRequest("PUT", "/api/agent/advisor-brand-profile", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/advisor-brand-profile"] });
      toast({ title: "Profile saved", description: "Your advisor profile has been updated." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  function field(key: keyof BrandProfile) {
    return {
      value: str(form[key] as any),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  function toggleSpec(s: string) {
    setForm(f => ({
      ...f,
      specializations: f.specializations.includes(s)
        ? f.specializations.filter(x => x !== s)
        : [...f.specializations, s],
    }));
  }

  function toggleLang(l: string) {
    setForm(f => ({
      ...f,
      languagesSpoken: f.languagesSpoken.includes(l)
        ? f.languagesSpoken.filter(x => x !== l)
        : [...f.languagesSpoken, l],
    }));
  }

  function copyReferralCode() {
    if (form.referralCode) {
      navigator.clipboard.writeText(`${window.location.origin}/advisor/${form.referralCode}`);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }

  const publicUrl = form.referralCode ? `${window.location.origin}/advisor/${form.referralCode}` : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading your advisor profile…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Agent Marketing Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build your professional identity — photo, credentials, specialisations, and a shareable public microsite.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.profilePublic}
              onCheckedChange={v => setForm(f => ({ ...f, profilePublic: v }))}
            />
            <Label className="text-sm">{form.profilePublic ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}{form.profilePublic ? "Public" : "Private"}</Label>
          </div>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="branding"><User className="h-4 w-4 mr-1" />Photo & Brand</TabsTrigger>
          <TabsTrigger value="credentials"><LucideShield className="h-4 w-4 mr-1" />Credentials</TabsTrigger>
          <TabsTrigger value="business"><BarChart3 className="h-4 w-4 mr-1" />Business Stats</TabsTrigger>
          <TabsTrigger value="specializations"><Star className="h-4 w-4 mr-1" />Specialisations</TabsTrigger>
          <TabsTrigger value="social"><Link2 className="h-4 w-4 mr-1" />Social Links</TabsTrigger>
          <TabsTrigger value="referral"><Share2 className="h-4 w-4 mr-1" />Referral</TabsTrigger>
          <TabsTrigger value="marketing"><Briefcase className="h-4 w-4 mr-1" />Marketing Card</TabsTrigger>
        </TabsList>

        {/* ── BRANDING ── */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />Professional Photo</CardTitle>
              <CardDescription>Shown on your public profile and marketing cards.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Photo" className="w-24 h-24 rounded-full object-cover border-2 border-primary" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                    {(form.fullName || form.marketingName || "A").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <Label>Photo URL</Label>
                  <Input placeholder="https://…" className="mt-1" {...field("photoUrl")} />
                  <p className="text-xs text-muted-foreground mt-1">Paste a direct image URL (HTTPS). Upload to an image host if needed.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Firm Branding</CardTitle>
              <CardDescription>Your practice name, logo, and tagline appear on your public microsite.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Firm / Practice Name</Label>
                <Input placeholder="e.g. Mohanty Wealth Advisory" className="mt-1" {...field("firmName")} />
              </div>
              <div>
                <Label>Firm Logo URL</Label>
                <Input placeholder="https://…" className="mt-1" {...field("firmLogoUrl")} />
              </div>
              <div className="sm:col-span-2">
                <Label>Tagline</Label>
                <Input placeholder="e.g. Empowering families with smarter financial decisions" className="mt-1" {...field("tagline")} />
              </div>
              <div className="sm:col-span-2">
                <Label>About / Bio</Label>
                <Textarea
                  placeholder="Brief introduction about you and your practice…"
                  rows={4}
                  className="mt-1"
                  value={str(form.bio)}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input placeholder="Mumbai" className="mt-1" {...field("city")} />
              </div>
              <div>
                <Label>State</Label>
                <Input placeholder="Maharashtra" className="mt-1" {...field("state")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CREDENTIALS ── */}
        <TabsContent value="credentials" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LucideShield className="h-5 w-5" />Regulatory Registrations</CardTitle>
              <CardDescription>These are shown as verified badges on your public profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>AMFI ARN Number</Label>
                <Input placeholder="ARN-12345" className="mt-1" {...field("arnCode")} />
              </div>
              <div>
                <Label>ARN Expiry Date</Label>
                <Input type="date" className="mt-1" {...field("arnExpiryDate")} />
              </div>
              <div>
                <Label>EUIN Number</Label>
                <Input placeholder="E123456" className="mt-1" {...field("euinNumber")} />
              </div>
              <div>
                <Label>SEBI Registration No.</Label>
                <Input placeholder="INH000000000" className="mt-1" {...field("sebiRegNumber")} />
              </div>
              <div>
                <Label>IRDAI Registration No.</Label>
                <Input placeholder="CA0000" className="mt-1" {...field("irdaiRegNumber")} />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input
                  type="number" min={0} placeholder="0"
                  className="mt-1"
                  value={form.yearsExperience}
                  onChange={e => setForm(f => ({ ...f, yearsExperience: Number(e.target.value) }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Certifications</CardTitle>
              <CardDescription>NISM, CFP and other professional certifications.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>NISM Certificate Number</Label>
                <Input placeholder="NISM-…" className="mt-1" {...field("nismCertNumber")} />
              </div>
              <div>
                <Label>NISM Expiry Date</Label>
                <Input type="date" className="mt-1" {...field("nismCertExpiry")} />
              </div>
              <div>
                <Label>CFP / CFA Number</Label>
                <Input placeholder="CFP-…" className="mt-1" {...field("cfpNumber")} />
              </div>
              <div>
                <Label>CFP / CFA Expiry Date</Label>
                <Input type="date" className="mt-1" {...field("cfpExpiry")} />
              </div>
            </CardContent>
          </Card>

          {/* Credential preview badges */}
          <Card>
            <CardHeader><CardTitle>Credential Badges Preview</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {form.arnCode && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3" /> ARN: {form.arnCode}
                </Badge>
              )}
              {form.sebiRegNumber && (
                <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-600">
                  <LucideShield className="h-3 w-3" /> SEBI: {form.sebiRegNumber}
                </Badge>
              )}
              {form.irdaiRegNumber && (
                <Badge variant="outline" className="flex items-center gap-1 text-purple-600 border-purple-600">
                  <LucideShield className="h-3 w-3" /> IRDAI: {form.irdaiRegNumber}
                </Badge>
              )}
              {form.nismCertNumber && (
                <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-600">
                  <Award className="h-3 w-3" /> NISM Certified
                </Badge>
              )}
              {form.cfpNumber && (
                <Badge variant="outline" className="flex items-center gap-1 text-indigo-600 border-indigo-600">
                  <Award className="h-3 w-3" /> CFP / CFA
                </Badge>
              )}
              {form.euinNumber && (
                <Badge variant="outline" className="flex items-center gap-1 text-gray-600 border-gray-500">
                  <FileText className="h-3 w-3" /> EUIN: {form.euinNumber}
                </Badge>
              )}
              {!form.arnCode && !form.sebiRegNumber && !form.irdaiRegNumber && (
                <p className="text-sm text-muted-foreground">Add credentials above to see badges here.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BUSINESS STATS ── */}
        <TabsContent value="business" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Years Experience", value: form.yearsExperience, icon: Clock, color: "text-blue-600" },
              { label: "Active Clients", value: form.activeClients, icon: Users, color: "text-green-600" },
              { label: "Total Clients", value: form.totalClients, icon: Users, color: "text-purple-600" },
              { label: "AUM Managed (₹Cr)", value: form.aumManaged ? `${Number(form.aumManaged).toFixed(1)} Cr` : "—", icon: IndianRupee, color: "text-orange-600" },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-4 text-center">
                  <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Update Business Metrics</CardTitle>
              <CardDescription>These numbers are displayed on your public profile to build credibility.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>AUM Managed (₹ Crore)</Label>
                <Input
                  type="number" min={0} step={0.1} placeholder="0.0"
                  className="mt-1"
                  value={form.aumManaged}
                  onChange={e => setForm(f => ({ ...f, aumManaged: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input
                  type="number" min={0} placeholder="0"
                  className="mt-1"
                  value={form.yearsExperience}
                  onChange={e => setForm(f => ({ ...f, yearsExperience: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Active Clients</Label>
                <Input
                  type="number" min={0} placeholder="0"
                  className="mt-1"
                  value={form.activeClients}
                  onChange={e => setForm(f => ({ ...f, activeClients: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Member Since</Label>
                <Input
                  type="date" className="mt-1"
                  value={form.joiningDate ? form.joiningDate.slice(0, 10) : ""}
                  onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SPECIALISATIONS ── */}
        <TabsContent value="specializations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Areas of Expertise</CardTitle>
              <CardDescription>Select all that apply — shown as tags on your public profile and proposals.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {SPECIALISATION_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleSpec(s)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      form.specializations.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {form.specializations.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Selected ({form.specializations.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {form.specializations.map(s => (
                      <Badge key={s} className="flex items-center gap-1">
                        {s}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSpec(s)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Languages Spoken</CardTitle>
              <CardDescription>Help clients find you based on their preferred language.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(l => (
                  <button
                    key={l}
                    onClick={() => toggleLang(l)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      form.languagesSpoken.includes(l)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SOCIAL LINKS ── */}
        <TabsContent value="social" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Contact & Social Links</CardTitle>
              <CardDescription>Shown as clickable icons on your public microsite.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1"><Linkedin className="h-4 w-4 text-blue-600" />LinkedIn URL</Label>
                <Input placeholder="https://linkedin.com/in/…" className="mt-1" {...field("linkedinUrl")} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Twitter className="h-4 w-4 text-sky-500" />Twitter / X URL</Label>
                <Input placeholder="https://twitter.com/…" className="mt-1" {...field("twitterUrl")} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Globe className="h-4 w-4 text-green-600" />Website URL</Label>
                <Input placeholder="https://yoursite.com" className="mt-1" {...field("websiteUrl")} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Phone className="h-4 w-4 text-green-600" />WhatsApp Business No.</Label>
                <Input placeholder="+91 9XXXXXXXXX" className="mt-1" {...field("whatsappBusiness")} />
              </div>
            </CardContent>
          </Card>

          {/* Social preview */}
          {(form.linkedinUrl || form.websiteUrl || form.whatsappBusiness || form.twitterUrl) && (
            <Card>
              <CardHeader><CardTitle>Links Preview</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {form.linkedinUrl && (
                  <a href={form.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover:bg-accent">
                    <Linkedin className="h-4 w-4 text-blue-600" /> LinkedIn
                  </a>
                )}
                {form.twitterUrl && (
                  <a href={form.twitterUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover:bg-accent">
                    <Twitter className="h-4 w-4 text-sky-500" /> Twitter
                  </a>
                )}
                {form.websiteUrl && (
                  <a href={form.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover:bg-accent">
                    <Globe className="h-4 w-4 text-green-600" /> Website
                  </a>
                )}
                {form.whatsappBusiness && (
                  <a href={`https://wa.me/${form.whatsappBusiness.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover:bg-accent">
                    <Phone className="h-4 w-4 text-green-600" /> WhatsApp
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── REFERRAL ── */}
        <TabsContent value="referral" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" />Your Referral Code & Public Microsite</CardTitle>
              <CardDescription>
                Share this link with clients — they land on your personalised profile page.
                Toggle <strong>Public</strong> at the top to make it live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.referralCode ? (
                <>
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <QrCode className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Your unique referral code</p>
                      <p className="font-mono text-lg font-bold">{form.referralCode}</p>
                      {publicUrl && (
                        <p className="text-xs text-muted-foreground truncate">{publicUrl}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={copyReferralCode}>
                      {codeCopied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      {codeCopied ? "Copied!" : "Copy Link"}
                    </Button>
                  </div>

                  {form.profilePublic && publicUrl && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Profile is live —</span>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary underline flex items-center gap-1">
                        View Public Profile <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {!form.profilePublic && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-yellow-700 dark:text-yellow-400 text-sm">
                      <EyeOff className="h-4 w-4 flex-shrink-0" />
                      Profile is currently private. Toggle <strong>Public</strong> at the top and save to publish your microsite.
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Total referrals: <strong>{form.referralCount}</strong></span>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Save your profile to generate your referral code.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MARKETING CARD ── */}
        <TabsContent value="marketing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Festival Greeting Card Details</CardTitle>
              <CardDescription>
                These override your default name/designation on festival greeting cards.
                Used by the Marketing Tools section.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Display Name (on cards)</Label>
                <Input placeholder="e.g. Sangram Mohanty" className="mt-1" {...field("marketingName")} />
              </div>
              <div>
                <Label>Designation (on cards)</Label>
                <Input placeholder="e.g. Senior Financial Advisor" className="mt-1" {...field("marketingDesignation")} />
              </div>
              <div>
                <Label>Email (on cards)</Label>
                <Input placeholder="contact@email.com" className="mt-1" {...field("marketingEmail")} />
              </div>
              <div>
                <Label>Phone (on cards)</Label>
                <Input placeholder="+91 9XXXXXXXXX" className="mt-1" {...field("marketingPhone")} />
              </div>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card>
            <CardHeader><CardTitle>Card Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gray-900 p-4 flex items-center gap-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {(form.marketingName || form.fullName || "A").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{form.marketingName || form.fullName || "Your Name"}</p>
                  <p className="text-yellow-400 text-xs">{form.marketingDesignation || form.firmName || "Financial Advisor"}</p>
                  {form.marketingEmail && <p className="text-white/70 text-xs">✉ {form.marketingEmail}</p>}
                  {form.marketingPhone && <p className="text-white/70 text-xs">☎ {form.marketingPhone}</p>}
                </div>
                <div className="ml-auto">
                  <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pb-6">
        <Button size="lg" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}
