import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, Lock, Database, UserCheck, AlertTriangle } from "lucide-react";

export default function PrivacyPolicy() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.title = "Privacy Policy - FintekPro";

    const handleNavChange = (e: CustomEvent) => {
      setIsNavCollapsed(e.detail.collapsed);
    };

    window.addEventListener('navigation-change', handleNavChange as EventListener);
    return () => {
      window.removeEventListener('navigation-change', handleNavChange as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Your privacy is our priority. Learn how we protect your financial data.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: August 31, 2025
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="w-5 h-5 mr-2 text-blue-600" />
                Information We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Personal Information</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Name, email address, mobile number</li>
                  <li>PAN number, Aadhar number, passport details</li>
                  <li>Address and residency information</li>
                  <li>Date of birth and nationality</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Financial Information</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Bank account details and transaction history</li>
                  <li>Investment portfolio and trading data</li>
                  <li>Income, occupation, and source of wealth</li>
                  <li>Risk tolerance and investment preferences</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Compliance Information</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>FATCA status and tax residency details</li>
                  <li>PEP (Politically Exposed Person) status</li>
                  <li>KYC documents and verification data</li>
                  <li>AML risk assessment information</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2 text-blue-600" />
                How We Use Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li>Provide financial services and investment management</li>
                <li>Comply with regulatory requirements (SEBI, RBI, FATCA)</li>
                <li>Conduct KYC verification and AML monitoring</li>
                <li>Process transactions and maintain portfolio records</li>
                <li>Provide personalized investment recommendations</li>
                <li>Communicate important account and market updates</li>
                <li>Prevent fraud and ensure platform security</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2 text-blue-600" />
                Data Protection & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Encryption & Security</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>End-to-end encryption for sensitive financial data</li>
                  <li>Secure socket layer (SSL) for all communications</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Multi-factor authentication for account access</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Access Controls</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Role-based access to your information</li>
                  <li>Regular access reviews and audit logs</li>
                  <li>Secure data centers with physical protection</li>
                  <li>Employee training on data protection</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
                Your Rights (GDPR & Data Protection)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Right to Access:</strong> Request copies of your personal data</li>
                <li><strong>Right to Rectification:</strong> Correct inaccurate information</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your data (subject to regulatory requirements)</li>
                <li><strong>Right to Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                <li><strong>Right to Object:</strong> Opt out of certain data processing activities</li>
                <li><strong>Right to Withdraw Consent:</strong> Remove consent for optional data processing</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Data Sharing & Third Parties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Regulatory Compliance</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  We may share your information with regulatory authorities (SEBI, RBI, FATCA reporting) 
                  as required by law and financial regulations.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Service Providers</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  We work with trusted partners for KYC verification, payment processing, and data analytics. 
                  All partners are bound by strict confidentiality agreements.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">No Sale of Data</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  We never sell your personal information to third parties for marketing purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We retain your information only as long as necessary for:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                <li>Providing our services to you</li>
                <li>Complying with legal and regulatory requirements</li>
                <li>Resolving disputes and enforcing agreements</li>
                <li>Preventing fraud and maintaining security</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                Financial records are typically retained for 7 years as required by Indian regulations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                For any privacy-related questions or to exercise your rights:
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> privacy@fintekpro.com</p>
                <p><strong>Address:</strong> Data Protection Officer, FintekPro, Mumbai, India</p>
                <p><strong>Response Time:</strong> We respond to all privacy requests within 30 days</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This privacy policy is effective as of August 31, 2025, and will remain in effect except with respect to any changes in its provisions in the future.
          </p>
        </div>
        </div>
      </main>
    </div>
  );
}