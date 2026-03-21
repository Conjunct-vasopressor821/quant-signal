import type { SignalType } from "./signalService.js";
import type { FinalBanner } from "./judgeService.js";

export interface SignalReport {
  id: string;
  symbol: string;
  timeframe: string;
  signal: SignalType;
  confidenceScore: number;
  riskScore: number;
  marketRegime: string;
  explanation: string;
  invalidationZone: string;
  stopLossSuggestion?: number;
  finalBanner: FinalBanner;
  serviceBreakdown: {
    ingestion: string;
    signal: string;
    risk: string;
    regime: string;
    judge: string;
  };
  createdAt: string;
}

export class ReportService {
  buildReport(params: {
    uuid: string;
    symbol: string;
    timeframe: string;
    signal: SignalType;
    confidenceScore: number;
    riskScore: number;
    marketRegime: string;
    explanation: string;
    invalidationZone: string;
    stopLossSuggestion?: number;
    finalBanner: FinalBanner;
    ingestionSummary: string;
    signalReasoning: string[];
    riskDescription: string;
    regimeDescription: string;
    judgeNotes: string;
  }): SignalReport {
    return {
      id: params.uuid,
      symbol: params.symbol,
      timeframe: params.timeframe,
      signal: params.signal,
      confidenceScore: params.confidenceScore,
      riskScore: params.riskScore,
      marketRegime: params.marketRegime,
      explanation: params.explanation,
      invalidationZone: params.invalidationZone,
      stopLossSuggestion: params.stopLossSuggestion,
      finalBanner: params.finalBanner,
      serviceBreakdown: {
        ingestion: params.ingestionSummary,
        signal: params.signalReasoning.slice(0, 3).join("; "),
        risk: params.riskDescription,
        regime: params.regimeDescription,
        judge: params.judgeNotes,
      },
      createdAt: new Date().toISOString(),
    };
  }
}

export const reportService = new ReportService();
