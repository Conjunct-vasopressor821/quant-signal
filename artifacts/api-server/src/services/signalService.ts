import type { Candle } from "./marketDataService.js";

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
    candleData?: Candle;
  }): CandidateSignal {
    if (input.candleData) {
      return this.generateFromCandle(input.candleData, input.regime, input.symbol, input.timeframe);
    }

    const reasoning: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;
    let uncertaintyPenalty = 0;
    let baseConfidence = 50;

    const bias = (input.marketBias || "neutral").toLowerCase();
    const note = (input.strategyNote || "").toLowerCase();

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

    if (note) {
      const bullishKeywords = ["buy", "long", "bullish", "support", "bounce", "uptrend", "breakout", "accumulation", "demand"];
      const bearishKeywords = ["sell", "short", "bearish", "resistance", "rejection", "downtrend", "breakdown", "distribution", "supply"];
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

    if (input.entryPrice && input.stopLoss && input.target) {
      baseConfidence += 15;
      reasoning.push("Complete price levels provided — increases confidence");
      if (input.target > input.entryPrice) { bullishPoints += 2; } else { bearishPoints += 2; }
    } else if (input.entryPrice) {
      baseConfidence += 5;
      reasoning.push("Entry price provided but stop/target missing — confidence limited");
    } else {
      uncertaintyPenalty += 15;
      reasoning.push("No price levels provided — signal relies on qualitative factors");
    }

    if (input.regime === "trend") {
      baseConfidence += 8;
      if (bias === "bullish") { bullishPoints += 2; reasoning.push("Trending regime aligns with bullish bias"); }
      else if (bias === "bearish") { bearishPoints += 2; reasoning.push("Trending regime aligns with bearish bias"); }
    } else if (input.regime === "volatile") {
      uncertaintyPenalty += 15;
      reasoning.push("Volatile regime reduces signal reliability");
    } else if (input.regime === "range") {
      uncertaintyPenalty += 5;
      reasoning.push("Range-bound market — directional signals are less reliable");
    }

    if (input.hasScreenshot) { baseConfidence += 5; reasoning.push("Chart screenshot provided"); }
    if (input.hasTradeHistory) { baseConfidence += 5; reasoning.push("Trade history available"); }

    const netPoints = bullishPoints - bearishPoints;
    let signal: SignalType;
    let confidenceScore: number;

    if (bullishPoints === 0 && bearishPoints === 0 && bias === "neutral") {
      signal = "Hold"; confidenceScore = baseConfidence - uncertaintyPenalty - 10;
      reasoning.push("No clear directional signal — recommending Hold");
    } else if (netPoints > 4) {
      signal = "Buy"; confidenceScore = baseConfidence + netPoints * 2 - uncertaintyPenalty;
      reasoning.push(`Strong bullish conviction (${bullishPoints} bull pts vs ${bearishPoints} bear pts)`);
    } else if (netPoints < -4) {
      signal = "Sell"; confidenceScore = baseConfidence + Math.abs(netPoints) * 2 - uncertaintyPenalty;
      reasoning.push(`Strong bearish conviction`);
    } else if (netPoints > 0) {
      signal = "Buy"; confidenceScore = baseConfidence + netPoints - uncertaintyPenalty;
      reasoning.push(`Mild bullish lean`);
    } else if (netPoints < 0) {
      signal = "Sell"; confidenceScore = baseConfidence + Math.abs(netPoints) - uncertaintyPenalty;
      reasoning.push(`Mild bearish lean`);
    } else {
      if (input.regime === "volatile") {
        signal = "Avoid"; confidenceScore = baseConfidence - uncertaintyPenalty - 10;
        reasoning.push("Balanced signals in volatile regime — recommend Avoid");
      } else {
        signal = "Hold"; confidenceScore = baseConfidence - uncertaintyPenalty;
        reasoning.push("Balanced signals — recommend Hold");
      }
    }

    confidenceScore = Math.max(15, Math.min(92, Math.round(confidenceScore)));
    return { signal, confidenceScore, reasoning };
  }

  private generateFromCandle(candle: Candle, regime: string, symbol: string, timeframe: string): CandidateSignal {
    const reasoning: string[] = [];
    const range = candle.high - candle.low;
    const body = Math.abs(candle.close - candle.open);
    const isBullish = candle.close >= candle.open;
    const bodyRatio = range > 0 ? body / range : 0;

    let bullishPoints = 0;
    let bearishPoints = 0;
    let baseConfidence = 55;

    if (isBullish) {
      bullishPoints += 3;
      reasoning.push(`Bullish candle — closed at ${candle.close} above open ${candle.open}`);
    } else {
      bearishPoints += 3;
      reasoning.push(`Bearish candle — closed at ${candle.close} below open ${candle.open}`);
    }

    if (bodyRatio > 0.7) {
      const extra = isBullish ? 3 : 0;
      const bearExtra = isBullish ? 0 : 3;
      bullishPoints += extra;
      bearishPoints += bearExtra;
      baseConfidence += 10;
      reasoning.push(`Strong momentum candle — body is ${(bodyRatio * 100).toFixed(0)}% of range`);
    } else if (bodyRatio < 0.25) {
      baseConfidence -= 10;
      reasoning.push(`Indecision candle — small body (${(bodyRatio * 100).toFixed(0)}% of range)`);
    }

    const closePosition = range > 0 ? (candle.close - candle.low) / range : 0.5;
    if (closePosition > 0.7) {
      bullishPoints += 2;
      reasoning.push(`Close in upper ${((1 - closePosition) * 100).toFixed(0)}% of range — bullish close positioning`);
    } else if (closePosition < 0.3) {
      bearishPoints += 2;
      reasoning.push(`Close in lower ${(closePosition * 100).toFixed(0)}% of range — bearish close positioning`);
    }

    if (regime === "trend") { baseConfidence += 8; reasoning.push("Trending regime supports directional signal"); }
    else if (regime === "volatile") { baseConfidence -= 12; reasoning.push("Volatile regime reduces reliability"); }
    else if (regime === "breakout") { bullishPoints += 2; baseConfidence += 5; reasoning.push("Breakout regime — bullish momentum"); }
    else if (regime === "breakdown") { bearishPoints += 2; baseConfidence += 5; reasoning.push("Breakdown regime — bearish momentum"); }
    else if (regime === "range") { baseConfidence -= 5; reasoning.push("Range-bound market reduces signal clarity"); }

    reasoning.push(`Live candle analysis for ${symbol} on ${timeframe}`);

    const netPoints = bullishPoints - bearishPoints;
    let signal: SignalType;
    let confidenceScore: number;

    if (regime === "volatile" && Math.abs(netPoints) <= 2) {
      signal = "Avoid";
      confidenceScore = baseConfidence - 10;
      reasoning.push("Volatile regime with no clear edge — recommend Avoid");
    } else if (netPoints >= 4) {
      signal = "Buy";
      confidenceScore = baseConfidence + netPoints * 2;
    } else if (netPoints <= -4) {
      signal = "Sell";
      confidenceScore = baseConfidence + Math.abs(netPoints) * 2;
    } else if (netPoints > 0) {
      signal = "Buy";
      confidenceScore = baseConfidence + netPoints;
    } else if (netPoints < 0) {
      signal = "Sell";
      confidenceScore = baseConfidence + Math.abs(netPoints);
    } else {
      signal = "Hold";
      confidenceScore = baseConfidence - 5;
      reasoning.push("No clear edge — recommend Hold");
    }

    confidenceScore = Math.max(20, Math.min(88, Math.round(confidenceScore)));
    return { signal, confidenceScore, reasoning };
  }
}

export const signalService = new SignalService();
