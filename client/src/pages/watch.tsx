import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ArrowLeft, Lock, Play, ChevronLeft, ChevronRight, Share2, Check, Maximize, Minimize, Download, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getShareUrl } from "@/lib/slugs";

function ShareButton({ epId, title, seriesTitle, epTitle }: { epId: number; title: string; seriesTitle: string; epTitle: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${getShareUrl(epId, seriesTitle, epTitle)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  }, [epId, title, seriesTitle, epTitle, toast]);

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleShare}
      data-testid="button-share"
    >
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
    </Button>
  );
}

function VideoPlayer({ embedUrl, videoLink, srtLink }: { embedUrl: string; videoLink: string; srtLink?: string | null }) {
  const isDirectVideo = /\.(mp4|webm|m3u8|mov|avi|mkv)(\?.*)?$/i.test(videoLink);
  const [iframeError, setIframeError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [srtCues, setSrtCues] = useState<import("@/lib/srtParser").SrtCue[]>([]);
  const [currentSub, setCurrentSub] = useState("");
  const [subsOn, setSubsOn] = useState(true);
  const [srtLoaded, setSrtLoaded] = useState(false);

  useEffect(() => {
    if (!srtLink) return;
    import("@/lib/srtParser").then(({ fetchSrt }) => {
      fetchSrt(srtLink).then((cues) => {
        setSrtCues(cues);
        setSrtLoaded(true);
      }).catch(() => setSrtLoaded(false));
    });
  }, [srtLink]);

  useEffect(() => {
    if (!srtCues.length || !videoRef.current) return;
    const video = videoRef.current;
    const onTimeUpdate = () => {
      const t = video.currentTime;
      const cue = srtCues.find((c) => t >= c.startTime && t <= c.endTime);
      setCurrentSub(cue ? cue.text : "");
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [srtCues]);

  if (isDirectVideo) {
    return (
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={videoLink}
          controls
          crossOrigin="anonymous"
          className="w-full h-full bg-black"
          data-testid="video-player"
        />
        {srtLoaded && (
          <button
            onClick={() => setSubsOn(!subsOn)}
            className={`absolute top-3 right-3 z-20 px-2 py-1 rounded text-xs font-bold transition-colors ${
              subsOn ? "bg-primary text-white" : "bg-black/60 text-white/60"
            }`}
            data-testid="button-subtitle-toggle"
          >
            CC
          </button>
        )}
        {subsOn && currentSub && (
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 max-w-[90%] text-center pointer-events-none"
            data-testid="subtitle-display"
          >
            <span className="bg-black/80 text-white px-3 py-1.5 rounded text-sm md:text-base leading-relaxed inline-block whitespace-pre-wrap">
              {currentSub}
            </span>
          </div>
        )}
      </div>
    );
  }

  const isFacebook = videoLink.includes("facebook.com") || videoLink.includes("fb.watch") || videoLink.includes("fb.com");
  const isGoogleDrive = embedUrl.includes("drive.google.com");

  if (isFacebook) {
    return (
      <div className="relative w-full h-full">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          data-testid="video-iframe"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        onError={() => setIframeError(true)}
        data-testid="video-iframe"
      />
      {iframeError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center p-6">
          <div>
            <p className="text-lg font-medium mb-2">Video cannot be played</p>
            <p className="text-sm text-muted-foreground">
              {isGoogleDrive
                ? "Google Drive video must be shared publicly (Anyone with the link)."
                : "This video source may not support embedding."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadButton({ videoLink, epId, epTitle, contentTitle, poster }: { videoLink: string; epId: number; epTitle: string; contentTitle: string; poster: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState(false);
  const isDirectVideo = /\.(mp4|webm|m3u8|mov|avi|mkv)(\?.*)?$/i.test(videoLink);
  const isGoogleDrive = videoLink.includes("drive.google.com");

  const getDriveFileId = (url: string): string | null => {
    if (url.includes("/file/d/")) return url.split("/file/d/")[1].split("/")[0];
    if (url.includes("id=")) return url.split("id=")[1].split("&")[0];
    return null;
  };

  const canDownload = isDirectVideo || isGoogleDrive;

  useEffect(() => {
    import("@/lib/downloadDB").then(({ isDownloaded }) => {
      isDownloaded(epId).then(setAlreadyDownloaded);
    });
  }, [epId]);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <a href="/api/login">
        <Button size="icon" variant="ghost" data-testid="button-login-download" title="Login to download">
          <LogIn className="w-4 h-4" />
        </Button>
      </a>
    );
  }

  const handleDownload = async () => {
    if (downloading) return;

    if (!canDownload) {
      window.open(videoLink, "_blank", "noopener,noreferrer");
      toast({ title: "Video link ဖွင့်ပေးပါပြီ", description: "ဖွင့်ထားတဲ့ page ကနေ video ကို save လုပ်ပါ" });
      return;
    }

    setDownloading(true);
    setProgress(0);
    try {
      const { saveDownload, downloadVideoWithProgress } = await import("@/lib/downloadDB");
      let downloadUrl = videoLink;
      if (isGoogleDrive) {
        const fileId = getDriveFileId(videoLink);
        if (fileId) downloadUrl = `/api/drive-download/${fileId}`;
      }
      const blob = await downloadVideoWithProgress(downloadUrl, (p) => setProgress(p));
      await saveDownload({
        epId, epTitle, contentTitle, poster, videoLink,
        blob, downloadedAt: Date.now(), size: blob.size, isBookmark: false,
      });
      toast({ title: "Download ပြီးပါပြီ", description: `${epTitle} ကို My Downloads မှာ offline ကြည့်နိုင်ပါပြီ` });
      setAlreadyDownloaded(true);
    } catch {
      toast({ title: "Download မအောင်မြင်ပါ", variant: "destructive" });
    }
    setDownloading(false);
  };

  if (alreadyDownloaded) {
    return (
      <Button size="icon" variant="ghost" data-testid="button-downloaded" title="Downloaded" className="text-green-400">
        <Check className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button size="icon" variant="ghost" data-testid="button-download" title="Download" onClick={handleDownload} disabled={downloading}>
        <Download className={`w-4 h-4 ${downloading ? "animate-pulse" : ""}`} />
      </Button>
      {downloading && progress > 0 && progress < 100 && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-primary font-bold">{progress}%</span>
      )}
    </div>
  );
}

function VideoContainer({ embedUrl, videoLink, srtLink }: { embedUrl: string; videoLink: string; srtLink?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && containerRef.current) {
        containerRef.current.style.filter = "brightness(0)";
      } else if (containerRef.current) {
        containerRef.current.style.filter = "";
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        setIsRecording(true);
        setTimeout(() => setIsRecording(false), 3000);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black group video-protected ${isFullscreen ? "h-screen" : "aspect-video max-h-[70vh]"}`}
      data-testid="video-container"
      onContextMenu={(e) => e.preventDefault()}
    >
      {isRecording && (
        <div
          className="absolute inset-0 z-50 bg-black flex items-center justify-center"
          data-testid="recording-overlay"
        >
          <p className="text-white/60 text-sm">Screen recording is not allowed</p>
        </div>
      )}
      <VideoPlayer embedUrl={embedUrl} videoLink={videoLink} srtLink={srtLink} />
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ visibility: "visible" }}
        data-testid="button-fullscreen"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>
    </div>
  );
}

function getEmbedUrl(rawLink: string): string {
  if (rawLink.includes("vimeo.com") || /^\d+$/.test(rawLink)) {
    const vid = rawLink.split("/").pop();
    return `https://player.vimeo.com/video/${vid}`;
  }

  if (rawLink.includes("drive.google.com")) {
    let driveId = "";
    if (rawLink.includes("/file/d/")) {
      driveId = rawLink.split("/file/d/")[1].split("/")[0];
    } else if (rawLink.includes("id=")) {
      driveId = rawLink.split("id=")[1].split("&")[0];
    }
    if (driveId) {
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
  }

  if (rawLink.includes("youtube.com") || rawLink.includes("youtu.be")) {
    let videoId = "";
    if (rawLink.includes("youtu.be/")) {
      videoId = rawLink.split("youtu.be/")[1].split("?")[0];
    } else if (rawLink.includes("v=")) {
      videoId = rawLink.split("v=")[1].split("&")[0];
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  if (rawLink.includes("t.me/") || rawLink.includes("telegram.me/")) {
    const cleaned = rawLink.replace(/^https?:\/\//, "");
    const parts = cleaned.replace(/^(t\.me|telegram\.me)\//, "").split("/");
    if (parts.length >= 2) {
      const channel = parts[0];
      const msgId = parts[1].split("?")[0];
      return `https://t.me/${channel}/${msgId}?embed=1&mode=video`;
    }
  }

  if (rawLink.includes("facebook.com") || rawLink.includes("fb.watch") || rawLink.includes("fb.com")) {
    const encodedUrl = encodeURIComponent(rawLink);
    return `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false`;
  }

  if (rawLink.includes("dailymotion.com") || rawLink.includes("dai.ly")) {
    let dmId = "";
    if (rawLink.includes("dai.ly/")) {
      dmId = rawLink.split("dai.ly/")[1].split("?")[0];
    } else if (rawLink.includes("/video/")) {
      dmId = rawLink.split("/video/")[1].split("?")[0].split("_")[0];
    }
    if (dmId) {
      return `https://www.dailymotion.com/embed/video/${dmId}`;
    }
  }

  return rawLink;
}

export default function Watch() {
  const { epId } = useParams<{ epId: string }>();
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  const { data: episodeData, isLoading: loadingEp } = useQuery<{
    episode: Episode;
    parent: Content;
    allEpisodes: Episode[];
  }>({
    queryKey: ["/api/watch", epId],
  });

  const unlockMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await apiRequest("POST", `/api/watch/${epId}/unlock`, { password: pwd });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch", epId] });
    },
    onError: (err: Error) => {
      toast({ title: "Wrong password", description: err.message, variant: "destructive" });
    },
  });

  const currentEpIndex = useMemo(() => {
    if (!episodeData?.allEpisodes) return -1;
    return episodeData.allEpisodes.findIndex((e) => e.epId === Number(epId));
  }, [episodeData, epId]);

  const prevEp = episodeData?.allEpisodes?.[currentEpIndex - 1];
  const nextEp = episodeData?.allEpisodes?.[currentEpIndex + 1];

  if (loadingEp) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full aspect-video max-h-[70vh]" />
        <div className="px-4 md:px-8 py-6">
          <Skeleton className="h-8 w-48 mb-3" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    );
  }

  if (!episodeData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Play className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground">Episode not found</h2>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { episode, parent, allEpisodes } = episodeData;
  const isLocked = episode.isLocked;
  const embedUrl = getEmbedUrl(episode.videoLink);

  return (
    <div className="min-h-screen bg-background" data-testid="page-watch">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 md:px-8 py-3">
          <Link href={`/series/${parent.id}`}>
            <Button size="icon" variant="ghost" data-testid="button-back-to-series">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate" data-testid="text-episode-title">
              {episode.epTitle}
            </h1>
            <p className="text-xs text-muted-foreground truncate">{parent.title}</p>
          </div>
          <div className="flex items-center gap-1">
            <DownloadButton videoLink={episode.videoLink} epId={episode.epId} epTitle={episode.epTitle} contentTitle={parent.title} poster={parent.poster} />
            <ShareButton epId={episode.epId} title={`${parent.title} - ${episode.epTitle}`} seriesTitle={parent.title} epTitle={episode.epTitle} />
            {prevEp && (
              <Link href={getShareUrl(prevEp.epId, parent.title, prevEp.epTitle)}>
                <Button size="icon" variant="ghost" data-testid="button-prev-ep">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </Link>
            )}
            {nextEp && (
              <Link href={getShareUrl(nextEp.epId, parent.title, nextEp.epTitle)}>
                <Button size="icon" variant="ghost" data-testid="button-next-ep">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="flex items-center justify-center py-20 px-4">
          <Card className="p-8 max-w-sm w-full text-center">
            <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Locked Episode</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Enter the password to unlock this episode
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                unlockMutation.mutate(password);
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                data-testid="input-password"
              />
              <Button
                type="submit"
                className="w-full"
                disabled={unlockMutation.isPending || !password}
                data-testid="button-unlock"
              >
                {unlockMutation.isPending ? "Checking..." : "Unlock"}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <>
          <VideoContainer embedUrl={embedUrl} videoLink={episode.videoLink} srtLink={episode.srtLink} />

          <div className="px-4 md:px-8 py-6">
            <h2 className="text-xl font-semibold mb-1" data-testid="text-now-playing">
              {episode.epTitle}
            </h2>
            <Link href={`/series/${parent.id}`}>
              <p className="text-sm text-primary cursor-pointer" data-testid="link-parent-title">
                {parent.title}
              </p>
            </Link>
          </div>

          {allEpisodes.length > 1 && (
            <div className="px-4 md:px-8 pb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">All Episodes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {allEpisodes.map((ep) => (
                  <Link key={ep.epId} href={getShareUrl(ep.epId, parent.title, ep.epTitle)}>
                    <Card
                      className={`p-3 hover-elevate cursor-pointer flex items-center gap-2 ${
                        ep.epId === Number(epId) ? "border-primary bg-primary/5" : ""
                      }`}
                      data-testid={`card-ep-${ep.epId}`}
                    >
                      {ep.isLocked ? (
                        <Lock className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                      ) : (
                        <Play
                          className={`w-3.5 h-3.5 shrink-0 ${
                            ep.epId === Number(epId)
                              ? "text-primary fill-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      )}
                      <span className="text-sm truncate">{ep.epTitle}</span>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
