import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradeHistoryTable = pgTable("trade_history", {
  id: serial("id").primaryKey(),
  uploadFileUuid: text("upload_file_uuid").notNull(),
  date: text("date").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // buy, sell, long, short
  entry: real("entry").notNull(),
  exit: real("exit").notNull(),
  pnl: real("pnl").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTradeHistorySchema = createInsertSchema(tradeHistoryTable).omit({ id: true });
export type InsertTradeHistory = z.infer<typeof insertTradeHistorySchema>;
export type TradeHistory = typeof tradeHistoryTable.$inferSelect;
