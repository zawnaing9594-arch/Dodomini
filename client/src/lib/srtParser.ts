export interface SrtCue {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

function timeToSeconds(time: string): number {
  const parts = time.trim().split(":");
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  const sParts = (parts[2] || "0").replace(",", ".").split(".");
  const s = parseInt(sParts[0]) || 0;
  const ms = parseInt(sParts[1] || "0") || 0;
  return h * 3600 + m * 60 + s + ms / 1000;
}

export function parseSrt(text: string): SrtCue[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/).filter(Boolean);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIndex = i;
        break;
      }
    }
    if (timeLineIndex < 0) continue;

    const timeParts = lines[timeLineIndex].split("-->");
    if (timeParts.length < 2) continue;

    const startTime = timeToSeconds(timeParts[0]);
    const endTime = timeToSeconds(timeParts[1]);
    const text = lines.slice(timeLineIndex + 1).join("\n");

    cues.push({
      id: cues.length + 1,
      startTime,
      endTime,
      text,
    });
  }

  return cues;
}

export async function fetchSrt(url: string): Promise<SrtCue[]> {
  const fetchUrl = url.startsWith("/objects/") || url.startsWith("/uploads/")
    ? url
    : `/api/srt-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error("Failed to fetch SRT");
  const text = await res.text();
  return parseSrt(text);
}
