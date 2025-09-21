import { useState, useEffect } from "react";
import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Heart, Car, Plane, Home, Calculator, Users, Clock, CheckCircle, Star } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function PolicyBazaar() {
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
  const [selectedInsurance, setSelectedInsurance] = useState("health");
  const [age, setAge] = useState("");
  const [income, setIncome] = useState("");
  const [city, setCity] = useState("");
  const [coverage, setCoverage] = useState("");

  // Health Insurance form state
  const [familyMembers, setFamilyMembers] = useState("");
  const [preExistingDiseases, setPreExistingDiseases] = useState<string[]>([]);

  // Life Insurance form state
  const [dependents, setDependents] = useState("");
  const [existingCoverage, setExistingCoverage] = useState("");
  const [smokingStatus, setSmokingStatus] = useState("");

  // Motor Insurance form state
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleAge, setVehicleAge] = useState("");
  const [idv, setIdv] = useState("");
  const [previousClaims, setPreviousClaims] = useState("");
  const [ncb, setNcb] = useState("");

  // Travel Insurance form state
  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState("");
  const [tripType, setTripType] = useState("");

  // Get insurance quotes
  const { data: quotes, isPending: quotesLoading, mutate: getQuotes } = useMutation<any, Error, any, unknown>({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/policybazaar/quotes", data);
    }
  });

  // Health insurance calculator
  const { data: healthCalculation, mutate: calculateHealth } = useMutation<any, Error, any, unknown>({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/policybazaar/health-calculator", data);
    }
  });

  // Life insurance calculator
  const { data: lifeCalculation, mutate: calculateLife } = useMutation<any, Error, any, unknown>({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/policybazaar/life-calculator", data);
    }
  });

  // Motor insurance calculator
  const { data: motorCalculation, mutate: calculateMotor } = useMutation<any, Error, any, unknown>({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/policybazaar/motor-calculator", data);
    }
  });

  // Travel insurance calculator
  const { data: travelCalculation, mutate: calculateTravel } = useMutation<any, Error, any, unknown>({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/policybazaar/travel-calculator", data);
    }
  });

  const handleGetQuotes = () => {
    const baseData = {
      insuranceType: selectedInsurance,
      age: parseInt(age),
      income: parseInt(income),
      city,
      coverage: parseInt(coverage)
    };

    if (selectedInsurance === "health insurance") {
      getQuotes({
        ...baseData,
        familyMembers: parseInt(familyMembers) || 1,
        preExistingDiseases
      });
    } else {
      getQuotes(baseData);
    }
  };

  const handleCalculate = () => {
    const baseData = { age: parseInt(age), city };

    switch (selectedInsurance) {
      case "health insurance":
        calculateHealth({
          ...baseData,
          familyMembers: parseInt(familyMembers) || 1,
          preExistingDiseases,
          coverage: parseInt(coverage) || 500000
        });
        break;
      case "life insurance":
        calculateLife({
          ...baseData,
          income: parseInt(income),
          dependents: parseInt(dependents) || 0,
          existingCoverage: parseInt(existingCoverage) || 0,
          smokingStatus
        });
        break;
      case "motor insurance":
        calculateMotor({
          vehicleType,
          vehicleAge: parseInt(vehicleAge),
          city,
          idv: parseInt(idv),
          previousClaims: parseInt(previousClaims) || 0,
          ncb
        });
        break;
      case "travel insurance":
        calculateTravel({
          destination,
          duration: parseInt(duration),
          age: parseInt(age),
          tripType,
          coverage: parseInt(coverage) || 100000
        });
        break;
    }
  };

  const insuranceTypes = [
    { value: "health insurance", label: "Health Insurance", icon: Heart, color: "text-red-600" },
    { value: "life insurance", label: "Life Insurance", icon: Shield, color: "text-blue-600" },
    { value: "motor insurance", label: "Motor Insurance", icon: Car, color: "text-green-600" },
    { value: "travel insurance", label: "Travel Insurance", icon: Plane, color: "text-purple-600" }
  ];

  const currentCalculation = {
    "health insurance": healthCalculation,
    "life insurance": lifeCalculation,
    "motor insurance": motorCalculation,
    "travel insurance": travelCalculation
  }[selectedInsurance];

  return (
    <div className="min-h-screen bg-finance-light" data-testid="policybazaar-page">
      <EnhancedNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0">
        

        {/* Insurance Type Selection */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {insuranceTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Card 
                key={type.value}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedInsurance === type.value ? 'ring-2 ring-finance-blue bg-blue-50' : ''
                }`}
                onClick={() => setSelectedInsurance(type.value)}
                data-testid={`insurance-type-${type.value}`}
              >
                <CardContent className="p-6 text-center">
                  <IconComponent className={`h-8 w-8 mx-auto mb-3 ${type.color}`} />
                  <h3 className="font-semibold text-gray-900">{type.label}</h3>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="calculator" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator" data-testid="tab-calculator">Premium Calculator</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">Compare Quotes</TabsTrigger>
            <TabsTrigger value="policies" data-testid="tab-policies">My Policies</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6" data-testid="calculator-tab">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    {insuranceTypes.find(t => t.value === selectedInsurance)?.label} Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Common fields */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Age
                    </label>
                    <Input 
                      type="number" 
                      placeholder="Enter your age" 
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      data-testid="age-input"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      City
                    </label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger data-testid="city-select">
                        <SelectValue placeholder="Select your city" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mumbai">Mumbai</SelectItem>
                        <SelectItem value="delhi">Delhi</SelectItem>
                        <SelectItem value="bangalore">Bangalore</SelectItem>
                        <SelectItem value="chennai">Chennai</SelectItem>
                        <SelectItem value="hyderabad">Hyderabad</SelectItem>
                        <SelectItem value="pune">Pune</SelectItem>
                        <SelectItem value="kolkata">Kolkata</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Health Insurance specific fields */}
                  {selectedInsurance === "health insurance" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Family Members
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Number of family members" 
                          value={familyMembers}
                          onChange={(e) => setFamilyMembers(e.target.value)}
                          data-testid="family-members-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Coverage Amount (₹)
                        </label>
                        <Select value={coverage} onValueChange={setCoverage}>
                          <SelectTrigger data-testid="coverage-select">
                            <SelectValue placeholder="Select coverage amount" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="300000">₹3 Lakhs</SelectItem>
                            <SelectItem value="500000">₹5 Lakhs</SelectItem>
                            <SelectItem value="1000000">₹10 Lakhs</SelectItem>
                            <SelectItem value="2000000">₹20 Lakhs</SelectItem>
                            <SelectItem value="5000000">₹50 Lakhs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Life Insurance specific fields */}
                  {selectedInsurance === "life insurance" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Monthly Income (₹)
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Enter monthly income" 
                          value={income}
                          onChange={(e) => setIncome(e.target.value)}
                          data-testid="income-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Number of Dependents
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Number of dependents" 
                          value={dependents}
                          onChange={(e) => setDependents(e.target.value)}
                          data-testid="dependents-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Smoking Status
                        </label>
                        <Select value={smokingStatus} onValueChange={setSmokingStatus}>
                          <SelectTrigger data-testid="smoking-select">
                            <SelectValue placeholder="Select smoking status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non-smoker">Non-Smoker</SelectItem>
                            <SelectItem value="smoker">Smoker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Motor Insurance specific fields */}
                  {selectedInsurance === "motor insurance" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Vehicle Type
                        </label>
                        <Select value={vehicleType} onValueChange={setVehicleType}>
                          <SelectTrigger data-testid="vehicle-type-select">
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="bike">Two Wheeler</SelectItem>
                            <SelectItem value="commercial">Commercial Vehicle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Vehicle Age (Years)
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Vehicle age in years" 
                          value={vehicleAge}
                          onChange={(e) => setVehicleAge(e.target.value)}
                          data-testid="vehicle-age-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          IDV - Insured Declared Value (₹)
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Enter vehicle IDV" 
                          value={idv}
                          onChange={(e) => setIdv(e.target.value)}
                          data-testid="idv-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          No Claim Bonus (Years)
                        </label>
                        <Select value={ncb} onValueChange={setNcb}>
                          <SelectTrigger data-testid="ncb-select">
                            <SelectValue placeholder="Select NCB years" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 Years</SelectItem>
                            <SelectItem value="1">1 Year</SelectItem>
                            <SelectItem value="2">2 Years</SelectItem>
                            <SelectItem value="3">3 Years</SelectItem>
                            <SelectItem value="4">4 Years</SelectItem>
                            <SelectItem value="5+">5+ Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Travel Insurance specific fields */}
                  {selectedInsurance === "travel insurance" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Destination
                        </label>
                        <Select value={destination} onValueChange={setDestination}>
                          <SelectTrigger data-testid="destination-select">
                            <SelectValue placeholder="Select destination" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="domestic">Domestic</SelectItem>
                            <SelectItem value="asia">Asia</SelectItem>
                            <SelectItem value="europe">Europe</SelectItem>
                            <SelectItem value="usa">USA/Canada</SelectItem>
                            <SelectItem value="schengen">Schengen Countries</SelectItem>
                            <SelectItem value="worldwide">Worldwide</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Trip Duration (Days)
                        </label>
                        <Input 
                          type="number" 
                          placeholder="Number of days" 
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          data-testid="duration-input"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Trip Type
                        </label>
                        <Select value={tripType} onValueChange={setTripType}>
                          <SelectTrigger data-testid="trip-type-select">
                            <SelectValue placeholder="Select trip type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leisure">Leisure</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="adventure">Adventure</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Coverage Amount (₹)
                        </label>
                        <Select value={coverage} onValueChange={setCoverage}>
                          <SelectTrigger data-testid="travel-coverage-select">
                            <SelectValue placeholder="Select coverage amount" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100000">₹1 Lakh</SelectItem>
                            <SelectItem value="200000">₹2 Lakhs</SelectItem>
                            <SelectItem value="500000">₹5 Lakhs</SelectItem>
                            <SelectItem value="1000000">₹10 Lakhs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <Button 
                    onClick={handleCalculate}
                    className="w-full bg-finance-blue hover:bg-blue-700"
                    data-testid="calculate-premium"
                  >
                    Calculate Premium
                  </Button>
                </CardContent>
              </Card>

              {/* Results Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Premium Calculation Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentCalculation?.success ? (
                    <div className="space-y-6">
                      <div className="text-center p-6 bg-blue-50 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Estimated Premium</h3>
                        <p className="text-3xl font-bold text-finance-blue" data-testid="estimated-premium">
                          ₹{currentCalculation.data.estimatedPremium?.toLocaleString() || 
                            currentCalculation.data.monthlyPremium?.toLocaleString() || 
                            'N/A'}
                        </p>
                        {currentCalculation.data.monthlyPremium && (
                          <p className="text-sm text-gray-600 mt-1">per month</p>
                        )}
                      </div>
                      
                      {/* Plan Options */}
                      {currentCalculation.data.planOptions && (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900">Available Plans</h4>
                          {currentCalculation.data.planOptions.map((plan: any, index: number) => (
                            <div key={index} className="p-4 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-medium text-gray-900">{plan.plan}</h5>
                                <span className="font-bold text-finance-blue">
                                  ₹{plan.premium?.toLocaleString() || plan.monthlyPremium?.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                Coverage: ₹{plan.coverage?.toLocaleString()}
                              </p>
                              <ul className="text-xs text-gray-500 space-y-1">
                                {plan.features?.map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Plan Recommendations */}
                      {currentCalculation.data.planRecommendations && (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-gray-900">Plan Recommendations</h4>
                          {currentCalculation.data.planRecommendations.map((plan: any, index: number) => (
                            <div key={index} className="p-4 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-medium text-gray-900">{plan.plan}</h5>
                                <span className="font-bold text-finance-blue">
                                  ₹{plan.premium?.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                Coverage: ₹{plan.coverage?.toLocaleString()}
                              </p>
                              <ul className="text-xs text-gray-500 space-y-1">
                                {plan.features?.map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        Fill in the details and click "Calculate Premium" to see results
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-6" data-testid="compare-tab">
            <Card>
              <CardHeader>
                <CardTitle>Compare Insurance Quotes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button 
                    onClick={handleGetQuotes}
                    className="bg-finance-blue hover:bg-blue-700"
                    data-testid="get-quotes"
                  >
                    Get Quotes from Multiple Insurers
                  </Button>
                </div>
                
                {quotes?.success ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {quotes.data.quotes.map((quote: any, index: number) => (
                        <Card key={quote.insurerId} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="font-bold text-gray-900">{quote.insurerName}</h3>
                                <p className="text-sm text-gray-600">{quote.planName}</p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                  <span className="text-sm font-medium">{quote.rating}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm mb-4">
                              <div className="flex justify-between">
                                <span>Premium:</span>
                                <span className="font-bold text-finance-blue">₹{quote.premium?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Coverage:</span>
                                <span className="font-semibold">₹{quote.sumInsured?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Claim Settlement:</span>
                                <span className="font-semibold text-green-600">{quote.claimSettlementRatio}%</span>
                              </div>
                            </div>
                            
                            <div className="mb-4">
                              <h4 className="text-xs font-medium text-gray-700 mb-2">Key Features:</h4>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {quote.features?.slice(0, 3).map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full hover:bg-finance-blue hover:text-white"
                              data-testid={`buy-${quote.insurerId}`}
                            >
                              Buy This Plan
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {quotes.data.recommendations && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Our Recommendations:</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          {quotes.data.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Click "Get Quotes" to compare insurance plans from multiple insurers
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6" data-testid="policies-tab">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Policies Found</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your purchased insurance policies will appear here
                </p>
                <Button variant="outline">Buy Your First Policy</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}