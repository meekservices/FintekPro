import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Markets from "@/pages/markets";
import IPO from "@/pages/ipo";
import MutualFunds from "@/pages/mutual-funds";
import Bonds from "@/pages/bonds";
import Loans from "@/pages/loans";
import NSDLServices from "@/pages/nsdl-services";
import CDSLServices from "@/pages/cdsl-services";
import AgriculturalInsights from "@/pages/agricultural-insights";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile";
import AdminPanel from "@/pages/admin-panel";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/markets" component={Markets} />
      <Route path="/ipo" component={IPO} />
      <Route path="/mutual-funds" component={MutualFunds} />
      <Route path="/bonds" component={Bonds} />
      <Route path="/loans" component={Loans} />
      <Route path="/nsdl-services" component={NSDLServices} />
      <Route path="/cdsl-services" component={CDSLServices} />
      <Route path="/agricultural-insights" component={AgriculturalInsights} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
