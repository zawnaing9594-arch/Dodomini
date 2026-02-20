import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Trash2, Play, Wifi, WifiOff, Download, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllDownloads, removeDownload, type DownloadedVideo } from "@/lib/downloadDB";
import { useAuth } from "@/hooks/use-auth";

export default function Downloads() {
  const [downloads, setDownloads] = useState<DownloadedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingEpId, setPlayingEpId] = useState<number | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<number, string>>({});
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const loadDownloads = useCallback(async () => {
    try {
      const items = await getAllDownloads();
      setDownloads(items);
      const urls: Record<number, string> = {};
      for (const item of items) {
        if (item.blob) {
          urls[item.epId] = URL.createObjectURL(item.blob);
        }
      }
      setBlobUrls(urls);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDownloads();
    return () => {
      Object.values(blobUrls).forEach(URL.revokeObjectURL);
    };
  }, []);

  const handleRemove = async (epId: number) => {
    await removeDownload(epId);
    if (blobUrls[epId]) URL.revokeObjectURL(blobUrls[epId]);
    setBlobUrls((prev) => {
      const next = { ...prev };
      delete next[epId];
      return next;
    });
    setDownloads((prev) => prev.filter((d) => d.epId !== epId));
    if (playingEpId === epId) setPlayingEpId(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "Bookmark";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("my-MM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="p-8 max-w-sm w-full text-center">
          <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Login Required</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Download များကြည့်ရန် Login ဝင်ပါ
          </p>
          <a href="/api/login">
            <Button className="w-full" data-testid="button-login-downloads">Login</Button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-downloads">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 md:px-8 py-3">
          <Link href="/">
            <Button size="icon" variant="ghost" data-testid="button-back-home">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-sm font-medium" data-testid="text-my-downloads">My Downloads</h1>
          <Badge variant="secondary" className="text-xs">{downloads.length}</Badge>
        </div>
      </div>

      {playingEpId && blobUrls[playingEpId] && (
        <div className="w-full aspect-video max-h-[70vh] bg-black">
          <video
            src={blobUrls[playingEpId]}
            controls
            autoPlay
            className="w-full h-full"
            data-testid="video-offline-player"
          />
        </div>
      )}

      <div className="px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Download className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No downloads yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Episode တွေကို download လုပ်ပြီး offline ကြည့်ပါ
            </p>
            <Link href="/">
              <Button variant="outline" className="mt-4" data-testid="button-browse">
                Browse Content
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {downloads.map((item) => (
              <Card
                key={item.epId}
                className={`p-0 overflow-hidden ${playingEpId === item.epId ? "border-primary" : ""}`}
                data-testid={`card-download-${item.epId}`}
              >
                <div className="flex items-stretch">
                  <div className="w-20 sm:w-24 shrink-0 bg-muted">
                    <img
                      src={item.poster}
                      alt={item.epTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-dl-title-${item.epId}`}>
                      {item.epTitle}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.contentTitle}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.isBookmark ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Bookmark className="w-2.5 h-2.5" /> Bookmark
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <WifiOff className="w-2.5 h-2.5" /> Offline
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatSize(item.size)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(item.downloadedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 px-2">
                    {item.isBookmark ? (
                      <Link href={`/e/${item.epId}`}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-play-online-${item.epId}`}>
                          <Wifi className="w-4 h-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setPlayingEpId(playingEpId === item.epId ? null : item.epId)}
                        data-testid={`button-play-offline-${item.epId}`}
                      >
                        <Play className={`w-4 h-4 ${playingEpId === item.epId ? "text-primary fill-primary" : ""}`} />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemove(item.epId)}
                      data-testid={`button-remove-dl-${item.epId}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
