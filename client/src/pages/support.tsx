import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  LucideShield as LucideShield,
  Building,
  AlertTriangle,
  ChevronDown,
  Plus,
  Ticket,
  Send,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

interface SupportTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default function Support() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqCard, setExpandedFaqCard] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "general",
    priority: "medium",
    clientName: "",
    clientEmail: "",
    clientPhone: ""
  });

  const { data: myTickets = [], isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/my-tickets"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: typeof newTicket) => {
      const res = await apiRequest("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify(ticketData)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
      setIsCreateDialogOpen(false);
      setNewTicket({
        subject: "",
        description: "",
        category: "general",
        priority: "medium",
        clientName: "",
        clientEmail: "",
        clientPhone: ""
      });
      toast({
        title: "Support Request Created",
        description: "Your request has been submitted. Our team will respond within 24 hours."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create request",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
      case "in_progress":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
      case "resolved":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
      case "closed":
        return "bg-muted text-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

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
      bgColor: "bg-green-50 dark:bg-green-950/30",
      iconColor: "text-green-600"
    },
    {
      title: "Email Support",
      description: "Detailed support via email",
      icon: Mail,
      contact: "support@fintekpro.com",
      timing: "Response within 4 hours",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
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
      icon: LucideShield,
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
    <>
      <div className="min-h-screen bg-muted">
        {/* Hero Section */}
        <div className="bg-card py-16 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4" data-testid="support-title">
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

          {/* Create Support Request Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-100 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-card shadow-sm">
                      <Ticket className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Need Help?</h3>
                      <p className="text-muted-foreground">Create a support request and our team will assist you</p>
                    </div>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2" data-testid="button-create-ticket">
                        <Plus className="h-5 w-5" />
                        Create Support Request
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Create Support Request</DialogTitle>
                        <DialogDescription>
                          Fill in the details below and our support team will get back to you within 24 hours.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="clientName">Your Name</Label>
                            <Input
                              id="clientName"
                              value={newTicket.clientName}
                              onChange={(e) => setNewTicket({ ...newTicket, clientName: e.target.value })}
                              placeholder="Enter your name"
                              data-testid="input-client-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="clientPhone">Phone Number</Label>
                            <Input
                              id="clientPhone"
                              value={newTicket.clientPhone}
                              onChange={(e) => setNewTicket({ ...newTicket, clientPhone: e.target.value })}
                              placeholder="Enter your phone"
                              data-testid="input-client-phone"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="clientEmail">Email Address</Label>
                          <Input
                            id="clientEmail"
                            type="email"
                            value={newTicket.clientEmail}
                            onChange={(e) => setNewTicket({ ...newTicket, clientEmail: e.target.value })}
                            placeholder="Enter your email"
                            data-testid="input-client-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="subject">Subject</Label>
                          <Input
                            id="subject"
                            value={newTicket.subject}
                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                            placeholder="Brief description of your issue"
                            data-testid="input-subject"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Category</Label>
                            <Select
                              value={newTicket.category}
                              onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                            >
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General Inquiry</SelectItem>
                                <SelectItem value="itr_filing">ITR Filing</SelectItem>
                                <SelectItem value="gst_returns">GST Returns</SelectItem>
                                <SelectItem value="tax_planning">Tax Planning</SelectItem>
                                <SelectItem value="kyc_verification">KYC Verification</SelectItem>
                                <SelectItem value="investment_advisory">Investment Advisory</SelectItem>
                                <SelectItem value="account_issue">Account Issue</SelectItem>
                                <SelectItem value="technical">Technical Support</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Priority</Label>
                            <Select
                              value={newTicket.priority}
                              onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                            >
                              <SelectTrigger data-testid="select-priority">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                            placeholder="Please describe your issue in detail..."
                            className="min-h-[120px]"
                            data-testid="input-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createTicketMutation.mutate(newTicket)}
                          disabled={!newTicket.subject || !newTicket.description || !newTicket.clientEmail || createTicketMutation.isPending}
                          className="gap-2"
                          data-testid="button-submit-ticket"
                        >
                          {createTicketMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Submit Request
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* My Tickets Section */}
          {myTickets.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="my-tickets-title">
                My Support Requests
              </h2>
              <div className="space-y-4">
                {myTickets.map((ticket) => (
                  <Card key={ticket.id} className="hover:shadow-md transition-shadow" data-testid={`ticket-${ticket.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{ticket.description}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{new Date(ticket.createdAt).toLocaleDateString()}</p>
                          <Badge variant="outline" className="mt-1 capitalize">{ticket.category.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* Contact Options */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="contact-options-title">
              Contact Our Support Team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contactOptions.map((option, index) => (
                <Card key={index} className={`${option.bgColor} border-0 hover:shadow-md transition-shadow`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-card ${option.iconColor}`}>
                        <option.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{option.title}</h3>
                        <p className="text-sm text-muted-foreground mb-1">{option.description}</p>
                        <p className="font-medium text-foreground">{option.contact}</p>
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
            <h2 className="text-2xl font-bold text-foreground mb-6" data-testid="quick-actions-title">
              Quick Self-Service Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`action-${action.action}`}>
                  <CardContent className="p-6 text-center">
                    <action.icon className="h-8 w-8 text-finance-blue mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground" data-testid="faq-title">
                Frequently Asked Questions
              </h2>
              {searchQuery && (
                <Badge variant="secondary">
                  {filteredFaqs.reduce((total, cat) => total + cat.faqs.length, 0)} results found
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredFaqs.map((category) => {
                const isExpanded = expandedFaqCard === category.id;
                
                return (
                  <Card 
                    key={category.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      isExpanded ? 'lg:col-span-4 sm:col-span-2' : ''
                    }`}
                    onClick={() => setExpandedFaqCard(isExpanded ? null : category.id)}
                    data-testid={`faq-card-${category.id}`}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <category.icon className="h-5 w-5 text-primary" />
                          <span className="text-base sm:text-lg">{category.title}</span>
                        </div>
                        <ChevronDown 
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </CardTitle>
                      {!isExpanded && (
                        <CardDescription className="text-sm">
                          {category.faqs.length} questions
                        </CardDescription>
                      )}
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="pt-0">
                        <CardDescription className="mb-4">
                          Find answers to common questions about {category.title.toLowerCase()}.
                        </CardDescription>
                        <Accordion type="single" collapsible className="w-full">
                          {category.faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                              <AccordionTrigger 
                                className="text-left hover:no-underline" 
                                data-testid={`faq-question-${category.id}-${index}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {faq.question}
                              </AccordionTrigger>
                              <AccordionContent 
                                className="text-muted-foreground" 
                                data-testid={`faq-answer-${category.id}-${index}`}
                              >
                                {faq.answer}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Support Hours */}
          <Card className="mt-12 bg-gradient-to-r from-finance-blue to-blue-600 text-foreground">
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
          <Card className="mt-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Emergency Support</h3>
                  <p className="text-red-700 dark:text-red-300">For urgent account issues, unauthorized transactions, or security concerns:</p>
                  <p className="font-semibold text-red-900 dark:text-red-100 flex items-center gap-1 mt-2">
                    <SiWhatsapp className="h-4 w-4 text-green-600" />
                    WhatsApp: 9686854321
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}