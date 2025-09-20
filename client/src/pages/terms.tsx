import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Scale, AlertTriangle, Shield, Users, CreditCard } from "lucide-react";
import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";

export default function TermsOfService() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.title = "Terms of Service - FintekPro";

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
      <EnhancedNavigation />
      
      <main className={`${isNavCollapsed ? 'ml-0 lg:ml-16' : 'ml-0 lg:ml-64'} py-12 px-4`}>
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Legal terms governing your use of FintekPro's financial services platform.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: August 31, 2025
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Scale className="w-5 h-5 mr-2 text-blue-600" />
                Acceptance of Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                By accessing and using FintekPro's services, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms of Service and our Privacy Policy.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                If you do not agree to these terms, please do not use our services.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Eligibility & Account Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Eligibility Requirements</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Must be 18 years or older</li>
                  <li>Must be a legal resident of India or eligible NRI</li>
                  <li>Must have valid KYC documentation (PAN, Aadhar, etc.)</li>
                  <li>Must comply with all applicable regulations</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Account Responsibilities</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Provide accurate and complete information</li>
                  <li>Maintain the security of your login credentials</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Update your information when it changes</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                Financial Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Investment Services</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Portfolio management and investment advisory</li>
                  <li>Mutual funds, stocks, bonds, and alternative investments</li>
                  <li>Risk assessment and asset allocation</li>
                  <li>Market research and investment recommendations</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Banking Integration</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Account aggregation and transaction monitoring</li>
                  <li>Payment processing and fund transfers</li>
                  <li>Balance and statement reconciliation</li>
                  <li>Financial planning and budgeting tools</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Compliance Services</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>KYC verification and ongoing monitoring</li>
                  <li>FATCA reporting and tax compliance</li>
                  <li>AML screening and risk assessment</li>
                  <li>Regulatory reporting and documentation</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                Investment Risks & Disclaimers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                  Important Risk Disclosure
                </h4>
                <p className="text-orange-700 dark:text-orange-300 text-sm">
                  All investments are subject to market risks. Past performance does not guarantee future results. 
                  Please read all scheme documents carefully before investing.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Investment Risks</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Market volatility and potential loss of principal</li>
                  <li>Liquidity risks in certain investment products</li>
                  <li>Credit risk from bond and debt investments</li>
                  <li>Currency risk for international investments</li>
                  <li>Regulatory and policy changes affecting markets</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">No Guaranteed Returns</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  We do not guarantee any specific returns on investments. All investment recommendations 
                  are based on our analysis and should be considered as advisory in nature.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-600" />
                Data Protection & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Your privacy and data security are paramount to us. By using our services, you consent to:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                <li>Collection and processing of your financial data as described in our Privacy Policy</li>
                <li>Sharing of information with regulatory authorities as required by law</li>
                <li>Use of your data for risk assessment and compliance monitoring</li>
                <li>Storage of your information in secure, encrypted databases</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fees & Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Service Fees</h4>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Management fees as disclosed in investment documents</li>
                  <li>Transaction charges for trades and fund transfers</li>
                  <li>Platform usage fees for premium features</li>
                  <li>Third-party charges (AMC fees, brokerage, etc.)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Fee Transparency</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  All fees will be clearly disclosed before you commit to any investment or service. 
                  We maintain complete transparency in our fee structure.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regulatory Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Regulatory Oversight</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  FintekPro operates under the regulatory framework of:
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
                  <li>Securities and Exchange Board of India (SEBI)</li>
                  <li>Reserve Bank of India (RBI)</li>
                  <li>Association of Mutual Funds in India (AMFI)</li>
                  <li>Insurance Regulatory and Development Authority (IRDAI)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Compliance Obligations</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  You agree to comply with all applicable laws and regulations, including providing 
                  accurate information for KYC verification and tax reporting purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                To the maximum extent permitted by law, FintekPro shall not be liable for:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                <li>Investment losses due to market conditions</li>
                <li>Technical issues or system downtime</li>
                <li>Third-party service provider failures</li>
                <li>Indirect, incidental, or consequential damages</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Either party may terminate this agreement with 30 days written notice. Upon termination:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1">
                <li>You retain ownership of your investments</li>
                <li>We will assist in transferring your portfolio</li>
                <li>Outstanding fees must be settled</li>
                <li>Data retention follows our Privacy Policy</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                For questions about these terms or our services:
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> legal@fintekpro.com</p>
                <p><strong>Phone:</strong> +91-22-1234-5678</p>
                <p><strong>Address:</strong> FintekPro Legal Department, Mumbai, India</p>
                <p><strong>Business Hours:</strong> Monday-Friday, 9 AM - 6 PM IST</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These terms are effective as of August 31, 2025. We reserve the right to update these terms 
            with 30 days notice to users.
          </p>
        </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}