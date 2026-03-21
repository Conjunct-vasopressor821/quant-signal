import { pgTable, text, serial, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysisRunsTable = pgTable("analysis_runs", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  marketBias: text("market_bias"),
  entryPrice: real("entry_price"),
  stopLoss: real("stop_loss"),
  target: real("target"),
  strategyNote: text("strategy_note"),
  screenshotFileId: text("screenshot_file_id"),
  tradeFileId: text("trade_file_id"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisRunSchema = createInsertSchema(analysisRunsTable).omit({ id: true });
export type InsertAnalysisRun = z.infer<typeof insertAnalysisRunSchema>;
export type AnalysisRun = typeof analysisRunsTable.$inferSelect;
