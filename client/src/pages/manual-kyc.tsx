import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  User,
  Building2,
  Globe,
  LucideShield as LucideShield,
  File,
  Info
} from "lucide-react";

type KYCType = 'individual' | 'corporate' | 'nri';
type CorporateEntityType = 'private_limited' | 'public_limited' | 'partnership' | 'llp' | 'trust' | 'huf' | 'society' | 'aop' | 'boi';

interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  maxSize: number;
}

interface UploadedDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

interface KYCFormData {
  // Common fields
  applicantType: KYCType;
  pan: string;
  
  // Individual fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  fatherName?: string;
  motherName?: string;
  
  // Corporate fields
  entityType?: CorporateEntityType;
  companyName?: string;
  registrationNumber?: string;
  incorporationDate?: string;
  authorizedSignatoryName?: string;
  
  // NRI specific fields
  countryOfResidence?: string;
  passportNumber?: string;
  visaType?: string;
  
  // Common contact fields
  email: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  
  // Document URLs
  documents: Record<string, string>;
}

const DOCUMENT_REQUIREMENTS: Record<KYCType, DocumentRequirement[]> = {
  individual: [
    {
      id: 'pan_card',
      name: 'PAN Card',
      description: 'Permanent Account Number card (Front side)',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880 // 5MB
    },
    {
      id: 'aadhar_front',
      name: 'Aadhaar Card (Front)',
      description: 'Aadhaar card front side with photo',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'aadhar_back',
      name: 'Aadhaar Card (Back)',
      description: 'Aadhaar card back side with address',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'photo',
      name: 'Passport Size Photo',
      description: 'Recent passport size photograph',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSize: 2097152 // 2MB
    },
    {
      id: 'signature',
      name: 'Signature',
      description: 'Scanned signature on white paper',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSize: 1048576 // 1MB
    },
    {
      id: 'bank_proof',
      name: 'Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'income_proof',
      name: 'Income Proof',
      description: 'ITR, salary slip, or Form 16 (Optional)',
      required: false,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760 // 10MB
    }
  ],
  corporate: [
    {
      id: 'pan_card',
      name: 'Company PAN Card',
      description: 'Permanent Account Number of the company',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'incorporation_cert',
      name: 'Certificate of Incorporation',
      description: 'Company registration certificate from ROC',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'moa',
      name: 'Memorandum of Association (MOA)',
      description: 'MOA document of the company',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'aoa',
      name: 'Articles of Association (AOA)',
      description: 'AOA document of the company',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'board_resolution',
      name: 'Board Resolution',
      description: 'Resolution authorizing trading and signatory',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Authorized Signatory PAN',
      description: 'PAN card of authorized signatory',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Authorized Signatory Aadhaar',
      description: 'Aadhaar card of authorized signatory',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Company Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Registered Office Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  nri: [
    {
      id: 'pan_card',
      name: 'PAN Card',
      description: 'Permanent Account Number card',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'passport',
      name: 'Passport',
      description: 'Valid passport (all pages)',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'visa',
      name: 'Visa/OCI Card',
      description: 'Current visa or OCI card',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'overseas_address',
      name: 'Overseas Address Proof',
      description: 'Bank statement or utility bill from country of residence',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'indian_address',
      name: 'Indian Address Proof',
      description: 'Address proof in India (Aadhaar or utility bill)',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'photo',
      name: 'Recent Photograph',
      description: 'Passport size photo taken within last 6 months',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSize: 2097152
    },
    {
      id: 'signature',
      name: 'Signature',
      description: 'Scanned signature on white paper',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png'],
      maxSize: 1048576
    },
    {
      id: 'bank_proof_overseas',
      name: 'Overseas Bank Account Proof',
      description: 'Foreign bank statement or cancelled cheque',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof_nre_nro',
      name: 'NRE/NRO Account Proof',
      description: 'Indian NRE or NRO bank account proof',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ]
};

// Entity-specific document requirements for corporate entities
const ENTITY_DOCUMENT_REQUIREMENTS: Record<CorporateEntityType, DocumentRequirement[]> = {
  private_limited: [
    {
      id: 'pan_card',
      name: 'Company PAN Card',
      description: 'Permanent Account Number of the company',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'incorporation_cert',
      name: 'Certificate of Incorporation',
      description: 'Company registration certificate from ROC',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'moa',
      name: 'Memorandum of Association (MOA)',
      description: 'MOA document of the company',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'aoa',
      name: 'Articles of Association (AOA)',
      description: 'AOA document of the company',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'board_resolution',
      name: 'Board Resolution',
      description: 'Resolution authorizing trading and signatory',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Director PAN',
      description: 'PAN card of authorized director',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Director Aadhaar',
      description: 'Aadhaar card of authorized director',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Company Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Registered Office Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  public_limited: [
    {
      id: 'pan_card',
      name: 'Company PAN Card',
      description: 'Permanent Account Number of the company',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'incorporation_cert',
      name: 'Certificate of Incorporation',
      description: 'Company registration certificate from ROC',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'moa',
      name: 'Memorandum of Association (MOA)',
      description: 'MOA document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'aoa',
      name: 'Articles of Association (AOA)',
      description: 'AOA document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'board_resolution',
      name: 'Board Resolution',
      description: 'Resolution authorizing trading and signatory',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Authorized Director PAN',
      description: 'PAN card of authorized director',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Authorized Director Aadhaar',
      description: 'Aadhaar card of authorized director',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Company Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Registered Office Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  llp: [
    {
      id: 'pan_card',
      name: 'LLP PAN Card',
      description: 'Permanent Account Number of the LLP',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'incorporation_cert',
      name: 'LLP Registration Certificate',
      description: 'Registration certificate from ROC',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'llp_agreement',
      name: 'LLP Agreement',
      description: 'LLP agreement document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'board_resolution',
      name: 'Partners Resolution',
      description: 'Resolution authorizing trading and signatory',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Designated Partner PAN',
      description: 'PAN card of designated partner',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Designated Partner Aadhaar',
      description: 'Aadhaar card of designated partner',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'LLP Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Registered Office Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  partnership: [
    {
      id: 'pan_card',
      name: 'Partnership Firm PAN Card',
      description: 'Permanent Account Number of the firm',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'partnership_deed',
      name: 'Partnership Deed',
      description: 'Partnership deed document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'registration_cert',
      name: 'Registration Certificate',
      description: 'Registration certificate (if registered)',
      required: false,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'partners_resolution',
      name: 'Partners Resolution',
      description: 'Resolution authorizing trading',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Managing Partner PAN',
      description: 'PAN card of managing partner',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Managing Partner Aadhaar',
      description: 'Aadhaar card of managing partner',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Firm Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Firm Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  trust: [
    {
      id: 'pan_card',
      name: 'Trust PAN Card',
      description: 'Permanent Account Number of the trust',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'trust_deed',
      name: 'Trust Deed',
      description: 'Original trust deed document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'registration_cert',
      name: 'Registration Certificate',
      description: 'Trust registration certificate (if registered)',
      required: false,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'trustee_resolution',
      name: 'Trustee Resolution',
      description: 'Resolution authorizing trading',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Trustee PAN',
      description: 'PAN card of managing trustee',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Trustee Aadhaar',
      description: 'Aadhaar card of managing trustee',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Trust Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Trust Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  huf: [
    {
      id: 'pan_card',
      name: 'HUF PAN Card',
      description: 'Permanent Account Number of the HUF',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'huf_declaration',
      name: 'HUF Declaration',
      description: 'Declaration of HUF formation',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'karta_pan',
      name: 'Karta PAN Card',
      description: 'PAN card of Karta',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'karta_aadhar',
      name: 'Karta Aadhaar',
      description: 'Aadhaar card of Karta',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'HUF Bank Account Proof',
      description: 'Cancelled cheque or bank statement in HUF name',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'HUF Address Proof',
      description: 'Utility bill or address proof',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  society: [
    {
      id: 'pan_card',
      name: 'Society PAN Card',
      description: 'Permanent Account Number of the society',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'registration_cert',
      name: 'Society Registration Certificate',
      description: 'Registration certificate under Societies Act',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'bylaws',
      name: 'Society Bylaws/Rules',
      description: 'Society bylaws or rules document',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'resolution',
      name: 'Society Resolution',
      description: 'Resolution authorizing trading',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'President/Secretary PAN',
      description: 'PAN card of authorized signatory',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'President/Secretary Aadhaar',
      description: 'Aadhaar card of authorized signatory',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'Society Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Registered Office Address Proof',
      description: 'Utility bill or rent agreement',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  aop: [
    {
      id: 'pan_card',
      name: 'AOP PAN Card',
      description: 'Permanent Account Number of the AOP',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'formation_document',
      name: 'Formation Document',
      description: 'Document showing formation of AOP',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'resolution',
      name: 'AOP Resolution',
      description: 'Resolution authorizing trading',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Representative PAN',
      description: 'PAN card of authorized representative',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Representative Aadhaar',
      description: 'Aadhaar card of authorized representative',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'AOP Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Address Proof',
      description: 'Utility bill or address proof',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ],
  boi: [
    {
      id: 'pan_card',
      name: 'BOI PAN Card',
      description: 'Permanent Account Number of the BOI',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'formation_document',
      name: 'Formation Document',
      description: 'Document showing formation of BOI',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 10485760
    },
    {
      id: 'resolution',
      name: 'BOI Resolution',
      description: 'Resolution authorizing trading',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_pan',
      name: 'Representative PAN',
      description: 'PAN card of authorized representative',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'signatory_aadhar',
      name: 'Representative Aadhaar',
      description: 'Aadhaar card of authorized representative',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'bank_proof',
      name: 'BOI Bank Account Proof',
      description: 'Cancelled cheque or bank statement',
      required: true,
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 5242880
    },
    {
      id: 'address_proof',
      name: 'Address Proof',
      description: 'Utility bill or address proof',
      required: true,
      acceptedFormats: ['application/pdf'],
      maxSize: 5242880
    }
  ]
};

export default function ManualKYCPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type') as KYCType || 'individual';
  
  const [kycType, setKYCType] = useState<KYCType>(typeParam);
  const [entityType, setEntityType] = useState<CorporateEntityType>('private_limited');
  const [formData, setFormData] = useState<Partial<KYCFormData>>({
    applicantType: kycType,
    entityType: kycType === 'corporate' ? 'private_limited' : undefined,
    documents: {}
  });
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDocument>>({});
  const [currentStep, setCurrentStep] = useState<'details' | 'documents' | 'review'>('details');

  useEffect(() => {
    setKYCType(typeParam);
    setFormData(prev => ({ ...prev, applicantType: typeParam }));
  }, [typeParam]);

  // Get requirements based on KYC type and entity type
  const requirements = kycType === 'corporate' 
    ? ENTITY_DOCUMENT_REQUIREMENTS[entityType]
    : DOCUMENT_REQUIREMENTS[kycType];
  const requiredDocs = requirements.filter(doc => doc.required);
  const uploadedCount = Object.keys(uploadedDocs).length;
  const requiredCount = requiredDocs.length;
  const progress = (uploadedCount / requiredCount) * 100;

  const handleDocumentUpload = (docId: string, url: string, file: File) => {
    setUploadedDocs(prev => ({
      ...prev,
      [docId]: {
        id: docId,
        name: file.name,
        url,
        uploadedAt: new Date().toISOString()
      }
    }));
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docId]: url
      }
    }));
    toast({
      title: "Document uploaded",
      description: `${file.name} uploaded successfully`,
    });
  };

  const submitKYCMutation = useMutation({
    mutationFn: async (data: Partial<KYCFormData>) => {
      const response = await apiRequest("POST", "/api/kyc/manual-submit", {
        body: data
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "KYC Submitted Successfully",
        description: "Your KYC application has been submitted for verification. You'll receive an update within 2-3 business days.",
      });
      navigate("/profile?tab=kyc-dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    // Validate required documents
    const missingDocs = requiredDocs.filter(doc => !uploadedDocs[doc.id]);
    if (missingDocs.length > 0) {
      toast({
        title: "Missing Required Documents",
        description: `Please upload: ${missingDocs.map(d => d.name).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Validate required fields based on type
    let requiredFields: string[] = [];
    
    if (kycType === 'individual') {
      requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'pan', 'email', 'mobile', 'address', 'city', 'state', 'pincode'];
    } else if (kycType === 'corporate') {
      // Base corporate fields
      const baseCorporateFields = ['pan', 'email', 'mobile', 'address', 'city', 'state', 'pincode', 'entityType'];
      
      // Entity-specific required fields
      const entitySpecificFields: Record<CorporateEntityType, string[]> = {
        private_limited: ['companyName', 'registrationNumber', 'incorporationDate', 'authorizedSignatoryName'],
        public_limited: ['companyName', 'registrationNumber', 'incorporationDate', 'authorizedSignatoryName'],
        llp: ['companyName', 'registrationNumber', 'incorporationDate', 'authorizedSignatoryName'],
        partnership: ['companyName', 'incorporationDate', 'authorizedSignatoryName'],
        trust: ['companyName', 'incorporationDate', 'authorizedSignatoryName'],
        huf: ['companyName', 'authorizedSignatoryName'],
        society: ['companyName', 'registrationNumber', 'incorporationDate', 'authorizedSignatoryName'],
        aop: ['companyName', 'incorporationDate', 'authorizedSignatoryName'],
        boi: ['companyName', 'incorporationDate', 'authorizedSignatoryName']
      };
      
      requiredFields = [...baseCorporateFields, ...entitySpecificFields[entityType]];
    } else if (kycType === 'nri') {
      requiredFields = ['firstName', 'lastName', 'passportNumber', 'countryOfResidence', 'pan', 'email', 'mobile', 'address', 'city', 'state', 'pincode'];
    }

    const missingFields = requiredFields.filter(field => !formData[field as keyof KYCFormData]);
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Information",
        description: `Please fill in all required fields for ${kycType === 'corporate' ? entityType.replace('_', ' ') : kycType} KYC`,
        variant: "destructive",
      });
      setCurrentStep('details');
      return;
    }

    submitKYCMutation.mutate(formData);
  };

  const getKYCTypeIcon = () => {
    switch (kycType) {
      case 'individual':
        return <User className="h-6 w-6" />;
      case 'corporate':
        return <Building2 className="h-6 w-6" />;
      case 'nri':
        return <Globe className="h-6 w-6" />;
    }
  };

  const getKYCTypeTitle = () => {
    switch (kycType) {
      case 'individual':
        return 'Individual KYC';
      case 'corporate':
        return 'Corporate/Non-Individual KYC';
      case 'nri':
        return 'NRI KYC';
    }
  };

  const getKYCTypeDescription = () => {
    switch (kycType) {
      case 'individual':
        return 'Complete KYC verification for individual investors using direct document upload';
      case 'corporate':
        return 'Complete KYC verification for corporate entities, trusts, and non-individual investors';
      case 'nri':
        return 'Complete KYC verification for Non-Resident Indians with overseas address';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            {getKYCTypeIcon()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {getKYCTypeTitle()} - Manual Upload
            </h1>
            <p className="text-muted-foreground">
              {getKYCTypeDescription()}
            </p>
          </div>
        </div>

        {/* Guidance Alert */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Traditional Document Upload via BSE Star API</AlertTitle>
          <AlertDescription>
            {kycType === 'individual' ? (
              <>
                This path uses direct document upload with BSE Star MFD API verification. 
                <strong className="block mt-1">
                  Prefer the <a href="/onboarding" className="text-blue-600 underline">Smart KYC Onboarding</a> for a faster, AI-assisted experience with auto-fill.
                </strong>
              </>
            ) : kycType === 'corporate' ? (
              <>
                This path is designed for companies, trusts, and non-individual entities. Document verification through BSE Star API with Corporate PAN validation.
              </>
            ) : (
              <>
                Specialized path for Non-Resident Indians requiring passport, visa, and overseas address verification through BSE Star API.
              </>
            )}
          </AlertDescription>
        </Alert>

        {/* Entity Type Selector for Corporate */}
        {kycType === 'corporate' && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entityType" className="text-base font-semibold">Entity Type *</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select the type of non-individual entity
                  </p>
                </div>
                <Select 
                  value={entityType} 
                  onValueChange={(value: CorporateEntityType) => {
                    setEntityType(value);
                    setFormData(prev => ({ ...prev, entityType: value }));
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="select-entity-type">
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private_limited">Private Limited Company</SelectItem>
                    <SelectItem value="public_limited">Public Limited Company</SelectItem>
                    <SelectItem value="partnership">Partnership Firm</SelectItem>
                    <SelectItem value="llp">Limited Liability Partnership (LLP)</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                    <SelectItem value="huf">Hindu Undivided Family (HUF)</SelectItem>
                    <SelectItem value="society">Society</SelectItem>
                    <SelectItem value="aop">Association of Persons (AOP)</SelectItem>
                    <SelectItem value="boi">Body of Individuals (BOI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Indicator */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Upload Progress</span>
                <span className="text-muted-foreground">
                  {uploadedCount} of {requiredCount} required documents uploaded
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step Navigation */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={currentStep === 'details' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentStep('details')}
            data-testid="button-step-details"
          >
            1. Details
          </Button>
          <Button
            variant={currentStep === 'documents' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentStep('documents')}
            data-testid="button-step-documents"
          >
            2. Documents
          </Button>
          <Button
            variant={currentStep === 'review' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentStep('review')}
            data-testid="button-step-review"
          >
            3. Review
          </Button>
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'details' && (
        <Card>
          <CardHeader>
            <CardTitle>Applicant Details</CardTitle>
            <CardDescription>
              Enter the applicant information as per official documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                All information must match your identity documents exactly. Any mismatch may lead to rejection.
              </AlertDescription>
            </Alert>

            {/* Individual Fields */}
            {kycType === 'individual' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="As per PAN card"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                    placeholder="Optional"
                    data-testid="input-middle-name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="As per PAN card"
                    data-testid="input-last-name"
                  />
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    data-testid="input-dob"
                  />
                </div>
                <div>
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input
                    id="fatherName"
                    value={formData.fatherName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                    placeholder="As per documents"
                    data-testid="input-father-name"
                  />
                </div>
                <div>
                  <Label htmlFor="motherName">Mother's Name</Label>
                  <Input
                    id="motherName"
                    value={formData.motherName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
                    placeholder="As per documents"
                    data-testid="input-mother-name"
                  />
                </div>
              </div>
            )}

            {/* Corporate/Non-Individual Fields */}
            {kycType === 'corporate' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company/LLP Fields */}
                {(entityType === 'private_limited' || entityType === 'public_limited' || entityType === 'llp') && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">
                        {entityType === 'llp' ? 'LLP Name *' : 'Company Name *'}
                      </Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder={entityType === 'llp' ? 'As per LLP Agreement' : 'As per Certificate of Incorporation'}
                        data-testid="input-company-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registrationNumber">
                        {entityType === 'llp' ? 'LLPIN *' : 'CIN *'}
                      </Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                        placeholder={entityType === 'llp' ? 'LLPIN Number' : 'CIN Number'}
                        data-testid="input-registration-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incorporationDate">
                        {entityType === 'llp' ? 'Registration Date *' : 'Incorporation Date *'}
                      </Label>
                      <Input
                        id="incorporationDate"
                        type="date"
                        value={formData.incorporationDate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, incorporationDate: e.target.value }))}
                        data-testid="input-incorporation-date"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">Authorized Signatory Name *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of designated partner/director"
                        data-testid="input-signatory-name"
                      />
                    </div>
                  </>
                )}

                {/* Trust Fields */}
                {entityType === 'trust' && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">Trust Name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="As per Trust Deed"
                        data-testid="input-trust-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registrationNumber">Trust Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                        placeholder="Registration number (if registered)"
                        data-testid="input-registration-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incorporationDate">Trust Deed Date *</Label>
                      <Input
                        id="incorporationDate"
                        type="date"
                        value={formData.incorporationDate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, incorporationDate: e.target.value }))}
                        data-testid="input-deed-date"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">Trustee Name *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of managing trustee"
                        data-testid="input-trustee-name"
                      />
                    </div>
                  </>
                )}

                {/* Partnership Fields */}
                {entityType === 'partnership' && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">Partnership Firm Name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="As per Partnership Deed"
                        data-testid="input-firm-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registrationNumber">Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                        placeholder="Registration number (if registered)"
                        data-testid="input-registration-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incorporationDate">Partnership Deed Date *</Label>
                      <Input
                        id="incorporationDate"
                        type="date"
                        value={formData.incorporationDate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, incorporationDate: e.target.value }))}
                        data-testid="input-deed-date"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">Authorized Partner Name *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of managing/authorized partner"
                        data-testid="input-partner-name"
                      />
                    </div>
                  </>
                )}

                {/* HUF Fields */}
                {entityType === 'huf' && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">HUF Name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="Name of Hindu Undivided Family"
                        data-testid="input-huf-name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">Karta Name *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of Karta (head of HUF)"
                        data-testid="input-karta-name"
                      />
                    </div>
                  </>
                )}

                {/* Society Fields */}
                {entityType === 'society' && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">Society Name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="As per Society Registration Certificate"
                        data-testid="input-society-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="registrationNumber">Registration Number *</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                        placeholder="Society registration number"
                        data-testid="input-registration-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incorporationDate">Registration Date *</Label>
                      <Input
                        id="incorporationDate"
                        type="date"
                        value={formData.incorporationDate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, incorporationDate: e.target.value }))}
                        data-testid="input-registration-date"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">President/Secretary Name *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of President or Secretary"
                        data-testid="input-signatory-name"
                      />
                    </div>
                  </>
                )}

                {/* AOP/BOI Fields */}
                {(entityType === 'aop' || entityType === 'boi') && (
                  <>
                    <div className="md:col-span-2">
                      <Label htmlFor="companyName">
                        {entityType === 'aop' ? 'AOP Name *' : 'BOI Name *'}
                      </Label>
                      <Input
                        id="companyName"
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder={entityType === 'aop' ? 'Association of Persons name' : 'Body of Individuals name'}
                        data-testid="input-entity-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="incorporationDate">Formation Date *</Label>
                      <Input
                        id="incorporationDate"
                        type="date"
                        value={formData.incorporationDate || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, incorporationDate: e.target.value }))}
                        data-testid="input-formation-date"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="authorizedSignatoryName">Authorized Representative *</Label>
                      <Input
                        id="authorizedSignatoryName"
                        value={formData.authorizedSignatoryName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, authorizedSignatoryName: e.target.value }))}
                        placeholder="Name of authorized representative"
                        data-testid="input-representative-name"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* NRI Fields */}
            {kycType === 'nri' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="As per passport"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="As per passport"
                    data-testid="input-last-name"
                  />
                </div>
                <div>
                  <Label htmlFor="passportNumber">Passport Number *</Label>
                  <Input
                    id="passportNumber"
                    value={formData.passportNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, passportNumber: e.target.value }))}
                    placeholder="Valid passport number"
                    data-testid="input-passport-number"
                  />
                </div>
                <div>
                  <Label htmlFor="countryOfResidence">Country of Residence *</Label>
                  <Input
                    id="countryOfResidence"
                    value={formData.countryOfResidence || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, countryOfResidence: e.target.value }))}
                    placeholder="Current country"
                    data-testid="input-country"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="visaType">Visa Type</Label>
                  <Input
                    id="visaType"
                    value={formData.visaType || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, visaType: e.target.value }))}
                    placeholder="Work visa, Student visa, OCI, etc."
                    data-testid="input-visa-type"
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* Common Fields */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Identity & Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pan">PAN *</Label>
                  <Input
                    id="pan"
                    value={formData.pan || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    data-testid="input-pan"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    data-testid="input-mobile"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Address */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Address Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Complete address"
                    data-testid="input-address"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City name"
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State name"
                    data-testid="input-state"
                  />
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    data-testid="input-pincode"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep('documents')}
                data-testid="button-continue-to-documents"
              >
                Continue to Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'documents' && (
        <div className="space-y-6">
          <Alert>
            <LucideShield className="h-4 w-4" />
            <AlertDescription>
              <strong>Document Guidelines:</strong> Upload clear, legible scans or photos. Ensure all text is readable and there's no glare or shadow on documents.
            </AlertDescription>
          </Alert>

          {requirements.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{doc.name}</CardTitle>
                      <CardDescription>{doc.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                    {uploadedDocs[doc.id] && (
                      <Badge variant="default" className="text-xs bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Uploaded
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Accepted Formats:</strong> {doc.acceptedFormats.join(', ')}</p>
                    <p><strong>Max Size:</strong> {Math.round(doc.maxSize / 1024 / 1024)}MB</p>
                  </div>
                  
                  {uploadedDocs[doc.id] ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{uploadedDocs[doc.id].name}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded on {new Date(uploadedDocs[doc.id].uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newDocs = { ...uploadedDocs };
                          delete newDocs[doc.id];
                          setUploadedDocs(newDocs);
                          const newFormDocs = { ...formData.documents };
                          delete newFormDocs[doc.id];
                          setFormData(prev => ({ ...prev, documents: newFormDocs }));
                        }}
                        data-testid={`button-remove-${doc.id}`}
                      >
                        Re-upload
                      </Button>
                    </div>
                  ) : (
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={doc.maxSize}
                      acceptedTypes={doc.acceptedFormats}
                      onGetUploadParameters={async () => {
                        const response = await apiRequest("POST", "/api/object-storage/upload-url", {
                          body: {
                            fileName: `kyc_${kycType}_${doc.id}_${Date.now()}`,
                            contentType: doc.acceptedFormats[0]
                          }
                        });
                        const data = await response.json();
                        return {
                          method: "PUT" as const,
                          url: data.uploadURL
                        };
                      }}
                      onComplete={(result) => {
                        handleDocumentUpload(doc.id, result.uploadURL, result.file);
                      }}
                      buttonClassName="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {doc.name}
                    </ObjectUploader>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('details')}
              data-testid="button-back-to-details"
            >
              Back to Details
            </Button>
            <Button
              onClick={() => setCurrentStep('review')}
              disabled={uploadedCount < requiredCount}
              data-testid="button-continue-to-review"
            >
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Please review all information before submitting your KYC application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Once submitted, your application will be processed through BSE Star MFD API. You'll receive verification updates via email and SMS.
              </AlertDescription>
            </Alert>

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-3">Applicant Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">KYC Type</p>
                    <p className="font-medium">{getKYCTypeTitle()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN</p>
                    <p className="font-medium">{formData.pan || 'N/A'}</p>
                  </div>
                  {kycType === 'individual' && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Name</p>
                        <p className="font-medium">{`${formData.firstName || ''} ${formData.middleName || ''} ${formData.lastName || ''}`}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date of Birth</p>
                        <p className="font-medium">{formData.dateOfBirth || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  {kycType === 'corporate' && (
                    <>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Company Name</p>
                        <p className="font-medium">{formData.companyName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Registration Number</p>
                        <p className="font-medium">{formData.registrationNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Authorized Signatory</p>
                        <p className="font-medium">{formData.authorizedSignatoryName || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  {kycType === 'nri' && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Name</p>
                        <p className="font-medium">{`${formData.firstName || ''} ${formData.lastName || ''}`}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Passport Number</p>
                        <p className="font-medium">{formData.passportNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Country of Residence</p>
                        <p className="font-medium">{formData.countryOfResidence || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{formData.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobile</p>
                    <p className="font-medium">{formData.mobile || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-lg mb-3">Uploaded Documents ({uploadedCount})</h3>
                <div className="space-y-2">
                  {Object.values(uploadedDocs).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>{requirements.find(r => r.id === doc.id)?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('documents')}
                data-testid="button-back-to-documents"
              >
                Back to Documents
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitKYCMutation.isPending}
                data-testid="button-submit-kyc"
              >
                {submitKYCMutation.isPending && <Upload className="mr-2 h-4 w-4 animate-pulse" />}
                Submit KYC Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
