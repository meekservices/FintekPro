import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, FileText, File, X, CheckCircle, AlertTriangle, 
  FileType, Download, Eye 
} from 'lucide-react';

interface DocumentUploaderProps {
  proposalId: string;
  workflowId?: string;
  onUploadSuccess?: (document: UploadedDocument) => void;
  onUploadError?: (error: string) => void;
  allowedTypes?: string[];
  maxSizeMB?: number;
}

interface UploadedDocument {
  originalUrl: string;
  displayUrl: string;
  documentHash: string;
  originalFormat: string;
  convertedFormat: string;
  fileName: string;
  htmlContent?: string;
}

export default function DocumentUploader({
  proposalId,
  workflowId,
  onUploadSuccess,
  onUploadError,
  allowedTypes = ['.docx', '.doc', '.pdf'],
  maxSizeMB = 10,
}: DocumentUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('proposalId', proposalId);
      if (workflowId) {
        formData.append('workflowId', workflowId);
      }

      setUploadProgress(10);

      const response = await fetch('/api/documents/upload/for-signing', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      setUploadProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      setUploadProgress(100);
      return response.json();
    },
    onSuccess: (data) => {
      const doc = {
        ...data.document,
        fileName: selectedFile?.name || 'document',
      };
      setUploadedDoc(doc);
      toast({ title: 'Document uploaded successfully' });
      onUploadSuccess?.(doc);
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      onUploadError?.(error.message);
      setUploadProgress(0);
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      toast({
        title: 'Invalid file type',
        description: `Only ${allowedTypes.join(', ')} files are allowed`,
        variant: 'destructive',
      });
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${maxSizeMB}MB`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setUploadedDoc(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadedDoc(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-8 w-8 text-red-500" />;
    if (ext === 'docx' || ext === 'doc') return <FileType className="h-8 w-8 text-blue-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Document for Signing
        </CardTitle>
        <CardDescription>
          Upload a Word document (.docx, .doc) or PDF for the signature workflow. 
          Documents will be converted to a signable format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedFile && !uploadedDoc && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drag and drop your document here
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept={allowedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              id="document-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <div className="mt-4 flex justify-center gap-2">
              {allowedTypes.map((type) => (
                <Badge key={type} variant="secondary">
                  {type.toUpperCase()}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Max file size: {maxSizeMB}MB
            </p>
          </div>
        )}

        {selectedFile && !uploadedDoc && (
          <div className="border rounded-lg p-4">
            <div className="flex items-start gap-4">
              {getFileIcon(selectedFile.name)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                disabled={uploadMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {uploadMutation.isPending && (
              <div className="mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {!uploadMutation.isPending && (
              <div className="mt-4 flex gap-2">
                <Button onClick={handleUpload} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                <Button variant="outline" onClick={handleRemove}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {uploadedDoc && (
          <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Document uploaded successfully!</p>
                  <p className="text-sm">
                    {uploadedDoc.fileName} ({uploadedDoc.originalFormat.toUpperCase()})
                  </p>
                  <p className="text-xs mt-1 font-mono">
                    Hash: {uploadedDoc.documentHash.substring(0, 16)}...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleRemove}>
                    Upload Different
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {uploadMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {uploadMutation.error?.message || 'Failed to upload document'}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium">Supported formats:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>.docx</strong> - Microsoft Word documents (converted to viewable format for signing)</li>
            <li><strong>.pdf</strong> - PDF documents (ready for signing)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
