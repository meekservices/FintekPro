import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { X, Upload, File, CheckCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { uploadURL: string; file: File }) => void;
  buttonClassName?: string;
  children: ReactNode;
  acceptedTypes?: string[];
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadURL?: string;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management with progress tracking and status display.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - File selection with drag and drop support
 * - Upload progress tracking
 * - File type and size validation
 * - Error handling and display
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  acceptedTypes = [],
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`;
    }
    if (acceptedTypes.length > 0 && !acceptedTypes.some(type => file.type.startsWith(type))) {
      return `File type not accepted. Allowed types: ${acceptedTypes.join(', ')}`;
    }
    return null;
  };

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const currentFileCount = uploadFiles.length;
    
    if (currentFileCount + fileArray.length > maxNumberOfFiles) {
      alert(`Maximum ${maxNumberOfFiles} file(s) allowed`);
      return;
    }

    const newFiles: UploadFile[] = fileArray.map(file => {
      const error = validateFile(file);
      return {
        file,
        id: generateFileId(),
        status: error ? 'error' as const : 'pending' as const,
        progress: 0,
        error: error || undefined
      };
    });

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const uploadFile = async (uploadFile: UploadFile) => {
    try {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      const uploadParams = await onGetUploadParameters();
      
      const xhr = new XMLHttpRequest();
      
      return new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, progress } : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const uploadURL = uploadParams.url;
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100, uploadURL } : f
            ));
            onComplete?.({ uploadURL, file: uploadFile.file });
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        xhr.open(uploadParams.method, uploadParams.url);
        xhr.send(uploadFile.file);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'error', error: errorMessage } : f
      ));
      throw error;
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      try {
        await uploadFile(file);
      } catch (error) {
        console.error(`Failed to upload ${file.file.name}:`, error);
      }
    }
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setUploadFiles([]);
  };

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
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const completedUploads = uploadFiles.filter(f => f.status === 'completed').length;
  const hasErrors = uploadFiles.some(f => f.status === 'error');
  const isUploading = uploadFiles.some(f => f.status === 'uploading');

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogTrigger asChild>
        <Button className={buttonClassName} data-testid="button-upload-trigger">
          {children}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-border hover:border-muted-foreground'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Maximum {maxNumberOfFiles} file(s), up to {formatFileSize(maxFileSize)} each
              </p>
              <Input
                type="file"
                multiple={maxNumberOfFiles > 1}
                accept={acceptedTypes.join(',')}
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                className="hidden"
                id="file-input"
                data-testid="input-file-upload"
              />
              <label htmlFor="file-input">
                <Button variant="outline" className="cursor-pointer" data-testid="button-browse-files">
                  Browse Files
                </Button>
              </label>
            </div>
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-2 border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Files ({uploadFiles.length})</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={isUploading}
                  data-testid="button-clear-all"
                >
                  Clear All
                </Button>
              </div>

              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg bg-muted"
                  data-testid={`file-item-${uploadFile.id}`}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(uploadFile.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-filename-${uploadFile.id}`}>
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                    {uploadFile.status === 'uploading' && (
                      <Progress value={uploadFile.progress} className="mt-1 h-2" />
                    )}
                    {uploadFile.error && (
                      <p className="text-xs text-red-500 mt-1" data-testid={`text-error-${uploadFile.id}`}>
                        {uploadFile.error}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    disabled={uploadFile.status === 'uploading'}
                    data-testid={`button-remove-${uploadFile.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {uploadFiles.length > 0 && (
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {completedUploads > 0 && (
                  <span className="text-green-600">
                    {completedUploads} of {uploadFiles.length} completed
                  </span>
                )}
                {hasErrors && (
                  <span className="text-red-600 ml-2">
                    Some uploads failed
                  </span>
                )}
              </div>
              
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  data-testid="button-close-modal"
                >
                  Close
                </Button>
                <Button
                  onClick={handleUploadAll}
                  disabled={isUploading || !uploadFiles.some(f => f.status === 'pending')}
                  data-testid="button-upload-all"
                >
                  {isUploading ? 'Uploading...' : 'Upload All'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}