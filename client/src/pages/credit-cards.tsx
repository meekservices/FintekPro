import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard,
  Star,
  Gift,
  Plane,
  ShoppingBag,
  Fuel,
  DollarSign,
  Percent,
  Shield,
  Check,
  Search,
  Filter
} from "lucide-react";

interface CreditCardProduct {
  id: string;
  name: string;
  bank: string;
  category: string;
  annualFee: number;
  joiningFee: number;
  rewardRate: string;
  features: string[];
  benefits: string[];
  eligibility: {
    minIncome: number;
    minCreditScore: number;
  };
  rating: number;
  imageUrl?: string;
}

export default function CreditCardsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const creditCards: CreditCardProduct[] = [
    {
      id: "1",
      name: "Infinia Credit Card",
      bank: "HDFC Bank",
      category: "premium",
      annualFee: 12500,
      joiningFee: 12500,
      rewardRate: "3.3% on dining & travel",
      features: ["Unlimited airport lounge access", "Annual fee waiver on spend ₹8L", "Complimentary golf rounds"],
      benefits: ["10X rewards on smartbuy", "Priority Pass membership", "Club Marriott membership"],
      eligibility: { minIncome: 250000, minCreditScore: 750 },
      rating: 4.8
    },
    {
      id: "2",
      name: "SBI Card Elite",
      bank: "SBI Card",
      category: "premium",
      annualFee: 4999,
      joiningFee: 4999,
      rewardRate: "2% on all spends",
      features: ["8 complimentary lounge visits", "Milestone benefits", "Fuel surcharge waiver"],
      benefits: ["Annual vouchers worth ₹5000", "Movie ticket offers", "Dining privileges"],
      eligibility: { minIncome: 200000, minCreditScore: 700 },
      rating: 4.5
    },
    {
      id: "3",
      name: "Amazon Pay ICICI",
      bank: "ICICI Bank",
      category: "cashback",
      annualFee: 0,
      joiningFee: 0,
      rewardRate: "5% cashback on Amazon",
      features: ["No annual fee", "Instant approval", "Amazon Prime benefits"],
      benefits: ["5% on Amazon, 2% on food delivery", "1% on other spends", "Zero forex markup"],
      eligibility: { minIncome: 25000, minCreditScore: 650 },
      rating: 4.6
    },
    {
      id: "4",
      name: "Axis Magnus",
      bank: "Axis Bank",
      category: "premium",
      annualFee: 12500,
      joiningFee: 12500,
      rewardRate: "12 Edge Miles per ₹200",
      features: ["Unlimited lounge access", "Complimentary Taj voucher", "Golf privileges"],
      benefits: ["Buy 1 Get 1 movie tickets", "Edge Rewards accelerated", "Travel benefits"],
      eligibility: { minIncome: 250000, minCreditScore: 750 },
      rating: 4.7
    },
    {
      id: "5",
      name: "Flipkart Axis Bank",
      bank: "Axis Bank",
      category: "rewards",
      annualFee: 500,
      joiningFee: 500,
      rewardRate: "5% cashback on Flipkart",
      features: ["Fee waiver on annual spend", "Flipkart benefits", "Lifestyle offers"],
      benefits: ["4% on preferred partners", "1.5% on others", "Book My Show offers"],
      eligibility: { minIncome: 30000, minCreditScore: 650 },
      rating: 4.4
    },
    {
      id: "6",
      name: "IndusInd Pinnacle",
      bank: "IndusInd Bank",
      category: "premium",
      annualFee: 10000,
      joiningFee: 5000,
      rewardRate: "2 reward points per ₹100",
      features: ["Unlimited domestic lounge", "International lounge access", "Golf privileges"],
      benefits: ["Milestone rewards", "Exclusive dining", "Concierge services"],
      eligibility: { minIncome: 200000, minCreditScore: 720 },
      rating: 4.3
    },
    {
      id: "7",
      name: "HSBC Cashback",
      bank: "HSBC",
      category: "cashback",
      annualFee: 999,
      joiningFee: 0,
      rewardRate: "10% cashback online",
      features: ["High cashback rate", "No forex markup", "Fuel surcharge waiver"],
      benefits: ["10% on online shopping", "5% on dining", "1% on other spends"],
      eligibility: { minIncome: 75000, minCreditScore: 700 },
      rating: 4.5
    },
    {
      id: "8",
      name: "SimplyCLICK SBI",
      bank: "SBI Card",
      category: "rewards",
      annualFee: 499,
      joiningFee: 499,
      rewardRate: "10X rewards online",
      features: ["Annual fee waiver", "Online shopping rewards", "Dining offers"],
      benefits: ["₹500 Amazon voucher on joining", "10X on partner sites", "Movie offers"],
      eligibility: { minIncome: 20000, minCreditScore: 650 },
      rating: 4.2
    }
  ];

  const filteredCards = creditCards.filter(card => {
    const matchesCategory = selectedCategory === "all" || card.category === selectedCategory;
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         card.bank.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "premium": return <Star className="h-5 w-5 text-yellow-500" />;
      case "cashback": return <DollarSign className="h-5 w-5 text-green-500" />;
      case "rewards": return <Gift className="h-5 w-5 text-purple-500" />;
      case "travel": return <Plane className="h-5 w-5 text-blue-500" />;
      default: return <CreditCard className="h-5 w-5" />;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="credit-cards-title">Credit Cards</h1>
            <p className="text-muted-foreground">Compare and apply for credit cards from top banks</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by card name or bank..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-cards"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48" data-testid="select-category">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="cashback">Cashback</SelectItem>
            <SelectItem value="rewards">Rewards</SelectItem>
            <SelectItem value="travel">Travel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all-cards" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="all-cards" data-testid="tab-all-cards">
            <CreditCard className="h-4 w-4 mr-2" />
            All Cards
          </TabsTrigger>
          <TabsTrigger value="premium" data-testid="tab-premium">
            <Star className="h-4 w-4 mr-2" />
            Premium Cards
          </TabsTrigger>
          <TabsTrigger value="cashback" data-testid="tab-cashback">
            <DollarSign className="h-4 w-4 mr-2" />
            Cashback Cards
          </TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">
            <Gift className="h-4 w-4 mr-2" />
            Rewards Cards
          </TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">
            <Shield className="h-4 w-4 mr-2" />
            Card Comparison
          </TabsTrigger>
        </ScrollableTabsList>

        {/* All Cards Tab */}
        <TabsContent value="all-cards" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {filteredCards.map((card) => (
              <Card key={card.id} className="hover:shadow-lg transition-shadow" data-testid={`card-${card.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(card.category)}
                      <div>
                        <CardTitle className="text-lg">{card.name}</CardTitle>
                        <CardDescription>{card.bank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="capitalize">{card.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.floor(card.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                      />
                    ))}
                    <span className="text-sm text-muted-foreground">({card.rating})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Joining Fee</p>
                      <p className="font-semibold">₹{card.joiningFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Annual Fee</p>
                      <p className="font-semibold">₹{card.annualFee.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-primary">{card.rewardRate}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Key Features:</p>
                    <ul className="space-y-1">
                      {card.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Min. Income</p>
                      <p className="font-medium">₹{(card.eligibility.minIncome / 1000).toFixed(0)}K/month</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min. CIBIL</p>
                      <p className="font-medium">{card.eligibility.minCreditScore}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" data-testid={`button-apply-${card.id}`}>Apply Now</Button>
                    <Button variant="outline" className="flex-1" data-testid={`button-details-${card.id}`}>View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Premium Cards Tab */}
        <TabsContent value="premium" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {creditCards.filter(c => c.category === "premium").map((card) => (
              <Card key={card.id} className="border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Star className="h-6 w-6 text-yellow-500" />
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.bank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">Premium</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Premium Benefits:</p>
                    {card.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 mt-0.5" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" data-testid={`button-apply-premium-${card.id}`}>Apply for Premium Card</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Cashback Cards Tab */}
        <TabsContent value="cashback" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {creditCards.filter(c => c.category === "cashback").map((card) => (
              <Card key={card.id} className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-6 w-6 text-green-500" />
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.bank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Cashback</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="font-semibold text-green-900 dark:text-green-100">{card.rewardRate}</p>
                  </div>
                  <Button className="w-full" data-testid={`button-apply-cashback-${card.id}`}>Apply for Cashback Card</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rewards Cards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {creditCards.filter(c => c.category === "rewards").map((card) => (
              <Card key={card.id} className="border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="h-6 w-6 text-purple-500" />
                      <div>
                        <CardTitle>{card.name}</CardTitle>
                        <CardDescription>{card.bank}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">Rewards</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="font-semibold text-purple-900 dark:text-purple-100">{card.rewardRate}</p>
                  </div>
                  <Button className="w-full" data-testid={`button-apply-rewards-${card.id}`}>Apply for Rewards Card</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Card Comparison Tab */}
        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Card Comparison</CardTitle>
              <CardDescription>Compare features, fees, and benefits side by side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Card Name</th>
                      <th className="text-center p-3">Category</th>
                      <th className="text-center p-3">Annual Fee</th>
                      <th className="text-center p-3">Reward Rate</th>
                      <th className="text-center p-3">Min. Income</th>
                      <th className="text-center p-3">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditCards.map((card) => (
                      <tr key={card.id} className="border-b hover:bg-accent">
                        <td className="p-3">
                          <div>
                            <p className="font-semibold">{card.name}</p>
                            <p className="text-xs text-muted-foreground">{card.bank}</p>
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <Badge className="capitalize">{card.category}</Badge>
                        </td>
                        <td className="text-center p-3 font-medium">₹{card.annualFee.toLocaleString()}</td>
                        <td className="text-center p-3">{card.rewardRate}</td>
                        <td className="text-center p-3">₹{(card.eligibility.minIncome / 1000).toFixed(0)}K</td>
                        <td className="text-center p-3 font-medium">{card.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
