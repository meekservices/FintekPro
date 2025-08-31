import { Link } from "wouter";
import { Facebook, Twitter, Linkedin, Instagram, Store, Package, ShoppingCart } from "lucide-react";


export function Footer() {
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
  ];

  const supportLinks = [
    { name: "Help Center", href: "/help" },
    { name: "Contact Us", href: "/contact" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
  ];

  const storeLinks = [
    { name: "Browse Products", href: "/store" },
    { name: "Financial Tools", href: "/store?category=tools" },
    { name: "Investment Plans", href: "/store?category=plans" },
    { name: "Premium Services", href: "/store?category=premium" },
  ];

  return (
    <footer className="bg-finance-gray text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
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
                      className="hover:text-white transition-colors cursor-pointer"
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
        
        
        <div className="border-t border-gray-600 mt-8 pt-8 text-center text-gray-300">
          <p data-testid="footer-copyright">
            &copy; 2024 FinanceHub. All rights reserved. | SEBI Registered Investment Advisor
          </p>
        </div>
      </div>
    </footer>
  );
}
