import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Car, User, Building2, Calculator, Clock, CheckCircle, IndianRupee, GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Loans() {
  // Navigation state for responsive layout
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Listen for navigation state changes
  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [loanTenure, setLoanTenure] = useState("");

  // Fetch real-time loan rates
  const { data: loanRates, isLoading } = useQuery({
    queryKey: ["/api/loans/rates"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const calculateEMI = () => {
    const principal = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) / 100 / 12 || 0;
    const tenure = parseFloat(loanTenure) * 12 || 0;
    
    if (principal && rate && tenure) {
      const emi = principal * rate * Math.pow(1 + rate, tenure) / (Math.pow(1 + rate, tenure) - 1);
      const totalAmount = emi * tenure;
      const totalInterest = totalAmount - principal;
      return { emi, totalAmount, totalInterest };
    }
    return { emi: 0, totalAmount: 0, totalInterest: 0 };
  };

  const { emi, totalAmount, totalInterest } = calculateEMI();

  // Real-time loan types with API data or fallback
  const loanTypes = (loanRates as any)?.rates || [
    {
      loanType: "Personal Loan",
      bankName: "HDFC Bank", 
      interestRate: "10.75%",
      minAmount: "₹50,000",
      maxAmount: "₹75 Lakhs",
      tenure: "Up to 7 years",
      processingFee: "2.5%",
      category: "personal",
      color: "blue"
    },
    {
      loanType: "Home Loan",
      bankName: "SBI",
      interestRate: "8.50%",
      minAmount: "₹5 Lakhs",
      maxAmount: "₹10 Crores",
      tenure: "Up to 25 years",
      processingFee: "0.35%",
      category: "home",
      color: "green"
    },
    {
      loanType: "Car Loan",
      bankName: "ICICI Bank",
      interestRate: "7.25%",
      minAmount: "₹1 Lakh",
      maxAmount: "₹2 Crores",
      tenure: "Up to 7 years", 
      processingFee: "1.0%",
      category: "vehicle",
      color: "purple"
    },
    {
      loanType: "Business Loan",
      bankName: "Kotak Mahindra",
      interestRate: "12.50%",
      minAmount: "₹5 Lakhs",
      maxAmount: "₹50 Crores",
      tenure: "Up to 10 years",
      processingFee: "2.0%",
      category: "business", 
      color: "orange"
    },
    {
      loanType: "LAS (Loan Against Securities)",
      bankName: "Axis Bank",
      interestRate: "9.75%",
      minAmount: "₹1 Lakh",
      maxAmount: "₹20 Crores",
      tenure: "Up to 5 years",
      processingFee: "1.5%",
      category: "securities", 
      color: "blue"
    }
  ];

  const getIcon = (category: string) => {
    const icons = {
      personal: User,
      home: Home,
      vehicle: Car,
      business: Building2,
      education: GraduationCap,
      securities: IndianRupee
    };
    return icons[category as keyof typeof icons] || User;
  };

  const colorClasses = {
    blue: "bg-blue-100 text-finance-blue",
    green: "bg-green-100 text-finance-green",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
    cyan: "bg-cyan-100 text-cyan-600",
    indigo: "bg-indigo-100 text-indigo-600"
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="loans-page">
      <EnhancedNavigation />
      
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64'}`}>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore Loans</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">EMI Calculator</TabsTrigger>
            <TabsTrigger value="application" data-testid="tab-application">Apply Now</TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status">Track Status</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-loans">
            
            {/* Loan Types Grid */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Loan Products</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loanTypes.map((loan: any, index: number) => {
                  const IconComponent = getIcon(loan.category);
                  return (
                    <Card 
                      key={loan.category || index}
                      className="hover:shadow-md transition-shadow cursor-pointer group"
                      data-testid={`loan-${loan.category || index}`}
                    >
                      <CardContent className="p-6">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                          colorClasses[loan.color as keyof typeof colorClasses]
                        }`}>
                          <IconComponent className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">{loan.loanType}</h3>
                        <p className="text-gray-600 text-sm mb-2">
                          by {loan.bankName}
                        </p>
                        
                        <div className="space-y-2 text-xs text-gray-600 mb-4">
                          <div className="flex justify-between">
                            <span>Rate:</span>
                            <span className="font-semibold text-finance-green">{loan.interestRate} onwards</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Range:</span>
                            <span className="font-semibold">{loan.minAmount} - {loan.maxAmount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tenure:</span>
                            <span className="font-semibold">{loan.tenure}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Processing:</span>
                            <span className="font-semibold text-orange-600">{loan.processingFee}</span>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full group-hover:bg-finance-blue group-hover:text-white transition-colors"
                          data-testid={`apply-${loan.category || index}`}
                        >
                          Apply Now
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Features Section */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Why Choose Our Loans?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <Card>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Clock className="h-6 w-6 text-finance-blue" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Quick Approval</h3>
                    <p className="text-gray-600 text-sm">
                      Get loan approval in minutes with our digital process
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                      <IndianRupee className="h-6 w-6 text-finance-green" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Competitive Rates</h3>
                    <p className="text-gray-600 text-sm">
                      Best-in-class interest rates and minimal processing fees
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                      <CheckCircle className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">Minimal Documentation</h3>
                    <p className="text-gray-600 text-sm">
                      Simple paperwork with digital document upload
                    </p>
                  </CardContent>
                </Card>

              </div>
            </section>

          </TabsContent>

          <TabsContent value="calculator" className="space-y-6" data-testid="emi-calculator">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    EMI Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Loan Amount (₹)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="5,00,000" 
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      data-testid="loan-amount"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Interest Rate (% per annum)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="10.5" 
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      data-testid="interest-rate"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Loan Tenure (Years)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="5" 
                      value={loanTenure}
                      onChange={(e) => setLoanTenure(e.target.value)}
                      data-testid="loan-tenure"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>EMI Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Monthly EMI</h3>
                      <p className="text-3xl font-bold text-finance-blue" data-testid="monthly-emi">
                        ₹{emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Principal Amount</h4>
                          <p className="text-lg font-bold text-finance-green" data-testid="principal-amount">
                            ₹{parseFloat(loanAmount || "0").toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Total Interest</h4>
                          <p className="text-lg font-bold text-red-600" data-testid="total-interest">
                            ₹{totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Total Amount</h4>
                          <p className="text-lg font-bold text-purple-600" data-testid="total-amount">
                            ₹{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {loanAmount && interestRate && loanTenure && (
                      <Button 
                        className="w-full bg-finance-blue hover:bg-blue-700"
                        data-testid="apply-with-emi"
                      >
                        Apply for Loan with ₹{emi.toLocaleString(undefined, { maximumFractionDigits: 0 })} EMI
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="application" className="space-y-6" data-testid="loan-application">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle>Loan Application Form</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        First Name
                      </label>
                      <Input placeholder="Enter first name" data-testid="first-name" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Last Name
                      </label>
                      <Input placeholder="Enter last name" data-testid="last-name" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Email Address
                    </label>
                    <Input type="email" placeholder="Enter email" data-testid="email" />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Phone Number
                    </label>
                    <Input type="tel" placeholder="Enter phone number" data-testid="phone" />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Loan Type
                    </label>
                    <Select>
                      <SelectTrigger data-testid="loan-type-select">
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map((loan: any, index: number) => (
                          <SelectItem key={loan.loanType || index} value={loan.category || index.toString()}>
                            {loan.loanType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Monthly Income (₹)
                    </label>
                    <Input type="number" placeholder="Enter monthly income" data-testid="monthly-income" />
                  </div>
                  
                  <Button className="w-full bg-finance-blue hover:bg-blue-700" data-testid="submit-application">
                    Submit Application
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Required Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Identity Proof</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Aadhaar Card</li>
                        <li>• PAN Card</li>
                        <li>• Passport</li>
                        <li>• Driving License</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Income Proof</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Salary Slips (3 months)</li>
                        <li>• Bank Statements (6 months)</li>
                        <li>• Form 16</li>
                        <li>• ITR (for self-employed)</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Address Proof</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li>• Utility Bills</li>
                        <li>• Rental Agreement</li>
                        <li>• Property Documents</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-6" data-testid="loan-status">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications Found</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your loan application status will appear here
                </p>
                <Button variant="outline">Apply for a Loan</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}
