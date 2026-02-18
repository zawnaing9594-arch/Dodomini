import {
  type Content,
  type InsertContent,
  type Episode,
  type InsertEpisode,
  content,
  episodes,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getAllContent(): Promise<Content[]>;
  getContentById(id: number): Promise<Content | undefined>;
  createContent(data: InsertContent): Promise<Content>;
  updateContent(id: number, data: Partial<InsertContent>): Promise<Content>;
  deleteContent(id: number): Promise<void>;
  getEpisodesByContentId(contentId: number): Promise<Episode[]>;
  getEpisodeById(epId: number): Promise<Episode | undefined>;
  createEpisode(data: InsertEpisode): Promise<Episode>;
  createEpisodesBulk(data: InsertEpisode[]): Promise<Episode[]>;
  deleteEpisode(epId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllContent(): Promise<Content[]> {
    return db.select().from(content);
  }

  async getContentById(id: number): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item;
  }

  async createContent(data: InsertContent): Promise<Content> {
    const [item] = await db.insert(content).values(data).returning();
    return item;
  }

  async updateContent(id: number, data: Partial<InsertContent>): Promise<Content> {
    const [item] = await db.update(content).set(data).where(eq(content.id, id)).returning();
    return item;
  }

  async deleteContent(id: number): Promise<void> {
    await db.delete(episodes).where(eq(episodes.contentId, id));
    await db.delete(content).where(eq(content.id, id));
  }

  async getEpisodesByContentId(contentId: number): Promise<Episode[]> {
    return db.select().from(episodes).where(eq(episodes.contentId, contentId));
  }

  async getEpisodeById(epId: number): Promise<Episode | undefined> {
    const [ep] = await db.select().from(episodes).where(eq(episodes.epId, epId));
    return ep;
  }

  async createEpisode(data: InsertEpisode): Promise<Episode> {
    const [ep] = await db.insert(episodes).values(data).returning();
    return ep;
  }

  async createEpisodesBulk(data: InsertEpisode[]): Promise<Episode[]> {
    if (data.length === 0) return [];
    return db.insert(episodes).values(data).returning();
  }

  async deleteEpisode(epId: number): Promise<void> {
    await db.delete(episodes).where(eq(episodes.epId, epId));
  }
}

export const storage = new DatabaseStorage();
