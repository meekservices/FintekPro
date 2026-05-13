import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Building2,
  Wallet,
  CheckCircle,
  Clock,
  Shield as LucideShield,
  IndianRupee,
  FileText,
  Lock,
  QrCode,
  Smartphone,
  AlertTriangle,
  Receipt,
  Tag
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ITRPricing {
  [key: string]: { selfFile: number; expert: number };
}

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone, desc: "Pay using any UPI app" },
  { id: "card", label: "Credit/Debit Card", icon: CreditCard, desc: "Visa, Mastercard, RuPay" },
  { id: "netbanking", label: "Net Banking", icon: Building2, desc: "All major banks supported" },
  { id: "wallet", label: "Wallet", icon: Wallet, desc: "Paytm, PhonePe, Amazon Pay" }
];

const COUPON_CODES: Record<string, { discount: number; type: "percent" | "flat"; description: string }> = {
  "FIRST50": { discount: 50, type: "percent", description: "50% off on first filing" },
  "SAVE100": { discount: 100, type: "flat", description: "₹100 off" },
  "EARLYBIRD": { discount: 20, type: "percent", description: "20% early bird discount" }
};

export default function TaxITRPaymentPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/tax/itr/payment/:draftId");
  const { toast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("upi");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [upiId, setUpiId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const draftId = params?.draftId ? parseInt(params.draftId) : 1;
  const [itrForm, setItrForm] = useState("ITR-1");

  const { data: draftData } = useQuery({
    queryKey: ["/api/tax/itr/draft", draftId],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/tax/itr/draft/${draftId}`);
        if (response?.itrForm) {
          setItrForm(response.itrForm);
        }
        return response;
      } catch {
        return null;
      }
    },
    enabled: !!draftId
  });

  const { data: pricing } = useQuery<ITRPricing>({
    queryKey: ["/api/tax/itr-pricing"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/tax/itr-pricing");
      } catch {
        return {
          "ITR-1": { selfFile: 499, expert: 1999 },
          "ITR-2": { selfFile: 999, expert: 3499 },
          "ITR-3": { selfFile: 1999, expert: 5999 },
          "ITR-4": { selfFile: 799, expert: 2499 },
          "ITR-5": { selfFile: 2999, expert: 7999 },
          "ITR-6": { selfFile: 4999, expert: 14999 },
          "ITR-7": { selfFile: 3999, expert: 9999 }
        };
      }
    }
  });

  const basePrice = pricing?.[itrForm]?.selfFile || 499;
  const gst = Math.round(basePrice * 0.18);
  
  const getDiscount = () => {
    if (!appliedCoupon || !COUPON_CODES[appliedCoupon]) return 0;
    const coupon = COUPON_CODES[appliedCoupon];
    if (coupon.type === "percent") {
      return Math.round(basePrice * coupon.discount / 100);
    }
    return coupon.discount;
  };

  const discount = getDiscount();
  const totalAmount = basePrice + gst - discount;

  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      return await apiRequest(`/api/tax/itr/payment`, {
        method: "POST",
        body: JSON.stringify(paymentData)
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Successful",
        description: `Payment of ₹${totalAmount} received. Transaction ID: ${data.transactionId || "TXN" + Date.now()}`
      });
      navigate(`/tax/itr/verify/${draftId}`);
    },
    onError: (error) => {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: "There was an issue processing your payment. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    if (COUPON_CODES[code]) {
      setAppliedCoupon(code);
      toast({
        title: "Coupon Applied",
        description: COUPON_CODES[code].description
      });
    } else {
      toast({
        title: "Invalid Coupon",
        description: "The coupon code entered is invalid or expired.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handlePayNow = async () => {
    if (selectedPaymentMethod === "upi" && !upiId) {
      toast({
        title: "UPI ID Required",
        description: "Please enter your UPI ID to proceed.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    setTimeout(() => {
      processPaymentMutation.mutate({
        draftId,
        amount: totalAmount,
        paymentMethod: selectedPaymentMethod,
        couponCode: appliedCoupon,
        itrForm
      });
    }, 2000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-itr-payment">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tax/itr/preview/${draftId}`)} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Payment</h1>
          <p className="text-muted-foreground">Complete payment to proceed with filing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>Select your preferred payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={selectedPaymentMethod} 
                onValueChange={setSelectedPaymentMethod}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {PAYMENT_METHODS.map(method => (
                  <Card 
                    key={method.id}
                    className={`cursor-pointer transition-all ${selectedPaymentMethod === method.id ? "border-primary ring-2 ring-primary/20" : "hover:border-border dark:hover:border-border"}`}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <div className={`p-2 rounded-lg ${selectedPaymentMethod === method.id ? "bg-primary/10" : "bg-muted"}`}>
                        <method.icon className={`h-5 w-5 ${selectedPaymentMethod === method.id ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <Label htmlFor={method.id} className="font-medium cursor-pointer">{method.label}</Label>
                        <p className="text-sm text-muted-foreground">{method.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </RadioGroup>

              {selectedPaymentMethod === "upi" && (
                <div className="mt-6 space-y-4">
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="upiId">Enter UPI ID</Label>
                      <div className="relative mt-1">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="upiId"
                          className="pl-9"
                          placeholder="yourname@upi"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          data-testid="input-upi-id"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">e.g., 9876543210@paytm, yourname@okaxis</p>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center mb-2">
                          <QrCode className="h-20 w-20 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Or scan QR code</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Have a Coupon?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={!!appliedCoupon}
                  data-testid="input-coupon"
                />
                {appliedCoupon ? (
                  <Button variant="outline" onClick={handleRemoveCoupon}>Remove</Button>
                ) : (
                  <Button onClick={handleApplyCoupon} data-testid="button-apply-coupon">Apply</Button>
                )}
              </div>
              {appliedCoupon && (
                <div className="mt-2 flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{COUPON_CODES[appliedCoupon].description} applied!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-medium">{itrForm} Self-Filing</p>
                  <p className="text-sm text-muted-foreground">AY 2025-26</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filing Fee</span>
                  <span className="dark:text-foreground">₹{basePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (18%)</span>
                  <span className="dark:text-foreground">₹{gst}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span className="dark:text-foreground">Total</span>
                <span className="text-primary">₹{totalAmount}</span>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handlePayNow}
                disabled={isProcessing}
                data-testid="button-pay-now"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" /> Pay ₹{totalAmount}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <LucideShield className="h-3 w-3" />
                <span>Secured by 256-bit SSL encryption</span>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <LucideShield className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              Your payment information is secure. We use industry-standard encryption to protect your data.
            </AlertDescription>
          </Alert>

          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Refund Policy</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Filing fee is non-refundable once ITR is submitted to the Income Tax Department.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
