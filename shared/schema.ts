import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("series"),
  thumb: text("thumb").notNull(),
  banner: text("banner"),
  description: text("description"),
  isLocked: boolean("is_locked").notNull().default(false),
  password: text("password"),
});

export const episodes = pgTable("episodes", {
  epId: serial("ep_id").primaryKey(),
  contentId: integer("content_id").notNull(),
  epTitle: text("ep_title").notNull(),
  videoLink: text("video_link").notNull(),
});

export const insertContentSchema = createInsertSchema(content).omit({ id: true });
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ epId: true });

export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof content.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type Episode = typeof episodes.$inferSelect;
