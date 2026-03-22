import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type UTCTimestamp, ColorType } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Radio, RefreshCw, TrendingUp, TrendingDown,
  Minus, ShieldCheck, AlertTriangle, ShieldAlert, Clock,
  ChevronDown, Wifi, WifiOff
} from "lucide-react";
import { SignalBadge } from "@/components/SignalBadge";
import { format } from "date-fns";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
const TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;

type Symbol = typeof SYMBOLS[number];
type Timeframe = typeof TIMEFRAMES[number];

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LiveSignal {
  signal: string;
  confidenceScore: number;
  riskScore: number;
  marketRegime: string;
  explanation: string;
  invalidationZone: string;
  stopLossSuggestion?: number;
  targetZone?: number;
  finalBanner: string;
  signalId: string;
  computedAt: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  return price.toFixed(6);
}

export default function LiveChartPage() {
  const [symbol, setSymbol] = useState<Symbol>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [latestCandle, setLatestCandle] = useState<Candle | null>(null);
  const [latestSignal, setLatestSignal] = useState<LiveSignal | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [isClosed, setIsClosed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(156, 163, 175, 1)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    resizeObserverRef.current = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserverRef.current.observe(chartContainerRef.current);
  }, []);

  const loadHistory = useCallback(async (sym: Symbol, tf: Timeframe) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${BASE_URL}/api/market/candles?symbol=${sym}&timeframe=${tf}&limit=300`);
      if (!res.ok) throw new Error("Failed to fetch candles");
      const data = (await res.json()) as { candles: Candle[] };

      if (seriesRef.current && data.candles.length > 0) {
        const chartData: CandlestickData<UTCTimestamp>[] = data.candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.setData(chartData);
        chartRef.current?.timeScale().scrollToRealTime();
        setLatestCandle(data.candles[data.candles.length - 1]);
      }
    } catch {
      // Ignore - SSE will keep updating
    } finally {
      setIsLoadingHistory(false);
    }
  }, [BASE_URL]);

  const connectSSE = useCallback((sym: Symbol, tf: Timeframe) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus("connecting");

    const url = `${BASE_URL}/api/market/stream?symbol=${sym}&timeframe=${tf}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(e.data) as {
          type: string;
          candle: Candle;
          isClosed: boolean;
          signal?: LiveSignal;
          ts: number;
        };

        if (payload.type === "connected") {
          setConnectionStatus("connected");
          return;
        }

        const { candle, isClosed: closed, signal } = payload;
        setLatestCandle(candle);
        setIsClosed(closed);
        setLastUpdated(new Date(payload.ts));

        if (seriesRef.current) {
          seriesRef.current.update({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
          chartRef.current?.timeScale().scrollToRealTime();
        }

        if (payload.type === "candle_closed" && signal) {
          setSignalLoading(false);
          setLatestSignal(signal);
        } else if (payload.type === "candle_closed") {
          setSignalLoading(true);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnectionStatus("error");
      es.close();
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connectSSE(sym, tf);
        }
      }, 5000);
    };

    es.onopen = () => {
      setConnectionStatus("connected");
    };
  }, [BASE_URL]);

  useEffect(() => {
    initChart();
    return () => {
      resizeObserverRef.current?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [initChart]);

  useEffect(() => {
    setLatestSignal(null);
    setSignalLoading(false);
    loadHistory(symbol, timeframe);
    connectSSE(symbol, timeframe);

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [symbol, timeframe, loadHistory, connectSSE]);

  const getBannerIcon = (banner: string) => {
    if (banner === "Safe") return <ShieldCheck className="w-5 h-5 text-primary" />;
    if (banner === "Caution") return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    return <ShieldAlert className="w-5 h-5 text-destructive" />;
  };

  const getPriceChange = () => {
    if (!latestCandle) return null;
    const change = latestCandle.close - latestCandle.open;
    const pct = (change / latestCandle.open) * 100;
    return { change, pct, isPositive: change >= 0 };
  };

  const priceChange = getPriceChange();
  const isConnected = connectionStatus === "connected";

  return (
    <div className="flex flex-col h-full gap-4" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight">Live Chart</h1>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex gap-1 glass-panel rounded-xl p-1 border border-border/50">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${symbol === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.replace("USDT", "")}
              </button>
            ))}
          </div>

          <div className="flex gap-1 glass-panel rounded-xl p-1 border border-border/50">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${isConnected
            ? "bg-primary/10 text-primary border-primary/30"
            : connectionStatus === "connecting"
              ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          }`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connectionStatus === "connecting" ? "Connecting..." : isConnected ? "Live" : "Disconnected"}
          </div>
        </div>
      </div>

      {/* Chart + Panel Row */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chart */}
        <div className="flex-1 glass-panel rounded-2xl border border-border/50 overflow-hidden relative min-w-0">
          {isLoadingHistory && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}

          <div className="absolute top-3 left-4 z-10 flex items-center gap-3">
            <span className="font-bold text-sm tracking-wider text-muted-foreground">{symbol} · {timeframe}</span>
            {latestCandle && (
              <span className={`text-lg font-mono font-bold ${priceChange?.isPositive ? "text-green-400" : "text-red-400"}`}>
                {formatPrice(latestCandle.close)}
              </span>
            )}
            {priceChange && (
              <span className={`text-xs font-semibold flex items-center gap-1 ${priceChange.isPositive ? "text-green-400" : "text-red-400"}`}>
                {priceChange.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceChange.isPositive ? "+" : ""}{priceChange.pct.toFixed(2)}%
              </span>
            )}
          </div>

          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* Analysis Panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Price card */}
          <div className="glass-panel rounded-2xl p-4 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Price</p>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-black font-mono ${priceChange?.isPositive !== false ? "text-green-400" : "text-red-400"}`}>
                {latestCandle ? formatPrice(latestCandle.close) : "—"}
              </span>
              {priceChange && (
                <span className={`text-xs font-bold pb-0.5 ${priceChange.isPositive ? "text-green-400" : "text-red-400"}`}>
                  {priceChange.isPositive ? "▲" : "▼"} {Math.abs(priceChange.pct).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <span>H: <span className="text-foreground font-mono">{latestCandle ? formatPrice(latestCandle.high) : "—"}</span></span>
              <span>L: <span className="text-foreground font-mono">{latestCandle ? formatPrice(latestCandle.low) : "—"}</span></span>
            </div>
          </div>

          {/* Candle status */}
          <div className="glass-panel rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Candle Status</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isClosed
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
              }`}>
                {isClosed ? "Closed" : "Live"}
              </span>
            </div>
            {latestCandle && (
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <div className="text-muted-foreground">Open</div>
                <div className="font-mono text-right">{formatPrice(latestCandle.open)}</div>
                <div className="text-muted-foreground">Close</div>
                <div className={`font-mono text-right ${latestCandle.close >= latestCandle.open ? "text-green-400" : "text-red-400"}`}>
                  {formatPrice(latestCandle.close)}
                </div>
                <div className="text-muted-foreground">Volume</div>
                <div className="font-mono text-right text-foreground">{latestCandle.volume.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
              </div>
            )}
          </div>

          {/* Signal */}
          <AnimatePresence mode="wait">
            {signalLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel rounded-2xl p-4 border border-border/50 flex flex-col items-center gap-3 py-8"
              >
                <Activity className="w-8 h-8 text-primary animate-pulse" />
                <p className="text-sm font-medium text-muted-foreground">Analyzing closed candle...</p>
              </motion.div>
            ) : latestSignal ? (
              <motion.div
                key={latestSignal.signalId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-panel rounded-2xl p-4 border border-border/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signal</p>
                  <div className="flex items-center gap-1.5">
                    {getBannerIcon(latestSignal.finalBanner)}
                    <span className="text-xs font-bold text-muted-foreground">{latestSignal.finalBanner}</span>
                  </div>
                </div>

                <SignalBadge signal={latestSignal.signal} size="lg" />

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-lg font-black font-mono text-foreground">{latestSignal.confidenceScore}%</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-2.5">
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                    <p className="text-lg font-black font-mono text-destructive">{latestSignal.riskScore}%</p>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/20 p-2.5">
                  <p className="text-xs text-muted-foreground mb-1">Regime</p>
                  <p className="text-sm font-bold capitalize">{latestSignal.marketRegime}</p>
                </div>

                {latestSignal.stopLossSuggestion && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-destructive/10 p-2 border border-destructive/20">
                      <p className="text-destructive font-semibold mb-0.5">Stop</p>
                      <p className="font-mono font-bold text-foreground">{formatPrice(latestSignal.stopLossSuggestion)}</p>
                    </div>
                    {latestSignal.targetZone && (
                      <div className="rounded-lg bg-primary/10 p-2 border border-primary/20">
                        <p className="text-primary font-semibold mb-0.5">Target</p>
                        <p className="font-mono font-bold text-foreground">{formatPrice(latestSignal.targetZone)}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-xl bg-muted/10 p-2.5 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Invalidation</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{latestSignal.invalidationZone}</p>
                </div>

                <div className="text-xs leading-relaxed text-muted-foreground border-t border-border/30 pt-2">
                  {latestSignal.explanation.slice(0, 180)}{latestSignal.explanation.length > 180 ? "..." : ""}
                </div>

                {lastUpdated && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    {format(lastUpdated, "HH:mm:ss")}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel rounded-2xl p-4 border border-border/50 flex flex-col items-center gap-3 py-8 text-center"
              >
                <Minus className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Waiting for candle close...</p>
                <p className="text-xs text-muted-foreground/60">Signal analysis runs on each completed candle</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-xs text-center text-muted-foreground/40 pb-2">
            Data via Kraken · Updates in real time
          </div>
        </div>
      </div>
    </div>
  );
}
