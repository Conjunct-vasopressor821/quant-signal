import { useCheckSettings } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Key, Database, Server } from "lucide-react";

export default function Settings() {
  const { data, isLoading, isError } = useCheckSettings();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-1">Manage integrations and platform configuration.</p>
      </div>

      <div className="space-y-6">
        {/* API Key Status */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Gemini AI Provider</h2>
                <p className="text-muted-foreground mt-1 text-sm max-w-lg">
                  QuantSignal uses Google's Gemini API to process strategy notes, regimes, and complex reasoning.
                </p>
              </div>
            </div>
            
            <div className="shrink-0 mt-2">
              {isLoading ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" /> Checking...
                </span>
              ) : isError ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5" /> Error
                </span>
              ) : data?.geminiApiKeyConfigured ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/20 text-destructive border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5" /> Missing Key
                </span>
              )}
            </div>
          </div>

          {data && !data.geminiApiKeyConfigured && (
            <div className="mt-6 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm">
              <p className="font-semibold text-destructive mb-2">Action Required</p>
              <p className="text-muted-foreground mb-4">Please set the <code className="bg-background px-1.5 py-0.5 rounded text-foreground">GEMINI_API_KEY</code> environment variable in your Replit Secrets panel and restart the server.</p>
            </div>
          )}
        </div>

        {/* Database Status */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-chart-4/10 flex items-center justify-center text-chart-4 shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">PostgreSQL Storage</h2>
                <p className="text-muted-foreground mt-1 text-sm max-w-lg">
                  Persistent storage for signal history and analysis runs.
                </p>
              </div>
            </div>
            
            <div className="shrink-0 mt-2">
              {isLoading ? null : data?.databaseConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/20 text-destructive border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5" /> Disconnected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="glass-panel p-6 rounded-3xl border border-border/50 bg-muted/10">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <Server className="w-5 h-5" />
            <h3 className="font-bold text-foreground">System Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-mono font-medium">{data?.version || "MVP-0.1.0"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Environment</p>
              <p className="font-mono font-medium capitalize">Production</p>
            </div>
            <div className="col-span-2 mt-4 pt-4 border-t border-border/50">
              <p className="text-muted-foreground italic">Note: Live market data ingestion via WebSocket/REST is currently out of scope for the MVP. Please use manual setups or CSV uploads.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
