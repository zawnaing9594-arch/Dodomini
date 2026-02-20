import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("series"),
  poster: text("poster").notNull(),
  description: text("description"),
  isBanner: boolean("is_banner").notNull().default(false),
  bannerOrder: integer("banner_order").notNull().default(0),
});

export const episodes = pgTable("episodes", {
  epId: serial("ep_id").primaryKey(),
  contentId: integer("content_id").notNull(),
  epTitle: text("ep_title").notNull(),
  videoLink: text("video_link").notNull(),
  srtLink: text("srt_link"),
  isLocked: boolean("is_locked").notNull().default(false),
  password: text("password"),
  epOrder: integer("ep_order").notNull().default(0),
});

export const insertContentSchema = createInsertSchema(content).omit({ id: true });
export const insertEpisodeSchema = createInsertSchema(episodes).omit({ epId: true });

export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof content.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type Episode = typeof episodes.$inferSelect;
