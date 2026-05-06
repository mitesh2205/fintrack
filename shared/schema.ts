import { sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  type: text("type").notNull(),
  lastFour: text("last_four"),
  color: text("color"),
  currentBalance: real("current_balance"), // user-provided live balance for Roj-Med Baki
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  merchant: text("merchant"),
  category: text("category").notNull(),
  amount: real("amount").notNull(), // negative = expense, positive = income
  type: text("type").notNull(), // debit or credit
  originalDescription: text("original_description"),
  categoryLocked: text("category_locked"), // "1" = user-set, skip auto-recategorize
});

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  limit: real("limit").notNull(),
  period: text("period").notNull(), // monthly, weekly
  color: text("color"),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  savedAmount: real("saved_amount").notNull().default(0),
  deadline: text("deadline"),     // YYYY-MM-DD, optional
  icon: text("icon"),             // emoji
  color: text("color"),           // hex or tailwind token
  note: text("note"),
});

export const insertGoalSchema = createInsertSchema(goals).omit({ id: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;
