import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { WhatsAppLogin } from "@/components/whatsapp-login";
import { MessageSquare, Mail, Smartphone, ArrowLeft, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export default function WhatsAppAuthPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("whatsapp");
  const { toast } = useToast();

  const handleWhatsAppSuccess = (user: User) => {
    toast({
      title: "Welcome to FintekPro!",
      description: `Successfully logged in via WhatsApp.`,
    });

    // Redirect based on user role
    setTimeout(() => {
      if (user.role === 'admin' || user.role === 'super_admin') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    }, 1500);
  };

  const handleWhatsAppError = (error: string) => {
    console.error("WhatsApp login error:", error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Side - Hero Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
              Welcome to
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent block">
                FintekPro
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md lg:max-w-lg">
              Your comprehensive financial services platform for smart investing and investsmart solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                  <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">WhatsApp Login</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Quick & secure</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Secure Access</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bank-grade security</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🚀 New: WhatsApp Authentication
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Log in instantly using your WhatsApp number. No passwords to remember, 
              just a secure 6-digit code sent directly to your phone.
            </p>
          </div>
        </div>

        {/* Right Side - Authentication Forms */}
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6">
            <Link href="/" data-testid="link-back-home">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>

          <Card className="border-0 shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                Sign In to FintekPro
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Choose your preferred authentication method
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="whatsapp" className="flex items-center gap-2" data-testid="tab-whatsapp">
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="traditional" className="flex items-center gap-2" data-testid="tab-traditional">
                    <Mail className="w-4 h-4" />
                    Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="whatsapp" className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start space-x-3">
                      <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-green-900 dark:text-green-100">
                          WhatsApp Authentication
                        </p>
                        <p className="text-green-700 dark:text-green-300">
                          Enter your phone number to receive a secure verification code via WhatsApp.
                        </p>
                      </div>
                    </div>
                  </div>

                  <WhatsAppLogin
                    onSuccess={handleWhatsAppSuccess}
                    onError={handleWhatsAppError}
                  />
                </TabsContent>

                <TabsContent value="traditional" className="space-y-4">
                  <div className="text-center space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        Traditional email/password login is available.
                      </p>
                    </div>

                    <Link href="/auth" data-testid="link-traditional-login">
                      <Button variant="outline" className="w-full">
                        <Mail className="w-4 h-4 mr-2" />
                        Use Email/Password Login
                      </Button>
                    </Link>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6">
                <Separator className="my-4" />
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't have an account?
                  </p>
                  <Link href="/register" data-testid="link-register">
                    <Button variant="link" className="text-blue-600 dark:text-blue-400 hover:underline">
                      Create a new account
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  By signing in, you agree to our{" "}
                  <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}