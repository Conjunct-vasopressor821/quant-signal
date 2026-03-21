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
  }): RegimeAnalysis {
    const note = (input.strategyNote || "").toLowerCase();
    const bias = (input.marketBias || "neutral").toLowerCase();

    // Classify regime based on available context
    if (
      note.includes("breakout") ||
      note.includes("break out") ||
      note.includes("resistance break")
    ) {
      return {
        regime: "breakout",
        description: "Price appears to be breaking above a key resistance level",
        confidence: 72,
      };
    }

    if (
      note.includes("breakdown") ||
      note.includes("break down") ||
      note.includes("support break")
    ) {
      return {
        regime: "breakdown",
        description: "Price appears to be breaking below a key support level",
        confidence: 70,
      };
    }

    if (note.includes("range") || note.includes("sideways") || note.includes("consolidat")) {
      return {
        regime: "range",
        description: "Market is moving sideways in a defined range",
        confidence: 68,
      };
    }

    if (note.includes("volatile") || note.includes("choppy") || note.includes("erratic")) {
      return {
        regime: "volatile",
        description: "Market is exhibiting high volatility with no clear direction",
        confidence: 65,
      };
    }

    // Bias-based detection
    if (bias === "bullish") {
      return {
        regime: "trend",
        description: "Market appears to be in an uptrend based on bullish bias",
        confidence: 63,
      };
    }

    if (bias === "bearish") {
      return {
        regime: "trend",
        description: "Market appears to be in a downtrend based on bearish bias",
        confidence: 63,
      };
    }

    // Default: use timeframe to guess
    const shortTermFrames = ["1m", "3m", "5m", "15m"];
    if (shortTermFrames.includes(input.timeframe)) {
      return {
        regime: "volatile",
        description:
          "Short timeframe analysis often sees elevated volatility. Regime classification is uncertain without more data.",
        confidence: 50,
      };
    }

    return {
      regime: "range",
      description:
        "Market regime is uncertain without additional price data. Defaulting to range classification.",
      confidence: 45,
    };
  }
}

export const regimeService = new RegimeService();
