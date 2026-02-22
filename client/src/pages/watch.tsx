import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { type Content, type Episode } from "@shared/schema";
import { ArrowLeft, Lock, Play, Pause, ChevronLeft, ChevronRight, Share2, Check, Maximize, Minimize, Download, LogIn, Volume2, VolumeX, Settings, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getShareUrl, getShareLink } from "@/lib/slugs";
import logoImg from "@assets/2EC8CD7B-0E04-4AE7-AF83-C248B0735C64_1771684313948.png";

function ShareButton({ contentId, episodeNumber, title }: { contentId: number; episodeNumber: number; title: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}${getShareLink(contentId, episodeNumber)}`;

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
  }, [contentId, episodeNumber, title, toast]);

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

function getDropboxStreamUrl(url: string): string | null {
  if (!url.includes("dropbox.com")) return null;
  const rawUrl = url.replace(/[?&]dl=[01]/, "").replace(/\?$/, "") + (url.includes("?") ? "&raw=1" : "?raw=1");
  return `/api/video-stream?url=${encodeURIComponent(rawUrl)}`;
}

function isJumpShareLink(url: string): boolean {
  return (url.includes("jumpshare.com/s/") || url.includes("jumpshare.com/v/") || url.includes("jmp.sh/")) && !url.includes("jumpshare.com/embed/");
}

function getJumpShareDirectUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0].replace(/[+-]$/, "");
  return clean + "-";
}

function getJumpShareStreamUrl(url: string): string | null {
  if (!isJumpShareLink(url)) return null;
  return `/api/video-stream?url=${encodeURIComponent(getJumpShareDirectUrl(url))}`;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function isMyanmarText(text: string): boolean {
  return /[\u1000-\u109F]/.test(text);
}

function VideoPlayer({ embedUrl, videoLink, srtLink, containerRef, epTitle, seriesTitle }: { embedUrl: string; videoLink: string; srtLink?: string | null; containerRef: React.RefObject<HTMLDivElement | null>; epTitle?: string; seriesTitle?: string }) {
  const dropboxStreamUrl = getDropboxStreamUrl(videoLink);
  const jumpShareStreamUrl = getJumpShareStreamUrl(videoLink);
  const isObjectStorage = videoLink.startsWith("/objects/");
  const isDirectVideo = dropboxStreamUrl || jumpShareStreamUrl ? true : isObjectStorage || /\.(mp4|webm|m3u8|mov|avi|mkv)(\?.*)?$/i.test(videoLink);
  const directSrc = dropboxStreamUrl || jumpShareStreamUrl || videoLink;
  const isFacebook = videoLink.includes("facebook.com") || videoLink.includes("fb.watch") || videoLink.includes("fb.com");
  const isGoogleDrive = embedUrl.includes("drive.google.com");
  const [iframeError, setIframeError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [srtCues, setSrtCues] = useState<import("@/lib/srtParser").SrtCue[]>([]);
  const [currentSub, setCurrentSub] = useState("");
  const [subsOn, setSubsOn] = useState(true);
  const [srtLoaded, setSrtLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showBigPlay, setShowBigPlay] = useState(true);
  const [embedSubStarted, setEmbedSubStarted] = useState(false);
  const [embedSubTime, setEmbedSubTime] = useState(0);
  const embedSubTimerRef = useRef<ReturnType<typeof setInterval>>();
  const embedSubStartTimeRef = useRef(0);

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

  useEffect(() => {
    const handleFS = () => {
      const nativeFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      const cssFS = containerRef.current?.classList.contains("css-fullscreen") || false;
      setIsFullscreen(nativeFS || cssFS);
    };
    document.addEventListener("fullscreenchange", handleFS);
    document.addEventListener("webkitfullscreenchange", handleFS);
    return () => {
      document.removeEventListener("fullscreenchange", handleFS);
      document.removeEventListener("webkitfullscreenchange", handleFS);
    };
  }, [containerRef]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setShowBigPlay(false); } else v.pause();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current as any;
    if (!el) return;
    const nativeFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    const cssFS = el.classList.contains("css-fullscreen");

    if (nativeFS) {
      try {
        if (document.exitFullscreen) { await document.exitFullscreen(); }
        else if ((document as any).webkitExitFullscreen) { (document as any).webkitExitFullscreen(); }
      } catch {}
      return;
    }

    if (cssFS) {
      el.classList.remove("css-fullscreen");
      document.body.style.overflow = "";
      setIsFullscreen(false);
      return;
    }

    try {
      if (el.requestFullscreen) { await el.requestFullscreen(); return; }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return; }
    } catch {}

    el.classList.add("css-fullscreen");
    document.body.style.overflow = "hidden";
    setIsFullscreen(true);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        el.classList.remove("css-fullscreen");
        document.body.style.overflow = "";
        setIsFullscreen(false);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }, [containerRef]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
  }, [duration]);

  const skip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  }, [duration]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; } break;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [togglePlay, skip, toggleFullscreen]);

  useEffect(() => {
    if (!embedSubStarted || !srtCues.length) return;
    embedSubStartTimeRef.current = Date.now() - embedSubTime * 1000;
    embedSubTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - embedSubStartTimeRef.current) / 1000;
      setEmbedSubTime(elapsed);
      const cue = srtCues.find((c) => elapsed >= c.startTime && elapsed <= c.endTime);
      setCurrentSub(cue ? cue.text : "");
    }, 100);
    return () => { if (embedSubTimerRef.current) clearInterval(embedSubTimerRef.current); };
  }, [embedSubStarted, srtCues]);

  if (isDirectVideo) {
    return (
      <div
        className="relative w-full h-full select-none"
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
        onTouchStart={showControlsTemporarily}
      >
        <video
          ref={videoRef}
          src={directSrc}
          preload="auto"
          playsInline
          crossOrigin="anonymous"
          className="w-full h-full bg-black object-contain"
          data-testid="video-player"
          onClick={(e) => { e.stopPropagation(); togglePlay(); showControlsTemporarily(); }}
          onDoubleClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          onPlay={() => { setIsPlaying(true); setShowBigPlay(false); }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (!isSeeking && videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onProgress={() => {
            if (videoRef.current && videoRef.current.buffered.length > 0) {
              setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
            }
          }}
          onVolumeChange={() => {
            if (videoRef.current) {
              setVolume(videoRef.current.volume);
              setIsMuted(videoRef.current.muted);
            }
          }}
        />

        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 md:p-4 transition-opacity duration-300 pointer-events-none"
          style={{
            opacity: showControls ? 1 : 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
            paddingBottom: "40px",
          }}
        >
          {(epTitle || seriesTitle) && (
            <div className="min-w-0 flex-1">
              {seriesTitle && (
                <p className="text-white/70 text-xs md:text-sm truncate" data-testid="video-series-title">{seriesTitle}</p>
              )}
              {epTitle && (
                <p className="text-white font-medium text-sm md:text-base truncate" data-testid="video-ep-title">{epTitle}</p>
              )}
            </div>
          )}
          <img
            src={logoImg}
            alt="Series Plus"
            className="shrink-0 ml-2"
            style={{ height: isFullscreen ? "56px" : "44px", width: "auto", borderRadius: "6px" }}
            data-testid="video-logo"
          />
        </div>

        {showBigPlay && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Play className="w-8 h-8 md:w-10 md:h-10 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {subsOn && currentSub && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none px-2"
            style={{
              bottom: showControls ? (isFullscreen ? "80px" : "64px") : (isFullscreen ? "32px" : "16px"),
              transition: "bottom 0.3s ease",
              maxWidth: isFullscreen ? "80%" : "92%",
            }}
            data-testid="subtitle-display"
          >
            <span
              className="inline-block whitespace-pre-wrap leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.85)",
                color: "#fff",
                fontFamily: isMyanmarText(currentSub) ? "'Pyidaungsu', 'Noto Sans Myanmar', sans-serif" : "inherit",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                letterSpacing: "0.02em",
                padding: isFullscreen ? "8px 20px" : "4px 12px",
                borderRadius: "6px",
                fontSize: isFullscreen ? "1.25rem" : "0.875rem",
              }}
            >
              {currentSub}
            </span>
          </div>
        )}

        <div
          className="absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300"
          style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-3 px-3 md:px-5">
            <div
              ref={progressRef}
              className="group/progress relative h-1.5 hover:h-2.5 transition-all cursor-pointer mb-3 rounded-full bg-white/20"
              onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsSeeking(true);
                handleProgressClick(e);
                const onMove = (me: MouseEvent) => {
                  if (!progressRef.current || !videoRef.current) return;
                  const rect = progressRef.current.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
                  videoRef.current.currentTime = pct * duration;
                  setCurrentTime(pct * duration);
                };
                const onUp = () => {
                  setIsSeeking(false);
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
              data-testid="progress-bar"
            >
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-white/30"
                style={{ width: duration ? `${(buffered / duration) * 100}%` : "0%" }}
              />
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-red-500"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-red-500 opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-md" />
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-white/80 transition-colors p-1" data-testid="button-play-pause">
                {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6 fill-white" /> : <Play className="w-5 h-5 md:w-6 md:h-6 fill-white ml-0.5" />}
              </button>

              <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="text-white/80 hover:text-white text-xs font-bold p-1" data-testid="button-rewind">
                -10s
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="text-white/80 hover:text-white text-xs font-bold p-1" data-testid="button-forward">
                +10s
              </button>

              <div className="flex items-center gap-1 group/vol">
                <button onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; }
                }} className="text-white hover:text-white/80 p-1" data-testid="button-mute">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    e.stopPropagation();
                    const v = parseFloat(e.target.value);
                    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-0 group-hover/vol:w-16 transition-all accent-red-500 h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
                  data-testid="volume-slider"
                />
              </div>

              <span className="text-white/80 text-xs md:text-sm tabular-nums" data-testid="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {srtLoaded && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSubsOn(!subsOn); }}
                  className={`text-xs font-bold px-2 py-1 rounded transition-colors ${subsOn ? "bg-red-500 text-white" : "bg-white/20 text-white/60"}`}
                  data-testid="button-subtitle-toggle"
                >
                  CC
                </button>
              )}

              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-white/80 p-1" data-testid="button-fullscreen">
                {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const embedSubControls = (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2" data-testid="embed-sub-controls">
      {srtLoaded && !embedSubStarted && (
        <button
          onClick={() => { setEmbedSubStarted(true); setEmbedSubTime(0); }}
          className="flex items-center gap-1.5 bg-black/80 hover:bg-black/90 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
          data-testid="button-start-subtitle"
        >
          <Subtitles className="w-3.5 h-3.5" />
          Start Subtitle
        </button>
      )}
      {srtLoaded && embedSubStarted && (
        <>
          <button
            onClick={() => { setSubsOn(!subsOn); }}
            className={`text-xs font-bold px-2 py-1 rounded transition-colors ${subsOn ? "bg-red-500 text-white" : "bg-white/20 text-white/60"}`}
            data-testid="button-embed-cc"
          >
            CC
          </button>
          <span className="text-white/70 text-xs tabular-nums bg-black/60 px-2 py-1 rounded">
            {formatTime(embedSubTime)}
          </span>
          <button
            onClick={() => {
              setEmbedSubStarted(false);
              setEmbedSubTime(0);
              setCurrentSub("");
              if (embedSubTimerRef.current) clearInterval(embedSubTimerRef.current);
            }}
            className="text-white/60 hover:text-white text-xs bg-black/60 px-2 py-1 rounded transition-colors"
            data-testid="button-reset-subtitle"
          >
            Reset
          </button>
        </>
      )}
      <button
        onClick={toggleFullscreen}
        className="bg-black/80 hover:bg-black/90 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
        data-testid="button-embed-fullscreen"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>
    </div>
  );

  const embedSubDisplay = subsOn && currentSub && embedSubStarted && (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none px-2"
      style={{ bottom: "48px", maxWidth: "90%" }}
      data-testid="embed-subtitle-display"
    >
      <span
        className="inline-block whitespace-pre-wrap leading-relaxed"
        style={{
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          fontFamily: isMyanmarText(currentSub) ? "'Pyidaungsu', 'Noto Sans Myanmar', sans-serif" : "inherit",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          letterSpacing: "0.02em",
          padding: isFullscreen ? "8px 20px" : "4px 12px",
          borderRadius: "6px",
          fontSize: isFullscreen ? "1.25rem" : "0.875rem",
        }}
      >
        {currentSub}
      </span>
    </div>
  );

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
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)", paddingBottom: "30px" }}>
          {(epTitle || seriesTitle) && (
            <div className="min-w-0 flex-1">
              {seriesTitle && <p className="text-white/70 text-xs truncate">{seriesTitle}</p>}
              {epTitle && <p className="text-white font-medium text-sm truncate">{epTitle}</p>}
            </div>
          )}
          <img src={logoImg} alt="Series Plus" className="shrink-0 ml-2" style={{ height: isFullscreen ? "56px" : "44px", width: "auto", borderRadius: "6px" }} data-testid="video-logo" />
        </div>
        {embedSubDisplay}
        {embedSubControls}
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
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)", paddingBottom: "30px" }}>
        {(epTitle || seriesTitle) && (
          <div className="min-w-0 flex-1">
            {seriesTitle && <p className="text-white/70 text-xs truncate">{seriesTitle}</p>}
            {epTitle && <p className="text-white font-medium text-sm truncate">{epTitle}</p>}
          </div>
        )}
        <img src={logoImg} alt="Series Plus" className="shrink-0 ml-2" style={{ height: isFullscreen ? "56px" : "44px", width: "auto", borderRadius: "6px" }} data-testid="video-logo" />
      </div>
      {embedSubDisplay}
      {embedSubControls}
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

function DownloadButton({ videoLink, epId, epTitle }: { videoLink: string; epId: number; epTitle: string; contentTitle: string; poster: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const isDirectVideo = /\.(mp4|webm|m3u8|mov|avi|mkv)(\?.*)?$/i.test(videoLink);
  const isGoogleDrive = videoLink.includes("drive.google.com");
  const isDropbox = videoLink.includes("dropbox.com");
  const isJumpShare = isJumpShareLink(videoLink);

  const getDriveFileId = (url: string): string | null => {
    if (url.includes("/file/d/")) return url.split("/file/d/")[1].split("/")[0];
    if (url.includes("id=")) return url.split("id=")[1].split("&")[0];
    return null;
  };

  const canDownload = isDirectVideo || isGoogleDrive || isDropbox || isJumpShare;

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

  const handleDownload = () => {
    if (!canDownload) {
      window.open(videoLink, "_blank", "noopener,noreferrer");
      toast({ title: "Video link ဖွင့်ပေးပါပြီ", description: "ဖွင့်ထားတဲ့ page ကနေ video ကို save လုပ်ပါ" });
      return;
    }

    const filename = `${epTitle.replace(/[^a-zA-Z0-9\u1000-\u109F]/g, "_")}.mp4`;
    let downloadUrl: string;
    if (isGoogleDrive) {
      const fileId = getDriveFileId(videoLink);
      if (fileId) {
        downloadUrl = `/api/drive-download/${fileId}`;
      } else {
        downloadUrl = `/api/video-proxy?url=${encodeURIComponent(videoLink)}&filename=${encodeURIComponent(filename)}`;
      }
    } else if (isDropbox) {
      const rawUrl = videoLink.replace(/[?&]dl=[01]/, "").replace(/\?$/, "") + (videoLink.includes("?") ? "&raw=1" : "?raw=1");
      downloadUrl = `/api/video-proxy?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`;
    } else if (isJumpShare) {
      downloadUrl = `/api/video-proxy?url=${encodeURIComponent(getJumpShareDirectUrl(videoLink))}&filename=${encodeURIComponent(filename)}`;
    } else {
      downloadUrl = `/api/video-proxy?url=${encodeURIComponent(videoLink)}&filename=${encodeURIComponent(filename)}`;
    }

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Download စတင်ပါပြီ", description: `${epTitle} ကို download လုပ်နေပါသည်` });
  };

  return (
    <Button size="icon" variant="ghost" data-testid="button-download" title="Download" onClick={handleDownload}>
      <Download className="w-4 h-4" />
    </Button>
  );
}

function VideoContainer({ embedUrl, videoLink, srtLink, epTitle, seriesTitle }: { embedUrl: string; videoLink: string; srtLink?: string | null; epTitle?: string; seriesTitle?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      const nativeFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      const cssFS = containerRef.current?.classList.contains("css-fullscreen") || false;
      setIsFullscreen(nativeFS || cssFS);
    };
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);

    const el = containerRef.current;
    let observer: MutationObserver | null = null;
    if (el) {
      observer = new MutationObserver(() => {
        const cssFS = el.classList.contains("css-fullscreen");
        const nativeFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
        setIsFullscreen(nativeFS || cssFS);
      });
      observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black ${isFullscreen ? "" : "aspect-video max-h-[80vh]"}`}
      style={isFullscreen ? { width: "100%", height: "100%" } : undefined}
      data-testid="video-container"
      onContextMenu={(e) => e.preventDefault()}
    >
      <VideoPlayer embedUrl={embedUrl} videoLink={videoLink} srtLink={srtLink} containerRef={containerRef} epTitle={epTitle} seriesTitle={seriesTitle} />
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

  if (rawLink.includes("jumpshare.com/s/") || rawLink.includes("jumpshare.com/v/") || rawLink.includes("jmp.sh/")) {
    const cleanUrl = rawLink.split("?")[0].split("#")[0].replace(/[+-]$/, "");
    const shareId = cleanUrl.split("/").pop();
    if (shareId) {
      return `https://jumpshare.com/embed/${shareId}`;
    }
  }

  if (rawLink.includes("jumpshare.com/embed/")) {
    return rawLink;
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
            <ShareButton contentId={parent.id} episodeNumber={currentEpIndex + 1} title={`${parent.title} - ${episode.epTitle}`} />
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
          <VideoContainer embedUrl={embedUrl} videoLink={episode.videoLink} srtLink={episode.srtLink} epTitle={episode.epTitle} seriesTitle={parent.title} />

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
