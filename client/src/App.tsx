import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppShell } from "@/components/AppShell";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Upload from "@/pages/Upload";
import Accounts from "@/pages/Accounts";
import Budgets from "@/pages/Budgets";
import Insights from "@/pages/Insights";
import CardBreakdown from "@/pages/CardBreakdown";
import InvestmentBreakdown from "@/pages/InvestmentBreakdown";
import Subscriptions from "@/pages/Subscriptions";
import Goals from "@/pages/Goals";
import Forecast from "@/pages/Forecast";

function AppRouter() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/upload" component={Upload} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/budgets" component={Budgets} />
        <Route path="/insights" component={Insights} />
        <Route path="/card-breakdown" component={CardBreakdown} />
        <Route path="/investments" component={InvestmentBreakdown} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/goals" component={Goals} />
        <Route path="/forecast" component={Forecast} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
