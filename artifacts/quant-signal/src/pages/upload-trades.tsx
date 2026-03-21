import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { UploadCloud, CheckCircle2, Copy, FileSpreadsheet, AlertCircle, ArrowRight } from "lucide-react";
import { useUploadTrades } from "@workspace/api-client-react";

export default function UploadTrades() {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: upload, data, isPending, error } = useUploadTrades();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    multiple: false
  });

  const handleUpload = () => {
    if (!file) return;
    upload({ data: { file } });
  };

  const copyToClipboard = () => {
    if (data?.fileId) {
      navigator.clipboard.writeText(data.fileId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Trade History</h1>
        <p className="text-muted-foreground mt-1">Provide your recent performance history as context.</p>
      </div>

      {!data ? (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px]
              ${isDragActive ? "border-chart-4 bg-chart-4/5" : "border-border hover:border-chart-4/50 hover:bg-muted/30"}
              ${file ? "border-chart-4/50 bg-chart-4/5" : ""}
            `}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-chart-4/20 flex items-center justify-center text-chart-4 mb-2">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-lg">{file.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <p className="text-xs text-chart-4 mt-4 font-medium">Click or drag to replace</p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center opacity-70">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-lg">Drag & drop your CSV</p>
                  <p className="text-sm text-muted-foreground mt-1">Must contain columns: date, symbol, side, entry, exit, pnl</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error.message || "Failed to upload file"}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg bg-chart-4 text-white shadow-lg shadow-chart-4/20 hover:bg-chart-4/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Parsing CSV..." : "Upload & Parse Trades"}
          </button>
        </div>
      ) : (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
          <div className="glass-panel p-8 rounded-3xl border-chart-4/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-chart-4/20 rounded-full flex items-center justify-center text-chart-4 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Successfully Parsed</h2>
                <p className="text-muted-foreground mt-1">Found <strong className="text-foreground">{data.totalRecords}</strong> valid trades in {data.filename}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2 p-2 px-4 bg-muted/50 border border-border rounded-xl">
                <span className="font-mono text-sm truncate max-w-[120px]">{data.fileId}</span>
                <button onClick={copyToClipboard} className="text-muted-foreground hover:text-foreground">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-chart-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <Link 
                href={`/analyze?tradeFileId=${data.fileId}`}
                className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-xl font-bold bg-chart-4 text-white shadow-lg shadow-chart-4/20 hover:-translate-y-0.5 transition-all whitespace-nowrap"
              >
                Use in Analysis
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-border/50">
            <div className="p-4 border-b border-border/50 bg-card/40">
              <h3 className="font-bold">Parsed Records Preview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                    <th className="p-4">Date</th>
                    <th className="p-4">Symbol</th>
                    <th className="p-4">Side</th>
                    <th className="p-4 text-right">Entry</th>
                    <th className="p-4 text-right">Exit</th>
                    <th className="p-4 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-sm">
                  {data.parsedRecords.slice(0, 10).map((record, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="p-4 text-muted-foreground">{record.date}</td>
                      <td className="p-4 font-bold">{record.symbol}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${record.side === 'buy' || record.side === 'long' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                          {record.side}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">{record.entry.toFixed(4)}</td>
                      <td className="p-4 text-right font-mono">{record.exit.toFixed(4)}</td>
                      <td className={`p-4 text-right font-mono font-bold ${record.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {record.pnl > 0 ? '+' : ''}{record.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {data.parsedRecords.length > 10 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground text-sm italic">
                        + {data.parsedRecords.length - 10} more records...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
