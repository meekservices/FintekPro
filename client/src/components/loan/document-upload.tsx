import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  FileText,
  FileImage,
  File,
  Check,
  AlertCircle,
  Camera,
  Shield as LucideShield,
  HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentType {
  id: string;
  label: string;
  description: string;
  required: boolean;
  acceptedTypes: string[];
  maxSizeMB: number;
  examples?: string[];
}

interface UploadedDocument {
  id: string;
  documentTypeId: string;
  file: File;
  previewUrl?: string;
  status: "pending" | "uploaded" | "error";
  errorMessage?: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: "income_proof",
    label: "Income Proof",
    description: "Salary slips, bank statements, or ITR",
    required: true,
    acceptedTypes: [".pdf", ".jpg", ".jpeg", ".png"],
    maxSizeMB: 5,
    examples: ["Latest 3 months salary slips", "Bank statement (6 months)", "ITR acknowledgment"]
  },
  {
    id: "identity_proof",
    label: "Identity Proof",
    description: "Aadhaar, PAN, or Passport",
    required: true,
    acceptedTypes: [".pdf", ".jpg", ".jpeg", ".png"],
    maxSizeMB: 5,
    examples: ["Aadhaar card (front & back)", "PAN card", "Passport first page"]
  },
  {
    id: "address_proof",
    label: "Address Proof",
    description: "Utility bill, rent agreement, or Aadhaar",
    required: true,
    acceptedTypes: [".pdf", ".jpg", ".jpeg", ".png"],
    maxSizeMB: 5,
    examples: ["Electricity/Gas bill (< 3 months)", "Rent agreement", "Aadhaar with current address"]
  },
  {
    id: "photo",
    label: "Passport Photo",
    description: "Recent passport-sized photograph",
    required: false,
    acceptedTypes: [".jpg", ".jpeg", ".png"],
    maxSizeMB: 2,
    examples: ["Recent color photo with white background"]
  },
  {
    id: "property_docs",
    label: "Property Documents",
    description: "For home/property loans only",
    required: false,
    acceptedTypes: [".pdf"],
    maxSizeMB: 10,
    examples: ["Sale deed", "Property registration", "Building plan approval"]
  }
];

function getFileIcon(file: File) {
  const type = file.type;
  if (type.startsWith("image/")) {
    return <FileImage className="h-5 w-5 text-blue-500" />;
  }
  if (type === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface DocumentUploadCardProps {
  docType: DocumentType;
  documents: UploadedDocument[];
  onUpload: (docTypeId: string, files: FileList) => void;
  onRemove: (docId: string) => void;
}

function DocumentUploadCard({ docType, documents, onUpload, onRemove }: DocumentUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadedDocs = documents.filter(d => d.documentTypeId === docType.id);
  const hasUploaded = uploadedDocs.length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onUpload(docType.id, e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(docType.id, e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all",
        isDragging ? "border-blue-500 bg-blue-500/10" : "border-border",
        hasUploaded ? "bg-green-500/10 border-green-500/30" : ""
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{docType.label}</span>
          {docType.required ? (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
              Required
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Optional
            </Badge>
          )}
          {hasUploaded && (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Accepted examples:</p>
              <ul className="text-xs space-y-1">
                {docType.examples?.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Max size: {docType.maxSizeMB} MB | Types: {docType.acceptedTypes.join(", ")}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{docType.description}</p>

      {uploadedDocs.map((doc) => (
        <div
          key={doc.id}
          className={cn(
            "flex items-center gap-3 p-2 rounded-md mb-2",
            doc.status === "error" ? "bg-red-500/10" : "bg-muted"
          )}
        >
          {doc.previewUrl ? (
            <img
              src={doc.previewUrl}
              alt={doc.file.name}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            getFileIcon(doc.file)
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(doc.file.size)}</p>
            {doc.status === "error" && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {doc.errorMessage}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
            onClick={() => onRemove(doc.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept={docType.acceptedTypes.join(",")}
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full mt-2"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload {docType.label}
      </Button>
    </div>
  );
}

interface LoanDocumentUploadProps {
  loanType: "personal" | "home" | "car" | "business" | "education" | "gold" | "lap";
  documents: UploadedDocument[];
  onDocumentsChange: (docs: UploadedDocument[]) => void;
}

export function LoanDocumentUpload({ loanType, documents, onDocumentsChange }: LoanDocumentUploadProps) {
  const filteredDocTypes = DOCUMENT_TYPES.filter(dt => {
    if (dt.id === "property_docs") {
      return loanType === "home";
    }
    return true;
  });

  const handleUpload = (docTypeId: string, files: FileList) => {
    const docType = DOCUMENT_TYPES.find(d => d.id === docTypeId);
    if (!docType) return;

    const newDocs: UploadedDocument[] = [];

    Array.from(files).forEach(file => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const sizeMB = file.size / (1024 * 1024);

      let status: "pending" | "uploaded" | "error" = "pending";
      let errorMessage: string | undefined;

      if (!docType.acceptedTypes.includes(ext)) {
        status = "error";
        errorMessage = `Invalid file type. Accepted: ${docType.acceptedTypes.join(", ")}`;
      } else if (sizeMB > docType.maxSizeMB) {
        status = "error";
        errorMessage = `File too large. Max size: ${docType.maxSizeMB} MB`;
      } else {
        status = "uploaded";
      }

      const doc: UploadedDocument = {
        id: crypto.randomUUID(),
        documentTypeId: docTypeId,
        file,
        status,
        errorMessage,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
      };

      newDocs.push(doc);
    });

    onDocumentsChange([...documents, ...newDocs]);
  };

  const handleRemove = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc?.previewUrl) {
      URL.revokeObjectURL(doc.previewUrl);
    }
    onDocumentsChange(documents.filter(d => d.id !== docId));
  };

  const requiredDocs = filteredDocTypes.filter(d => d.required);
  const uploadedRequiredCount = requiredDocs.filter(dt =>
    documents.some(d => d.documentTypeId === dt.id && d.status === "uploaded")
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LucideShield className="h-5 w-5 text-blue-600" />
            Supporting Documents
          </CardTitle>
          <Badge
            variant={uploadedRequiredCount === requiredDocs.length ? "default" : "secondary"}
            className={uploadedRequiredCount === requiredDocs.length ? "bg-green-600" : ""}
          >
            {uploadedRequiredCount}/{requiredDocs.length} Required
          </Badge>
        </div>
        <CardDescription>
          Upload clear, legible copies of your documents to speed up verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocTypes.map(docType => (
            <DocumentUploadCard
              key={docType.id}
              docType={docType}
              documents={documents}
              onUpload={handleUpload}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Camera className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Tips for better uploads:</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>Ensure documents are clearly visible and not blurred</li>
              <li>All four corners should be visible in the image</li>
              <li>Avoid glare and shadows on the document</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { UploadedDocument, DocumentType };
