import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Shield, TrendingUp, BarChart3, MessageSquare } from "lucide-react";
import { FaGoogle, FaApple } from "react-icons/fa";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Redirect if already authenticated
  if (!isAuthLoading && user) {
    navigate("/");
    return null;
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Hero Section */}
          <div className="lg:pr-8">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to <span className="text-blue-600">FintekPro</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Your intelligent financial services platform with AI-powered tax filing, 
                portfolio management, and comprehensive investment tools.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <Shield className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Smart Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Sign in securely with Google, Apple, or WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">ITR & Tax Services</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">AI-powered tax filing with expert assistance</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <BarChart3 className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Portfolio Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Track and manage your investments</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Real-time Insights</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Live market data and AI recommendations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sign In Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1 text-center">
                <div className="flex items-center justify-center mb-4">
                  <Shield className="h-12 w-12 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Sign In to FintekPro</CardTitle>
                <CardDescription>
                  Choose your preferred sign-in method
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Google Sign In */}
                <Button
                  variant="outline"
                  className="w-full h-12 text-base"
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-login-google"
                >
                  <FaGoogle className="w-5 h-5 mr-3 text-red-500" />
                  Continue with Google
                </Button>

                {/* Apple Sign In */}
                <Button
                  variant="outline"
                  className="w-full h-12 text-base"
                  onClick={() => window.location.href = '/api/login'}
                  data-testid="button-login-apple"
                >
                  <FaApple className="w-5 h-5 mr-3" />
                  Continue with Apple
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">
                      Or
                    </span>
                  </div>
                </div>

                {/* WhatsApp Sign In */}
                <Link href="/whatsapp-login" data-testid="link-whatsapp-login">
                  <Button 
                    variant="outline" 
                    className="w-full h-12 text-base bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:border-green-800 dark:text-green-400"
                  >
                    <MessageSquare className="w-5 h-5 mr-3" />
                    Continue with WhatsApp
                  </Button>
                </Link>

                {/* Security Note */}
                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    🔒 Your data is protected with enterprise-grade encryption.<br />
                    Quick, secure, and password-free authentication.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
