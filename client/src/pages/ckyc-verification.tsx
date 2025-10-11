import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Clock, Upload, FileText, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { CkycRecord, CkycDocument } from "@shared/schema";
import { AppLayout } from "@/components/layout/app-layout";

interface ComplianceStatus {
  compliant: boolean;
  status?: string;
  reason?: string;
  requiredActions?: string[];
  ckycNumber?: string;
}

export default function CkycVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    pan: "",
    aadhar: "",
    fullName: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    mobile: "",
    email: "",
    income: "",
    occupation: ""
  });

  // Assuming we get user ID from auth context - for demo using 'demo-user-1'
  const userId = "demo-user-1";

  const { data: ckycRecord, isLoading } = useQuery<CkycRecord>({
    queryKey: [`/api/ckyc/${userId}`],
    retry: false
  });

  const { data: documents } = useQuery<CkycDocument[]>({
    queryKey: [`/api/ckyc/${userId}/documents`],
    retry: false
  });

  const { data: compliance } = useQuery<ComplianceStatus>({
    queryKey: [`/api/ckyc/${userId}/compliance`],
    retry: false
  });

  // Initialize formData with ckycRecord values when loaded (only for empty fields)
  useEffect(() => {
    if (ckycRecord) {
      setFormData(prev => ({
        pan: prev.pan || ckycRecord.panNumber || "",
        aadhar: prev.aadhar || ckycRecord.aadharNumber || "",
        fullName: prev.fullName || `${ckycRecord.firstName || ''} ${ckycRecord.lastName || ''}`.trim(),
        dateOfBirth: prev.dateOfBirth || ckycRecord.dateOfBirth?.split('T')[0] || "",
        address: prev.address || ckycRecord.addressLine1 || "",
        city: prev.city || ckycRecord.city || "",
        state: prev.state || ckycRecord.state || "",
        pincode: prev.pincode || ckycRecord.pincode || "",
        mobile: prev.mobile || ckycRecord.mobileNumber || "",
        email: prev.email || ckycRecord.emailAddress || "",
        income: prev.income || ckycRecord.annualIncome || "",
        occupation: prev.occupation || ckycRecord.occupation || ""
      }));
    }
  }, [ckycRecord]);

  const createCkycMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ckyc", { body: data });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ckyc/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ckyc/${userId}/compliance`] });
      toast({
        title: "CKYC Record Created",
        description: "Your CKYC information has been submitted for verification.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (documentData: any) => {
      const res = await apiRequest("POST", `/api/ckyc/${userId}/documents`, { body: documentData });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ckyc/${userId}/documents`] });
      setDocumentFile(null);
      setSelectedDocType("");
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitCkyc = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Split fullName into firstName and lastName
    const nameParts = formData.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
    
    // Transform formData to match schema
    createCkycMutation.mutate({
      userId,
      firstName,
      lastName,
      panNumber: formData.pan,
      aadharNumber: formData.aadhar,
      dateOfBirth: formData.dateOfBirth,
      mobileNumber: formData.mobile,
      emailAddress: formData.email,
      addressLine1: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      occupation: formData.occupation,
      annualIncome: formData.income,
      status: 'pending',
    });
  };

  const handleDocumentUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentFile || !selectedDocType) {
      toast({
        title: "Missing Information",
        description: "Please select a document type and upload a file.",
        variant: "destructive",
      });
      return;
    }

    // In a real app, you'd upload to cloud storage first
    const mockDocumentUrl = `https://storage.example.com/documents/${documentFile.name}`;
    
    uploadDocumentMutation.mutate({
      documentType: selectedDocType,
      documentUrl: mockDocumentUrl,
      fileName: documentFile.name,
      fileSize: documentFile.size.toString()
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6 px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">CKYC Verification</h1>
          <p className="text-muted-foreground">Central KYC Registry - Complete your compliance verification</p>
        </div>
      </div>

      {/* Compliance Status Overview */}
      {compliance && (
        <Card className="mb-6" data-testid="card-compliance-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {compliance.compliant ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Badge className={getStatusColor(compliance.status || 'pending')}>
                {compliance.status?.toUpperCase() || 'PENDING'}
              </Badge>
              {compliance.ckycNumber && (
                <div className="text-sm text-muted-foreground">
                  CKYC Number: <span className="font-mono">{compliance.ckycNumber}</span>
                </div>
              )}
            </div>
            
            {!compliance.compliant && compliance.requiredActions && (
              <div>
                <h4 className="font-semibold mb-2">Required Actions:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {compliance.requiredActions.map((action: string, index: number) => (
                    <li key={index} className="text-muted-foreground">{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* CKYC Information Form */}
        <Card data-testid="card-ckyc-form">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              {ckycRecord ? 'Update your CKYC information' : 'Complete your CKYC registration'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitCkyc} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    data-testid="input-pan"
                    value={formData.pan}
                    onChange={(e) => setFormData({...formData, pan: e.target.value})}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="aadhar">Aadhar Number</Label>
                  <Input
                    id="aadhar"
                    data-testid="input-aadhar"
                    value={formData.aadhar}
                    onChange={(e) => setFormData({...formData, aadhar: e.target.value})}
                    placeholder="1234 5678 9012"
                    maxLength={14}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  data-testid="input-fullname"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  placeholder="As per government ID"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    data-testid="input-dob"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    data-testid="input-mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  data-testid="textarea-address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Complete address as per government ID"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    data-testid="input-city"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="City"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    data-testid="input-state"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    placeholder="State"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    data-testid="input-pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    placeholder="Pincode"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    data-testid="input-occupation"
                    value={formData.occupation}
                    onChange={(e) => setFormData({...formData, occupation: e.target.value})}
                    placeholder="Your occupation"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="income">Annual Income</Label>
                  <Select
                    value={formData.income}
                    onValueChange={(value) => setFormData({...formData, income: value})}
                  >
                    <SelectTrigger data-testid="select-income">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="below-1-lakh">Below ₹1 Lakh</SelectItem>
                      <SelectItem value="1-5-lakh">₹1 - ₹5 Lakhs</SelectItem>
                      <SelectItem value="5-10-lakh">₹5 - ₹10 Lakhs</SelectItem>
                      <SelectItem value="10-25-lakh">₹10 - ₹25 Lakhs</SelectItem>
                      <SelectItem value="above-25-lakh">Above ₹25 Lakhs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                data-testid="button-submit-ckyc"
                className="w-full"
                disabled={createCkycMutation.isPending}
              >
                {createCkycMutation.isPending ? "Submitting..." : 
                 ckycRecord ? "Update Information" : "Submit CKYC Information"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card data-testid="card-document-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Document Upload
            </CardTitle>
            <CardDescription>Upload supporting documents for verification</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDocumentUpload} className="space-y-4">
              <div>
                <Label htmlFor="documentType">Document Type</Label>
                <Select
                  value={selectedDocType}
                  onValueChange={setSelectedDocType}
                >
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pan-card">PAN Card</SelectItem>
                    <SelectItem value="aadhar-card">Aadhar Card</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving-license">Driving License</SelectItem>
                    <SelectItem value="bank-statement">Bank Statement</SelectItem>
                    <SelectItem value="salary-slip">Salary Slip</SelectItem>
                    <SelectItem value="utility-bill">Utility Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="document">Choose File</Label>
                <Input
                  id="document"
                  data-testid="input-document-file"
                  type="file"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: PDF, JPG, PNG (Max 5MB)
                </p>
              </div>

              <Button
                type="submit"
                data-testid="button-upload-document"
                className="w-full"
                disabled={uploadDocumentMutation.isPending || !documentFile || !selectedDocType}
              >
                {uploadDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
              </Button>
            </form>

            <Separator className="my-6" />

            {/* Uploaded Documents */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Uploaded Documents
              </h4>
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc: any, index: number) => (
                    <div key={doc.id || index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{doc.documentType?.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                        <p className="text-sm text-muted-foreground">{doc.fileName}</p>
                      </div>
                      <Badge variant={doc.verificationStatus === 'verified' ? 'default' : 'secondary'}>
                        {doc.verificationStatus || 'pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Status */}
      {ckycRecord && (
        <Card className="mt-6" data-testid="card-current-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(ckycRecord.status || 'pending')}
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Verification Status</p>
                <Badge className={getStatusColor(ckycRecord.status || 'pending')}>
                  {ckycRecord.status?.toUpperCase() || 'PENDING'}
                </Badge>
              </div>

              {ckycRecord.ckycNumber && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">CKYC Number</p>
                  <p className="font-mono text-sm">{ckycRecord.ckycNumber}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                <p className="text-sm">{ckycRecord.updatedAt ? new Date(ckycRecord.updatedAt).toLocaleDateString() : 'N/A'}</p>
              </div>

              {ckycRecord.expiryDate && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Expiry Date</p>
                  <p className="text-sm">{new Date(ckycRecord.expiryDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  );
}