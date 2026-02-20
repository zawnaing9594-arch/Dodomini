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

  app.patch("/api/episodes/:epId", async (req, res) => {
    if (!(req.session as any)?.isAdmin) return res.status(401).json({ error: "Not authenticated" });
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return res.status(400).json({ error: "Invalid ID" });
    const existing = await storage.getEpisodeById(epId);
    if (!existing) return res.status(404).json({ error: "Episode not found" });
    const { isLocked, password, epTitle, videoLink, contentId } = req.body;
    const updateData: any = {};
    if (typeof isLocked === "boolean") updateData.isLocked = isLocked;
    if (typeof password === "string") updateData.password = password || null;
    if (typeof epTitle === "string" && epTitle.trim()) updateData.epTitle = epTitle.trim();
    if (typeof videoLink === "string" && videoLink.trim()) updateData.videoLink = videoLink.trim();
    if (typeof contentId === "number") updateData.contentId = contentId;
    const ep = await storage.updateEpisode(epId, updateData);
    res.json({ ...ep, password: undefined });
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

  app.get("/api/banners", async (_req, res) => {
    const banners = await storage.getBannerContent();
    res.json(banners);
  });

  app.post("/api/banners/toggle", async (req, res) => {
    if (!(req.session as any)?.isAdmin) return res.status(401).json({ error: "Not authenticated" });
    const { id, isBanner, bannerOrder } = req.body;
    if (!id) return res.status(400).json({ error: "Missing ID" });
    const item = await storage.toggleBanner(id, isBanner, bannerOrder);
    res.json(item);
  });

  app.post("/api/banners/reorder", async (req, res) => {
    if (!(req.session as any)?.isAdmin) return res.status(401).json({ error: "Not authenticated" });
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "Missing orderedIds" });
    for (let i = 0; i < orderedIds.length; i++) {
      await storage.toggleBanner(orderedIds[i], true, i + 1);
    }
    const banners = await storage.getBannerContent();
    res.json(banners);
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

  app.get("/api/analytics-id", (_req, res) => {
    const id = process.env.GA_MEASUREMENT_ID || "";
    res.json({ id });
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const allContent = await storage.getAllContent();
    const baseUrl = "https://series-plus-myanmar.replit.app";
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
    for (const c of allContent) {
      xml += `\n  <url><loc>${baseUrl}/series/${c.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }
    xml += `\n</urlset>`;
    res.header("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/api/latest-episodes", async (_req, res) => {
    const allContent = await storage.getAllContent();
    const latestEps: Array<{ episode: any; contentTitle: string }> = [];
    for (const c of allContent) {
      const eps = await storage.getEpisodesByContentId(c.id);
      for (const ep of eps) {
        latestEps.push({ episode: { ...ep, password: undefined }, contentTitle: c.title });
      }
    }
    latestEps.sort((a, b) => b.episode.epId - a.episode.epId);
    res.json(latestEps.slice(0, 20));
  });

  return httpServer;
}
