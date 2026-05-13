import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  AlertTriangle, TrendingUp, Building2, Landmark, Globe, 
  Shield as LucideShield, Scale, Briefcase, Phone, FileWarning
} from "lucide-react";

export default function InvestmentDisclaimer() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.title = "Investment Risk Disclaimer - FintekPro";

    const handleNavChange = (e: CustomEvent) => {
      setIsNavCollapsed(e.detail.collapsed);
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
              <AlertTriangle className="w-12 h-12 text-orange-600 mr-3" />
              <h1 className="text-4xl font-bold text-foreground">Investment Risk Disclaimer</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Important disclosures about investment risks as mandated by SEBI and other regulatory bodies.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: January 3, 2026
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border-2 border-red-300 dark:border-red-700 mb-8">
            <h4 className="font-bold text-red-800 dark:text-red-200 text-lg mb-3">
              SEBI MANDATORY DISCLOSURE
            </h4>
            <p className="text-red-700 dark:text-red-300 font-medium">
              "Investment in securities market are subject to market risks. Read all the related documents carefully before investing."
            </p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-3">
              Registration granted by SEBI, membership of BASL (in case of IAs) and certification from NISM in no way guarantee 
              performance of the intermediary or provide any assurance of returns to investors.
            </p>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileWarning className="w-5 h-5 mr-2 text-orange-600" />
                  General Investment Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li><strong>Market Risk:</strong> Investment values can go down as well as up due to market conditions</li>
                  <li><strong>Capital Risk:</strong> You may receive back less than you originally invested</li>
                  <li><strong>Volatility Risk:</strong> Investment values may fluctuate significantly in short periods</li>
                  <li><strong>Inflation Risk:</strong> Returns may not keep pace with inflation, reducing real value</li>
                  <li><strong>Concentration Risk:</strong> Over-exposure to specific sectors/assets increases vulnerability</li>
                  <li><strong>Timing Risk:</strong> Entering or exiting markets at wrong times can affect returns</li>
                </ul>
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <p className="text-sm font-medium">
                    Past performance is not indicative of future results. Historical returns should not be the sole basis for investment decisions.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  Equity & Stock Market Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Domestic Equity (NSE/BSE)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Price volatility based on company performance, sector trends, and market sentiment</li>
                    <li>Liquidity risk: Some stocks may have limited trading volumes</li>
                    <li>Corporate governance risk: Management decisions can adversely impact stock value</li>
                    <li>Regulatory risk: Changes in government policies affecting specific sectors</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">US/International Equity</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Currency risk: INR/USD fluctuations directly impact returns</li>
                    <li>Geopolitical risk: International events may affect market stability</li>
                    <li>Tax implications: Dividends may be subject to withholding taxes</li>
                    <li>Time zone differences: Market hours differ from Indian trading hours</li>
                    <li>Regulatory differences: Different investor protection frameworks apply</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">IPO Investments</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Listing may be above or below issue price</li>
                    <li>Limited historical data for newly listed companies</li>
                    <li>Lock-in periods may apply for certain categories</li>
                    <li>Allotment is not guaranteed; subject to oversubscription</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Unlisted Securities</h4>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800 mb-2">
                    <p className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                      HIGH RISK - Suitable only for sophisticated investors with Enhanced/Accredited KYC
                    </p>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Extremely limited liquidity: No organized exchange for trading</li>
                    <li>Price discovery challenges: No transparent market pricing mechanism</li>
                    <li>Information asymmetry: Limited disclosure compared to listed companies</li>
                    <li>Transfer restrictions: Share transfer may require company approval</li>
                    <li>Counterparty risk: Deals depend on buyer/seller fulfillment</li>
                    <li>Regulatory compliance: SEBI/RBI norms applicable; red flag screening in place</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                  Mutual Fund Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800 mb-4">
                  <p className="text-blue-700 dark:text-blue-300 text-sm">
                    Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">By Fund Category</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>Equity Funds:</strong> High risk, suitable for long-term (5+ years)</li>
                    <li><strong>Debt Funds:</strong> Moderate risk, subject to interest rate and credit risk</li>
                    <li><strong>Hybrid Funds:</strong> Balanced risk based on equity-debt allocation</li>
                    <li><strong>Liquid Funds:</strong> Low risk but not risk-free; subject to credit events</li>
                    <li><strong>Sectoral/Thematic:</strong> High concentration risk in specific sectors</li>
                    <li><strong>International Funds:</strong> Currency and geopolitical risks in addition to market risk</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">ELSS Funds</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Mandatory 3-year lock-in period from each investment date</li>
                    <li>No premature withdrawal permitted regardless of circumstances</li>
                    <li>Tax benefit under Section 80C (up to ₹1.5 lakhs)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Landmark className="w-5 h-5 mr-2 text-blue-600" />
                  Fixed Income & Bond Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Interest Rate Risk</h4>
                  <p className="text-muted-foreground">
                    Bond prices move inversely to interest rates. When rates rise, existing bond values decrease, and vice versa.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Credit Risk</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Risk of issuer defaulting on interest or principal payments</li>
                    <li>Credit rating downgrades can reduce bond values</li>
                    <li>Corporate bonds carry higher credit risk than government securities</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Liquidity Risk</h4>
                  <p className="text-muted-foreground">
                    Some bonds may have limited secondary market trading, making it difficult to sell before maturity at fair value.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Market Linked Debentures (MLDs)</h4>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800 mb-2">
                    <p className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                      HIGH RISK - Accredited Investor status required
                    </p>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Returns linked to underlying market indices or benchmarks</li>
                    <li>Principal protection not guaranteed in all structures</li>
                    <li>Complex payoff structures requiring investor understanding</li>
                    <li>Limited liquidity; early exit may incur losses</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
                  Alternative Investment Risks (PMS/AIF)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-200 dark:border-red-800 mb-4">
                  <h4 className="font-bold text-red-800 dark:text-red-200 mb-2">SEBI ACCREDITED INVESTOR REQUIREMENT</h4>
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    PMS requires minimum investment of ₹50 lakhs. AIFs require minimum ₹1 crore (Category III) or as per scheme.
                    These products are suitable only for sophisticated investors who understand and can bear the risks involved.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Portfolio Management Services (PMS)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Concentrated portfolio risk: Fewer holdings than diversified mutual funds</li>
                    <li>Manager risk: Performance depends on portfolio manager's skill and decisions</li>
                    <li>Higher fee structures: Management fees + performance fees</li>
                    <li>Less transparency compared to mutual funds</li>
                    <li>Exit loads may apply during lock-in period</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Alternative Investment Funds (AIF)</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Illiquidity: Long lock-in periods (typically 3-7 years)</li>
                    <li>Complex strategies: May use leverage, derivatives, short-selling</li>
                    <li>Valuation challenges: NAV may be infrequent (monthly/quarterly)</li>
                    <li>High minimum investment: ₹1 crore or more</li>
                    <li>Limited redemption windows</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">REITs & InvITs</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Real estate/infrastructure sector-specific risks</li>
                    <li>Interest rate sensitivity affecting valuations</li>
                    <li>Tenant/project concentration risks</li>
                    <li>Regulatory changes in real estate/infrastructure sectors</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-600" />
                  NRI & Cross-Border Investment Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li><strong>Currency Risk:</strong> Fluctuations between INR and residence country currency</li>
                  <li><strong>Repatriation Restrictions:</strong> FEMA regulations govern fund repatriation</li>
                  <li><strong>Double Taxation:</strong> May be subject to taxes in both countries (relief via DTAA)</li>
                  <li><strong>Regulatory Complexity:</strong> Must comply with regulations of multiple jurisdictions</li>
                  <li><strong>Investment Restrictions:</strong> Certain sectors/instruments may be restricted for NRIs</li>
                  <li><strong>Documentation Requirements:</strong> Additional compliance documentation needed</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LucideShield className="w-5 h-5 mr-2 text-blue-600" />
                  Insurance Product Risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Insurance products distributed through FintekPro are subject to IRDAI regulations:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>ULIPs: Subject to market risks similar to mutual funds</li>
                  <li>Traditional plans: Returns are not guaranteed; bonus depends on insurer performance</li>
                  <li>Term insurance: No maturity benefit; claim settlement subject to policy terms</li>
                  <li>Health insurance: Exclusions and waiting periods apply</li>
                  <li>Surrender charges may apply for early exit from long-term policies</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  "Insurance is the subject matter of solicitation. IRDAI Registration details available on request."
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Scale className="w-5 h-5 mr-2 text-blue-600" />
                  AI Recommendations Disclaimer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-muted-foreground">
                    FintekPro uses AI-powered analysis to generate investment insights and recommendations. These are:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-3">
                    <li>Advisory in nature and not personalized investment advice</li>
                    <li>Based on historical data and algorithmic models</li>
                    <li>Not a guarantee of future performance or outcomes</li>
                    <li>Subject to model limitations and data quality</li>
                    <li>Should be considered alongside professional financial advice</li>
                  </ul>
                </div>
                <p className="text-sm font-medium">
                  Always conduct your own research and consult with a qualified financial advisor before making investment decisions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                  Limitation of Liability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  FintekPro, its directors, employees, and affiliates shall not be liable for:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Any investment losses arising from market conditions</li>
                  <li>Decisions made based on information or recommendations provided</li>
                  <li>Third-party product performance (mutual funds, PMS, insurance)</li>
                  <li>Technical failures of exchanges, depositories, or payment systems</li>
                  <li>Regulatory changes affecting investment products or tax treatment</li>
                  <li>Force majeure events beyond reasonable control</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-blue-600" />
                  Grievance Redressal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">For Investment-Related Complaints</h4>
                    <p className="text-muted-foreground">
                      <strong>SEBI SCORES:</strong> <a href="https://scores.sebi.gov.in" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">https://scores.sebi.gov.in</a><br />
                      <strong>NSE:</strong> <a href="https://investorhelpline.nseindia.com" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">https://investorhelpline.nseindia.com</a><br />
                      <strong>BSE:</strong> <a href="https://www.bseindia.com/investors" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">https://www.bseindia.com/investors</a>
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">FintekPro Grievance Officer</h4>
                    <p className="text-muted-foreground">
                      <strong>Email:</strong> grievance@fintekpro.com<br />
                      <strong>Response Time:</strong> Acknowledgment within 48 hours, resolution within 30 days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-orange-700 dark:text-orange-300 font-medium text-sm">
                By using FintekPro's services, you acknowledge that you have read, understood, and accepted these risk disclosures.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This disclaimer is effective as of January 3, 2026. Updated as required by regulatory changes.
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
