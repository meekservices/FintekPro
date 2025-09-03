import { Link } from "wouter";
import { Facebook, Twitter, Linkedin, Instagram, Store, Package, ShoppingCart, Calculator, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";


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

  const investmentLinks = [
    { name: "Stocks", href: "/markets" },
    { name: "Mutual Funds", href: "/mutual-funds" },
    { name: "IPO", href: "/ipo" },
    { name: "Pre-IPO", href: "/pre-ipo" },
    { name: "Unlisted", href: "/unlisted" },
    { name: "PMS", href: "/pms" },
    { name: "AIF", href: "/aif" },
  ];

  const loanLinks = [
    { name: "Personal Loan", href: "/loans/personal" },
    { name: "Home Loan", href: "/loans/home" },
    { name: "Business Loan", href: "/loans/business" },
    { name: "Education Loan", href: "/loans/education" },
    { name: "LAS", href: "/loans/las" },
  ];

  const supportLinks = [
    { name: "Contact Us", href: "/contact" },
    { name: "Help Center", href: "/help" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
  ];

  const storeLinks = [
    { name: "Browse Products", href: "/store" },
    { name: "Financial Tools", href: "/store?category=tools" },
    { name: "Investment Plans", href: "/store?category=plans" },
    { name: "Premium Services", href: "/store?category=premium" },
  ];

  const calculatorLinks = [
    { name: "EMI Calculator", href: "/calculators" },
    { name: "SIP Calculator", href: "/calculators?tab=sip" },
    { name: "Tax Calculator", href: "/calculators?tab=tax" },
    { name: "Bajaj Finance", href: "/bajaj-finance" },
    { name: "Tata Capital", href: "/tata-capital" },
    { name: "PolicyBazaar", href: "/policybazaar" },
    { name: "Credit Score", href: "/cibil" },
  ];

  return (
    <footer className="bg-finance-gray text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-8">
          
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4" data-testid="footer-company-name">
              FintekPro
            </h3>
            <p className="text-gray-300 mb-4" data-testid="footer-company-description">
              Your complete financial services platform for investments, loans, and wealth management.
            </p>
            <div className="flex space-x-4">
              <Facebook className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-facebook" />
              <Twitter className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-twitter" />
              <Linkedin className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-linkedin" />
              <Instagram className="text-gray-300 hover:text-white cursor-pointer h-5 w-5" data-testid="social-instagram" />
            </div>
          </div>
          
          {/* Investments */}
          <div>
            <h4 className="font-semibold mb-4" data-testid="footer-investments-title">
              Investments
            </h4>
            <ul className="space-y-2 text-gray-300">
              {investmentLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-white transition-colors cursor-pointer flex items-center gap-2"
                      data-testid={`footer-investment-${link.name.toLowerCase().replace(" ", "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Store */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2" data-testid="footer-store-title">
              <Store className="h-4 w-4 text-green-400" />
              Store
            </h4>
            <ul className="space-y-2 text-gray-300">
              {storeLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-green-400 transition-colors cursor-pointer"
                      data-testid={`footer-store-${link.name.toLowerCase().replace(" ", "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Loans */}
          <div>
            <h4 className="font-semibold mb-4" data-testid="footer-loans-title">
              Loans
            </h4>
            <ul className="space-y-2 text-gray-300">
              {loanLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-white transition-colors cursor-pointer"
                      data-testid={`footer-loan-${link.name.toLowerCase().replace(" ", "-")}`}
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
              <Calculator className="h-4 w-4 text-blue-400" />
              Calculators
            </h4>
            <ul className="space-y-2 text-gray-300">
              {calculatorLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-blue-400 transition-colors cursor-pointer"
                      data-testid={`footer-calculator-${link.name.toLowerCase().replace(" ", "-")}`}
                    >
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4" data-testid="footer-support-title">
              Support
            </h4>
            <ul className="space-y-2 text-gray-300">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href}>
                    <span 
                      className="hover:text-white transition-colors cursor-pointer"
                      data-testid={`footer-support-${link.name.toLowerCase().replace(" ", "-")}`}
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
            &copy; 2024 FinanceHub. All rights reserved. | SEBI Registered Investment Advisor
          </p>
        </div>
      </div>
    </footer>
  );
}
