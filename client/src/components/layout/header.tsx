import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Search, Menu, User, HelpCircle } from "lucide-react";

interface HeaderProps {
  onStartTutorial?: () => void;
}

export function Header({ onStartTutorial }: HeaderProps = {}) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navigation = [
    { name: "Markets", href: "/markets" },
    { name: "Portfolio", href: "/portfolio" },
    { name: "Agricultural Insights", href: "/agricultural-insights" },
    { name: "IPO", href: "/ipo" },
    { name: "Mutual Funds", href: "/mutual-funds" },
    { name: "Bonds", href: "/bonds" },
    { name: "Loans", href: "/loans" },
    { name: "NSDL Services", href: "/nsdl-services" },
    { name: "CDSL Services", href: "/cdsl-services" },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/">
                <h1 className="text-2xl font-bold text-finance-blue cursor-pointer" data-testid="logo">
                  FinanceHub
                </h1>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <span
                    className={`font-medium transition-colors cursor-pointer ${
                      location === item.href
                        ? "text-finance-blue"
                        : "text-gray-700 hover:text-finance-blue"
                    }`}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {item.name}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Input
                type="text"
                placeholder="Search stocks, MF, news..."
                className="w-64 pl-10"
                data-testid="search-input"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>

            {/* Tutorial Button */}
            {onStartTutorial && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onStartTutorial}
                className="hidden md:inline-flex"
                data-testid="header-tutorial-button"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Tutorial
              </Button>
            )}

            {/* Desktop Login Button */}
            <Button className="hidden md:inline-flex" data-testid="login-button">
              <User className="h-4 w-4 mr-2" />
              Login
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden" data-testid="mobile-menu-trigger">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col space-y-4 pt-6">
                  {/* Mobile Search */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search stocks, MF, news..."
                      className="pl-10"
                      data-testid="mobile-search-input"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col space-y-2">
                    {navigation.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={`block px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                            location === item.href
                              ? "bg-finance-blue text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                          onClick={() => setIsOpen(false)}
                          data-testid={`mobile-nav-${item.name.toLowerCase().replace(" ", "-")}`}
                        >
                          {item.name}
                        </div>
                      </Link>
                    ))}
                  </nav>

                  {/* Mobile Login */}
                  <Button className="w-full" data-testid="mobile-login-button">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
