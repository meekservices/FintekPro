import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from '@/components/ScrollableTabsList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, 
  PenTool, 
  Type, 
  Trash2, 
  Check, 
  RotateCcw,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

export type SignatureType = 'upload' | 'draw' | 'type';

export interface SignatureData {
  type: SignatureType;
  dataUrl: string;
  fontFamily?: string;
  typedText?: string;
  width: number;
  height: number;
}

interface SignatureCanvasProps {
  onSave: (signature: SignatureData) => void;
  onCancel?: () => void;
  defaultName?: string;
  maxWidth?: number;
  maxHeight?: number;
}

const SIGNATURE_FONTS = [
  { value: 'cursive', label: 'Cursive', style: 'cursive' },
  { value: 'dancing-script', label: 'Dancing Script', style: '"Dancing Script", cursive' },
  { value: 'great-vibes', label: 'Great Vibes', style: '"Great Vibes", cursive' },
  { value: 'pacifico', label: 'Pacifico', style: '"Pacifico", cursive' },
  { value: 'sacramento', label: 'Sacramento', style: '"Sacramento", cursive' },
  { value: 'allura', label: 'Allura', style: '"Allura", cursive' },
];

export function SignatureCanvas({ 
  onSave, 
  onCancel,
  defaultName = '',
  maxWidth = 400,
  maxHeight = 150
}: SignatureCanvasProps) {
  const [activeTab, setActiveTab] = useState<SignatureType>('draw');
  const [signatureName, setSignatureName] = useState(defaultName);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState('cursive');
  const typedCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG, JPG, or GIF)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          setUploadedImage(canvas.toDataURL('image/png'));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [maxWidth, maxHeight]);

  useEffect(() => {
    if (!typedText || activeTab !== 'type') return;

    const canvas = typedCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fontConfig = SIGNATURE_FONTS.find(f => f.value === selectedFont);
    const fontSize = 48;

    ctx.font = `${fontSize}px ${fontConfig?.style || 'cursive'}`;
    const textMetrics = ctx.measureText(typedText);
    const textWidth = Math.min(textMetrics.width + 40, maxWidth);
    const textHeight = fontSize + 40;

    canvas.width = textWidth;
    canvas.height = textHeight;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px ${fontConfig?.style || 'cursive'}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(typedText, canvas.width / 2, canvas.height / 2);
  }, [typedText, selectedFont, activeTab, maxWidth]);

  const handleSave = useCallback(() => {
    let signatureData: SignatureData | null = null;

    switch (activeTab) {
      case 'draw': {
        const canvas = canvasRef.current;
        if (canvas && hasDrawn) {
          signatureData = {
            type: 'draw',
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          };
        }
        break;
      }
      case 'upload': {
        if (uploadedImage) {
          const img = new Image();
          img.src = uploadedImage;
          signatureData = {
            type: 'upload',
            dataUrl: uploadedImage,
            width: img.width || maxWidth,
            height: img.height || maxHeight,
          };
        }
        break;
      }
      case 'type': {
        const canvas = typedCanvasRef.current;
        if (canvas && typedText) {
          signatureData = {
            type: 'type',
            dataUrl: canvas.toDataURL('image/png'),
            fontFamily: selectedFont,
            typedText: typedText,
            width: canvas.width,
            height: canvas.height,
          };
        }
        break;
      }
    }

    if (signatureData) {
      onSave(signatureData);
    }
  }, [activeTab, hasDrawn, uploadedImage, typedText, selectedFont, onSave, maxWidth, maxHeight]);

  const canSave = () => {
    switch (activeTab) {
      case 'draw':
        return hasDrawn;
      case 'upload':
        return !!uploadedImage;
      case 'type':
        return typedText.trim().length > 0;
      default:
        return false;
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Create Signature
        </CardTitle>
        <CardDescription>
          Draw, upload, or type your signature
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SignatureType)}>
          <ScrollableTabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw" className="flex items-center gap-1">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Draw</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-1">
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Type</span>
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="draw" className="space-y-3">
            <div className="border rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={maxWidth}
                height={maxHeight}
                className="w-full cursor-crosshair touch-none"
                style={{ maxWidth: `${maxWidth}px` }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <p className="text-sm text-muted-foreground">
                Draw your signature above
              </p>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            
            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            {uploadedImage ? (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-white flex items-center justify-center">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded signature" 
                    className="max-w-full max-h-32 object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setUploadedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload signature image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG or GIF (max 5MB)
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Type your name"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Font Style</Label>
              <Select value={selectedFont} onValueChange={setSelectedFont}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNATURE_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.style }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {typedText && (
              <div className="border rounded-lg p-4 bg-white">
                <canvas
                  ref={typedCanvasRef}
                  className="mx-auto"
                  style={{ maxWidth: '100%' }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!canSave()}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Save Signature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
