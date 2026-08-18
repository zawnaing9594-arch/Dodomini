import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentSchema, insertEpisodeSchema } from "@shared/schema";
import {
  ObjectStorageService,
  objectStorageClient,
  registerObjectStorageRoutes,
} from "./replit_integrations/object_storage";
import webpush from "web-push";

const jumpShareCache = new Map<string, { url: string; ts: number }>();
const JUMPSHARE_CACHE_TTL = 3600000;

async function resolveJumpShareUrl(url: string): Promise<string | null> {
  const cacheKey = url.split("?")[0].split("#")[0];
  const cached = jumpShareCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < JUMPSHARE_CACHE_TTL) return cached.url;
  try {
    let embedUrl: string;
    if (url.includes("jumpshare.com/embed/")) {
      embedUrl = url.split("?")[0].split("#")[0];
    } else {
      const shareId = url.split("/").pop()?.replace(/[+-]$/, "") || "";
      embedUrl = `https://jumpshare.com/embed/${shareId}`;
    }
    const response = await fetch(embedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const cdnMatch = html.match(/src="(https:\/\/cdn\.jumpshare\.com\/preview\/[^"]+)"/);
    if (cdnMatch && cdnMatch[1]) {
      jumpShareCache.set(cacheKey, { url: cdnMatch[1], ts: Date.now() });
      return cdnMatch[1];
    }
  } catch {}
  return null;
}

function resolveCloudinaryUrl(url: string): string | null {
  if (url.includes("player.cloudinary.com/embed") || url.includes("player.cloudinary.com/?")) {
    try {
      const u = new URL(url);
      const cloudName = u.searchParams.get("cloud_name");
      const publicId = u.searchParams.get("public_id");
      const sourceUrl = u.searchParams.get("source_url");
      if (sourceUrl) return sourceUrl;
      if (cloudName && publicId) {
        const format = u.searchParams.get("format") || "mp4";
        const hasExt = /\.\w{2,5}$/.test(publicId);
        return `https://res.cloudinary.com/${cloudName}/video/upload/${hasExt ? publicId : `${publicId}.${format}`}`;
      }
    } catch {}
  }
  return null;
}

function resolveDropboxUrl(url: string): string | null {
  if (!url.includes("dropbox.com")) return null;
  const cleaned = url.replace(/[?&]dl=[01]/, "").replace(/\?$/, "");
  return cleaned + (cleaned.includes("?") ? "&raw=1" : "?raw=1");
}

async function autoResolveVideoLink(videoLink: string, forStorage = false): Promise<string> {
  if (videoLink.includes("player.cloudinary.com")) {
    const resolved = resolveCloudinaryUrl(videoLink);
    if (resolved) return resolved;
  }
  if (videoLink.includes("dropbox.com")) {
    const resolved = resolveDropboxUrl(videoLink);
    if (resolved) return resolved;
  }
  if (!forStorage) {
    const isJumpShare = videoLink.includes("jumpshare.com/embed/") || videoLink.includes("jumpshare.com/s/") || videoLink.includes("jumpshare.com/v/") || videoLink.includes("jumpshare.com/share/") || videoLink.includes("jmp.sh/");
    if (isJumpShare && !videoLink.includes("cdn.jumpshare.com")) {
      const resolved = await resolveJumpShareUrl(videoLink);
      if (resolved) return resolved;
    }
  }
  return videoLink;
}

