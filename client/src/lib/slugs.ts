export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function getShareUrl(epId: number, seriesTitle?: string, epTitle?: string): string {
  if (seriesTitle && epTitle) {
    return `/${encodeURIComponent(toSlug(seriesTitle))}/${encodeURIComponent(toSlug(epTitle))}`;
  }
  return `/e/${epId}`;
}
