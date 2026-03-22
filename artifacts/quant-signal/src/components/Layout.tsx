import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  CandlestickChart, 
  LayoutDashboard, 
  Activity, 
  Image as ImageIcon, 
  FileSpreadsheet,
  Settings,
  Menu,
  X,
  Radio
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live Chart", icon: Radio },
  { href: "/analyze", label: "Analyze Setup", icon: Activity },
  { href: "/upload/screenshot", label: "Upload Screenshot", icon: ImageIcon },
  { href: "/upload/trades", label: "Upload Trades", icon: FileSpreadsheet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground dark">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 glass-panel flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-64 lg:shrink-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <Link href="/" className="flex items-center gap-3 text-primary hover:text-primary-foreground transition-colors group">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary group-hover:shadow-[0_0_15px_rgba(var(--primary),0.5)] transition-all">
              <CandlestickChart className="w-6 h-6 group-hover:text-primary-foreground transition-colors" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">QuantSignal</span>
          </Link>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.1)]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1 border border-transparent"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="px-4 py-3 rounded-xl bg-accent/30 border border-accent text-xs text-muted-foreground flex items-center justify-between">
            <span>Status</span>
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 lg:hidden flex items-center justify-between px-4 glass-panel z-40 border-b border-border">
          <div className="flex items-center gap-2">
            <CandlestickChart className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">QuantSignal</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
