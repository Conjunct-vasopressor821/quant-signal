import type { SignalType } from "./signalService.js";

export type FinalBanner = "Safe" | "Caution" | "Avoid";

export interface Judgement {
  finalSignal: SignalType;
  finalBanner: FinalBanner;
  adjustedConfidence: number;
  explanation: string;
}

export class JudgeService {
  judge(input: {
    candidateSignal: SignalType;
    confidenceScore: number;
    riskScore: number;
    regime: string;
    riskRewardRatio?: number;
    symbol: string;
    timeframe: string;
  }): Judgement {
    let finalSignal = input.candidateSignal;
    let finalBanner: FinalBanner;
    let adjustedConfidence = input.confidenceScore;

    // Override to Avoid if risk is extreme
    if (input.riskScore > 80 && input.confidenceScore < 50) {
      finalSignal = "Avoid";
      adjustedConfidence = Math.max(15, adjustedConfidence - 15);
    }

    // Override to Hold if risk is high but signal exists
    if (input.riskScore > 70 && finalSignal !== "Avoid" && input.confidenceScore < 55) {
      finalSignal = "Hold";
      adjustedConfidence = Math.max(20, adjustedConfidence - 10);
    }

    // Determine banner
    const effectiveRisk = input.riskScore;
    const effectiveConfidence = adjustedConfidence;

    if (finalSignal === "Avoid") {
      finalBanner = "Avoid";
    } else if (effectiveRisk > 65 || effectiveConfidence < 45) {
      finalBanner = "Caution";
    } else if (effectiveRisk > 50 || effectiveConfidence < 60) {
      finalBanner = "Caution";
    } else {
      finalBanner = "Safe";
    }

    // Build explanation
    const signalContext = this.buildExplanation({
      finalSignal,
      adjustedConfidence,
      riskScore: input.riskScore,
      regime: input.regime,
      riskRewardRatio: input.riskRewardRatio,
      symbol: input.symbol,
      timeframe: input.timeframe,
      finalBanner,
    });

    return {
      finalSignal,
      finalBanner,
      adjustedConfidence: Math.round(adjustedConfidence),
      explanation: signalContext,
    };
  }

  private buildExplanation(params: {
    finalSignal: SignalType;
    adjustedConfidence: number;
    riskScore: number;
    regime: string;
    riskRewardRatio?: number;
    symbol: string;
    timeframe: string;
    finalBanner: FinalBanner;
  }): string {
    const { finalSignal, adjustedConfidence, riskScore, regime, symbol, timeframe, finalBanner } =
      params;

    const signalWords: Record<SignalType, string> = {
      Buy: "enter a long position",
      Sell: "enter a short position",
      Hold: "wait for a better entry or more confirmation",
      Avoid: "stay out of this trade entirely",
    };

    const bannerContext: Record<FinalBanner, string> = {
      Safe: "The setup meets acceptable risk parameters and has reasonable conviction.",
      Caution:
        "The setup has elevated risk or limited conviction. Proceed with reduced position size if at all.",
      Avoid:
        "The risk-to-reward is unfavorable or market conditions are too uncertain. It is advisable to skip this trade.",
    };

    let explanation = `For ${symbol} on the ${timeframe} timeframe, the analysis suggests to **${signalWords[finalSignal]}**. `;

    explanation += `Confidence in this signal is ${adjustedConfidence}% with a risk score of ${riskScore}/100. `;
    explanation += `The current market regime is classified as **${regime}**. `;

    if (params.riskRewardRatio) {
      explanation += `The risk-to-reward ratio is ${params.riskRewardRatio.toFixed(1)}:1. `;
    }

    explanation += bannerContext[finalBanner];

    if (finalSignal === "Avoid" || finalBanner === "Avoid") {
      explanation +=
        " This is NOT a trade recommendation. Always do your own analysis and manage your risk appropriately.";
    } else {
      explanation +=
        " Remember: this is a validation tool, not a guarantee. Always use proper position sizing and risk management.";
    }

    return explanation;
  }
}

export const judgeService = new JudgeService();
