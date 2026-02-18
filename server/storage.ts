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
  findEpisodeBySlug(seriesSlug: string, epSlug: string): Promise<{ episode: Episode; parent: Content } | null>;
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

  async findEpisodeBySlug(seriesSlug: string, epSlug: string): Promise<{ episode: Episode; parent: Content } | null> {
    const allContent = await db.select().from(content);
    const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const matchedContent = allContent.find((c) => toSlug(c.title) === seriesSlug);
    if (!matchedContent) return null;

    const allEps = await db.select().from(episodes).where(eq(episodes.contentId, matchedContent.id));
    const matchedEp = allEps.find((ep) => toSlug(ep.epTitle) === epSlug);
    if (!matchedEp) return null;

    return { episode: matchedEp, parent: matchedContent };
  }
}

export const storage = new DatabaseStorage();
