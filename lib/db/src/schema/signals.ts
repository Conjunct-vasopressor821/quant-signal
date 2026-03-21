import { pgTable, text, serial, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  analysisRunUuid: text("analysis_run_uuid").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  signal: text("signal").notNull(), // Buy, Sell, Hold, Avoid
  confidenceScore: real("confidence_score").notNull(),
  riskScore: real("risk_score").notNull(),
  marketRegime: text("market_regime").notNull(), // trend, range, breakout, breakdown, volatile
  explanation: text("explanation").notNull(),
  invalidationZone: text("invalidation_zone").notNull(),
  stopLossSuggestion: real("stop_loss_suggestion"),
  finalBanner: text("final_banner").notNull(), // Safe, Caution, Avoid
  serviceBreakdown: jsonb("service_breakdown").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
