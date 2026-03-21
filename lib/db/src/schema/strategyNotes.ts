import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const strategyNotesTable = pgTable("strategy_notes", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  analysisRunUuid: text("analysis_run_uuid").notNull(),
  note: text("note").notNull(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStrategyNoteSchema = createInsertSchema(strategyNotesTable).omit({ id: true });
export type InsertStrategyNote = z.infer<typeof insertStrategyNoteSchema>;
export type StrategyNote = typeof strategyNotesTable.$inferSelect;
