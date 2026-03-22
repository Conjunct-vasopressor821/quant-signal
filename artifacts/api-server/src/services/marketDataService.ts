import WebSocket from "ws";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { regimeService } from "./regimeService.js";
import { signalService } from "./signalService.js";
import { riskService } from "./riskService.js";
import { judgeService } from "./judgeService.js";
import { geminiService } from "./geminiService.js";
import { db } from "@workspace/db";
import { analysisRunsTable, signalsTable } from "@workspace/db/schema";

const KRAKEN_REST_BASE = "https://api.kraken.com";
const KRAKEN_WS_URL = "wss://ws.kraken.com/v2";

const SUPPORTED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
const SUPPORTED_TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;

export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];
export type SupportedTimeframe = typeof SUPPORTED_TIMEFRAMES[number];

const SYMBOL_TO_KRAKEN: Record<string, { restPair: string; wsPair: string }> = {
  BTCUSDT: { restPair: "XBTUSD", wsPair: "BTC/USD" },
  ETHUSDT: { restPair: "ETHUSD", wsPair: "ETH/USD" },
  SOLUSDT: { restPair: "SOLUSD", wsPair: "SOL/USD" },
};

const TF_TO_KRAKEN: Record<string, number> = {
  "1m": 1, "5m": 5, "15m": 15, "1h": 60,
};

