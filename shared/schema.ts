import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  xmlId: text("xml_id").notNull().unique(),
  grade: integer("grade").notNull(),
  domain: text("domain").notNull(),
  standard: text("standard").notNull(),
  tier: integer("tier").notNull(),
  questionText: text("question_text").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  answerKey: text("answer_key").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  explanation: text("explanation").notNull(),
  theme: text("theme").notNull(),
  tokensUsed: integer("tokens_used").default(0),
  status: text("status").default("pending"),
  validationStatus: text("validation_status").default("pending"),
  validationErrors: jsonb("validation_errors").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const xmlFiles = pgTable("xml_files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalContent: text("original_content").notNull(),
  questionCount: integer("question_count").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQuestionSchema = insertQuestionSchema.partial();

export const insertXmlFileSchema = createInsertSchema(xmlFiles).omit({
  id: true,
  uploadedAt: true,
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type UpdateQuestion = z.infer<typeof updateQuestionSchema>;
export type XmlFile = typeof xmlFiles.$inferSelect;
export type InsertXmlFile = z.infer<typeof insertXmlFileSchema>;
