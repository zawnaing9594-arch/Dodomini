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
  const ms = parseInt((sParts[1] || "0").padEnd(3, "0").substring(0, 3)) || 0;
  return h * 3600 + m * 60 + s + ms / 1000;
}

function vttTimeToSeconds(time: string): number {
  const trimmed = time.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0]) || 0;
    const sParts = parts[1].split(".");
    const s = parseInt(sParts[0]) || 0;
    const ms = parseInt((sParts[1] || "0").padEnd(3, "0").substring(0, 3)) || 0;
    return m * 60 + s + ms / 1000;
  }
  return timeToSeconds(trimmed);
}

function assTimeToSeconds(time: string): number {
  const parts = time.trim().split(":");
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  const sParts = (parts[2] || "0").split(".");
  const s = parseInt(sParts[0]) || 0;
  const cs = parseInt((sParts[1] || "0").padEnd(2, "0").substring(0, 2)) || 0;
  return h * 3600 + m * 60 + s + cs / 100;
}

function stripAssTags(text: string): string {
  return text.replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n").replace(/\\n/g, "\n").trim();
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
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
    const cueText = stripHtmlTags(lines.slice(timeLineIndex + 1).join("\n"));

    cues.push({
      id: cues.length + 1,
      startTime,
      endTime,
      text: cueText,
    });
  }

  return cues;
}

export function parseVtt(text: string): SrtCue[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let content = normalized;
  if (content.startsWith("WEBVTT")) {
    const headerEnd = content.indexOf("\n\n");
    if (headerEnd !== -1) {
      content = content.substring(headerEnd + 2);
    }
  }

  const blocks = content.split(/\n\n+/).filter(Boolean);
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

    const timeLine = lines[timeLineIndex].split("-->").map((p) => p.split(/\s+/)[0] || p);
    if (timeLine.length < 2) continue;

    const startTime = vttTimeToSeconds(timeLine[0]);
    const endTime = vttTimeToSeconds(timeLine[1]);
    const cueText = stripHtmlTags(lines.slice(timeLineIndex + 1).join("\n"));

    cues.push({
      id: cues.length + 1,
      startTime,
      endTime,
      text: cueText,
    });
  }

  return cues;
}

export function parseAss(text: string): SrtCue[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const cues: SrtCue[] = [];

  let inEvents = false;
  let formatFields: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "[Events]") {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith("[") && trimmed !== "[Events]") {
      inEvents = false;
      continue;
    }

    if (inEvents && trimmed.startsWith("Format:")) {
      formatFields = trimmed
        .substring(7)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      continue;
    }

    if (inEvents && (trimmed.startsWith("Dialogue:") || trimmed.startsWith("Comment:"))) {
      const isComment = trimmed.startsWith("Comment:");
      if (isComment) continue;

      const dataStr = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      const parts = dataStr.split(",");

      if (formatFields.length === 0) {
        if (parts.length >= 10) {
          const startTime = assTimeToSeconds(parts[1]);
          const endTime = assTimeToSeconds(parts[2]);
          const cueText = stripAssTags(parts.slice(9).join(","));
          if (cueText) {
            cues.push({ id: cues.length + 1, startTime, endTime, text: cueText });
          }
        }
        continue;
      }

      const startIdx = formatFields.indexOf("start");
      const endIdx = formatFields.indexOf("end");
      const textIdx = formatFields.indexOf("text");

      if (startIdx >= 0 && endIdx >= 0 && textIdx >= 0 && parts.length > textIdx) {
        const startTime = assTimeToSeconds(parts[startIdx]);
        const endTime = assTimeToSeconds(parts[endIdx]);
        const cueText = stripAssTags(parts.slice(textIdx).join(","));
        if (cueText) {
          cues.push({ id: cues.length + 1, startTime, endTime, text: cueText });
        }
      }
    }
  }

  cues.sort((a, b) => a.startTime - b.startTime);
  return cues;
}

function detectFormat(text: string, url: string): "srt" | "vtt" | "ass" {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".vtt")) return "vtt";
  if (lowerUrl.endsWith(".ass") || lowerUrl.endsWith(".ssa")) return "ass";
  if (lowerUrl.endsWith(".srt")) return "srt";

  const trimmed = text.trimStart();
  if (trimmed.startsWith("WEBVTT")) return "vtt";
  if (trimmed.includes("[Script Info]") || trimmed.includes("[V4+ Styles]") || trimmed.includes("[Events]")) return "ass";
  return "srt";
}

export async function fetchSrt(url: string): Promise<SrtCue[]> {
  const fetchUrl = url.startsWith("/objects/") || url.startsWith("/uploads/")
    ? url
    : `/api/srt-proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error("Failed to fetch subtitle");
  const text = await res.text();

  const format = detectFormat(text, url);
  switch (format) {
    case "vtt": return parseVtt(text);
    case "ass": return parseAss(text);
    default: return parseSrt(text);
  }
}
