import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSchema, insertEpisodeSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import webpush from "web-push";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerObjectStorageRoutes(app);

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@seriesplus.app";

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  async function sendPushToAll(title: string, body: string, url: string) {
    if (!vapidPublicKey || !vapidPrivateKey) return;
    const subs = await storage.getAllPushSubscriptions();
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, icon: "/icon-192.png", url })
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await storage.removePushSubscription(sub.endpoint);
        }
      }
    }
  }

  app.get("/api/vapid-public-key", (_req, res) => {
    res.json({ key: vapidPublicKey });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    const userId = (req.session as any)?.userId || null;
    await storage.savePushSubscription({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    res.json({ ok: true });
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    await storage.removePushSubscription(endpoint);
    res.json({ ok: true });
  });

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
    const parent = await storage.getContentById(ep.contentId);
    if (parent) {
      sendPushToAll(
        "Series Plus Myanmar",
        `${parent.title} - ${ep.epTitle} အသစ်ရောက်ပါပြီ`,
        `/e/${ep.epId}`
      ).catch(() => {});
    }
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
    const parent = await storage.getContentById(Number(contentId));
    if (parent && inserted.length > 0) {
      sendPushToAll(
        "Series Plus Myanmar",
        `${parent.title} - Episode ${inserted.length} ခုအသစ်ရောက်ပါပြီ`,
        `/series/${parent.id}`
      ).catch(() => {});
    }
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

  function isSocialBot(ua: string): boolean {
    return /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|Pinterest|Googlebot/i.test(ua || "");
  }

  function escHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderOgHtml(title: string, description: string, url: string, ogType: string, image?: string): string {
    const t = escHtml(title);
    const d = escHtml(description);
    const u = escHtml(url);
    const img = image ? escHtml(image) : "";
    return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="UTF-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta property="og:type" content="${escHtml(ogType)}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:site_name" content="Series Plus Myanmar" />
  ${img ? `<meta property="og:image" content="${img}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  ${img ? `<meta name="twitter:image" content="${img}" />` : ""}
</head>
<body></body>
</html>`;
  }

  app.get("/e/:epId", async (req, res, next) => {
    if (!isSocialBot(req.headers["user-agent"] || "")) return next();
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return next();
    try {
      const episode = await storage.getEpisodeById(epId);
      if (!episode) return next();
      const parent = await storage.getContentById(episode.contentId);
      if (!parent) return next();
      const title = `${parent.title} - ${episode.epTitle} | Series Plus Myanmar`;
      const desc = `${parent.title} - ${episode.epTitle} ကို Series Plus Myanmar မှာ ကြည့်ရှုပါ`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const image = parent.poster?.startsWith("http") ? parent.poster : (parent.poster ? `${baseUrl}${parent.poster}` : "");
      res.send(renderOgHtml(title, desc, `${baseUrl}/e/${epId}`, "video.episode", image));
    } catch { next(); }
  });

  app.get("/:seriesSlug/:epSlug", async (req, res, next) => {
    if (!isSocialBot(req.headers["user-agent"] || "")) return next();
    if (req.params.seriesSlug.startsWith("api") || req.params.seriesSlug.startsWith("objects")) return next();
    try {
      const result = await storage.findEpisodeBySlug(
        decodeURIComponent(req.params.seriesSlug),
        decodeURIComponent(req.params.epSlug)
      );
      if (!result) return next();
      const { episode, parent } = result;
      const title = `${parent.title} - ${episode.epTitle} | Series Plus Myanmar`;
      const desc = `${parent.title} - ${episode.epTitle} ကို Series Plus Myanmar မှာ ကြည့်ရှုပါ`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const image = parent.poster?.startsWith("http") ? parent.poster : (parent.poster ? `${baseUrl}${parent.poster}` : "");
      res.send(renderOgHtml(title, desc, `${baseUrl}${req.originalUrl}`, "video.episode", image));
    } catch { next(); }
  });

  app.get("/series/:id", async (req, res, next) => {
    if (!isSocialBot(req.headers["user-agent"] || "")) return next();
    const id = parseInt(req.params.id);
    if (isNaN(id)) return next();
    try {
      const item = await storage.getContentById(id);
      if (!item) return next();
      const title = `${item.title} | Series Plus Myanmar`;
      const desc = item.description || `${item.title} ကို Series Plus Myanmar မှာ ကြည့်ရှုပါ`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const image = item.poster?.startsWith("http") ? item.poster : (item.poster ? `${baseUrl}${item.poster}` : "");
      res.send(renderOgHtml(title, desc, `${baseUrl}/series/${id}`, "video.tv_show", image));
    } catch { next(); }
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
