import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, FolderTree, MessageSquare, Send, Loader2, 
  CheckCircle, AlertTriangle, Clock, Phone, Mail, User
} from "lucide-react";

interface ProductInquiryFormProps {
  type: 'product' | 'category' | 'subcategory';
  itemId?: string;
  itemName: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryName?: string;
  description?: string;
  onClose?: () => void;
}

export function ProductInquiryForm({
  type,
  itemId,
  itemName,
  categoryId,
  categoryName,
  subcategoryId,
  subcategoryName,
  description,
  onClose,
}: ProductInquiryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const submitInquiry = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/store/inquiries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Inquiry Submitted",
        description: "We'll get back to you shortly regarding your interest.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    submitInquiry.mutate({
      ...formData,
      productId: type === 'product' ? itemId : null,
      categoryId: type === 'category' ? itemId : categoryId,
      subcategoryId: type === 'subcategory' ? itemId : subcategoryId,
    });
  };

  if (submitted) {
    return (
      <Card className="bg-background border-border max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Thank You!</h3>
          <p className="text-muted-foreground mb-6">
            Your inquiry about <strong className="text-foreground">{itemName}</strong> has been submitted successfully.
            Our team will contact you within 24-48 hours.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            Expected response time: 24-48 hours
          </div>
          {onClose && (
            <Button 
              onClick={onClose} 
              className="mt-6 bg-blue-600 hover:bg-blue-700"
            >
              Continue Browsing
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${
            type === 'product' 
              ? 'bg-purple-500/20' 
              : type === 'subcategory' 
                ? 'bg-blue-500/20' 
                : 'bg-amber-500/20'
          }`}>
            {type === 'product' ? (
              <Package className="w-6 h-6 text-purple-400" />
            ) : (
              <FolderTree className={`w-6 h-6 ${type === 'subcategory' ? 'text-blue-400' : 'text-amber-400'}`} />
            )}
          </div>
          <div>
            <CardTitle className="text-foreground">{itemName}</CardTitle>
            {(categoryName || subcategoryName) && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                {categoryName && <span>{categoryName}</span>}
                {subcategoryName && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <span>{subcategoryName}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <CardDescription className="text-muted-foreground">
          {description || `This ${type} is currently not available for direct access. Submit an inquiry and our team will assist you.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Alert className="mb-6 bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            This {type} is currently being reviewed or temporarily unavailable. 
            Please submit your details and we'll reach out to discuss your requirements.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-card border-border text-foreground"
              required
              data-testid="input-inquiry-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-card border-border text-foreground"
              required
              data-testid="input-inquiry-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-muted-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Mobile Number <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="mobile"
              type="tel"
              placeholder="+91 9876543210"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              className="bg-card border-border text-foreground"
              data-testid="input-inquiry-mobile"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Your Message <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Tell us about your requirements, investment goals, or any questions you have..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="bg-card border-border text-foreground min-h-[120px]"
              required
              data-testid="textarea-inquiry-message"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={submitInquiry.isPending}
            data-testid="button-submit-inquiry"
          >
            {submitInquiry.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Inquiry
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="border-t border-border bg-background/50">
        <div className="w-full text-center">
          <p className="text-xs text-muted-foreground">
            By submitting this form, you agree to be contacted by our team regarding your inquiry.
            We respect your privacy and will never share your information.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}

export function DisabledProductCard({
  productName,
  productType,
  categoryName,
  subcategoryName,
  onInquiry,
}: {
  productName: string;
  productType?: string;
  categoryName?: string;
  subcategoryName?: string;
  onInquiry?: () => void;
}) {
  return (
    <Card className="bg-background/50 border-border border-dashed">
      <CardContent className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-card flex items-center justify-center">
          <Package className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-muted-foreground mb-1">{productName}</h3>
        {productType && (
          <Badge variant="outline" className="mb-3 text-muted-foreground border-border">
            {productType}
          </Badge>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          This product is currently unavailable. Click below to express your interest.
        </p>
        <Button 
          variant="outline" 
          className="border-border hover:bg-card"
          onClick={onInquiry}
          data-testid="button-express-interest"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Express Interest
        </Button>
      </CardContent>
    </Card>
  );
}

export function DisabledCategoryBanner({
  categoryName,
  type = 'category',
  message,
  onInquiry,
}: {
  categoryName: string;
  type?: 'category' | 'subcategory';
  message?: string;
  onInquiry?: () => void;
}) {
  return (
    <Alert className="bg-amber-500/10 border-amber-500/30 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-400" />
      <div className="flex-1 ml-3">
        <h4 className="font-medium text-amber-200">{categoryName} - Currently Unavailable</h4>
        <AlertDescription className="text-amber-200/80 text-sm mt-1">
          {message || `This ${type} is temporarily unavailable. Our team is working on bringing it back.`}
        </AlertDescription>
      </div>
      {onInquiry && (
        <Button 
          variant="outline" 
          size="sm"
          className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
          onClick={onInquiry}
        >
          <MessageSquare className="w-4 h-4 mr-1" />
          Inquire
        </Button>
      )}
    </Alert>
  );
}
