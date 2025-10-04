import { useState } from "react";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Phone, 
  Mail, 
  Clock, 
  MessageCircle, 
  FileText, 
  User, 
  CreditCard, 
  Settings,
  HelpCircle,
  Download,
  Shield,
  Building,
  AlertTriangle
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

export default function Support() {
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories = [
    {
      id: "general",
      title: "General Questions",
      icon: HelpCircle,
      faqs: [
        {
          question: "Why should I use FintekPro?",
          answer: "FintekPro is your comprehensive financial platform offering portfolio management, market data, investment tools, and integrated financial services. We provide real-time data, advanced analytics, and seamless access to multiple financial products in one unified platform."
        },
        {
          question: "Is FintekPro safe to use?",
          answer: "Yes, FintekPro uses bank-grade security with multi-layer encryption, secure API integrations, and compliance with financial regulations. Your data is protected and we never store sensitive information like passwords or API keys."
        },
        {
          question: "Who can use FintekPro?",
          answer: "Any individual investor, financial advisor, or institution looking for comprehensive portfolio management and financial services. Our platform supports retail investors, HNI clients, and corporate accounts."
        },
        {
          question: "What services does FintekPro cover?",
          answer: "We offer portfolio tracking, market data, investment recommendations, loan services (via Bajaj Finance & Tata Capital), insurance products, IPO tracking, mutual funds, bonds, and comprehensive financial planning tools."
        }
      ]
    },
    {
      id: "account",
      title: "Account Management",
      icon: User,
      faqs: [
        {
          question: "How do I create an account on FintekPro?",
          answer: "Simply visit our homepage and click 'Sign Up'. You'll need to provide your PAN, mobile number, and email address. We'll verify your details and you'll be ready to start managing your investments."
        },
        {
          question: "I have multiple mobile numbers for different investments. What should I do?",
          answer: "Update your primary mobile number in your profile settings. This will be used for all notifications and OTP authentication across our platform."
        },
        {
          question: "How do I update my bank account details?",
          answer: "Go to Account Settings > Bank Details. You can add multiple bank accounts and set a primary account for transactions. Bank verification may take 1-2 business days."
        },
        {
          question: "Can I change my registered email address?",
          answer: "Yes, go to Account Settings > Personal Information. You'll receive an OTP on both your old and new email addresses to verify the change."
        }
      ]
    },
    {
      id: "portfolio",
      title: "Portfolio & Investment Tracking",
      icon: FileText,
      faqs: [
        {
          question: "How is my portfolio gain/loss calculated?",
          answer: "We calculate your gains/losses based on your investment amount versus current market value. This includes both realized and unrealized gains across all your holdings."
        },
        {
          question: "Can I track both Demat and non-Demat holdings?",
          answer: "Yes, FintekPro supports both Demat and non-Demat portfolio tracking. You can view consolidated holdings or separate views based on your preference."
        },
        {
          question: "How do I download my portfolio statements?",
          answer: "Visit Portfolio > Reports section. You can download detailed portfolio statements, tax reports, and gain/loss statements for any date range."
        },
        {
          question: "Why are some of my investments missing from my portfolio?",
          answer: "Ensure all your investments are linked to the same PAN and mobile number. If you have investments under different mobile numbers, please update them to your primary registered mobile."
        }
      ]
    },
    {
      id: "transactions",
      title: "Transactions & Service Requests",
      icon: CreditCard,
      faqs: [
        {
          question: "How do I place investment orders through FintekPro?",
          answer: "Navigate to the specific investment section (Stocks, Mutual Funds, etc.), select your preferred instrument, enter the amount, and confirm. Orders are processed through our integrated partners."
        },
        {
          question: "What is the process for KYC compliance?",
          answer: "Upload your PAN card, Aadhaar card, and a recent photograph. Our system will verify your documents within 24-48 hours. You'll receive confirmation via email and SMS."
        },
        {
          question: "How do I track my service requests?",
          answer: "Go to Account > Service Requests to view all your pending and completed requests. Each request has a unique ID and status updates are sent via SMS and email."
        },
        {
          question: "What if my transaction fails?",
          answer: "Failed transactions are automatically refunded within 3-5 business days. You'll receive detailed failure reasons via email. Contact support for immediate assistance."
        }
      ]
    }
  ];

  const contactOptions = [
    {
      title: "WhatsApp Support",
      description: "Quick assistance via WhatsApp",
      icon: SiWhatsapp,
      contact: "9686854321",
      timing: "24/7 Available",
      bgColor: "bg-green-50",
      iconColor: "text-green-600"
    },
    {
      title: "Email Support",
      description: "Detailed support via email",
      icon: Mail,
      contact: "support@fintekpro.com",
      timing: "Response within 4 hours",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600"
    }
  ];

  const quickActions = [
    {
      title: "Download Portfolio Statement",
      description: "Get detailed portfolio reports",
      icon: Download,
      action: "download-statement"
    },
    {
      title: "Update KYC Documents", 
      description: "Upload or update your KYC",
      icon: Shield,
      action: "update-kyc"
    },
    {
      title: "Track Service Request",
      description: "Check status of your requests",
      icon: FileText,
      action: "track-request"
    },
    {
      title: "Report an Issue",
      description: "Report technical or account issues",
      icon: AlertTriangle,
      action: "report-issue"
    }
  ];

  const filteredFaqs = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq => 
      searchQuery === "" || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-white py-16 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="support-title">
              Help & Support Center
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Get instant help with your investments, account management, and financial services. Our support team is here to assist you 24/7.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search for help topics, account questions, or investment guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-4 text-lg"
                data-testid="search-support"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Contact Options */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6" data-testid="contact-options-title">
              Contact Our Support Team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contactOptions.map((option, index) => (
                <Card key={index} className={`${option.bgColor} border-0 hover:shadow-md transition-shadow`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-white ${option.iconColor}`}>
                        <option.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{option.title}</h3>
                        <p className="text-sm text-muted-foreground mb-1">{option.description}</p>
                        <p className="font-medium text-gray-900">{option.contact}</p>
                        <p className="text-xs text-muted-foreground">{option.timing}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6" data-testid="quick-actions-title">
              Quick Self-Service Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`action-${action.action}`}>
                  <CardContent className="p-6 text-center">
                    <action.icon className="h-8 w-8 text-finance-blue mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900" data-testid="faq-title">
                Frequently Asked Questions
              </h2>
              {searchQuery && (
                <Badge variant="secondary">
                  {filteredFaqs.reduce((total, cat) => total + cat.faqs.length, 0)} results found
                </Badge>
              )}
            </div>

            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {faqCategories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                    <category.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{category.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {filteredFaqs.map((category) => (
                <TabsContent key={category.id} value={category.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <category.icon className="h-5 w-5 text-finance-blue" />
                        {category.title}
                      </CardTitle>
                      <CardDescription>
                        Find answers to common questions about {category.title.toLowerCase()}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {category.faqs.map((faq, index) => (
                          <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left hover:no-underline" data-testid={`faq-question-${category.id}-${index}`}>
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground" data-testid={`faq-answer-${category.id}-${index}`}>
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Support Hours */}
          <Card className="mt-12 bg-gradient-to-r from-finance-blue to-blue-600 text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <Clock className="h-8 w-8" />
                  <div>
                    <h3 className="text-xl font-semibold">Support Hours</h3>
                    <p className="opacity-90">We're here when you need us</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">WhatsApp: 24/7 Available</p>
                  <p className="opacity-90">Email: Monday - Friday, 8 AM - 8 PM</p>
                  <p className="opacity-90">Weekend: Closed (Sat-Sun) - WhatsApp Only</p>
                  <p className="opacity-90">Emergency Support: WhatsApp Available 24/7</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="mt-6 border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Emergency Support</h3>
                  <p className="text-red-700">For urgent account issues, unauthorized transactions, or security concerns:</p>
                  <p className="font-semibold text-red-900 flex items-center gap-1 mt-2">
                    <SiWhatsapp className="h-4 w-4 text-green-600" />
                    WhatsApp: 9686854321
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      
      <Footer />
    </div>
  );
}