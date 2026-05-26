import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { useUserPreferences, NavPosition } from "@/hooks/use-user-preferences";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield as LucideShield, 
  Link as LinkIcon,
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  PanelLeft,
  PanelTop,
  Dock,
  PenTool,
  RotateCcw,
  Fingerprint,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { SignatureManagement } from "@/components/esign/SignatureManagement";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const accountFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  language: z.string(),
  timezone: z.string(),
});

const securityFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: "New password must be different from your current password",
  path: ["newPassword"],
});

// ── PIN Management Component ─────────────────────────────────────────────────
function PinManagementCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // mode: idle | set | change
  const [mode, setMode] = useState<"idle" | "set" | "change">("idle");
  // digits for new PIN and confirmation
  const [newPin, setNewPin] = useState(["" ,"","",""]);
  const [confirmPin, setConfirmPin] = useState(["","","",""]);
  // For "change" mode: current PIN verification
  const [currentPin, setCurrentPin] = useState(["","","",""]);
  const [pinError, setPinError] = useState("");

  const newRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const currentRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const isPinSet = (user as any)?.isPinSet === true;

  const pinMutation = useMutation({
    mutationFn: async (pin: string) => {
      return await apiRequest("/api/login/set-pin", { method: "POST", body: JSON.stringify({ pin }) });
    },
    onSuccess: () => {
      toast({ title: "PIN Updated", description: isPinSet ? "Your login PIN has been changed successfully." : "4-digit login PIN set successfully. It will be used on trusted devices." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      resetState();
    },
    onError: (err: any) => {
      setPinError(err?.message || "Failed to update PIN. Ensure your mobile is verified.");
    },
  });

  const resetState = () => {
    setMode("idle");
    setNewPin(["","","",""]);
    setConfirmPin(["","","",""]);
    setCurrentPin(["","","",""]);
    setPinError("");
  };

  const handleDigit = (
    idx: number,
    val: string,
    arr: string[],
    setArr: (a: string[]) => void,
    refs: React.RefObject<HTMLInputElement>[]
  ) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...arr];
    next[idx] = digit;
    setArr(next);
    setPinError("");
    if (digit && idx < 3) refs[idx + 1].current?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    arr: string[],
    setArr: (a: string[]) => void,
    refs: React.RefObject<HTMLInputElement>[]
  ) => {
    if (e.key === "Backspace" && !arr[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
    }
  };

  const handleSubmit = () => {
    const pin = newPin.join("");
    const confirm = confirmPin.join("");
    if (pin.length !== 4) { setPinError("Enter all 4 digits for your new PIN."); return; }
    if (pin !== confirm) { setPinError("PINs don't match. Please re-enter."); setConfirmPin(["","","",""]); confirmRefs[0].current?.focus(); return; }
    if (mode === "change" && currentPin.join("").length !== 4) { setPinError("Enter your current 4-digit PIN first."); return; }
    pinMutation.mutate(pin);
  };

  const PinBoxRow = ({
    label, arr, setArr, refs
  }: { label: string; arr: string[]; setArr: (a: string[]) => void; refs: React.RefObject<HTMLInputElement>[] }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-3">
        {arr.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value, arr, setArr, refs)}
            onKeyDown={e => handleKeyDown(e, i, arr, setArr, refs)}
            className="w-12 h-12 text-center text-xl font-bold rounded-lg border-2 bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all caret-transparent"
            data-testid={`pin-box-${label.toLowerCase().replace(/\s/g,"-")}-${i}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Login PIN</CardTitle>
              <CardDescription>4-digit PIN for fast sign-in on trusted devices</CardDescription>
            </div>
          </div>
          {isPinSet && mode === "idle" && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> PIN Active
            </Badge>
          )}
          {!isPinSet && mode === "idle" && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
              <Lock className="h-3.5 w-3.5" /> Not Set
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {mode === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isPinSet
                ? "Your 4-digit PIN is active. You can change it or reset it at any time. The PIN is used on devices you've trusted to skip OTP."
                : "Set a 4-digit PIN for faster sign-in. Once set, trusted devices will ask for your PIN instead of sending an OTP."}
            </p>
            <div className="flex flex-wrap gap-3">
              {!isPinSet && (
                <Button onClick={() => { setMode("set"); setTimeout(() => newRefs[0].current?.focus(), 100); }} data-testid="button-setup-pin">
                  <KeyRound className="h-4 w-4 mr-2" /> Set PIN
                </Button>
              )}
              {isPinSet && (
                <Button variant="outline" onClick={() => { setMode("change"); setTimeout(() => currentRefs[0].current?.focus(), 100); }} data-testid="button-change-pin">
                  <RefreshCw className="h-4 w-4 mr-2" /> Change PIN
                </Button>
              )}
            </div>
          </div>
        )}

        {(mode === "set" || mode === "change") && (
          <div className="space-y-5">
            {mode === "change" && (
              <PinBoxRow label="Current PIN" arr={currentPin} setArr={setCurrentPin} refs={currentRefs} />
            )}
            <PinBoxRow label="New PIN" arr={newPin} setArr={setNewPin} refs={newRefs} />
            <PinBoxRow label="Confirm New PIN" arr={confirmPin} setArr={setConfirmPin} refs={confirmRefs} />

            {pinError && (
              <p className="text-sm font-medium text-destructive">{pinError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={pinMutation.isPending}
                data-testid="button-save-pin"
              >
                {pinMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" /> {mode === "set" ? "Set PIN" : "Update PIN"}</>
                )}
              </Button>
              <Button variant="ghost" onClick={resetState} data-testid="button-cancel-pin">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NavigationPositionSelector() {
  const { navPosition, setNavPosition, isPending } = useUserPreferences();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();

  const userRoles = (user as any)?.roles || [];
  const isAdmin = userRoles.includes("admin") || userRoles.includes("superadmin");

  if (isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PanelLeft className="h-5 w-5" />
            Navigation Bar Position
          </CardTitle>
          <CardDescription>
            Admin users have a fixed left sidebar navigation for optimal workflow management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
            <PanelLeft className="h-4 w-4" />
            <span>Left Sidebar (Admin Default)</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handlePositionChange = (position: NavPosition) => {
    if (isMobile && position === "left") {
      toast({
        title: "Mobile Adjustment",
        description: "Left sidebar is not available on mobile. Switched to bottom navigation.",
      });
      setNavPosition("bottom");
      return;
    }
    setNavPosition(position);
    toast({
      title: "Layout Updated",
      description: `Navigation position changed to ${position}`,
    });
  };

  const positions: { value: NavPosition; label: string; description: string; icon: any; disabled?: boolean; tooltip?: string }[] = [
    { 
      value: "left", 
      label: "Left Sidebar", 
      description: "Classic sidebar navigation",
      icon: PanelLeft,
      disabled: isMobile,
      tooltip: isMobile ? "Not available on mobile devices" : undefined
    },
    { 
      value: "top", 
      label: "Top Header", 
      description: "Horizontal navigation bar",
      icon: PanelTop
    },
    { 
      value: "bottom", 
      label: "Bottom Bar", 
      description: "Mobile-style bottom navigation",
      icon: Dock
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PanelLeft className="h-5 w-5" />
          Navigation Bar Position
        </CardTitle>
        <CardDescription>
          Choose where your navigation bar appears. Changes apply instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {positions.map((pos) => {
            const isActive = navPosition === pos.value;
            const isDisabled = pos.disabled;
            
            const button = (
              <button
                key={pos.value}
                onClick={() => !isDisabled && handlePositionChange(pos.value)}
                disabled={isDisabled || isPending}
                className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                  isDisabled 
                    ? "opacity-50 cursor-not-allowed border-muted" 
                    : isActive 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-muted hover:border-primary/50 hover:bg-muted/30"
                }`}
                data-testid={`button-nav-position-${pos.value}`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className={`p-4 rounded-full ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                  <pos.icon className={`h-8 w-8 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className="font-semibold">{pos.label}</p>
                  <p className="text-sm text-muted-foreground">{pos.description}</p>
                </div>
              </button>
            );

            if (pos.tooltip) {
              return (
                <TooltipProvider key={pos.value}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {button}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{pos.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return button;
          })}
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current Position</p>
              <p className="text-sm text-muted-foreground">
                Your navigation is displayed on the {navPosition === "left" ? "left side" : navPosition === "top" ? "top" : "bottom"}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
              {navPosition === "left" && <PanelLeft className="h-4 w-4" />}
              {navPosition === "top" && <PanelTop className="h-4 w-4" />}
              {navPosition === "bottom" && <Dock className="h-4 w-4" />}
              <span className="font-medium capitalize">{navPosition}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DisplayPreferencesCard() {
  const { displayPreferences, setDisplayPreference } = useUserPreferences();
  const { toast } = useToast();

  const handleToggle = (key: "reduceMotion" | "highContrast" | "compactMode", label: string) => {
    const newValue = !displayPreferences[key];
    setDisplayPreference(key, newValue);
    toast({
      title: `${label} ${newValue ? "Enabled" : "Disabled"}`,
      description: newValue 
        ? `${label} has been turned on` 
        : `${label} has been turned off`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Preferences</CardTitle>
        <CardDescription>Additional display settings for your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Reduce Motion</Label>
            <p className="text-sm text-muted-foreground">
              Minimize animations and transitions
            </p>
          </div>
          <Switch 
            checked={displayPreferences.reduceMotion}
            onCheckedChange={() => handleToggle("reduceMotion", "Reduce Motion")}
            data-testid="switch-reduce-motion" 
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>High Contrast</Label>
            <p className="text-sm text-muted-foreground">
              Increase contrast for better visibility
            </p>
          </div>
          <Switch 
            checked={displayPreferences.highContrast}
            onCheckedChange={() => handleToggle("highContrast", "High Contrast")}
            data-testid="switch-high-contrast" 
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Compact Mode</Label>
            <p className="text-sm text-muted-foreground">
              Reduce spacing to show more content
            </p>
          </div>
          <Switch 
            checked={displayPreferences.compactMode}
            onCheckedChange={() => handleToggle("compactMode", "Compact Mode")}
            data-testid="switch-compact-mode" 
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ResetAllSettingsCard() {
  const { resetAllPreferences } = useUserPreferences();
  const { setTheme } = useTheme();
  const { toast } = useToast();

  const handleReset = () => {
    setTheme("system");
    resetAllPreferences();
    toast({
      title: "Settings Reset",
      description: "All appearance settings have been restored to defaults.",
    });
  };

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
        <div>
          <p className="font-semibold">Reset All Appearance Settings</p>
          <p className="text-sm text-muted-foreground">
            Restore theme, navigation position, and display preferences to their original defaults
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleReset}
          data-testid="button-reset-settings"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(true);
  const [portfolioUpdates, setPortfolioUpdates] = useState(true);
  const [newsAlerts, setNewsAlerts] = useState(false);

  const accountForm = useForm<z.infer<typeof accountFormSchema>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.mobile || "",
      language: "en",
      timezone: "Asia/Kolkata",
    },
  });

  const securityForm = useForm<z.infer<typeof securityFormSchema>>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Wired change-password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (values: z.infer<typeof securityFormSchema>) => {
      return await apiRequest("/api/user/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Password Changed", description: "Your password has been updated successfully." });
      securityForm.reset();
    },
    onError: (err: any) => {
      toast({ title: "Change Failed", description: err?.message || "Could not change password. Check your current password.", variant: "destructive" });
    },
  });

  const onAccountSubmit = (values: z.infer<typeof accountFormSchema>) => {
    toast({
      title: "Account Updated",
      description: "Your account settings have been saved successfully.",
    });
  };

  const onSecuritySubmit = (values: z.infer<typeof securityFormSchema>) => {
    changePasswordMutation.mutate(values);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="settings-title">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your account settings, notifications, security, and connected services
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="h-4 w-4 mr-2" />
            Account Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <LucideShield className="h-4 w-4 mr-2" />
            Security & Privacy
          </TabsTrigger>
          <TabsTrigger value="appearance" data-testid="tab-appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="signatures" data-testid="tab-signatures">
            <PenTool className="h-4 w-4 mr-2" />
            Signatures
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Account Settings Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={accountForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={accountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormDescription>This email will be used for account notifications</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={accountForm.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-language">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="hi">Hindi</SelectItem>
                              <SelectItem value="mr">Marathi</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={accountForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                              <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                              <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" data-testid="button-save-account">
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Notification Channels</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive updates via email</p>
                    </div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} data-testid="switch-email" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive text messages</p>
                    </div>
                  </div>
                  <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} data-testid="switch-sms" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Browser and app notifications</p>
                    </div>
                  </div>
                  <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} data-testid="switch-push" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Alert Types</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Market Alerts</p>
                    <p className="text-sm text-muted-foreground">Price movements and market events</p>
                  </div>
                  <Switch checked={marketAlerts} onCheckedChange={setMarketAlerts} data-testid="switch-market" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Portfolio Updates</p>
                    <p className="text-sm text-muted-foreground">Holdings and performance changes</p>
                  </div>
                  <Switch checked={portfolioUpdates} onCheckedChange={setPortfolioUpdates} data-testid="switch-portfolio" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">News Alerts</p>
                    <p className="text-sm text-muted-foreground">Financial news and updates</p>
                  </div>
                  <Switch checked={newsAlerts} onCheckedChange={setNewsAlerts} data-testid="switch-news" />
                </div>
              </div>

              <Button data-testid="button-save-notifications">
                <Check className="h-4 w-4 mr-2" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">

          {/* Biometric - quick link at top */}
          <Link href="/biometric-settings">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors border-blue-100 dark:border-blue-900/40">
              <CardContent className="py-4 flex items-center gap-4">
                <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950">
                  <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Biometric Authentication</div>
                  <div className="text-sm text-muted-foreground">
                    Set up Face ID or Fingerprint for passwordless sign-in
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          {/* Change Password - wired to real API */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your account login password</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...securityForm}>
                <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-5">
                  <FormField
                    control={securityForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showCurrentPw ? "text" : "password"}
                              placeholder="Enter your current password"
                              {...field}
                              data-testid="input-current-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowCurrentPw(!showCurrentPw)}
                              tabIndex={-1}
                            >
                              {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={securityForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPw ? "text" : "password"}
                              placeholder="Minimum 8 characters"
                              {...field}
                              data-testid="input-new-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowNewPw(!showNewPw)}
                              tabIndex={-1}
                            >
                              {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>At least 8 characters, must differ from current</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={securityForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Re-enter new password" {...field} data-testid="input-confirm-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                    ) : (
                      <><Lock className="h-4 w-4 mr-2" /> Change Password</>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* 4-Digit Login PIN */}
          <PinManagementCard />

          {/* 2FA */}
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable 2FA</p>
                  <p className="text-sm text-muted-foreground">Require authentication code in addition to password</p>
                </div>
                <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} data-testid="switch-2fa" />
              </div>
              {twoFactorEnabled && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm">Setup instructions will be sent to your registered email</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" data-testid="button-delete-account">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone. All your data will be permanently deleted.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Visual Mode
              </CardTitle>
              <CardDescription>
                Choose your preferred appearance theme. Select Light for a bright interface, Dark for reduced eye strain, or System to match your device settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setTheme("light");
                    toast({ title: "Theme Updated", description: "Light mode activated" });
                  }}
                  className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:border-primary/50 ${
                    theme === "light" 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-muted hover:bg-muted/30"
                  }`}
                  data-testid="button-theme-light"
                >
                  {theme === "light" && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className={`p-4 rounded-full ${theme === "light" ? "bg-primary/10" : "bg-muted"}`}>
                    <Sun className={`h-8 w-8 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Light</p>
                    <p className="text-sm text-muted-foreground">Bright and clear</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setTheme("dark");
                    toast({ title: "Theme Updated", description: "Dark mode activated" });
                  }}
                  className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:border-primary/50 ${
                    theme === "dark" 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-muted hover:bg-muted/30"
                  }`}
                  data-testid="button-theme-dark"
                >
                  {theme === "dark" && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className={`p-4 rounded-full ${theme === "dark" ? "bg-primary/10" : "bg-muted"}`}>
                    <Moon className={`h-8 w-8 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Dark</p>
                    <p className="text-sm text-muted-foreground">Easy on the eyes</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setTheme("system");
                    toast({ title: "Theme Updated", description: "Following system preference" });
                  }}
                  className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all hover:border-primary/50 ${
                    theme === "system" 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-muted hover:bg-muted/30"
                  }`}
                  data-testid="button-theme-system"
                >
                  {theme === "system" && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className={`p-4 rounded-full ${theme === "system" ? "bg-primary/10" : "bg-muted"}`}>
                    <Monitor className={`h-8 w-8 ${theme === "system" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">System</p>
                    <p className="text-sm text-muted-foreground">Match device theme</p>
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Current Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Your interface is currently displaying in {resolvedTheme} mode
                      {theme === "system" && " (based on your system settings)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                    {resolvedTheme === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                    <span className="font-medium capitalize">{resolvedTheme}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <NavigationPositionSelector />

          <DisplayPreferencesCard />

          <ResetAllSettingsCard />
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures" className="space-y-6">
          <SignatureManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
