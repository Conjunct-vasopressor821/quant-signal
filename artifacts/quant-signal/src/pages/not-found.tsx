import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center">
      <div className="p-6 rounded-full bg-muted/50 mb-6">
        <AlertCircle className="w-16 h-16 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">404 - Not Found</h1>
      <p className="text-lg text-muted-foreground mb-8">The page you are looking for does not exist in the terminal.</p>
      <Link href="/" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
        Return to Dashboard
      </Link>
    </div>
  );
}
