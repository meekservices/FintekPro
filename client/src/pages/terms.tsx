import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  FileText, Scale, AlertTriangle, Shield as LucideShield, Users, CreditCard, 
  Building2, TrendingUp, Landmark, Globe, Briefcase, Calculator,
  Ban, Gavel, Phone
} from "lucide-react";

export default function TermsOfService() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.title = "Terms of Service - FintekPro";

    const handleNavChange: EventListener = (e) => {
      const customEvent = e as CustomEvent;
      setIsNavCollapsed(customEvent.detail.collapsed);
    };

    window.addEventListener('navigation-change', handleNavChange);
    return () => {
      window.removeEventListener('navigation-change', handleNavChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card">
      <main className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <FileText className="w-12 h-12 text-blue-600 mr-3" />
              <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Legal terms governing your use of FintekPro's financial services platform.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: January 3, 2026
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
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  By accessing and using FintekPro's services, you acknowledge that you have read, understood, 
                  and agree to be bound by these Terms of Service, our <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>, 
                  <Link href="/refund-policy" className="text-blue-600 underline"> Refund & Cancellation Policy</Link>, and 
                  <Link href="/disclaimer" className="text-blue-600 underline"> Investment Risk Disclaimer</Link>.
                </p>
                <p className="text-muted-foreground">
                  If you do not agree to these terms, please do not use our services. These terms constitute a legally 
                  binding agreement between you and FintekPro Financial Services LLP.
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
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Must be 18 years or older (21 for certain products as per SEBI guidelines)</li>
                    <li>Must be a legal resident of India, eligible NRI, or Global Advisory client in supported jurisdictions</li>
                    <li>Must have valid KYC documentation (PAN mandatory, Aadhaar for eKYC)</li>
                    <li>Must complete appropriate KYC tier for intended services (Basic/Enhanced/Accredited)</li>
                    <li>For PMS/AIF: Must qualify as Accredited Investor per SEBI (Investment Advisers) Regulations</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Account Responsibilities</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Provide accurate, complete, and truthful information</li>
                    <li>Maintain the confidentiality and security of your login credentials</li>
                    <li>Enable two-factor authentication as mandated</li>
                    <li>Notify us immediately of any unauthorized access or security breach</li>
                    <li>Update your information promptly when changes occur</li>
                    <li>Not share account access with third parties</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  Investment Products & Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Equity Markets</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Domestic stocks trading on NSE/BSE through registered brokers</li>
                    <li>US stocks and international markets through authorized channels</li>
                    <li>IPO applications via ASBA mechanism</li>
                    <li>Pre-IPO and unlisted securities (Enhanced KYC required)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mutual Funds</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Direct and regular plans from SEBI-registered AMCs</li>
                    <li>SIP, STP, SWP, and lump sum investments</li>
                    <li>ELSS funds for tax-saving under Section 80C</li>
                    <li>Execution through BSE Star MFD/MF Central</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Fixed Income</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Government securities (G-Secs, T-Bills, SGBs)</li>
                    <li>Corporate bonds and NCDs</li>
                    <li>Fixed deposits from partner banks/NBFCs</li>
                    <li>Market Linked Debentures (MLDs) - Accredited Investors only</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Alternative Investments</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Portfolio Management Services (PMS) - Minimum ₹50 lakhs</li>
                    <li>Alternative Investment Funds (AIF) - Minimum ₹1 crore</li>
                    <li>REITs and InvITs listed on exchanges</li>
                    <li>Unlisted securities marketplace (Enhanced KYC required)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Landmark className="w-5 h-5 mr-2 text-blue-600" />
                  Banking & Loan Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Loan Distribution</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Personal loans, home loans, and LAP through partner lenders</li>
                    <li>Loan against securities (LAS) and loan against mutual funds</li>
                    <li>Business loans and working capital facilities</li>
                    <li>Credit assessment facilitated through authorized bureaus (CIBIL)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Insurance Services</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Life and health insurance through IRDAI-registered partners</li>
                    <li>General insurance products</li>
                    <li>Policy comparison and advisory services</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="w-5 h-5 mr-2 text-blue-600" />
                  Tax & Compliance Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">ITR Filing Services</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Self-filing wizard for ITR-1, ITR-2, ITR-3, ITR-4</li>
                    <li>CA-assisted filing for complex returns</li>
                    <li>Form 15CA/15CB for foreign remittances</li>
                    <li>Tax notice management and expert consultation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Compliance Features</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Capital gains computation and reporting</li>
                    <li>TDS compliance and Form 26AS reconciliation</li>
                    <li>FATCA/CRS reporting for applicable accounts</li>
                    <li>Document vault with 7-year retention</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-600" />
                  NRI & Global Advisory Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">NRI Services</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>NRE/NRO account-linked investments</li>
                    <li>FEMA-compliant portfolio management</li>
                    <li>Repatriation assistance and documentation</li>
                    <li>Tax treaty benefit optimization</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Global Advisory (Analytics Mode)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Portfolio analytics and tracking for non-India markets</li>
                    <li>Read-only mode for jurisdictions where execution is not permitted</li>
                    <li>Multi-currency portfolio valuation</li>
                    <li>AI-powered insights without transaction capability</li>
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
                    SEBI Mandatory Risk Disclosure
                  </h4>
                  <p className="text-orange-700 dark:text-orange-300 text-sm">
                    Investments in securities market are subject to market risks. Read all related documents carefully before investing. 
                    Past performance is not indicative of future returns. Registration granted by SEBI and certification from NISM 
                    in no way guarantee performance of the intermediary or provide any assurance of returns to investors.
                  </p>
                </div>
                <p className="text-muted-foreground">
                  For detailed product-wise risk disclosures, please refer to our <Link href="/disclaimer" className="text-blue-600 underline">Investment Risk Disclaimer</Link>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Fees & Charges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Platform Fees</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Subscription fees for premium advisory services</li>
                    <li>Transaction charges as per applicable product schedules</li>
                    <li>Advisory fees based on AUM or flat-fee structures</li>
                    <li>ITR filing charges based on complexity tier</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Third-Party Charges</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>AMC expense ratios for mutual funds</li>
                    <li>Brokerage and exchange transaction charges</li>
                    <li>GST and applicable statutory levies</li>
                    <li>Payment gateway charges where applicable</li>
                  </ul>
                </div>
                <p className="text-muted-foreground">
                  For refund eligibility, see our <Link href="/refund-policy" className="text-blue-600 underline">Refund & Cancellation Policy</Link>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LucideShield className="w-5 h-5 mr-2 text-blue-600" />
                  Data Protection & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Your privacy and data security are paramount. By using our services, you consent to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Collection and processing of financial data as described in our <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link></li>
                  <li>Mandatory sharing with regulatory authorities (SEBI, RBI, Income Tax)</li>
                  <li>7-year data retention as per SEBI/RBI compliance requirements</li>
                  <li>Consent-based auto-population from external data sources</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                  Regulatory Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Regulatory Framework</h4>
                  <p className="text-muted-foreground mb-2">
                    FintekPro operates under the oversight of:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Securities and Exchange Board of India (SEBI) - Investment Advisory</li>
                    <li>Reserve Bank of India (RBI) - Payment Aggregation</li>
                    <li>Association of Mutual Funds in India (AMFI) - Mutual Fund Distribution</li>
                    <li>Insurance Regulatory and Development Authority (IRDAI) - Insurance</li>
                    <li>Income Tax Department - Tax Filing Services</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">User Compliance Obligations</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Provide accurate KYC information and valid documentation</li>
                    <li>Report material changes in financial status or PEP status</li>
                    <li>Comply with FEMA regulations for cross-border transactions</li>
                    <li>Fulfill tax reporting obligations on investment income</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Ban className="w-5 h-5 mr-2 text-red-600" />
                  Prohibited Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Market manipulation, insider trading, or front-running</li>
                  <li>Money laundering or terrorist financing activities</li>
                  <li>Providing false or misleading information</li>
                  <li>Unauthorized access or security circumvention</li>
                  <li>Using the platform for illegal purposes</li>
                  <li>Sharing account credentials or allowing third-party access</li>
                  <li>Reverse engineering or unauthorized data extraction</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
                  Limitation of Liability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  To the maximum extent permitted by law, FintekPro shall not be liable for:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Investment losses arising from market conditions or user decisions</li>
                  <li>Losses from technical issues, system downtime, or connectivity failures</li>
                  <li>Third-party service provider failures (exchanges, depositories, payment gateways)</li>
                  <li>Indirect, incidental, consequential, or punitive damages</li>
                  <li>Regulatory changes affecting investment products or tax treatment</li>
                  <li>Force majeure events beyond reasonable control</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Maximum aggregate liability is limited to fees paid by you in the preceding 12 months.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gavel className="w-5 h-5 mr-2 text-blue-600" />
                  Dispute Resolution & Governing Law
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Governing Law</h4>
                  <p className="text-muted-foreground">
                    These terms are governed by the laws of India. Courts in Mumbai shall have exclusive jurisdiction.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Dispute Resolution Escalation Matrix</h4>
                  <div className="space-y-3 text-muted-foreground">
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm">Step 1: Internal Grievance</p>
                      <p className="text-sm">Email support@fintekpro.com - Response within 48 hours, resolution within 30 days</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm">Step 2: Regulatory Escalation</p>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                        <li>Investment disputes: <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">SEBI SCORES Portal</a></li>
                        <li>Banking disputes: <a href="https://cms.rbi.org.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">RBI Integrated Ombudsman</a></li>
                        <li>Insurance disputes: IRDAI IGMS Portal</li>
                      </ul>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="font-medium text-sm">Step 3: Legal Recourse</p>
                      <p className="text-sm">Arbitration under Arbitration and Conciliation Act, 1996 (Seat: Mumbai)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Termination</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Either party may terminate this agreement with 30 days written notice. Upon termination:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>You retain ownership of all investments held in your name</li>
                  <li>We will assist in transferring your portfolio to another service provider</li>
                  <li>Outstanding fees and charges must be settled</li>
                  <li>Data retention continues as per regulatory requirements (7 years)</li>
                  <li>Access to premium features will cease immediately</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  For questions about these terms or our services:
                </p>
                <div className="space-y-2 text-muted-foreground">
                  <p><strong>Legal & Compliance:</strong> support@fintekpro.com</p>
                  <p><strong>Customer Support:</strong> support@fintekpro.com</p>
                  <p><strong>Phone:</strong> +91-22-4000-XXXX</p>
                  <p><strong>Registered Office:</strong> FintekPro Financial Services LLP, Mumbai, Maharashtra, India</p>
                  <p><strong>Business Hours:</strong> Monday-Saturday, 9:00 AM - 6:00 PM IST</p>
                </div>
                <div className="mt-4 pt-4 border-t text-muted-foreground">
                  <p><strong>Grievance Officer:</strong> support@fintekpro.com</p>
                  <p className="text-sm">Response within 48 hours as per SEBI guidelines</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              These terms are effective as of January 3, 2026. We reserve the right to update these terms 
              with 30 days notice to registered users via email.
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
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
