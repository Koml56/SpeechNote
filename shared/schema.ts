import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const audioRecordings = pgTable("audio_recordings", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull(),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // in seconds
  audioData: text("audio_data").notNull(), // base64 encoded audio blob
  mimeType: text("mime_type").notNull(),
  transcription: text("transcription"), // transcribed text from speech-to-text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const textNotes = pgTable("text_notes", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRecipeSchema = createInsertSchema(recipes).pick({
  name: true,
});

export const insertAudioRecordingSchema = createInsertSchema(audioRecordings).pick({
  recipeId: true,
  name: true,
  duration: true,
  audioData: true,
  mimeType: true,
  transcription: true,
});

export const insertTextNoteSchema = createInsertSchema(textNotes).pick({
  recipeId: true,
  content: true,
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type AudioRecording = typeof audioRecordings.$inferSelect;
export type InsertAudioRecording = z.infer<typeof insertAudioRecordingSchema>;
export type TextNote = typeof textNotes.$inferSelect;
export type InsertTextNote = z.infer<typeof insertTextNoteSchema>;
