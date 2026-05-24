import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  Shield as LucideShield, Eye, Lock, Database, UserCheck, AlertTriangle, 
  Clock, Globe, Server, FileCheck, Phone
} from "lucide-react";

export default function PrivacyPolicy() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.title = "Privacy Policy - FintekPro";

    const handleNavChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsNavCollapsed(customEvent.detail.collapsed);
    };

    window.addEventListener('navigation-change', handleNavChange as EventListener);
    return () => {
      window.removeEventListener('navigation-change', handleNavChange as EventListener);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card">
      <main className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <LucideShield className="w-12 h-12 text-blue-600 mr-3" />
              <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Your privacy is our priority. Learn how we collect, use, and protect your financial data.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: January 3, 2026
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-8">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Regulatory Compliance</h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              This Privacy Policy complies with the Information Technology Act, 2000, IT (Reasonable Security Practices) Rules, 2011, 
              SEBI data protection requirements, RBI guidelines on customer data, and applicable provisions of the Digital Personal Data Protection Act.
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
                  <h4 className="font-semibold mb-2">Personal Identification Data</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Full legal name, email address, mobile number</li>
                    <li>PAN (mandatory), Aadhaar (for eKYC), passport/voter ID</li>
                    <li>Address, date of birth, nationality, and residency status</li>
                    <li>Photograph and signature for KYC verification</li>
                    <li>Nominee and beneficiary details</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Financial Information</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Bank account details (account number, IFSC, account type)</li>
                    <li>Demat account details (DP ID, Client ID)</li>
                    <li>Investment portfolio data and transaction history</li>
                    <li>Income details, occupation, and source of wealth/funds</li>
                    <li>Risk tolerance assessment and investment objectives</li>
                    <li>Tax-related documents (Form 16, ITR, 26AS)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Regulatory Compliance Data</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>FATCA/CRS declaration and tax residency details</li>
                    <li>PEP (Politically Exposed Person) status declaration</li>
                    <li>CKYC registration number and central KYC records</li>
                    <li>AML risk assessment and screening results</li>
                    <li>Ultimate Beneficial Ownership (UBO) information for entities</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Auto-Populated Data (With Consent)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>CAMS/KFintech mutual fund holdings</li>
                    <li>CDSL/NSDL demat holdings</li>
                    <li>Insurance policy data from repositories</li>
                    <li>Credit bureau data (CIBIL/Experian/Equifax)</li>
                    <li>Account Aggregator data (with explicit consent)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Technical & Usage Data</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Device information, IP address, browser type</li>
                    <li>Login timestamps and session data</li>
                    <li>Platform usage patterns and feature interactions</li>
                    <li>Communication preferences and notification settings</li>
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
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Service Delivery</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Process investment transactions and maintain portfolio records</li>
                    <li>Provide personalized investment recommendations and advisory</li>
                    <li>Execute trades, SIPs, and fund transfers</li>
                    <li>Generate reports, statements, and tax documents</li>
                    <li>Power AI-driven insights and portfolio analytics</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Regulatory Compliance</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>KYC verification and ongoing customer due diligence</li>
                    <li>AML monitoring and suspicious transaction reporting</li>
                    <li>SEBI, RBI, and Income Tax regulatory reporting</li>
                    <li>FATCA/CRS reporting to relevant authorities</li>
                    <li>Audit trail maintenance for 7+ years</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Communication</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Transaction confirmations and account alerts</li>
                    <li>Market updates and investment opportunities (with consent)</li>
                    <li>Regulatory notices and policy updates</li>
                    <li>Customer support and grievance resolution</li>
                  </ul>
                </div>
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
                  <h4 className="font-semibold mb-2">Encryption Standards</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>AES-256 encryption for data at rest</li>
                    <li>TLS 1.3 for all data in transit</li>
                    <li>End-to-end encryption for sensitive financial data</li>
                    <li>Tokenization of payment card and bank account details</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Access Controls</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Mandatory two-factor authentication (OTP via email/SMS)</li>
                    <li>Role-based access control (RBAC) for internal systems</li>
                    <li>Biometric authentication support for mobile apps</li>
                    <li>Session timeout and automatic logout policies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Infrastructure Security</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>SOC 2 Type II compliant cloud infrastructure</li>
                    <li>Regular penetration testing and vulnerability assessments</li>
                    <li>24/7 security monitoring and intrusion detection</li>
                    <li>Disaster recovery and business continuity protocols</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Data Retention Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Regulatory Retention Requirements</h4>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    As per SEBI (Intermediaries) Regulations and RBI Master Directions, we are required to retain 
                    client records, transaction data, and KYC documents for a minimum of 7 years from account closure 
                    or last transaction date.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Retention Periods by Data Type</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>KYC Documents:</strong> 7 years from account closure</li>
                    <li><strong>Transaction Records:</strong> 7 years from transaction date</li>
                    <li><strong>Tax Documents:</strong> 7 years from relevant assessment year</li>
                    <li><strong>Communication Logs:</strong> 5 years</li>
                    <li><strong>Session/Login Data:</strong> 1 year</li>
                    <li><strong>Marketing Preferences:</strong> Until consent withdrawal</li>
                  </ul>
                </div>
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
                  <h4 className="font-semibold mb-2">Regulatory Authorities (Mandatory)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>SEBI for investment-related regulatory reporting</li>
                    <li>RBI for payment and banking compliance</li>
                    <li>Income Tax Department for tax-related reporting</li>
                    <li>Financial Intelligence Unit (FIU-IND) for AML compliance</li>
                    <li>Law enforcement agencies pursuant to valid legal orders</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Service Partners (Under Contract)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>KYC verification providers (CKYC, video KYC)</li>
                    <li>Payment gateways and banking partners</li>
                    <li>Depositories (CDSL, NSDL) and RTAs (CAMS, KFintech)</li>
                    <li>Credit bureaus for loan processing</li>
                    <li>Cloud infrastructure providers with data processing agreements</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">We Do NOT</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Sell your personal data to third parties</li>
                    <li>Share data for marketing without explicit consent</li>
                    <li>Transfer data to jurisdictions without adequate protection</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-600" />
                  Cross-Border Data Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">NRI & Global Advisory Services</h4>
                  <p className="text-muted-foreground mb-2">
                    For NRI clients and Global Advisory users, certain data may be processed in jurisdictions outside India:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Cloud infrastructure in US/EU regions with SOC 2 certification</li>
                    <li>FATCA reporting to US IRS via Indian regulatory channels</li>
                    <li>CRS reporting to relevant tax authorities</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Safeguards</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Standard Contractual Clauses with all international processors</li>
                    <li>Data localization for sensitive Indian resident data per RBI guidelines</li>
                    <li>Encryption in transit for all cross-border transfers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
                  Your Rights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li><strong>Right to Access:</strong> Request a copy of your personal data held by us</li>
                  <li><strong>Right to Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Right to Erasure:</strong> Request deletion (subject to regulatory retention requirements)</li>
                  <li><strong>Right to Portability:</strong> Receive your data in a structured, machine-readable format</li>
                  <li><strong>Right to Withdraw Consent:</strong> Opt out of optional data processing and marketing</li>
                  <li><strong>Right to Grievance:</strong> Lodge complaints with our Grievance Officer</li>
                </ul>
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Certain rights may be limited where data is required for regulatory compliance, 
                    legal proceedings, or legitimate business interests. We will explain any limitations when you make a request.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileCheck className="w-5 h-5 mr-2 text-blue-600" />
                  Consent Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Auto-Population Consent</h4>
                  <p className="text-muted-foreground">
                    Our PAN-level portfolio auto-population feature requires explicit consent before fetching data from 
                    external sources (CAMS, KFintech, depositories). You can manage these consents in your account settings.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Marketing Communications</h4>
                  <p className="text-muted-foreground">
                    You can opt out of marketing communications at any time via email preferences or by contacting support. 
                    Transactional and regulatory communications cannot be opted out.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="w-5 h-5 mr-2 text-blue-600" />
                  Cookies & Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li><strong>Essential Cookies:</strong> Required for authentication and security</li>
                  <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                  <li><strong>Analytics Cookies:</strong> Help us improve platform performance (anonymized)</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  We do not use third-party advertising cookies. You can manage cookie preferences in your browser settings.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-blue-600" />
                  Contact & Grievance Redressal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Data Protection Officer</h4>
                    <p className="text-muted-foreground">
                      <strong>Email:</strong> support@fintekpro.com<br />
                      <strong>Response Time:</strong> Within 30 days
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Grievance Officer (As per IT Act)</h4>
                    <p className="text-muted-foreground">
                      <strong>Name:</strong> Grievance Officer, FintekPro<br />
                      <strong>Email:</strong> support@fintekpro.com<br />
                      <strong>Address:</strong> FintekPro Financial Services LLP, Mumbai, Maharashtra, India<br />
                      <strong>Response Time:</strong> Acknowledgment within 48 hours, resolution within 30 days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              This privacy policy is effective as of January 3, 2026. We may update this policy with 30 days notice 
              to registered users. Continued use after changes constitutes acceptance.
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/disclaimer" className="text-blue-600 hover:underline">Risk Disclaimer</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
