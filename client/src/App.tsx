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
import NotFound from "@/pages/not-found";

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
