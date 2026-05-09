import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
  Briefcase,
  TrendingUp,
  FileText,
  Target,
  Shield,
  Users,
  BookOpen,
  LineChart,
  PieChart,
  CheckCircle,
  Star,
  Award,
  Phone,
  Mail
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  pricing: string;
  duration: string;
  popular?: boolean;
}

export default function ProfessionalServicesPage() {
  const advisoryServices: Service[] = [
    {
      id: "1",
      name: "Portfolio Advisory",
      category: "Wealth Management",
      description: "Personalized investment strategy and portfolio management for HNI clients",
      features: [
        "Dedicated relationship manager",
        "Customized asset allocation",
        "Quarterly portfolio review",
        "Tax optimization strategies",
        "Alternative investment access"
      ],
      pricing: "₹50,000/year",
      duration: "Annual subscription",
      popular: true
    },
    {
      id: "2",
      name: "Financial Planning",
      category: "Planning",
      description: "Comprehensive financial planning covering goals, insurance, tax, and retirement",
      features: [
        "Goal-based planning",
        "Cash flow analysis",
        "Insurance review",
        "Retirement planning",
        "Estate planning guidance"
      ],
      pricing: "₹25,000 one-time",
      duration: "One-time engagement"
    },
    {
      id: "3",
      name: "Tax Planning",
      category: "Tax Advisory",
      description: "Strategic tax planning and compliance for individuals and businesses",
      features: [
        "Tax-saving strategies",
        "ITR filing assistance",
        "Capital gains optimization",
        "Tax audit support",
        "Advance tax calculation"
      ],
      pricing: "₹15,000/year",
      duration: "Annual subscription",
      popular: true
    }
  ];

  const researchServices: Service[] = [
    {
      id: "4",
      name: "Equity Research",
      category: "Research",
      description: "In-depth equity research reports with buy/sell recommendations",
      features: [
        "Daily market analysis",
        "Stock recommendations",
        "Sector reports",
        "Fundamental analysis",
        "Technical charts"
      ],
      pricing: "₹10,000/month",
      duration: "Monthly subscription",
      popular: true
    },
    {
      id: "5",
      name: "IPO Research",
      category: "Research",
      description: "Detailed IPO analysis and subscription recommendations",
      features: [
        "IPO note and grading",
        "Company analysis",
        "Valuation metrics",
        "Grey market premium tracking",
        "Application guidance"
      ],
      pricing: "₹5,000/IPO",
      duration: "Per IPO basis"
    },
    {
      id: "6",
      name: "Mutual Fund Research",
      category: "Research",
      description: "Fund selection and portfolio construction for mutual fund investors",
      features: [
        "Fund comparison",
        "Portfolio analysis",
        "SIP recommendations",
        "Risk assessment",
        "Rebalancing guidance"
      ],
      pricing: "₹8,000/quarter",
      duration: "Quarterly subscription"
    }
  ];

  const specializedServices: Service[] = [
    {
      id: "7",
      name: "NRI Investment Advisory",
      category: "NRI Services",
      description: "Specialized advisory for Non-Resident Indians investing in India",
      features: [
        "FEMA compliance guidance",
        "Repatriation planning",
        "Tax treaty benefits",
        "NRE/NRO account setup",
        "India-specific opportunities"
      ],
      pricing: "₹75,000/year",
      duration: "Annual subscription"
    },
    {
      id: "8",
      name: "Corporate Advisory",
      category: "Corporate",
      description: "Financial advisory for corporates, startups, and businesses",
      features: [
        "Fundraising support",
        "Financial restructuring",
        "M&A advisory",
        "Valuation services",
        "Business plan review"
      ],
      pricing: "Custom pricing",
      duration: "Project-based"
    },
    {
      id: "9",
      name: "ESOP Advisory",
      category: "Corporate",
      description: "Employee stock option planning and execution guidance",
      features: [
        "ESOP taxation planning",
        "Exercise strategy",
        "Liquidity planning",
        "Diversification advice",
        "Post-exit planning"
      ],
      pricing: "₹20,000 one-time",
      duration: "One-time consultation"
    }
  ];

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="professional-services-title">Professional Services</h1>
            <p className="text-muted-foreground">Expert advisory and research services for your financial goals</p>
          </div>
        </div>
      </div>

      {/* Service Categories Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">Advisory Services</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Personalized financial planning and wealth management advisory
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <LineChart className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Research Reports</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              In-depth market research and investment recommendations
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg">Specialized Services</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Corporate, NRI, and ESOP specialized advisory services
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="advisory" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="advisory" data-testid="tab-advisory">
            <Briefcase className="h-4 w-4 mr-2" />
            Advisory Services
          </TabsTrigger>
          <TabsTrigger value="research" data-testid="tab-research">
            <FileText className="h-4 w-4 mr-2" />
            Research Services
          </TabsTrigger>
          <TabsTrigger value="specialized" data-testid="tab-specialized">
            <Shield className="h-4 w-4 mr-2" />
            Specialized Services
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="h-4 w-4 mr-2" />
            Our Team
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Advisory Services Tab */}
        <TabsContent value="advisory" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advisoryServices.map((service) => (
              <Card key={service.id} className={service.popular ? "border-primary" : ""} data-testid={`service-${service.id}`}>
                {service.popular && (
                  <div className="bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
                    POPULAR
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{service.name}</CardTitle>
                      <CardDescription>{service.category}</CardDescription>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Key Features:</p>
                    <ul className="space-y-1">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Pricing</span>
                      <span className="font-bold text-lg">{service.pricing}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="text-sm font-medium">{service.duration}</span>
                    </div>
                  </div>

                  <Button className="w-full" data-testid={`button-subscribe-${service.id}`}>
                    Subscribe Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Research Services Tab */}
        <TabsContent value="research" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {researchServices.map((service) => (
              <Card key={service.id} className={service.popular ? "border-primary" : ""}>
                {service.popular && (
                  <div className="bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
                    POPULAR
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{service.name}</CardTitle>
                      <CardDescription>{service.category}</CardDescription>
                    </div>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">What You Get:</p>
                    <ul className="space-y-1">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Pricing</span>
                      <span className="font-bold text-lg">{service.pricing}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Billing</span>
                      <span className="text-sm font-medium">{service.duration}</span>
                    </div>
                  </div>

                  <Button className="w-full" data-testid={`button-subscribe-research-${service.id}`}>
                    Subscribe Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Specialized Services Tab */}
        <TabsContent value="specialized" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {specializedServices.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{service.name}</CardTitle>
                      <CardDescription>{service.category}</CardDescription>
                    </div>
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Services Include:</p>
                    <ul className="space-y-1">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Pricing</span>
                      <span className="font-bold text-lg">{service.pricing}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Engagement</span>
                      <span className="text-sm font-medium">{service.duration}</span>
                    </div>
                  </div>

                  <Button className="w-full" data-testid={`button-enquire-${service.id}`}>
                    Enquire Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Our Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expert Advisory Team</CardTitle>
              <CardDescription>Meet our experienced financial advisors and research analysts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { name: "Rajesh Kumar", role: "Chief Investment Officer", experience: "20+ years", specialization: "Portfolio Management" },
                  { name: "Priya Sharma", role: "Head of Research", experience: "15+ years", specialization: "Equity Research" },
                  { name: "Amit Patel", role: "Tax Advisory Lead", experience: "12+ years", specialization: "Tax Planning" }
                ].map((member, idx) => (
                  <div key={idx} className="text-center space-y-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/50 mx-auto flex items-center justify-center text-foreground text-2xl font-bold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        <span>{member.experience} experience</span>
                      </div>
                      <p className="text-muted-foreground">{member.specialization}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
              <CardDescription>Connect with our advisory team for personalized guidance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Phone Support</p>
                    <p className="text-sm text-muted-foreground">+91 9876543210</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Email Support</p>
                    <p className="text-sm text-muted-foreground">advisory@fintekpro.com</p>
                  </div>
                </div>
              </div>
              <Button className="w-full" size="lg" data-testid="button-book-consultation">
                <BookOpen className="h-4 w-4 mr-2" />
                Book Free Consultation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
