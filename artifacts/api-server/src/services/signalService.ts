export type SignalType = "Buy" | "Sell" | "Hold" | "Avoid";

export interface CandidateSignal {
  signal: SignalType;
  confidenceScore: number;
  reasoning: string[];
}

export class SignalService {
  generateCandidateSignal(input: {
    symbol: string;
    timeframe: string;
    marketBias?: string;
    entryPrice?: number;
    stopLoss?: number;
    target?: number;
    strategyNote?: string;
    regime: string;
    hasScreenshot: boolean;
    hasTradeHistory: boolean;
  }): CandidateSignal {
    const reasoning: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;
    let uncertaintyPenalty = 0;
    let baseConfidence = 50;

    const bias = (input.marketBias || "neutral").toLowerCase();
    const note = (input.strategyNote || "").toLowerCase();

    // Market bias weighting
    if (bias === "bullish") {
      bullishPoints += 3;
      reasoning.push("User-defined bullish market bias");
    } else if (bias === "bearish") {
      bearishPoints += 3;
      reasoning.push("User-defined bearish market bias");
    } else {
      uncertaintyPenalty += 5;
      reasoning.push("Neutral bias — no directional conviction indicated");
    }

    // Strategy note analysis
    if (note) {
      const bullishKeywords = [
        "buy",
        "long",
        "bullish",
        "support",
        "bounce",
        "uptrend",
        "breakout",
        "accumulation",
        "demand",
      ];
      const bearishKeywords = [
        "sell",
        "short",
        "bearish",
        "resistance",
        "rejection",
        "downtrend",
        "breakdown",
        "distribution",
        "supply",
      ];

      const bullishMatches = bullishKeywords.filter((kw) => note.includes(kw));
      const bearishMatches = bearishKeywords.filter((kw) => note.includes(kw));

      if (bullishMatches.length > 0) {
        bullishPoints += bullishMatches.length * 2;
        reasoning.push(`Bullish keywords in strategy: ${bullishMatches.join(", ")}`);
      }
      if (bearishMatches.length > 0) {
        bearishPoints += bearishMatches.length * 2;
        reasoning.push(`Bearish keywords in strategy: ${bearishMatches.join(", ")}`);
      }

      baseConfidence += 10;
      reasoning.push("Strategy note provided — adds analytical context");
    } else {
      uncertaintyPenalty += 10;
      reasoning.push("No strategy note provided — signal is less informed");
    }

    // Price levels
    if (input.entryPrice && input.stopLoss && input.target) {
      baseConfidence += 15;
      reasoning.push("Complete price levels provided (entry, stop, target) — increases confidence");

      if (input.target > input.entryPrice) {
        bullishPoints += 2;
      } else {
        bearishPoints += 2;
      }
    } else if (input.entryPrice) {
      baseConfidence += 5;
      reasoning.push("Entry price provided but stop/target missing — confidence limited");
    } else {
      uncertaintyPenalty += 15;
      reasoning.push("No price levels provided — signal relies entirely on qualitative factors");
    }

    // Regime impact
    if (input.regime === "trend") {
      baseConfidence += 8;
      if (bias === "bullish") {
        bullishPoints += 2;
        reasoning.push("Trending regime aligns with bullish bias");
      } else if (bias === "bearish") {
        bearishPoints += 2;
        reasoning.push("Trending regime aligns with bearish bias");
      }
    } else if (input.regime === "volatile") {
      uncertaintyPenalty += 15;
      reasoning.push("Volatile regime reduces signal reliability");
    } else if (input.regime === "range") {
      uncertaintyPenalty += 5;
      reasoning.push("Range-bound market — directional signals are less reliable");
    }

    // Additional context
    if (input.hasScreenshot) {
      baseConfidence += 5;
      reasoning.push("Chart screenshot provided — visual context captured");
    }
    if (input.hasTradeHistory) {
      baseConfidence += 5;
      reasoning.push("Trade history available for context");
    }

    // Determine signal direction
    const netPoints = bullishPoints - bearishPoints;
    let signal: SignalType;
    let confidenceScore: number;

    if (bullishPoints === 0 && bearishPoints === 0 && bias === "neutral") {
      signal = "Hold";
      confidenceScore = baseConfidence - uncertaintyPenalty - 10;
      reasoning.push("No clear directional signal — recommending Hold");
    } else if (netPoints > 4) {
      signal = "Buy";
      confidenceScore = baseConfidence + netPoints * 2 - uncertaintyPenalty;
      reasoning.push(`Strong bullish conviction (${bullishPoints} bull pts vs ${bearishPoints} bear pts)`);
    } else if (netPoints < -4) {
      signal = "Sell";
      confidenceScore = baseConfidence + Math.abs(netPoints) * 2 - uncertaintyPenalty;
      reasoning.push(`Strong bearish conviction (${bearishPoints} bear pts vs ${bullishPoints} bull pts)`);
    } else if (netPoints > 0) {
      signal = "Buy";
      confidenceScore = baseConfidence + netPoints - uncertaintyPenalty;
      reasoning.push(`Mild bullish lean (${bullishPoints} vs ${bearishPoints} points)`);
    } else if (netPoints < 0) {
      signal = "Sell";
      confidenceScore = baseConfidence + Math.abs(netPoints) - uncertaintyPenalty;
      reasoning.push(`Mild bearish lean (${bearishPoints} vs ${bullishPoints} points)`);
    } else {
      // Balanced — defer to regime
      if (input.regime === "volatile") {
        signal = "Avoid";
        confidenceScore = baseConfidence - uncertaintyPenalty - 10;
        reasoning.push("Balanced signals in volatile regime — recommend Avoid");
      } else {
        signal = "Hold";
        confidenceScore = baseConfidence - uncertaintyPenalty;
        reasoning.push("Balanced signals with no clear edge — recommend Hold");
      }
    }

    confidenceScore = Math.max(15, Math.min(92, Math.round(confidenceScore)));

    return { signal, confidenceScore, reasoning };
  }
}

export const signalService = new SignalService();
