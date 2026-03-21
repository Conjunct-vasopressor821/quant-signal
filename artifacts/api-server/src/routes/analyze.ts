import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { analysisRunsTable, signalsTable, strategyNotesTable } from "@workspace/db/schema";
import { ingestionService } from "../services/ingestionService.js";
import { regimeService } from "../services/regimeService.js";
import { riskService } from "../services/riskService.js";
import { signalService } from "../services/signalService.js";
import { judgeService } from "../services/judgeService.js";
import { reportService } from "../services/reportService.js";
import { geminiService } from "../services/geminiService.js";

const router: IRouter = Router();

router.post("/analyze", async (req, res) => {
  try {
    const body = req.body as {
      symbol?: string;
      timeframe?: string;
      strategyNote?: string;
      entryPrice?: number;
      stopLoss?: number;
      target?: number;
      marketBias?: string;
      screenshotFileId?: string;
      tradeFileId?: string;
    };

    const { symbol, timeframe } = body;

    if (!symbol || !timeframe) {
      res.status(400).json({ error: "validation_error", message: "symbol and timeframe are required" });
      return;
    }

    const analysisUuid = randomUUID();

    // 1. Ingestion
    const parsed = ingestionService.parseInput({
      symbol,
      timeframe,
      strategyNote: body.strategyNote,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      target: body.target,
      marketBias: body.marketBias,
      screenshotFileId: body.screenshotFileId,
      tradeFileId: body.tradeFileId,
    });

    // 2. Regime detection
    const regimeAnalysis = regimeService.detectRegime({
      symbol,
      timeframe,
      marketBias: body.marketBias,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      target: body.target,
      strategyNote: body.strategyNote,
    });

    // 3. Signal generation
    const candidateSignal = signalService.generateCandidateSignal({
      symbol,
      timeframe,
      marketBias: body.marketBias,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      target: body.target,
      strategyNote: body.strategyNote,
      regime: regimeAnalysis.regime,
      hasScreenshot: parsed.hasScreenshot,
      hasTradeHistory: parsed.hasTradeHistory,
    });

    // 4. Risk analysis
    const riskAnalysis = riskService.calculateRisk({
      symbol,
      timeframe,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      target: body.target,
      marketBias: body.marketBias,
      regime: regimeAnalysis.regime,
      confidenceScore: candidateSignal.confidenceScore,
    });

    // 5. Judge
    const judgement = judgeService.judge({
      candidateSignal: candidateSignal.signal,
      confidenceScore: candidateSignal.confidenceScore,
      riskScore: riskAnalysis.riskScore,
      regime: regimeAnalysis.regime,
      riskRewardRatio: riskAnalysis.riskRewardRatio,
      symbol,
      timeframe,
    });

    // 6. Optionally enhance with Gemini AI
    let finalExplanation = judgement.explanation;
    const geminiEnhanced = await geminiService.enhanceExplanation({
      symbol,
      timeframe,
      signal: judgement.finalSignal,
      regime: regimeAnalysis.regime,
      confidenceScore: judgement.adjustedConfidence,
      riskScore: riskAnalysis.riskScore,
      strategyNote: body.strategyNote,
      signalReasoning: candidateSignal.reasoning,
    });
    if (geminiEnhanced) {
      finalExplanation = geminiEnhanced;
    }

    // 7. Build report
    const signalUuid = randomUUID();
    const judgeNotes = `Final signal ${judgement.finalSignal} with banner ${judgement.finalBanner}. ${
      judgement.adjustedConfidence !== candidateSignal.confidenceScore
        ? `Confidence adjusted from ${candidateSignal.confidenceScore} to ${judgement.adjustedConfidence}.`
        : "No confidence adjustment."
    }`;

    const report = reportService.buildReport({
      uuid: signalUuid,
      symbol,
      timeframe,
      signal: judgement.finalSignal,
      confidenceScore: judgement.adjustedConfidence,
      riskScore: riskAnalysis.riskScore,
      marketRegime: regimeAnalysis.regime,
      explanation: finalExplanation,
      invalidationZone: riskAnalysis.invalidationZone,
      stopLossSuggestion: riskAnalysis.stopLossSuggestion,
      finalBanner: judgement.finalBanner,
      ingestionSummary: parsed.summary,
      signalReasoning: candidateSignal.reasoning,
      riskDescription: riskAnalysis.description,
      regimeDescription: regimeAnalysis.description,
      judgeNotes,
    });

    // 8. Persist to DB
    await db.insert(analysisRunsTable).values({
      uuid: analysisUuid,
      symbol,
      timeframe,
      marketBias: body.marketBias,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      target: body.target,
      strategyNote: body.strategyNote,
      screenshotFileId: body.screenshotFileId,
      tradeFileId: body.tradeFileId,
      status: "completed",
    });

    await db.insert(signalsTable).values({
      uuid: signalUuid,
      analysisRunUuid: analysisUuid,
      symbol,
      timeframe,
      signal: judgement.finalSignal,
      confidenceScore: judgement.adjustedConfidence,
      riskScore: riskAnalysis.riskScore,
      marketRegime: regimeAnalysis.regime,
      explanation: finalExplanation,
      invalidationZone: riskAnalysis.invalidationZone,
      stopLossSuggestion: riskAnalysis.stopLossSuggestion,
      finalBanner: judgement.finalBanner,
      serviceBreakdown: report.serviceBreakdown,
    });

    if (body.strategyNote) {
      await db.insert(strategyNotesTable).values({
        uuid: randomUUID(),
        analysisRunUuid: analysisUuid,
        note: body.strategyNote,
        symbol,
        timeframe,
      });
    }

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Error in /analyze");
    res.status(500).json({ error: "internal_error", message: "Analysis failed" });
  }
});

router.get("/settings/check", (_req, res) => {
  res.json({
    geminiApiKeyConfigured: geminiService.isConfigured(),
    databaseConnected: true,
    version: "1.0.0-mvp",
  });
});

export default router;
