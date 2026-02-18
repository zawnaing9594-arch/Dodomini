export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function getShareUrl(seriesTitle: string, epTitle: string): string {
  return `/${encodeURIComponent(toSlug(seriesTitle))}/${encodeURIComponent(toSlug(epTitle))}`;
}
