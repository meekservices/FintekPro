import { Link } from "wouter";
import { Facebook, Twitter, Linkedin, Instagram, Store, Package, ShoppingCart, Calculator, Shield, CreditCard, Heart, TrendingUp, PieChart, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";


export function Footer() {
  const { isAuthenticated, user } = useAuth();
  const [creditScore, setCreditScore] = useState<number | null>(null);

  // Load credit score from localStorage or fetch if needed
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

  // Trading & Markets - Aligned with navigation
  const tradingLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Portfolio Management", href: "/portfolio" },
    { name: "Live Markets", href: "/markets" },
    { name: "Broking Terminal", href: "/broking" },
    { name: "IPO Center", href: "/ipo" },
    { name: "Pre-IPO Investments", href: "/pre-ipo" },
  ];

  // Investments - Aligned with navigation
  const investmentLinks = [
    { name: "Mutual Funds", href: "/mutual-funds" },
    { name: "SIP Calculator", href: "/calculators?tool=sip" },
    { name: "InvestSmart", href: "/investsmart" },
    { name: "AIF Investments", href: "/aif" },
    { name: "Investment Proposals", href: "/proposals" },
    { name: "Unlisted Shares", href: "/unlisted" },
  ];

  // Financial Services - Loans & Credit (Aligned with navigation)
  const loanLinks = [
    { name: "All Loans", href: "/loans" },
    { name: "ICICI Bank Loans", href: "/icici-loans" },
    { name: "HDFC Bank Loans", href: "/hdfc-loans" },
    { name: "Bajaj Finance", href: "/bajaj-finance" },
    { name: "Tata Capital", href: "/tata-capital" },
    { name: "Loan Dashboard", href: "/loan-dashboard" },
  ];

  // Financial Services - Insurance (Aligned with navigation)
  const insuranceLinks = [
    { name: "PolicyBazaar", href: "/policybazaar" },
    { name: "CIBIL Score", href: "/cibil" },
  ];

  // Tools & Services - Calculators (Aligned with navigation)
  const calculatorLinks = [
    { name: "All Calculators", href: "/calculators" },
    { name: "SIP Calculator", href: "/calculators?tool=sip" },
    { name: "EMI Calculator", href: "/calculators?tool=emi" },
    { name: "Tax Calculator", href: "/calculators?tool=tax" },
  ];

  // Tools & Services - Reports & Analysis (Aligned with navigation)
  const reportsLinks = [
    { name: "Market Research", href: "/agricultural-insights" },
    { name: "NSDL Services", href: "/nsdl-services" },
    { name: "CDSL Services", href: "/cdsl-services" },
    { name: "CAMS Services", href: "/cams-services" },
    { name: "Kfintech Services", href: "/kfintech-services" },
  ];

  // Tools & Services - Store (Aligned with navigation)
  const storeLinks = [
    { name: "Product Store", href: "/store" },
    { name: "Shopping Cart", href: "/cart" },
  ];

  // Support (Aligned with navigation)
  const supportLinks = [
    { name: "Contact Us", href: "/contact" },
    { name: "Support & Help", href: "/support" },
    { name: "DigiLocker", href: "/digilocker" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
  ];

  return (
    <footer className="bg-finance-gray text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-8">
          
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4" data-testid="footer-company-name">
              FintekPro
            </h3>
            <p className="text-gray-300 mb-4" data-testid="footer-company-description">
              Your complete financial services platform for investments, loans, and smart investment solutions.
            </p>
            <div className="flex space-x-4">
              <Facebook className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-facebook" />
              <Twitter className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-twitter" />
              <Linkedin className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-linkedin" />
              <Instagram className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-instagram" />
            </div>
          </div>
          
          {/* Trading & Markets */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-trading-title">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Trading & Markets
            </h4>
            <ul className="space-y-2 text-gray-300">
              {tradingLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-blue-500 transition-colors cursor-pointer"
                      data-testid={`footer-trading-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Investments */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-investments-title">
              <PieChart className="h-4 w-4 text-green-500" />
              Investments
            </h4>
            <ul className="space-y-2 text-gray-300">
              {investmentLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-green-500 transition-colors cursor-pointer"
                      data-testid={`footer-investment-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Loans & Credit */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-loans-title">
              <CreditCard className="h-4 w-4 text-orange-500" />
              Loans & Credit
            </h4>
            <ul className="space-y-2 text-gray-300">
              {loanLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-orange-500 transition-colors cursor-pointer"
                      data-testid={`footer-loan-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Insurance */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-insurance-title">
              <Shield className="h-4 w-4 text-red-500" />
              Insurance
            </h4>
            <ul className="space-y-2 text-gray-300">
              {insuranceLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-red-500 transition-colors cursor-pointer"
                      data-testid={`footer-insurance-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Calculators */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-calculators-title">
              <Calculator className="h-4 w-4 text-purple-500" />
              Calculators
            </h4>
            <ul className="space-y-2 text-gray-300">
              {calculatorLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-purple-500 transition-colors cursor-pointer"
                      data-testid={`footer-calculator-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Reports & Analysis */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-reports-title">
              <FileText className="h-4 w-4 text-indigo-500" />
              Reports & Analysis
            </h4>
            <ul className="space-y-2 text-gray-300">
              {reportsLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-indigo-500 transition-colors cursor-pointer"
                      data-testid={`footer-reports-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Store & Support */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-store-title">
              <Store className="h-4 w-4 text-green-400" />
              Store & Support
            </h4>
            <ul className="space-y-2 text-gray-300">
              {storeLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-green-400 transition-colors cursor-pointer"
                      data-testid={`footer-store-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-green-400 transition-colors cursor-pointer"
                      data-testid={`footer-support-${link.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
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
          <div className="border-t border-gray-600 mt-8 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  <span className="text-gray-300 font-medium">Your Credit Score:</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getCreditScoreColor(creditScore)}`}>
                    {creditScore}
                  </span>
                  <span className="text-gray-400">({getCreditGrade(creditScore)})</span>
                </div>
              </div>
              <Link href="/cibil">
                <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer text-sm">
                  View Full Report →
                </span>
              </Link>
            </div>
          </div>
        )}

        <div className="border-t border-gray-600 mt-8 pt-8 text-center text-gray-300">
          <p data-testid="footer-copyright">
            &copy; 2025 FintekPro. All rights reserved. | Registered Distributor of financial & Investment products.
          </p>
        </div>
      </div>
    </footer>
  );
}
