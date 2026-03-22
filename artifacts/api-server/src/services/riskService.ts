import type { Candle } from "./marketDataService.js";

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
    candleData?: Candle;
  }): RiskAnalysis {
    if (input.candleData) {
      return this.calculateRiskFromCandle(input.candleData, input.regime, input.confidenceScore, input.timeframe);
    }

    let riskScore = 50;
    let stopLossSuggestion: number | undefined;
    let invalidationZone = "No specific invalidation level provided";
    let riskRewardRatio: number | undefined;
    const notes: string[] = [];

    if (input.entryPrice && input.stopLoss && input.target) {
      const risk = Math.abs(input.entryPrice - input.stopLoss);
      const reward = Math.abs(input.target - input.entryPrice);
      riskRewardRatio = reward / risk;

      if (riskRewardRatio >= 3) { riskScore -= 15; notes.push(`Excellent R:R ratio of ${riskRewardRatio.toFixed(1)}:1`); }
      else if (riskRewardRatio >= 2) { riskScore -= 8; notes.push(`Good R:R ratio of ${riskRewardRatio.toFixed(1)}:1`); }
      else if (riskRewardRatio < 1) { riskScore += 20; notes.push(`Poor R:R ratio of ${riskRewardRatio.toFixed(1)}:1`); }

      stopLossSuggestion = input.stopLoss;
      invalidationZone = `Price below ${input.stopLoss} invalidates this setup`;
    } else if (input.entryPrice && input.stopLoss) {
      stopLossSuggestion = input.stopLoss;
      const riskPct = (Math.abs(input.entryPrice - input.stopLoss) / input.entryPrice) * 100;
      if (riskPct > 5) { riskScore += 15; notes.push(`Wide stop loss at ${riskPct.toFixed(1)}%`); }
      else if (riskPct < 1) { riskScore -= 5; notes.push(`Tight stop at ${riskPct.toFixed(1)}%`); }
      invalidationZone = `Stop loss at ${input.stopLoss} — ${riskPct.toFixed(1)}% risk from entry`;
    } else if (input.entryPrice) {
      const stopPct = this.getTimeframeStopPct(input.timeframe);
      const bias = input.marketBias || "neutral";
      if (bias === "bullish" || bias === "neutral") {
        stopLossSuggestion = parseFloat((input.entryPrice * (1 - stopPct / 100)).toFixed(4));
      } else {
        stopLossSuggestion = parseFloat((input.entryPrice * (1 + stopPct / 100)).toFixed(4));
      }
      invalidationZone = `Suggested stop at ${stopLossSuggestion} (~${stopPct}% from entry)`;
      notes.push("No stop loss provided — using timeframe-based estimate");
      riskScore += 10;
    }

    if (input.regime === "volatile") { riskScore += 20; notes.push("Volatile market regime increases risk"); }
    else if (input.regime === "trend") { riskScore -= 5; notes.push("Trending market reduces regime risk"); }
    else if (input.regime === "breakout" || input.regime === "breakdown") { riskScore += 10; notes.push("Breakout/breakdown setups carry higher failure risk"); }

    if (input.confidenceScore > 75) { riskScore -= 8; }
    else if (input.confidenceScore < 45) { riskScore += 10; }

    const shortTermFrames = ["1m", "3m", "5m"];
    const longTermFrames = ["1d", "3d", "1w", "1M"];
    if (shortTermFrames.includes(input.timeframe)) { riskScore += 10; notes.push("Very short timeframes increase noise and risk"); }
    else if (longTermFrames.includes(input.timeframe)) { riskScore -= 5; notes.push("Longer timeframe signals are more reliable"); }

    riskScore = Math.max(5, Math.min(95, riskScore));
    const description = notes.length > 0 ? notes.join(". ") : "Risk assessment based on available inputs.";

    return { riskScore: Math.round(riskScore), stopLossSuggestion, invalidationZone, riskRewardRatio, description };
  }

  private calculateRiskFromCandle(candle: Candle, regime: string, confidenceScore: number, timeframe: string): RiskAnalysis {
    const notes: string[] = [];
    let riskScore = 45;

    const range = candle.high - candle.low;
    const isBullish = candle.close >= candle.open;
    const body = Math.abs(candle.close - candle.open);
    const bodyRatio = range > 0 ? body / range : 0;

    const stopPct = this.getTimeframeStopPct(timeframe);
    const stopBuffer = range * 0.1;

    let stopLossSuggestion: number;
    let invalidationZone: string;
    let targetZonePrice: number;

    if (isBullish) {
      stopLossSuggestion = parseFloat((candle.low - stopBuffer).toFixed(4));
      invalidationZone = `Below candle low at ${candle.low.toFixed(4)} — a close below this level invalidates the bullish setup`;
      targetZonePrice = candle.close + (candle.close - stopLossSuggestion) * 2;
    } else {
      stopLossSuggestion = parseFloat((candle.high + stopBuffer).toFixed(4));
      invalidationZone = `Above candle high at ${candle.high.toFixed(4)} — a close above this level invalidates the bearish setup`;
      targetZonePrice = candle.close - (stopLossSuggestion - candle.close) * 2;
    }

    const riskAmount = Math.abs(candle.close - stopLossSuggestion);
    const rewardAmount = Math.abs(targetZonePrice - candle.close);
    const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 2;

    if (riskRewardRatio >= 2.5) { riskScore -= 12; notes.push(`Favorable R:R of ${riskRewardRatio.toFixed(1)}:1 based on candle structure`); }
    else if (riskRewardRatio >= 1.5) { riskScore -= 5; notes.push(`Acceptable R:R of ${riskRewardRatio.toFixed(1)}:1`); }
    else { riskScore += 15; notes.push(`Poor R:R of ${riskRewardRatio.toFixed(1)}:1 from candle structure`); }

    if (bodyRatio > 0.65) { riskScore -= 8; notes.push("Strong momentum candle reduces uncertainty"); }
    else if (bodyRatio < 0.25) { riskScore += 12; notes.push("Indecision candle increases risk"); }

    if (regime === "volatile") { riskScore += 18; notes.push("Volatile regime significantly increases risk"); }
    else if (regime === "trend") { riskScore -= 8; notes.push("Trending regime supports directional risk management"); }
    else if (regime === "breakout" || regime === "breakdown") { riskScore += 8; notes.push("Breakout/breakdown setups carry false-break risk"); }
    else if (regime === "range") { riskScore += 5; notes.push("Range market: watch for reversals at boundaries"); }

    if (confidenceScore > 75) { riskScore -= 8; }
    else if (confidenceScore < 40) { riskScore += 10; }

    const shortTermFrames = ["1m", "5m"];
    if (shortTermFrames.includes(timeframe)) { riskScore += 8; notes.push(`Short ${timeframe} timeframe adds noise risk`); }

    const riskPct = (riskAmount / candle.close) * 100;
    notes.push(`Stop ${riskPct.toFixed(2)}% from current close`);
    notes.push(`Suggested stop: ${stopLossSuggestion}, implied target: ${targetZonePrice.toFixed(4)}`);

    riskScore = Math.max(5, Math.min(95, Math.round(riskScore)));
    const description = notes.join(". ");

    return { riskScore, stopLossSuggestion, invalidationZone, riskRewardRatio, description };
  }

  private getTimeframeStopPct(timeframe: string): number {
    const stopMap: Record<string, number> = {
      "1m": 0.3, "3m": 0.5, "5m": 0.7, "15m": 1.0, "30m": 1.2,
      "1h": 1.5, "2h": 1.8, "4h": 2.5, "6h": 3.0, "8h": 3.2,
      "12h": 3.5, "1d": 4.0, "3d": 5.0, "1w": 7.0, "1M": 10.0,
    };
    return stopMap[timeframe] || 2.0;
  }
}

export const riskService = new RiskService();
