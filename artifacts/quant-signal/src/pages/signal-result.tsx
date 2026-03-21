import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, ShieldAlert, ArrowLeft, RefreshCw, Layers } from "lucide-react";
import { SignalResult } from "@workspace/api-client-react";
import { SignalBadge } from "@/components/SignalBadge";

export default function SignalResultPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<SignalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const encodedData = searchParams.get("data");
      
      if (!encodedData) {
        setError("No signal data found in URL. Please run a new analysis.");
        return;
      }

      const decodedStr = decodeURIComponent(atob(encodedData));
      const parsedData = JSON.parse(decodedStr) as SignalResult;
      setData(parsedData);
    } catch (err) {
      console.error(err);
      setError("Failed to parse signal data. URL might be malformed.");
    }
  }, []);

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 glass-panel rounded-3xl text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto opacity-50" />
        <h2 className="text-2xl font-bold">Error Loading Result</h2>
        <p className="text-muted-foreground">{error}</p>
        <Link href="/analyze" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground">
          Run New Analysis
        </Link>
      </div>
    );
  }

  if (!data) return null; // Or a loading spinner

  const getBannerStyles = (banner: string) => {
    switch (banner) {
      case "Safe": return "bg-primary/10 text-primary border-primary glow-primary";
      case "Caution": return "bg-chart-2/10 text-chart-2 border-chart-2 glow-warning";
      case "Avoid": return "bg-destructive/10 text-destructive border-destructive glow-destructive";
      default: return "bg-muted text-foreground border-border";
    }
  };

  const BannerIcon = data.finalBanner === "Safe" ? ShieldCheck : data.finalBanner === "Caution" ? AlertTriangle : ShieldAlert;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <span className="font-mono text-sm text-muted-foreground">ID: {data.id}</span>
      </div>

      {/* Hero Banner */}
      <div className={`border-2 rounded-3xl p-8 sm:p-12 flex flex-col items-center text-center relative overflow-hidden ${getBannerStyles(data.finalBanner)}`}>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <BannerIcon className="w-16 h-16 mb-4 relative z-10" />
        <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-widest relative z-10">{data.finalBanner}</h1>
        <p className="text-xl font-medium mt-4 opacity-90 relative z-10">AI Final Verdict for {data.symbol}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center items-center text-center gap-4 md:col-span-1 border-primary/20 bg-primary/5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Candidate Signal</p>
          <SignalBadge signal={data.signal} size="lg" />
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between md:col-span-3">
          <div className="text-center px-6 border-r border-border/50 flex-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confidence</p>
            <p className="text-5xl font-black font-mono text-foreground">{data.confidenceScore}<span className="text-2xl text-muted-foreground">%</span></p>
          </div>
          <div className="text-center px-6 border-r border-border/50 flex-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk Score</p>
            <p className="text-5xl font-black font-mono text-destructive">{data.riskScore}<span className="text-2xl text-muted-foreground">%</span></p>
          </div>
          <div className="text-center px-6 flex-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Regime</p>
            <p className="text-2xl font-bold capitalize tracking-tight">{data.marketRegime}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-8 rounded-3xl space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Plain English Explanation
            </h2>
            <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed text-lg">
              {data.explanation.split('\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border-destructive/30 bg-destructive/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-destructive mb-2">Invalidation Zone</h3>
              <p className="font-medium">{data.invalidationZone}</p>
            </div>
            <div className="glass-panel p-6 rounded-2xl border-chart-2/30 bg-chart-2/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-chart-2 mb-2">Suggested Stop Loss</h3>
              <p className="font-mono text-xl font-bold">{data.stopLossSuggestion ? data.stopLossSuggestion.toFixed(4) : "Not specified"}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl h-fit">
          <h3 className="font-bold mb-6 pb-4 border-b border-border/50">Service Breakdown</h3>
          <div className="space-y-6">
            {[
              { name: "Ingestion", desc: data.serviceBreakdown.ingestion },
              { name: "Signal", desc: data.serviceBreakdown.signal },
              { name: "Risk", desc: data.serviceBreakdown.risk },
              { name: "Regime", desc: data.serviceBreakdown.regime },
              { name: "Judge", desc: data.serviceBreakdown.judge },
            ].map((service, i) => (
              <div key={i} className="relative pl-4 border-l-2 border-muted hover:border-primary transition-colors">
                <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-background border border-primary"></span>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{service.name} Agent</p>
                <p className="text-sm text-foreground/90">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-8 flex justify-center pb-12">
        <Link href="/analyze" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border shadow-lg transition-all hover:scale-105">
          <RefreshCw className="w-5 h-5" /> Run Another Analysis
        </Link>
      </div>
    </motion.div>
  );
}
