import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/contexts/theme-context";
import { 
  Sun, Moon, Monitor, Palette, Clock, Sparkles, Save,
  Accessibility, Contrast, Type, Eye, RotateCcw
} from "lucide-react";

interface ThemePrefs {
  themeMode: string;
  autoSwitchEnabled: boolean;
  lightModeStart: string;
  darkModeStart: string;
}

export default function ThemeSettings() {
  const { theme, setTheme, accessibility, setAccessibility } = useTheme();
  const { toast } = useToast();
  
  const [prefs, setPrefs] = useState<ThemePrefs>({
    themeMode: theme,
    autoSwitchEnabled: false,
    lightModeStart: "07:00",
    darkModeStart: "19:00",
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data } = useQuery<{ success: boolean; preferences: ThemePrefs }>({
    queryKey: ["/api/features/theme"]
  });

  useEffect(() => {
    if (data?.preferences) {
      setPrefs(data.preferences);
    }
  }, [data]);

  useEffect(() => {
    if (prefs.autoSwitchEnabled) {
      const checkTime = () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (currentTime >= prefs.lightModeStart && currentTime < prefs.darkModeStart) {
          if (theme !== 'light') setTheme('light');
        } else {
          if (theme !== 'dark') setTheme('dark');
        }
      };
      
      checkTime();
      const interval = setInterval(checkTime, 60000);
      return () => clearInterval(interval);
    }
  }, [prefs.autoSwitchEnabled, prefs.lightModeStart, prefs.darkModeStart, theme, setTheme]);

  const saveMutation = useMutation({
    mutationFn: async (prefs: ThemePrefs) => {
      return apiRequest("/api/features/theme", {
        method: "PUT",
        body: JSON.stringify(prefs)
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Your theme preferences have been saved." });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/features/theme"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
    }
  });

  const updatePrefs = (updates: Partial<ThemePrefs>) => {
    setPrefs({ ...prefs, ...updates });
    setHasChanges(true);
  };

  const handleThemeChange = (newTheme: string) => {
    updatePrefs({ themeMode: newTheme, autoSwitchEnabled: false });
    setTheme(newTheme as 'light' | 'dark' | 'system');
  };

  const handleSave = () => {
    saveMutation.mutate(prefs);
  };

  const handleResetAccessibility = () => {
    setAccessibility({
      textBrightness: 50,
      textSize: "medium",
      reduceTransparency: false,
      highContrast: false,
      reducedMotion: false,
    });
    toast({ title: "Reset", description: "Accessibility settings restored to defaults." });
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Palette className="h-8 w-8 text-primary" />
            Theme Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Customize your visual experience
          </p>
        </div>
        
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending} data-testid="save-theme-btn">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Choose your preferred color scheme</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={prefs.themeMode} 
              onValueChange={handleThemeChange}
              className="grid grid-cols-3 gap-4"
            >
              <Label 
                htmlFor="light" 
                className={`flex flex-col items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${prefs.themeMode === 'light' ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem value="light" id="light" className="sr-only" />
                <Sun className="h-8 w-8" />
                <span className="font-medium">Light</span>
              </Label>
              
              <Label 
                htmlFor="dark" 
                className={`flex flex-col items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${prefs.themeMode === 'dark' ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem value="dark" id="dark" className="sr-only" />
                <Moon className="h-8 w-8" />
                <span className="font-medium">Dark</span>
              </Label>
              
              <Label 
                htmlFor="system" 
                className={`flex flex-col items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${prefs.themeMode === 'system' ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem value="system" id="system" className="sr-only" />
                <Monitor className="h-8 w-8" />
                <span className="font-medium">System</span>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Auto-Switch Theme
            </CardTitle>
            <CardDescription>Automatically change theme based on time of day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Auto-Switch</Label>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode automatically</p>
              </div>
              <Switch 
                checked={prefs.autoSwitchEnabled}
                onCheckedChange={(v) => updatePrefs({ autoSwitchEnabled: v })}
                data-testid="auto-switch-toggle"
              />
            </div>
            
            {prefs.autoSwitchEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light Mode Starts
                  </Label>
                  <Input
                    type="time"
                    value={prefs.lightModeStart}
                    onChange={(e) => updatePrefs({ lightModeStart: e.target.value })}
                    data-testid="light-start-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark Mode Starts
                  </Label>
                  <Input
                    type="time"
                    value={prefs.darkModeStart}
                    onChange={(e) => updatePrefs({ darkModeStart: e.target.value })}
                    data-testid="dark-start-input"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Accessibility className="h-5 w-5" />
                  Accessibility
                </CardTitle>
                <CardDescription>Adjust visual settings for better accessibility</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleResetAccessibility}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base flex items-center gap-2 mb-3">
                  <Type className="h-4 w-4" />
                  Text Brightness
                </Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-12">Dark</span>
                  <Slider
                    value={[accessibility.textBrightness]}
                    onValueChange={(v) => setAccessibility({ textBrightness: v[0] })}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                    data-testid="text-brightness-slider"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">Light</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Adjust the brightness of text across the interface</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="text-base flex items-center gap-2 mb-3">
                <Type className="h-4 w-4" />
                Text Size
              </Label>
              <RadioGroup 
                value={accessibility.textSize} 
                onValueChange={(v) => setAccessibility({ textSize: v as 'small' | 'medium' | 'large' })}
                className="grid grid-cols-3 gap-3"
              >
                <Label 
                  htmlFor="text-small" 
                  className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${accessibility.textSize === 'small' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="small" id="text-small" className="sr-only" />
                  <span className="text-sm">Aa</span>
                  <span className="text-xs">Small</span>
                </Label>
                
                <Label 
                  htmlFor="text-medium" 
                  className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${accessibility.textSize === 'medium' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="medium" id="text-medium" className="sr-only" />
                  <span className="text-base">Aa</span>
                  <span className="text-xs">Medium</span>
                </Label>
                
                <Label 
                  htmlFor="text-large" 
                  className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${accessibility.textSize === 'large' ? 'border-primary bg-primary/5' : ''}`}
                >
                  <RadioGroupItem value="large" id="text-large" className="sr-only" />
                  <span className="text-lg">Aa</span>
                  <span className="text-xs">Large</span>
                </Label>
              </RadioGroup>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-base flex items-center gap-2">
                  <Contrast className="h-4 w-4" />
                  High Contrast
                </Label>
                <p className="text-sm text-muted-foreground">Increase color contrast for better visibility</p>
              </div>
              <Switch 
                checked={accessibility.highContrast}
                onCheckedChange={(v) => setAccessibility({ highContrast: v })}
                data-testid="high-contrast-toggle"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Reduce Transparency
                </Label>
                <p className="text-sm text-muted-foreground">Use solid backgrounds instead of transparent ones</p>
              </div>
              <Switch 
                checked={accessibility.reduceTransparency}
                onCheckedChange={(v) => setAccessibility({ reduceTransparency: v })}
                data-testid="reduce-transparency-toggle"
              />
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-base">Reduced Motion</Label>
                <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
              </div>
              <Switch 
                checked={accessibility.reducedMotion}
                onCheckedChange={(v) => setAccessibility({ reducedMotion: v })}
                data-testid="reduced-motion-toggle"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
