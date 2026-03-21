export interface RiskAnalysis {
  riskScore: number;
  stopLossSuggestion?: number;
  invalidationZone: string;
  riskRewardRatio?: number;
  description: string;
}

export class RiskService {
  calculateRisk(input: {
    symbol: string;
    timeframe: string;
    entryPrice?: number;
    stopLoss?: number;
    target?: number;
    marketBias?: string;
    regime: string;
    confidenceScore: number;
  }): RiskAnalysis {
    let riskScore = 50;
    let stopLossSuggestion: number | undefined;
    let invalidationZone = "No specific invalidation level provided";
    let riskRewardRatio: number | undefined;
    const notes: string[] = [];

    // Calculate risk/reward ratio if we have price data
    if (input.entryPrice && input.stopLoss && input.target) {
      const risk = Math.abs(input.entryPrice - input.stopLoss);
      const reward = Math.abs(input.target - input.entryPrice);
      riskRewardRatio = reward / risk;

      if (riskRewardRatio >= 3) {
        riskScore -= 15;
        notes.push(`Excellent R:R ratio of ${riskRewardRatio.toFixed(1)}:1`);
      } else if (riskRewardRatio >= 2) {
        riskScore -= 8;
        notes.push(`Good R:R ratio of ${riskRewardRatio.toFixed(1)}:1`);
      } else if (riskRewardRatio < 1) {
        riskScore += 20;
        notes.push(`Poor R:R ratio of ${riskRewardRatio.toFixed(1)}:1 — reward is less than risk`);
      }

      stopLossSuggestion = input.stopLoss;
      invalidationZone = `Price below ${input.stopLoss} invalidates this setup`;
    } else if (input.entryPrice && input.stopLoss) {
      stopLossSuggestion = input.stopLoss;
      const riskPct =
        (Math.abs(input.entryPrice - input.stopLoss) / input.entryPrice) * 100;
      if (riskPct > 5) {
        riskScore += 15;
        notes.push(`Wide stop loss at ${riskPct.toFixed(1)}% from entry`);
      } else if (riskPct < 1) {
        riskScore -= 5;
        notes.push(`Tight stop loss at ${riskPct.toFixed(1)}% from entry`);
      }
      invalidationZone = `Stop loss at ${input.stopLoss} — ${riskPct.toFixed(1)}% risk from entry`;
    } else if (input.entryPrice) {
      // Suggest a stop loss based on timeframe
      const stopPct = this.getTimeframeStopPct(input.timeframe);
      const bias = input.marketBias || "neutral";
      if (bias === "bullish" || bias === "neutral") {
        stopLossSuggestion = parseFloat((input.entryPrice * (1 - stopPct / 100)).toFixed(4));
      } else {
        stopLossSuggestion = parseFloat((input.entryPrice * (1 + stopPct / 100)).toFixed(4));
      }
      invalidationZone = `Suggested stop at ${stopLossSuggestion} (~${stopPct}% from entry based on ${input.timeframe} timeframe)`;
      notes.push("No stop loss provided — using timeframe-based estimate");
      riskScore += 10;
    }

    // Regime-based risk adjustment
    if (input.regime === "volatile") {
      riskScore += 20;
      notes.push("Volatile market regime increases risk");
    } else if (input.regime === "trend") {
      riskScore -= 5;
      notes.push("Trending market reduces regime risk");
    } else if (input.regime === "breakout" || input.regime === "breakdown") {
      riskScore += 10;
      notes.push("Breakout/breakdown setups carry higher failure risk");
    }

    // Confidence-based adjustment (inverse relationship)
    if (input.confidenceScore > 75) {
      riskScore -= 8;
    } else if (input.confidenceScore < 45) {
      riskScore += 10;
    }

    // Timeframe risk
    const shortTermFrames = ["1m", "3m", "5m"];
    const longTermFrames = ["1d", "3d", "1w", "1M"];
    if (shortTermFrames.includes(input.timeframe)) {
      riskScore += 10;
      notes.push("Very short timeframes increase noise and risk");
    } else if (longTermFrames.includes(input.timeframe)) {
      riskScore -= 5;
      notes.push("Longer timeframe signals tend to be more reliable");
    }

    riskScore = Math.max(5, Math.min(95, riskScore));

    const description =
      notes.length > 0
        ? notes.join(". ")
        : "Risk assessment based on available inputs and market context.";

    return {
      riskScore: Math.round(riskScore),
      stopLossSuggestion,
      invalidationZone,
      riskRewardRatio,
      description,
    };
  }

  private getTimeframeStopPct(timeframe: string): number {
    const stopMap: Record<string, number> = {
      "1m": 0.3,
      "3m": 0.5,
      "5m": 0.7,
      "15m": 1.0,
      "30m": 1.2,
      "1h": 1.5,
      "2h": 1.8,
      "4h": 2.5,
      "6h": 3.0,
      "8h": 3.2,
      "12h": 3.5,
      "1d": 4.0,
      "3d": 5.0,
      "1w": 7.0,
      "1M": 10.0,
    };
    return stopMap[timeframe] || 2.0;
  }
}

export const riskService = new RiskService();
