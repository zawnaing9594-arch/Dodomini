import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ChevronLeft, ChevronRight, Play, Film, Bell, X, Search, Type, Minus, Plus, User, LogOut, Download, BellRing } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFontFamily } from "@/hooks/use-font";
import { useAuth } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/use-push";

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
    <div className="relative w-full min-h-[560px] md:min-h-[680px] overflow-hidden" data-testid="banner-carousel">
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
           <div className="absolute inset-0 hero-vignette" />
        </div>
      ))}

       <div className="absolute bottom-14 md:bottom-20 left-0 right-0 px-5 md:px-12 lg:px-20 z-10 motion-rise">
         <p className="text-primary uppercase tracking-[.28em] text-[10px] md:text-xs font-semibold mb-4">Tonight’s feature</p>
         <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-2xl text-white leading-[.98] mb-4">{banner.title}</h2>
         {banner.description && <p className="text-sm md:text-base text-white/70 max-w-xl line-clamp-2 mb-7">{banner.description}</p>}
        <div className="flex items-center gap-3">
          <Link href={`/series/${banner.id}`}>
             <Button variant="default" className="h-11 px-5 rounded-full font-semibold" data-testid="button-watch-now">
              <Play className="w-4 h-4 mr-2 fill-current" />
              Watch Now
            </Button>
          </Link>
          <Link href={`/series/${banner.id}`}>
             <Button variant="outline" className="h-11 px-5 rounded-full bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="button-details">
              Details
            </Button>
          </Link>
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
      new Notification("Series Myanmar", {
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

  const { isSubscribed, subscribe } = usePushNotifications();

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (!isSubscribed) {
      subscribe();
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

function UserAuthButton() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <a href="/api/login">
        <Button
          size="sm"
          variant="ghost"
          className="text-white/80 gap-1.5"
          data-testid="button-login"
        >
          <User className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Login</span>
        </Button>
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
        data-testid="button-user-menu"
      >
        {user?.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <User className="w-4 h-4" />
        )}
        <span className="hidden sm:inline text-xs truncate max-w-[80px]">
          {user?.firstName || "User"}
        </span>
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full mt-2 z-50">
          <Card className="p-2 min-w-[140px] shadow-xl">
            <p className="text-xs text-muted-foreground px-2 py-1 truncate">
              {user?.email || user?.firstName || "User"}
            </p>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-md transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}

function ContentCard({ item, isNew, titleClass }: { item: Content; isNew?: boolean; titleClass?: string }) {
  return (
    <Link href={`/series/${item.id}`}>
     <div className="group relative cursor-pointer motion-rise" data-testid={`card-content-${item.id}`}>
         <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-muted poster-lift">
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl scale-90 group-hover:scale-100 transition-transform duration-300">
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
         <p className={`mt-3 ${titleClass || "text-sm"} font-semibold text-foreground truncate`} data-testid={`text-title-${item.id}`}>
          {item.title}
        </p>
         <p className="text-[11px] text-muted-foreground capitalize tracking-wide">{item.type}</p>
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

const FONT_SIZES = [
  { label: "1", banner: "text-base md:text-lg", card: "text-[10px]", section: "text-xs" },
  { label: "2", banner: "text-lg md:text-xl", card: "text-[11px]", section: "text-sm" },
  { label: "3", banner: "text-xl md:text-2xl", card: "text-xs", section: "text-base" },
  { label: "4", banner: "text-2xl md:text-3xl", card: "text-xs", section: "text-lg" },
  { label: "5", banner: "text-3xl md:text-5xl", card: "text-sm", section: "text-xl" },
  { label: "6", banner: "text-4xl md:text-6xl", card: "text-base", section: "text-2xl" },
];

function useFontSize() {
  const [sizeIndex, setSizeIndex] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("titleFontSize") : null;
      return saved ? Math.min(parseInt(saved), FONT_SIZES.length - 1) : 4;
    } catch {
      return 4;
    }
  });

  const decrease = useCallback(() => {
    setSizeIndex((prev) => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem("titleFontSize", String(next));
      return next;
    });
  }, []);

  const increase = useCallback(() => {
    setSizeIndex((prev) => {
      const next = Math.min(FONT_SIZES.length - 1, prev + 1);
      localStorage.setItem("titleFontSize", String(next));
      return next;
    });
  }, []);

  return { sizes: FONT_SIZES[sizeIndex], sizeIndex, decrease, increase };
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

  const { sizes, sizeIndex, decrease, increase } = useFontSize();
  const { fontIndex, fontLabel, fonts, setFont } = useFontFamily();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    if (!allContent || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allContent
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allContent, searchQuery]);

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
       <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/95 via-background/60 to-transparent">
         <div className="flex items-center justify-between gap-4 px-5 md:px-10 lg:px-16 py-5">
          <Link href="/">
             <h1 className="font-display text-xl font-extrabold tracking-tight text-white cursor-pointer" data-testid="text-logo">
               Series<span className="text-primary">Plus</span><span className="text-white/40 text-[10px] ml-2 tracking-[.24em] uppercase">Myanmar</span>
            </h1>
          </Link>
          <div className="flex items-center gap-1">
            {searchOpen ? (
              <div className="relative" ref={searchContainerRef}>
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-md border border-white/10 px-2">
                  <Search className="w-4 h-4 text-white/60 shrink-0" />
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search..."
                    className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 h-9 w-36 sm:w-48"
                    data-testid="input-search"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white/60"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); setShowSuggestions(false); }}
                    data-testid="button-search-close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto" data-testid="search-suggestions">
                    {suggestions.map((item) => (
                      <Link
                        key={item.id}
                        href={`/series/${item.id}`}
                        onClick={() => { setShowSuggestions(false); setSearchQuery(""); setSearchOpen(false); }}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors cursor-pointer" data-testid={`suggestion-${item.id}`}>
                          <img
                            src={item.poster}
                            alt={item.title}
                            className="w-10 h-14 object-cover rounded-sm shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                          </div>
                          <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {showSuggestions && searchQuery.trim() && suggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl z-50 p-4 text-center" data-testid="search-no-results">
                    <p className="text-sm text-muted-foreground">No results found</p>
                  </div>
                )}
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
            <Link href="/downloads">
              <Button
                size="icon"
                variant="ghost"
                className="text-white/80"
                data-testid="button-my-downloads"
              >
                <Download className="w-5 h-5" />
              </Button>
            </Link>
            <NotificationBell />
            <UserAuthButton />
          </div>
        </div>
      </header>

      {!isSearching && (
        <>
          {isLoading ? (
            <Skeleton className="w-full aspect-[16/9] max-h-[50vh]" />
          ) : (
            <BannerCarousel banners={banners} />
          )}
        </>
      )}

      {isSearching && <div className="h-20" />}

       <div className="px-5 md:px-10 lg:px-16 py-12 space-y-14">
        {isSearching && filteredContent.series.length === 0 && filteredContent.movies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No results for "{searchQuery}"</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>
          </div>
        )}

        {filteredContent.series.length > 0 && (
          <section>
             <div className="flex items-end justify-between gap-2 mb-6 section-rule pt-6">
               <div className="flex items-center gap-3">
                 <span className="w-1 h-7 rounded-full bg-primary" />
                 <div><p className="text-[10px] uppercase tracking-[.25em] text-primary mb-1">Browse the lobby</p><h2 className={`${sizes.section} font-display font-bold`} data-testid="text-section-series">Series</h2></div>
               </div>
               <span className="text-xs text-muted-foreground">{filteredContent.series.length} titles</span>
            </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6">
              {filteredContent.series.map((item) => (
                <ContentCard key={item.id} item={item} isNew={newContentIds.has(item.id)} titleClass={sizes.card} />
              ))}
            </div>
          </section>
        )}

        {filteredContent.movies.length > 0 && (
          <section>
             <div className="flex items-end justify-between gap-2 mb-6 section-rule pt-6">
               <div className="flex items-center gap-3">
                 <span className="w-1 h-7 rounded-full bg-primary" />
                 <div><p className="text-[10px] uppercase tracking-[.25em] text-primary mb-1">One sitting</p><h2 className={`${sizes.section} font-display font-bold`} data-testid="text-section-movies">Movies</h2></div>
               </div>
               <span className="text-xs text-muted-foreground">{filteredContent.movies.length} titles</span>
            </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6">
              {filteredContent.movies.map((item) => (
                <ContentCard key={item.id} item={item} isNew={newContentIds.has(item.id)} titleClass={sizes.card} />
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
          <p className="text-xs text-muted-foreground/50">Series Myanmar</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-pointer flex items-center gap-1"
              data-testid="button-settings"
            >
              <Type className="w-3 h-3" />
              Font
            </button>
            <Link href="/admin">
              <span className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-pointer" data-testid="link-admin">
                Admin
              </span>
            </Link>
          </div>
        </div>

        {showSettings && (
          <div className="mt-4 p-4 rounded-lg bg-card border border-border" data-testid="panel-font-settings">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-2 block">Font Family</label>
                <div className="flex flex-wrap gap-1.5">
                  {fonts.map((f, i) => (
                    <button
                      key={f.label}
                      onClick={() => setFont(i)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        i === fontIndex
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      }`}
                      style={{ fontFamily: f.value }}
                      data-testid={`button-font-${f.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Font Size</label>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={decrease}
                    disabled={sizeIndex === 0}
                    data-testid="button-font-size-decrease"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[20px] text-center" data-testid="text-font-size">
                    {sizeIndex + 1}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={increase}
                    disabled={sizeIndex === FONT_SIZES.length - 1}
                    data-testid="button-font-size-increase"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
