import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DocumentUploadFieldProps {
  documentType: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
  onUploadComplete: (documentData: any) => void;
  onRemove?: (documentId: string) => void;
  existingDocuments?: any[];
  applicationId?: string;
  accept?: string;
}

interface UploadResponse {
  success: boolean;
  data: {
    uploadUrl: string;
    method: string;
  };
}

interface DocumentRecord {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  uploadedAt: string;
}

export function DocumentUploadField({
  documentType,
  label,
  required = false,
  multiple = false,
  onUploadComplete,
  onRemove,
  existingDocuments = [],
  applicationId,
  accept = "image/*,.pdf"
}: DocumentUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Step 1: Get upload URL
      const uploadUrlRes = await apiRequest("GET", "/api/partner-applications/upload-url");
      const uploadUrlData = await uploadUrlRes.json() as UploadResponse;
      const { uploadUrl } = uploadUrlData.data;

      // Step 2: Upload file to object storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Step 3: Associate document with application (if we have an application ID)
      if (applicationId) {
        const documentRes = await apiRequest("POST", `/api/partner-applications/${applicationId}/documents`, {
          body: {
            documentType,
            fileName: file.name,
            fileSize: file.size,
            uploadedUrl: uploadUrl,
            mimeType: file.type
          }
        });
        const documentData = await documentRes.json() as { success: boolean; data: DocumentRecord };
        return documentData.data;
      } else {
        // Return temporary document data if no application ID yet
        return {
          id: crypto.randomUUID(),
          documentType,
          fileName: file.name,
          fileSize: file.size,
          filePath: uploadUrl,
          uploadedAt: new Date().toISOString(),
          tempFile: true // Mark as temporary
        };
      }
    },
    onSuccess: (documentRecord) => {
      // Invalidate the documents cache to trigger refetch
      if (applicationId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/partner-applications', applicationId, 'documents'] 
        });
      }
      onUploadComplete(documentRecord);
      toast({
        title: "Upload successful",
        description: `${documentRecord.fileName} has been uploaded successfully.`
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!applicationId) {
        throw new Error("Cannot delete document without application ID");
      }
      
      const response = await apiRequest("DELETE", `/api/partner-applications/${applicationId}/documents/${documentId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to delete document");
      }
      
      return result;
    },
    onSuccess: () => {
      // Invalidate the documents cache to trigger refetch
      if (applicationId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/partner-applications', applicationId, 'documents'] 
        });
      }
      toast({
        title: "Document deleted",
        description: "Document has been removed successfully."
      });
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      if (multiple) {
        // Handle multiple file uploads
        for (const file of Array.from(files)) {
          await uploadMutation.mutateAsync(file);
        }
      } else {
        // Handle single file upload
        await uploadMutation.mutateAsync(files[0]);
      }
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setIsUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    // Check if this is a temporary document (not yet associated with application)
    const doc = existingDocuments.find(d => d.id === documentId);
    if (doc?.tempFile) {
      // For temporary documents, just call the onRemove prop
      if (onRemove) {
        onRemove(documentId);
      }
      return;
    }

    // For persisted documents, use the delete mutation
    if (applicationId) {
      try {
        await deleteMutation.mutateAsync(documentId);
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    } else if (onRemove) {
      // Fallback to prop if no applicationId
      onRemove(documentId);
    }
  };

  return (
    <div className="space-y-3" data-testid={`document-upload-${documentType}`}>
      <label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Upload Zone */}
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-muted-foreground transition-colors relative">
        {isUploading && (
          <div className="absolute inset-0 bg-card/80 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </div>
          </div>
        )}
        
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          Click to upload {label.toLowerCase()}
        </p>
        
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
          data-testid={`input-${documentType}`}
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          className="pointer-events-none"
        >
          Choose Files
        </Button>
      </div>

      {/* Uploaded Documents List */}
      {existingDocuments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Uploaded Documents:</h4>
          {existingDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDocument(doc.id)}
                  className="h-8 w-8 p-0"
                  disabled={deleteMutation.isPending}
                  data-testid={`remove-document-${doc.id}`}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}