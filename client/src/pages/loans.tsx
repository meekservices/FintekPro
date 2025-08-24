import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Car, User, Building2, Calculator, Clock, CheckCircle, DollarSign } from "lucide-react";
import { useState } from "react";

export default function Loans() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [loanTenure, setLoanTenure] = useState("");

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

  const loanTypes = [
    {
      id: "personal",
      name: "Personal Loan",
      description: "Quick personal loans for your immediate needs",
      icon: User,
      rate: "10.5% onwards",
      amount: "Up to ₹40 Lakhs",
      tenure: "1-5 years",
      color: "blue"
    },
    {
      id: "home",
      name: "Home Loan",
      description: "Finance your dream home with attractive rates",
      icon: Home,
      rate: "8.5% onwards",
      amount: "Up to ₹10 Crores",
      tenure: "Up to 30 years",
      color: "green"
    },
    {
      id: "car",
      name: "Car Loan",
      description: "Drive your dream car with easy financing",
      icon: Car,
      rate: "9.0% onwards",
      amount: "Up to ₹2 Crores",
      tenure: "1-7 years",
      color: "purple"
    },
    {
      id: "business",
      name: "Business Loan",
      description: "Grow your business with flexible funding",
      icon: Building2,
      rate: "9.5% onwards",
      amount: "Up to ₹50 Crores",
      tenure: "1-10 years",
      color: "orange"
    }
  ];

  const colorClasses = {
    blue: "bg-blue-100 text-finance-blue",
    green: "bg-green-100 text-finance-green",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600"
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="loans-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="loans-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Loans & Credit</h1>
          <p className="text-gray-600 text-lg">
            Get quick loans at competitive rates with minimal documentation
          </p>
        </div>

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
                {loanTypes.map((loan) => {
                  const IconComponent = loan.icon;
                  return (
                    <Card 
                      key={loan.id}
                      className="hover:shadow-md transition-shadow cursor-pointer group"
                      data-testid={`loan-${loan.id}`}
                    >
                      <CardContent className="p-6">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                          colorClasses[loan.color as keyof typeof colorClasses]
                        }`}>
                          <IconComponent className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">{loan.name}</h3>
                        <p className="text-gray-600 text-sm mb-4">{loan.description}</p>
                        
                        <div className="space-y-2 text-xs text-gray-600 mb-4">
                          <div className="flex justify-between">
                            <span>Rate:</span>
                            <span className="font-semibold text-finance-green">{loan.rate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span className="font-semibold">{loan.amount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tenure:</span>
                            <span className="font-semibold">{loan.tenure}</span>
                          </div>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full group-hover:bg-finance-blue group-hover:text-white transition-colors"
                          data-testid={`apply-${loan.id}`}
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
                      <DollarSign className="h-6 w-6 text-finance-green" />
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
                        {loanTypes.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.name}
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
