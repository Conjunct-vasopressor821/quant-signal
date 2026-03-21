import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";

// Pages
import Dashboard from "@/pages/dashboard";
import AnalyzeSetup from "@/pages/analyze";
import UploadScreenshot from "@/pages/upload-screenshot";
import UploadTrades from "@/pages/upload-trades";
import SignalResultPage from "@/pages/signal-result";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/analyze" component={AnalyzeSetup} />
        <Route path="/upload/screenshot" component={UploadScreenshot} />
        <Route path="/upload/trades" component={UploadTrades} />
        <Route path="/signals/:id" component={SignalResultPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
