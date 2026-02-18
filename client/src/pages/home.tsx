import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ChevronLeft, ChevronRight, Play, Film, Bell, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

function BannerCarousel({ banners }: { banners: Content[] }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % banners.length);
  }, [banners.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[current];

  return (
    <div className="relative w-full h-[280px] md:h-[400px] overflow-hidden" data-testid="banner-carousel">
      {banners.map((b, i) => (
        <div
          key={b.id}
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img
            src={b.poster}
            alt={b.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-10">
        <div className="max-w-2xl">
          <h1
            className="text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg"
            data-testid="banner-title"
          >
            {banner.title}
          </h1>
          {banner.description && (
            <p className="text-sm md:text-base text-white/80 mb-5 line-clamp-2 max-w-lg">
              {banner.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Link href={`/series/${banner.id}`}>
              <Button variant="default" data-testid="button-watch-now">
                <Play className="w-4 h-4 mr-2 fill-current" />
                Watch Now
              </Button>
            </Link>
            <Link href={`/series/${banner.id}`}>
              <Button variant="outline" className="bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="button-details">
                Details
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 transition-colors"
            style={{ visibility: "visible" }}
            data-testid="button-banner-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 transition-colors"
            style={{ visibility: "visible" }}
            data-testid="button-banner-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? "bg-primary w-6" : "bg-white/40"
                }`}
                data-testid={`button-banner-dot-${i}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationBell() {
  const [showPanel, setShowPanel] = useState(false);
  const [lastSeenId, setLastSeenId] = useState(() => {
    return parseInt(localStorage.getItem("lastSeenEpId") || "0");
  });

  const { data: latestEps } = useQuery<Array<{ episode: Episode; contentTitle: string }>>({
    queryKey: ["/api/latest-episodes"],
    refetchInterval: 30000,
  });

  const newCount = useMemo(() => {
    if (!latestEps) return 0;
    return latestEps.filter((e) => e.episode.epId > lastSeenId).length;
  }, [latestEps, lastSeenId]);

  useEffect(() => {
    if (!latestEps || latestEps.length === 0) return;
    const maxId = Math.max(...latestEps.map((e) => e.episode.epId));
    if (lastSeenId === 0) {
      localStorage.setItem("lastSeenEpId", String(maxId));
      setLastSeenId(maxId);
      return;
    }
    if (newCount > 0 && "Notification" in window && Notification.permission === "granted") {
      const newest = latestEps[0];
      new Notification("Series Plus Myanmar", {
        body: `${newest.contentTitle} - ${newest.episode.epTitle}`,
        icon: "/icon-192.png",
      });
    }
  }, [latestEps]);

  const markAllSeen = () => {
    if (latestEps && latestEps.length > 0) {
      const maxId = Math.max(...latestEps.map((e) => e.episode.epId));
      localStorage.setItem("lastSeenEpId", String(maxId));
      setLastSeenId(maxId);
    }
    setShowPanel(false);
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="relative text-white/80"
        onClick={() => {
          setShowPanel(!showPanel);
          requestNotificationPermission();
        }}
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5" />
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center" data-testid="badge-new-count">
            {newCount > 9 ? "9+" : newCount}
          </span>
        )}
      </Button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 z-50">
          <Card className="p-0 overflow-hidden shadow-xl">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">New Episodes</span>
              <div className="flex items-center gap-1">
                {newCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={markAllSeen} className="text-xs h-7" data-testid="button-mark-seen">
                    Mark all read
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowPanel(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {!latestEps || latestEps.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No episodes yet</p>
              ) : (
                latestEps.slice(0, 10).map((item) => {
                  const isNew = item.episode.epId > lastSeenId;
                  return (
                    <Link key={item.episode.epId} href={`/e/${item.episode.epId}`}>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 hover-elevate cursor-pointer ${isNew ? "bg-primary/5" : ""}`}
                        data-testid={`notification-ep-${item.episode.epId}`}
                      >
                        <Play className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.episode.epTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.contentTitle}</p>
                        </div>
                        {isNew && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">NEW</Badge>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ContentCard({ item, isNew }: { item: Content; isNew?: boolean }) {
  return (
    <Link href={`/series/${item.id}`}>
      <div className="group relative cursor-pointer" data-testid={`card-content-${item.id}`}>
        <div className="relative overflow-hidden rounded-md aspect-[3/4]">
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
          {isNew && (
            <div className="absolute top-2 left-2">
              <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-red-500 border-0 text-white" data-testid={`badge-new-${item.id}`}>
                NEW
              </Badge>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-foreground truncate" data-testid={`text-title-${item.id}`}>
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
      </div>
    </Link>
  );
}

function ContentGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="w-full aspect-[3/4] rounded-md" />
          <Skeleton className="h-4 w-3/4 mt-2" />
          <Skeleton className="h-3 w-1/2 mt-1" />
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { data: allContent, isLoading } = useQuery<Content[]>({
    queryKey: ["/api/content"],
  });

  const { data: bannerContent } = useQuery<Content[]>({
    queryKey: ["/api/banners"],
  });

  const { data: latestEps } = useQuery<Array<{ episode: Episode & { contentId: number }; contentTitle: string }>>({
    queryKey: ["/api/latest-episodes"],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const banners = bannerContent && bannerContent.length > 0 ? bannerContent : (allContent?.slice(0, 5) || []);

  const newContentIds = useMemo(() => {
    if (!latestEps || !allContent) return new Set<number>();
    const lastSeen = parseInt(localStorage.getItem("lastSeenEpId") || "0");
    const idsWithNewEps = new Set<number>();
    for (const item of latestEps) {
      if (item.episode.epId > lastSeen) {
        idsWithNewEps.add(item.episode.contentId);
      }
    }
    const maxId = Math.max(...allContent.map((c) => c.id));
    const threshold = Math.max(0, maxId - 2);
    for (const c of allContent) {
      if (c.id > threshold) idsWithNewEps.add(c.id);
    }
    return idsWithNewEps;
  }, [latestEps, allContent]);

  const filteredContent = useMemo(() => {
    if (!allContent) return { series: [], movies: [] };
    const q = searchQuery.toLowerCase().trim();
    const filtered = q ? allContent.filter((c) => c.title.toLowerCase().includes(q)) : allContent;
    return {
      series: filtered.filter((c) => c.type === "series"),
      movies: filtered.filter((c) => c.type === "movie"),
    };
  }, [allContent, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/90 to-transparent">
        <div className="flex items-center justify-between gap-4 px-4 md:px-8 lg:px-12 py-4">
          <Link href="/">
            <h1 className="text-xl font-bold tracking-tight text-white cursor-pointer" data-testid="text-logo">
              Series<span className="text-primary">Plus</span>
            </h1>
          </Link>
          <div className="flex items-center gap-1">
            {searchOpen ? (
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-md border border-white/10 px-2">
                <Search className="w-4 h-4 text-white/60 shrink-0" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 h-9 w-36 sm:w-48"
                  data-testid="input-search"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/60 h-7 w-7"
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  data-testid="button-search-close"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="text-white/80"
                onClick={() => setSearchOpen(true)}
                data-testid="button-search-open"
              >
                <Search className="w-5 h-5" />
              </Button>
            )}
            <NotificationBell />
          </div>
        </div>
      </header>

      {!isSearching && (
        <>
          {isLoading ? (
            <Skeleton className="w-full h-[280px] md:h-[400px]" />
          ) : (
            <BannerCarousel banners={banners} />
          )}
        </>
      )}

      {isSearching && <div className="h-20" />}

      <div className="px-4 md:px-8 lg:px-12 py-8 space-y-10">
        {isSearching && filteredContent.series.length === 0 && filteredContent.movies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No results for "{searchQuery}"</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>
          </div>
        )}

        {filteredContent.series.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold" data-testid="text-section-series">Series</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {filteredContent.series.map((item) => (
                <ContentCard key={item.id} item={item} isNew={newContentIds.has(item.id)} />
              ))}
            </div>
          </section>
        )}

        {filteredContent.movies.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold" data-testid="text-section-movies">Movies</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {filteredContent.movies.map((item) => (
                <ContentCard key={item.id} item={item} isNew={newContentIds.has(item.id)} />
              ))}
            </div>
          </section>
        )}

        {!isSearching && !isLoading && (!allContent || allContent.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Film className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No content yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Check back soon for new movies and series</p>
          </div>
        )}

        {isLoading && (
          <section>
            <Skeleton className="h-6 w-32 mb-5" />
            <ContentGridSkeleton />
          </section>
        )}
      </div>

      <footer className="border-t border-white/5 py-6 px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground/50">Series Plus Myanmar</p>
          <div className="flex items-center gap-4">
            <Link href="/contact">
              <span className="text-xs text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors cursor-pointer" data-testid="link-contact">
                Contact Us
              </span>
            </Link>
            <Link href="/admin">
              <span className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-pointer" data-testid="link-admin">
                Admin
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
