import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { UploadCloud, CheckCircle2, Copy, FileImage, AlertCircle, ArrowRight } from "lucide-react";
import { useUploadScreenshot } from "@workspace/api-client-react";

export default function UploadScreenshot() {
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [copied, setCopied] = useState(false);

  const { mutate: upload, data, isPending, error } = useUploadScreenshot();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    multiple: false
  });

  const handleUpload = () => {
    if (!file) return;
    upload({ data: { file, symbol: symbol || undefined, timeframe: timeframe || undefined } });
  };

  const copyToClipboard = () => {
    if (data?.fileId) {
      navigator.clipboard.writeText(data.fileId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Chart Screenshot</h1>
        <p className="text-muted-foreground mt-1">Provide visual context for your trade analysis.</p>
      </div>

      {!data ? (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80">Symbol (Optional)</label>
              <input
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="BTCUSDT"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80">Timeframe (Optional)</label>
              <input
                value={timeframe}
                onChange={e => setTimeframe(e.target.value)}
                placeholder="1h"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px]
              ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
              ${file ? "border-primary/50 bg-primary/5" : ""}
            `}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-2">
                  <FileImage className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-lg">{file.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <p className="text-xs text-primary mt-4 font-medium">Click or drag to replace</p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center opacity-70">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-lg">Drag & drop your screenshot</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse files (PNG, JPG, WEBP)</p>
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
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg bg-primary text-primary-foreground shadow-lg glow-primary hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Uploading..." : "Upload Screenshot"}
          </button>
        </div>
      ) : (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/30">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary glow-primary">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Upload Successful</h2>
            <p className="text-muted-foreground mt-2">{data.filename} has been securely stored.</p>
          </div>
          
          <div className="max-w-sm mx-auto p-4 bg-muted/50 border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="truncate text-left">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">File ID</p>
              <p className="font-mono text-sm truncate">{data.fileId}</p>
            </div>
            <button 
              onClick={copyToClipboard}
              className="p-2 bg-background border border-border rounded-lg hover:border-primary hover:text-primary transition-colors"
              title="Copy ID"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="pt-6">
            <Link 
              href={`/analyze?screenshotFileId=${data.fileId}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg glow-primary hover:-translate-y-0.5 transition-all"
            >
              Use in Analysis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
