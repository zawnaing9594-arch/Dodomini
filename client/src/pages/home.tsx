import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Content } from "@shared/schema";
import { ChevronLeft, ChevronRight, Play, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";

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
    <div className="relative w-full h-[420px] md:h-[520px] overflow-hidden" data-testid="banner-carousel">
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

function ContentCard({ item }: { item: Content }) {
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

  const banners = allContent?.slice(0, 5) || [];
  const series = allContent?.filter((c) => c.type === "series") || [];
  const movies = allContent?.filter((c) => c.type === "movie") || [];

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/90 to-transparent">
        <div className="flex items-center justify-between gap-4 px-4 md:px-8 lg:px-12 py-4">
          <Link href="/">
            <h1 className="text-xl font-bold tracking-tight text-white cursor-pointer" data-testid="text-logo">
              Series<span className="text-primary">Plus</span>
            </h1>
          </Link>
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="w-full h-[420px] md:h-[520px]" />
      ) : (
        <BannerCarousel banners={banners} />
      )}

      <div className="px-4 md:px-8 lg:px-12 py-8 space-y-10">
        {series.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold" data-testid="text-section-series">Series</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {series.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {movies.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold" data-testid="text-section-movies">Movies</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {movies.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {!isLoading && (!allContent || allContent.length === 0) && (
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
          <Link href="/admin">
            <span className="text-xs text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-pointer" data-testid="link-admin">
              Admin
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
