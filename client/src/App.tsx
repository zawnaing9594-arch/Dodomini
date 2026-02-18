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
import Admin from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/series/:id" component={SeriesDetail} />
      <Route path="/watch/:epId" component={Watch} />
      <Route path="/e/:epId" component={Watch} />
      <Route path="/admin" component={Admin} />
      <Route path="/:seriesSlug/:epSlug" component={WatchSlug} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
