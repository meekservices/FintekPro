import { useState, useCallback } from "react";
import DOMPurify from "isomorphic-dompurify";
import parse from "html-react-parser";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken, fetchCsrfToken } from "@/lib/queryClient";
import { useDropzone } from "react-dropzone";
import { format, addDays, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { DocumentAnnotationsPanel } from "@/components/esign/DocumentAnnotationsPanel";
import { SigningMethodSelector, type SigningMethod } from "@/components/esign/SigningMethodSelector";
import {
  FileSignature,
  Upload,
  FileText,
  Users,
  Search,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  CalendarIcon,
  Mail,
  Phone,
  User,
  RefreshCw,
  Download,
  LayoutTemplate,
  History,
  ArrowUpDown,
  ChevronRight,
  MessageSquare,
  MousePointer2,
  CalendarDays,
  Loader2,
  FileType,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
} from "lucide-react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  panNumber?: string;
}

interface Signer {
  id: string;
  clientId?: string;
  name: string;
  email: string;
  mobile: string;
  order: number;
}

interface SignatureField {
  id: string;
  type: 'signature' | 'date' | 'initial';
  signerId: string;
  x: number;
  y: number;
  page: number;
}

interface SendOptions {
  email: boolean;
  whatsapp: boolean;
  autoFillDate: boolean;
}

interface UploadedDocumentData {
  originalUrl: string;
  displayUrl: string;
  documentHash: string;
  originalFormat: string;
  convertedFormat: string;
  fileName: string;
  htmlContent?: string;
}

interface ESignRequest {
  id: string;
  documentName: string;
  documentType: string;
  status: 'pending' | 'signed' | 'expired' | 'declined' | 'partial';
  createdAt: string;
  deadline?: string;
  signers: {
    name: string;
    email: string;
    status: 'pending' | 'signed' | 'declined';
    signedAt?: string;
  }[];
  documentUrl?: string;
  signedDocumentUrl?: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

const DOCUMENT_TYPES = [
  { value: 'investment_agreement', label: 'Investment Agreement' },
  { value: 'kyc_consent', label: 'KYC Consent' },
  { value: 'mandate', label: 'Mandate' },
  { value: 'itr_verification', label: 'ITR Verification' },
  { value: 'form_15ca', label: 'Form 15CA' },
  { value: 'form_15cb', label: 'Form 15CB' },
  { value: 'other', label: 'Other Document' },
];

const TEMPLATES: DocumentTemplate[] = [
  { id: '1', name: 'Investment Agreement', description: 'Standard investment agreement template', category: 'Investment' },
  { id: '2', name: 'KYC Consent Form', description: 'Client KYC authorization form', category: 'Compliance' },
  { id: '3', name: 'Demat Mandate', description: 'Demat account mandate form', category: 'Banking' },
  { id: '4', name: 'Risk Disclosure', description: 'Investment risk disclosure form', category: 'Compliance' },
  { id: '5', name: 'Nominee Declaration', description: 'Nominee details declaration', category: 'Legal' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  signed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  declined: "bg-muted text-muted-foreground",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  signed: CheckCircle2,
  expired: AlertCircle,
  declined: XCircle,
  partial: RefreshCw,
};

export default function AgentESignPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("send");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ESignRequest | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [signers, setSigners] = useState<Signer[]>([]);
  const [deadline, setDeadline] = useState<Date | undefined>(addDays(new Date(), 7));
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [documentSource, setDocumentSource] = useState<'upload' | 'template' | 'recent'>('upload');
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [sendOptions, setSendOptions] = useState<SendOptions>({
    email: true,
    whatsapp: false,
    autoFillDate: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocumentData, setUploadedDocumentData] = useState<UploadedDocumentData | null>(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSuggestPanel, setShowSuggestPanel] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string>("");
  const [selectedSigningMethod, setSelectedSigningMethod] = useState<SigningMethod>('aadhaar_esign');
  // Edit & Suggest state
  const [allowEditing, setAllowEditing] = useState(false);
  const [selectedTextForSuggestion, setSelectedTextForSuggestion] = useState('');
  const [suggestionReplacement, setSuggestionReplacement] = useState('');
  const [suggestionNote, setSuggestionNote] = useState('');
  const [showSuggestionPopover, setShowSuggestionPopover] = useState(false);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['/api/agent/clients'],
  });

  const { data: esignRequests, isLoading: requestsLoading, refetch: refetchRequests } = useQuery<ESignRequest[]>({
    queryKey: ['/api/agent/esign/requests'],
    placeholderData: [],
  });