async function autoResolveExistingEpisodes() {
  try {
    const { db } = await import("./db");
    const { episodes } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const allEps = await db.select({ epId: episodes.epId, videoLink: episodes.videoLink }).from(episodes);
    for (const ep of allEps) {
      if (!ep.videoLink) continue;
      if (ep.videoLink.includes("cdn.jumpshare.com")) continue;
      const resolved = await autoResolveVideoLink(ep.videoLink, true);
      if (resolved !== ep.videoLink) {
        await db.update(episodes).set({ videoLink: resolved }).where(eq(episodes.epId, ep.epId));
        console.log(`Auto-resolved episode ${ep.epId}: ${ep.videoLink.substring(0, 60)}... → ${resolved.substring(0, 60)}...`);
      }
    }
  } catch (e) {
    console.error("Auto-resolve existing episodes failed:", e);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerObjectStorageRoutes(app);

  app.get("/api/uploads/videos", async (req, res) => {
    if (!(req.session as any)?.isAdmin) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const pathParts = privateObjectDir.replace(/^\/+/, "").split("/");
      const bucketName = pathParts.shift();
      const privatePrefix = pathParts.join("/");

      if (!bucketName || !privatePrefix) {
        return res.status(500).json({ error: "Private object storage is not configured" });
      }

      const [files] = await objectStorageClient
        .bucket(bucketName)
        .getFiles({ prefix: `${privatePrefix}/uploads/` });

      const videos = await Promise.all(
        files.map(async (file) => {
          const [metadata] = await file.getMetadata();
          const contentType = metadata.contentType || "application/octet-stream";
          if (!contentType.startsWith("video/")) return null;

          const entityId = file.name.startsWith(`${privatePrefix}/`)
            ? file.name.slice(privatePrefix.length + 1)
            : "";
          if (!entityId) return null;

          return {
            objectPath: `/objects/${entityId}`,
            contentType,
            size: Number(metadata.size || 0),
            createdAt: metadata.timeCreated || null,
          };
        }),
      );

      res.json(
        videos
          .filter((video): video is NonNullable<typeof video> => Boolean(video))
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      );
    } catch (error) {
      console.error("Error listing recovered video uploads:", error);
      res.status(500).json({ error: "Failed to list recovered video uploads" });
    }
  });

  setTimeout(() => autoResolveExistingEpisodes(), 5000);

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@seriesplus.net";

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
    const resolvedLink = await autoResolveVideoLink(parsed.data.videoLink, true);
    const existing = await storage.getEpisodesByContentId(parsed.data.contentId);
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.epOrder)) : -1;
    const ep = await storage.createEpisode({ ...parsed.data, videoLink: resolvedLink, epOrder: maxOrder + 1 });
    const parent = await storage.getContentById(ep.contentId);
    if (parent) {
      sendPushToAll(
        "Series Myanmar",
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
    const parsed = lines
      .filter((line: string) => line.includes(","))
      .map((line: string) => {
        const [title, ...linkParts] = line.split(",");
        return {
          contentId: Number(contentId),
          epTitle: title.trim(),
          videoLink: linkParts.join(",").trim(),
        };
      });

    const toInsert = await Promise.all(
      parsed.map(async (item) => ({
        ...item,
        videoLink: await autoResolveVideoLink(item.videoLink, true),
      }))
    );

    const inserted = await storage.createEpisodesBulk(toInsert);
    const parent = await storage.getContentById(Number(contentId));
    if (parent && inserted.length > 0) {
      sendPushToAll(
        "Series Myanmar",
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
    const { isLocked, password, epTitle, videoLink, srtLink, contentId } = req.body;
    const updateData: any = {};
    if (typeof isLocked === "boolean") updateData.isLocked = isLocked;
    if (typeof password === "string") updateData.password = password || null;
    if (typeof epTitle === "string" && epTitle.trim()) updateData.epTitle = epTitle.trim();
    if (typeof videoLink === "string" && videoLink.trim()) updateData.videoLink = await autoResolveVideoLink(videoLink.trim(), true);
    if (typeof srtLink === "string") updateData.srtLink = srtLink.trim() || null;
    if (typeof contentId === "number") updateData.contentId = contentId;
    const ep = await storage.updateEpisode(epId, updateData);
    res.json({ ...ep, password: undefined });
  });

  app.post("/api/episodes/reorder", async (req, res) => {
    if (!(req.session as any)?.isAdmin) return res.status(401).json({ error: "Not authenticated" });
    const { orderedIds, contentId } = req.body;
    if (!Array.isArray(orderedIds) || !contentId) return res.status(400).json({ error: "orderedIds and contentId required" });
    const eps = await storage.getEpisodesByContentId(Number(contentId));
    const validIds = new Set(eps.map((e) => e.epId));
    const allValid = orderedIds.every((id: number) => validIds.has(id));
    if (!allValid) return res.status(400).json({ error: "Invalid episode IDs" });
    for (let i = 0; i < orderedIds.length; i++) {
      await storage.updateEpisode(orderedIds[i], { epOrder: i });
    }
    res.json({ ok: true });
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

    let resolvedLink = episode.videoLink;
    try {
      resolvedLink = await autoResolveVideoLink(episode.videoLink, true);
    } catch {}

    const epData = { ...episode, videoLink: resolvedLink };

    res.json({
      episode: isLocked && !sessionUnlocked
        ? { ...epData, isLocked: true, password: undefined }
        : { ...epData, isLocked: false, password: undefined },
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

    let resolvedLink = result.episode.videoLink;
    try {
      resolvedLink = await autoResolveVideoLink(result.episode.videoLink, true);
    } catch {}
    const epData = { ...result.episode, videoLink: resolvedLink };

    res.json({
      episode: isLocked && !sessionUnlocked
        ? { ...epData, isLocked: true, password: undefined }
        : { ...epData, isLocked: false, password: undefined },
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

  app.get("/api/drive-download/:fileId", async (req, res) => {
    const { fileId } = req.params;
    if (!fileId) return res.status(400).json({ error: "Missing fileId" });
    try {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
      const response = await fetch(downloadUrl, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch from Drive" });
      const contentType = response.headers.get("content-type") || "video/mp4";
      const contentLength = response.headers.get("content-length");
      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.setHeader("Content-Disposition", `attachment; filename="${fileId}.mp4"`);
      const reader = response.body?.getReader();
      if (!reader) return res.status(502).json({ error: "No body" });
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } catch {
      res.status(500).json({ error: "Download failed" });
    }
  });

  app.get("/api/jumpshare-resolve", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });
    try {
      const videoUrl = await resolveJumpShareUrl(url);
      if (videoUrl) {
        return res.json({ videoUrl });
      }
      return res.status(404).json({ error: "Video URL not found in embed page" });
    } catch {
      res.status(500).json({ error: "Resolve failed" });
    }
  });

  app.get("/api/video-stream", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });
    try {
      const rangeHeader = req.headers.range;
      const fetchHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };
      if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

      const response = await fetch(url, {
        redirect: "follow",
        headers: fetchHeaders,
      });
      if (!response.ok && response.status !== 206) return res.status(502).json({ error: "Failed to fetch video" });
      const contentType = response.headers.get("content-type") || "video/mp4";
      if (contentType.includes("text/html")) {
        return res.status(415).json({ error: "Not a video file" });
      }
      const contentLength = response.headers.get("content-length");
      const contentRange = response.headers.get("content-range");
      res.status(response.status === 206 ? 206 : 200);
      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      if (contentRange) res.setHeader("Content-Range", contentRange);
      res.setHeader("Accept-Ranges", "bytes");
      const reader = response.body?.getReader();
      if (!reader) return res.status(502).json({ error: "No body" });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch {
      res.status(500).json({ error: "Stream failed" });
    }
  });

  app.get("/api/video-check", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const contentType = response.headers.get("content-type") || "";
      const isVideo = contentType.startsWith("video/") || contentType.includes("octet-stream");
      const contentLength = response.headers.get("content-length");
      res.json({ isVideo, contentType, contentLength });
    } catch {
      res.json({ isVideo: false, contentType: "", contentLength: null });
    }
  });

  app.get("/api/video-proxy", async (req, res) => {
    const url = req.query.url as string;
    const filename = (req.query.filename as string) || "video.mp4";
    if (!url) return res.status(400).json({ error: "Missing url" });
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch video" });
      const contentType = response.headers.get("content-type") || "video/mp4";
      const contentLength = response.headers.get("content-length");
      res.setHeader("Content-Type", contentType);
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const reader = response.body?.getReader();
      if (!reader) return res.status(502).json({ error: "No body" });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch {
      res.status(500).json({ error: "Video download failed" });
    }
  });

  app.get("/api/srt-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "Missing url" });
    try {
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: "Failed to fetch SRT" });
      const text = await response.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(text);
    } catch {
      res.status(500).json({ error: "SRT fetch failed" });
    }
  });

  app.get("/sitemap.xml", async (_req, res) => {
    const allContent = await storage.getAllContent();
    const baseUrl = "https://seriesplus.net";
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
  <meta property="og:site_name" content="Series Myanmar" />
  ${img ? `<meta property="og:image" content="${img}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  ${img ? `<meta name="twitter:image" content="${img}" />` : ""}
</head>
<body></body>
</html>`;
  }

  app.get("/api/episode-by-number/:contentId/:epNum", async (req, res) => {
    const contentId = parseInt(req.params.contentId);
    const epNum = parseInt(req.params.epNum);
    if (isNaN(contentId) || isNaN(epNum) || epNum < 1) return res.status(400).json({ error: "Invalid parameters" });

    const allEpisodes = await storage.getEpisodesByContentId(contentId);
    if (epNum > allEpisodes.length) return res.status(404).json({ error: "Episode not found" });

    const episode = allEpisodes[epNum - 1];
    if (!episode) return res.status(404).json({ error: "Episode not found" });

    res.json({ epId: episode.epId });
  });

  app.get("/s/:contentId/:epNum", async (req, res, next) => {
    if (!isSocialBot(req.headers["user-agent"] || "")) return next();
    const contentId = parseInt(req.params.contentId);
    const epNum = parseInt(req.params.epNum);
    if (isNaN(contentId) || isNaN(epNum)) return next();
    try {
      const parent = await storage.getContentById(contentId);
      if (!parent) return next();
      const allEpisodes = await storage.getEpisodesByContentId(contentId);
      const episode = allEpisodes[epNum - 1];
      if (!episode) return next();
      const title = `${parent.title} - ${episode.epTitle} | Series Myanmar`;
      const desc = `${parent.title} - ${episode.epTitle} ကို Series Myanmar မှာ ကြည့်ရှုပါ`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const image = parent.poster?.startsWith("http") ? parent.poster : (parent.poster ? `${baseUrl}${parent.poster}` : "");
      res.send(renderOgHtml(title, desc, `${baseUrl}/s/${contentId}/${epNum}`, "video.episode", image));
    } catch { next(); }
  });

  app.get("/e/:epId", async (req, res, next) => {
    if (!isSocialBot(req.headers["user-agent"] || "")) return next();
    const epId = parseInt(req.params.epId);
    if (isNaN(epId)) return next();
    try {
      const episode = await storage.getEpisodeById(epId);
      if (!episode) return next();
      const parent = await storage.getContentById(episode.contentId);
      if (!parent) return next();
      const title = `${parent.title} - ${episode.epTitle} | Series Myanmar`;
      const desc = `${parent.title} - ${episode.epTitle} ကို Series Myanmar မှာ ကြည့်ရှုပါ`;
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
      const title = `${parent.title} - ${episode.epTitle} | Series Myanmar`;
      const desc = `${parent.title} - ${episode.epTitle} ကို Series Myanmar မှာ ကြည့်ရှုပါ`;
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
      const title = `${item.title} | Series Myanmar`;
      const desc = item.description || `${item.title} ကို Series Myanmar မှာ ကြည့်ရှုပါ`;
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
