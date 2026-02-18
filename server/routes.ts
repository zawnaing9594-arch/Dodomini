import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSchema, insertEpisodeSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerObjectStorageRoutes(app);

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      (req.session as any).isAdmin = true;
      return res.json({ ok: true });
    }
    return res.status(403).json({ error: "Wrong password" });
  });

  app.get("/api/admin/check", (req, res) => {
    if ((req.session as any)?.isAdmin) {
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: "Not authenticated" });
  });

  app.get("/api/content", async (_req, res) => {
    const items = await storage.getAllContent();
    res.json(items);
  });

  app.get("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const item = await storage.getContentById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  app.post("/api/content", async (req, res) => {
    const parsed = insertContentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const item = await storage.createContent(parsed.data);
    res.json(item);
  });

  app.patch("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getContentById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const item = await storage.updateContent(id, req.body);
    res.json(item);
  });

  app.delete("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteContent(id);
    res.json({ ok: true });
  });

  app.get("/api/content/:id/episodes", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const eps = await storage.getEpisodesByContentId(id);
    res.json(eps);
  });

  app.post("/api/episodes", async (req, res) => {
    const parsed = insertEpisodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const ep = await storage.createEpisode(parsed.data);
    res.json(ep);
  });

  app.post("/api/episodes/bulk", async (req, res) => {
    const { contentId, bulkLinks } = req.body;
    if (!contentId || !bulkLinks) return res.status(400).json({ error: "Missing data" });

    const lines = (bulkLinks as string).trim().split("\n").filter(Boolean);
    const toInsert = lines
      .filter((line: string) => line.includes(","))
      .map((line: string) => {
        const [title, ...linkParts] = line.split(",");
        return {
          contentId: Number(contentId),
          epTitle: title.trim(),
          videoLink: linkParts.join(",").trim(),
        };
      });

    const inserted = await storage.createEpisodesBulk(toInsert);
    res.json({ count: inserted.length });
  });

  app.delete("/api/episodes/:epId", async (req, res) => {
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return res.status(400).json({ error: "Invalid ID" });
    await storage.deleteEpisode(epId);
    res.json({ ok: true });
  });

  app.get("/api/watch/:epId", async (req, res) => {
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return res.status(400).json({ error: "Invalid ID" });

    const episode = await storage.getEpisodeById(epId);
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const parent = await storage.getContentById(episode.contentId);
    if (!parent) return res.status(404).json({ error: "Content not found" });

    const allEpisodes = await storage.getEpisodesByContentId(parent.id);

    const isLocked = episode.isLocked;
    const unlockKey = `unlocked_ep_${epId}`;
    const sessionUnlocked = (req.session as any)?.[unlockKey];

    res.json({
      episode: isLocked && !sessionUnlocked
        ? { ...episode, isLocked: true, password: undefined }
        : { ...episode, isLocked: false, password: undefined },
      parent,
      allEpisodes: allEpisodes.map((ep) => ({
        ...ep,
        password: undefined,
      })),
    });
  });

  app.get("/api/resolve/:seriesSlug/:epSlug", async (req, res) => {
    const { seriesSlug, epSlug } = req.params;
    const result = await storage.findEpisodeBySlug(seriesSlug, epSlug);
    if (!result) return res.status(404).json({ error: "Not found" });

    const allEpisodes = await storage.getEpisodesByContentId(result.parent.id);

    const isLocked = result.episode.isLocked;
    const unlockKey = `unlocked_ep_${result.episode.epId}`;
    const sessionUnlocked = (req.session as any)?.[unlockKey];

    res.json({
      episode: isLocked && !sessionUnlocked
        ? { ...result.episode, isLocked: true, password: undefined }
        : { ...result.episode, isLocked: false, password: undefined },
      parent: result.parent,
      allEpisodes: allEpisodes.map((ep) => ({
        ...ep,
        password: undefined,
      })),
    });
  });

  app.post("/api/watch/:epId/unlock", async (req, res) => {
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return res.status(400).json({ error: "Invalid ID" });

    const episode = await storage.getEpisodeById(epId);
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const { password } = req.body;
    if (password !== episode.password) {
      return res.status(403).json({ error: "Wrong password" });
    }

    const unlockKey = `unlocked_ep_${epId}`;
    (req.session as any)[unlockKey] = true;
    res.json({ ok: true });
  });

  return httpServer;
}
