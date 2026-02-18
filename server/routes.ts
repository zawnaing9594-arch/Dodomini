import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSchema, insertEpisodeSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const uploadDir = path.join(process.cwd(), "client", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

    const isLocked = parent.isLocked;
    const unlockKey = `unlocked_${parent.id}`;
    const sessionUnlocked = (req.session as any)?.[unlockKey];

    res.json({
      episode,
      parent: isLocked && !sessionUnlocked
        ? { ...parent, isLocked: true, password: undefined }
        : { ...parent, isLocked: false, password: undefined },
      allEpisodes,
    });
  });

  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.post("/api/watch/:epId/unlock", async (req, res) => {
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return res.status(400).json({ error: "Invalid ID" });

    const episode = await storage.getEpisodeById(epId);
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    const parent = await storage.getContentById(episode.contentId);
    if (!parent) return res.status(404).json({ error: "Content not found" });

    const { password } = req.body;
    if (password !== parent.password) {
      return res.status(403).json({ error: "Wrong password" });
    }

    const unlockKey = `unlocked_${parent.id}`;
    (req.session as any)[unlockKey] = true;
    res.json({ ok: true });
  });

  return httpServer;
}
