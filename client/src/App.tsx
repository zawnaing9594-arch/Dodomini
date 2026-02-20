import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SeriesDetail from "@/pages/series-detail";
import Watch from "@/pages/watch";
import WatchSlug from "@/pages/watch-slug";
import Downloads from "@/pages/downloads";
import Admin from "@/pages/admin";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/series/:id" component={SeriesDetail} />
      <Route path="/watch/:epId" component={Watch} />
      <Route path="/e/:epId" component={Watch} />
      <Route path="/downloads" component={Downloads} />
      <Route path="/admin" component={Admin} />
      <Route path="/:seriesSlug/:epSlug" component={WatchSlug} />
      <Route component={NotFound} />
    </Switch>
  );
}

const FONT_FAMILIES = [
  "'Inter', 'Noto Sans Myanmar', sans-serif",
  "'Noto Sans Myanmar', sans-serif",
  "'Padauk', 'Noto Sans Myanmar', sans-serif",
  "'Pyidaungsu', 'Noto Sans Myanmar', sans-serif",
  "system-ui, -apple-system, 'Segoe UI', sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Roboto', sans-serif",
  "'Poppins', sans-serif",
];

function App() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fontFamily");
      if (saved) {
        const idx = Math.min(parseInt(saved), FONT_FAMILIES.length - 1);
        if (idx >= 0) {
          document.documentElement.style.fontFamily = FONT_FAMILIES[idx];
        }
      }
    } catch {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
