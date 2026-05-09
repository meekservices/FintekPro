import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SignatureCanvas, SignatureData } from './SignatureCanvas';
import { 
  PenTool, 
  Plus, 
  Trash2, 
  Star, 
  StarOff,
  Upload,
  Type,
  Edit2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserSignature {
  id: string;
  userId: string;
  name: string;
  signatureType: 'upload' | 'draw' | 'type';
  signatureDataUrl: string;
  fontFamily?: string;
  typedText?: string;
  width?: number;
  height?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SignatureManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSignature, setEditingSignature] = useState<UserSignature | null>(null);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; signatures: UserSignature[] }>({
    queryKey: ['/api/user/signatures'],
  });

  const signatures = data?.signatures || [];

  const createMutation = useMutation({
    mutationFn: async (payload: { 
      name: string; 
      signatureType: string;
      signatureDataUrl: string;
      fontFamily?: string;
      typedText?: string;
      width?: number;
      height?: number;
      setAsDefault?: boolean;
    }) => {
      return apiRequest('/api/user/signatures', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/signatures'] });
      setShowCreateDialog(false);
      setNewName('');
      toast({
        title: "Signature Created",
        description: "Your signature has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create signature",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/user/signatures/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/signatures'] });
      toast({
        title: "Signature Deleted",
        description: "The signature has been removed.",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/user/signatures/${id}/set-default`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/signatures'] });
      toast({
        title: "Default Updated",
        description: "This signature will now be used by default.",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest(`/api/user/signatures/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/signatures'] });
      setEditingSignature(null);
      setNewName('');
      toast({
        title: "Renamed",
        description: "Signature name updated.",
      });
    },
  });

  const handleSaveSignature = (signatureData: SignatureData) => {
    const name = newName.trim() || `${signatureData.type === 'upload' ? 'Uploaded' : signatureData.type === 'draw' ? 'Drawn' : 'Typed'} Signature`;
    
    createMutation.mutate({
      name,
      signatureType: signatureData.type,
      signatureDataUrl: signatureData.dataUrl,
      fontFamily: signatureData.fontFamily,
      typedText: signatureData.typedText,
      width: signatureData.width,
      height: signatureData.height,
      setAsDefault: signatures.length === 0,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'draw':
        return <PenTool className="h-4 w-4" />;
      case 'type':
        return <Type className="h-4 w-4" />;
      default:
        return <PenTool className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5" />
            My Signatures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                My Signatures
              </CardTitle>
              <CardDescription>
                Create and manage your signatures for document signing
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Signature
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <Alert>
              <PenTool className="h-4 w-4" />
              <AlertDescription>
                You haven't created any signatures yet. Click "Add Signature" to create your first one.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {signatures.map((sig) => (
                <Card key={sig.id} className="relative">
                  <CardContent className="pt-4">
                    <div className="absolute top-2 right-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingSignature(sig);
                              setNewName(sig.name);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          {!sig.isDefault && (
                            <DropdownMenuItem
                              onClick={() => setDefaultMutation.mutate(sig.id)}
                            >
                              <Star className="h-4 w-4 mr-2" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(sig.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      {getTypeIcon(sig.signatureType)}
                      <span className="font-medium text-sm truncate">{sig.name}</span>
                      {sig.isDefault && (
                        <Badge variant="secondary" className="ml-auto">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>

                    <div className="border rounded-lg p-2 bg-background flex items-center justify-center min-h-[80px]">
                      <img 
                        src={sig.signatureDataUrl} 
                        alt={sig.name}
                        className="max-w-full max-h-[70px] object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span className="capitalize">{sig.signatureType}</span>
                      <span>{new Date(sig.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Signature</DialogTitle>
            <DialogDescription>
              Draw, upload, or type your signature to use for document signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Signature Name (optional)</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., My Primary Signature"
                className="mt-1"
              />
            </div>
            <SignatureCanvas
              onSave={handleSaveSignature}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSignature} onOpenChange={() => setEditingSignature(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingSignature(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (editingSignature && newName.trim()) {
                    renameMutation.mutate({ id: editingSignature.id, name: newName.trim() });
                  }
                }}
                disabled={!newName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