  // Submit a text-change suggestion via the existing annotations/manual endpoint
  const submitSuggestion = useMutation({
    mutationFn: async () => {
      if (!currentDocumentId || !selectedTextForSuggestion || !suggestionReplacement) return;
      return apiRequest('/api/esign/ai/annotations/manual', {
        method: 'POST',
        body: JSON.stringify({
          documentId: currentDocumentId,
          category: 'correction',
          title: `Change: "${selectedTextForSuggestion.substring(0, 50)}${selectedTextForSuggestion.length > 50 ? '…' : ''}"`,
          content: suggestionNote || 'Text change suggestion',
          severity: 'warning',
          textExcerpt: selectedTextForSuggestion,
          suggestedReplacement: suggestionReplacement,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/esign/ai/annotations', currentDocumentId] });
      setSelectedTextForSuggestion('');
      setSuggestionReplacement('');
      setSuggestionNote('');
      setShowSuggestionPopover(false);
      setShowSuggestPanel(true);
      toast({ title: 'Change suggested ✓', description: 'Suggestion submitted. Agent must approve before signing.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit suggestion.', variant: 'destructive' });
    },
  });

  // Query open correction suggestions to gate Send for Signature
  const { data: openCorrections } = useQuery<any[]>({
    queryKey: ['/api/esign/ai/annotations', currentDocumentId, 'open-corrections'],
    queryFn: async () => {
      if (!currentDocumentId) return [];
      const res = await apiRequest(`/api/esign/ai/annotations/${currentDocumentId}?status=open&category=correction`);
      return (res as any)?.annotations?.filter((a: any) => a.category === 'correction' && a.status === 'open') || [];
    },
    enabled: !!currentDocumentId && allowEditing,
    refetchInterval: allowEditing ? 10000 : false,
  });

  const openCorrectionCount = openCorrections?.length || 0;

  // Handle text selection in Edit mode
  const handleDocumentMouseUp = useCallback(() => {
    if (!showSuggestPanel) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length >= 3) {
      setSelectedTextForSuggestion(text);
      setSuggestionReplacement('');
      setSuggestionNote('');
      setShowSuggestionPopover(true);
    }
  }, [showSuggestPanel]);

  const initiateESign = useMutation({
    mutationFn: async (data: {
      documentName: string;
      documentType: string;
      signers: Signer[];
      deadline?: string;
      documentHash?: string;
      signatureFields?: SignatureField[];
      sendOptions?: SendOptions;
    }) => {
      return apiRequest('/api/esign/initiate', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          documentHash: data.documentHash || 'mock-hash-' + Date.now(),
          aadhaarNumber: '999999999999',
          fullName: data.signers[0]?.name || 'Client',
          allowEditing: (data as any).allowEditing,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "E-Sign Request Sent", description: "Document has been sent for electronic signature" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/esign/requests'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send e-sign request", 
        variant: "destructive" 
      });
    }
  });

  const sendReminder = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest(`/api/esign/documents/${requestId}/remind`, {
        method: 'POST',
        body: JSON.stringify({
          sendVia: sendOptions.whatsapp ? 'whatsapp' : 'email',
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Reminder Sent", description: "Reminder has been sent to the signers" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/esign/requests'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to send reminder", 
        variant: "destructive" 
      });
    }
  });

  const analyzeDocument = useMutation({
    mutationFn: async (data: { documentId: string; documentContent: string; documentName: string; documentType: string }) => {
      return apiRequest('/api/esign/ai/analyze', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Analysis Complete", 
        description: `Found ${data.annotations?.length || 0} suggestions` 
      });
      setShowAIPanel(true);
      setIsAnalyzing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/esign/ai/annotations', currentDocumentId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Analysis Failed", 
        description: error.message || "Failed to analyze document", 
        variant: "destructive" 
      });
      setIsAnalyzing(false);
    }
  });

  const handleAnalyzeDocument = () => {
    if (!uploadedDocumentData) {
      toast({ title: "Missing Data", description: "Please upload a document first", variant: "destructive" });
      return;
    }
    if (!documentName) {
      toast({ title: "Missing Data", description: "Please enter a document name", variant: "destructive" });
      return;
    }
    // documentType is optional for AI analysis — we can analyse any uploaded document
    const effectiveType = documentType || "general";
    const docId = uploadedDocumentData.documentHash || `doc-${Date.now()}`;
    setCurrentDocumentId(docId);
    setIsAnalyzing(true);
    
    const content = uploadedDocumentData.htmlContent || 
      `Document: ${documentName}\nType: ${effectiveType}\nHash: ${uploadedDocumentData.documentHash}`;
    
    analyzeDocument.mutate({
      documentId: docId,
      documentContent: content,
      documentName,
      documentType: effectiveType,
    });
  };

  const downloadDocument = useMutation({
    mutationFn: async (transactionId: string) => {
      return apiRequest(`/api/esign/download/${transactionId}`, {
        method: 'GET',
      });
    },
    onSuccess: (data: any) => {
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      toast({ title: "Download Started", description: "Your signed document is being downloaded" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to download document", 
        variant: "destructive" 
      });
    }
  });

  const uploadDocument = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);

      /**
       * Ensure we have a CSRF token before uploading.
       * Raw fetch is required here (not apiRequest) because FormData uploads
       * must NOT have a Content-Type header set manually — the browser sets it
       * with the correct multipart boundary automatically.
       *
       * Key improvements over the naive approach:
       * 1. Always start with a fresh token (avoid stale cached token after X-Session-ID restore)
       * 2. Absorb X-CSRF-Token-Refresh header the server sends during CSRF auto-heal
       * 3. Retry on any 403 CSRF error (not just specific codes)
       * 4. Retry once on 500 — handles the GCS storage cold-start race condition
       */
      let token = getCsrfToken() || await fetchCsrfToken();

      const buildHeaders = (t: string | null): HeadersInit => (t ? { 'X-CSRF-Token': t } : {});

      // Absorb X-CSRF-Token-Refresh header the server sends during CSRF auto-heal
      const absorbRefreshHeader = (resp: Response) => {
        const refreshed = resp.headers.get('X-CSRF-Token-Refresh');
        if (refreshed) {
          token = refreshed;
          try { sessionStorage.setItem('csrf_token', refreshed); } catch {}
        }
      };

      let response = await fetch('/api/documents/upload/for-signing', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: buildHeaders(token),
      });
      absorbRefreshHeader(response);

      // Retry once on CSRF failure — token may be stale or was just auto-healed
      if (response.status === 403) {
        const errData = await response.clone().json().catch(() => ({}));
        if (errData.code === 'CSRF_ERROR' || errData.code === 'CSRF_TOKEN_INVALID' ||
            errData.code === 'CSRF_TOKEN_REQUIRED' || errData.error === 'Invalid CSRF token') {
          token = await fetchCsrfToken();
          response = await fetch('/api/documents/upload/for-signing', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: buildHeaders(token),
          });
          absorbRefreshHeader(response);
        }
      }

      // Retry once on 500 — handles GCS storage cold-start (PRIVATE_OBJECT_DIR warming up)
      if (response.status === 500) {
        token = await fetchCsrfToken();
        response = await fetch('/api/documents/upload/for-signing', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: buildHeaders(token),
        });
        absorbRefreshHeader(response);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      if (result.success && result.document) {
        setUploadedDocumentData(result.document);
        toast({ title: "Document Uploaded", description: `${file.name} uploaded successfully` });
      }
    } catch (error) {
      toast({ 
        title: "Upload Failed", 
        description: error instanceof Error ? error.message : "Failed to upload document", 
        variant: "destructive" 
      });
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.name.toLowerCase().endsWith('.docx');

    if (isPdf || isDocx) {
      setUploadedFile(file);
      const baseName = file.name.replace(/\.(pdf|docx)$/i, '');
      if (!documentName) {
        setDocumentName(baseName);
      }
      uploadDocument(file);
    } else {
      toast({ 
        title: "Invalid File", 
        description: "Please upload a PDF or DOCX file", 
        variant: "destructive" 
      });
    }
  }, [documentName, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleAddSigner = (clientId?: string) => {
    const client = clientId ? clients?.find(c => c.id === clientId) : null;
    const newSigner: Signer = {
      id: `signer-${Date.now()}`,
      clientId: client?.id,
      name: client ? `${client.firstName} ${client.lastName}` : '',
      email: client?.email || '',
      mobile: client?.mobile || '',
      order: signers.length + 1,
    };
    setSigners([...signers, newSigner]);
  };

  const handleRemoveSigner = (id: string) => {
    const updated = signers
      .filter(s => s.id !== id)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    setSigners(updated);
  };

  const handleUpdateSigner = (id: string, field: keyof Signer, value: string | number) => {
    setSigners(signers.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setDocumentName(template.name);
      setDocumentType(template.category.toLowerCase());
    }
  };

  const handleAddSignatureField = (signerId: string, type: 'signature' | 'date' | 'initial' = 'signature') => {
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      type,
      signerId,
      x: 50,
      y: 80,
      page: 1,
    };
    setSignatureFields([...signatureFields, newField]);
  };

  const handleUpdateSignatureField = (id: string, field: Partial<SignatureField>) => {
    setSignatureFields(signatureFields.map(f => f.id === id ? { ...f, ...field } : f));
  };

  const handleRemoveSignatureField = (id: string) => {
    setSignatureFields(signatureFields.filter(f => f.id !== id));
  };

  const handleCloseDialog = () => {
    setShowNewRequestDialog(false);
    setUploadedFile(null);
    setUploadedDocumentData(null);
    setDocumentName("");
    setDocumentType("");
    setSigners([]);
    setDeadline(addDays(new Date(), 7));
    setSelectedTemplate("");
    setDocumentSource('upload');
    setSignatureFields([]);
    setSendOptions({ email: true, whatsapp: false, autoFillDate: true });
    setIsUploading(false);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadedDocumentData(null);
  };

  const handleSendRequest = () => {
    if (!documentName || !documentType || signers.length === 0) {
      toast({ 
        title: "Incomplete Form", 
        description: "Please fill all required fields and add at least one signer", 
        variant: "destructive" 
      });
      return;
    }

    if (documentSource === 'upload' && !uploadedDocumentData) {
      toast({ 
        title: "Document Required", 
        description: "Please upload a document first", 
        variant: "destructive" 
      });
      return;
    }

    if (!sendOptions.email && !sendOptions.whatsapp) {
      toast({ 
        title: "Select Delivery Method", 
        description: "Please select at least one delivery method (Email or WhatsApp)", 
        variant: "destructive" 
      });
      return;
    }

    initiateESign.mutate({
      documentName,
      documentType,
      signers,
      deadline: deadline?.toISOString(),
      documentHash: uploadedDocumentData?.documentHash,
      signatureFields,
      sendOptions,
    });
  };

  const pendingRequests = esignRequests?.filter(r => r.status === 'pending' || r.status === 'partial') || [];
  const completedRequests = esignRequests?.filter(r => r.status === 'signed') || [];
  const expiredDeclinedRequests = esignRequests?.filter(r => r.status === 'expired' || r.status === 'declined') || [];

  const filteredRequests = (requests: ESignRequest[]) => {
    if (!searchQuery) return requests;
    return requests.filter(r => 
      r.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.signers.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const renderRequestRow = (request: ESignRequest) => {
    const StatusIcon = STATUS_ICONS[request.status];
    return (
      <TableRow 
        key={request.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => { setSelectedRequest(request); setShowPreviewDialog(true); }}
        data-testid={`row-esign-request-${request.id}`}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="font-medium text-foreground">{request.documentName}</div>
              <div className="text-sm text-muted-foreground">{request.documentType}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1">
            {request.signers.slice(0, 2).map((signer, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <User className="h-3 w-3 text-muted-foreground" />
                <span>{signer.name}</span>
                <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[signer.status])}>
                  {signer.status}
                </Badge>
              </div>
            ))}
            {request.signers.length > 2 && (
              <span className="text-xs text-muted-foreground">+{request.signers.length - 2} more</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge className={cn("gap-1", STATUS_COLORS[request.status])}>
            <StatusIcon className="h-3 w-3" />
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="text-sm">
            <div>{format(new Date(request.createdAt), 'MMM d, yyyy')}</div>
            <div className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
            </div>
          </div>
        </TableCell>
        <TableCell>
          {request.deadline && (
            <div className="text-sm">
              {format(new Date(request.deadline), 'MMM d, yyyy')}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); setShowPreviewDialog(true); }}
            data-testid={`button-view-request-${request.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  if (requestsLoading || clientsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30 dark:from-background dark:via-emerald-950/30 dark:to-teal-950/30">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
            <div className="text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30 dark:from-background dark:via-emerald-950/30 dark:to-teal-950/30" data-testid="agent-esign-page">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileSignature className="h-8 w-8 text-emerald-600" />
              Document E-Sign
            </h1>
            <p className="text-muted-foreground">
              Send documents for electronic signature to your clients
            </p>
          </div>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setShowNewRequestDialog(true)}
            data-testid="button-new-esign-request"
          >
            <Plus className="h-4 w-4 mr-2" />
            New E-Sign Request
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-800 dark:text-amber-300" data-testid="text-pending-count">
                {pendingRequests.length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300" data-testid="text-completed-count">
                {completedRequests.length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Expired/Declined</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-800 dark:text-red-300" data-testid="text-expired-count">
                {expiredDeclinedRequests.length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Total</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300" data-testid="text-total-count">
                {esignRequests?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>E-Sign Requests</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search documents..." 
                    className="pl-10 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-esign"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => refetchRequests()} data-testid="button-refresh-esign">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <ScrollableTabsList>
                <TabsTrigger value="send" className="gap-2" data-testid="tab-pending">
                  <Clock className="h-4 w-4" />
                  Pending ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2" data-testid="tab-completed">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed ({completedRequests.length})
                </TabsTrigger>
                <TabsTrigger value="expired" className="gap-2" data-testid="tab-expired">
                  <XCircle className="h-4 w-4" />
                  Expired/Declined ({expiredDeclinedRequests.length})
                </TabsTrigger>
              </ScrollableTabsList>

              <TabsContent value="send" className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Signers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests(pendingRequests).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No pending e-sign requests</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests(pendingRequests).map(renderRequestRow)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Signers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests(completedRequests).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No completed documents yet</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests(completedRequests).map(renderRequestRow)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="expired" className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Signers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests(expiredDeclinedRequests).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No expired or declined documents</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests(expiredDeclinedRequests).map(renderRequestRow)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-new-esign">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-emerald-600" />
                New E-Sign Request
              </DialogTitle>
              <DialogDescription>
                Upload a document or select a template to send for electronic signature
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Document Source</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-emerald-400",
                      documentSource === 'upload' && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    )}
                    onClick={() => setDocumentSource('upload')}
                    data-testid="card-source-upload"
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Upload className="h-8 w-8 text-emerald-600 mb-2" />
                      <span className="font-medium">Upload Document</span>
                      <span className="text-xs text-muted-foreground">PDF or DOCX</span>
                    </CardContent>
                  </Card>
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-emerald-400",
                      documentSource === 'template' && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    )}
                    onClick={() => setDocumentSource('template')}
                    data-testid="card-source-template"
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <LayoutTemplate className="h-8 w-8 text-emerald-600 mb-2" />
                      <span className="font-medium">Templates</span>
                    </CardContent>
                  </Card>
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-emerald-400",
                      documentSource === 'recent' && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    )}
                    onClick={() => setDocumentSource('recent')}
                    data-testid="card-source-recent"
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <History className="h-8 w-8 text-emerald-600 mb-2" />
                      <span className="font-medium">Recent</span>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {documentSource === 'upload' && (
                <div className="space-y-4">
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                      isDragActive ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-border hover:border-emerald-400",
                      isUploading && "pointer-events-none opacity-70"
                    )}
                    data-testid="dropzone-upload"
                  >
                    <input {...getInputProps()} data-testid="input-file-upload" />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-12 w-12 text-emerald-600 animate-spin" />
                        <p className="font-medium">Uploading document...</p>
                        <p className="text-sm text-muted-foreground">Please wait while we process your file</p>
                      </div>
                    ) : uploadedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="relative">
                          {uploadedFile.name.toLowerCase().endsWith('.docx') ? (
                            <FileType className="h-8 w-8 text-blue-600" />
                          ) : (
                            <FileText className="h-8 w-8 text-red-600" />
                          )}
                          {uploadedDocumentData && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 absolute -bottom-1 -right-1 bg-background rounded-full" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            {uploadedDocumentData && (
                              <span className="ml-2 text-emerald-600">
                                {uploadedDocumentData.originalFormat === 'docx' 
                                  ? `Converted to ${uploadedDocumentData.convertedFormat}` 
                                  : 'Ready for signing'}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {uploadedDocumentData && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setShowDocumentPreview(true); }}
                                data-testid="button-preview-document"
                                title="Preview Document"
                              >
                                <Eye className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleAnalyzeDocument(); }}
                                disabled={isAnalyzing}
                                data-testid="button-analyze-document"
                                title="AI Analysis"
                              >
                                {isAnalyzing ? (
                                  <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-purple-600" />
                                )}
                              </Button>
                              {showAIPanel && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); setShowAIPanel(!showAIPanel); }}
                                  data-testid="button-toggle-ai-panel"
                                  title="Toggle AI Panel"
                                >
                                  {showAIPanel ? (
                                    <PanelRightClose className="h-4 w-4 text-purple-600" />
                                  ) : (
                                    <PanelRightOpen className="h-4 w-4 text-purple-600" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                            data-testid="button-remove-file"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-1">Drop your document here</p>
                        <p className="text-sm text-muted-foreground">PDF or Word (DOCX) - Max 10MB</p>
                        <p className="text-xs text-muted-foreground mt-2">DOCX files will be converted for viewing in the signing workflow</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {documentSource === 'template' && (
                <div className="space-y-4">
                  <Label>Select Template</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {TEMPLATES.map((template) => (
                      <Card 
                        key={template.id}
                        className={cn(
                          "cursor-pointer transition-all hover:border-emerald-400",
                          selectedTemplate === template.id && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        )}
                        onClick={() => handleSelectTemplate(template.id)}
                        data-testid={`card-template-${template.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <Badge variant="outline" className="mt-2">{template.category}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {documentSource === 'recent' && (
                <div className="space-y-4">
                  <Label>Recent Documents</Label>
                  {completedRequests.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>No recent documents available</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {completedRequests.slice(0, 5).map((req) => (
                        <Card 
                          key={req.id}
                          className="cursor-pointer hover:border-emerald-400"
                          onClick={() => { setDocumentName(req.documentName); setDocumentType(req.documentType); }}
                        >
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-emerald-600" />
                              <div>
                                <p className="font-medium">{req.documentName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(req.createdAt), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentName">Document Name *</Label>
                  <Input 
                    id="documentName"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g., Investment Agreement - Q4 2024"
                    data-testid="input-document-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type *</Label>
                  {/* Inline chips — avoids Radix Select portal z-index/overflow issues inside Dialog */}
                  <div className="flex flex-wrap gap-2" data-testid="select-document-type">
                    {DOCUMENT_TYPES.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setDocumentType(type.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all cursor-pointer ${
                          documentType === type.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'border-border bg-background text-muted-foreground hover:border-emerald-400 hover:text-foreground'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  {!documentType && (
                    <p className="text-xs text-muted-foreground">Select a document type to enable sending</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Signers</Label>
                  <div className="flex gap-2">
                    <Select onValueChange={(clientId) => handleAddSigner(clientId)}>
                      <SelectTrigger className="w-48" data-testid="select-add-client">
                        <SelectValue placeholder="Add from clients" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleAddSigner()}
                      data-testid="button-add-manual-signer"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Manual
                    </Button>
                  </div>
                </div>

                {signers.length === 0 ? (
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>Add at least one signer to continue</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {signers.map((signer, idx) => (
                      <Card key={signer.id} className="bg-muted/30" data-testid={`card-signer-${idx}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center gap-2 pt-2">
                              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline">{signer.order}</Badge>
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Name</Label>
                                <Input 
                                  value={signer.name}
                                  onChange={(e) => handleUpdateSigner(signer.id, 'name', e.target.value)}
                                  placeholder="Full name"
                                  data-testid={`input-signer-name-${idx}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Email</Label>
                                <Input 
                                  type="email"
                                  value={signer.email}
                                  onChange={(e) => handleUpdateSigner(signer.id, 'email', e.target.value)}
                                  placeholder="email@example.com"
                                  data-testid={`input-signer-email-${idx}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Mobile</Label>
                                <Input 
                                  value={signer.mobile}
                                  onChange={(e) => handleUpdateSigner(signer.id, 'mobile', e.target.value)}
                                  placeholder="+91 98765 43210"
                                  data-testid={`input-signer-mobile-${idx}`}
                                />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveSigner(signer.id)}
                              className="text-red-500 hover:text-red-700 dark:text-red-300"
                              data-testid={`button-remove-signer-${idx}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {signers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <MousePointer2 className="h-4 w-4" />
                      Signature Field Placement
                    </Label>
                  </div>
                  <Alert className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                    <MousePointer2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                      Add signature and date fields for each signer. Set X/Y position (percentage from left/top).
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    {signers.map((signer, signerIdx) => {
                      const signerFields = signatureFields.filter(f => f.signerId === signer.id);
                      return (
                        <Card key={signer.id} className="bg-muted/30" data-testid={`card-signer-fields-${signerIdx}`}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">{signer.name || `Signer ${signerIdx + 1}`}</CardTitle>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleAddSignatureField(signer.id, 'signature')}
                                  data-testid={`button-add-signature-${signerIdx}`}
                                >
                                  <FileSignature className="h-3 w-3 mr-1" />
                                  Signature
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleAddSignatureField(signer.id, 'date')}
                                  data-testid={`button-add-date-${signerIdx}`}
                                >
                                  <CalendarDays className="h-3 w-3 mr-1" />
                                  Date
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {signerFields.length > 0 && (
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {signerFields.map((field, fieldIdx) => (
                                  <div key={field.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {field.type}
                                    </Badge>
                                    <div className="flex items-center gap-2 flex-1">
                                      <Label className="text-xs">X:</Label>
                                      <Slider
                                        value={[field.x]}
                                        onValueChange={([v]) => handleUpdateSignatureField(field.id, { x: v })}
                                        max={100}
                                        step={1}
                                        className="w-20"
                                      />
                                      <span className="text-xs w-8">{field.x}%</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                      <Label className="text-xs">Y:</Label>
                                      <Slider
                                        value={[field.y]}
                                        onValueChange={([v]) => handleUpdateSignatureField(field.id, { y: v })}
                                        max={100}
                                        step={1}
                                        className="w-20"
                                      />
                                      <span className="text-xs w-8">{field.y}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-xs">Page:</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={field.page}
                                        onChange={(e) => handleUpdateSignatureField(field.id, { page: parseInt(e.target.value) || 1 })}
                                        className="w-14 h-7 text-xs"
                                      />
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-red-500"
                                      onClick={() => handleRemoveSignatureField(field.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <Label className="text-base font-semibold">Send Options</Label>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-emerald-600" />
                        <div>
                          <Label className="font-medium">Send via Email</Label>
                          <p className="text-xs text-muted-foreground">Send signing link to signer's email</p>
                        </div>
                      </div>
                      <Switch
                        checked={sendOptions.email}
                        onCheckedChange={(checked) => setSendOptions(prev => ({ ...prev, email: checked }))}
                        data-testid="switch-send-email"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        <div>
                          <Label className="font-medium">Send via WhatsApp</Label>
                          <p className="text-xs text-muted-foreground">Send signing link to signer's mobile</p>
                        </div>
                      </div>
                      <Switch
                        checked={sendOptions.whatsapp}
                        onCheckedChange={(checked) => setSendOptions(prev => ({ ...prev, whatsapp: checked }))}
                        data-testid="switch-send-whatsapp"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-blue-600" />
                        <div>
                          <Label className="font-medium">Auto-fill Date Fields</Label>
                          <p className="text-xs text-muted-foreground">Automatically fill date with signing date</p>
                        </div>
                      </div>
                      <Switch
                        checked={sendOptions.autoFillDate}
                        onCheckedChange={(checked) => setSendOptions(prev => ({ ...prev, autoFillDate: checked }))}
                        data-testid="switch-autofill-date"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Pencil className="h-4 w-4 text-violet-600" />
                        <div>
                          <Label className="font-medium">Allow Document Editing</Label>
                          <p className="text-xs text-muted-foreground">Signers can suggest text changes before signing. You approve or reject each suggestion.</p>
                        </div>
                      </div>
                      <Switch
                        checked={allowEditing}
                        onCheckedChange={setAllowEditing}
                        data-testid="switch-allow-editing"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label>Signing Deadline (Expiry Date)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-deadline-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, 'PPP') : 'Select deadline'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={setDeadline}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">Document will expire after this date if not signed</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel-esign">
                Cancel
              </Button>
              <Button 
                onClick={handleSendRequest}
                disabled={
                  initiateESign.isPending ||
                  !documentName ||
                  !documentType ||
                  signers.length === 0 ||
                  // Block if upload source selected, file chosen but upload failed
                  (documentSource === 'upload' && !!uploadedFile && !uploadedDocumentData) ||
                  isUploading ||
                  // Block if editing enabled and there are open (unresolved) corrections
                  (allowEditing && openCorrectionCount > 0)
                }
                title={
                  !documentName ? 'Enter a document name' :
                  !documentType ? 'Select a document type' :
                  signers.length === 0 ? 'Add at least one signer' :
                  (documentSource === 'upload' && !!uploadedFile && !uploadedDocumentData) ? 'Document upload in progress or failed' :
                  (allowEditing && openCorrectionCount > 0) ? `Resolve ${openCorrectionCount} open suggestion(s) before sending` :
                  undefined
                }
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-send-esign"
              >
                {initiateESign.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send for Signature
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl" data-testid="dialog-preview-esign">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                {selectedRequest?.documentName}
              </DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Badge className={cn("gap-1", STATUS_COLORS[selectedRequest.status])}>
                    {(() => {
                      const StatusIcon = STATUS_ICONS[selectedRequest.status];
                      return <StatusIcon className="h-3 w-3" />;
                    })()}
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Created {formatDistanceToNow(new Date(selectedRequest.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Signers
                  </h4>
                  <div className="space-y-2">
                    {selectedRequest.signers.map((signer, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                              {signer.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{signer.name}</p>
                            <p className="text-sm text-muted-foreground">{signer.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={STATUS_COLORS[signer.status]}>
                            {signer.status}
                          </Badge>
                          {signer.signedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Signed {format(new Date(signer.signedAt), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-muted h-64 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Document Preview</p>
                    <p className="text-sm">Preview will be available here</p>
                  </div>
                </div>

                {selectedRequest.status === 'signed' && (
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700" 
                    onClick={() => downloadDocument.mutate(selectedRequest.id)}
                    disabled={downloadDocument.isPending}
                    data-testid="button-download-signed"
                  >
                    {downloadDocument.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Signed Document
                      </>
                    )}
                  </Button>
                )}

                {selectedRequest.status === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex gap-2 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 flex-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Email</span>
                        <Switch 
                          checked={sendOptions.email}
                          onCheckedChange={(checked) => setSendOptions(prev => ({ ...prev, email: checked }))}
                          data-testid="switch-reminder-email"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">WhatsApp</span>
                        <Switch 
                          checked={sendOptions.whatsapp}
                          onCheckedChange={(checked) => setSendOptions(prev => ({ ...prev, whatsapp: checked }))}
                          data-testid="switch-reminder-whatsapp"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={() => sendReminder.mutate(selectedRequest.id)}
                        disabled={sendReminder.isPending || (!sendOptions.email && !sendOptions.whatsapp)}
                        data-testid="button-resend-reminder"
                      >
                        {sendReminder.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Reminder
                          </>
                        )}
                      </Button>
                      <Button variant="destructive" className="flex-1" data-testid="button-cancel-request">
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel Request
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showDocumentPreview} onOpenChange={setShowDocumentPreview}>
          <DialogContent className={cn("max-h-[90vh]", showAIPanel ? "max-w-[95vw]" : "max-w-4xl")} data-testid="dialog-document-preview">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-emerald-600" />
                  Document Preview
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit & Suggest button — visible when document is editable */}
                  {(allowEditing || showSuggestPanel) && (
                    <Button
                      variant={showSuggestPanel ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShowSuggestPanel(!showSuggestPanel);
                        if (showAIPanel) setShowAIPanel(false);
                        if (showSuggestionPopover) setShowSuggestionPopover(false);
                      }}
                      className={showSuggestPanel ? "bg-violet-600 hover:bg-violet-700" : "border-violet-400 text-violet-600 hover:bg-violet-50"}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      {showSuggestPanel ? "Hide Suggestions" : `Edit & Suggest${openCorrectionCount > 0 ? ` (${openCorrectionCount} open)` : ''}`}
                    </Button>
                  )}
                  <Button
                    variant={showAIPanel ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!showAIPanel && !currentDocumentId) {
                        handleAnalyzeDocument();
                      } else {
                        setShowAIPanel(!showAIPanel);
                        if (showSuggestPanel) setShowSuggestPanel(false);
                      }
                    }}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isAnalyzing ? "Analyzing..." : showAIPanel ? "Hide AI Panel" : "AI Analysis"}
                  </Button>
                </div>
              </DialogTitle>
              <DialogDescription>
                {uploadedDocumentData?.fileName} 
                {uploadedDocumentData?.originalFormat === 'docx' && (
                  <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                    Converted from DOCX
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className={cn("flex gap-4", (showAIPanel || showSuggestPanel) && "flex-row")}>
              <div className={cn("flex-1", (showAIPanel || showSuggestPanel) && "w-1/2")}>
                {/* Edit mode hint banner */}
                {showSuggestPanel && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg text-xs text-violet-700 dark:text-violet-400">
                    <Pencil className="h-3 w-3 flex-shrink-0" />
                    <span><strong>Edit mode:</strong> Select any text in the document, then type your proposed replacement. Suggestions must be approved by the agent before the document can be sent for signing.</span>
                  </div>
                )}
                <div
                  className="h-[55vh] overflow-auto border rounded-lg bg-background"
                  onMouseUp={showSuggestPanel ? handleDocumentMouseUp : undefined}
                >
                  {uploadedDocumentData?.convertedFormat === 'html' && uploadedDocumentData?.htmlContent ? (
                    <div
                      className={cn(
                        "p-6 prose dark:prose-invert max-w-none",
                        showSuggestPanel && "select-text cursor-text"
                      )}
                    >
                      {parse(DOMPurify.sanitize(uploadedDocumentData.htmlContent))}
                    </div>
                  ) : uploadedDocumentData?.displayUrl ? (
                    <iframe
                      src={uploadedDocumentData.displayUrl}
                      className="w-full h-full"
                      title="Document Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>Preview not available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating suggestion popover — appears when text is selected in edit mode */}
                {showSuggestPanel && showSuggestionPopover && selectedTextForSuggestion && (
                  <div className="mt-3 border border-violet-300 dark:border-violet-700 rounded-xl bg-white dark:bg-zinc-900 shadow-xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-violet-600" />
                      <span className="font-semibold text-sm">Suggest a Change</span>
                      <button
                        onClick={() => { setShowSuggestionPopover(false); setSelectedTextForSuggestion(''); }}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Original text selected:</Label>
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded text-sm font-mono line-through text-red-700 dark:text-red-400">
                        {selectedTextForSuggestion}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Replace with *</Label>
                      <Textarea
                        placeholder="Type the proposed replacement text…"
                        value={suggestionReplacement}
                        onChange={(e) => setSuggestionReplacement(e.target.value)}
                        className="min-h-[60px] text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Reason / note (optional)</Label>
                      <Input
                        placeholder="e.g. Payment terms should be 15 days, not 30"
                        value={suggestionNote}
                        onChange={(e) => setSuggestionNote(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => submitSuggestion.mutate()}
                        disabled={!suggestionReplacement.trim() || submitSuggestion.isPending}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        {submitSuggestion.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Pencil className="h-3 w-3 mr-1" />}
                        Submit Suggestion
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowSuggestionPopover(false); setSelectedTextForSuggestion(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Analysis OR Suggestion Review panel (right side) */}
              {(showAIPanel || showSuggestPanel) && currentDocumentId && (
                <div className="w-1/2">
                  <DocumentAnnotationsPanel
                    documentId={currentDocumentId}
                    userName="Current Agent"
                    userType="agent"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SigningMethodSelector
                  selectedMethod={selectedSigningMethod}
                  onSelect={setSelectedSigningMethod}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDocumentPreview(false)}>
                  Close
                </Button>
                {uploadedDocumentData?.originalUrl && (
                  <Button 
                    variant="outline"
                    onClick={() => window.open(uploadedDocumentData.originalUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Original
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
