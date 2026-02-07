import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  Scale, 
  Globe, 
  Calculator, 
  Building2, 
  Shield, 
  Star, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Phone,
  MessageSquare,
  Award,
  IndianRupee,
  ChevronRight,
  Briefcase,
  Receipt
} from "lucide-react";

interface CAService {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  features: string[];
  icon: any;
  badge?: string;
  route: string;
}

const CA_SERVICES: CAService[] = [
  {
    id: "itr-filing",
    name: "ITR Filing",
    description: "Expert CA-assisted income tax return filing",
    price: "₹1,999",
    duration: "3-5 days",
    features: ["Dedicated CA", "Max deductions", "Post-filing support", "E-verification"],
    icon: FileText,
    badge: "Popular",
    route: "/tax/itr"
  },
  {
    id: "capital-gains",
    name: "Capital Gains Tax",
    description: "Complex capital gains computation & filing",
    price: "₹3,499",
    duration: "5-7 days",
    features: ["Stock gains", "Property gains", "Crypto taxation", "Carry forward losses"],
    icon: Receipt,
    route: "/tax/itr"
  },
  {
    id: "nri-tax",
    name: "NRI Taxation",
    description: "Comprehensive tax services for NRIs",
    price: "₹4,999",
    duration: "7-10 days",
    features: ["DTAA benefits", "FEMA compliance", "Foreign income", "TRC processing"],
    icon: Globe,
    badge: "Specialist",
    route: "/tax/itr"
  },
  {
    id: "tax-notices",
    name: "Notice Handling",
    description: "Expert response to income tax notices",
    price: "₹2,999",
    duration: "Varies",
    features: ["Notice analysis", "Draft response", "Representation", "Appeal support"],
    icon: Scale,
    route: "/tax/notices"
  },
  {
    id: "form15",
    name: "Form 15CA/15CB",
    description: "International remittance compliance",
    price: "₹3,499",
    duration: "2-3 days",
    features: ["Rule 37BB check", "CA certification", "Digital signing", "RBI compliance"],
    icon: Shield,
    badge: "CA Certified",
    route: "/tax/15ca-cb"
  },
  {
    id: "business-tax",
    name: "Business Taxation",
    description: "Tax filing for businesses & professionals",
    price: "₹5,999",
    duration: "7-10 days",
    features: ["GST integration", "TDS compliance", "Audit support", "Balance sheet"],
    icon: Briefcase,
    route: "/tax/itr"
  },
  {
    id: "tax-planning",
    name: "Tax Planning",
    description: "Strategic tax planning & optimization",
    price: "₹1,499",
    duration: "Consultation",
    features: ["80C optimization", "HRA/LTA", "Investment advice", "Structure review"],
    icon: Calculator,
    route: "/tax/ca-desk"
  },
  {
    id: "company-tax",
    name: "Company Tax",
    description: "Corporate tax compliance & filing",
    price: "₹14,999",
    duration: "15-20 days",
    features: ["ITR-6 filing", "MAT calculation", "Transfer pricing", "Audit compliance"],
    icon: Building2,
    route: "/tax/itr"
  }
];

const EXPERT_CAS = [
  { id: "1", name: "CA Vikram Mehta", specialization: "Individual Taxation", rating: 4.9, reviews: 234, experience: "12 years" },
  { id: "2", name: "CA Neha Gupta", specialization: "Business Taxation", rating: 4.8, reviews: 189, experience: "10 years" },
  { id: "3", name: "CA Rahul Verma", specialization: "NRI Taxation", rating: 4.9, reviews: 156, experience: "15 years" },
  { id: "4", name: "CA Priya Sharma", specialization: "Capital Gains", rating: 4.7, reviews: 145, experience: "8 years" }
];

export default function TaxCADeskPage() {
  const [, navigate] = useLocation();
  const [selectedService, setSelectedService] = useState<string | null>(null);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            CA Desk
          </h1>
          <p className="text-muted-foreground">Get expert assistance from qualified Chartered Accountants</p>
        </div>
        <Button variant="outline" className="gap-2" data-testid="button-contact-support">
          <Phone className="h-4 w-4" /> Contact Support
        </Button>
      </div>

      {/* Hero Banner */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-foreground border-0">
        <CardContent className="py-8">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Expert Tax Assistance</h2>
              <p className="text-purple-100 max-w-lg">
                Our team of qualified CAs is here to help you with all your tax needs. 
                From simple ITR filing to complex tax notices.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  <span>50+ Expert CAs</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>10,000+ Returns Filed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-300" />
                  <span>4.8 Avg Rating</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="p-6 bg-card/10 rounded-2xl backdrop-blur">
                <Users className="h-24 w-24 text-foreground/80" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Our Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CA_SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Card 
                key={service.id} 
                className={`cursor-pointer hover:shadow-lg transition-all border-2 ${selectedService === service.id ? "border-purple-500" : "hover:border-purple-300"}`}
                onClick={() => setSelectedService(service.id)}
                data-testid={`service-${service.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Icon className="h-6 w-6 text-purple-600" />
                    </div>
                    {service.badge && (
                      <Badge className="bg-purple-600">{service.badge}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-2">{service.name}</CardTitle>
                  <CardDescription className="text-sm">{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1">
                    {service.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="text-xs flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-lg font-bold text-purple-600">{service.price}</p>
                      <p className="text-xs text-muted-foreground">{service.duration}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(service.route)} data-testid={`button-get-${service.id}`}>
                      Get Started
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Featured CAs */}
      <Card data-testid="card-featured-cas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Our Expert CAs
          </CardTitle>
          <CardDescription>Experienced professionals ready to assist you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPERT_CAS.map((ca) => (
              <div key={ca.id} className="p-4 border rounded-lg text-center hover:shadow-md transition-shadow" data-testid={`ca-${ca.id}`}>
                <div className="w-16 h-16 mx-auto bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-3">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="font-semibold">{ca.name}</h4>
                <p className="text-sm text-muted-foreground">{ca.specialization}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium">{ca.rating}</span>
                  <span className="text-xs text-muted-foreground">({ca.reviews} reviews)</span>
                </div>
                <Badge variant="secondary" className="mt-2">{ca.experience}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card data-testid="card-how-it-works">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Simple 4-step process to get expert tax help</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: 1, title: "Select Service", description: "Choose the tax service you need", icon: FileText },
              { step: 2, title: "Upload Documents", description: "Share required documents securely", icon: Shield },
              { step: 3, title: "CA Review", description: "Expert CA reviews and prepares filing", icon: Users },
              { step: 4, title: "Submit & Pay", description: "Review, approve and complete payment", icon: CheckCircle }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center relative">
                  <div className="w-12 h-12 mx-auto bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-purple-600" />
                  </div>
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-600">Step {item.step}</Badge>
                  <h4 className="font-semibold mt-4">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.step < 4 && (
                    <ChevronRight className="hidden md:block h-6 w-6 absolute top-8 -right-3 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contact CTA */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Need Custom Help?</h3>
                <p className="text-muted-foreground">Speak to our tax experts for personalized guidance</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" data-testid="button-schedule-call">
                <Phone className="h-4 w-4 mr-2" /> Schedule Call
              </Button>
              <Button data-testid="button-chat-now">
                <MessageSquare className="h-4 w-4 mr-2" /> Chat Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
