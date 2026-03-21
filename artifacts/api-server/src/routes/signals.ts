import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db/schema";
import { desc, count } from "drizzle-orm";

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

export default router;
