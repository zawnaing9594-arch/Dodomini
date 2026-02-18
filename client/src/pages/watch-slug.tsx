import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ArrowLeft, Lock, Play, ChevronLeft, ChevronRight, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { toSlug, getShareUrl } from "@/lib/slugs";

function ShareButton({ seriesTitle, epTitle }: { seriesTitle: string; epTitle: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${getShareUrl(seriesTitle, epTitle)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${seriesTitle} - ${epTitle}`, url });
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
  }, [seriesTitle, epTitle, toast]);

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

function VideoPlayer({ embedUrl, videoLink }: { embedUrl: string; videoLink: string }) {
  const isDirectLink = !embedUrl.includes("vimeo.com") && !embedUrl.includes("drive.google.com");

  if (isDirectLink && (videoLink.endsWith(".mp4") || videoLink.endsWith(".webm") || videoLink.endsWith(".m3u8"))) {
    return (
      <video
        src={videoLink}
        controls
        className="w-full h-full bg-black"
        data-testid="video-player"
      />
    );
  }

  return (
    <iframe
      src={embedUrl}
      className="w-full h-full"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      data-testid="video-iframe"
    />
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

  return rawLink;
}

export default function WatchSlug() {
  const { seriesSlug, epSlug } = useParams<{ seriesSlug: string; epSlug: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  const { data: episodeData, isLoading: loadingEp } = useQuery<{
    episode: Episode;
    parent: Content;
    allEpisodes: Episode[];
  }>({
    queryKey: ["/api/resolve", seriesSlug, epSlug],
  });

  const epId = episodeData?.episode?.epId;

  const unlockMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await apiRequest("POST", `/api/watch/${epId}/unlock`, { password: pwd });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resolve", seriesSlug, epSlug] });
    },
    onError: (err: Error) => {
      toast({ title: "Wrong password", description: err.message, variant: "destructive" });
    },
  });

  const currentEpIndex = useMemo(() => {
    if (!episodeData?.allEpisodes || !epId) return -1;
    return episodeData.allEpisodes.findIndex((e) => e.epId === epId);
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

  const navigateToEp = (ep: Episode) => {
    setLocation(getShareUrl(parent.title, ep.epTitle));
  };

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
            <ShareButton seriesTitle={parent.title} epTitle={episode.epTitle} />
            {prevEp && (
              <Button size="icon" variant="ghost" onClick={() => navigateToEp(prevEp)} data-testid="button-prev-ep">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            {nextEp && (
              <Button size="icon" variant="ghost" onClick={() => navigateToEp(nextEp)} data-testid="button-next-ep">
                <ChevronRight className="w-5 h-5" />
              </Button>
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
          <div className="w-full aspect-video max-h-[70vh] bg-black">
            <VideoPlayer embedUrl={embedUrl} videoLink={episode.videoLink} />
          </div>

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
                  <Card
                    key={ep.epId}
                    onClick={() => navigateToEp(ep)}
                    className={`p-3 hover-elevate cursor-pointer flex items-center gap-2 ${
                      ep.epId === episode.epId ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid={`card-ep-${ep.epId}`}
                  >
                    {ep.isLocked ? (
                      <Lock className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                    ) : (
                      <Play
                        className={`w-3.5 h-3.5 shrink-0 ${
                          ep.epId === episode.epId
                            ? "text-primary fill-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    )}
                    <span className="text-sm truncate">{ep.epTitle}</span>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
