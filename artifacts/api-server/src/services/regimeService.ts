import type { Candle } from "./marketDataService.js";

export type MarketRegime = "trend" | "range" | "breakout" | "breakdown" | "volatile";

export interface RegimeAnalysis {
  regime: MarketRegime;
  description: string;
  confidence: number;
}

export class RegimeService {
  detectRegime(input: {
    symbol: string;
    timeframe: string;
    marketBias?: string;
    entryPrice?: number;
    stopLoss?: number;
    target?: number;
    strategyNote?: string;
    candleData?: Candle;
  }): RegimeAnalysis {
    if (input.candleData) {
      return this.detectRegimeFromCandle(input.candleData, input.timeframe);
    }

    const note = (input.strategyNote || "").toLowerCase();
    const bias = (input.marketBias || "neutral").toLowerCase();

    if (note.includes("breakout") || note.includes("break out") || note.includes("resistance break")) {
      return { regime: "breakout", description: "Price appears to be breaking above a key resistance level", confidence: 72 };
    }
    if (note.includes("breakdown") || note.includes("break down") || note.includes("support break")) {
      return { regime: "breakdown", description: "Price appears to be breaking below a key support level", confidence: 70 };
    }
    if (note.includes("range") || note.includes("sideways") || note.includes("consolidat")) {
      return { regime: "range", description: "Market is moving sideways in a defined range", confidence: 68 };
    }
    if (note.includes("volatile") || note.includes("choppy") || note.includes("erratic")) {
      return { regime: "volatile", description: "Market is exhibiting high volatility with no clear direction", confidence: 65 };
    }

    if (bias === "bullish") {
      return { regime: "trend", description: "Market appears to be in an uptrend based on bullish bias", confidence: 63 };
    }
    if (bias === "bearish") {
      return { regime: "trend", description: "Market appears to be in a downtrend based on bearish bias", confidence: 63 };
    }

    const shortTermFrames = ["1m", "3m", "5m", "15m"];
    if (shortTermFrames.includes(input.timeframe)) {
      return { regime: "volatile", description: "Short timeframe analysis often sees elevated volatility.", confidence: 50 };
    }

    return { regime: "range", description: "Market regime is uncertain without additional price data.", confidence: 45 };
  }

  private detectRegimeFromCandle(candle: Candle, timeframe: string): RegimeAnalysis {
    const range = candle.high - candle.low;
    if (range === 0) {
      return { regime: "range", description: "No price movement detected on this candle.", confidence: 40 };
    }

    const body = Math.abs(candle.close - candle.open);
    const bodyRatio = body / range;
    const isBullish = candle.close > candle.open;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const priceImpact = range / candle.close;
    const tfVolThreshold: Record<string, number> = {
      "1m": 0.003, "5m": 0.005, "15m": 0.008, "1h": 0.015,
    };
    const volThreshold = tfVolThreshold[timeframe] ?? 0.01;
    const isHighVolatility = priceImpact > volThreshold * 2;

    if (isHighVolatility && bodyRatio > 0.6 && isBullish && upperWickRatio < 0.15) {
      return {
        regime: "breakout",
        description: `Strong bullish breakout candle — body covers ${(bodyRatio * 100).toFixed(0)}% of range with minimal upper wick.`,
        confidence: 74,
      };
    }

    if (isHighVolatility && bodyRatio > 0.6 && !isBullish && lowerWickRatio < 0.15) {
      return {
        regime: "breakdown",
        description: `Strong bearish breakdown candle — body covers ${(bodyRatio * 100).toFixed(0)}% of range with minimal lower wick.`,
        confidence: 73,
      };
    }

    if (bodyRatio > 0.65) {
      const direction = isBullish ? "uptrend" : "downtrend";
      return {
        regime: "trend",
        description: `Impulse candle in ${direction} — strong body (${(bodyRatio * 100).toFixed(0)}% of range), indicating directional momentum.`,
        confidence: 70,
      };
    }

    if (bodyRatio < 0.25 && (upperWickRatio > 0.3 || lowerWickRatio > 0.3)) {
      return {
        regime: "volatile",
        description: `Indecision candle with long wicks — body only ${(bodyRatio * 100).toFixed(0)}% of range. Market is choppy with no clear direction.`,
        confidence: 62,
      };
    }

    if (bodyRatio < 0.35) {
      return {
        regime: "range",
        description: `Small-body candle suggests range-bound market. Price moved within a tight ${(priceImpact * 100).toFixed(2)}% range.`,
        confidence: 60,
      };
    }

    const direction = isBullish ? "bullish" : "bearish";
    return {
      regime: "trend",
      description: `Moderate ${direction} candle on ${timeframe} — mild directional bias with ${(bodyRatio * 100).toFixed(0)}% body coverage.`,
      confidence: 58,
    };
  }
}

export const regimeService = new RegimeService();
