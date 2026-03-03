import { Link } from "wouter";
import fintekproLogo from "@assets/fintekpro_main_1772539048013.png";
import { 
  Facebook, Twitter, Linkedin, Instagram, Home, UserCheck, Briefcase, Calculator, 
  Store, TrendingUp, CreditCard, Receipt, Users, Bell, Settings, HelpCircle, Shield,
  Crown, Sparkles
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export function Footer() {
  const { isAuthenticated, user } = useAuth();
  const [creditScore, setCreditScore] = useState<number | null>(null);

  useEffect(() => {
    const savedScore = localStorage.getItem('userCreditScore');
    if (savedScore) {
      setCreditScore(parseInt(savedScore));
    }
  }, []);

  const getCreditScoreColor = (score: number) => {
    if (score >= 800) return "text-green-500";
    if (score >= 750) return "text-blue-500";
    if (score >= 700) return "text-yellow-500";
    if (score >= 650) return "text-orange-500";
    return "text-red-500";
  };

  const getCreditGrade = (score: number) => {
    if (score >= 800) return "Excellent";
    if (score >= 750) return "Very Good";
    if (score >= 700) return "Good";
    if (score >= 650) return "Fair";
    return "Poor";
  };

  // Reorganized by process flow
  const gettingStartedLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Profile & KYC", href: "/profile" },
    { name: "Onboarding", href: "/onboarding" },
  ];

  const researchLinks = [
    { name: "Wealth Management", href: "/wealth-management" },
    { name: "Financial Calculators", href: "/calculators" },
    { name: "Professional Services", href: "/professional-services" },
  ];

  const productsLinks = [
    { name: "Product Store", href: "/store" },
    { name: "Mutual Funds", href: "/mutual-funds" },
    { name: "IPO & Pre-IPO", href: "/ipo" },
    { name: "Unlisted Shares", href: "/unlisted" },
    { name: "Bonds & NCDs", href: "/bonds" },
    { name: "MLDs", href: "/mlds" },
    { name: "Insurance Hub", href: "/insurance" },
  ];

  const premiumLinks = [
    { name: "AIF", href: "/aif" },
    { name: "PMS", href: "/pms" },
  ];

  const aiLinks = [
    { name: "AI Portfolio Insights", href: "/portfolio/ai-insights" },
    { name: "AI Rebalancing", href: "/portfolio/rebalancing" },
    { name: "AI Goal Planning", href: "/portfolio/goals" },
    { name: "AI Recommendations", href: "/agent/ai-recommendations" },
  ];

  const investingLinks = [
    { name: "Portfolio", href: "/portfolio" },
    { name: "NSE/BSE Trading", href: "/broking" },
    { name: "Derivatives (F&O)", href: "/derivatives" },
    { name: "Commodities", href: "/commodities" },
    { name: "Global Trading", href: "/global-trading" },
  ];

  const servicesLinks = [
    { name: "Loans", href: "/loans" },
    { name: "Credit Cards", href: "/credit-cards" },
    { name: "Credit Report", href: "/credit-report" },
    { name: "GIFT City IFSC", href: "/gift-city" },
  ];

  const taxLinks = [
    { name: "One-Click Tax Filing", href: "/one-click-tax-filing" },
    { name: "Smart Tax Hub", href: "/tax-hub" },
    { name: "ITR Filing Services", href: "/itr-tax-services" },
  ];

  const familyAlertsLinks = [
    { name: "Family Groups", href: "/families" },
    { name: "Alerts & Notifications", href: "/alerts" },
  ];

  const supportLinks = [
    { name: "Settings", href: "/settings" },
    { name: "Support", href: "/support" },
    { name: "Contact Us", href: "/contact" },
  ];

  const legalLinks = [
    { name: "Terms of Service", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Refund Policy", href: "/refund-policy" },
    { name: "Risk Disclaimer", href: "/disclaimer" },
  ];

  return (
    <footer className="bg-gray-100 dark:bg-gray-900 text-foreground border-t py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-8">
          
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={fintekproLogo} alt="FintekPro" className="h-8 w-8 rounded-lg object-contain" />
              <h3 className="text-xl font-bold" data-testid="footer-company-name">
                FintekPro
              </h3>
            </div>
            <p className="text-muted-foreground mb-4 text-sm" data-testid="footer-company-description">
              Complete financial services platform for investments, trading, loans, tax filing, and wealth management.
            </p>
            <div className="flex space-x-4">
              <Facebook className="text-muted-foreground hover:text-foreground cursor-pointer h-5 w-5" data-testid="social-facebook" />
              <Twitter className="text-muted-foreground hover:text-foreground cursor-pointer h-5 w-5" data-testid="social-twitter" />
              <Linkedin className="text-muted-foreground hover:text-foreground cursor-pointer h-5 w-5" data-testid="social-linkedin" />
              <Instagram className="text-muted-foreground hover:text-foreground cursor-pointer h-5 w-5" data-testid="social-instagram" />
            </div>
          </div>
          
          {/* Getting Started */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-getting-started-title">
              <Home className="h-4 w-4 text-blue-400" />
              Getting Started
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {gettingStartedLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-blue-400 transition-colors cursor-pointer" data-testid={`footer-start-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Research & Planning */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-research-title">
              <Briefcase className="h-4 w-4 text-green-400" />
              Research & Planning
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {researchLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-green-400 transition-colors cursor-pointer" data-testid={`footer-research-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Products & Marketplace */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-products-title">
              <Store className="h-4 w-4 text-purple-400" />
              Products
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {productsLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-purple-400 transition-colors cursor-pointer" data-testid={`footer-product-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Premium Investment */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-premium-title">
              <Crown className="h-4 w-4 text-yellow-400" />
              Premium
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {premiumLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-yellow-400 transition-colors cursor-pointer" data-testid={`footer-premium-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="font-semibold mb-4 mt-6 flex items-center gap-2" data-testid="footer-ai-title">
              <Sparkles className="h-4 w-4 text-violet-400" />
              AI Features
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {aiLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-violet-400 transition-colors cursor-pointer" data-testid={`footer-ai-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Investing & Trading */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-investing-title">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              Investing
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {investingLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-cyan-400 transition-colors cursor-pointer" data-testid={`footer-investing-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Financial Services */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-services-title">
              <CreditCard className="h-4 w-4 text-orange-400" />
              Services
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {servicesLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-orange-400 transition-colors cursor-pointer" data-testid={`footer-service-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Tax & Family */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-tax-title">
              <Receipt className="h-4 w-4 text-indigo-400" />
              Tax & Family
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {taxLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-indigo-400 transition-colors cursor-pointer" data-testid={`footer-tax-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
              {familyAlertsLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-indigo-400 transition-colors cursor-pointer" data-testid={`footer-family-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Settings & Support */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-support-title">
              <Settings className="h-4 w-4 text-pink-400" />
              Support
            </h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span className="hover:text-pink-400 transition-colors cursor-pointer" data-testid={`footer-support-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Credit Score Widget */}
        {isAuthenticated && creditScore && (
          <div className="border-t border-border mt-8 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  <span className="text-muted-foreground font-medium">Your Credit Score:</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getCreditScoreColor(creditScore)}`}>
                    {creditScore}
                  </span>
                  <span className="text-muted-foreground">({getCreditGrade(creditScore)})</span>
                </div>
              </div>
              <Link href="/credit-report">
                <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer text-sm">
                  View Full Report →
                </span>
              </Link>
            </div>
          </div>
        )}

        <div className="border-t border-border mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4">
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4 md:mb-0">
              {legalLinks.map((link, index) => (
                <span key={link.name} className="flex items-center">
                  <Link href={link.href}>
                    <span className="text-muted-foreground hover:text-blue-400 transition-colors cursor-pointer text-sm" data-testid={`footer-legal-${link.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {link.name}
                    </span>
                  </Link>
                  {index < legalLinks.length - 1 && <span className="text-muted-foreground ml-4">|</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="text-center text-muted-foreground text-sm">
            <p data-testid="footer-copyright">
              &copy; 2026 FintekPro Financial Services Pvt. Ltd. All rights reserved. | SEBI Registered Investment Advisor | AMFI Registered Mutual Fund Distributor
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Investments are subject to market risks. Read all related documents carefully before investing.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