// Display names for the UI (BTCUSDT → BTC/USD)
const SYMBOL_DISPLAY: Record<string, string> = {
  BTCUSDT: "BTC/USD", ETHUSDT: "ETH/USD", SOLUSDT: "SOL/USD",
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveSignalResult {
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

export type SSEEventType = "tick" | "candle_closed" | "connected" | "error";

export interface SSEPayload {
  type: SSEEventType;
  symbol: string;
  timeframe: string;
  candle: Candle;
  isClosed: boolean;
  signal?: LiveSignalResult;
  ts: number;
}

interface StreamState {
  ws: WebSocket | null;
  clients: Map<string, Response>;
  latestCandle: Candle | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  isClosing: boolean;
  pingTimer: ReturnType<typeof setInterval> | null;
}

function streamKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}:${timeframe}`;
}

class MarketDataService {
  private streams = new Map<string, StreamState>();

  normalizeSymbol(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  normalizeTimeframe(raw: string): string {
    const map: Record<string, string> = {
      "1m": "1m", "1min": "1m",
      "5m": "5m", "5min": "5m",
      "15m": "15m", "15min": "15m",
      "1h": "1h", "60m": "1h",
    };
    return map[raw.toLowerCase()] ?? raw;
  }

  isValidSymbol(sym: string): boolean {
    return SUPPORTED_SYMBOLS.includes(sym.toUpperCase() as SupportedSymbol);
  }

  isValidTimeframe(tf: string): boolean {
    return SUPPORTED_TIMEFRAMES.includes(tf as SupportedTimeframe);
  }

  displayName(symbol: string): string {
    return SYMBOL_DISPLAY[symbol.toUpperCase()] ?? symbol;
  }

  async fetchCandles(symbol: string, timeframe: string, limit = 300): Promise<Candle[]> {
    const sym = this.normalizeSymbol(symbol);
    const tf = this.normalizeTimeframe(timeframe);

    const krakenInfo = SYMBOL_TO_KRAKEN[sym];
    if (!krakenInfo) throw new Error(`Unsupported symbol: ${sym}`);

    const intervalMin = TF_TO_KRAKEN[tf];
    if (!intervalMin) throw new Error(`Unsupported timeframe: ${tf}`);

    const sinceTs = Math.floor(Date.now() / 1000) - limit * intervalMin * 60;
    const url = `${KRAKEN_REST_BASE}/0/public/OHLC?pair=${krakenInfo.restPair}&interval=${intervalMin}&since=${sinceTs}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`Kraken REST error ${res.status}`);
    }

    const data = (await res.json()) as {
      error: string[];
      result: Record<string, Array<[number, string, string, string, string, string, string, number]>>;
    };

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(", ")}`);
    }

    // The result has the pair name as key (e.g. XXBTZUSD) plus "last"
    const pairKey = Object.keys(data.result).find((k) => k !== "last");
    if (!pairKey) throw new Error("No data in Kraken response");

    const raw = data.result[pairKey];

    return raw.slice(-limit).map((k) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[6]),
    }));
  }

  subscribeSSE(symbol: string, timeframe: string, clientId: string, res: Response): void {
    const key = streamKey(symbol, timeframe);

    if (!this.streams.has(key)) {
      this.streams.set(key, {
        ws: null,
        clients: new Map(),
        latestCandle: null,
        reconnectTimer: null,
        reconnectDelay: 1000,
        isClosing: false,
        pingTimer: null,
      });
    }

    const state = this.streams.get(key)!;
    state.clients.set(clientId, res);

    this.sendSSE(res, {
      type: "connected",
      symbol,
      timeframe,
      candle: state.latestCandle ?? { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 },
      isClosed: false,
      ts: Date.now(),
    });

    if (!state.ws || state.ws.readyState === WebSocket.CLOSED || state.ws.readyState === WebSocket.CLOSING) {
      this.connectWebSocket(symbol, timeframe, key);
    }
  }

  unsubscribeSSE(symbol: string, timeframe: string, clientId: string): void {
    const key = streamKey(symbol, timeframe);
    const state = this.streams.get(key);
    if (!state) return;

    state.clients.delete(clientId);

    if (state.clients.size === 0) {
      setTimeout(() => {
        const s = this.streams.get(key);
        if (s && s.clients.size === 0) {
          s.isClosing = true;
          if (s.pingTimer) clearInterval(s.pingTimer);
          s.ws?.terminate();
          if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
          this.streams.delete(key);
        }
      }, 30_000);
    }
  }

  private connectWebSocket(symbol: string, timeframe: string, key: string): void {
    const state = this.streams.get(key);
    if (!state || state.isClosing) return;

    const krakenInfo = SYMBOL_TO_KRAKEN[symbol];
    const intervalMin = TF_TO_KRAKEN[timeframe];
    if (!krakenInfo || !intervalMin) return;

    const ws = new WebSocket(KRAKEN_WS_URL);
    state.ws = ws;

    ws.on("open", () => {
      state.reconnectDelay = 1000;

      const sub = JSON.stringify({
        method: "subscribe",
        params: {
          channel: "ohlc",
          symbol: [krakenInfo.wsPair],
          interval: intervalMin,
        },
      });
      ws.send(sub);

      // Send heartbeat every 30s to keep the connection alive
      if (state.pingTimer) clearInterval(state.pingTimer);
      state.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: "ping" }));
        }
      }, 30_000);
    });

    ws.on("message", async (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          channel?: string;
          type?: string;
          data?: Array<{
            symbol: string;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
            timestamp: string;
            interval_begin: string;
            interval: number;
            confirm: boolean;
          }>;
        };

        if (msg.channel !== "ohlc" || !msg.data || msg.data.length === 0) return;

        const tick = msg.data[0];
        if (!tick) return;

        // Convert interval_begin to Unix seconds (start of candle)
        const candleTime = Math.floor(new Date(tick.interval_begin).getTime() / 1000);

        const candle: Candle = {
          time: candleTime,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume,
        };

        state.latestCandle = candle;

        if (tick.confirm) {
          // Candle is closed — run signal analysis
          const signalResult = await this.analyzeClosedCandle(symbol, timeframe, candle).catch(() => undefined);
          const payload: SSEPayload = {
            type: "candle_closed",
            symbol,
            timeframe,
            candle,
            isClosed: true,
            signal: signalResult,
            ts: Date.now(),
          };
          this.broadcastSSE(key, payload);
        } else {
          const payload: SSEPayload = {
            type: "tick",
            symbol,
            timeframe,
            candle,
            isClosed: false,
            ts: Date.now(),
          };
          this.broadcastSSE(key, payload);
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("close", () => {
      if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }
      if (state.isClosing) return;
      this.scheduleReconnect(symbol, timeframe, key);
    });

    ws.on("error", () => {
      if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }
      if (state.isClosing) return;
      ws.terminate();
    });
  }

  private scheduleReconnect(symbol: string, timeframe: string, key: string): void {
    const state = this.streams.get(key);
    if (!state || state.isClosing || state.clients.size === 0) return;

    const delay = Math.min(state.reconnectDelay, 30_000);
    state.reconnectDelay = Math.min(delay * 2, 30_000);

    state.reconnectTimer = setTimeout(() => {
      const s = this.streams.get(key);
      if (s && !s.isClosing && s.clients.size > 0) {
        this.connectWebSocket(symbol, timeframe, key);
      }
    }, delay);
  }

  private async analyzeClosedCandle(
    symbol: string,
    timeframe: string,
    candle: Candle,
  ): Promise<LiveSignalResult> {
    const candleData = { ...candle };

    const regimeResult = regimeService.detectRegime({
      symbol, timeframe, candleData,
    });

    const signalResult = signalService.generateCandidateSignal({
      symbol,
      timeframe,
      regime: regimeResult.regime,
      hasScreenshot: false,
      hasTradeHistory: false,
      candleData,
    });

    const riskResult = riskService.calculateRisk({
      symbol,
      timeframe,
      regime: regimeResult.regime,
      confidenceScore: signalResult.confidenceScore,
      candleData,
    });

    const judgement = judgeService.judge({
      candidateSignal: signalResult.signal,
      confidenceScore: signalResult.confidenceScore,
      riskScore: riskResult.riskScore,
      regime: regimeResult.regime,
      riskRewardRatio: riskResult.riskRewardRatio,
      symbol,
      timeframe,
    });

    let explanation = judgement.explanation;

    if (geminiService.isConfigured()) {
      try {
        const enhanced = await geminiService.enhanceExplanation({
          symbol,
          timeframe,
          signal: judgement.finalSignal,
          regime: regimeResult.regime,
          confidenceScore: judgement.adjustedConfidence,
          riskScore: riskResult.riskScore,
          strategyNote: `Live candle — O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume.toFixed(0)}`,
          signalReasoning: signalResult.reasoning,
        });
        if (enhanced) explanation = enhanced;
      } catch {
        // Use deterministic explanation
      }
    }

    const uuid = randomUUID();
    const computedAt = new Date().toISOString();

    try {
      const runUuid = randomUUID();
      await db.insert(analysisRunsTable).values({
        uuid: runUuid,
        symbol,
        timeframe,
        strategyNote: `Live candle — O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`,
      });

      await db.insert(signalsTable).values({
        uuid,
        analysisRunUuid: runUuid,
        symbol,
        timeframe,
        signal: judgement.finalSignal,
        confidenceScore: judgement.adjustedConfidence,
        riskScore: riskResult.riskScore,
        marketRegime: regimeResult.regime,
        explanation,
        invalidationZone: riskResult.invalidationZone,
        stopLossSuggestion: riskResult.stopLossSuggestion,
        finalBanner: judgement.finalBanner,
        serviceBreakdown: {
          ingestion: `Live candle: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume.toFixed(0)}`,
          signal: signalResult.reasoning.slice(0, 2).join("; "),
          risk: riskResult.description,
          regime: regimeResult.description,
          judge: judgement.explanation.slice(0, 120),
        },
      });
    } catch {
      // DB errors are non-fatal for live signals
    }

    const targetZone = riskResult.stopLossSuggestion
      ? candle.close + (candle.close - riskResult.stopLossSuggestion) * 2
      : undefined;

    return {
      signal: judgement.finalSignal,
      confidenceScore: judgement.adjustedConfidence,
      riskScore: riskResult.riskScore,
      marketRegime: regimeResult.regime,
      explanation,
      invalidationZone: riskResult.invalidationZone,
      stopLossSuggestion: riskResult.stopLossSuggestion,
      targetZone,
      finalBanner: judgement.finalBanner,
      signalId: uuid,
      computedAt,
    };
  }

  private sendSSE(res: Response, payload: SSEPayload): void {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // client disconnected
    }
  }

  private broadcastSSE(key: string, payload: SSEPayload): void {
    const state = this.streams.get(key);
    if (!state) return;

    const dead: string[] = [];
    state.clients.forEach((res, clientId) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        dead.push(clientId);
      }
    });
    dead.forEach((id) => state.clients.delete(id));
  }

  getStreamStats(): Array<{ symbol: string; timeframe: string; clients: number; wsState: string }> {
    const stats: Array<{ symbol: string; timeframe: string; clients: number; wsState: string }> = [];
    this.streams.forEach((state, key) => {
      const [symbol, timeframe] = key.split(":");
      const wsStateMap: Record<number, string> = { 0: "connecting", 1: "open", 2: "closing", 3: "closed" };
      stats.push({
        symbol,
        timeframe,
        clients: state.clients.size,
        wsState: state.ws ? (wsStateMap[state.ws.readyState] ?? "unknown") : "none",
      });
    });
    return stats;
  }
}

export const marketDataService = new MarketDataService();
