import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LucideShield as LucideShield, Award, Users, Clock, IndianRupee, Globe, Linkedin,
  Twitter, Phone, Mail, MapPin, Star, CheckCircle, ExternalLink,
  TrendingUp, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PublicProfile {
  fullName: string; photoUrl: string | null; firmName: string | null;
  firmLogoUrl: string | null; tagline: string | null; bio: string | null;
  arnCode: string | null; sebiRegNumber: string | null; irdaiRegNumber: string | null;
  yearsExperience: number; aumManaged: number; activeClients: number;
  city: string | null; state: string | null;
  specializations: string[]; languagesSpoken: string[];
  linkedinUrl: string | null; whatsappBusiness: string | null;
  websiteUrl: string | null; twitterUrl: string | null;
  marketingPhone: string | null; marketingEmail: string | null;
  designation: string | null; referralCode: string;
}

export default function PublicAdvisorProfile() {
  const { code } = useParams<{ code: string }>();

  const { data: profile, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: [`/api/public/advisor/${code}`],
    queryFn: async () => {
      const res = await fetch(`/api/public/advisor/${code}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground animate-pulse">Loading profile…</div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto opacity-30" />
          <h2 className="text-xl font-semibold">Profile Not Found</h2>
          <p className="text-muted-foreground text-sm">This advisor profile is either private or doesn't exist.</p>
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            Go to FintekPro
          </Button>
        </div>
      </div>
    );
  }

  const initials = (profile.fullName || "A").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const whatsappUrl = profile.whatsappBusiness
    ? `https://wa.me/${profile.whatsappBusiness.replace(/\D/g, "")}?text=Hi, I found your profile on FintekPro and would like to connect.`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Header bar */}
      <div className="bg-white dark:bg-slate-900 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">FintekPro</span>
        </div>
        <span className="text-xs text-muted-foreground">Verified Advisor Profile</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Hero card */}
        <Card className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/80 to-primary" />
          <CardContent className="pt-0 pb-6">
            <div className="flex items-end gap-4 -mt-10 mb-4">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt={profile.fullName}
                  className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 object-cover shadow-md" />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-md">
                  {initials}
                </div>
              )}
              {profile.firmLogoUrl && (
                <img src={profile.firmLogoUrl} alt={profile.firmName || "Firm"}
                  className="h-10 w-auto object-contain rounded ml-auto" />
              )}
            </div>

            <h1 className="text-2xl font-bold">{profile.fullName}</h1>
            {profile.designation && <p className="text-primary font-medium mt-0.5">{profile.designation}</p>}
            {profile.firmName && (
              <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5" /> {profile.firmName}
              </p>
            )}
            {(profile.city || profile.state) && (
              <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3.5" /> {[profile.city, profile.state].filter(Boolean).join(", ")}
              </p>
            )}
            {profile.tagline && (
              <p className="mt-3 text-sm text-muted-foreground italic">"{profile.tagline}"</p>
            )}
          </CardContent>
        </Card>

        {/* Credential badges */}
        {(profile.arnCode || profile.sebiRegNumber || profile.irdaiRegNumber) && (
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <LucideShield className="h-4 w-4 text-primary" /> Regulatory Registrations
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.arnCode && (
                  <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-500">
                    <CheckCircle className="h-3 w-3" /> AMFI ARN: {profile.arnCode}
                  </Badge>
                )}
                {profile.sebiRegNumber && (
                  <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-500">
                    <LucideShield className="h-3 w-3" /> SEBI: {profile.sebiRegNumber}
                  </Badge>
                )}
                {profile.irdaiRegNumber && (
                  <Badge variant="outline" className="flex items-center gap-1 text-purple-600 border-purple-500">
                    <LucideShield className="h-3 w-3" /> IRDAI: {profile.irdaiRegNumber}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Experience", value: profile.yearsExperience ? `${profile.yearsExperience} yrs` : "—", icon: Clock },
            { label: "Clients", value: profile.activeClients ? `${profile.activeClients}+` : "—", icon: Users },
            { label: "AUM", value: profile.aumManaged ? `₹${Number(profile.aumManaged).toFixed(0)} Cr` : "—", icon: IndianRupee },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="py-3 text-center">
                <s.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bio */}
        {profile.bio && (
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Specialisations */}
        {profile.specializations?.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" /> Expertise
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.specializations.map(s => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Languages */}
        {profile.languagesSpoken?.length > 0 && (
          <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4" />
            <span>Speaks:</span>
            {profile.languagesSpoken.map(l => <span key={l} className="font-medium">{l}</span>)}
          </div>
        )}

        {/* CTA buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {whatsappUrl && (
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" asChild>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Phone className="h-4 w-4 mr-2" /> Chat on WhatsApp
              </a>
            </Button>
          )}
          {profile.marketingEmail && (
            <Button variant="outline" className="w-full" asChild>
              <a href={`mailto:${profile.marketingEmail}`}>
                <Mail className="h-4 w-4 mr-2" /> Send Email
              </a>
            </Button>
          )}
          {profile.marketingPhone && !whatsappUrl && (
            <Button variant="outline" className="w-full" asChild>
              <a href={`tel:${profile.marketingPhone}`}>
                <Phone className="h-4 w-4 mr-2" /> Call Now
              </a>
            </Button>
          )}
        </div>

        {/* Social links */}
        {(profile.linkedinUrl || profile.twitterUrl || profile.websiteUrl) && (
          <div className="flex gap-3 justify-center">
            {profile.linkedinUrl && (
              <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-full border hover:bg-accent transition-colors">
                <Linkedin className="h-5 w-5 text-blue-600" />
              </a>
            )}
            {profile.twitterUrl && (
              <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-full border hover:bg-accent transition-colors">
                <Twitter className="h-5 w-5 text-sky-500" />
              </a>
            )}
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-full border hover:bg-accent transition-colors">
                <Globe className="h-5 w-5 text-green-600" />
              </a>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Verified advisor profile powered by <strong>FintekPro</strong></p>
          <p className="mt-1">Profile ID: {profile.referralCode}</p>
        </div>
      </div>
    </div>
  );
}
