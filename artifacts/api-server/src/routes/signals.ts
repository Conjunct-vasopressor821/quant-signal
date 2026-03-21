import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db/schema";
import { desc, count, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/signals/history", async (req, res) => {
  try {
    const rawLimit = parseInt(String(req.query["limit"] || "20"), 10);
    const rawOffset = parseInt(String(req.query["offset"] || "0"), 10);
    const limit = Math.min(Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : rawLimit, 100);
    const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    const [items, [{ total }]] = await Promise.all([
      db
        .select({
          id: signalsTable.uuid,
          symbol: signalsTable.symbol,
          timeframe: signalsTable.timeframe,
          signal: signalsTable.signal,
          confidenceScore: signalsTable.confidenceScore,
          riskScore: signalsTable.riskScore,
          marketRegime: signalsTable.marketRegime,
          finalBanner: signalsTable.finalBanner,
          createdAt: signalsTable.createdAt,
        })
        .from(signalsTable)
        .orderBy(desc(signalsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(signalsTable),
    ]);

    res.json({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      total: Number(total),
      limit,
      offset,
    });
  } catch (err) {
    req.log.error({ err }, "Error in /signals/history");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch signal history" });
  }
});

router.get("/signals/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [signal] = await db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.uuid, id))
      .limit(1);

    if (!signal) {
      res.status(404).json({ error: "not_found", message: "Signal not found" });
      return;
    }

    res.json({
      id: signal.uuid,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      signal: signal.signal,
      confidenceScore: signal.confidenceScore,
      riskScore: signal.riskScore,
      marketRegime: signal.marketRegime,
      explanation: signal.explanation,
      invalidationZone: signal.invalidationZone,
      stopLossSuggestion: signal.stopLossSuggestion,
      finalBanner: signal.finalBanner,
      serviceBreakdown: signal.serviceBreakdown,
      createdAt: signal.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error in /signals/:id");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch signal" });
  }
});

export default router;
