import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ArrowLeft, Play, Lock, Tv, Clock, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useMemo } from "react";
import { getShareUrl, toSlug } from "@/lib/slugs";

function getVideoThumbnail(url: string): string | null {
  try {
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;

    const dailymotionMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
    if (dailymotionMatch) return `https://www.dailymotion.com/thumbnail/video/${dailymotionMatch[1]}`;
  } catch {}
  return null;
}

function EpisodeShareButton({ epId, title, seriesTitle, epTitle }: { epId: number; title: string; seriesTitle: string; epTitle: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    <button
      onClick={handleShare}
      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-muted-foreground"
      data-testid={`button-share-ep-${epId}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();

  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: item, isLoading: loadingContent } = useQuery<Content>({
    queryKey: ["/api/content", id],
  });

  const handleShareSeries = useCallback(async () => {
    const url = `${window.location.origin}/series/${id}`;
    const title = item?.title || "Series Myanmar";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share URL copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Unable to copy", description: url, variant: "destructive" });
    }
  }, [id, item, toast]);

  const { data: episodesData, isLoading: loadingEpisodes } = useQuery<Episode[]>({
    queryKey: ["/api/content", id, "episodes"],
  });

  const episodes = episodesData || [];
  const lockedCount = episodes.filter((ep) => ep.isLocked).length;
  const newestEpIds = useMemo(() => {
    if (episodes.length <= 1) return new Set<number>();
    const sorted = [...episodes].sort((a, b) => b.epId - a.epId);
    const recent = sorted.slice(0, Math.min(3, Math.ceil(episodes.length * 0.2)));
    return new Set(recent.map((e) => e.epId));
  }, [episodes]);

  if (loadingContent) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-[300px]" />
        <div className="px-4 md:px-8 lg:px-12 py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-20 w-full max-w-xl" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Tv className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground">Content not found</h2>
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

  return (
    <div className="min-h-screen bg-background" data-testid="page-series-detail">
      <div className="relative w-full h-[200px] md:h-[300px] overflow-hidden">
        <img
          src={item.poster}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
      </div>

      <div className="relative -mt-32 md:-mt-40 z-10 px-4 md:px-8 lg:px-12 pb-12">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="shrink-0">
            <img
              src={item.poster}
              alt={item.title}
              className="w-[180px] md:w-[220px] rounded-md shadow-2xl"
              data-testid="img-series-thumb"
            />
          </div>

          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <Badge variant="secondary" className="capitalize">{item.type}</Badge>
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                {episodes.length} Episodes
              </Badge>
              {lockedCount > 0 && (
                <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                  <Lock className="w-3 h-3 mr-1" />
                  {lockedCount} Locked
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" data-testid="text-series-title">
              {item.title}
            </h1>

            {item.description && (
              <p className="text-muted-foreground leading-relaxed max-w-2xl mb-6" data-testid="text-series-description">
                {item.description}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {episodes.length > 0 && (
                <Link href={getShareUrl(episodes[0].epId, item.title, episodes[0].epTitle)}>
                  <Button variant="default" data-testid="button-play-first">
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Play Episode 1
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={handleShareSeries} data-testid="button-share-series">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Share"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" />
            Episodes
          </h2>

          {loadingEpisodes ? (
            <div className="flex flex-col divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-4">
                  <Skeleton className="w-[140px] h-[80px] rounded-md shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <Card className="p-8 text-center">
              <Tv className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No episodes available yet</p>
            </Card>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {episodes.map((ep, index) => {
                const thumb = getVideoThumbnail(ep.videoLink) || item.poster;
                return (
                  <Link key={ep.epId} href={getShareUrl(ep.epId, item.title, ep.epTitle)} className="block">
                    <div
                      className="flex gap-4 py-4 group cursor-pointer hover-elevate rounded-md px-1 -mx-1"
                      data-testid={`card-episode-${ep.epId}`}
                    >
                      <div className="relative w-[140px] sm:w-[170px] shrink-0 aspect-video rounded-md overflow-hidden bg-muted">
                        <img
                          src={thumb}
                          alt={ep.epTitle}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                            {ep.isLocked ? (
                              <Lock className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-white fill-white" />
                            )}
                          </div>
                        </div>
                        {newestEpIds.has(ep.epId) && (
                          <div className="absolute top-1 left-1">
                            <Badge variant="default" className="text-[9px] px-1 py-0 bg-red-500 border-0 text-white">
                              NEW
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base leading-snug line-clamp-2" data-testid={`text-ep-title-${ep.epId}`}>
                          {ep.epTitle}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">E{index + 1}</span>
                          {ep.isLocked && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-400 border-yellow-400/30">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        <EpisodeShareButton epId={ep.epId} title={`${item.title} - ${ep.epTitle}`} seriesTitle={item.title} epTitle={ep.epTitle} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="fixed top-4 left-4 z-20">
        <Link href="/">
          <Button size="icon" variant="ghost" className="bg-black/40 backdrop-blur-sm text-white" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
